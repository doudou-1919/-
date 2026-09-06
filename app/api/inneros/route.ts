import type { ChatMessage, ChatMode, ConversationSummary, LifeEventDraft } from "../../types";
import { env } from "cloudflare:workers";

type Lang = "zh" | "en";

type RequestBody =
  | { task: "chat"; mode?: ChatMode; lang?: Lang; messages?: ChatMessage[] }
  | { task: "conversation_summary"; mode?: ChatMode; lang?: Lang; messages?: ChatMessage[] }
  | { task: "event_review"; lang?: Lang; event?: LifeEventDraft };

const chatFallback: Record<Lang, Record<ChatMode, string[]>> = {
  zh: {
    quick_note: [
      "我先把这份感受替你放在这里。它不需要马上变成结论；如果愿意，可以再写下此刻最具体的一幕。",
      "这次我不重复追问。你写下的内容里，最值得留下的是那份真实感受——我们可以从它继续，也可以先停在这里。",
      "我记住了。换一个角度看，这也许不是要求你立刻解决什么，而是在提醒你注意自己的消耗与需要。",
    ],
    deep_interview: [
      "我们换一个入口：如果这种状态会说话，它最希望你停止忽略什么？",
      "不沿用刚才的问题。回看这段经历，哪一个选择最不像你真正想做的？",
      "让我们从反面靠近答案：什么样的生活即使看起来成功，你也不愿再继续？",
    ],
  },
  en: {
    quick_note: [
      "I'll hold this here without forcing it into a conclusion. If you want, add the most concrete scene from this moment.",
      "I won't repeat the previous question. What matters here is that the feeling is real; we can continue from it or simply let it stand.",
      "I've noted it. From another angle, this may be less a problem to solve than a signal about your energy and needs.",
    ],
    deep_interview: [
      "Let's enter from another direction: if this feeling could speak, what would it ask you to stop ignoring?",
      "I won't reuse the last question. Looking back, which choice felt least like one you truly wanted?",
      "Let's approach it from the opposite side: what kind of life would you refuse, even if it looked successful?",
    ],
  },
};

type RuntimeEnv = { DEEPSEEK_API_KEY?: string; DEEPSEEK_MODEL?: string };

function getRuntimeEnv(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}

function fallbackFor(lang: Lang, mode: ChatMode, messages: ChatMessage[]): string {
  const choices = chatFallback[lang][mode];
  const userTurns = messages.filter((message) => message.role === "user").length;
  return choices[Math.max(0, userTurns - 1) % choices.length];
}

function eventReviewFallback(lang: Lang, event: LifeEventDraft): string {
  const feeling = event.feeling.trim();
  const zh = `这件事发生在 ${event.date}。${event.event}。${feeling ? `你记得当时感到${feeling}。` : "关于当时的感受，你还没有留下文字——那时的你，是怎么理解这件事的？"}它可能是一个值得放进人生编年表的节点。`;
  const en = feeling
    ? `This happened in ${event.date}: ${event.event}. You remember feeling ${feeling}. It may be a meaningful point in your life chronicle.`
    : `This happened in ${event.date}: ${event.event}. You haven't written how it felt—how did you understand this moment then? It may be a meaningful point in your life chronicle.`;
  return lang === "zh" ? zh : en;
}

async function callModel(body: {
  instructions: string;
  lastMessages: Array<{ role: string; content: string }>;
}): Promise<string> {
  const runtimeEnv = getRuntimeEnv();
  const apiKey = runtimeEnv.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("missing_api_key");
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: runtimeEnv.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
      messages: [{ role: "system", content: body.instructions }, ...body.lastMessages],
      stream: false,
      thinking: { type: "disabled" },
      temperature: 0.7,
      max_tokens: 512,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("model_request_failed");
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("empty_model_response");
  return text;
}

