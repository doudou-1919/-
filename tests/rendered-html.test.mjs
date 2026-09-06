import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function clientBundleText() {
  const rootDir = new URL("../dist/client/", import.meta.url);
  const chunks = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const next = entry.isDirectory()
        ? new URL(`${entry.name}/`, dir)
        : new URL(entry.name, dir);
      if (entry.isDirectory()) stack.push(next);
      else if (entry.isFile() && /\.(js|mjs)$/.test(entry.name)) chunks.push(await readFile(next, "utf8"));
    }
  }
  return chunks.join("\n");
}

test("首页面向已有用户：标题、眉题与两个直达按钮", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /看见那些反复发生的事/);
  assert.match(html, /正在变化/);
  assert.match(html, /你的长期自我观察记录/);
  assert.match(html, /我想找你聊聊/);
  assert.match(html, /查看我的人生之书/);
  assert.match(html, /InnerOS/);
});

test("旧版首次体验文案已下线", async () => {
  const html = await (await render("/")).text();
  for (const legacy of [
    "读懂你走过的路",
    "无需注册",
    "一本属于你的人生之书",
    "生成我的人生之书",
    "使用演示人生",
    "整理经历 / 看见模式 / 写下下一章",
  ]) {
    assert.ok(!html.includes(legacy), `不应再出现旧文案：${legacy}`);
  }
});

test("文档元信息已更新为新的长期观察定位", async () => {
  const html = await (await render("/")).text();
  assert.match(html, /<title>InnerOS/);
  assert.match(html, /你的长期自我观察记录/);
});

test("客户端产物包含聊天双 Tab、历史、编年表与三观坐标", async () => {
  const bundle = await clientBundleText();
  for (const expect of [
    "随手记",
    "深度访谈",
    "对话历史",
    "补充人生大事件",
    "我的人生编年表",
    "1997—2007",
    "2012",
    "2015",
    "2018",
    "2021",
    "2026.02",
    "2026.06—至今",
    "人生观",
    "价值观",
    "世界观",
    "我反复出现的模式",
  ]) {
    assert.ok(bundle.includes(expect), `客户端产物中应包含：${expect}`);
  }
});

test("打包产物与站点托管配置存在", async () => {
  const hosting = JSON.parse(
    await readFile(new URL(".openai/hosting.json", templateRoot), "utf8"),
  );
  assert.equal(typeof hosting.project_id, "string");
  assert.ok(hosting.project_id.length > 0);
  assert.equal(hosting.d1, null);
  assert.equal(hosting.r2, null);
});
