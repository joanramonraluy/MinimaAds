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

function saveCampaign(campaign, ad, cb) {
  var mvr = campaign.max_viewer_reward !== undefined ? campaign.max_viewer_reward : campaign.MAX_VIEWER_REWARD;
  var prv = (campaign.publisher_reward_view !== null && campaign.publisher_reward_view !== undefined) ? parseFloat(campaign.publisher_reward_view) : 0;
  var mpb = (campaign.max_publisher_budget !== null && campaign.max_publisher_budget !== undefined) ? parseFloat(campaign.max_publisher_budget) : 0;
  var pbs = (campaign.publisher_budget_spent !== null && campaign.publisher_budget_spent !== undefined) ? parseFloat(campaign.publisher_budget_spent) : 0;

  var cSql = "MERGE INTO CAMPAIGNS " +
    "(ID, CREATOR_ADDRESS, TITLE, BUDGET_TOTAL, BUDGET_REMAINING, " +
    "REWARD_VIEW, REWARD_CLICK, STATUS, CREATED_AT, EXPIRES_AT, " +
    "ESCROW_COINID, ESCROW_WALLET_PK, MAX_VIEWER_REWARD, " +
    "PUBLISHER_REWARD_VIEW, MAX_PUBLISHER_BUDGET, PUBLISHER_BUDGET_SPENT) KEY (ID) VALUES (" +
    "'" + escapeSql(campaign.id) + "'," +
    "'" + escapeSql(campaign.creator_address) + "'," +
    "'" + escapeSql(campaign.title) + "'," +
    campaign.budget_total + "," +
    campaign.budget_remaining + "," +
    campaign.reward_view + "," +
    campaign.reward_click + "," +
    "'" + escapeSql(campaign.status) + "'," +
    campaign.created_at + "," +
    (campaign.expires_at !== null && campaign.expires_at !== undefined ? campaign.expires_at : "NULL") + "," +
    "'" + escapeSql(campaign.escrow_coinid || '') + "'," +
    "'" + escapeSql(campaign.escrow_wallet_pk || '') + "'," +
    (mvr !== null && mvr !== undefined ? parseFloat(mvr) : "NULL") + "," +
    prv + "," + mpb + "," + pbs +
    ")";

  sqlQuery(cSql, function(err) {
    if (err) { cb(err); return; }

    var aSql = "MERGE INTO ADS " +
      "(ID, CAMPAIGN_ID, TITLE, BODY, CTA_LABEL, CTA_URL, INTERESTS) KEY (ID) VALUES (" +
      "'" + escapeSql(ad.id) + "'," +
      "'" + escapeSql(ad.campaign_id) + "'," +
      "'" + escapeSql(ad.title) + "'," +
      "'" + escapeSql(ad.body || '') + "'," +
      "'" + escapeSql(ad.cta_label || '') + "'," +
      "'" + escapeSql(ad.cta_url || '') + "'," +
      (ad.interests ? "'" + escapeSql(ad.interests) + "'" : "NULL") +
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
    var newStatus = remaining <= 0 ? "finished" : campaign.STATUS;
    if (remaining < 0) { remaining = 0; }

    var sql = "MERGE INTO CAMPAIGNS " +
      "(ID, CREATOR_ADDRESS, TITLE, BUDGET_TOTAL, BUDGET_REMAINING, " +
      "REWARD_VIEW, REWARD_CLICK, STATUS, CREATED_AT, EXPIRES_AT, " +
      "ESCROW_COINID, ESCROW_WALLET_PK, MAX_VIEWER_REWARD, " +
      "PUBLISHER_REWARD_VIEW, MAX_PUBLISHER_BUDGET, PUBLISHER_BUDGET_SPENT) KEY (ID) VALUES (" +
      "'" + escapeSql(campaign.ID) + "'," +
      "'" + escapeSql(campaign.CREATOR_ADDRESS) + "'," +
      "'" + escapeSql(campaign.TITLE) + "'," +
      campaign.BUDGET_TOTAL + "," +
      remaining + "," +
      campaign.REWARD_VIEW + "," +
      campaign.REWARD_CLICK + "," +
      "'" + escapeSql(newStatus) + "'," +
      campaign.CREATED_AT + "," +
      (campaign.EXPIRES_AT !== null && campaign.EXPIRES_AT !== undefined ? campaign.EXPIRES_AT : "NULL") + "," +
      "'" + escapeSql(campaign.ESCROW_COINID || '') + "'," +
      "'" + escapeSql(campaign.ESCROW_WALLET_PK || '') + "'," +
      (campaign.MAX_VIEWER_REWARD !== null && campaign.MAX_VIEWER_REWARD !== undefined ? parseFloat(campaign.MAX_VIEWER_REWARD) : "NULL") + "," +
      (campaign.PUBLISHER_REWARD_VIEW !== null && campaign.PUBLISHER_REWARD_VIEW !== undefined ? parseFloat(campaign.PUBLISHER_REWARD_VIEW) : 0) + "," +
      (campaign.MAX_PUBLISHER_BUDGET !== null && campaign.MAX_PUBLISHER_BUDGET !== undefined ? parseFloat(campaign.MAX_PUBLISHER_BUDGET) : 0) + "," +
      (campaign.PUBLISHER_BUDGET_SPENT !== null && campaign.PUBLISHER_BUDGET_SPENT !== undefined ? parseFloat(campaign.PUBLISHER_BUDGET_SPENT) : 0) +
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
