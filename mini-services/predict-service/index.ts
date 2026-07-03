/**
 * 预测服务 - 调用 Python 子进程执行 ARIMA + 简化 LSTM 预测
 * 端口: 3003
 */
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const PORT = 3003;
const PYTHON = 'python3';
const SCRIPT_PATH = join(import.meta.dir, 'predict.py');

interface PredictRequest {
  klines: Array<{ date: string; close: number; volume: number; high: number; low: number }>;
  etfId: string;
  etfName: string;
  currentPrice: number;
}

interface PredictResponse {
  etfId: string;
  etfName: string;
  currentPrice: number;
  arima: {
    nextDay: { openLow: number; openHigh: number; changeLow: number; changeHigh: number; mid: number };
    threeDay: { changeLow: number; changeHigh: number; mid: number };
    confidence: number;
    order: [number, number, number];
    log: string;
  };
  lstm: {
    nextDay: { openLow: number; openHigh: number; changeLow: number; changeHigh: number; mid: number };
    threeDay: { changeLow: number; changeHigh: number; mid: number };
    confidence: number;
    trainLoss?: number;
    log: string;
  };
  // 综合预测（加权融合）
  ensemble: {
    nextDay: { openLow: number; openHigh: number; changeLow: number; changeHigh: number };
    threeDay: { changeLow: number; changeHigh: number };
    confidence: number;
    method: string;
  };
  timestamp: string;
}

async function callPython(req: PredictRequest): Promise<PredictResponse> {
  // 通过 stdin/stdout 与 Python 进程通信（避免文件 I/O）
  return new Promise((resolve, reject) => {
    const py = spawn(PYTHON, [SCRIPT_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    let stdout = '';
    let stderr = '';
    let timeout: any;

    py.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    py.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      // 实时输出 stderr 便于调试
      process.stderr.write(chunk);
    });
    py.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Python 启动失败: ${err.message}`));
    });
    py.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`Python 退出码 ${code}: ${stderr.slice(-500)}`));
        return;
      }
      try {
        // Python 脚本输出 JSON 到 stdout
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e: any) {
        reject(new Error(`Python 输出解析失败: ${e.message}\nstdout: ${stdout.slice(-500)}\nstderr: ${stderr.slice(-500)}`));
      }
    });

    timeout = setTimeout(() => {
      py.kill('SIGKILL');
      reject(new Error('Python 执行超时（30s）'));
    }, 30000);

    // 发送输入
    py.stdin.write(JSON.stringify(req));
    py.stdin.end();
  });
}

async function handlePredict(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  let body = '';
  for await (const chunk of req) body += chunk;

  let payload: PredictRequest;
  try {
    payload = JSON.parse(body);
  } catch (e: any) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Bad JSON: ${e.message}` }));
    return;
  }

  if (!payload.klines || payload.klines.length < 30) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `K线数据不足（需≥30条，实际 ${payload.klines?.length || 0} 条）` }));
    return;
  }

  try {
    const result = await callPython(payload);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (e: any) {
    console.error('预测失败:', e.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

async function handleHealth(req: IncomingMessage, res: ServerResponse) {
  // 健康检查 - 简单返回 Python 是否可用
  try {
    const { execSync } = await import('child_process');
    const ver = execSync(`${PYTHON} --version`, { encoding: 'utf-8' }).trim();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', python: ver, port: PORT }));
  } catch (e: any) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', error: e.message }));
  }
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = req.url || '';
  if (url === '/predict' || url === '/') {
    return handlePredict(req, res);
  }
  if (url === '/health') {
    return handleHealth(req, res);
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`[predict-service] 预测服务已启动: http://localhost:${PORT}`);
  console.log(`[predict-service] 端点: POST /predict | GET /health`);
});
