import test from "node:test";
import assert from "node:assert/strict";
import {
  createDemoWorkspace,
  workspaceReducer,
  parseWorkspace,
  newConversation,
  sortConversations,
  matchesSearch,
  MAX_BODY_LENGTH,
} from "../src/lib/messenger-store.ts";
const now = "2026-10-01T13:00:00.000Z";
const seed = () => createDemoWorkspace(Date.parse(now));

test("messages and drafts survive a workspace JSON round trip", () => {
  let state = workspaceReducer(seed(), {
    type: "draft",
    id: "ada",
    body: "A draft\non two lines",
  });
  state = workspaceReducer(state, {
    type: "send",
    id: "orion",
    body: "  Hello from my browser  ",
    messageId: "new-message",
    at: now,
  });
  const loaded = parseWorkspace(JSON.stringify(state));
  assert.equal(
    loaded.conversations.find((c) => c.id === "ada").draft,
    "A draft\non two lines",
  );
  assert.equal(
    loaded.conversations.find((c) => c.id === "orion").messages.at(-1).body,
    "Hello from my browser",
  );
});
test("send rejects blank, oversized, invalid-date and duplicate messages", () => {
  let state = seed();
  const size = state.conversations[0].messages.length;
  for (const [body, at] of [
    ["  ", now],
    ["x".repeat(MAX_BODY_LENGTH + 1), now],
    ["hello", "broken"],
  ]) {
    state = workspaceReducer(state, {
      type: "send",
      id: "ada",
      body,
      at,
      messageId: "new",
    });
  }
  assert.equal(state.conversations[0].messages.length, size);
  const action = {
    type: "send",
    id: "ada",
    body: "One message",
    at: now,
    messageId: "unique",
  };
  state = workspaceReducer(workspaceReducer(state, action), action);
  assert.equal(state.conversations[0].messages.length, size + 1);
});
test("editing and deleting only affect your own messages", () => {
  let state = seed();
  const peer = state.conversations[0].messages[0];
  state = workspaceReducer(state, {
    type: "edit",
    id: "ada",
    messageId: peer.id,
    body: "Changed",
    at: now,
  });
  state = workspaceReducer(state, {
    type: "deleteMessage",
    id: "ada",
    messageId: peer.id,
  });
  assert.deepEqual(state.conversations[0].messages[0], peer);
  const mine = state.conversations[0].messages.find((m) => m.author === "me");
  state = workspaceReducer(state, {
    type: "edit",
    id: "ada",
    messageId: mine.id,
    body: "Edited message",
    at: now,
  });
  assert.equal(
    state.conversations[0].messages.find((m) => m.id === mine.id).editedAt,
    now,
  );
  state = workspaceReducer(state, {
    type: "deleteMessage",
    id: "ada",
    messageId: mine.id,
  });
  assert.ok(!state.conversations[0].messages.some((m) => m.id === mine.id));
});
test("read, reactions, pinning and archive persist independently", () => {
  let state = workspaceReducer(seed(), { type: "read", id: "ada" });
  state = workspaceReducer(state, { type: "archive", id: "ada" });
  state = workspaceReducer(state, { type: "pin", id: "nyx" });
  const reaction = {
    type: "reaction",
    id: "ada",
    messageId: "ada-0",
    emoji: "✨",
  };
  state = workspaceReducer(state, reaction);
  assert.equal(
    parseWorkspace(JSON.stringify(state)).conversations[0].messages[0].reaction,
    "✨",
  );
  assert.equal(state.conversations[0].unread, 0);
  assert.equal(state.conversations[0].archived, true);
  assert.equal(
    workspaceReducer(state, reaction).conversations[0].messages[0].reaction,
    undefined,
  );
  assert.equal(state.conversations.find((c) => c.id === "nyx").pinned, true);
});
test("new chats can be searched, sorted, and removed", () => {
  const conversation = newConversation("  Sample Friend  ");
  let state = workspaceReducer(seed(), { type: "create", conversation });
  assert.equal(conversation.name, "Sample Friend");
  assert.equal(matchesSearch(conversation, "friend"), true);
  assert.equal(matchesSearch(seed().conversations[0], "SOMEDAY"), true);
  assert.equal(sortConversations(state.conversations)[0].pinned, true);
  state = workspaceReducer(state, {
    type: "deleteConversation",
    id: conversation.id,
  });
  assert.equal(state.conversations.length, 4);
});
test("malformed or incompatible backups are rejected without changing existing data", () => {
  for (const raw of [
    "no json",
    "null",
    "{}",
    '{"version":2,"conversations":[]}',
    "x".repeat(5_000_001),
  ])
    assert.equal(parseWorkspace(raw), null);
  const mutations = [
    (s) => s.conversations.push(s.conversations[0]),
    (s) => s.conversations[0].messages.push(s.conversations[0].messages[0]),
    (s) => (s.conversations[0].createdAt = "not a date"),
    (s) => (s.conversations[0].unread = -1),
    (s) => (s.conversations[0].draft = "x".repeat(MAX_BODY_LENGTH + 1)),
    (s) => (s.conversations[0].messages[0].editedAt = "invalid"),
    (s) => (s.conversations[0].messages[0].author = "stranger"),
  ];
  for (const change of mutations) {
    const state = seed();
    change(state);
    assert.equal(parseWorkspace(JSON.stringify(state)), null);
  }
  assert.deepEqual(parseWorkspace('{"version":1,"conversations":[]}'), {
    version: 1,
    conversations: [],
  });
});
