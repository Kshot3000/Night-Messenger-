// SPDX-License-Identifier: Apache-2.0
import { chmodSync, linkSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync, backup } from "node:sqlite";
import { pathToFileURL } from "node:url";

export async function backupRelay(source, target) {
  const temporary = mkdtempSync(join(dirname(target), ".relay-backup-"));
  const snapshot = join(temporary, "snapshot.sqlite");
  try {
    const db = new DatabaseSync(source, { readOnly: true });
    try { await backup(db, snapshot); } finally { db.close(); }
    const copy = new DatabaseSync(snapshot, { readOnly: true });
    try {
      if (copy.prepare("PRAGMA quick_check").get().quick_check !== "ok") throw new Error("Invalid relay backup");
      copy.prepare("SELECT seq, mailbox FROM messages LIMIT 1").get();
    } finally { copy.close(); }
    chmodSync(snapshot, 0o600);
    linkSync(snapshot, target); // atomic publication; refuses to overwrite an existing backup
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (process.argv.length !== 4) throw new Error("Usage: node backup.mjs LIVE_DB NEW_SNAPSHOT");
  process.umask(0o077);
  await backupRelay(process.argv[2], process.argv[3]);
  console.log("Relay backup created and checked");
}
