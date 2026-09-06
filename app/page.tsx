"use client";

import { FormEvent, useRef, useState } from "react";
import type {
  Attachment,
  BeliefInsight,
  ChatMessage,
  ChatMode,
  ConfirmedLifeEvent,
  Conversation,
  LifeEventDraft,
} from "./types";

type Lang = "zh" | "en";
type Screen = "home" | "chat" | "book";
type Chapter = "past" | "self" | "now" | "future" | "plan";
type InsightKind = BeliefInsight["kind"];

/* ------------------------------------------------------------------ */
/* 林晓的示例数据（会话内状态；刷新不保留用户新增内容）                  */
/* ------------------------------------------------------------------ */

const baseTimeline: Record<Lang, string[][]> = {
  zh: [
    ["1997—2007", "成长环境", "安静地观察世界", "在一个重视稳定的家庭长大。你很早学会察言观色，也习惯先成为“让人放心的孩子”。", "用户回忆", "家庭 · 性格"],
    ["2012", "第一次确认", "创造带来的自我肯定", "你为学校活动设计了一本小册子。第一次发现，作品被人看见时，你感到的不是被表扬，而是“我表达出来了”。", "用户回忆", "创造 · 表达"],
    ["2015", "离开熟悉环境", "一个人去往新的城市", "进入大学后，你努力融入，也第一次拥有重新定义自己的空间。独立与归属感从此成为一组反复出现的主题。", "用户回忆", "迁居 · 独立"],
    ["2018", "职业起点", "进入产品设计行业", "解决真实问题让你着迷。你开始相信，好的设计既能理解别人，也能留下自己的判断。", "日记与作品记录", "事业 · 价值"],
    ["2021", "加速阶段", "用工作成绩证明自己", "更多责任和认可带来安全感。与此同时，你把休息、关系和个人创造一次次排到“忙完以后”。", "聊天与日历", "成就 · 代价"],
    ["2026.02", "关键转折", "第一次真正停下来", "错过晋升让你失落，却也打开了新问题：如果职位不再定义我，我真正想创造什么？", "日记 · 4条证据", "转折 · 重新定义"],
    ["2026.06—至今", "正在发生", "寻找自己的语言", "你开始写作、做独立项目，也重新连接让你感到真实的人。方向还不完整，但判断标准已经改变。", "多源记录", "创造 · 关系"],
  ],
  en: [
    ["1997—2007", "EARLY YEARS", "Learning to observe", "Raised in a family that valued stability, you learned early to read the room and be the child others could rely on.", "Personal memory", "Family · Character"],
    ["2012", "FIRST SIGNAL", "Confidence through making", "Designing a booklet for school revealed something new: being seen mattered less than finally expressing something of your own.", "Personal memory", "Creativity · Voice"],
    ["2015", "LEAVING HOME", "A new city, a new self", "University gave you room to redefine yourself. Independence and belonging became recurring themes.", "Personal memory", "Moving · Independence"],
    ["2018", "CAREER BEGINNING", "Entering product design", "Solving real problems drew you in. Good design felt like a way to understand others while keeping your own judgment.", "Journal & portfolio", "Career · Meaning"],
    ["2021", "ACCELERATION", "Proving yourself through work", "Responsibility and recognition created safety. Rest, relationships, and personal work kept moving to “after things calm down.”", "Chats & calendar", "Achievement · Cost"],
    ["Feb 2026", "TURNING POINT", "The first real pause", "Missing a promotion hurt, but opened a question: if title no longer defines me, what do I want to create?", "Journal · 4 sources", "Transition · Redefinition"],
    ["Jun 2026—Now", "IN PROGRESS", "Finding your own language", "You began writing, building independent projects, and reconnecting with people who make you feel real.", "Multiple sources", "Creativity · Connection"],
  ],
};

const initialBeliefs: Record<Lang, BeliefInsight[]> = {
  zh: [
    { id: "life", kind: "life", title: "人生观", content: "人生不是找到唯一正确答案，而是在行动中不断校准方向。", source: "长期记录归纳", evidenceCount: 8 },
    { id: "values", kind: "values", title: "价值观", content: "创造 · 自主 · 真诚连接", source: "长期记录归纳", evidenceCount: 11 },
    { id: "world", kind: "world", title: "世界观", content: "现实存在限制，但人可以通过小规模实验逐渐扩大选择空间。", source: "深度访谈待确认", evidenceCount: 4 },
  ],
  en: [
    { id: "life", kind: "life", title: "LIFE VIEW", content: "Life is not about finding one correct answer, but continually calibrating direction through action.", source: "From long-term records", evidenceCount: 8 },
    { id: "values", kind: "values", title: "VALUES", content: "Creativity · Autonomy · Honest connection", source: "From long-term records", evidenceCount: 11 },
    { id: "world", kind: "world", title: "WORLD VIEW", content: "Reality has constraints, but small experiments can gradually expand what is possible.", source: "Pending interview confirmation", evidenceCount: 4 },
  ],
};

/* 深度访谈的阶段候选：一个阶段完成后，会生成一条待确认洞察。 */
const insightStages: Record<Lang, Array<{ kind: InsightKind; label: string; headline: string; content: string }>> = {
  zh: [
    { kind: "values", label: "价值观", headline: "真实感比看起来正确更重要", content: "你愿意承受短期不确定，换取长期更忠于自己的选择。" },
    { kind: "world", label: "世界观", headline: "选择空间可以靠小实验慢慢扩大", content: "现实有它的限制，但你正学着用一次次小实验，试探自己真正能改变的部分。" },
    { kind: "life", label: "人生观", headline: "在行动中校准，而不是等待正确答案", content: "你越来越愿意把“不知道”当作继续前行的起点，而不是停下来的理由。" },
  ],
  en: [
    { kind: "values", label: "VALUES", headline: "Feeling real matters more than looking correct", content: "You seem willing to accept short-term uncertainty for choices that feel more genuinely yours." },
    { kind: "world", label: "WORLD VIEW", headline: "Choice expands through small experiments", content: "Constraints are real, yet you are learning to test, in small steps, what you can actually change." },
    { kind: "life", label: "LIFE VIEW", headline: "Calibrate by acting, not by waiting", content: "You are increasingly treating “not knowing” as a starting point rather than a reason to stop." },
  ],
};

