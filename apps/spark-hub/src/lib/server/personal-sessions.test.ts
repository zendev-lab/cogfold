import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { migrate, openMemoryDatabase } from "@zendev-lab/spark-hub-storage-sqlite";
import { parseSparkSessionProjection } from "@zendev-lab/spark-protocol";
const state = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("./db.ts", () => ({ getDatabase: () => state.db }));
import { createPersonalConversation, requirePersonalConversation } from "./personal-sessions.ts";
let db: ReturnType<typeof openMemoryDatabase>;
const now = new Date().toISOString();
beforeEach(() => {
  db = openMemoryDatabase();
  migrate(db);
  state.db = db;
  db.prepare(
    `INSERT INTO users (id, display_name, role, status, created_at, updated_at) VALUES ('alice', 'Alice', 'owner', 'active', ?, ?)`,
  ).run(now, now);
  for (const id of ["a", "b"])
    db.prepare(
      `INSERT INTO runtime_connections (id, name, status, created_at, updated_at) VALUES (?, ?, 'online', ?, ?)`,
    ).run(id, id, now, now);
  db.prepare(
    `INSERT INTO user_daemon_grants (id, user_id, runtime_id, granted_by_user_id, created_at) VALUES ('grant', 'alice', 'a', 'alice', ?)`,
  ).run(now);
  db.prepare(
    `INSERT INTO personal_bindings (id, hub_instance_id, user_id, runtime_id, local_owner_id, pairing_expires_at, credential_hash, created_at) VALUES ('binding', 'hub', 'alice', 'a', 'owner', ?, 'secret-hash', ?)`,
  ).run(now, now);
});
afterEach(() => db.close());
it("rejects claiming an existing personal session on another daemon without leaving an ownership row", async () => {
  const sessionId = "sess_" + "a".repeat(32);
  const session = parseSparkSessionProjection({
    sessionId,
    scope: { kind: "daemon", daemonId: "b" },
    lifecycle: "open",
    placement: "active",
    activity: "idle",
    lifetime: "persistent",
    roleBinding: { kind: "none" },
    lineage: { kind: "root" },
    incarnation: 1,
    visibility: "owner",
    retention: "retain",
    purpose: "personal",
    cwd: "/private/personal",
    bindings: [],
    createdAt: now,
    updatedAt: now,
  });
  db.prepare(
    `INSERT INTO runtime_session_projections (runtime_id, session_id, scope, lifecycle, placement, activity, lifetime, lineage_origin_kind, record_json, projected_at) VALUES ('b', ?, 'daemon', 'open', 'active', 'idle', 'persistent', 'root', ?, ?)`,
  ).run(sessionId, JSON.stringify(session), now);
  await expect(createPersonalConversation("alice", "binding", sessionId)).rejects.toThrow();
  expect(db.prepare("SELECT count(*) AS count FROM personal_sessions").get()).toMatchObject({
    count: 0,
  });
});
it("rejects a revoked binding or removed daemon grant before reading or submitting a personal session", () => {
  db.prepare(
    "INSERT INTO personal_sessions (session_id, user_id, binding_id, runtime_id, created_at) VALUES ('private', 'alice', 'binding', 'a', ?)",
  ).run(now);
  expect(requirePersonalConversation("alice", "private")).toMatchObject({ runtimeId: "a" });
  db.prepare("UPDATE personal_bindings SET revoked_at = ? WHERE id = 'binding'").run(now);
  expect(() => requirePersonalConversation("alice", "private")).toThrow();
  db.prepare("UPDATE personal_bindings SET revoked_at = NULL WHERE id = 'binding'").run();
  db.prepare("UPDATE user_daemon_grants SET revoked_at = ? WHERE id = 'grant'").run(now);
  expect(() => requirePersonalConversation("alice", "private")).toThrow();
});
