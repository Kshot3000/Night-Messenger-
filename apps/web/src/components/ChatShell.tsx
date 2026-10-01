"use client";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { Brand } from "./Brand";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { ConversationList } from "./ConversationList";
import { ChatThread } from "./ChatThread";
import { ConnectWalletButton } from "./ConnectWalletButton";
import {
  createDemoWorkspace,
  lastActivity,
  matchesSearch,
  newConversation,
  parseWorkspace,
  type Workspace,
  sortConversations,
  workspaceReducer,
  WORKSPACE_KEY,
} from "@/lib/messenger-store";
import { getDisplayName, setDisplayName } from "@/lib/storage";
import { SakuraPetals } from "./SakuraPetals";

type Dialog =
  | "new"
  | "settings"
  | "details"
  | "reset"
  | "restore"
  | "delete"
  | null;
export function ChatShell() {
  const importInput = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<Workspace | null>(null);
  const [importError, setImportError] = useState("");
  const [workspace, dispatch] = useReducer(
    workspaceReducer,
    undefined,
    createDemoWorkspace,
  );
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread" | "archived">("all");
  const [search, setSearch] = useState("");
  const [mobileThread, setMobileThread] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState("You");
  const [editedName, setEditedName] = useState("");
  const [newName, setNewName] = useState("");
  const [compact, setCompact] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [toast, setToast] = useState("");
  const blockedStorage = useRef(false);
  useEffect(() => {
    let data = createDemoWorkspace();
    try {
      const raw = localStorage.getItem(WORKSPACE_KEY);
      if (raw) {
        const saved = parseWorkspace(raw);
        if (saved) data = saved;
        else {
          blockedStorage.current = true;
          setStorageError(
            "Saved demo data could not be read. This session is temporary. Use Settings → Reset demo to start fresh.",
          );
        }
      }
      setCompact(localStorage.getItem("nm_compact") === "1");
    } catch {
      setStorageError(
        "Browser storage is unavailable. Your changes will last for this visit only.",
      );
    }
    dispatch({ type: "hydrate", workspace: data });
    const firstId =
      sortConversations(data.conversations.filter((c) => !c.archived))[0]?.id ??
      null;
    setActiveId(firstId);
    if (firstId && window.matchMedia("(min-width: 701px)").matches)
      dispatch({ type: "read", id: firstId });
    setName(getDisplayName() || "You");
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || blockedStorage.current) return;
    try {
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
      setStorageError("");
    } catch {
      setStorageError(
        "Could not save to this browser. Your current messages are still visible; export important demo content before leaving.",
      );
    }
  }, [workspace, ready]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMobileThread(false);
        requestAnimationFrame(() =>
          document.getElementById("conversation-search")?.focus(),
        );
      }
      if (e.key === "Escape" && !dialog) setMobileThread(false);
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [dialog]);
  const active = workspace.conversations.find((c) => c.id === activeId) ?? null;
  const conversations = useMemo(
    () =>
      sortConversations(
        workspace.conversations.filter(
          (c) =>
            (filter === "archived"
              ? c.archived
              : !c.archived && (filter !== "unread" || c.unread > 0)) &&
            matchesSearch(c, search),
        ),
      ),
    [workspace, filter, search],
  );
  const unreadCount = workspace.conversations.filter(
    (c) => !c.archived && c.unread > 0,
  ).length;
  function openNew() {
    setNewName("");
    setDialog("new");
  }
  function openSettings() {
    setImportError("");
    setEditedName(name === "You" ? "" : name);
    setDialog("settings");
  }
  function select(id: string) {
    setActiveId(id);
    dispatch({ type: "read", id });
    setMobileThread(true);
  }
  function downloadData(data: unknown, filename: string) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function readBackup(file?: File) {
    if (!file) return;
    setImportError("");
    try {
      if (file.size > 5_000_000)
        throw new Error("Choose a Night Messenger backup smaller than 5 MB.");
      const parsed = parseWorkspace(await file.text());
      if (!parsed)
        throw new Error(
          "This file is not a valid Night Messenger workspace backup. Your current conversations have not changed.",
        );
      setBackup(parsed);
      setDialog("restore");
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "Could not read this backup. Please try again.",
      );
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  }
  function downloadConversation() {
    if (!active) return;
    const data = {
      application: "Night Messenger",
      mode: "local-unencrypted-preview",
      exportedAt: new Date().toISOString(),
      conversation: { ...active, draft: "" },
    };
    downloadData(
      data,
      `night-${active.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "conversation"}.json`,
    );
    setToast(
      "Conversation exported. The file contains readable demo messages.",
    );
  }
  if (!ready)
    return (
      <main id="main-content" className="app-loading">
        <Brand />
        <span className="loading-line" />
        <p>Making a little space for you…</p>
      </main>
    );
  return (
    <div className="messenger-app nm-aurora">
      <SakuraPetals count={12} />
      <header className="app-header">
        <Brand />
        <div className="app-header-right">
          <span className="app-preview-badge">
            <span className="status-dot" /> LOCAL PREVIEW
          </span>
          <Link href="/security" className="app-trust-link">
            Our approach <Icon name="arrowUp" size={13} />
          </Link>
          <ConnectWalletButton />
        </div>
      </header>
      <div className="app-workspace">
        <nav className="app-rail" aria-label="Workspace">
          <div>
            <button
              className={`rail-button ${filter !== "archived" ? "selected" : ""}`}
              aria-label="Messages"
              title="Messages"
              onClick={() => {
                setFilter("all");
                setSearch("");
                setMobileThread(false);
              }}
            >
              <Icon name="chat" size={21} />
              {unreadCount > 0 && <i />}
            </button>
            <button
              className={`rail-button ${filter === "archived" ? "selected" : ""}`}
              aria-label="Archived conversations"
              title="Archived conversations"
              onClick={() => {
                setFilter("archived");
                setMobileThread(false);
              }}
            >
              <Icon name="archive" size={21} />
            </button>
            <Link
              className="rail-button"
              href="/security"
              aria-label="Privacy and transparency"
              title="Privacy and transparency"
            >
              <Icon name="shield" size={22} />
            </Link>
          </div>
          <div>
            <button
              className="rail-button"
              onClick={openSettings}
              aria-label="Settings"
              title="Settings"
            >
              <Icon name="settings" size={21} />
            </button>
            <button
              className="rail-profile"
              aria-label="Edit your profile"
              title="Edit your profile"
              onClick={openSettings}
            >
              <Avatar name={name} hue={80} size={35} />
            </button>
          </div>
        </nav>
        <aside
          className={`conversation-panel ${mobileThread ? "mobile-hidden" : ""}`}
        >
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={select}
            search={search}
            onSearch={setSearch}
            onCreate={openNew}
            filter={filter}
            onFilter={setFilter}
            unreadCount={unreadCount}
          />
          <div className="list-footer">
            <Icon name="moon" size={18} />
            <span>
              A quieter corner of the internet.
              <small>Make yourself at home.</small>
            </span>
            <span>
              <Icon name="moon" size={20} />
            </span>
          </div>
        </aside>
        <main
          id="main-content"
          className={`thread-panel ${mobileThread ? "mobile-visible" : ""}`}
        >
          <ChatThread
            key={activeId}
            conversation={active}
            onBack={() => setMobileThread(false)}
            dispatch={dispatch}
            onDetails={() => setDialog("details")}
            detailsOpen={dialog === "details"}
            onCreate={openNew}
            compact={compact}
          />
        </main>
      </div>
      <div className="app-statusbar">
        <span>
          <span className="status-dot" />{" "}
          {storageError ? "Temporary session" : "On this device"}
        </span>
        <span>
          Demo messages are readable local data. No encrypted delivery yet.
        </span>
        <Link href="/security">
          Preview details <Icon name="arrowUp" size={11} />
        </Link>
      </div>
      {storageError && (
        <div className="storage-alert" role="alert">
          <Icon name="info" size={16} />
          <p>{storageError}</p>
          <button className="text-link" onClick={openSettings}>
            Settings
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={16} />
          {toast}
        </div>
      )}
      {dialog === "new" && (
        <Modal title="Start a conversation" onClose={() => setDialog(null)}>
          <p className="modal-description">
            A new space for a good conversation. This creates a local demo chat;
            it won’t contact anyone.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              const c = newConversation(newName);
              dispatch({ type: "create", conversation: c });
              setActiveId(c.id);
              setFilter("all");
              setSearch("");
              setMobileThread(true);
              setDialog(null);
            }}
          >
            <label className="field-label" htmlFor="new-chat-name">
              Who’s on your mind?
            </label>
            <input
              className="text-input"
              id="new-chat-name"
              placeholder="A name for this conversation"
              autoFocus
              maxLength={40}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <p className="field-help">
              Use a sample name. No address or wallet required.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="button button-outline"
                onClick={() => setDialog(null)}
              >
                Cancel
              </button>
              <button
                className="button button-accent"
                disabled={!newName.trim()}
              >
                Create chat <Icon name="arrow" size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === "details" && active && (
        <Modal title="Conversation details" onClose={() => setDialog(null)}>
          <div className="detail-person">
            <Avatar name={active.name} hue={active.hue} size={70} />
            <h3>{active.name}</h3>
            <p>Local demo conversation</p>
          </div>
          <div className="detail-facts">
            <div>
              <span>Messages</span>
              <strong>{active.messages.length}</strong>
            </div>
            <div>
              <span>Last activity</span>
              <strong>
                {new Date(lastActivity(active)).toLocaleDateString()}
              </strong>
            </div>
            <div>
              <span>Saved</span>
              <strong>In this browser</strong>
            </div>
          </div>
          <div className="detail-actions">
            <button
              onClick={() => {
                dispatch({ type: "pin", id: active.id });
                setToast(
                  active.pinned
                    ? "Conversation unpinned."
                    : "Conversation pinned to the top.",
                );
              }}
            >
              <Icon name="pin" size={18} />
              {active.pinned ? "Unpin conversation" : "Pin conversation"}
              <span>{active.pinned ? "Pinned" : ""}</span>
            </button>
            <button
              onClick={() => {
                dispatch({ type: "archive", id: active.id });
                setDialog(null);
                setActiveId(null);
                setMobileThread(false);
                setToast(
                  active.archived
                    ? "Conversation restored to your inbox."
                    : "Conversation moved to your archive.",
                );
              }}
            >
              <Icon name="archive" size={18} />
              {active.archived ? "Move to inbox" : "Archive conversation"}
            </button>
            <button onClick={downloadConversation}>
              <Icon name="download" size={18} />
              Export conversation <span>JSON</span>
            </button>
            <button className="danger" onClick={() => setDialog("delete")}>
              <Icon name="trash" size={18} />
              Delete conversation
            </button>
          </div>
          <div className="modal-note">
            <Icon name="info" size={17} />
            <p>
              This preview does not encrypt or deliver messages. Exported files
              contain readable demo content.
            </p>
          </div>
        </Modal>
      )}
      {dialog === "settings" && (
        <Modal title="Make it yours" onClose={() => setDialog(null)}>
          <p className="modal-description">
            A few small things to make your space feel like home.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editedName.trim()) return;
              if (setDisplayName(editedName))
                setToast("Your profile has been updated.");
              else
                setToast(
                  "Profile updated for this visit. Browser storage is unavailable.",
                );
              setName(editedName.trim().slice(0, 32));
              setDialog(null);
            }}
          >
            <label className="field-label" htmlFor="profile-name">
              Your display name
            </label>
            <input
              className="text-input"
              id="profile-name"
              placeholder="What should we call you?"
              maxLength={32}
              autoFocus
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              required
            />
            <p className="field-help">
              Only saved on this device. You can change it anytime.
            </p>
            <label className="toggle-setting">
              <span>
                Compact conversations
                <small>A little less space between messages.</small>
              </span>
              <input
                type="checkbox"
                checked={compact}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setCompact(checked);
                  try {
                    localStorage.setItem("nm_compact", checked ? "1" : "0");
                  } catch {
                    setToast("Preference changed for this visit only.");
                  }
                }}
              />
            </label>
            <div className="backup-settings">
              <span className="field-label">Your demo data</span>
              <div>
                <button
                  type="button"
                  className="button button-outline button-small"
                  onClick={() => {
                    downloadData(workspace, "night-messenger-backup.json");
                    setToast(
                      "Workspace backup downloaded. Keep this readable file somewhere safe.",
                    );
                  }}
                >
                  <Icon name="download" size={16} />
                  Back up chats
                </button>
                <button
                  type="button"
                  className="button button-outline button-small"
                  onClick={() => importInput.current?.click()}
                >
                  <Icon name="upload" size={16} />
                  Restore backup
                </button>
              </div>
              <input
                ref={importInput}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                aria-label="Choose a workspace backup"
                onChange={(e) => void readBackup(e.target.files?.[0])}
              />
              <p className="field-help">
                Backups include all chats, reactions, and drafts as readable
                JSON.
              </p>
              {importError && (
                <p className="form-error" role="alert">
                  {importError}
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="text-link danger"
                onClick={() => setDialog("reset")}
              >
                <Icon name="trash" size={15} />
                Reset demo data
              </button>
              <button
                className="button button-accent"
                disabled={!editedName.trim()}
              >
                Save profile <Icon name="check" size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === "reset" && (
        <Modal title="Start fresh?" onClose={() => setDialog("settings")}>
          <p className="modal-description">
            This removes your local demo conversations, messages, reactions, and
            drafts and restores the sample chats. Export any conversations you
            want to keep first.
          </p>
          <div className="modal-actions">
            <button
              className="button button-outline"
              onClick={() => setDialog("settings")}
            >
              Keep my chats
            </button>
            <button
              className="button button-danger"
              onClick={() => {
                blockedStorage.current = false;
                const data = createDemoWorkspace();
                dispatch({ type: "hydrate", workspace: data });
                setActiveId(data.conversations[0].id);
                setSearch("");
                setFilter("all");
                setMobileThread(false);
                setDialog(null);
                setToast("Sample conversations restored.");
              }}
            >
              Reset conversations
            </button>
          </div>
        </Modal>
      )}
      {dialog === "restore" && backup && (
        <Modal
          title="Restore this backup?"
          onClose={() => {
            setBackup(null);
            setDialog("settings");
          }}
        >
          <p className="modal-description">
            This backup contains {backup.conversations.length} conversations.
            Restoring it replaces the chats and drafts currently on this device.
            Download your current backup first if you want to keep both.
          </p>
          <div className="modal-actions">
            <button
              className="button button-outline"
              onClick={() => {
                setBackup(null);
                setDialog("settings");
              }}
            >
              Cancel
            </button>
            <button
              className="button button-accent"
              onClick={() => {
                blockedStorage.current = false;
                dispatch({ type: "hydrate", workspace: backup });
                setActiveId(
                  sortConversations(
                    backup.conversations.filter((c) => !c.archived),
                  )[0]?.id ?? null,
                );
                setFilter("all");
                setSearch("");
                setMobileThread(false);
                setBackup(null);
                setDialog(null);
                setToast("Your workspace backup has been restored.");
              }}
            >
              Restore backup
            </button>
          </div>
        </Modal>
      )}
      {dialog === "delete" && active && (
        <Modal
          title="Delete this conversation?"
          onClose={() => setDialog("details")}
        >
          <p className="modal-description">
            This permanently removes the conversation with {active.name},
            including its messages and draft, from this browser. You can export
            it from Conversation details before deleting.
          </p>
          <div className="modal-actions">
            <button
              className="button button-outline"
              onClick={() => setDialog("details")}
            >
              Keep conversation
            </button>
            <button
              className="button button-danger"
              onClick={() => {
                dispatch({ type: "deleteConversation", id: active.id });
                setActiveId(null);
                setMobileThread(false);
                setDialog(null);
                setToast("Conversation deleted from this browser.");
              }}
            >
              Delete conversation
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
