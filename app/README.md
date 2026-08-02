# Benchmark Dashboard (localhost)

kiro-cli benchmark 跑批的本地监控 Web UI。后端 Python 标准库(aws CLI 取数),
前端 Vite + React。数据:SQS 队列、EC2/SSM worker 状态、S3 trial 记录、
Kiro key credits 用量(Secrets Manager 的 key 列表 + GetUsageLimits)。

## 启动

```bash
# 后端(必须,提供 /api 并托管已构建的前端)
python3 app/server.py            # http://127.0.0.1:8080

# 前端开发模式(改代码热更新,Vite 把 /api 代理到 8080)
cd app/web && npm install && npm run dev   # http://127.0.0.1:5173

# 前端改动后重新构建单端口版本
cd app/web && npm run build
```

页面顶部可选刷新频率(5s/15s/30s/60s/暂停)。

## 结果榜单

构建后的前端还提供 `http://127.0.0.1:8080/leaderboard`，以 Artificial
Analysis 风格展示 Kiro 六个模型的 performance、cost 和 execution time，
并与其公开榜单默认选择的 15 个 agent 快照比较。主口径中 error 计 0；
`Exclude errors` 仅是敏感性分析。

结果或 AA 快照更新后重新生成静态数据：

```bash
python3 scripts/build_leaderboard_data.py results/full-20260729/trials \
  --aa-data data/artificial-analysis-coding-agents.json \
  --aggregate results/full-20260729/aggregate.json \
  --out app/web/public/data/leaderboard.json
```

生成器会校验六个模型、每个 benchmark 的任务数，并确认 official 分数与
`aggregate.json` 完全一致。

## 常用参数

`python3 app/server.py --run-id <run> --port 8080`(其余默认值对应当前
full-20260729 环境:bucket/队列/secrets/`scripts/full_tasks.json`)。

缓存:trial 记录镜像在 `app/.cache/<run_id>/`(增量 sync,勿删,删了首次
加载要几分钟)。
