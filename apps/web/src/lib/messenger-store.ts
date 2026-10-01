/** Local preview state. This stores readable demo content, never real encrypted messages. */
export const WORKSPACE_KEY = "night_messenger_workspace_v1";
export const MAX_BODY_LENGTH = 4000;
export type Message = {
  id: string;
  author: "me" | "peer";
  body: string;
  at: string;
  reaction?: string;
  editedAt?: string;
};
export type LocalConversation = {
  id: string;
  name: string;
  hue: number;
  address?: string;
  unread: number;
  pinned: boolean;
  archived: boolean;
  draft: string;
  createdAt: string;
  messages: Message[];
};
export type Workspace = { version: 1; conversations: LocalConversation[] };
export type Action =
  | { type: "hydrate"; workspace: Workspace }
  | { type: "send"; id: string; body: string; messageId: string; at: string }
  | { type: "draft"; id: string; body: string }
  | { type: "edit"; id: string; messageId: string; body: string; at: string }
  | { type: "deleteMessage"; id: string; messageId: string }
  | { type: "deleteConversation"; id: string }
  | { type: "read" | "pin" | "archive"; id: string }
  | { type: "reaction"; id: string; messageId: string; emoji: string }
  | { type: "create"; conversation: LocalConversation };

export function createDemoWorkspace(now = Date.now()): Workspace {
  const at = (minutes: number) => new Date(now - minutes * 60000).toISOString();
  const make = (
    id: string,
    name: string,
    hue: number,
    unread: number,
    pinned: boolean,
    lines: ["me" | "peer", string, number][],
  ): LocalConversation => ({
    id,
    name,
    hue,
    unread,
    pinned,
    archived: false,
    draft: "",
    createdAt: at(100),
    messages: lines.map(([author, body, min], i) => ({
      id: `${id}-${i}`,
      author,
      body,
      at: at(min),
    })),
  });
  return {
    version: 1,
    conversations: [
      make("ada", "Ada", 35, 2, true, [
        [
          "peer",
          "Hey! Found a little corner of the internet for our next big idea. ☾",
          45,
        ],
        ["me", "No feeds. No noise. I could get used to this.", 42],
        ["peer", "Remember that project we said we'd build someday?", 35],
        ["me", "Someday sounds a lot like today.", 28],
        ["peer", "That's the energy. Let's make something good. ✨", 12],
      ]),
      make("orion", "Orion", 190, 0, true, [
        [
          "peer",
          "A quieter place to connect. I like where this is going.",
          190,
        ],
        ["me", "More room for the conversations that matter.", 183],
        ["peer", "Exactly. I've pinned this chat for later.", 180],
      ]),
      make("nyx", "Nyx", 290, 1, false, [
        ["peer", "Have you tried the local preview yet?", 91],
        ["me", "Just exploring. The privacy vision is interesting.", 86],
        ["peer", "Would love to see selective disclosure come to life.", 75],
      ]),
      make("kai", "Kai", 150, 0, false, [
        ["peer", "Leaving this here for our next brainstorm. 🌱", 1500],
        ["me", "Saved. Good ideas deserve a little room to grow.", 1490],
      ]),
    ],
  };
}

