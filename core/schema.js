// Core: schema.js — H2 schema migration runner (OPEN-6).
// Rhino-safe: var only, no arrow functions, no template literals, no trailing commas.
// Loaded by service.js (MDS.load) and public/index.html (<script>) — one list,
// one runner, both runtimes, identical resulting schema regardless of boot order.
// Depends on sqlQuery() and escapeSql() from core/minima.js.
// Design: docs/HISTORY.md §17, session 2026-09-12 (OPEN-6). Spec: MinimaAds.md §3.5.
//
// Migration classes:
//   A — additive (ALTER TABLE ... ADD COLUMN IF NOT EXISTS). NOT declared here:
//       the existing statements in db-init.js / dapp/app.js stay where they are.
//   B — idempotent destructive DDL. Only these three guarded forms are valid under
//       H2 2.1.214 + MODE=MySQL (see AGENTS.md §4.1 capability matrix):
//         ALTER TABLE IF EXISTS t ALTER COLUMN IF EXISTS old RENAME TO new
//         ALTER TABLE IF EXISTS t ALTER COLUMN IF EXISTS c SET DATA TYPE T
//         ALTER TABLE IF EXISTS t DROP COLUMN IF EXISTS c
//       Runs every boot, never consults SCHEMA_MIGRATIONS.
//   C — NOT idempotent (data backfills, multi-step table rewrites). The only class
//       that consults SCHEMA_MIGRATIONS. Every C migration must still be written so
//       that a re-run is harmless (self-limiting WHERE clause); the version row
//       prevents the needless re-run, the WHERE clause prevents the harmful one.
//
// Rules: append-only. Never reorder, never edit a shipped entry, never reuse an id.
// A destructive migration is always a PAIRED change — update the CREATE TABLE
// definition in BOTH db-init.js and dapp/app.js as well (AGENTS.md §5).

var SCHEMA_MIGRATIONS_LIST = [
  { id: "2026-09-12-001-frames-publisher-mx-1024",
    cls: "B",
    sql: "ALTER TABLE IF EXISTS FRAMES ALTER COLUMN IF EXISTS PUBLISHER_MX SET DATA TYPE VARCHAR(1024)" }
];

function runSchemaMigrations(runtimeTag, done) {
  sqlQuery("CREATE TABLE IF NOT EXISTS SCHEMA_MIGRATIONS ("
    + "MIGRATION_ID VARCHAR(128) PRIMARY KEY,"
    + "APPLIED_AT   BIGINT       NOT NULL,"
    + "APPLIED_BY   VARCHAR(8)   NOT NULL DEFAULT ''"
    + ")", function(errCreate) {
    if (errCreate) {
      MDS.log("[SCHEMA] cannot create SCHEMA_MIGRATIONS - " + errCreate);
      if (done) { done(errCreate); }
      return;
    }

    sqlQuery("SELECT MIGRATION_ID FROM SCHEMA_MIGRATIONS", function(errSel, rows) {
      var applied = {};
      var i;
      if (!errSel && rows) {
        for (i = 0; i < rows.length; i++) { applied[rows[i].MIGRATION_ID] = true; }
      }
      _runOneMigration(0, applied, runtimeTag, done);
    });
  });
}

function _runOneMigration(idx, applied, runtimeTag, done) {
  if (idx >= SCHEMA_MIGRATIONS_LIST.length) {
    MDS.log("[SCHEMA] migrations complete (" + SCHEMA_MIGRATIONS_LIST.length + " declared)");
    if (done) { done(null); }
    return;
  }
  var m = SCHEMA_MIGRATIONS_LIST[idx];

  // Class C is the only class that consults the version table.
  if (m.cls === "C" && applied[m.id]) {
    _runOneMigration(idx + 1, applied, runtimeTag, done);
    return;
  }

  sqlQuery(m.sql, function(err) {
    if (err) {
      // Never silently swallow: a failed destructive migration is a verified no-op
      // (no _COPY_ leak, original type and rows intact), so the DB is intact — but
      // the node is now behind and must say so. Stop the chain; later migrations may
      // depend on this one. Next boot retries.
      MDS.log("[SCHEMA] MIGRATION FAILED id=" + m.id + " cls=" + m.cls + " err=" + err);
      if (done) { done(err); }
      return;
    }
    if (m.cls === "C") {
      sqlQuery("MERGE INTO SCHEMA_MIGRATIONS (MIGRATION_ID, APPLIED_AT, APPLIED_BY) KEY (MIGRATION_ID) VALUES ("
        + "'" + escapeSql(m.id) + "', " + Date.now() + ", '" + escapeSql(runtimeTag) + "')", function(errMark) {
        if (errMark) { MDS.log("[SCHEMA] applied but could not record id=" + m.id + " - " + errMark); }
        _runOneMigration(idx + 1, applied, runtimeTag, done);
      });
      return;
    }
    _runOneMigration(idx + 1, applied, runtimeTag, done);
  });
}
