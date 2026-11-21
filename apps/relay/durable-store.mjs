// SPDX-License-Identifier: Apache-2.0
import { DatabaseSync } from "node:sqlite";

export function openMailboxStore(file, { maxMessages, maxPerMailbox, ttlMs, maxDatabasePages }) {
  const db = new DatabaseSync(file, { timeout: 5000 });
  try {
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      PRAGMA secure_delete = ON;
      PRAGMA max_page_count = ${maxDatabasePages};
      PRAGMA journal_size_limit = 16777216;
      CREATE TABLE IF NOT EXISTS messages (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        mailbox TEXT NOT NULL,
        commitment TEXT NOT NULL,
        envelope TEXT,
        receivedAt INTEGER NOT NULL,
        expiresAt INTEGER NOT NULL,
        UNIQUE (mailbox, commitment)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS mailbox_sequence ON messages (mailbox, seq);
      CREATE INDEX IF NOT EXISTS expiry ON messages (expiresAt);
    `);
    const find = db.prepare("SELECT seq, commitment, receivedAt, envelope IS NULL AS deleted FROM messages WHERE mailbox = ? AND commitment = ?");
    const insert = db.prepare("INSERT INTO messages (mailbox, commitment, envelope, receivedAt, expiresAt) VALUES (?, ?, ?, ?, ?)");
    const list = db.prepare("SELECT seq, envelope, commitment, receivedAt FROM messages WHERE mailbox = ? AND seq > ? AND expiresAt > ? AND envelope IS NOT NULL ORDER BY seq LIMIT ?");
    const remove = db.prepare("UPDATE messages SET envelope = NULL WHERE mailbox = ? AND commitment = ?");
    const expire = db.prepare("DELETE FROM messages WHERE expiresAt <= ?");
    const count = db.prepare("SELECT count(*) AS n FROM messages");
    const countMailbox = db.prepare("SELECT count(*) AS n FROM messages WHERE mailbox = ?");
    const format = (record) => ({ ...record, receivedAt: new Date(record.receivedAt).toISOString() });

    return {
      append(mailbox, commitment, envelope, now) {
        // Commit the insert before allowing the HTTP acknowledgement.
        db.exec("BEGIN IMMEDIATE");
        try {
          expire.run(now);
          const existing = find.get(mailbox, commitment);
          let result;
          if (existing) {
            const { deleted, ...record } = existing;
            result = { status: 200, body: { ...format(record), ...(deleted ? { deleted: true } : {}) } };
          } else if (count.get().n >= maxMessages || countMailbox.get(mailbox).n >= maxPerMailbox) {
            result = { status: 507, body: { error: "mailbox or relay is full" } };
          } else {
            const { lastInsertRowid: seq } = insert.run(mailbox, commitment, envelope, now, now + ttlMs);
            result = { status: 201, body: format({ seq, commitment, receivedAt: now }) };
          }
          db.exec("COMMIT");
          return result;
        } catch (error) {
          // SQLite can already have aborted the transaction on disk-full errors.
          try { db.exec("ROLLBACK"); } catch {}
          throw error;
        }
      },
      list: (mailbox, after, now, limit) => list.all(mailbox, after, now, limit).map(format),
      delete: (mailbox, commitment) => remove.run(mailbox, commitment),
      expire: (now) => expire.run(now),
      close: () => db.close(),
    };
  } catch (error) {
    db.close();
    throw error;
  }
}
