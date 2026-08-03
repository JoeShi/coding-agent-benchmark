# Kiro CLI 全量 Benchmark 完整执行报告

**Run ID:** `full-20260729` · **周期:** 2026-07-29 ~ 2026-08-01（约 4 天）
**规模:** 3 个榜单 × 321 题 × 6 个模型变体 × 3 次尝试 = **5,778 个 trial**
**基础设施:** Terraform 管理的 AWS fleet(us-east-1):25 台 EC2 worker(21×c7i.4xlarge + 4×c7i.8xlarge)、SQS 任务队列、S3 结果桶、ECR pull-through cache ×2(Docker Hub + ghcr)、Secrets Manager 存 13 把 Kiro API key

> 数据文件:`trials/`(5,778 条 trial 记录)、`aggregate.json`、`report.md`(计分报告)、本文档。

---

## 一、最终结果

| 模型变体 | TB2 | DeepSWE | QnA | **Composite** | Credits | 成本 (USD) | 平均时长 |
|---|---|---|---|---|---|---|---|
| **gpt-5.6-sol** | 0.766 | 0.667 | 0.535 | **0.656** | 12,587 | $503 | 553s |
| claude-opus-5 | 0.778 | 0.670 | 0.508 | 0.652 | 30,033 | $1,201 | 884s |
| claude-opus-4.8 | 0.738 | 0.572 | 0.505 | 0.605 | 23,313 | $933 | 651s |
| claude-sonnet-5 | 0.698 | 0.319 | 0.363 | 0.460 | 26,114 | $1,045 | 693s |
| auto | 0.603 | 0.209 | 0.290 | 0.368 | 9,013 | $361 | 499s |
| claude-sonnet-4.6 | 0.611 | 0.136 | 0.333 | 0.360 | 13,337 | $533 | 515s |

- 计分:task-normalized pass@1(每题 3 次尝试取平均，再对题平均);composite 为三榜单简单平均;error trial 计 0(AA 惯例)
- 数据质量：覆盖率 5,778/5,778，无重复无缺失;残留 error **122 个(2.1%)**,来源为 kiro 后端抖动(45)、顽固性无遥测(40)、3 小时超时(33)、限流(4)。全部列入 `rerun_pending.json`,暂未重跑
- 结论速读:**gpt-5.6-sol 综合第一且已观测成本仅为 opus-5 的 42%**;opus-5 残留 error 最多(52 个),分数被轻微压低，与 gpt-5.6-sol 实为伯仲;auto 模式表现显著偏弱
- 遥测覆盖：credits/cost 覆盖 5,184/5,778（89.72%）,时长覆盖 5,188/5,778（89.79%）。因此 Credits/成本是**已观测下界**,平均时长仅基于有时长遥测的 trial,不代表全部运行（尤其不含多数 3 小时超时）

---

## 二、各轮次过程与结果

| 轮次 | 时间 | 内容 | 结束时数据状态 |
|---|---|---|---|
| 0. 小批次 | 07-29 | smoke 验证(108 trials) | 跑通,`results/smoke-20260729/report.md` |
| 1. 全量首轮 | 07-29~30 | 5,778 jobs,100 槽 × 6 key | **严重污染**:passed 1,063,仅 ~29% 数据可信。key 轮换 bug 导致 25 并发/key,大规模限流 |
| 2. 清扫轮 1 | 07-30 | 限流重分类(2,608 条假 failed 改为 error),3,445 条重跑;key 扩到 11 把、轮换修复、ghcr 走 ECR PTC | passed 2,424 / failed 2,932 / error 422 |
| 3. 清扫轮 2 | 07-30~31 | 发现"瞬断"死亡模式(后端 failed to generate a response),422 条重跑 | passed 2,565 / failed 3,157 / error 56。**但随后发现两个数据事故(见坑 5、6)** |
| 4. 审查+956 轮 | 07-31 | 用户要求全面验算。数学验证通过,但发现 956 个"failed 无 credits"疑似假失败;确立不变式后重跑 | passed 2,735 / failed 2,341 / error 702 |
| 5. 分类+482 轮 | 07-31 | 702 精确分类:220 个"真失败被误标"改回 failed,482 个真死亡重跑;期间修复 kiro-cli 转发 bug | passed 2,748 / failed 2,581 / error 449 |
| 6. stdbuf 轮 | 07-31 | 查明 32 个 QnA 任务全灭根因(容器缺 stdbuf),sweep 443 + 439 条重跑 | QnA passed 764→915,error 391→159 |
| 7. 挂死处理+最终轮 | 08-01 | 57 个 trial 流式挂死(CPU 0%、日志静默 2 小时),kill 54 个;154 条重跑;33 个最终触发 Harbor 3 小时超时并重分类 | 该轮快照:passed 2,861 / failed 2,794 / error 123 |
| 8. 尾部回收 | 08-01~03 | 第 7 轮统计后仍有 14 条重跑结果陆续落 S3(12 条 failed→passed、1 条 passed→failed、1 条 error→failed) | **最终**:passed 2,872 / failed 2,784 / error 122 |

