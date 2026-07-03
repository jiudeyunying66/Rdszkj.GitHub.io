#!/usr/bin/env python3
"""
报告图表生成 - 使用 matplotlib 生成 PNG，返回 Base64
输入: stdin JSON {quotes, klines, backtest, userConfig}
输出: stdout JSON {charts: {name: base64, ...}}

图表:
1. positions_pnl: 持仓盈亏柱状图
2. equity_curve: 净值曲线（如果有 backtest）
3. capital_allocation: 资金分配饼图
4. today_change: 今日涨跌幅柱状图
5. kline_trend: 沪深300近30日走势
"""
import sys
import json
import base64
import io
import warnings
warnings.filterwarnings('ignore')

import matplotlib
matplotlib.use('Agg')
import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
import numpy as np

# 注册中文字体
try:
    fm.fontManager.addfont('/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf')
except:
    pass
try:
    fm.fontManager.addfont('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
except:
    pass

plt.rcParams['font.sans-serif'] = ['Noto Sans SC', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# 配色
COLOR_UP = '#ef4444'
COLOR_DOWN = '#22c55e'
COLOR_INFO = '#38bdf8'
COLOR_WARN = '#f59e0b'
COLOR_PRIMARY = '#b8860b'
COLOR_FLAT = '#94a3b8'
COLOR_PURPLE = '#a855f7'

DARK_BG = '#15171f'
DARK_CARD = '#21232f'
DARK_FG = '#f1f5f9'
DARK_MUTED = '#94a3b8'


def fig_to_base64(fig, dpi=80):
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=dpi, bbox_inches='tight', facecolor=DARK_CARD)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')


def chart_positions_pnl(quotes, user_config):
    positions = user_config.get('positions', {})
    names, pnls, colors = [], [], []
    for q in quotes:
        pos = positions.get(q['id'])
        if not pos or pos.get('shares', 0) == 0:
            continue
        pnl = (q['currentPrice'] - pos['costPrice']) * pos['shares']
        names.append(q['name'][:6] if isinstance(q.get('name'), str) else q['id'])
        pnls.append(pnl)
        colors.append(COLOR_UP if pnl >= 0 else COLOR_DOWN)

    if not names:
        return None

    fig, ax = plt.subplots(figsize=(8, 4), constrained_layout=True)
    fig.patch.set_facecolor(DARK_CARD)
    ax.set_facecolor(DARK_BG)
    bars = ax.bar(names, pnls, color=colors, edgecolor='none', width=0.6)
    ax.axhline(y=0, color=DARK_MUTED, linewidth=0.8, linestyle='--')
    ax.set_title('持仓盈亏分布（元）', color=DARK_FG, fontsize=12, pad=10)
    ax.tick_params(colors=DARK_MUTED)
    for sp in ['top', 'right']:
        ax.spines[sp].set_visible(False)
    for sp in ['left', 'bottom']:
        ax.spines[sp].set_color(DARK_MUTED)
    ax.yaxis.grid(True, color=DARK_MUTED, alpha=0.2, linestyle=':')
    for bar, pnl in zip(bars, pnls):
        h = bar.get_height()
        ax.text(bar.get_x() + bar.get_width() / 2, h, f'{pnl:+.0f}', ha='center',
                va='bottom' if h >= 0 else 'top', color=DARK_FG, fontsize=9)
    return fig_to_base64(fig)


def chart_today_change(quotes):
    names, changes, colors = [], [], []
    for q in quotes:
        names.append(q['name'][:6] if isinstance(q.get('name'), str) else q['id'])
        chg = q.get('changePercent', 0)
        changes.append(chg)
        colors.append(COLOR_UP if chg >= 0 else COLOR_DOWN)

    if not names:
        return None

    fig, ax = plt.subplots(figsize=(8, 3.5), constrained_layout=True)
    fig.patch.set_facecolor(DARK_CARD)
    ax.set_facecolor(DARK_BG)
    bars = ax.bar(names, changes, color=colors, edgecolor='none', width=0.6)
    ax.axhline(y=0, color=DARK_MUTED, linewidth=0.8, linestyle='--')
    ax.set_title('今日涨跌幅（%）', color=DARK_FG, fontsize=12, pad=10)
    ax.tick_params(colors=DARK_MUTED)
    for sp in ['top', 'right']:
        ax.spines[sp].set_visible(False)
    for sp in ['left', 'bottom']:
        ax.spines[sp].set_color(DARK_MUTED)
    ax.yaxis.grid(True, color=DARK_MUTED, alpha=0.2, linestyle=':')
    for bar, chg in zip(bars, changes):
        h = bar.get_height()
        ax.text(bar.get_x() + bar.get_width() / 2, h, f'{chg:+.2f}%', ha='center',
                va='bottom' if h >= 0 else 'top', color=DARK_FG, fontsize=9)
    return fig_to_base64(fig)


def chart_capital_allocation(quotes, user_config):
    positions = user_config.get('positions', {})
    core_value = 0
    satellite_value = 0
    for q in quotes:
        pos = positions.get(q['id'])
        if not pos:
            continue
        value = pos['shares'] * q['currentPrice']
        if q['id'] == 'csi300':
            core_value += value
        else:
            satellite_value += value
    cash = user_config.get('cashReserve', 0)
    total = core_value + satellite_value + cash
    if total <= 0:
        return None

    labels = ['核心底仓\n沪深300', '卫星仓位', '账户现金']
    sizes = [core_value, satellite_value, cash]
    colors = [COLOR_PRIMARY, COLOR_INFO, COLOR_WARN]
    explode = (0.05, 0.02, 0.02)

    fig, ax = plt.subplots(figsize=(6, 5), constrained_layout=True)
    fig.patch.set_facecolor(DARK_CARD)
    ax.set_facecolor(DARK_BG)
    wedges, texts, autotexts = ax.pie(
        sizes, labels=labels, colors=colors, explode=explode,
        autopct=lambda p: f'{p:.1f}%\n¥{p * total / 100:.0f}',
        startangle=90, textprops={'color': DARK_FG, 'fontsize': 9},
        wedgeprops={'edgecolor': DARK_CARD, 'linewidth': 2}
    )
    for at in autotexts:
        at.set_fontsize(8)
    ax.set_title('资金分配', color=DARK_FG, fontsize=12, pad=10)
    return fig_to_base64(fig)


def chart_equity_curve(backtest):
    if not backtest or not backtest.get('equityCurve'):
        return None
    curve = backtest['equityCurve']
    dates = [p['date'] for p in curve]
    strategy = [p.get('strategy', p.get('total', 0)) for p in curve]
    benchmark = [p.get('benchmark', 0) for p in curve]

    fig, ax = plt.subplots(figsize=(9, 4), constrained_layout=True)
    fig.patch.set_facecolor(DARK_CARD)
    ax.set_facecolor(DARK_BG)
    ax.plot(dates, strategy, color=COLOR_PRIMARY, linewidth=2, label='策略净值')
    if any(benchmark):
        ax.plot(dates, benchmark, color=COLOR_FLAT, linewidth=1.5, linestyle='--', label='基准')
    ax.set_title('策略净值 vs 基准（180 日回测）', color=DARK_FG, fontsize=12, pad=10)
    ax.tick_params(colors=DARK_MUTED)
    for sp in ['top', 'right']:
        ax.spines[sp].set_visible(False)
    for sp in ['left', 'bottom']:
        ax.spines[sp].set_color(DARK_MUTED)
    ax.yaxis.grid(True, color=DARK_MUTED, alpha=0.2, linestyle=':')
    ax.legend(facecolor=DARK_BG, edgecolor=DARK_MUTED, labelcolor=DARK_FG, fontsize=9)
    n = len(dates)
    if n > 6:
        step = max(1, n // 6)
        ax.set_xticks(range(0, n, step))
        ax.set_xticklabels([dates[i][5:] for i in range(0, n, step)], rotation=30, ha='right')
    return fig_to_base64(fig)


def chart_kline_trend(klines):
    if not klines:
        return None
    csi300 = next((k for k in klines if k.get('id') == 'csi300'), None)
    if not csi300:
        csi300 = klines[0]
    kl = csi300.get('klines', [])[-30:]
    if len(kl) < 5:
        return None
    dates = [k['date'] for k in kl]
    closes = [k['close'] for k in kl]

    fig, ax = plt.subplots(figsize=(9, 3.5), constrained_layout=True)
    fig.patch.set_facecolor(DARK_CARD)
    ax.set_facecolor(DARK_BG)
    ax.fill_between(range(len(closes)), closes, min(closes) * 0.98, color=COLOR_INFO, alpha=0.2)
    ax.plot(closes, color=COLOR_INFO, linewidth=2)
    ax.set_title(f'{csi300.get("name", "")} 近 30 日走势', color=DARK_FG, fontsize=12, pad=10)
    ax.tick_params(colors=DARK_MUTED)
    for sp in ['top', 'right']:
        ax.spines[sp].set_visible(False)
    for sp in ['left', 'bottom']:
        ax.spines[sp].set_color(DARK_MUTED)
    ax.yaxis.grid(True, color=DARK_MUTED, alpha=0.2, linestyle=':')
    n = len(dates)
    step = max(1, n // 5)
    ax.set_xticks(range(0, n, step))
    ax.set_xticklabels([dates[i][5:] for i in range(0, n, step)], rotation=30, ha='right')
    return fig_to_base64(fig)


def main():
    try:
        req = json.loads(sys.stdin.read())
    except Exception as e:
        print(json.dumps({'error': f'输入解析失败: {e}'}))
        sys.exit(1)

    quotes = req.get('quotes', [])
    klines = req.get('klines', [])
    backtest = req.get('backtest')
    user_config = req.get('userConfig', {})

    charts = {}
    for name, fn in [
        ('positions_pnl', lambda: chart_positions_pnl(quotes, user_config)),
        ('today_change', lambda: chart_today_change(quotes)),
        ('capital_allocation', lambda: chart_capital_allocation(quotes, user_config)),
        ('kline_trend', lambda: chart_kline_trend(klines)),
    ]:
        try:
            b64 = fn()
            if b64:
                charts[name] = b64
        except Exception as e:
            sys.stderr.write(f"[charts] {name} 失败: {e}\n")

    if backtest:
        try:
            b64 = chart_equity_curve(backtest)
            if b64:
                charts['equity_curve'] = b64
        except Exception as e:
            sys.stderr.write(f"[charts] equity_curve 失败: {e}\n")

    print(json.dumps({'charts': charts, 'count': len(charts)}))


if __name__ == '__main__':
    main()
