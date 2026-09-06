import { env } from "cloudflare:workers";

interface D1Result<T> { results?: T[] }
interface D1Statement { bind(...values: unknown[]): D1Statement; run(): Promise<unknown>; all<T>(): Promise<D1Result<T>> }
interface D1Database { prepare(sql: string): D1Statement; batch(statements: D1Statement[]): Promise<unknown> }
interface R2Bucket { put(key: string, value: ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown> }
type RuntimeEnv = { DB: D1Database; CORPUS: R2Bucket; DEEPSEEK_API_KEY?: string; DEEPSEEK_MODEL?: string };

const runtime = () => env as unknown as RuntimeEnv;
const labels: Record<string, string> = { website: "网站链接", wechat: "微信聊天记录", ai_chat: "AI 对话记录", diary: "日记", image: "图片", audio: "语音文件", folder: "特定文件夹" };
const frequencyLabels: Record<string, string> = { once: "仅一次", daily: "每天", weekly: "每周", monthly: "每月", quarterly: "每季度" };

async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS import_records (id TEXT PRIMARY KEY, source_type TEXT NOT NULL, name TEXT NOT NULL, object_key TEXT, source_url TEXT, fetched_at TEXT NOT NULL, frequency TEXT NOT NULL DEFAULT '仅一次', status TEXT NOT NULL, ai_digest TEXT, next_run_at TEXT, created_at INTEGER NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_import_records_created_at ON import_records(created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_import_records_next_run_at ON import_records(next_run_at) WHERE next_run_at IS NOT NULL"),
  ]);
}

function nextRun(frequency: string): string | null {
  const date = new Date();
  if (frequency === "daily") date.setDate(date.getDate() + 1);
  else if (frequency === "weekly") date.setDate(date.getDate() + 7);
  else if (frequency === "monthly") date.setMonth(date.getMonth() + 1);
  else if (frequency === "quarterly") date.setMonth(date.getMonth() + 3);
  else return null;
  return date.toISOString();
}

async function digest(text: string): Promise<string> {
  const { DEEPSEEK_API_KEY, DEEPSEEK_MODEL } = runtime();
  if (!DEEPSEEK_API_KEY || !text.trim()) return "语料已归档，等待 AI 提取人生节点。";
  const response = await fetch("https://api.deepseek.com/chat/completions", { method: "POST", headers: { authorization: `Bearer ${DEEPSEEK_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ model: DEEPSEEK_MODEL ?? "deepseek-v4-flash", messages: [{ role: "system", content: "你是 InnerOS 人生资料编辑。请从用户导入的原始语料中提取一条不超过80字、可放入《人生之书》的候选人生节点。忠于原文，不诊断，不虚构。只输出候选内容。" }, { role: "user", content: text.slice(0, 12000) }], thinking: { type: "disabled" }, max_tokens: 300, stream: false }) });
  if (!response.ok) throw new Error("ai_digest_failed");
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || "语料已归档，等待 AI 提取人生节点。";
}

export async function GET() {
  const { DB } = runtime(); await ensureSchema(DB);
  const rows = await DB.prepare("SELECT id, source_type AS sourceType, name, fetched_at AS fetchedAt, frequency, status, ai_digest AS aiDigest FROM import_records ORDER BY created_at DESC LIMIT 100").all<Record<string, string>>();
  return Response.json({ records: rows.results ?? [] });
}

export async function POST(request: Request) {
  const { DB, CORPUS } = runtime(); await ensureSchema(DB);
  const form = await request.formData();
  const sourceType = String(form.get("sourceType") ?? "website");
  const url = String(form.get("url") ?? "").trim();
  const file = form.get("file");
  const id = crypto.randomUUID(); const now = new Date();
  let name = url; let raw = ""; let contentType = "text/plain";
  if (file instanceof File && file.size) { name = file.name; contentType = file.type || contentType; raw = /^(text\/|application\/(json|csv))/.test(contentType) ? await file.text() : `[${labels[sourceType] ?? sourceType}] ${file.name}`; }
  else if (url) { const response = await fetch(url, { headers: { "user-agent": "InnerOS-Importer/1.0" }, signal: AbortSignal.timeout(15000) }); if (!response.ok) return Response.json({ error: "source_fetch_failed" }, { status: 422 }); raw = await response.text(); contentType = response.headers.get("content-type") ?? contentType; }
  else return Response.json({ error: "missing_source" }, { status: 400 });
  const folder = `corpus/${sourceType}/${now.toISOString().slice(0, 10)}`; const objectKey = `${folder}/${id}-${name.split("/").pop() || "source.txt"}`;
  if (file instanceof File && file.size) await CORPUS.put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType } }); else await CORPUS.put(objectKey, raw, { httpMetadata: { contentType } });
  let aiDigest = ""; let status = "已归档";
  try { aiDigest = await digest(raw); status = "已更新人生之书"; } catch (error) { console.error("[InnerOS import] AI digest failed", error instanceof Error ? error.message : "unknown_error"); status = "已归档 · AI待重试"; }
  await DB.prepare("INSERT INTO import_records (id, source_type, name, object_key, source_url, fetched_at, frequency, status, ai_digest, next_run_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)").bind(id, labels[sourceType] ?? sourceType, name, objectKey, url || null, now.toLocaleString("zh-CN"), "仅一次", status, aiDigest, now.getTime()).run();
  return Response.json({ id, status, aiDigest });
}

export async function PUT(request: Request) {
  const { DB } = runtime(); await ensureSchema(DB);
  const body = await request.json() as { sourceType?: string; target?: string; frequency?: string };
  if (!body.target || !body.frequency) return Response.json({ error: "missing_schedule" }, { status: 400 });
  const id = crypto.randomUUID(); const now = new Date(); const frequency = frequencyLabels[body.frequency] ?? body.frequency;
  await DB.prepare("INSERT INTO import_records (id, source_type, name, source_url, fetched_at, frequency, status, next_run_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, labels[body.sourceType ?? "website"] ?? body.sourceType, body.target, body.target, now.toLocaleString("zh-CN"), frequency, "等待定时抓取", nextRun(body.frequency), now.getTime()).run();
  return Response.json({ id, status: "scheduled" });
}
