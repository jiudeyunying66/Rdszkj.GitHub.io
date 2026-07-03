#!/usr/bin/env python3
"""测试历史K线和新闻的备用接口"""
import json
import re
import urllib.request
import urllib.parse

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://quote.eastmoney.com/',
}

def fetch(url, encoding='utf-8', headers=None):
    h = dict(HEADERS)
    if headers: h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode(encoding, errors='replace')

# 1. 腾讯历史K线（更稳定）
print("=" * 60)
print("1. 腾讯历史K线（前复权）")
print("=" * 60)
url = "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh510300,day,,,120,qfq"
raw = fetch(url, headers={'Referer': 'https://gu.qq.com/'})
data = json.loads(raw)
klines = data['data']['sh510300']['qfqday']
print(f"K线条数: {len(klines)}")
print("最近5条 (日期, 开, 收, 高, 低, 量, ...):")
for k in klines[-5:]:
    print(f"  {k[0]} 开:{k[1]} 收:{k[2]} 高:{k[3]} 低:{k[4]} 量:{k[5]}")

# 2. 东方财富新闻（重试）
print("\n" + "=" * 60)
print("2. 东方财富新闻搜索")
print("=" * 60)
param = {
    "uid": "",
    "keyword": "央行 政策 ETF",
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
try:
    raw = fetch(url, encoding='utf-8', headers={'Referer': 'https://so.eastmoney.com/'})
    m = re.match(r'callback\((.+)\);?$', raw, re.S)
    if m:
        data = json.loads(m.group(1))
        articles = data.get('result', {}).get('cmsArticleWebOld', [])
        print(f"获取文章数: {len(articles)}")
        for a in articles[:5]:
            print(f"\n  标题: {a.get('title','')[:60]}")
            print(f"  时间: {a.get('date','')}")
            print(f"  摘要: {a.get('content','')[:100]}")
except Exception as e:
    print(f"失败: {e}")
    # 备用：腾讯新闻
    print("\n尝试腾讯新闻备用接口...")
    try:
        url2 = "https://i.news.qq.com/trpc.qqnews_web.kv_srv.kv_srv_http_proxy/list?sub_srv_id=finance&srv_id=pc&offset=0&limit=20&strategy=1&ext_info={}&category=finance"
        raw = fetch(url2, encoding='utf-8', headers={'Referer': 'https://news.qq.com/'})
        print(raw[:500])
    except Exception as e2:
        print(f"腾讯也失败: {e2}")