每次清扫只重跑 error(没跑起来的),真 failed 从不重跑 —— 这是全程遵守的数据纪律。

> 拉取 trial 记录时必须用 `aws s3 sync --exact-timestamps`:重跑会原地覆盖同一个 S3 key,而 `"failed"` 与 `"passed"` 字节数相同,默认的"大小 + 更新时间"启发式会静默保留旧副本。第 8 轮的 14 条差异就是这样被漏掉的。

---

## 三、遇到的坑与解决方案(按影响排序)

### 1. kiro-cli 2.15.x 参数转发回归(最大根因)
`kiro-cli` 启动器把 argv 转发给 `kiro-cli-chat` 时会重新拆分,任务指令里只要有 `- ` 开头的列表行(markdown  bullets,benchmark 题目里很常见),就在 clap 解析阶段死亡:`unexpected argument '- ' found`。**本会话从未开始**,verifier 对未改动的环境判 0。本地 kiro-cli 2.9.0 实测正常,确认为新版回归。
**解决:** `build_chat_command` 改为直调 `kiro-cli-chat`(同一二进制本体),热部署 25 台 worker 无需重启。这是"同一任务全模型全灭"模式的最主要来源。

### 2. QnA 镜像缺 stdbuf(第二根因)
32 个 QnA 任务(sftpgo/minio/k6 等 repo 的极简镜像)没有 `stdbuf`,日志管道 `| stdbuf -oL tee` 整体失败,agent 从未启动,全 18 格 0 分。
**解决:** 命令改为 `command -v stdbuf` 检测,缺失时降级裸 `tee`。修复后这些任务 pass 率 56.5%(高于 QnA 均值),证明纯粹是环境冤枉。

### 3. Kiro API key 轮换 bug + 限流
`worker_loop` 在启动时一次性绑定 key,4 槽 × 25 台全部只用前 4 把 key(25 并发/key),第 5、6 把闲置,首轮 ~2,600 个 trial 被限流杀死。
**解决:** 每台 worker 启动时 shuffle key 列表,**按 trial 轮换**并打日志;key 扩到 13 把(实测分属 13 个不同账号),75 槽 ≈ 5.8/key,限流降至噪声级。

### 4. harness 判分不区分"没解出"和"没跑" → 不变式治理
agent 任何死亡方式都被 verifier 记 0。死亡文案五花八门(限流/瞬断/DB 锁/被杀),逐一枚举是打地鼠。
**解决:** 确立不变式 `failed + 无 credits → error/no_telemetry`(每个正常跑完的 run 都有 Credits 行),并加**活动量豁免**(≥5 次工具调用或 ≥10KB 日志则信任 verifier 判定)—— 因为 harbor 上 ~10% 的正常 run 也会丢 Credits 行(超时被杀)。

### 5. reparse 多 worker 互相覆盖(自己引入的事故)
同一 trial 的新旧 job 目录散落在不同 worker,fleet 级 reparse 各自上传,旧记录把 667 个 passed 覆盖成 error。
**解决:** 改"报告合并"模式 —— worker 只导出带时间戳的候选,`merge_reparse_reports.py` 按最新 result.json mtime 决胜,确定性重建权威记录。

