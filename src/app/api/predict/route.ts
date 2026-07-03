// 预测接口 - 优先用 TensorFlow LSTM，自动回退到 sklearn MLP proxy
import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { resolve as resolvePath } from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 180;

interface KlineItem {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

interface PredictRequest {
  klines: KlineItem[];
  etfId: string;
  etfName: string;
  currentPrice: number;
}

const PYTHON = process.env.PYTHON || '/home/z/.venv/bin/python3';
const TF_SCRIPT = resolvePath(process.cwd(), 'scripts/predict/predict_tf.py');
const MLP_SCRIPT = resolvePath(process.cwd(), 'scripts/predict/predict.py');

async function runPython(scriptPath: string, req: PredictRequest, timeoutMs: number): Promise<any> {
  return new Promise((resolvePromise, rejectPromise) => {
    const py = spawn(PYTHON, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONPATH: '' },
    });

    let stdout = '';
    let stderr = '';
    let timeout: any;

    py.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    py.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    py.on('error', (err) => {
      clearTimeout(timeout);
      rejectPromise(new Error(`Python 启动失败: ${err.message}`));
    });
    py.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        rejectPromise(new Error(`Python 退出码 ${code}: ${stderr.slice(-500)}`));
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout));
      } catch (e: any) {
        rejectPromise(new Error(`JSON 解析失败: ${e.message}\nstdout 末尾: ${stdout.slice(-300)}\nstderr 末尾: ${stderr.slice(-300)}`));
      }
    });

    timeout = setTimeout(() => {
      py.kill('SIGKILL');
      rejectPromise(new Error(`Python 执行超时（${timeoutMs / 1000}s）`));
    }, timeoutMs);

    py.stdin.write(JSON.stringify(req));
    py.stdin.end();
  });
}

// 检测 TensorFlow 是否可用
async function checkTfAvailable(): Promise<boolean> {
  return new Promise((resolveCheck) => {
    const py = spawn(PYTHON, ['-c', 'import tensorflow; print("ok")'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, TF_CPP_MIN_LOG_LEVEL: '3' },
    });
    let stdout = '';
    py.stdout.on('data', (c) => { stdout += c.toString(); });
    py.on('error', () => resolveCheck(false));
    py.on('close', () => resolveCheck(stdout.includes('ok')));
    setTimeout(() => { py.kill('SIGKILL'); resolveCheck(false); }, 10000);
  });
}

export async function POST(request: Request) {
  try {
    const req: PredictRequest = await request.json();

    if (!req.klines || req.klines.length < 30) {
      return NextResponse.json(
        { error: `K线数据不足（需≥30条，实际 ${req.klines?.length || 0} 条）` },
        { status: 400 }
      );
    }

    // 优先用 TF LSTM，失败则回退到 MLP proxy
    const tfAvailable = await checkTfAvailable();
    const script = tfAvailable ? TF_SCRIPT : MLP_SCRIPT;
    const modelName = tfAvailable ? 'TensorFlow LSTM' : 'sklearn MLP (LSTM proxy, 回退模式)';

    try {
      const result = await runPython(script, req, tfAvailable ? 180000 : 120000);
      return NextResponse.json({ ...result, _model: modelName });
    } catch (err: any) {
      // TF 失败时尝试 MLP 回退
      if (tfAvailable) {
        console.error('[predict] TF 失败，回退 MLP:', err.message);
        try {
          const result = await runPython(MLP_SCRIPT, req, 120000);
          return NextResponse.json({ ...result, _model: 'sklearn MLP (TF失败回退)' });
        } catch (e2: any) {
          throw e2;
        }
      }
      throw err;
    }
  } catch (err: any) {
    console.error('[predict] 失败:', err.message);
    return NextResponse.json(
      { error: err.message || '预测失败' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    python: PYTHON,
    scripts: { tf: TF_SCRIPT, mlp: MLP_SCRIPT },
    models: ['ARIMA(statsmodels)', 'TensorFlow LSTM (主) / sklearn MLP (回退)'],
    usage: 'POST /api/predict with {klines, etfId, etfName, currentPrice}',
  });
}