function parseSummary(text: string): ConversationSummary {
  const parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as Partial<ConversationSummary>;
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    facts: Array.isArray(parsed.facts) ? parsed.facts.filter((item): item is string => typeof item === "string") : [],
    explicitStatements: Array.isArray(parsed.explicitStatements) ? parsed.explicitStatements.filter((item): item is string => typeof item === "string") : [],
    hypotheses: Array.isArray(parsed.hypotheses) ? parsed.hypotheses.filter((item) => item && typeof item.content === "string").map((item) => ({
      kind: ["life", "values", "world", "pattern"].includes(item.kind) ? item.kind : "pattern",
      title: typeof item.title === "string" ? item.title : "待确认的理解",
      content: item.content,
      evidence: typeof item.evidence === "string" ? item.evidence : "来自本次对话",
    })) : [],
  };
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const lang: Lang = body.lang === "en" ? "en" : "zh";

  /* ---- 随手记 / 深度访谈回复 ---- */
  if (body.task === "chat") {
    const mode: ChatMode = body.mode === "deep_interview" ? "deep_interview" : "quick_note";
    const lastMessages = (body.messages ?? []).slice(-8).map((m) => ({ role: m.role, content: m.content }));
    const continuityRule = lang === "zh"
      ? "必须结合完整上下文回应最后一条用户消息。不要逐字重复此前已经说过的回应或问题；即使用户发送相同内容，也要换一个有实质差异的理解角度。除非确有必要，不要每轮都用问题结尾。"
      : "Use the conversation context and answer the latest user message. Never repeat a previous response or question verbatim; if the user repeats the same content, offer a meaningfully different angle. Do not end every turn with a question unless one is genuinely useful.";
    const deepInterviewPrompt = `你正在主持一场自适应深度访谈。首次进入一个新主题时，从以下种子问题中选择一个最合适且尚未问过的问题：
1. 如果把人生分成几个章节，你会怎么分？ 2. 哪三件事最改变你？ 3. 成长环境里，什么样的人最容易得到认可？ 4. 你现在最不能牺牲的东西是什么？ 5. 最近什么时候你感觉最有生命力？ 6. 你最害怕哪一种人生？ 7. 有什么事情在你身上反复发生？ 8. 如果给现在的人生起一个章节名，会叫什么？
对重要回答，按“宽问题→具体事件→当时感受→当时选择/真正想要→担心失去什么→背后意义→是否重复”的路径，自适应选择当前最缺的一层。每次只问一个问题。优先追问：发生了什么、当时什么感受、真正希望得到什么、害怕失去什么、意味着什么、以前是否发生过。不要机械地把六问依次问完，不要重复已经得到答案的层。不要提前总结人格、价值观或动机；可以复述用户原话，但推断必须保留为待确认假设。例如用户说“我从小成绩很好”，下一步应问“成绩好对当时的你意味着什么？”，而不是直接判断他重视成就，也不要退回去问同一宽问题的其他例子。`;
    const deepInterviewPromptEn = `Run an adaptive interview tree. Start a new theme with one unused seed: life chapters; three most transformative events; who earned recognition growing up; what cannot be sacrificed now; a recent moment of aliveness; the life they most fear; what keeps recurring; or a title for the current chapter. Follow the answer from broad topic to concrete event, feeling, choice or desire, feared loss, meaning, and whether it repeats. Ask exactly one question, choosing the most useful missing layer rather than mechanically following the list. Never infer personality or values prematurely. If someone says “I always got good grades,” ask what good grades meant to them then instead of deciding they value achievement.`;
    const instructions =
      lang === "zh"
        ? `你是 InnerOS，一位温暖而清醒的人生编辑。${mode === "deep_interview" ? deepInterviewPrompt : "当前是随手记：先准确回应用户刚刚记录的体验，再决定是帮助整理、提供新角度，还是至多追问一个具体问题。"}不要诊断、说教、奉承或替用户下结论。${continuityRule}回复不超过120字。`
        : `You are InnerOS, a warm and clear-eyed life editor. ${mode === "deep_interview" ? deepInterviewPromptEn : "This is a quick note: reflect the latest experience, then either organize it, offer a fresh angle, or ask at most one concrete question."} Never diagnose, preach, flatter, or decide for the user. ${continuityRule} Stay under 90 words.`;
    try {
      const message = await callModel({ instructions, lastMessages });
      return Response.json({ message, fallback: false });
    } catch (error) {
      console.error("[InnerOS AI] chat request failed", error instanceof Error ? error.message : "unknown_error");
      return Response.json({ message: fallbackFor(lang, mode, body.messages ?? []), fallback: true });
    }
  }

  /* ---- 对话结束：只整理材料，不越过用户的解释权 ---- */
  if (body.task === "conversation_summary") {
    const mode: ChatMode = body.mode === "deep_interview" ? "deep_interview" : "quick_note";
    const messages = (body.messages ?? []).map((m) => ({ role: m.role, content: m.content })).slice(-30);
    const instructions = lang === "zh"
      ? `你是 InnerOS 的人生资料编辑。请整理本次${mode === "deep_interview" ? "深度访谈" : "随手记"}，严格区分：1）可验证事实；2）用户明确表达；3）AI 假设、等待用户确认。facts 只能写时间、地点、行为、经历等事件信息；用户对动机、感受、价值和意义的自述只能放入 explicitStatements，不能伪装成客观事实。summary 只概括用户实际谈到的内容，不得增加“当前开始反思”等未说出的变化。不要把推测写成事实，也不要诊断人格。只输出合法 JSON：{"summary":"不超过120字的中性摘要","facts":["..."],"explicitStatements":["尽量保留用户原意"],"hypotheses":[{"kind":"life|values|world|pattern","title":"人生观|价值观|世界观|反复模式","content":"克制的待确认假设","evidence":"支持该假设的用户原话或事件"}]}。没有证据的字段用空数组；假设最多3条。`
      : `You are InnerOS's life-record editor. Organize this ${mode === "deep_interview" ? "deep interview" : "quick note"} into: verifiable facts, statements explicitly made by the user, and AI hypotheses awaiting confirmation. Never present inference as fact or diagnose personality. Output valid JSON only: {"summary":"neutral summary under 90 words","facts":[],"explicitStatements":[],"hypotheses":[{"kind":"life|values|world|pattern","title":"...","content":"a restrained hypothesis","evidence":"user words or event supporting it"}]}. Use empty arrays when evidence is absent; at most 3 hypotheses.`;
    try {
      const text = await callModel({ instructions, lastMessages: messages });
      return Response.json({ summary: parseSummary(text), fallback: false });
    } catch (error) {
      console.error("[InnerOS AI] conversation summary failed", error instanceof Error ? error.message : "unknown_error");
      const userText = messages.filter((m) => m.role === "user").map((m) => m.content).join(lang === "zh" ? "；" : "; ");
      return Response.json({ summary: {
        summary: lang === "zh" ? "本次对话已结束。以下只保留你的明确表达，暂不生成未经验证的解释。" : "This conversation is complete. Only your explicit words are retained; no unverified interpretation was generated.",
        facts: [], explicitStatements: userText ? [userText] : [], hypotheses: [],
      }, fallback: true });
    }
  }

  /* ---- 人生大事件复述与确认 ---- */
  if (body.task === "event_review") {
    const event = body.event ?? { date: "", event: "", feeling: "", source: "" };
    const instructions =
      lang === "zh"
        ? `用户补充了一段人生记忆。请用一段不超过80字的中文，像一位温暖的人生编辑那样复述它（时间、事件、当时的感受），不要评价、诊断或给出建议。如果时间或当时的感受缺失，在结尾自然地补问一个问题。只输出复述内容。`
        : `The user added a life memory. Retell it in under 60 English words like a warm life editor (when, what happened, how it felt). Do not judge, diagnose, or advise. If the time or feeling is missing, end with one natural clarifying question. Output only the retelling.`;
    try {
      const summary = await callModel({
        instructions,
        lastMessages: [
          { role: "user", content: `${event.date}\n${event.event}\n${event.feeling}` },
        ],
      });
      return Response.json({ summary, fallback: false });
    } catch (error) {
      console.error("[InnerOS AI] event review failed", error instanceof Error ? error.message : "unknown_error");
      return Response.json({ summary: eventReviewFallback(lang, event), fallback: true });
    }
  }

  return Response.json({ error: "unknown_task" }, { status: 400 });
}
