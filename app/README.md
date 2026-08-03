# Benchmark Dashboard (localhost)

kiro-cli benchmark 跑批的本地 Web UI,就是 `app/site` 里的 Next.js 站点。
数据:SQS 队列、EC2/SSM worker 状态、S3 trial 记录、Kiro key credits 用量
(Secrets Manager 的 key 列表 + GetUsageLimits)。

## 启动

平时只要一个进程:

```bash
cd app/site && npm install && npm run dev
```

- 榜单:<http://localhost:3000>
- 任务监控:<http://localhost:3000/monitor>(导航栏右上角 “Task Monitor”)

用 `localhost` 而不是 `127.0.0.1` 访问 dev server —— Next 默认把其他 host
当跨域 dev 请求拦掉,HMR 会断,页面不会 hydrate(表现为数据一直不出来)。

## 监控页的两个数据源

监控页顶部 **Source** 可切:

- **Snapshot (static)** —— 默认。读 `app/site/public/data/monitor.json`,
  跑批结束后队列是空的、fleet 已经拆了、记录已经定稿,没什么可轮询的,
  所以不需要任何后台进程。刷新数据 = 重跑一次脚本:

  ```bash
  python3 scripts/build_monitor_snapshot.py          # 默认 full-20260729
  python3 scripts/build_monitor_snapshot.py --run-id <id> --out <path>
  ```

  脚本把四个 collector 各跑一次,写成和五个 `/api/*` 完全一样的结构
  (`overview`/`workers`/`keys`/`benchmarks`/`tasks`),所以页面组件不用改。
  某个 AWS 调用挂了只会把报错写进那一段的 `error`,其余照常落盘。

  这个 JSON 是要提交进公开仓库的,所以 key 表里的身份列会被抹掉
  (masked key 和账号邮箱 → `account-NN` / `-`);credits 数据照常保留。

- **Live (API)** —— 只在真有 run 在飞的时候用,需要另起 API 进程:

  ```bash
  python3 app/server.py            # http://127.0.0.1:8081,只有 /api/*
  ```

  Next 通过 `next.config.ts` 的 `rewrites()` 把 `/api/*` 反代到 8081。端口
  改了就用 `MONITOR_API` 覆盖代理目标:

  ```bash
  MONITOR_API=http://127.0.0.1:9000 npm run dev
  ```

  Live 模式下才有刷新频率选项(5s/15s/30s/60s/Paused,默认 15s)。

## 结果榜单数据

榜单是静态数据,由生成器写进 `app/site/src/data/leaderboard.json`。
主口径中 error 计 0;`Exclude errors` 仅是敏感性分析。

结果或 AA 快照更新后重新生成:

```bash
python3 scripts/build_leaderboard_data.py results/full-20260729/trials \
  --aa-data data/artificial-analysis-coding-agents.json \
  --aggregate results/full-20260729/aggregate.json \
  --out app/site/src/data/leaderboard.json
```

生成器会校验六个模型、每个 benchmark 的任务数,并确认 official 分数与
`aggregate.json` 完全一致。

## 常用参数

`python3 app/server.py --run-id <run> --port 8081`,以及
`python3 scripts/build_monitor_snapshot.py --run-id <run>`(两者其余默认值都
对应当前 full-20260729 环境:bucket/队列/secrets/`scripts/full_tasks.json`)。

缓存:trial 记录镜像在 `app/.cache/<run_id>/`(增量 sync,勿删,删了首次
加载要几分钟)。server.py 和快照脚本共用这份缓存。
