// T5 — Core: validation.js
// validateView, validateClick, isDuplicate — LIMITS enforcement.
// Rhino-compatible: var only, no arrow functions, no template literals.
// All limits read from LIMITS (global defined in main.js).
// All DB access via sqlQuery(). Creator self-reward check present in both validators.

function validateView(campaignId, userAddress, cb) {
  getCampaign(campaignId, function(err, campaign) {
    if (err) {
      cb({ valid: false, reason: 'db error' });
      return;
    }
    if (!campaign) {
      cb({ valid: false, reason: 'campaign not found' });
      return;
    }
    if (campaign.STATUS !== 'active') {
      cb({ valid: false, reason: 'campaign not active' });
      return;
    }
    if (parseFloat(campaign.BUDGET_REMAINING) < parseFloat(campaign.REWARD_VIEW)) {
      cb({ valid: false, reason: 'insufficient budget' });
      return;
    }
    if (campaign.CREATOR_ADDRESS.toUpperCase() === userAddress.toUpperCase()) {
      cb({ valid: false, reason: 'creator cannot earn from own campaign' });
      return;
    }

    var channelSql = "SELECT CUMULATIVE_EARNED, MAX_AMOUNT, STATUS FROM CHANNEL_STATE"
      + " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')"
      + " AND UPPER(VIEWER_KEY) = UPPER('" + escapeSql(userAddress) + "')"
      + " AND UPPER(ROLE) = 'VIEWER'";

    sqlQuery(channelSql, function(err, chRows) {
      if (err) {
        cb({ valid: false, reason: 'db error' });
        return;
      }
      if (chRows && chRows.length > 0) {
        var status = chRows[0].STATUS || '';
        if (status === 'open' || status === 'pending') {
          var cumulative = parseFloat(chRows[0].CUMULATIVE_EARNED) || 0;
          var maxAmount = parseFloat(chRows[0].MAX_AMOUNT) || 0;
          var reward = parseFloat(campaign.REWARD_VIEW) || 0;
          if (cumulative + reward > maxAmount) {
            cb({ valid: false, reason: 'campaign reward limit reached for this user' });
            return;
          }
        }
      }

      var now = Date.now();
      var dayAgo = now - 86400000;
      // Single query: daily count + last view timestamp for THIS campaign.
      // Cooldown is per-campaign: a reward from another campaign does not block
      // this one. USER_PROFILE.LAST_REWARD_AT is global and intentionally not
      // used here — it was causing cross-campaign cooldown interference.
      var viewSql = "SELECT COUNT(*) AS CNT, MAX(TIMESTAMP) AS LAST_AT FROM REWARD_EVENTS"
        + " WHERE UPPER(USER_ADDRESS) = UPPER('" + escapeSql(userAddress) + "')"
        + " AND UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')"
        + " AND TYPE = 'view'"
        + " AND TIMESTAMP > " + dayAgo;

      sqlQuery(viewSql, function(err, rows) {
        if (err) {
          cb({ valid: false, reason: 'db error' });
          return;
        }
        var count = (rows && rows[0]) ? parseInt(rows[0].CNT, 10) : 0;
        var limit = (campaign.MAX_DAILY_VIEWS !== null && campaign.MAX_DAILY_VIEWS !== undefined) ? parseInt(campaign.MAX_DAILY_VIEWS, 10) : LIMITS.MAX_VIEWS_PER_CAMPAIGN_PER_DAY;
        if (count >= limit) {
          cb({ valid: false, reason: 'daily view limit reached' });
          return;
        }
        var lastAt = (rows && rows[0] && rows[0].LAST_AT !== null && rows[0].LAST_AT !== undefined)
          ? parseInt(rows[0].LAST_AT, 10) : null;
        if (lastAt !== null) {
          var cooldown = (campaign.COOLDOWN_MS !== null && campaign.COOLDOWN_MS !== undefined)
            ? parseInt(campaign.COOLDOWN_MS, 10) : LIMITS.COOLDOWN_BETWEEN_REWARDS_MS;
          if (now - lastAt < cooldown) {
            cb({ valid: false, reason: 'cooldown active' });
            return;
          }
        }
        cb({ valid: true, reason: null });
      });
    });
  });
}

