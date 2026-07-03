#!/usr/bin/env python3
"""
预测服务 - 主进程接收请求，子进程执行预测（隔离 sklearn/statsmodels 崩溃风险）
端口: 3003
"""
import sys
import json
import os
import subprocess
import threading
import platform
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

PORT = 3003
SCRIPT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'predict.py')
PYTHON = sys.executable


def run_predict(req):
    """spawn 子进程执行预测，超时 60s"""
    payload = json.dumps(req).encode('utf-8')
    try:
        proc = subprocess.run(
            [PYTHON, SCRIPT_PATH],
            input=payload,
            capture_output=True,
            timeout=60,
        )
        if proc.returncode != 0:
            return {'error': f'Python 退出码 {proc.returncode}', 'stderr': proc.stderr.decode('utf-8', errors='replace')[-500:]}, 500
        try:
            return json.loads(proc.stdout.decode('utf-8')), 200
        except json.JSONDecodeError as e:
            return {'error': f'JSON 解析失败: {e}', 'stdout': proc.stdout.decode('utf-8', errors='replace')[-500:]}, 500
    except subprocess.TimeoutExpired:
        return {'error': '预测超时（60s）'}, 504
    except Exception as e:
        return {'error': str(e)}, 500


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        if self.path == '/health':
            self._send(200, {
                'status': 'ok',
                'python': platform.python_version(),
                'port': PORT,
                'models': ['ARIMA(statsmodels)', 'LSTM-MLP(sklearn)'],
                'mode': 'subprocess',
            })
        else:
            self._send(404, {'error': 'Not Found'})

    def do_POST(self):
        if self.path not in ('/predict', '/'):
            self._send(404, {'error': 'Not Found'})
            return
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            req = json.loads(body)
        except Exception as e:
            self._send(400, {'error': f'Bad JSON: {e}'})
            return

        if not req.get('klines') or len(req['klines']) < 30:
            self._send(400, {'error': f"K线数据不足（需≥30条，实际 {len(req.get('klines', []))} 条）"})
            return

        sys.stderr.write(f"[predict] {req.get('etfId')} klines={len(req.get('klines', []))}\n")
        sys.stderr.flush()
        result, code = run_predict(req)
        self._send(code, result)

    def log_message(self, format, *args):
        pass  # 静默 HTTP 访问日志


def main():
    server = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    server.daemon_threads = True
    print(f"[predict-service] 预测服务已启动: http://0.0.0.0:{PORT}", flush=True)
    print(f"[predict-service] 端点: POST /predict | GET /health", flush=True)
    print(f"[predict-service] 模式: subprocess (隔离 sklearn 崩溃)", flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
