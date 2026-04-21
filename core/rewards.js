// T6 — Core: rewards.js
// createRewardEvent, getUserRewards, getUserProfile
// Rhino-compatible: var only, no arrow functions, no template literals.
// All DB access via sqlQuery(). No bare MDS.sql calls.

function _generateRewardId() {
  return Date.now().toString(16) + '-' + Math.floor(Math.random() * 0xFFFFFFFF).toString(16);
}

function createRewardEvent(params, cb) {
  var id = _generateRewardId();
  var timestamp = Date.now();
  var campaignId = params.campaign_id;
  var adId = params.ad_id;
  var userAddress = params.user_address;
  var type = params.type;
  var amount = parseFloat(params.amount);
  var publisherId = (params.publisher_id !== null && params.publisher_id !== undefined)
    ? params.publisher_id
    : null;

  isDuplicate(id, function(isDup) {
    if (isDup) {
      MDS.log("[REWARD] createRewardEvent: duplicate id " + id);
      cb(null, null);
      return;
    }

    var reSql = "MERGE INTO REWARD_EVENTS "
      + "(ID, CAMPAIGN_ID, AD_ID, USER_ADDRESS, TYPE, AMOUNT, TIMESTAMP, PUBLISHER_ID) "
      + "KEY (ID) VALUES ("
      + "'" + escapeSql(id) + "',"
      + "'" + escapeSql(campaignId) + "',"
      + "'" + escapeSql(adId) + "',"
      + "'" + escapeSql(userAddress) + "',"
      + "'" + escapeSql(type) + "',"
      + amount + ","
      + timestamp + ","
      + (publisherId ? "'" + escapeSql(publisherId) + "'" : "NULL")
      + ")";

    sqlQuery(reSql, function(err) {
      if (err) {
        MDS.log("[REWARD] createRewardEvent: REWARD_EVENTS error: " + err);
        cb(err, null);
        return;
      }

      var dedupSql = "MERGE INTO DEDUP_LOG (ID, LOGGED_AT) KEY (ID) VALUES ("
        + "'" + escapeSql(id) + "',"
        + timestamp
        + ")";

      sqlQuery(dedupSql, function(err2) {
        if (err2) {
          MDS.log("[REWARD] createRewardEvent: DEDUP_LOG error: " + err2);
          cb(err2, null);
          return;
        }

        updateBudget(campaignId, amount, function(err3) {
          if (err3) {
            MDS.log("[REWARD] createRewardEvent: updateBudget error: " + err3);
            cb(err3, null);
            return;
          }

          var profileSql = "SELECT TOTAL_EARNED, INTERESTS FROM USER_PROFILE"
            + " WHERE UPPER(ADDRESS) = UPPER('" + escapeSql(userAddress) + "')";

          sqlQuery(profileSql, function(err4, profileRows) {
            if (err4) {
              MDS.log("[REWARD] createRewardEvent: USER_PROFILE read error: " + err4);
              cb(err4, null);
              return;
            }

            var currentEarned = 0;
            var interests = null;
            if (profileRows && profileRows.length > 0) {
              currentEarned = parseFloat(profileRows[0].TOTAL_EARNED || 0);
              interests = (profileRows[0].INTERESTS !== null && profileRows[0].INTERESTS !== undefined)
                ? profileRows[0].INTERESTS
                : null;
            }

            var profileMergeSql = "MERGE INTO USER_PROFILE "
              + "(ADDRESS, INTERESTS, TOTAL_EARNED, LAST_REWARD_AT) KEY (ADDRESS) VALUES ("
              + "'" + escapeSql(userAddress) + "',"
              + (interests ? "'" + escapeSql(interests) + "'" : "NULL") + ","
              + (currentEarned + amount) + ","
              + timestamp
              + ")";

            sqlQuery(profileMergeSql, function(err5) {
              if (err5) {
                MDS.log("[REWARD] createRewardEvent: USER_PROFILE merge error: " + err5);
                cb(err5, null);
                return;
              }

              var rewardEvent = {
                id: id,
                campaign_id: campaignId,
                ad_id: adId,
                user_address: userAddress,
                type: type,
                amount: amount,
                timestamp: timestamp,
                publisher_id: publisherId
              };

              signalFE('REWARD_CONFIRMED', { event_id: id, amount: amount, type: type });
              cb(null, rewardEvent);
            });
          });
        });
      });
    });
  });
}

function getUserRewards(userAddress, cb) {
  var sql = "SELECT * FROM REWARD_EVENTS"
    + " WHERE UPPER(USER_ADDRESS) = UPPER('" + escapeSql(userAddress) + "')"
    + " ORDER BY TIMESTAMP DESC";
  sqlQuery(sql, function(err, rows) {
    if (err) {
      MDS.log("[REWARD] getUserRewards error: " + err);
      cb(err, null);
      return;
    }
    cb(null, rows || []);
  });
}

function getUserProfile(userAddress, cb) {
  var sql = "SELECT * FROM USER_PROFILE"
    + " WHERE UPPER(ADDRESS) = UPPER('" + escapeSql(userAddress) + "')";
  sqlQuery(sql, function(err, rows) {
    if (err) {
      MDS.log("[REWARD] getUserProfile error: " + err);
      cb(err, null);
      return;
    }
    cb(null, (rows && rows.length > 0) ? rows[0] : null);
  });
}