function validateClick(campaignId, userAddress, cb) {
  getCampaign(campaignId, function(err, campaign) {
    if (err) {
      cb({ valid: false, reason: 'db error' });
      return;
    }
    if (!campaign) {
      cb({ valid: false, reason: 'campaign not found' });
      return;
    }
    if (campaign.STATUS !== 'active') {
      cb({ valid: false, reason: 'campaign not active' });
      return;
    }
    if (parseFloat(campaign.BUDGET_REMAINING) < parseFloat(campaign.REWARD_CLICK)) {
      cb({ valid: false, reason: 'insufficient budget' });
      return;
    }
    if (campaign.CREATOR_ADDRESS.toUpperCase() === userAddress.toUpperCase()) {
      cb({ valid: false, reason: 'creator cannot earn from own campaign' });
      return;
    }

    var channelSql = "SELECT CUMULATIVE_EARNED, MAX_AMOUNT, STATUS FROM CHANNEL_STATE"
      + " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')"
      + " AND UPPER(VIEWER_KEY) = UPPER('" + escapeSql(userAddress) + "')"
      + " AND UPPER(ROLE) = 'VIEWER'";

    sqlQuery(channelSql, function(err, chRows) {
      if (err) {
        cb({ valid: false, reason: 'db error' });
        return;
      }
      if (chRows && chRows.length > 0) {
        var status = chRows[0].STATUS || '';
        if (status === 'open' || status === 'pending') {
          var cumulative = parseFloat(chRows[0].CUMULATIVE_EARNED) || 0;
          var maxAmount = parseFloat(chRows[0].MAX_AMOUNT) || 0;
          var reward = parseFloat(campaign.REWARD_CLICK) || 0;
          if (cumulative + reward > maxAmount) {
            cb({ valid: false, reason: 'campaign reward limit reached for this user' });
            return;
          }
        }
      }

      var now = Date.now();
      var dayAgo = now - 86400000;
      // Single query: daily count + last click timestamp for THIS campaign.
      // Cooldown is per-campaign (see validateView comment above).
      var clickSql = "SELECT COUNT(*) AS CNT, MAX(TIMESTAMP) AS LAST_AT FROM REWARD_EVENTS"
        + " WHERE UPPER(USER_ADDRESS) = UPPER('" + escapeSql(userAddress) + "')"
        + " AND UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')"
        + " AND TYPE = 'click'"
        + " AND TIMESTAMP > " + dayAgo;

      sqlQuery(clickSql, function(err, rows) {
        if (err) {
          cb({ valid: false, reason: 'db error' });
          return;
        }
        var count = (rows && rows[0]) ? parseInt(rows[0].CNT, 10) : 0;
        var limit = (campaign.MAX_DAILY_CLICKS !== null && campaign.MAX_DAILY_CLICKS !== undefined) ? parseInt(campaign.MAX_DAILY_CLICKS, 10) : LIMITS.MAX_CLICKS_PER_CAMPAIGN_PER_DAY;
        if (count >= limit) {
          cb({ valid: false, reason: 'daily click limit reached' });
          return;
        }
        var lastAt = (rows && rows[0] && rows[0].LAST_AT !== null && rows[0].LAST_AT !== undefined)
          ? parseInt(rows[0].LAST_AT, 10) : null;
        if (lastAt !== null) {
          var cooldown = (campaign.COOLDOWN_MS !== null && campaign.COOLDOWN_MS !== undefined)
            ? parseInt(campaign.COOLDOWN_MS, 10) : LIMITS.COOLDOWN_BETWEEN_REWARDS_MS;
          if (now - lastAt < cooldown) {
            cb({ valid: false, reason: 'cooldown active' });
            return;
          }
        }
        cb({ valid: true, reason: null });
      });
    });
  });
}

function isDuplicate(eventId, cb) {
  var sql = "SELECT COUNT(*) AS CNT FROM DEDUP_LOG"
    + " WHERE UPPER(ID) = UPPER('" + escapeSql(eventId) + "')";
  sqlQuery(sql, function(err, rows) {
    if (err) {
      MDS.log("[VALIDATION] isDuplicate db error for eventId: " + eventId);
      cb(false);
      return;
    }
    var count = (rows && rows[0]) ? parseInt(rows[0].CNT, 10) : 0;
    cb(count > 0);
  });
}
