// T-PUB2 — Core: frames.js
// FRAMES CRUD: list, get, save, ensureBuiltinFrame, incrementFrameEarnings, getFrameEarnings.
// Rhino-compatible: var only, no arrow functions, no template literals, no trailing commas.
// All DB access via sqlQuery() from core/minima.js.

function listFrames(cb) {
  var sql = "SELECT FRAME_ID, PUBLISHER_KEY, PUBLISHER_WALLET, PUBLISHER_MX, LABEL, IS_BUILTIN, CREATED_AT, TOTAL_EARNED "
    + "FROM FRAMES "
    + "ORDER BY CREATED_AT";
  sqlQuery(sql, function(err, rows) {
    if (err) { cb(err); return; }
    cb(null, rows);
  });
}

function getFrame(frameId, cb) {
  var sql = "SELECT * FROM FRAMES WHERE UPPER(FRAME_ID) = UPPER('" + escapeSql(frameId) + "')";
  sqlQuery(sql, function(err, rows) {
    if (err) { cb(err); return; }
    cb(null, rows.length > 0 ? rows[0] : null);
  });
}

function saveFrame(frame, cb) {
  var now = Date.now();
  getFrame(frame.frame_id, function(err, existing) {
    if (err) { cb(err); return; }
    var fid = escapeSql(frame.frame_id);
    var pk  = escapeSql(frame.publisher_key);
    var w   = escapeSql(frame.publisher_wallet || '');
    var mx  = escapeSql(frame.publisher_mx || '');
    var lbl = escapeSql(frame.label || '');
    var bi  = (frame.is_builtin ? 'TRUE' : 'FALSE');
    var sql;
    if (existing) {
      sql = "UPDATE FRAMES SET " +
        "PUBLISHER_KEY = '" + pk + "', " +
        "PUBLISHER_WALLET = '" + w + "', " +
        "PUBLISHER_MX = '" + mx + "', " +
        "LABEL = '" + lbl + "', " +
        "IS_BUILTIN = " + bi + " " +
        "WHERE UPPER(FRAME_ID) = UPPER('" + fid + "')";
    } else {
      sql = "INSERT INTO FRAMES " +
        "(FRAME_ID, PUBLISHER_KEY, PUBLISHER_WALLET, PUBLISHER_MX, LABEL, IS_BUILTIN, CREATED_AT, TOTAL_EARNED) VALUES (" +
        "'" + fid + "'," +
        "'" + pk + "'," +
        "'" + w + "'," +
        "'" + mx + "'," +
        "'" + lbl + "'," +
        bi + "," +
        now + "," +
        "0" +
        ")";
    }
    sqlQuery(sql, function(err2) {
      if (err2) { cb(err2); return; }
      cb(null, true);
    });
  });
}

function ensureBuiltinFrame(maximaPk, walletAddr, cb) {
  var frameId = 'builtin:' + maximaPk.toUpperCase();
  getFrame(frameId, function(err, existing) {
    if (err) { cb(err); return; }
    if (existing) { cb(null, existing); return; }
    var frame = {
      frame_id:         frameId,
      publisher_key:    maximaPk,
      publisher_wallet: walletAddr || '',
      label:            'Built-in viewer',
      is_builtin:       true
    };
    saveFrame(frame, function(err2) {
      if (err2) { cb(err2); return; }
      getFrame(frameId, cb);
    });
  });
}

function incrementFrameEarnings(frameId, amount, cb) {
  var sql = "UPDATE FRAMES SET TOTAL_EARNED = TOTAL_EARNED + " + amount + " " +
    "WHERE UPPER(FRAME_ID) = UPPER('" + escapeSql(frameId) + "')";
  sqlQuery(sql, function(err) {
    if (err) { cb(err); return; }
    cb(null, true);
  });
}

// SW-only helper: ensureBuiltinFrame + signalFE in one call.
// Defined here so no service.js closure is passed across the MDS.load boundary
// (avoids Rhino cross-file closure bug — AGENTS.md §14 bug #3).
function initBuiltinFrame(maximaPk, walletAddr) {
  ensureBuiltinFrame(maximaPk, walletAddr, function(err, frame) {
    if (err) {
      MDS.log("[FRAMES] ensureBuiltinFrame error: " + err);
      return;
    }
    signalFE("FRAME_READY", { frame_id: frame.FRAME_ID, is_builtin: true });
  });
}

function getFrameEarnings(frameId, cb) {
  var fid = escapeSql(frameId);
  var sql = "SELECT f.TOTAL_EARNED, "
    + "(SELECT COUNT(*) FROM REWARD_EVENTS WHERE UPPER(PUBLISHER_ID) = UPPER('" + fid + "') AND TYPE = 'publisher_view') AS CNT "
    + "FROM FRAMES f "
    + "WHERE UPPER(f.FRAME_ID) = UPPER('" + fid + "')";
  sqlQuery(sql, function(err, rows) {
    if (err) { cb(err); return; }
    var totalEarned = (rows && rows.length > 0) ? (parseFloat(rows[0].TOTAL_EARNED) || 0) : 0;
    var cnt = (rows && rows.length > 0) ? (parseInt(rows[0].CNT, 10) || 0) : 0;
    cb(null, { total_earned: totalEarned, event_count: cnt });
  });
}