export function workspaceReducer(state: Workspace, action: Action): Workspace {
  if (action.type === "hydrate") return action.workspace;
  if (action.type === "create") {
    if (
      !action.conversation.name.trim() ||
      state.conversations.some((c) => c.id === action.conversation.id)
    )
      return state;
    return {
      ...state,
      conversations: [action.conversation, ...state.conversations],
    };
  }
  if (action.type === "deleteConversation")
    return {
      ...state,
      conversations: state.conversations.filter((c) => c.id !== action.id),
    };
  return {
    ...state,
    conversations: state.conversations.map((c) => {
      if (c.id !== action.id) return c;
      switch (action.type) {
        case "send": {
          const body = action.body.trim();
          if (
            !body ||
            body.length > MAX_BODY_LENGTH ||
            !validDate(action.at) ||
            c.messages.some((m) => m.id === action.messageId)
          )
            return c;
          return {
            ...c,
            draft: "",
            unread: 0,
            messages: [
              ...c.messages,
              {
                id: action.messageId,
                body,
                author: "me" as const,
                at: action.at,
              },
            ],
          };
        }
        case "edit": {
          const body = action.body.trim();
          if (!body || body.length > MAX_BODY_LENGTH || !validDate(action.at))
            return c;
          return {
            ...c,
            messages: c.messages.map((m) =>
              m.id === action.messageId && m.author === "me"
                ? { ...m, body, editedAt: action.at }
                : m,
            ),
          };
        }
        case "deleteMessage":
          return {
            ...c,
            messages: c.messages.filter(
              (m) => m.id !== action.messageId || m.author !== "me",
            ),
          };
        case "draft":
          return { ...c, draft: action.body.slice(0, MAX_BODY_LENGTH) };
        case "read":
          return { ...c, unread: 0 };
        case "pin":
          return { ...c, pinned: !c.pinned };
        case "archive":
          return { ...c, archived: !c.archived, unread: 0 };
        case "reaction":
          return {
            ...c,
            messages: c.messages.map((m) =>
              m.id === action.messageId
                ? {
                    ...m,
                    reaction:
                      m.reaction === action.emoji ? undefined : action.emoji,
                  }
                : m,
            ),
          };
      }
    }),
  };
}

/** Validate persisted data before rendering; malformed storage cannot crash the app. */
export function parseWorkspace(raw: string): Workspace | null {
  try {
    if (raw.length > 5_000_000) return null;
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      !("version" in value) ||
      value.version !== 1 ||
      !("conversations" in value) ||
      !Array.isArray(value.conversations)
    )
      return null;
    if (value.conversations.length > 500) return null;
    const ids = new Set<string>();
    for (const c of value.conversations) {
      if (
        !c ||
        typeof c.id !== "string" ||
        !c.id ||
        c.id.length > 128 ||
        ids.has(c.id) ||
        typeof c.name !== "string" ||
        !c.name.trim() ||
        c.name.length > 40 ||
        typeof c.hue !== "number" ||
        !Number.isFinite(c.hue) ||
        typeof c.unread !== "number" ||
        !Number.isSafeInteger(c.unread) ||
        c.unread < 0 ||
        typeof c.pinned !== "boolean" ||
        typeof c.archived !== "boolean" ||
        typeof c.draft !== "string" ||
        c.draft.length > MAX_BODY_LENGTH ||
        !validDate(c.createdAt) ||
        !Array.isArray(c.messages) ||
        c.messages.length > 10000 ||
        (c.address !== undefined && typeof c.address !== "string")
      )
        return null;
      ids.add(c.id);
      const messageIds = new Set<string>();
      for (const m of c.messages) {
        if (
          !m ||
          typeof m.id !== "string" ||
          !m.id ||
          m.id.length > 128 ||
          messageIds.has(m.id) ||
          !["me", "peer"].includes(m.author) ||
          typeof m.body !== "string" ||
          m.body.length > MAX_BODY_LENGTH ||
          !validDate(m.at) ||
          (m.editedAt !== undefined && !validDate(m.editedAt)) ||
          (m.reaction !== undefined &&
            (typeof m.reaction !== "string" || m.reaction.length > 16))
        )
          return null;
        messageIds.add(m.id);
      }
    }
    return value as Workspace;
  } catch {
    return null;
  }
}
function validDate(value: unknown): boolean {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
export function lastActivity(c: LocalConversation): string {
  return c.messages.at(-1)?.at ?? c.createdAt;
}
export function sortConversations(
  list: LocalConversation[],
): LocalConversation[] {
  return [...list].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      Date.parse(lastActivity(b)) - Date.parse(lastActivity(a)),
  );
}
export function matchesSearch(c: LocalConversation, query: string): boolean {
  const q = query.trim().toLowerCase();
  return (
    !q ||
    c.name.toLowerCase().includes(q) ||
    c.messages.some((m) => m.body.toLowerCase().includes(q))
  );
}
export function newConversation(name: string, address = ""): LocalConversation {
  return {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 40),
    address: address.trim().slice(0, 256) || undefined,
    hue:
      Array.from(name).reduce((sum, letter) => sum + letter.charCodeAt(0), 0) %
      360,
    unread: 0,
    pinned: false,
    archived: false,
    draft: "",
    createdAt: new Date().toISOString(),
    messages: [],
  };
}
