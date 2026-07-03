#!/usr/bin/env python3
"""
ARIMA + 简化 LSTM 预测脚本
输入: stdin JSON {klines, etfId, etfName, currentPrice}
输出: stdout JSON 预测结果

模型说明:
1. ARIMA(p,d,q): 使用 statsmodels.tsa.arima.model.ARIMA，自动定阶 (AIC)
2. LSTM 替代: 由于环境无 tensorflow，使用 sklearn.neural_network.MLPRegressor
   实现一个滑动窗口神经网络（功能等价于简化 LSTM）
   - 输入: 过去 window_size 日收益率 + 振幅 + 换手
   - 输出: 次日收益率
   - 多步预测: 递归推断
"""
import sys
import json
import warnings
import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings('ignore')


def calc_returns(closes):
    """计算日收益率"""
    closes = np.array(closes, dtype=float)
    return np.diff(closes) / closes[:-1]


def calc_amplitude(highs, lows, closes):
    """计算振幅 (high-low)/prev_close"""
    highs = np.array(highs, dtype=float)
    lows = np.array(lows, dtype=float)
    closes = np.array(closes, dtype=float)
    prev_closes = np.roll(closes, 1)
    prev_closes[0] = closes[0]
    return (highs - lows) / prev_closes


def fit_arima(closes, max_p=3, max_q=3):
    """自动定阶 ARIMA，返回 (model, order, log)"""
    closes = np.array(closes, dtype=float)
    log_lines = []

    # ADF 检验平稳性，决定 d
    from statsmodels.tsa.stattools import adfuller
    try:
        adf_result = adfuller(closes)
        p_value = adf_result[1]
        log_lines.append(f"ADF p-value: {p_value:.4f}")
        if p_value > 0.05:
            d = 1  # 非平稳，差分一次
            log_lines.append("序列非平稳，d=1")
        else:
            d = 0
            log_lines.append("序列平稳，d=0")
    except Exception as e:
        d = 1
        log_lines.append(f"ADF 失败，默认 d=1: {e}")

    # 用 AIC 选 p, q
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
        # 兜底：ARIMA(0,1,0)
        best_model = ARIMA(closes, order=(0, 1, 0)).fit()
        best_order = (0, 1, 0)
        log_lines.append("所有阶数失败，兜底 (0,1,0)")

    log_lines.append(f"最优阶数: {best_order}, AIC: {best_aic:.2f}")
    return best_model, best_order, '\n'.join(log_lines)


def arima_predict(model, current_price, steps=3):
    """ARIMA 多步预测"""
    forecast = model.get_forecast(steps=steps)
    mean = forecast.predicted_mean
    # 95% 置信区间
    ci = forecast.conf_int(alpha=0.05)
    # 80% 置信区间
    ci_80 = forecast.conf_int(alpha=0.20)

    mean_vals = np.array(mean, dtype=float)
    ci_low = np.array(ci[:, 0], dtype=float) if ci.ndim > 1 else np.array([ci[0]], dtype=float)
    ci_high = np.array(ci[:, 1], dtype=float) if ci.ndim > 1 else np.array([ci[1]], dtype=float)
    ci_80_low = np.array(ci_80[:, 0], dtype=float) if ci_80.ndim > 1 else np.array([ci_80[0]], dtype=float)
    ci_80_high = np.array(ci_80[:, 1], dtype=float) if ci_80.ndim > 1 else np.array([ci_80[1]], dtype=float)

    return {
        'mean': mean_vals.tolist(),
        'ci95_low': ci_low.tolist(),
        'ci95_high': ci_high.tolist(),
        'ci80_low': ci_80_low.tolist(),
        'ci80_high': ci_80_high.tolist(),
    }


