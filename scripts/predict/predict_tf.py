#!/usr/bin/env python3
"""
真实 TF LSTM + ARIMA 综合预测脚本
输入: stdin JSON {klines, etfId, etfName, currentPrice}
输出: stdout JSON 预测结果

模型:
1. ARIMA(p,d,q): statsmodels，AIC 自动定阶
2. 真实 LSTM: tensorflow.keras.layers.LSTM (32单元)，10日窗口，多步递归预测
3. 综合预测：按置信度加权融合
"""
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import sys
import json
import warnings
import time
import hashlib
import pickle
import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.stattools import adfuller

# 抑制 TF 日志（必须在 import tf 之前）
import tensorflow as tf
tf.get_logger().setLevel('ERROR')

warnings.filterwarnings('ignore')

# ===== 模型缓存配置 =====
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache')
CACHE_TTL = 12 * 3600  # 12 小时有效期（秒）
os.makedirs(CACHE_DIR, exist_ok=True)


def get_cache_key(etf_id, klines, window_size=10):
    """生成缓存键：基于 ETF id + K线末尾日期 + K线数量 + 窗口大小"""
    if not klines:
        return None
    last_date = klines[-1].get('date', '')
    n = len(klines)
    key_str = f"{etf_id}_{last_date}_{n}_{window_size}"
    return hashlib.md5(key_str.encode('utf-8')).hexdigest()[:16]


def load_cache(cache_key):
    """加载缓存模型，返回 (model_data, meta) 或 (None, None)"""
    if not cache_key:
        return None, None
    cache_file = os.path.join(CACHE_DIR, f"{cache_key}.pkl")
    if not os.path.exists(cache_file):
        return None, None
    # 检查 TTL
    mtime = os.path.getmtime(cache_file)
    if time.time() - mtime > CACHE_TTL:
        try:
            os.remove(cache_file)
        except:
            pass
        return None, None
    try:
        with open(cache_file, 'rb') as f:
            data = pickle.load(f)
        # 加载 Keras 模型
        model_file = os.path.join(CACHE_DIR, f"{cache_key}.h5")
        if os.path.exists(model_file):
            data['model_data']['model'] = tf.keras.models.load_model(model_file, compile=False)
        return data['model_data'], data['meta']
    except Exception as e:
        sys.stderr.write(f"[predict_tf] 加载缓存失败: {e}\n")
        return None, None


def save_cache(cache_key, model_data, meta):
    """保存模型到缓存"""
    if not cache_key:
        return
    try:
        # 保存 Keras 模型
        model_file = os.path.join(CACHE_DIR, f"{cache_key}.h5")
        model_data['model'].save(model_file)
        # 保存其他数据（不含 model 对象）
        to_pickle = {k: v for k, v in model_data.items() if k != 'model'}
        cache_file = os.path.join(CACHE_DIR, f"{cache_key}.pkl")
        with open(cache_file, 'wb') as f:
            pickle.dump({'model_data': to_pickle, 'meta': meta}, f)
        sys.stderr.write(f"[predict_tf] 模型已缓存到 {cache_key}.pkl\n")
    except Exception as e:
        sys.stderr.write(f"[predict_tf] 保存缓存失败: {e}\n")


def calc_returns(closes):
    closes = np.array(closes, dtype=float)
    return np.diff(closes) / closes[:-1]


def calc_amplitude(highs, lows, closes):
    highs = np.array(highs, dtype=float)
    lows = np.array(lows, dtype=float)
    closes = np.array(closes, dtype=float)
    prev_closes = np.roll(closes, 1)
    prev_closes[0] = closes[0]
    return (highs - lows) / prev_closes


