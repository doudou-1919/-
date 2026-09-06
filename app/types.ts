export type ChatMode = "quick_note" | "deep_interview";
export type AttachmentKind = "link" | "photo" | "ai_history" | "file";

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  name: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
}

export interface Conversation {
  id: string;
  mode: ChatMode;
  title: string;
  time: string;
  status: "active" | "complete";
  messages: ChatMessage[];
}

export interface LifeEventDraft {
  date: string;
  event: string;
  feeling: string;
  source?: string;
}

export interface ConfirmedLifeEvent extends LifeEventDraft {
  id: string;
  aiSummary: string;
  confirmed: boolean;
  userAdded: true;
}

export interface BeliefInsight {
  id: string;
  kind: "life" | "values" | "world" | "pattern";
  title: string;
  content: string;
  source: string;
  evidenceCount: number;
  feedback?: "confirmed" | "rejected" | "needs_context";
}
