#!/usr/bin/env python3
"""测试真实数据接口"""
import json
import re
import urllib.request

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://quote.eastmoney.com/',
}

def fetch(url, encoding='utf-8'):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.read().decode(encoding, errors='replace')

# 1. 腾讯财经实时行情（GBK）
print("=" * 60)
print("1. 腾讯财经实时行情（GBK 编码）")
print("=" * 60)
raw = fetch("https://qt.gtimg.cn/q=sh510300,sh515980,sh512760,sh561910,sh562500", encoding='gbk')
for line in raw.strip().split('\n'):
    # v_sh510300="..."
    m = re.match(r'v_(\w+)="(.+)"', line)
    if not m: continue
    code, data = m.group(1), m.group(2)
    parts = data.split('~')
    if len(parts) > 35:
        print(f"\n{parts[1]} ({parts[2]})")
        print(f"  当前价: {parts[3]}")
        print(f"  昨收:   {parts[4]}")
        print(f"  开盘:   {parts[5]}")
        print(f"  成交量: {parts[6]}手")
        print(f"  最高:   {parts[33]}")
        print(f"  最低:   {parts[34]}")
        print(f"  涨跌额: {parts[31]}")
        print(f"  涨跌幅: {parts[32]}%")
        print(f"  时间:   {parts[30]}")

# 2. 东方财富 K线历史
print("\n" + "=" * 60)
print("2. 东方财富 K线历史 (510300)")
print("=" * 60)
url = "https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=1.510300&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&beg=20260101&end=20260626"
raw = fetch(url)
data = json.loads(raw)
klines = data['data']['klines']
print(f"\n股票: {data['data']['name']}")
print(f"K线条数: {len(klines)}")
print(f"最近5条:")
for k in klines[-5:]:
    # 日期,开盘,收盘,最高,最低,成交量,成交额,振幅,涨跌幅,涨跌额,换手率
    parts = k.split(',')
    print(f"  {parts[0]} 收:{parts[2]} 涨跌幅:{parts[8]}%")

# 3. 东方财富新闻搜索
print("\n" + "=" * 60)
print("3. 东方财富新闻搜索（关键词：ETF）")
print("=" * 60)
import urllib.parse
param = {
    "uid": "",
    "keyword": "ETF 宏观 央行",
    "type": ["cmsArticleWebOld"],
    "client": "web",
    "clientType": "web",
    "clientVersion": "curr",
    "param": {
        "cmsArticleWebOld": {
            "searchScope": "default",
            "sort": "default",
            "pageIndex": 1,
            "pageSize": 8,
            "preTag": "",
            "postTag": ""
        }
    }
}
url = "https://search-api-web.eastmoney.com/search/jsonp?cb=callback&param=" + urllib.parse.quote(json.dumps(param))
raw = fetch(url, encoding='utf-8')
# 去掉 callback(...)
m = re.match(r'callback\((.+)\);?$', raw, re.S)
if m:
    data = json.loads(m.group(1))
    articles = data.get('result', {}).get('cmsArticleWebOld', [])
    print(f"\n获取文章数: {len(articles)}")
    for a in articles[:5]:
        print(f"\n  标题: {a.get('title','')[:60]}")
        print(f"  时间: {a.get('date','')}")
        print(f"  内容: {a.get('content','')[:80]}")