def fit_arima(closes, max_p=3, max_q=3):
    closes = np.array(closes, dtype=float)
    log_lines = []
    try:
        adf_result = adfuller(closes)
        p_value = adf_result[1]
        log_lines.append(f"ADF p-value: {p_value:.4f}")
        if p_value > 0.05:
            d = 1
            log_lines.append("序列非平稳，d=1")
        else:
            d = 0
            log_lines.append("序列平稳，d=0")
    except Exception as e:
        d = 1
        log_lines.append(f"ADF 失败，默认 d=1: {e}")

    best_aic = float('inf')
    best_order = (1, d, 1)
    best_model = None

    for p in range(0, max_p + 1):
        for q in range(0, max_q + 1):
            try:
                model = ARIMA(closes, order=(p, d, q))
                fitted = model.fit(method_kwargs={'warn_convergence': False})
                if fitted.aic < best_aic:
                    best_aic = fitted.aic
                    best_order = (p, d, q)
                    best_model = fitted
            except Exception:
                continue

    if best_model is None:
        best_model = ARIMA(closes, order=(0, 1, 0)).fit()
        best_order = (0, 1, 0)
        log_lines.append("所有阶数失败，兜底 (0,1,0)")

    log_lines.append(f"最优阶数: {best_order}, AIC: {best_aic:.2f}")
    return best_model, best_order, '\n'.join(log_lines)


def arima_predict(model, current_price, steps=3):
    forecast = model.get_forecast(steps=steps)
    mean = forecast.predicted_mean
    ci_80 = forecast.conf_int(alpha=0.20)
    ci_95 = forecast.conf_int(alpha=0.05)

    mean_vals = np.array(mean, dtype=float)
    ci_80_low = np.array(ci_80[:, 0], dtype=float) if ci_80.ndim > 1 else np.array([ci_80[0]], dtype=float)
    ci_80_high = np.array(ci_80[:, 1], dtype=float) if ci_80.ndim > 1 else np.array([ci_80[1]], dtype=float)

    return {
        'mean': mean_vals.tolist(),
        'ci80_low': ci_80_low.tolist(),
        'ci80_high': ci_80_high.tolist(),
    }


def fit_real_lstm(klines, window_size=10):
    """
    真实 TF LSTM 训练
    输入: 10日窗口的 [收益率, 振幅, 量变化] (3特征)
    输出: 次日收益率
    """
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import LSTM, Dense, Dropout, Input
    from tensorflow.keras.optimizers import Adam
    from sklearn.preprocessing import StandardScaler

    closes = np.array([k['close'] for k in klines], dtype=float)
    highs = np.array([k['high'] for k in klines], dtype=float)
    lows = np.array([k['low'] for k in klines], dtype=float)
    volumes = np.array([k['volume'] for k in klines], dtype=float)

    returns = calc_returns(closes)
    amplitude = calc_amplitude(highs[1:], lows[1:], closes[1:])
    vol_change = np.diff(np.log(volumes[1:] + 1))

    min_len = min(len(returns), len(amplitude), len(vol_change))
    returns = returns[:min_len]
    amplitude = amplitude[:min_len]
    vol_change = vol_change[:min_len]

    # 构造多特征滑动窗口
    X, y = [], []
    for i in range(window_size, min_len):
        # 形状 (window_size, 3)
        features = np.column_stack([
            returns[i-window_size:i],
            amplitude[i-window_size:i],
            vol_change[i-window_size:i],
        ])
        X.append(features)
        y.append(returns[i])

    X = np.array(X, dtype=float)  # (samples, timesteps, 3 features)
    y = np.array(y, dtype=float)

    if len(X) < 20:
        return None, f"训练样本不足: {len(X)}"

    # 标准化 (按特征维度)
    n_samples, n_timesteps, n_features = X.shape
    X_2d = X.reshape(-1, n_features)
    scaler_X = StandardScaler()
    X_2d_scaled = scaler_X.fit_transform(X_2d)
    X_scaled = X_2d_scaled.reshape(n_samples, n_timesteps, n_features)

    scaler_y = StandardScaler()
    y_scaled = scaler_y.fit_transform(y.reshape(-1, 1)).ravel()

    # 构建 LSTM 模型
    model = Sequential([
        Input(shape=(n_timesteps, n_features)),
        LSTM(32, return_sequences=True, dropout=0.1, recurrent_dropout=0.0),
        LSTM(16, return_sequences=False, dropout=0.1),
        Dense(8, activation='tanh'),
        Dense(1)
    ])
    model.compile(optimizer=Adam(learning_rate=0.005), loss='mse')

    # 训练（早停）
    from tensorflow.keras.callbacks import EarlyStopping
    early_stop = EarlyStopping(monitor='val_loss', patience=15, restore_best_weights=True, verbose=0)

    t0 = time.time()
    history = model.fit(
        X_scaled, y_scaled,
        epochs=80,
        batch_size=8,
        verbose=0,
        validation_split=0.2,
        callbacks=[early_stop],
    )
    train_time = time.time() - t0
    train_loss = float(history.history['loss'][-1])
    val_loss = float(history.history['val_loss'][-1])

    # 反标准化预测
    y_pred_scaled = model.predict(X_scaled, verbose=0).ravel()
    y_pred = scaler_y.inverse_transform(y_pred_scaled.reshape(-1, 1)).ravel()
    rmse = float(np.sqrt(np.mean((y - y_pred) ** 2)))

    return {
        'model': model,
        'scaler_X': scaler_X,
        'scaler_y': scaler_y,
        'window_size': window_size,
        'last_window': {
            'returns': returns[-window_size:].tolist(),
            'amplitude': amplitude[-window_size:].tolist(),
            'vol_change': vol_change[-window_size:].tolist(),
        },
        'train_loss': train_loss,
        'val_loss': val_loss,
        'rmse': rmse,
        'train_time': train_time,
        'n_samples': len(X),
        'epochs_trained': len(history.history['loss']),
    }, f"TF LSTM 训练样本: {len(X)}, 训练损失: {train_loss:.6f}, 验证损失: {val_loss:.6f}, RMSE: {rmse:.6f}, 训练时长: {train_time:.1f}s, 轮数: {len(history.history['loss'])}"


