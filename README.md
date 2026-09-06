# -

> 原仓库初始 README（`qingdou-1919/-` 的 Initial commit 内容），按“拉取并保留原内容后合并”的要求保留于此。

---

# InnerOS · 我的人生之书（已有用户版 Demo）

用 AI 帮助用户整理经历、看见反复出现的模式、理解正在变化的自己，并把经用户确认的洞察沉淀进一本“我的人生之书”。

当前演示的是一个已积累数据的用户 **林晓**（1997 年生，产品设计师，2026 年初经历错过晋升的转折）：

- **首页**：长期自我观察记录入口 ——「我想找你聊聊」（随手记 / 深度访谈）与「查看我的人生之书」直达。
- **聊天**：随手记 + 深度访谈双 Tab；历史侧栏默认收起、按模式切换；深度访谈按阶段产出“待确认洞察”，经确认/补充/否定后才进入人生之书。
- **人生之书**：第一章“我的人生编年表”（7 个节点，童年至今，可补充人生大事件并经 AI 确认）；第二章“我是谁”（内在坐标：人生观/价值观/世界观 + 反复模式）；第三、四章“我在哪里 / 我要去哪里”。

单页状态式 Demo：Next.js + TypeScript + React，无账号、无数据库、刷新不保留用户新增；界面中 / EN 双语。

## 快速开始

```bash
pnpm install
pnpm run dev      # 本地开发
pnpm run build    # 生产构建（vinext → dist/）
pnpm test         # 构建 + SSR 冒烟测试
```

AI（可选）：设置环境变量 `OPENAI_API_KEY`（可选 `OPENAI_MODEL`，默认 `gpt-5.2`）后，`/api/inneros` 会调用真实模型；未设置或异常时自动返回与林晓故事一致的兜底回复。

## 关键文件

| 路径 | 说明 |
|---|---|
| `app/page.tsx` | 全部页面视图与会话内状态 |
| `app/types.ts` | 公共类型（ChatMode / Conversation / ChatMessage / Attachment / LifeEventDraft / ConfirmedLifeEvent / BeliefInsight） |
| `app/api/inneros/route.ts` | AI 统一入口（chat / event_review） |
| `app/globals.css` | 主题与样式（米白底 / 黑排版 / 鲜红路径 / 低饱和蓝绿辅助） |
| `tests/rendered-html.test.mjs` | SSR 冒烟与产物断言 |
| `HANDOVER.md` | 面向下一位接手者/Codex 的完整交接文档 |

## 站点托管（OpenAI Sites）

`.openai/hosting.json` 声明 `project_id: appgprj_6a9cfdc63cd08191bb3acfba6c6d93f2`（无 D1 / R2 绑定）。发布需在具备 Sites 发布权限的 Codex 环境中执行 `pnpm run build` 并重新发布当前版本。

更多产品决策与时间线请阅读 [`HANDOVER.md`](./HANDOVER.md)。