### 6. reparse 跳过 QnA 嵌套目录
QnA 任务名含 `/`,job 目录是嵌套的,首轮 reparse 静默跳过全部 2,232 个 QnA 目录。
**解决:** 解析时重新拼接父子目录名。

### 7. Kiro 流式挂死
57 个 trial 的 API 流式连接挂死(客户端无超时),容器 CPU 0%、日志静默 2 小时,只有 3 小时 agent 超时兜底。
**解决:** 监控 45 分钟 stall 告警发现;fleet 扫描日志静默 >45 分钟的进程并 kill(第一版脚本因 cwd 判断 bug 空转,改为从 cmdline 取 job-name 后成功),消息回收重跑。

### 8. QnA 镜像 trial 时现拉失败
124 个 QnA 任务的 ghcr 镜像首轮现拉失败 788 次(compose up 超时)。
**解决:** ECR pull-through cache 接 ghcr(需 GitHub PAT),提前暖 11 个镜像;worker 拉取改走 PTC 并 retag。

### 9. 自身运维造成的损耗
两次 fleet 重启杀掉 ~150 个在跑 trial(消息 4 小时后才回队列);26 个长 QnA 被连杀两次进 DLQ(手工挪回);`kiro-pats.txt` 被 `aws s3 sync` 误传到 S3(秒删 + 永久 `--exclude`)。
**教训:** 热更新优先(只同步 Python 模块,新 trial 自然加载);不得不重启时接受代价并记账。

### 10. 其他小坑(均已固化)
kiro-cli install 要 `--no-confirm`;AL2023 缺 compose/buildx 插件;systemd 用 `bash worker.sh`(S3 同步丢执行位);stale job dir 导致 harness "resume" 跳过重跑(每轮 `rm -rf`);job 级 result.json 会掩盖 trial 级结果;老 glibc 镜像需 musl 版 kiro-cli;SSM 三连坑(base64 传脚本、IMDSv2 取 instance-id 为空、SSM 角色无 secretsmanager 权限)。

---

## 四、方法论与可复现性

- **任务集**:AA Coding Agent Index 官方 evaluated-tasks 口径(TB2 84 + DeepSWE 113 + QnA 124),`scripts/full_tasks.json`
- **agent**:kiro-cli 2.15.1(glibc)/ 2.15.2(musl 回退),`kiro-cli-chat chat --no-interactive --trust-all-tools`,harness: harbor 0.20.0(TB2/QnA)+ pier 0.3.0(DeepSWE)
- **判分**:TB2/DeepSWE 为测试型 verifier(DeepSWE 取 `/app` 的 git diff);QnA 为 LLM judge(claude-opus-4-5,经一个自建 OpenAI 兼容代理,主机名不公开;rubric → 二元判定)
- **成本**:kiro-cli 不暴露 token 数,以 credits × $0.04(官方超额单价)计;judge 成本另计
- **数据清洗规则**:error(rate_limit / transient_api / db_locked / no_telemetry / infra)一律重跑不计分;failed 永不重跑;最终残留 error 计 0
- **复盘文档**:`docs/full-20260729-retrospective.md`(英文,pitfall 速查)

## 五、经验总结(给下一次跑)

1. **先用不变式,再谈签名**:`failed + 无 credits` 直接判 error 重跑,别枚举死因文本;配合活动量豁免防误伤。
2. **小批次就要压测单 key 并发上限**,key 轮换必须按 trial 而非按进程。
3. **一切 trial 产物按 (benchmark, task, model, attempt) 确定性落 S3**,重跑自然去重;跨 worker 的记录修复只走"报告-合并",绝不直接互传。
4. **监控要盯质量不只是进度**:滚动窗口的"无 credits 失败率"是最灵敏的污染探针;45 分钟无记录变化的 stall 告警能抓挂死。
5. **agent 容器是黑盒**:agent 死在里面时,tee 出来的 `kiro-cli.txt` 是唯一真相来源,每个新死因都值得 fleet 级扫一遍归类。