def lstm_predict_multi_step(model_data, steps=3):
    model = model_data['model']
    scaler_X = model_data['scaler_X']
    scaler_y = model_data['scaler_y']
    window_size = model_data['window_size']

    returns = list(model_data['last_window']['returns'])
    amplitude = list(model_data['last_window']['amplitude'])
    vol_change = list(model_data['last_window']['vol_change'])

    predictions = []
    for _ in range(steps):
        # 构造 (1, window_size, 3)
        features = np.array([
            [returns[-(window_size - j)], amplitude[-(window_size - j)], vol_change[-(window_size - j)]]
            for j in range(window_size)
        ])
        # 标准化
        n_features = features.shape[1]
        features_2d = features.reshape(-1, n_features)
        features_scaled = scaler_X.transform(features_2d).reshape(1, window_size, n_features)

        y_scaled = model.predict(features_scaled, verbose=0)[0, 0]
        y = float(scaler_y.inverse_transform([[y_scaled]])[0][0])
        predictions.append(y)

        # 滑动窗口更新
        returns.append(y)
        amplitude.append(float(np.mean(amplitude[-window_size:])))
        vol_change.append(float(np.mean(vol_change[-window_size:])))

    rmse = model_data['rmse']
    # 多步误差放大 sqrt(step)
    ci_low = [p - 1.5 * rmse * np.sqrt(i + 1) for i, p in enumerate(predictions)]
    ci_high = [p + 1.5 * rmse * np.sqrt(i + 1) for i, p in enumerate(predictions)]

    return {'mean': predictions, 'ci_low': ci_low, 'ci_high': ci_high}