def fit_lstm_proxy(klines, window_size=10):
    """
    简化 LSTM：用 MLPRegressor 模拟 LSTM 的滑动窗口预测
    输入特征: 过去 window_size 日的 [收益率, 振幅, 量变化]
    输出: 次日收益率
    训练数据: 滑动窗口生成
    """
    closes = np.array([k['close'] for k in klines], dtype=float)
    highs = np.array([k['high'] for k in klines], dtype=float)
    lows = np.array([k['low'] for k in klines], dtype=float)
    volumes = np.array([k['volume'] for k in klines], dtype=float)

    returns = calc_returns(closes)
    amplitude = calc_amplitude(highs[1:], lows[1:], closes[1:])  # 对齐 returns
    vol_change = np.diff(np.log(volumes[1:] + 1))  # 量变化率

    # 对齐长度
    min_len = min(len(returns), len(amplitude), len(vol_change))
    returns = returns[:min_len]
    amplitude = amplitude[:min_len]
    vol_change = vol_change[:min_len]

    # 构造滑动窗口样本
    X, y = [], []
    for i in range(window_size, min_len):
        # 输入：过去 window_size 日的 (returns, amplitude, vol_change)
        features = []
        for j in range(i - window_size, i):
            features.extend([returns[j], amplitude[j], vol_change[j]])
        X.append(features)
        # 输出：当日收益率
        y.append(returns[i])

    X = np.array(X, dtype=float)
    y = np.array(y, dtype=float)

    if len(X) < 20:
        return None, "训练样本不足"

    # 标准化
    scaler_X = StandardScaler()
    scaler_y = StandardScaler()
    X_scaled = scaler_X.fit_transform(X)
    y_scaled = scaler_y.fit_transform(y.reshape(-1, 1)).ravel()

    # 训练 MLP（模拟 LSTM）
    mlp = MLPRegressor(
        hidden_layer_sizes=(64, 32, 16),  # 三层隐藏层，模拟 LSTM 记忆单元
        activation='tanh',  # tanh 接近 LSTM 门控
        solver='adam',
        alpha=0.01,  # L2 正则
        max_iter=500,
        learning_rate_init=0.005,
        random_state=42,
        early_stopping=True,
        validation_fraction=0.2,
        n_iter_no_change=20,
    )

    try:
        mlp.fit(X_scaled, y_scaled)
        train_loss = mlp.loss_
    except Exception as e:
        return None, f"MLP 训练失败: {e}"

    # 计算训练集 RMSE（反标准化后）
    y_pred_scaled = mlp.predict(X_scaled)
    y_pred = scaler_y.inverse_transform(y_pred_scaled.reshape(-1, 1)).ravel()
    rmse = np.sqrt(np.mean((y - y_pred) ** 2))

    # 模型对象 + 元数据
    model_data = {
        'mlp': mlp,
        'scaler_X': scaler_X,
        'scaler_y': scaler_y,
        'window_size': window_size,
        'last_window': {
            'returns': returns[-window_size:].tolist(),
            'amplitude': amplitude[-window_size:].tolist(),
            'vol_change': vol_change[-window_size:].tolist(),
        },
        'train_loss': float(train_loss),
        'rmse': float(rmse),
        'n_samples': len(X),
    }
    return model_data, f"训练样本: {len(X)}, 训练损失: {train_loss:.6f}, RMSE: {rmse:.6f}"


