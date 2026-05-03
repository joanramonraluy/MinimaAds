// T-CH2 — Core: channels.js
// T-PUB8: all functions accept role param; openChannel adds frameId + walletAddr.
// CHANNEL_STATE CRUD and channel lifecycle management.
// Rhino-compatible: var only, no arrow functions, no template literals, no trailing commas.
// All DB access via sqlQuery() from core/minima.js.

function openChannel(campaignId, viewerKey, creatorMx, maxAmount, role, frameId, walletAddr, cb) {
  var now   = Date.now();
  var r     = role || 'viewer';
  var fid   = frameId || '';
  var wAddr = walletAddr || '';
  var sql = "MERGE INTO CHANNEL_STATE " +
    "(CAMPAIGN_ID, VIEWER_KEY, ROLE, FRAME_ID, CREATOR_MX, CHANNEL_COINID, MAX_AMOUNT, " +
    "CUMULATIVE_EARNED, LATEST_TX_HEX, STATUS, CREATED_AT, VIEWER_WALLET_ADDR) " +
    "KEY (CAMPAIGN_ID, VIEWER_KEY, ROLE) VALUES (" +
    "'" + escapeSql(campaignId) + "'," +
    "'" + escapeSql(viewerKey) + "'," +
    "'" + escapeSql(r) + "'," +
    "'" + escapeSql(fid) + "'," +
    "'" + escapeSql(creatorMx) + "'," +
    "''," +
    maxAmount + "," +
    "0," +
    "''," +
    "'pending'," +
    now + "," +
    "'" + escapeSql(wAddr) + "'" +
    ")";
  sqlQuery(sql, function(err) {
    if (err) { cb(err); return; }
    if (r === 'viewer') {
      updateBudget(campaignId, maxAmount, cb);
    } else {
      cb(null);
    }
  });
}

function activateChannel(campaignId, viewerKey, role, channelCoinId, cb) {
  var r = role || 'viewer';
  var sql = "UPDATE CHANNEL_STATE SET STATUS = 'open', " +
    "CHANNEL_COINID = '" + escapeSql(channelCoinId) + "' " +
    "WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "') " +
    "AND UPPER(VIEWER_KEY) = UPPER('" + escapeSql(viewerKey) + "') " +
    "AND UPPER(ROLE) = UPPER('" + escapeSql(r) + "')";
  sqlQuery(sql, function(err) {
    if (err) { cb(err); return; }
    cb(null, true);
  });
}

function getChannelState(campaignId, viewerKey, role, cb) {
  var r = role || 'viewer';
  var sql = "SELECT * FROM CHANNEL_STATE " +
    "WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "') " +
    "AND UPPER(VIEWER_KEY) = UPPER('" + escapeSql(viewerKey) + "') " +
    "AND UPPER(ROLE) = UPPER('" + escapeSql(r) + "')";
  sqlQuery(sql, function(err, rows) {
    if (err) { cb(err); return; }
    cb(null, rows.length > 0 ? rows[0] : null);
  });
}

function updateChannelVoucher(campaignId, viewerKey, role, cumulativeEarned, latestTxHex, cb) {
  var r = role || 'viewer';
  var sql = "UPDATE CHANNEL_STATE " +
    "SET CUMULATIVE_EARNED = " + cumulativeEarned + ", " +
    "LATEST_TX_HEX = '" + escapeSql(latestTxHex) + "' " +
    "WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "') " +
    "AND UPPER(VIEWER_KEY) = UPPER('" + escapeSql(viewerKey) + "') " +
    "AND UPPER(ROLE) = UPPER('" + escapeSql(r) + "')";
  sqlQuery(sql, function(err) {
    if (err) { cb(err); return; }
    cb(null, true);
  });
}

function getLatestVoucher(campaignId, viewerKey, role, cb) {
  var r = role || 'viewer';
  var sql = "SELECT LATEST_TX_HEX, CUMULATIVE_EARNED FROM CHANNEL_STATE " +
    "WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "') " +
    "AND UPPER(VIEWER_KEY) = UPPER('" + escapeSql(viewerKey) + "') " +
    "AND UPPER(ROLE) = UPPER('" + escapeSql(r) + "')";
  sqlQuery(sql, function(err, rows) {
    if (err) { cb(err); return; }
    if (rows.length === 0) { cb(null, null); return; }
    cb(null, {
      latest_tx_hex: rows[0].LATEST_TX_HEX,
      cumulative_earned: rows[0].CUMULATIVE_EARNED
    });
  });
}

function settleChannel(campaignId, viewerKey, role, cb) {
  var r = role || 'viewer';
  var sql = "UPDATE CHANNEL_STATE SET STATUS = 'settled' " +
    "WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "') " +
    "AND UPPER(VIEWER_KEY) = UPPER('" + escapeSql(viewerKey) + "') " +
    "AND UPPER(ROLE) = UPPER('" + escapeSql(r) + "')";
  sqlQuery(sql, function(err) {
    if (err) { cb(err); return; }
    cb(null, true);
  });
}
