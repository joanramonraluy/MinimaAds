// T3 — Core: campaigns.js
// CRUD operations for CAMPAIGNS and ADS tables.
// Rhino-compatible: var only, no arrow functions, no template literals.
// All DB access via sqlQuery() from core/minima.js.

function getCampaigns(cb) {
  sqlQuery("SELECT * FROM CAMPAIGNS", function(err, rows) {
    if (err) { cb(err); return; }
    cb(null, rows);
  });
}

function getCampaign(id, cb) {
  sqlQuery(
    "SELECT * FROM CAMPAIGNS WHERE UPPER(ID) = UPPER('" + escapeSql(id) + "')",
    function(err, rows) {
      if (err) { cb(err); return; }
      cb(null, rows.length > 0 ? rows[0] : null);
    }
  );
}

// B-1 fix: coerce a value to a finite float, returning dflt if NaN/Infinity/non-numeric.
// Used for money and timestamp fields interpolated directly into SQL numerics.
function _numF(v, dflt) { var n = parseFloat(v); return isFinite(n) ? n : dflt; }

// B-1 fix: coerce to a finite integer, returning dflt if NaN/Infinity/non-numeric.
function _numI(v, dflt) { var n = parseInt(v, 10); return isFinite(n) ? n : dflt; }

function saveCampaign(campaign, ad, cb) {
  var mvr = campaign.max_viewer_reward !== undefined ? campaign.max_viewer_reward : campaign.MAX_VIEWER_REWARD;
  var prv = _numF((campaign.publisher_reward_view !== null && campaign.publisher_reward_view !== undefined) ? campaign.publisher_reward_view : 0, 0);
  var mpb = _numF((campaign.max_publisher_budget !== null && campaign.max_publisher_budget !== undefined) ? campaign.max_publisher_budget : 0, 0);
  var pbs = _numF((campaign.publisher_budget_spent !== null && campaign.publisher_budget_spent !== undefined) ? campaign.publisher_budget_spent : 0, 0);
  var mdv = _numI((campaign.max_daily_views !== null && campaign.max_daily_views !== undefined) ? campaign.max_daily_views : LIMITS.MAX_VIEWS_PER_CAMPAIGN_PER_DAY, LIMITS.MAX_VIEWS_PER_CAMPAIGN_PER_DAY);
  var mdc = _numI((campaign.max_daily_clicks !== null && campaign.max_daily_clicks !== undefined) ? campaign.max_daily_clicks : LIMITS.MAX_CLICKS_PER_CAMPAIGN_PER_DAY, LIMITS.MAX_CLICKS_PER_CAMPAIGN_PER_DAY);
  var cms = _numI((campaign.cooldown_ms !== null && campaign.cooldown_ms !== undefined) ? campaign.cooldown_ms : LIMITS.COOLDOWN_BETWEEN_REWARDS_MS, LIMITS.COOLDOWN_BETWEEN_REWARDS_MS);

  // B-1: Coerce the six numeric money/time fields before SQL interpolation.
  // These arrive from remote CAMPAIGN_ANNOUNCE / CAMPAIGN_DATA_RESPONSE payloads
  // (attacker-controlled). Without coercion an attacker can inject arbitrary SQL
  // by supplying a string value such as "0,0,'hack',0,0,NULL,'') ; DROP TABLE …".
  // parseFloat/parseInt reduce any input to a JS number; isFinite() rejects NaN
  // and Infinity so only a safe numeric literal reaches the query string.
  var budgetTotal     = _numF(campaign.budget_total, 0);
  var budgetRemaining = _numF(campaign.budget_remaining, 0);
  var rewardView      = _numF(campaign.reward_view, 0);
  var rewardClick     = _numF(campaign.reward_click, 0);
  var createdAt       = _numI(campaign.created_at, Date.now());
  var expiresAt       = (campaign.expires_at !== null && campaign.expires_at !== undefined)
                          ? _numI(campaign.expires_at, null) : null;

  var cSql = "MERGE INTO CAMPAIGNS " +
    "(ID, CREATOR_ADDRESS, TITLE, BUDGET_TOTAL, BUDGET_REMAINING, " +
    "REWARD_VIEW, REWARD_CLICK, STATUS, CREATED_AT, EXPIRES_AT, " +
    "ESCROW_COINID, ESCROW_WALLET_PK, MAX_VIEWER_REWARD, " +
    "PUBLISHER_REWARD_VIEW, MAX_PUBLISHER_BUDGET, PUBLISHER_BUDGET_SPENT, MAX_DAILY_VIEWS, MAX_DAILY_CLICKS, COOLDOWN_MS, CREATOR_MX) KEY (ID) VALUES (" +
    "'" + escapeSql(campaign.id) + "'," +
    "'" + escapeSql(campaign.creator_address) + "'," +
    "'" + escapeSql(campaign.title) + "'," +
    budgetTotal + "," +
    budgetRemaining + "," +
    rewardView + "," +
    rewardClick + "," +
    "'" + escapeSql(campaign.status) + "'," +
    createdAt + "," +
    (expiresAt !== null ? expiresAt : "NULL") + "," +
    "'" + escapeSql(campaign.escrow_coinid || '') + "'," +
    "'" + escapeSql(campaign.escrow_wallet_pk || '') + "'," +
    (mvr !== null && mvr !== undefined ? parseFloat(mvr) : "NULL") + "," +
    prv + "," + mpb + "," + pbs + "," +
    mdv + "," + mdc + "," + cms + "," +
    "'" + escapeSql(campaign.creator_mx || '') + "'" +
    ")";

  sqlQuery(cSql, function(err) {
    if (err) { cb(err); return; }

    var imgZoom = (ad.image_zoom !== undefined && ad.image_zoom !== null) ? parseFloat(ad.image_zoom) : 1.0;
    var imgWidthPct = (ad.image_width_pct !== undefined && ad.image_width_pct !== null) ? parseInt(ad.image_width_pct, 10) : 40;

    var aSql = "MERGE INTO ADS " +
      "(ID, CAMPAIGN_ID, TITLE, BODY, CTA_LABEL, CTA_URL, INTERESTS, IMAGE_DATA, SHOW_TITLE, SHOW_BODY, SHOW_CTA, BG_COLOR, TEXT_COLOR, IMAGE_POSITION, IMAGE_ZOOM, IMAGE_WIDTH_PCT) KEY (ID) VALUES (" +
      "'" + escapeSql(ad.id) + "'," +
      "'" + escapeSql(ad.campaign_id) + "'," +
      "'" + escapeSql(ad.title) + "'," +
      "'" + escapeSql(ad.body || '') + "'," +
      "'" + escapeSql(ad.cta_label || '') + "'," +
      "'" + escapeSql(ad.cta_url || '') + "'," +
      (ad.interests ? "'" + escapeSql(ad.interests) + "'" : "NULL") + "," +
      (ad.image_data ? "'" + escapeSql(ad.image_data) + "'" : "NULL") + "," +
      (ad.show_title !== undefined && ad.show_title !== null ? (ad.show_title ? 1 : 0) : 1) + "," +
      (ad.show_body !== undefined && ad.show_body !== null ? (ad.show_body ? 1 : 0) : 1) + "," +
      (ad.show_cta !== undefined && ad.show_cta !== null ? (ad.show_cta ? 1 : 0) : 1) + "," +
      "'" + escapeSql(ad.bg_color || '#ffffff') + "'," +
      "'" + escapeSql(ad.text_color || '#111111') + "'," +
      "'" + escapeSql(ad.image_position || 'center') + "'," +
      imgZoom + "," +
      imgWidthPct +
      ")";

    sqlQuery(aSql, function(err2) {
      if (err2) { cb(err2); return; }
      cb(null, true);
    });
  });
}

