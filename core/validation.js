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

    var now = Date.now();
    var dayAgo = now - 86400000;
    var viewSql = "SELECT COUNT(*) AS CNT FROM REWARD_EVENTS"
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
      if (count >= LIMITS.MAX_VIEWS_PER_CAMPAIGN_PER_DAY) {
        cb({ valid: false, reason: 'daily view limit reached' });
        return;
      }

      var profileSql = "SELECT LAST_REWARD_AT FROM USER_PROFILE"
        + " WHERE UPPER(ADDRESS) = UPPER('" + escapeSql(userAddress) + "')";

      sqlQuery(profileSql, function(err2, profileRows) {
        if (err2) {
          cb({ valid: false, reason: 'db error' });
          return;
        }
        if (profileRows && profileRows.length > 0) {
          var lastRewardAt = profileRows[0].LAST_REWARD_AT;
          if (lastRewardAt !== null && lastRewardAt !== undefined) {
            if (now - parseInt(lastRewardAt, 10) < LIMITS.COOLDOWN_BETWEEN_REWARDS_MS) {
              cb({ valid: false, reason: 'cooldown active' });
              return;
            }
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

    var now = Date.now();
    var dayAgo = now - 86400000;
    var clickSql = "SELECT COUNT(*) AS CNT FROM REWARD_EVENTS"
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
      if (count >= LIMITS.MAX_CLICKS_PER_CAMPAIGN_PER_DAY) {
        cb({ valid: false, reason: 'daily click limit reached' });
        return;
      }

      var profileSql = "SELECT LAST_REWARD_AT FROM USER_PROFILE"
        + " WHERE UPPER(ADDRESS) = UPPER('" + escapeSql(userAddress) + "')";

      sqlQuery(profileSql, function(err2, profileRows) {
        if (err2) {
          cb({ valid: false, reason: 'db error' });
          return;
        }
        if (profileRows && profileRows.length > 0) {
          var lastRewardAt = profileRows[0].LAST_REWARD_AT;
          if (lastRewardAt !== null && lastRewardAt !== undefined) {
            if (now - parseInt(lastRewardAt, 10) < LIMITS.COOLDOWN_BETWEEN_REWARDS_MS) {
              cb({ valid: false, reason: 'cooldown active' });
              return;
            }
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