def main():
    try:
        input_data = sys.stdin.read()
        req = json.loads(input_data)
    except Exception as e:
        print(json.dumps({'error': f'输入解析失败: {e}'}))
        sys.exit(1)

    klines = req['klines']
    etf_id = req['etfId']
    etf_name = req['etfName']
    current_price = float(req['currentPrice'])
    closes = [k['close'] for k in klines]

    # ===== ARIMA =====
    try:
        arima_model, arima_order, arima_log = fit_arima(closes)
        arima_result = arima_predict(arima_model, current_price, steps=3)

        arima_next_mean = arima_result['mean'][0]
        arima_next_low = arima_result['ci80_low'][0]
        arima_next_high = arima_result['ci80_high'][0]
        arima_next_change_mid = (arima_next_mean - current_price) / current_price * 100
        arima_next_change_low = (arima_next_low - current_price) / current_price * 100
        arima_next_change_high = (arima_next_high - current_price) / current_price * 100
        arima_next_open_low = current_price * (1 + arima_next_change_low / 100)
        arima_next_open_high = current_price * (1 + arima_next_change_high / 100)

        arima_3d_end = arima_result['mean'][2]
        arima_3d_low = arima_result['ci80_low'][2]
        arima_3d_high = arima_result['ci80_high'][2]
        arima_3d_change_mid = (arima_3d_end - current_price) / current_price * 100
        arima_3d_change_low = (arima_3d_low - current_price) / current_price * 100
        arima_3d_change_high = (arima_3d_high - current_price) / current_price * 100

        n = len(closes)
        aic = arima_model.aic
        arima_confidence = min(0.85, max(0.4, 0.7 - abs(aic) / (n * 100) + n / 500))

        arima_out = {
            'nextDay': {
                'openLow': round(arima_next_open_low, 4),
                'openHigh': round(arima_next_open_high, 4),
                'changeLow': round(arima_next_change_low, 2),
                'changeHigh': round(arima_next_change_high, 2),
                'mid': round(arima_next_change_mid, 2),
            },
            'threeDay': {
                'changeLow': round(arima_3d_change_low, 2),
                'changeHigh': round(arima_3d_change_high, 2),
                'mid': round(arima_3d_change_mid, 2),
            },
            'confidence': round(arima_confidence, 2),
            'order': list(arima_order),
            'log': arima_log + f"\nAIC: {aic:.2f}, n: {n}",
        }
    except Exception as e:
        arima_out = {
            'nextDay': {'openLow': current_price, 'openHigh': current_price, 'changeLow': 0, 'changeHigh': 0, 'mid': 0},
            'threeDay': {'changeLow': 0, 'changeHigh': 0, 'mid': 0},
            'confidence': 0,
            'order': [0, 0, 0],
            'log': f"ARIMA 失败: {e}",
        }

    # ===== 真实 TF LSTM（带缓存） =====
    try:
        # 检查缓存
        cache_key = get_cache_key(etf_id, klines, window_size=10)
        cached_model, cached_meta = load_cache(cache_key)
        if cached_model is not None:
            sys.stderr.write(f"[predict_tf] 命中缓存 {cache_key}，跳过训练\n")
            sys.stderr.flush()
            lstm_model = cached_model
            lstm_log = f"TF LSTM 缓存命中 (key={cache_key})\n训练样本: {cached_model['n_samples']}, 训练损失: {cached_model['train_loss']:.6f}, 验证损失: {cached_model['val_loss']:.6f}, RMSE: {cached_model['rmse']:.6f}, 训练时长: {cached_model['train_time']:.1f}s, 轮数: {cached_model['epochs_trained']}"
            train_time = 0  # 缓存命中，无需训练时间
        else:
            sys.stderr.write(f"[predict_tf] 缓存未命中 {cache_key}，开始训练 TF LSTM...\n")
            sys.stderr.flush()
            t_train_start = time.time()
            lstm_model, lstm_log = fit_real_lstm(klines, window_size=10)
            if lstm_model is None:
                raise Exception(lstm_log)
            train_time = time.time() - t_train_start
            # 保存缓存
            save_cache(cache_key, lstm_model, {
                'etf_id': etf_id,
                'etf_name': etf_name,
                'cached_at': pd.Timestamp.now().isoformat(),
            })

        sys.stderr.write("[predict_tf] 开始预测...\n")
        sys.stderr.flush()
        lstm_result = lstm_predict_multi_step(lstm_model, steps=3)

        lstm_next_mid = lstm_result['mean'][0] * 100
        lstm_next_low = lstm_result['ci_low'][0] * 100
        lstm_next_high = lstm_result['ci_high'][0] * 100
        lstm_next_open_low = current_price * (1 + lstm_next_low / 100)
        lstm_next_open_high = current_price * (1 + lstm_next_high / 100)

        lstm_3d_mid = sum(lstm_result['mean']) * 100
        lstm_3d_low = sum(lstm_result['ci_low']) * 100
        lstm_3d_high = sum(lstm_result['ci_high']) * 100

        train_loss = lstm_model['train_loss']
        val_loss = lstm_model['val_loss']
        rmse = lstm_model['rmse']
        train_time = lstm_model['train_time']
        epochs = lstm_model['epochs_trained']
        # 置信度：基于验证损失
        lstm_confidence = min(0.85, max(0.35, 0.75 - rmse * 5 - val_loss * 2))

        lstm_out = {
            'nextDay': {
                'openLow': round(lstm_next_open_low, 4),
                'openHigh': round(lstm_next_open_high, 4),
                'changeLow': round(lstm_next_low, 2),
                'changeHigh': round(lstm_next_high, 2),
                'mid': round(lstm_next_mid, 2),
            },
            'threeDay': {
                'changeLow': round(lstm_3d_low, 2),
                'changeHigh': round(lstm_3d_high, 2),
                'mid': round(lstm_3d_mid, 2),
            },
            'confidence': round(lstm_confidence, 2),
            'trainLoss': round(train_loss, 6),
            'valLoss': round(val_loss, 6),
            'rmse': round(rmse, 6),
            'trainTime': round(train_time, 1),
            'epochs': epochs,
            'log': lstm_log,
        }
    except Exception as e:
        import traceback
        lstm_out = {
            'nextDay': {'openLow': current_price, 'openHigh': current_price, 'changeLow': 0, 'changeHigh': 0, 'mid': 0},
            'threeDay': {'changeLow': 0, 'changeHigh': 0, 'mid': 0},
            'confidence': 0,
            'log': f"LSTM 失败: {e}\n{traceback.format_exc()[-300:]}",
        }

    # ===== Ensemble =====
    w_arima = arima_out['confidence']
    w_lstm = lstm_out['confidence']
    total_w = w_arima + w_lstm
    if total_w == 0:
        w_arima = 0.5
        w_lstm = 0.5
        total_w = 1
    w_arima /= total_w
    w_lstm /= total_w

    ens_next_low = w_arima * arima_out['nextDay']['changeLow'] + w_lstm * lstm_out['nextDay']['changeLow']
    ens_next_high = w_arima * arima_out['nextDay']['changeHigh'] + w_lstm * lstm_out['nextDay']['changeHigh']
    ens_next_open_low = current_price * (1 + ens_next_low / 100)
    ens_next_open_high = current_price * (1 + ens_next_high / 100)

    ens_3d_low = w_arima * arima_out['threeDay']['changeLow'] + w_lstm * lstm_out['threeDay']['changeLow']
    ens_3d_high = w_arima * arima_out['threeDay']['changeHigh'] + w_lstm * lstm_out['threeDay']['changeHigh']

    ensemble_out = {
        'nextDay': {
            'openLow': round(ens_next_open_low, 4),
            'openHigh': round(ens_next_open_high, 4),
            'changeLow': round(ens_next_low, 2),
            'changeHigh': round(ens_next_high, 2),
        },
        'threeDay': {
            'changeLow': round(ens_3d_low, 2),
            'changeHigh': round(ens_3d_high, 2),
        },
        'confidence': round(max(arima_out['confidence'], lstm_out['confidence']), 2),
        'method': f'加权融合 ARIMA{tuple(arima_out["order"])} × TF_LSTM (权重 {w_arima:.2f}:{w_lstm:.2f})',
    }

    result = {
        'etfId': etf_id,
        'etfName': etf_name,
        'currentPrice': current_price,
        'arima': arima_out,
        'lstm': lstm_out,
        'ensemble': ensemble_out,
        'model': 'tensorflow.keras LSTM (32+16 units, 3 features)',
        'timestamp': pd.Timestamp.now().isoformat(),
    }

    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