function updateBudget(campaignId, deductAmount, cb) {
  getCampaign(campaignId, function(err, campaign) {
    if (err) { cb(err); return; }
    if (!campaign) { cb("Campaign not found: " + campaignId); return; }

    var remaining = parseFloat(campaign.BUDGET_REMAINING) - deductAmount;
    if (remaining < 0) { remaining = 0; }
    remaining = _numI(remaining, 0);
    var newStatus = remaining <= 0 ? "finished" : campaign.STATUS;

    // B-1 (defence in depth): values read from the DB row are already numbers, but
    // coerce them anyway so a poisoned row written before this fix cannot re-inject.
    var sql = "MERGE INTO CAMPAIGNS " +
      "(ID, CREATOR_ADDRESS, TITLE, BUDGET_TOTAL, BUDGET_REMAINING, " +
      "REWARD_VIEW, REWARD_CLICK, STATUS, CREATED_AT, EXPIRES_AT, " +
      "ESCROW_COINID, ESCROW_WALLET_PK, MAX_VIEWER_REWARD, " +
      "PUBLISHER_REWARD_VIEW, MAX_PUBLISHER_BUDGET, PUBLISHER_BUDGET_SPENT, MAX_DAILY_VIEWS, MAX_DAILY_CLICKS, COOLDOWN_MS) KEY (ID) VALUES (" +
      "'" + escapeSql(campaign.ID) + "'," +
      "'" + escapeSql(campaign.CREATOR_ADDRESS) + "'," +
      "'" + escapeSql(campaign.TITLE) + "'," +
      _numF(campaign.BUDGET_TOTAL, 0) + "," +
      remaining + "," +
      _numF(campaign.REWARD_VIEW, 0) + "," +
      _numF(campaign.REWARD_CLICK, 0) + "," +
      "'" + escapeSql(newStatus) + "'," +
      _numI(campaign.CREATED_AT, 0) + "," +
      (campaign.EXPIRES_AT !== null && campaign.EXPIRES_AT !== undefined ? _numI(campaign.EXPIRES_AT, 0) : "NULL") + "," +
      "'" + escapeSql(campaign.ESCROW_COINID || '') + "'," +
      "'" + escapeSql(campaign.ESCROW_WALLET_PK || '') + "'," +
      (campaign.MAX_VIEWER_REWARD !== null && campaign.MAX_VIEWER_REWARD !== undefined ? parseFloat(campaign.MAX_VIEWER_REWARD) : "NULL") + "," +
      (campaign.PUBLISHER_REWARD_VIEW !== null && campaign.PUBLISHER_REWARD_VIEW !== undefined ? parseFloat(campaign.PUBLISHER_REWARD_VIEW) : 0) + "," +
      (campaign.MAX_PUBLISHER_BUDGET !== null && campaign.MAX_PUBLISHER_BUDGET !== undefined ? parseFloat(campaign.MAX_PUBLISHER_BUDGET) : 0) + "," +
      (campaign.PUBLISHER_BUDGET_SPENT !== null && campaign.PUBLISHER_BUDGET_SPENT !== undefined ? parseFloat(campaign.PUBLISHER_BUDGET_SPENT) : 0) + "," +
      (campaign.MAX_DAILY_VIEWS !== null && campaign.MAX_DAILY_VIEWS !== undefined ? parseInt(campaign.MAX_DAILY_VIEWS, 10) : LIMITS.MAX_VIEWS_PER_CAMPAIGN_PER_DAY) + "," +
      (campaign.MAX_DAILY_CLICKS !== null && campaign.MAX_DAILY_CLICKS !== undefined ? parseInt(campaign.MAX_DAILY_CLICKS, 10) : LIMITS.MAX_CLICKS_PER_CAMPAIGN_PER_DAY) + "," +
      (campaign.COOLDOWN_MS !== null && campaign.COOLDOWN_MS !== undefined ? parseInt(campaign.COOLDOWN_MS, 10) : LIMITS.COOLDOWN_BETWEEN_REWARDS_MS) +
      ")";

    sqlQuery(sql, function(err2) {
      if (err2) { cb(err2); return; }
      cb(null, true);
    });
  });
}