def lstm_predict_multi_step(model_data, steps=3):
    """LSTM 多步递归预测"""
    mlp = model_data['mlp']
    scaler_X = model_data['scaler_X']
    scaler_y = model_data['scaler_y']
    window_size = model_data['window_size']

    # 当前窗口
    returns = list(model_data['last_window']['returns'])
    amplitude = list(model_data['last_window']['amplitude'])
    vol_change = list(model_data['last_window']['vol_change'])

    predictions = []  # 收益率预测
    for _ in range(steps):
        # 构造特征
        features = []
        for j in range(window_size):
            features.extend([returns[-(window_size - j)], amplitude[-(window_size - j)], vol_change[-(window_size - j)]])
        X = np.array([features], dtype=float)
        X_scaled = scaler_X.transform(X)
        y_scaled = mlp.predict(X_scaled)[0]
        y = scaler_y.inverse_transform([[y_scaled]])[0][0]
        predictions.append(float(y))
        # 滑动窗口：用预测值更新
        returns.append(y)
        amplitude.append(np.mean(amplitude[-window_size:]))  # 用历史均值近似
        vol_change.append(np.mean(vol_change[-window_size:]))

    # 用训练 RMSE 估计置信区间
    rmse = model_data['rmse']
    # 多步误差放大 (sqrt(step))
    ci_low = [p - 1.5 * rmse * np.sqrt(i + 1) for i, p in enumerate(predictions)]
    ci_high = [p + 1.5 * rmse * np.sqrt(i + 1) for i, p in enumerate(predictions)]

    return {
        'mean': predictions,
        'ci_low': ci_low,
        'ci_high': ci_high,
    }


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

    # ===== ARIMA 预测 =====
    try:
        arima_model, arima_order, arima_log = fit_arima(closes)
        arima_result = arima_predict(arima_model, current_price, steps=3)

        # 次日（第 1 步）
        arima_next_mean = arima_result['mean'][0]
        arima_next_low = arima_result['ci80_low'][0]
        arima_next_high = arima_result['ci80_high'][0]
        # 转换为涨跌幅
        arima_next_change_mid = (arima_next_mean - current_price) / current_price * 100
        arima_next_change_low = (arima_next_low - current_price) / current_price * 100
        arima_next_change_high = (arima_next_high - current_price) / current_price * 100
        # 开盘价区间
        arima_next_open_low = current_price * (1 + arima_next_change_low / 100)
        arima_next_open_high = current_price * (1 + arima_next_change_high / 100)

        # 3日累计
        arima_3d_end = arima_result['mean'][2]  # 第3日预期
        arima_3d_low = arima_result['ci80_low'][2]
        arima_3d_high = arima_result['ci80_high'][2]
        arima_3d_change_mid = (arima_3d_end - current_price) / current_price * 100
        arima_3d_change_low = (arima_3d_low - current_price) / current_price * 100
        arima_3d_change_high = (arima_3d_high - current_price) / current_price * 100

        # 置信度：基于 AIC 与样本量
        n = len(closes)
        aic = arima_model.aic
        # 简化置信度：样本多 + AIC 低 -> 高置信度
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

    # ===== LSTM (MLP) 预测 =====
    try:
        lstm_model, lstm_log = fit_lstm_proxy(klines, window_size=10)
        if lstm_model is None:
            raise Exception(lstm_log)

        lstm_result = lstm_predict_multi_step(lstm_model, steps=3)

        # 次日
        lstm_next_mid = lstm_result['mean'][0] * 100  # 转百分比
        lstm_next_low = lstm_result['ci_low'][0] * 100
        lstm_next_high = lstm_result['ci_high'][0] * 100
        lstm_next_open_low = current_price * (1 + lstm_next_low / 100)
        lstm_next_open_high = current_price * (1 + lstm_next_high / 100)

        # 3日累计（收益率相加近似）
        lstm_3d_mid = sum(lstm_result['mean']) * 100
        lstm_3d_low = sum(lstm_result['ci_low']) * 100
        lstm_3d_high = sum(lstm_result['ci_high']) * 100

        # 置信度：基于训练损失
        train_loss = lstm_model['train_loss']
        rmse = lstm_model['rmse']
        # RMSE 越小置信度越高
        lstm_confidence = min(0.8, max(0.35, 0.7 - rmse * 5))

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
            'log': lstm_log,
        }
    except Exception as e:
        lstm_out = {
            'nextDay': {'openLow': current_price, 'openHigh': current_price, 'changeLow': 0, 'changeHigh': 0, 'mid': 0},
            'threeDay': {'changeLow': 0, 'changeHigh': 0, 'mid': 0},
            'confidence': 0,
            'log': f"LSTM 失败: {e}",
        }

    # ===== 综合预测 (加权融合) =====
    # 权重根据各自置信度
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
        'method': f'加权融合 ARIMA({arima_out["order"]}) × MLP_LSTM_proxy (权重 {w_arima:.2f}:{w_lstm:.2f})',
    }

    result = {
        'etfId': etf_id,
        'etfName': etf_name,
        'currentPrice': current_price,
        'arima': arima_out,
        'lstm': lstm_out,
        'ensemble': ensemble_out,
        'timestamp': pd.Timestamp.now().isoformat(),
    }

    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
