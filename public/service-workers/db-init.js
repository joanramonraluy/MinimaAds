// T1 — DB Schema
// Called from onInited() in main.js after core files are loaded.
// All DB access via sqlQuery() from core/minima.js — no bare MDS.sql.

function initDB(cb) {
  var sql_campaigns = "CREATE TABLE IF NOT EXISTS CAMPAIGNS ("
    + "ID               VARCHAR(256)  PRIMARY KEY,"
    + "CREATOR_ADDRESS  VARCHAR(512)  NOT NULL,"
    + "TITLE            VARCHAR(512)  NOT NULL,"
    + "BUDGET_TOTAL     DECIMAL(20,6) NOT NULL,"
    + "BUDGET_REMAINING DECIMAL(20,6) NOT NULL,"
    + "REWARD_VIEW      DECIMAL(20,6) NOT NULL,"
    + "REWARD_CLICK     DECIMAL(20,6) NOT NULL,"
    + "STATUS           VARCHAR(32)   NOT NULL DEFAULT 'active',"
    + "CREATED_AT       BIGINT        NOT NULL,"
    + "EXPIRES_AT       BIGINT        DEFAULT NULL,"
    + "ESCROW_COINID    VARCHAR(66)   DEFAULT '',"
    + "ESCROW_WALLET_PK VARCHAR(66)   DEFAULT ''"
    + ")";

  var sql_ads = "CREATE TABLE IF NOT EXISTS ADS ("
    + "ID          VARCHAR(256)  PRIMARY KEY,"
    + "CAMPAIGN_ID VARCHAR(256)  NOT NULL,"
    + "TITLE       VARCHAR(512)  NOT NULL,"
    + "BODY        VARCHAR(2048),"
    + "CTA_LABEL   VARCHAR(128),"
    + "CTA_URL     VARCHAR(1024),"
    + "INTERESTS   VARCHAR(1024) DEFAULT NULL"
    + ")";

  var sql_reward_events = "CREATE TABLE IF NOT EXISTS REWARD_EVENTS ("
    + "ID           VARCHAR(256)  PRIMARY KEY,"
    + "CAMPAIGN_ID  VARCHAR(256)  NOT NULL,"
    + "AD_ID        VARCHAR(256)  NOT NULL,"
    + "USER_ADDRESS VARCHAR(512)  NOT NULL,"
    + "TYPE         VARCHAR(16)   NOT NULL,"
    + "AMOUNT       DECIMAL(20,6) NOT NULL,"
    + "TIMESTAMP    BIGINT        NOT NULL,"
    + "PUBLISHER_ID VARCHAR(256)  DEFAULT NULL"
    + ")";

  var sql_user_profile = "CREATE TABLE IF NOT EXISTS USER_PROFILE ("
    + "ADDRESS        VARCHAR(512)  PRIMARY KEY,"
    + "INTERESTS      VARCHAR(1024) DEFAULT NULL,"
    + "TOTAL_EARNED   DECIMAL(20,6) NOT NULL DEFAULT 0,"
    + "LAST_REWARD_AT BIGINT        DEFAULT NULL"
    + ")";

  var sql_dedup_log = "CREATE TABLE IF NOT EXISTS DEDUP_LOG ("
    + "ID        VARCHAR(256) PRIMARY KEY,"
    + "LOGGED_AT BIGINT       NOT NULL"
    + ")";

  var sql_channel_state = "CREATE TABLE IF NOT EXISTS CHANNEL_STATE ("
    + "CAMPAIGN_ID       VARCHAR(256)   NOT NULL,"
    + "VIEWER_KEY        VARCHAR(66)    NOT NULL,"
    + "CREATOR_MX        VARCHAR(512)   NOT NULL,"
    + "CHANNEL_COINID    VARCHAR(66)    DEFAULT '',"
    + "MAX_AMOUNT        DECIMAL(20,6)  NOT NULL,"
    + "CUMULATIVE_EARNED DECIMAL(20,6)  NOT NULL DEFAULT 0,"
    + "LATEST_TX_HEX     TEXT           DEFAULT '',"
    + "STATUS            VARCHAR(16)    NOT NULL DEFAULT 'pending',"
    + "CREATED_AT        BIGINT         NOT NULL,"
    + "PRIMARY KEY (CAMPAIGN_ID, VIEWER_KEY)"
    + ")";

  sqlQuery(sql_campaigns, function(err) {
    if (err) {
      MDS.log("[DB] initDB: failed to create CAMPAIGNS — " + err);
      return;
    }
    sqlQuery(sql_ads, function(err2) {
      if (err2) {
        MDS.log("[DB] initDB: failed to create ADS — " + err2);
        return;
      }
      sqlQuery(sql_reward_events, function(err3) {
        if (err3) {
          MDS.log("[DB] initDB: failed to create REWARD_EVENTS — " + err3);
          return;
        }
        sqlQuery(sql_user_profile, function(err4) {
          if (err4) {
            MDS.log("[DB] initDB: failed to create USER_PROFILE — " + err4);
            return;
          }
          sqlQuery(sql_dedup_log, function(err5) {
            if (err5) {
              MDS.log("[DB] initDB: failed to create DEDUP_LOG — " + err5);
              return;
            }
            sqlQuery(sql_channel_state, function(err6) {
              if (err6) {
                MDS.log("[DB] initDB: failed to create CHANNEL_STATE — " + err6);
                return;
              }
              MDS.log("[DB] initDB: all tables ready");
              signalFE("DB_READY", {});
              if (cb) { cb(); }
            });
          });
        });
      });
    });
  });
}