function setCampaignStatus(campaignId, status, cb) {
  var sql = "UPDATE CAMPAIGNS SET STATUS = '" + escapeSql(status) + "' " +
    "WHERE UPPER(ID) = UPPER('" + escapeSql(campaignId) + "')";
  sqlQuery(sql, function(err) {
    if (err) { cb(err); return; }
    cb(null, true);
  });
}

// Returns '0x' + hex(status) or '' if status is not a valid campaign status.
function encodeStatusForTx(status) {
  if (status !== 'active' && status !== 'paused' && status !== 'finished') {
    return '';
  }
  return '0x' + utf8ToHex(status).toUpperCase();
}

// Builds the ordered array of { port, value } pairs for a status-update tx.
// currentEscrow = { walletPk, campaignIdHex, creatorMxHex, platformKeyHex, maxPubBudget, feeflag }
// newStatusHex  = encodeStatusForTx(newStatus)
// coinAmount    = current escrow coin amount (sets port 10 = coinAmount so change = 0,
//                 bypassing the VERIFYOUT(INC(@INPUT) @ADDRESS change ...) check in
//                 ESCROW_SCRIPT_V3 — required because a status-update TX has only 1 output)
function buildStatusUpdateStatePorts(currentEscrow, newStatusHex, coinAmount) {
  return [
    { port: 1,  value: currentEscrow.walletPk },
    { port: 3,  value: currentEscrow.campaignIdHex },
    { port: 4,  value: currentEscrow.creatorMxHex },
    { port: 5,  value: currentEscrow.platformKeyHex },
    { port: 6,  value: currentEscrow.maxPubBudget },
    { port: 7,  value: newStatusHex },
    { port: 10, value: coinAmount ? coinAmount.toString() : '0' },
    { port: 11, value: '0' }
  ];
}
