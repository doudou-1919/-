import type { ChatMessage, ChatMode, LifeEventDraft } from "../../types";

type Lang = "zh" | "en";

type RequestBody =
  | { task: "chat"; mode?: ChatMode; lang?: Lang; messages?: ChatMessage[] }
  | { task: "event_review"; lang?: Lang; event?: LifeEventDraft };

const chatFallback: Record<Lang, Record<ChatMode, string>> = {
  zh: {
    quick_note: "我听见的不是一个需要立刻解决的问题，而是一个值得被留下来的信号。最近一次你明显感到这种状态，是在什么时候？",
    deep_interview: "如果暂时不考虑别人觉得什么是正确的，你最不愿意在下一阶段牺牲什么？能不能用一个真实经历告诉我？",
  },
  en: {
    quick_note: "This doesn't sound like a problem to solve immediately, but a signal worth keeping. When did you feel it most clearly recently?",
    deep_interview: "If you set aside what others consider correct, what are you least willing to sacrifice in your next chapter? Can you answer with a real moment?",
  },
};

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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("missing_api_key");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.2",
      instructions: body.instructions,
      input: body.lastMessages,
      store: false,
      max_output_tokens: 260,
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("model_request_failed");
  const data = (await response.json()) as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  const text = data.output_text ?? data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error("empty_model_response");
  return text;
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
    const instructions =
      lang === "zh"
        ? `你是 InnerOS，一位温暖而清醒的人生编辑。当前模式是${mode === "deep_interview" ? "深度访谈：通过自然追问理解用户的价值观、世界观、人生观和反复模式，每次只问一个有分辨力的问题" : "随手记：先准确回应用户刚刚记录的体验，再用至多一个问题帮助其说得更具体"}。不要诊断、说教、奉承或替用户下结论。回复不超过120字。`
        : `You are InnerOS, a warm and clear-eyed life editor. This is ${mode === "deep_interview" ? "a deep interview: naturally explore values, worldview, life philosophy, and recurring patterns; ask one discriminating question at a time" : "a quick note: reflect the user's experience accurately, then ask at most one question that makes it more concrete"}. Never diagnose, preach, flatter, or decide for the user. Stay under 90 words.`;
    try {
      const message = await callModel({ instructions, lastMessages });
      return Response.json({ message, fallback: false });
    } catch {
      return Response.json({ message: chatFallback[lang][mode], fallback: true });
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
    } catch {
      return Response.json({ summary: eventReviewFallback(lang, event), fallback: true });
    }
  }

  return Response.json({ error: "unknown_task" }, { status: 400 });
}
