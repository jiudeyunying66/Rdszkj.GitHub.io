#!/usr/bin/env python3
"""测试 TensorFlow LSTM 训练"""
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'  # 抑制 TF 日志
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'  # 关闭 oneDNN

import json
import sys
import time
import numpy as np
import urllib.request

# 获取真实K线
r = urllib.request.urlopen('http://localhost:3000/api/klines')
data = json.loads(r.read())
csi300 = next(x for x in data['data'] if x['id'] == 'csi300')
print(f"ETF: {csi300['name']}, K线数: {len(csi300['klines'])}", file=sys.stderr)

closes = np.array([k['close'] for k in csi300['klines']], dtype=float)
print(f"价格区间: {closes.min():.3f} ~ {closes.max():.3f}", file=sys.stderr)

# 计算收益率序列
returns = np.diff(closes) / closes[:-1]
print(f"收益率: 均值 {returns.mean():.4f}, 标准差 {returns.std():.4f}", file=sys.stderr)

# 构造滑动窗口
WINDOW = 10
X, y = [], []
for i in range(WINDOW, len(returns)):
    X.append(returns[i-WINDOW:i])
    y.append(returns[i])
X = np.array(X)[..., np.newaxis]  # (samples, timesteps, features)
y = np.array(y)
print(f"X shape: {X.shape}, y shape: {y.shape}", file=sys.stderr)

# 训练 LSTM
print("\n=== 训练真实 TF LSTM ===", file=sys.stderr)
t0 = time.time()

import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.optimizers import Adam

tf.get_logger().setLevel('ERROR')

model = Sequential([
    LSTM(32, input_shape=(WINDOW, 1), return_sequences=False),
    Dropout(0.1),
    Dense(16, activation='tanh'),
    Dense(1)
])
model.compile(optimizer=Adam(learning_rate=0.005), loss='mse')

history = model.fit(X, y, epochs=50, batch_size=8, verbose=0, validation_split=0.15)
train_time = time.time() - t0
print(f"训练耗时: {train_time:.1f}s", file=sys.stderr)
print(f"最终训练损失: {history.history['loss'][-1]:.6f}", file=sys.stderr)
print(f"最终验证损失: {history.history['val_loss'][-1]:.6f}", file=sys.stderr)

# 多步预测
last_window = returns[-WINDOW:].reshape(1, WINDOW, 1)
preds = []
for _ in range(3):
    p = model.predict(last_window, verbose=0)[0, 0]
    preds.append(float(p))
    last_window = np.roll(last_window, -1, axis=1)
    last_window[0, -1, 0] = p

print(f"\n3日预测收益率: {preds}", file=sys.stderr)
print(f"3日预测涨跌幅: {[f'{p*100:.2f}%' for p in preds]}", file=sys.stderr)
print(f"累计3日: {sum(preds)*100:.2f}%", file=sys.stderr)
print("✓ TF LSTM 训练成功", file=sys.stderr)
