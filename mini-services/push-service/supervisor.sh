#!/bin/bash
# push-service 守护脚本 - 当服务退出时自动重启
cd "$(dirname "$0")"

while true; do
    echo "[$(date '+%H:%M:%S')] 启动 push-service..."
    bun index.ts 2>&1
    echo "[$(date '+%H:%M:%S')] 服务退出 (code=$?)，3 秒后重启..."
    sleep 3
done