const seedHistories: Record<Lang, Conversation[]> = {
  zh: [
    {
      id: "q1", mode: "quick_note", title: "最近总想逃离现在的工作", time: "今天", status: "active",
      messages: [
        { id: "a", role: "assistant", content: "最近，什么事情最常回到你的脑海里？" },
        { id: "b", role: "user", content: "我最近总想逃离现在的工作，但又说不清是累，还是不再认同它。" },
        { id: "c", role: "assistant", content: "听起来你不是简单地想离开，而是在分辨：是需要休息，还是旧的成功标准已经不再适合你。最近哪一个具体时刻，让这种感觉最强烈？" },
      ],
    },
    {
      id: "q2", mode: "quick_note", title: "周末做个人项目时很投入", time: "8月28日", status: "complete",
      messages: [
        { id: "a", role: "assistant", content: "今天想记下什么？" },
        { id: "b", role: "user", content: "周六做自己的小项目，一抬头已经过去三个小时。很久没有这么投入了。" },
        { id: "c", role: "assistant", content: "我记下了这个高能量时刻。它和你近几个月反复提到的“创造”和“自主”很一致。" },
      ],
    },
    {
      id: "i1", mode: "deep_interview", title: "我真正看重的是什么", time: "9月1日", status: "complete",
      messages: [
        { id: "a", role: "assistant", content: "如果暂时不考虑别人期待，你最不愿意牺牲的三件事是什么？" },
        { id: "b", role: "user", content: "创造的空间、自主安排时间，还有能说真话的关系。" },
        { id: "c", role: "assistant", content: "这三件事背后似乎都有同一个标准：你希望生活由真实感而不是外部评价来组织。什么时候你最早意识到这一点？" },
      ],
    },
    {
      id: "i2", mode: "deep_interview", title: "我如何理解成功", time: "8月16日", status: "complete",
      messages: [
        { id: "a", role: "assistant", content: "过去你会怎样判断自己是否成功？" },
        { id: "b", role: "user", content: "职位、收入、别人觉得我厉害。现在这些还重要，但不够了。" },
        { id: "c", role: "assistant", content: "那个“不够了”很重要。现在还有什么必须存在，你才会觉得这份成功属于你？" },
      ],
    },
  ],
  en: [
    {
      id: "q1", mode: "quick_note", title: "Wanting to leave my current job", time: "Today", status: "active",
      messages: [
        { id: "a", role: "assistant", content: "What has been returning to your mind lately?" },
        { id: "b", role: "user", content: "I keep wanting to leave my job, but I can't tell whether I'm simply tired or no longer believe in it." },
        { id: "c", role: "assistant", content: "It sounds less like a simple wish to leave and more like a question: do you need rest, or has your old definition of success stopped fitting? Which recent moment made that feeling strongest?" },
      ],
    },
    {
      id: "q2", mode: "quick_note", title: "Losing track of time while making", time: "Aug 28", status: "complete",
      messages: [
        { id: "a", role: "assistant", content: "What would you like to remember today?" },
        { id: "b", role: "user", content: "I spent three hours on my own project Saturday without noticing time pass." },
        { id: "c", role: "assistant", content: "I've marked this as a high-energy moment. It echoes the creativity and autonomy you've mentioned recently." },
      ],
    },
    {
      id: "i1", mode: "deep_interview", title: "What I truly value", time: "Sep 1", status: "complete",
      messages: [
        { id: "a", role: "assistant", content: "If other people's expectations disappeared for a moment, what three things would you refuse to sacrifice?" },
        { id: "b", role: "user", content: "Room to create, control of my time, and relationships where I can tell the truth." },
        { id: "c", role: "assistant", content: "All three seem tied to one standard: a life organized around what feels real, not external approval. When did you first notice this?" },
      ],
    },
    {
      id: "i2", mode: "deep_interview", title: "How I define success", time: "Aug 16", status: "complete",
      messages: [
        { id: "a", role: "assistant", content: "How did you used to decide whether you were successful?" },
        { id: "b", role: "user", content: "Title, income, whether people thought I was impressive. Those still matter, but they're no longer enough." },
        { id: "c", role: "assistant", content: "That “not enough” matters. What else must be present for success to feel like yours?" },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 组件                                                                */
/* ------------------------------------------------------------------ */

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-mark ${compact ? "compact" : ""}`} aria-hidden="true">
      <i></i><i></i><i></i><b></b>
    </span>
  );
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("zh");
  const [screen, setScreen] = useState<Screen>("home");
  const [chapter, setChapter] = useState<Chapter>("past");

  const [mode, setMode] = useState<ChatMode>("quick_note");
  const [activeId, setActiveId] = useState<string>(seedHistories.zh[0].id);
  /* 会话内状态：切换 Tab / 语言不丢当前会话内容（刷新不要求保留） */
  const [sessions, setSessions] = useState<Record<Lang, Record<string, Conversation>>>(() => ({
    zh: Object.fromEntries(seedHistories.zh.map((c) => [c.id, c])),
    en: Object.fromEntries(seedHistories.en.map((c) => [c.id, c])),
  }));
  const [historyOpen, setHistoryOpen] = useState(false);

  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);

  /* 内在坐标按语言分别保存：会话内确认过的洞察，切换语言再切回不会丢失 */
  const [beliefsState, setBeliefsState] = useState<Record<Lang, BeliefInsight[]>>(() => ({
    zh: initialBeliefs.zh,
    en: initialBeliefs.en,
  }));
  const beliefs = beliefsState[lang];
  const applyBeliefs = (next: BeliefInsight[]) => setBeliefsState((s) => ({ ...s, [lang]: next }));
  const [candidate, setCandidate] = useState<BeliefInsight | null>(null);
  const [stageStep, setStageStep] = useState(0);
  const sendsInSession = useRef(0);

  const [addedEvents, setAddedEvents] = useState<ConfirmedLifeEvent[]>([]);
  const [eventOpen, setEventOpen] = useState(false);
  const [eventDraft, setEventDraft] = useState<LifeEventDraft | null>(null);
  const [eventSummary, setEventSummary] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const isZh = lang === "zh";
  const conversation = sessions[lang][activeId] ?? seedHistories[lang][0];

  const persistConversation = (next: Conversation) => {
    setSessions((s) => ({ ...s, [lang]: { ...s[lang], [next.id]: next } }));
  };

  const changeLang = () => {
    const next: Lang = isZh ? "en" : "zh";
    setLang(next);
    const sameId = sessions[next][activeId] ? activeId : seedHistories[next].find((c) => c.mode === mode)!.id;
    setActiveId(sameId);
    resetInterview();
  };

  const resetInterview = () => {
    setCandidate(null);
    setStageStep(0);
    sendsInSession.current = 0;
  };

  const openChat = (initialMode: ChatMode = "quick_note") => {
    setMode(initialMode);
    const first = sessions[lang][seedHistories[lang].find((c) => c.mode === initialMode)!.id];
    setActiveId(first.id);
    resetInterview();
    setScreen("chat");
  };

  const openBook = (c: Chapter = "past") => {
    setChapter(c);
    setScreen("book");
  };

  const switchMode = (next: ChatMode) => {
    if (next === mode) return;
    setMode(next);
    const first = sessions[lang][seedHistories[lang].find((c) => c.mode === next)!.id];
    setActiveId(first.id);
    resetInterview();
  };

  const selectHistory = (c: Conversation) => {
    setMode(c.mode);
    setActiveId(c.id);
    setHistoryOpen(false);
    resetInterview();
  };

  const addAttachment = (kind: Attachment["kind"]) => {
    const names = isZh
      ? { link: "一个网页链接", photo: "2 张照片", ai_history: "ChatGPT 对话记录", file: "我的日记.txt" }
      : { link: "A web link", photo: "2 photos", ai_history: "ChatGPT history", file: "my-journal.txt" };
    setAttachments((a) => [...a.filter((x) => x.kind !== kind), { id: kind, kind, name: names[kind] }]);
  };

  const removeAttachment = (id: string) => setAttachments((items) => items.filter((item) => item.id !== id));

  async function sendMessage() {
    if (!draft.trim() && !attachments.length) return;
    const fallbackReply = isZh
      ? "我听见了。与其马上给它一个结论，我更想知道：最近一次你明显感到这种状态，是在什么时候？"
      : "I hear you. Before naming it, when was the most recent moment you felt this clearly?";
    const user: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: draft.trim() || (isZh ? "我添加了一些生活资料。" : "I've added some life material."),
      attachments,
    };
    const nextMessages = [...conversation.messages, user];
    persistConversation({ ...conversation, messages: nextMessages, status: "active" });
    setDraft("");
    setAttachments([]);
    setSending(true);
    sendsInSession.current += 1;

    let content = "";
    try {
      const res = await fetch("/api/inneros", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: "chat", mode, lang, messages: nextMessages }),
      });
      if (!res.ok) throw new Error("request_failed");
      content = (await res.json()).message;
    } catch {
      content = fallbackReply;
    }
    const assistant: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content };
    persistConversation({ ...conversation, messages: [...nextMessages, assistant], status: "active" });
    setSending(false);

    /* 深度访谈：大约每 3 轮自然追问，生成一条“待确认洞察”，阶段依次推进 */
    if (mode === "deep_interview") {
      const stages = insightStages[lang];
      const isStageBoundary = sendsInSession.current === 1 || (sendsInSession.current - 1) % 3 === 0;
      if (isStageBoundary && stageStep < stages.length && !candidate) {
        const stage = stages[stageStep];
        setCandidate({
          id: `candidate-${Date.now()}`,
          kind: stage.kind,
          title: stage.label,
          content: `${stage.headline}：${stage.content}`,
          source: isZh ? "本次深度访谈 · 待你确认" : "This interview · Awaiting your confirmation",
          evidenceCount: 3,
        });
      }
    }
  }

  const confirmCandidate = (amendNote = "") => {
    if (!candidate) return;
    const noteSuffix = amendNote.trim()
      ? (isZh ? `（补充：${amendNote.trim()}）` : ` (my addition: ${amendNote.trim()})`)
      : "";
    const confirmed: BeliefInsight = {
      ...candidate,
      id: crypto.randomUUID(),
      content: candidate.content + noteSuffix,
      source: isZh ? "深度访谈 · 已确认" : "Deep interview · Confirmed",
      feedback: "confirmed",
    };
    setBeliefsState((s) => ({ ...s, [lang]: [...s[lang], confirmed] }));
    setCandidate(null);
    setStageStep((s) => s + 1);
  };

  const rejectCandidate = () => {
    setCandidate(null);
    setStageStep((s) => s + 1);
  };

  /* ------- 人生大事件补充：填写 → AI 复述确认 → 加入编年表 ------- */
  const openEventModal = () => {
    setEventDraft(null);
    setEventSummary("");
    setEventOpen(true);
  };

  async function requestReview(d: LifeEventDraft) {
    setReviewing(true);
    let summary = "";
    try {
      const res = await fetch("/api/inneros", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: "event_review", lang, event: d }),
      });
      if (!res.ok) throw new Error("request_failed");
      summary = (await res.json()).summary;
    } catch {
      summary = isZh
        ? `这件事发生在 ${d.date}。${d.event}。你记得当时感到${d.feeling || "（尚未留下感受）"}。它可能是一个值得放进人生编年表的节点。`
        : `This happened in ${d.date}: ${d.event}. You remember feeling ${d.feeling || "(no feeling recorded yet)"}. It may be a meaningful point in your life chronicle.`;
    }
    setEventSummary(summary);
    setEventDraft(d);
    setReviewing(false);
  }

  const confirmEvent = (extraFeeling: string) => {
    if (!eventDraft) return;
    const feeling = eventDraft.feeling.trim() || extraFeeling.trim() || (isZh ? "（当时的感受，之后再补）" : "(feeling to be added later)");
    const added: ConfirmedLifeEvent = {
      ...eventDraft,
      id: crypto.randomUUID(),
      feeling,
      aiSummary: eventSummary,
      confirmed: true,
      userAdded: true,
    };
    setAddedEvents((e) => [...e, added]);
    setEventOpen(false);
    setEventDraft(null);
    setEventSummary("");
  };

  return (
    <>
      {screen === "home" && (
        <HomeLanding lang={lang} toggle={changeLang} chat={() => openChat("quick_note")} book={() => openBook("past")} />
      )}
      {screen === "chat" && (
        <Chat
          lang={lang}
          toggle={changeLang}
          back={() => setScreen("home")}
          mode={mode}
          switchMode={switchMode}
          historyOpen={historyOpen}
          setHistoryOpen={setHistoryOpen}
          conversation={conversation}
          selectHistory={selectHistory}
          conversations={Object.values(sessions[lang])}
          draft={draft}
          setDraft={setDraft}
          attachments={attachments}
          addAttachment={addAttachment}
          removeAttachment={removeAttachment}
          send={sendMessage}
          sending={sending}
          candidate={candidate}
          confirmCandidate={confirmCandidate}
          rejectCandidate={rejectCandidate}
        />
      )}
      {screen === "book" && (
        <Book
          lang={lang}
          toggle={changeLang}
          home={() => setScreen("home")}
          chat={() => openChat("quick_note")}
          chapter={chapter}
          setChapter={setChapter}
          beliefs={beliefs}
          setBeliefs={applyBeliefs}
          addedEvents={addedEvents}
          addEvent={openEventModal}
        />
      )}
      {eventOpen && (
        <EventModal
          lang={lang}
          draft={eventDraft}
          summary={eventSummary}
          reviewing={reviewing}
          requestReview={requestReview}
          confirm={confirmEvent}
          edit={() => {
            setEventDraft(null);
            setEventSummary("");
          }}
          close={() => {
            setEventOpen(false);
            setEventDraft(null);
            setEventSummary("");
          }}
        />
      )}
    </>
  );
}

/* ============================== 首页 ============================== */

function HomeLanding({ lang, toggle, chat, book }: { lang: Lang; toggle: () => void; chat: () => void; book: () => void }) {
  const z = lang === "zh";
  return (
    <main className="home">
      <Header lang={lang} toggle={toggle} />
      <section className="home-hero">
        <div className="hero-text">
          <p className="eyebrow">{z ? "你的长期自我观察记录" : "YOUR LONG-TERM SELF OBSERVATION"}</p>
          <h1>
            {z ? (
              <>看见那些反复发生的事，<br />也看见那个<span>正在变化</span>的自己。</>
            ) : (
              <>See what keeps repeating.<br />And the self that is <span>still changing.</span></>
            )}
          </h1>
          <p>
            {z
              ? "过去的经历不是一堆散落的记录。InnerOS 帮你看见其中的主线、反复模式，以及正在悄悄发生的改变。"
              : "Your past is more than scattered records. InnerOS helps reveal the thread, recurring patterns, and the change already underway."}
          </p>
          <div className="home-actions">
            <button className="primary" onClick={chat}>
              {z ? "我想找你聊聊" : "I want to talk"} <b>→</b>
            </button>
            <button className="secondary" onClick={book}>
              {z ? "查看我的人生之书" : "View my life book"}
            </button>
          </div>
        </div>
        <div className="path-identity">
          <div className="path-copy">
            <small>LIN XIAO · 1997—2026</small>
            <b>{z ? "林晓的转折之年" : "LIN'S YEAR OF TRANSITION"}</b>
          </div>
          <div className="converging-lines">{[1, 2, 3, 4, 5, 6, 7].map((n) => <i key={n}></i>)}</div>
          <div className="path-person"><span></span><b></b><em></em></div>
          <div className="path-caption">
            {z ? "18 段记录 · 7 个人生节点 · 3 个反复模式" : "18 records · 7 life moments · 3 patterns"}
          </div>
        </div>
      </section>
      <footer className="quiet-footer">
        {z
          ? "InnerOS 帮助你整理经历并形成自己的答案，不提供心理诊断，也不替你做决定。"
          : "InnerOS helps you organize experience and form your own answers. It does not diagnose or decide for you."}
      </footer>
    </main>
  );
}

/* ============================== 顶栏 ============================== */

function Header({ lang, toggle, back, chat }: { lang: Lang; toggle: () => void; back?: () => void; chat?: () => void }) {
  return (
    <header className="site-header">
      <div className="header-left">
        {back && (
          <button className="back-button" onClick={back}>
            ← <span>{lang === "zh" ? "返回" : "Back"}</span>
          </button>
        )}
        <button className="wordmark" onClick={back}>
          <BrandMark compact />
          Inner<span>OS</span>
        </button>
      </div>
      <div className="header-right">
        {chat && <button className="header-chat" onClick={chat}>{lang === "zh" ? "找我聊聊" : "Talk to me"}</button>}
        <button className="lang" onClick={toggle}>中 / EN</button>
        <span className="user-avatar">林</span>
      </div>
    </header>
  );
}

/* ============================ 我想找你聊聊 ============================ */

function Chat({
  lang, toggle, back, mode, switchMode, historyOpen, setHistoryOpen, conversation, selectHistory, conversations,
  draft, setDraft, attachments, addAttachment, removeAttachment, send, sending,
  candidate, confirmCandidate, rejectCandidate,
}: {
  lang: Lang; toggle: () => void; back: () => void;
  mode: ChatMode; switchMode: (m: ChatMode) => void;
  historyOpen: boolean; setHistoryOpen: (v: boolean) => void;
  conversation: Conversation; selectHistory: (c: Conversation) => void;
  conversations: Conversation[];
  draft: string; setDraft: (v: string) => void;
  attachments: Attachment[]; addAttachment: (k: Attachment["kind"]) => void; removeAttachment: (id: string) => void;
  send: () => void; sending: boolean;
  candidate: BeliefInsight | null; confirmCandidate: (amendNote?: string) => void; rejectCandidate: () => void;
}) {
  const z = lang === "zh";
  const [amending, setAmending] = useState(false);
  const [amendText, setAmendText] = useState("");

  const placeholders = {
    quick_note: z ? "记下现在想到的事…" : "Write what's on your mind…",
    deep_interview: z ? "慢慢说，没有标准答案…" : "Take your time. There is no right answer…",
  };

  const submitAmend = () => {
    if (!candidate || !amendText.trim()) return;
    confirmCandidate(amendText);
    setAmendText("");
    setAmending(false);
  };

  return (
    <main className="chat-screen">
      <Header lang={lang} toggle={toggle} back={back} />
      <button className="history-toggle" onClick={() => setHistoryOpen(!historyOpen)}>
        ☰ <span>{z ? "历史记录" : "History"}</span>
      </button>

      <aside className={`history-panel ${historyOpen ? "open" : ""}`}>
        <div className="history-head">
          <b>{z ? "对话历史" : "CONVERSATIONS"}</b>
          <button onClick={() => setHistoryOpen(false)} aria-label="close">×</button>
        </div>
        {(["quick_note", "deep_interview"] as ChatMode[]).map((group) => (
          <section key={group}>
            <small>{group === "quick_note" ? (z ? "随手记" : "QUICK NOTES") : (z ? "深度访谈" : "DEEP INTERVIEWS")}</small>
            {conversations.filter((c) => c.mode === group).map((c) => (
              <button className={conversation.id === c.id ? "active" : ""} key={c.id} onClick={() => selectHistory(c)}>
                <span>{c.title}</span>
                <time>{c.time}</time>
              </button>
            ))}
          </section>
        ))}
      </aside>
      {historyOpen && <button className="history-shade" onClick={() => setHistoryOpen(false)} aria-label="close"></button>}

      <section className="chat-workspace">
        <div className="chat-tabs">
          <button className={mode === "quick_note" ? "active" : ""} onClick={() => switchMode("quick_note")}>
            <b>{z ? "随手记" : "Quick note"}</b>
            <small>{z ? "什么都可以聊" : "Anything on your mind"}</small>
          </button>
          <button className={mode === "deep_interview" ? "active" : ""} onClick={() => switchMode("deep_interview")}>
            <b>{z ? "深度访谈" : "Deep interview"}</b>
            <small>{z ? "理解价值观与反复模式" : "Values, beliefs & patterns"}</small>
          </button>
        </div>

        <div className="conversation-title">
          <span>{mode === "quick_note" ? "○" : "◎"}</span>
          <div>
            <h1>{conversation.title}</h1>
            <small>
              {mode === "quick_note" ? (z ? "随手记 · 今天" : "Quick note · Today") : (z ? "深度访谈 · 自然追问" : "Deep interview · Adaptive questions")}
            </small>
          </div>
        </div>

        <div className="messages">
          {conversation.messages.map((m) => (
            <div className={`message ${m.role}`} key={m.id}>
              {m.role === "assistant" && <span>IO</span>}
              <div>
                <p>{m.content}</p>
                {m.attachments?.length ? (
                  <div className="message-files">
                    {m.attachments.map((a) => <small key={a.id}>＋ {a.name}</small>)}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {sending && (
            <div className="message assistant"><span>IO</span><div className="typing"><i></i><i></i><i></i></div></div>
          )}

          {candidate && (
            <article className="insight-candidate">
              <small>{z ? "从这次访谈中，我听见一个可能的判断" : "A possible reading surfaced in this interview"}</small>
              <h3>{candidate.content}</h3>
              <p>{z ? "这只是我的理解，确认后才会写进你的人生之书。它符合你吗？" : "This is only my reading—nothing is written until you confirm. Does it feel true?"}</p>
              {amending ? (
                <div className="amend-box">
                  <textarea
                    autoFocus
                    value={amendText}
                    onChange={(e) => setAmendText(e.target.value)}
                    placeholder={z ? "补充你的想法，或修正我说得不对的地方…" : "Add your own words, or correct my reading…"}
                  />
                  <div className="amend-actions">
                    <button onClick={() => { setAmending(false); setAmendText(""); }}>{z ? "取消" : "Cancel"}</button>
                    <button className="amend-save" onClick={submitAmend} disabled={!amendText.trim()}>
                      ✓ {z ? "保存并确认" : "Save & confirm"}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <button className="confirm" onClick={() => confirmCandidate()}>✓ {z ? "符合我" : "Feels true"}</button>
                  <button onClick={() => { setAmending(true); setAmendText(""); }}>＋ {z ? "补充我的理解" : "Add nuance"}</button>
                  <button onClick={rejectCandidate}>× {z ? "不太符合" : "Not quite"}</button>
                </div>
              )}
            </article>
          )}
        </div>

        <div className="chat-composer">
          {attachments.length > 0 && (
            <div className="attached">
              {attachments.map((a) => (
                <span key={a.id}>
                  {a.name}{" "}
                  <button aria-label={z ? `移除${a.name}` : `Remove ${a.name}`} onClick={() => removeAttachment(a.id)}>×</button>
                </span>
              ))}
            </div>
          )}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!sending) send();
              }
            }}
            placeholder={placeholders[mode]}
          />
          <div className="composer-tools">
            <button onClick={() => addAttachment("link")}>↗ <span>{z ? "链接" : "Link"}</span></button>
            <button onClick={() => addAttachment("photo")}>▧ <span>{z ? "照片" : "Photo"}</span></button>
            <button onClick={() => addAttachment("ai_history")}>✦ <span>{z ? "AI记录" : "AI history"}</span></button>
            <button onClick={() => addAttachment("file")}>＋ <span>{z ? "文件" : "File"}</span></button>
            <button className="send" onClick={send} disabled={sending}>↑</button>
          </div>
        </div>
        <p className="chat-privacy">
          {z
            ? "对话可能帮助更新你的人生之书，但所有新洞察都会先由你确认。"
            : "Conversations may inform your life book, but every new insight is yours to confirm."}
        </p>
      </section>
    </main>
  );
}

/* ============================= 人生之书 ============================= */

function Book({
  lang, toggle, home, chat, chapter, setChapter, beliefs, setBeliefs, addedEvents, addEvent,
}: {
  lang: Lang; toggle: () => void; home: () => void; chat: () => void;
  chapter: Chapter; setChapter: (c: Chapter) => void;
  beliefs: BeliefInsight[]; setBeliefs: (b: BeliefInsight[]) => void;
  addedEvents: ConfirmedLifeEvent[]; addEvent: () => void;
}) {
  const z = lang === "zh";
  const nav: Chapter[] = ["past", "self", "now", "future"];
  const labels = z
    ? ["我从哪里来", "我是谁", "我在哪里", "我要去哪里"]
    : ["Where I came from", "Who I am", "Where I am", "Where I'm going"];
  const activeIndex = chapter === "plan" ? 3 : nav.indexOf(chapter);

  return (
    <main className="book-screen">
      <Header lang={lang} toggle={toggle} back={home} chat={chat} />
      {/* 移动端章节切换（桌面端为左侧边栏） */}
      <nav className="chapter-pills" aria-label={z ? "章节" : "Chapters"}>
        {nav.map((n, i) => (
          <button className={chapter === n || (chapter === "plan" && n === "future") ? "active" : ""} onClick={() => setChapter(n)} key={n}>
            <span>0{i + 1}</span>{labels[i]}
          </button>
        ))}
        <button className="index-chip">{activeIndex + 1} / 04</button>
      </nav>

      <div className="book-grid">
        <aside className="book-sidebar">
          <p className="eyebrow">{z ? "我的人生之书" : "MY LIFE BOOK"}</p>
          <h2>{z ? "林晓的人生之书" : "Lin's Life Book"}</h2>
          <small>{z ? "第一版 · 2026年9月" : "First edition · September 2026"}</small>
          <nav>
            {nav.map((n, i) => (
              <button
                className={chapter === n || (chapter === "plan" && n === "future") ? "active" : ""}
                onClick={() => setChapter(n)}
                key={n}
              >
                <span>0{i + 1}</span>{labels[i]}
              </button>
            ))}
          </nav>
          <div className="owner-note">
            ◇
            <span>
              <b>{z ? "你的书，由你定义" : "Your book, your meaning"}</b>
              <br />
              {z ? "所有理解都可以被纠正。" : "Every reading can be corrected."}
            </span>
          </div>
        </aside>

        <section className="book-page">
          {chapter === "past" && <Past lang={lang} addedEvents={addedEvents} addEvent={addEvent} next={() => setChapter("self")} />}
          {chapter === "self" && <Self lang={lang} beliefs={beliefs} setBeliefs={setBeliefs} />}
          {chapter === "now" && <Now lang={lang} />}
          {chapter === "future" && <Future lang={lang} plan={() => setChapter("plan")} />}
          {chapter === "plan" && <ActionPlan lang={lang} back={() => setChapter("future")} />}
        </section>
      </div>
    </main>
  );
}

/* ----- 第一章：我从哪里来 · 我的人生编年表 ----- */

function Past({ lang, addedEvents, addEvent, next }: {
  lang: Lang; addedEvents: ConfirmedLifeEvent[]; addEvent: () => void; next: () => void;
}) {
  const z = lang === "zh";
  const stages = baseTimeline[lang];
  return (
    <>
      <div className="chapter-number">CHAPTER ONE <span>01 / 04</span></div>
      <div className="chapter-heading">
        <div>
          <h1>{z ? "我从哪里来" : "Where I came from"}</h1>
          <p className="chapter-subtitle">{z ? "我的人生编年表" : "A CHRONICLE OF MY LIFE"}</p>
        </div>
        <button className="add-event" onClick={addEvent}>＋ {z ? "补充人生大事件" : "Add a life event"}</button>
      </div>
      <p className="book-lede">
        {z
          ? "回看这些节点，你的人生并不是一连串偶然选择。对创造、自主和真实连接的需要，一直以不同方式出现。"
          : "These moments are not a string of accidents. The need for creativity, autonomy, and honest connection has kept returning in different forms."}
      </p>
      <div className="throughline">
        <small>{z ? "贯穿主题" : "THROUGH-LINE"}</small>
        <b>{z ? "从成为让人放心的人，到相信自己的声音" : "From being dependable to trusting your own voice"}</b>
        <span>{stages.length + addedEvents.length} {z ? "个人生节点" : "life moments"}</span>
      </div>
      <div className="long-timeline">
        {stages.map((s, i) => (
          <article key={s[0]} className={i === 5 ? "turning" : ""}>
            <time>{s[0]}</time>
            <i></i>
            <div>
              <small>{s[1]} · {s[4]}</small>
              <h3>{s[2]}</h3>
              <p>{s[3]}</p>
              <span>{s[5]}</span>
            </div>
          </article>
        ))}
        {addedEvents.map((e) => (
          <article className="user-event" key={e.id}>
            <time>{e.date}</time>
            <i></i>
            <div>
              <small>{z ? "由你补充 · 已确认" : "ADDED BY YOU · CONFIRMED"}</small>
              <h3>{e.event}</h3>
              <p>{e.aiSummary}</p>
              <span>{e.source || (z ? "个人记录" : "Personal note")}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="page-end">
        <em>{z ? "“你不是突然改变了，只是终于看见了那条一直存在的线。”" : "“You did not change suddenly. You finally saw the line that was always there.”"}</em>
        <button onClick={next}>{z ? "下一章：我是谁" : "Next: Who I am"} →</button>
      </div>
    </>
  );
}

/* ----- 第二章：我是谁 ----- */

function Self({ lang, beliefs, setBeliefs }: {
  lang: Lang; beliefs: BeliefInsight[]; setBeliefs: (b: BeliefInsight[]) => void;
}) {
  const z = lang === "zh";
  const patterns = z
    ? [
        ["重复模式", "不确定 → 寻找更多认可 → 短暂安心", "当方向不明确时，你常用更多工作和外部反馈恢复控制感。", "6 个事件"],
        ["优势与代价", "很擅长理解别人，却容易延后自己的需要", "共情让你成为可靠的伙伴，也让你在冲突中总是先解释对方。", "5 个事件"],
        ["正在改变", "成就不再是唯一的衡量标准", "最近三个月，你描述满足感时更多提到创造、连接与自主。", "7 个事件"],
      ]
    : [
        ["RECURRING PATTERN", "Uncertainty → more approval → brief relief", "When direction is unclear, you use more work and outside feedback to regain control.", "6 events"],
        ["STRENGTH & COST", "Understanding others, postponing your own needs", "Empathy makes you reliable, but also leads you to explain others first.", "5 events"],
        ["WHAT'S CHANGING", "Achievement is no longer the only measure", "Recently, fulfillment is more often linked to creativity, connection, and autonomy.", "7 events"],
      ];
  const feedback = (id: string, v: BeliefInsight["feedback"]) =>
    setBeliefs(beliefs.map((b) => (b.id === id ? { ...b, feedback: v } : b)));
  const visible = beliefs.filter((b) => b.feedback !== "rejected");

  return (
    <>
      <div className="chapter-number">CHAPTER TWO <span>02 / 04</span></div>
      <h1>{z ? "我是谁" : "Who I am"}</h1>
      <p className="book-lede">
        {z
          ? "这些不是定义你的标签，而是从长期记录里浮现、等待与你核对的内在坐标。"
          : "These are not labels. They are inner coordinates surfaced from your records and waiting to be checked with you."}
      </p>

      <section className="inner-compass">
        <div className="section-title">
          <span>01</span>
          <div>
            <h2>{z ? "我的内在坐标" : "My inner compass"}</h2>
            <p>{z ? "人生观 · 价值观 · 世界观" : "Life view · Values · World view"}</p>
          </div>
        </div>
        <div className="belief-grid">
          {visible.map((b, i) => (
            <article key={b.id}>
              <div className={`belief-orb orb-${i % 3}`}>0{i + 1}</div>
              <small>{b.title}</small>
              <h3>{b.content}</h3>
              <p>{b.source} · {b.evidenceCount}{z ? " 条证据" : " sources"}</p>
              <div>
                <button className={b.feedback === "confirmed" ? "selected" : ""} onClick={() => feedback(b.id, "confirmed")}>
                  ✓ {z ? "符合我" : "Feels true"}
                </button>
                <button onClick={() => feedback(b.id, "rejected")}>× {z ? "不符合" : "Not me"}</button>
                <button onClick={() => feedback(b.id, "needs_context")}>＋ {z ? "补充" : "Context"}</button>
              </div>
              {b.feedback === "needs_context" && <em className="belief-note">{z ? "已记录，待你补充更多上下文。" : "Noted—waiting for more context from you."}</em>}
              {b.feedback === "confirmed" && <em className="belief-note ok">{z ? "已核对 ✓" : "Checked ✓"}</em>}
            </article>
          ))}
        </div>
      </section>

      <section className="patterns">
        <div className="section-title">
          <span>02</span>
          <div>
            <h2>{z ? "我反复出现的模式" : "Patterns that keep returning"}</h2>
            <p>{z ? "先看见，再决定要不要改变" : "See them before deciding what to change"}</p>
          </div>
        </div>
        {patterns.map((p, i) => (
          <article key={p[1]}>
            <div className="pattern-index">0{i + 1}</div>
            <div>
              <small>{p[0]}</small>
              <h3>{p[1]}</h3>
              <p>{p[2]}</p>
            </div>
            <button>{p[3]} ↗</button>
          </article>
        ))}
      </section>
    </>
  );
}

/* ----- 第三章：我在哪里 ----- */

function Now({ lang }: { lang: Lang }) {
  const z = lang === "zh";
  const questions = z
    ? ["怎样的工作值得投入我的创造力？", "哪些关系让我更接近真实的自己？", "如果不急着证明，我想怎样度过一天？"]
    : ["What work deserves my creative energy?", "Which relationships bring me closer to myself?", "Without proving anything, how would I spend a day?"];
  return (
    <>
      <div className="chapter-number">CHAPTER THREE <span>03 / 04</span></div>
      <h1>{z ? "我在哪里" : "Where I am"}</h1>
      <p className="book-lede">
        {z
          ? "你正站在旧的成功标准与新的生活语言之间。现在最重要的，不是马上选对，而是建立新的判断标准。"
          : "You are between an old definition of success and a new language for living. The work is not choosing perfectly, but building a better compass."}
      </p>
      <div className="red-stage">
        <small>{z ? "当前阶段" : "CURRENT STAGE"}</small>
        <h2>{z ? "重新定义成功" : "Redefining success"}</h2>
      </div>
      <div className="now-columns">
        <article>
          <small>{z ? "三个核心课题" : "THREE LIVE QUESTIONS"}</small>
          {questions.map((x, i) => (
            <p key={x}><b>0{i + 1}</b>{x}</p>
          ))}
        </article>
        <article>
          <small>{z ? "尚未解决的张力" : "UNRESOLVED TENSION"}</small>
          <h3>
            {z
              ? "想要自由，却仍用旧有的成就标准判断自由是否“值得”。"
              : "Wanting freedom, while still judging whether it is worthwhile by old achievement standards."}
          </h3>
        </article>
      </div>
    </>
  );
}

/* ----- 第四章：我要去哪里 ----- */

function Future({ lang, plan }: { lang: Lang; plan: () => void }) {
  const z = lang === "zh";
  const actions = z
    ? [["继续", "每周公开一份小作品"], ["停止", "用忙碌证明自己的价值"], ["尝试", "和三位独立创作者交流"]]
    : [["CONTINUE", "Share one small piece each week"], ["STOP", "Using busyness to prove your worth"], ["TRY", "Talk with three independent creators"]];
  return (
    <>
      <div className="chapter-number">CHAPTER FOUR <span>04 / 04</span></div>
      <h1>{z ? "我要去哪里" : "Where I'm going"}</h1>
      <p className="book-lede">
        {z
          ? "下一章不是一个职业答案，而是一场三个月的实验：让创造从周末的例外，变成生活的固定部分。"
          : "The next chapter is not a career answer. It is a three-month experiment to make creation a regular part of life."}
      </p>
      <div className="future-orb">
        <small>{z ? "建议的下一章" : "SUGGESTED NEXT CHAPTER"}</small>
        <h2>{z ? "把自己的声音放回生活中心" : "Put your own voice back at the center"}</h2>
      </div>
      <div className="future-actions">
        {actions.map((x, i) => (
          <article key={x[0]}>
            <span>0{i + 1}</span>
            <small>{x[0]}</small>
            <p>{x[1]}</p>
          </article>
        ))}
      </div>
      <button className="primary plan-button" onClick={plan}>{z ? "把建议变成计划" : "Turn this into a plan"} →</button>
    </>
  );
}

function ActionPlan({ lang, back }: { lang: Lang; back: () => void }) {
  const z = lang === "zh";
  const habits = z
    ? [["每周两次", "45 分钟无评价创作"], ["每周一次", "公开一个过程或作品"], ["每月一次", "更新我的人生之书"]]
    : [["Twice a week", "45 minutes of judgment-free making"], ["Once a week", "Share a process or finished piece"], ["Once a month", "Update my life book"]];
  return (
    <>
      <button className="inline-back" onClick={back}>← {z ? "返回下一章" : "Back to next chapter"}</button>
      <h1>{z ? "把下一章变成一场实验" : "Turn the next chapter into an experiment"}</h1>
      <p className="book-lede">
        {z ? "不是一份新的自我要求，而是一套帮助你收集真实反馈的轻量计划。" : "Not another demand on yourself—a light structure for gathering honest feedback."}
      </p>
      <div className="plan-block">
        <small>{z ? "未来 12 周" : "THE NEXT 12 WEEKS"}</small>
        <h2>{z ? "完成并公开 6 个小作品，从真实反馈中判断下一步。" : "Complete and share 6 small pieces, then use real feedback to choose what comes next."}</h2>
      </div>
      <div className="habit-rows">
        {habits.map((h, i) => (
          <div key={h[1]}>
            <b>0{i + 1}</b>
            <span>{h[0]}</span>
            <p>{h[1]}</p>
            <i>○</i>
          </div>
        ))}
      </div>
    </>
  );
}

/* ------------------ 补充人生大事件（AI 确认弹窗） ------------------ */

function EventModal({
  lang, draft, summary, reviewing, requestReview, confirm, edit, close,
}: {
  lang: Lang;
  draft: LifeEventDraft | null;
  summary: string;
  reviewing: boolean;
  requestReview: (d: LifeEventDraft) => Promise<void>;
  confirm: (extraFeeling: string) => void;
  edit: () => void;
  close: () => void;
}) {
  const z = lang === "zh";
  const [feelingNote, setFeelingNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const d: LifeEventDraft = {
      date: String(f.get("date")),
      event: String(f.get("event")),
      feeling: String(f.get("feeling")),
      source: String(f.get("source")),
    };
    setSubmitting(true);
    try {
      await requestReview(d);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-wrap" role="dialog" aria-modal="true">
      <button className="modal-shade" onClick={close} aria-label="close"></button>
      <section className="event-modal">
        <button className="modal-x" onClick={close}>×</button>
        {!draft ? (
          <>
            <p className="eyebrow">ADD A LIFE MOMENT</p>
            <h2>{z ? "补充人生大事件" : "Add a life event"}</h2>
            <p>{z ? "不需要写得完整。先把事实和当时的感受留下来。" : "It doesn't need to be complete. Start with what happened and how it felt."}</p>
            <form onSubmit={submit}>
              <label>
                {z ? "时间" : "When"}
                <input name="date" required placeholder={z ? "例如：2019年夏天" : "e.g. Summer 2019"} />
              </label>
              <label>
                {z ? "发生了什么" : "What happened"}
                <textarea name="event" required placeholder={z ? "描述一个对你有影响的事件…" : "Describe a moment that affected you…"} />
              </label>
              <label>
                {z ? "当时的感受" : "How did it feel"}
                <textarea name="feeling" placeholder={z ? "你当时怎么理解这件事？" : "How did you understand it then?"} />
              </label>
              <label>
                {z ? "资料来源（可选）" : "Source (optional)"}
                <input name="source" placeholder={z ? "回忆、日记、照片…" : "Memory, journal, photo…"} />
              </label>
              <button className="primary" type="submit" disabled={submitting || reviewing}>
                {reviewing ? (z ? "AI 正在复述…" : "AI is reviewing…") : (z ? "让 AI 帮我整理" : "Let AI organize it")} →
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="eyebrow">AI REVIEW</p>
            <h2>{z ? "我这样理解，对吗？" : "Did I understand this?"}</h2>
            <div className="ai-review">
              <span>IO</span>
              <p>{summary || (z ? "正在整理你的描述…" : "Reviewing your description…")}</p>
            </div>
            {!draft.feeling.trim() && (
              <div className="missing-feeling">
                <p>{z ? "关于“当时的感受”，你还没有写下什么——那时的你，是怎么理解这件事的？" : "You haven't written how it felt—how did you understand this moment then?"}</p>
                <input
                  value={feelingNote}
                  onChange={(e) => setFeelingNote(e.target.value)}
                  placeholder={z ? "补充一句当时的感受（可选）" : "Add how you felt (optional)"}
                />
              </div>
            )}
            <div className="review-facts">
              <p><small>{z ? "时间" : "WHEN"}</small>{draft.date}</p>
              <p><small>{z ? "事件" : "EVENT"}</small>{draft.event}</p>
              <p><small>{z ? "感受" : "FEELING"}</small>{draft.feeling.trim() || feelingNote.trim() || (z ? "暂未填写" : "Not yet filled")}</p>
              {draft.source && <p><small>{z ? "来源" : "SOURCE"}</small>{draft.source}</p>}
            </div>
            <div className="review-actions">
              <button
                className="secondary"
                onClick={() => {
                  setFeelingNote("");
                  edit();
                }}
              >
                ← {z ? "返回修改" : "Edit"}
              </button>
              <button className="primary" onClick={() => confirm(feelingNote)}>
                ✓ {z ? "确认加入编年表" : "Add to chronicle"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
