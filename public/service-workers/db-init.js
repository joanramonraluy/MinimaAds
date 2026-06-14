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
    + "REWARD_VIEW            DECIMAL(20,6) NOT NULL,"
    + "REWARD_CLICK           DECIMAL(20,6) NOT NULL,"
    + "PUBLISHER_REWARD_VIEW  DECIMAL(20,6) NOT NULL DEFAULT 0,"
    + "MAX_PUBLISHER_BUDGET   DECIMAL(20,6) NOT NULL DEFAULT 0,"
    + "PUBLISHER_BUDGET_SPENT DECIMAL(20,6) NOT NULL DEFAULT 0,"
    + "STATUS           VARCHAR(32)   NOT NULL DEFAULT 'active',"
    + "CREATED_AT       BIGINT        NOT NULL,"
    + "EXPIRES_AT       BIGINT        DEFAULT NULL,"
    + "ESCROW_COINID    VARCHAR(66)   DEFAULT '',"
    + "ESCROW_WALLET_PK  VARCHAR(66)   DEFAULT '',"
    + "MAX_VIEWER_REWARD DECIMAL(20,6) DEFAULT NULL,"
    + "MAX_DAILY_VIEWS  INT           DEFAULT 100,"
    + "MAX_DAILY_CLICKS INT           DEFAULT 100,"
    + "COOLDOWN_MS      BIGINT        DEFAULT 300000,"
    + "CREATOR_MX       VARCHAR(1024) DEFAULT ''"
    + ")";

  var sql_ads = "CREATE TABLE IF NOT EXISTS ADS ("
    + "ID          VARCHAR(256)  PRIMARY KEY,"
    + "CAMPAIGN_ID VARCHAR(256)  NOT NULL,"
    + "TITLE       VARCHAR(512)  NOT NULL,"
    + "BODY        VARCHAR(2048),"
    + "CTA_LABEL   VARCHAR(128),"
    + "CTA_URL     VARCHAR(1024),"
    + "INTERESTS   VARCHAR(1024) DEFAULT NULL,"
    + "IMAGE_DATA  CLOB          DEFAULT NULL,"
    + "SHOW_TITLE  SMALLINT      DEFAULT 1,"
    + "SHOW_BODY   SMALLINT      DEFAULT 1,"
    + "SHOW_CTA    SMALLINT      DEFAULT 1,"
    + "BG_COLOR       VARCHAR(16)   DEFAULT '#ffffff',"
    + "TEXT_COLOR     VARCHAR(16)   DEFAULT '#111111',"
    + "IMAGE_POSITION  VARCHAR(32)   DEFAULT 'center',"
    + "IMAGE_ZOOM      FLOAT         DEFAULT 1.0,"
    + "IMAGE_WIDTH_PCT INT           DEFAULT 40"
    + ")";

  var sql_reward_events = "CREATE TABLE IF NOT EXISTS REWARD_EVENTS ("
    + "ID           VARCHAR(256)  PRIMARY KEY,"
    + "CAMPAIGN_ID  VARCHAR(256)  NOT NULL,"
    + "AD_ID        VARCHAR(256)  NOT NULL,"
    + "USER_ADDRESS VARCHAR(512)  NOT NULL,"
    + "TYPE         VARCHAR(16)   NOT NULL,"
    + "AMOUNT       DECIMAL(20,6) NOT NULL,"
    + "TIMESTAMP    BIGINT        NOT NULL,"
    + "PUBLISHER_ID VARCHAR(512)  DEFAULT NULL"
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

  var sql_frames = "CREATE TABLE IF NOT EXISTS FRAMES ("
    + "FRAME_ID         VARCHAR(512)  PRIMARY KEY,"
    + "PUBLISHER_KEY    VARCHAR(512)  NOT NULL,"
    + "PUBLISHER_WALLET VARCHAR(512)  DEFAULT '',"
    + "PUBLISHER_MX     VARCHAR(512)  DEFAULT '',"
    + "LABEL            VARCHAR(256)  DEFAULT '',"
    + "IS_BUILTIN       BOOLEAN       NOT NULL DEFAULT FALSE,"
    + "CREATED_AT       BIGINT        NOT NULL,"
    + "TOTAL_EARNED     DECIMAL(20,6) NOT NULL DEFAULT 0"
    + ")";

  var sql_channel_state = "CREATE TABLE IF NOT EXISTS CHANNEL_STATE ("
    + "CAMPAIGN_ID        VARCHAR(256)   NOT NULL,"
    + "VIEWER_KEY         VARCHAR(512)   NOT NULL,"
    + "ROLE               VARCHAR(16)    NOT NULL DEFAULT 'viewer',"
    + "FRAME_ID           VARCHAR(512)   DEFAULT '',"
    + "CREATOR_MX         VARCHAR(1024)  NOT NULL,"
    + "CHANNEL_COINID     VARCHAR(66)    DEFAULT '',"
    + "MAX_AMOUNT         DECIMAL(20,6)  NOT NULL,"
    + "CUMULATIVE_EARNED  DECIMAL(20,6)  NOT NULL DEFAULT 0,"
    + "LATEST_TX_HEX      TEXT           DEFAULT '',"
    + "STATUS             VARCHAR(16)    NOT NULL DEFAULT 'pending',"
    + "CREATED_AT         BIGINT         NOT NULL,"
    + "VIEWER_WALLET_ADDR VARCHAR(512)   DEFAULT '',"
    + "VIEWER_WALLET_PK   VARCHAR(512)   DEFAULT '',"
    + "PRIMARY KEY (CAMPAIGN_ID, VIEWER_KEY, ROLE)"
    + ")";

  var sql_deferred_pub_rewards = "CREATE TABLE IF NOT EXISTS DEFERRED_PUB_REWARDS ("
    + "ID              VARCHAR(96)   PRIMARY KEY,"
    + "CAMPAIGN_ID     VARCHAR(96)   NOT NULL,"
    + "FRAME_ID        VARCHAR(512)  NOT NULL,"
    + "VIEWER_EVENT_ID VARCHAR(64)   NOT NULL,"
    + "AMOUNT          DECIMAL(20,9) NOT NULL,"
    + "PUBLISHER_MX    VARCHAR(1024),"
    + "CREATED_AT      BIGINT        NOT NULL"
    + ")";

  var sql_channel_history = "CREATE TABLE IF NOT EXISTS CHANNEL_HISTORY ("
    + "CAMPAIGN_ID        VARCHAR(256)   NOT NULL,"
    + "VIEWER_KEY         VARCHAR(512)   NOT NULL,"
    + "ROLE               VARCHAR(16)    NOT NULL DEFAULT 'viewer',"
    + "CREATOR_MX         VARCHAR(1024)  NOT NULL DEFAULT '',"
    + "CHANNEL_COINID     VARCHAR(66)    DEFAULT '',"
    + "MAX_AMOUNT         DECIMAL(20,6)  NOT NULL,"
    + "CUMULATIVE_EARNED  DECIMAL(20,6)  NOT NULL DEFAULT 0,"
    + "STATUS             VARCHAR(16)    NOT NULL DEFAULT 'settled',"
    + "CREATED_AT         BIGINT         NOT NULL,"
    + "VIEWER_WALLET_ADDR VARCHAR(512)   DEFAULT '',"
    + "PRIMARY KEY (CAMPAIGN_ID, VIEWER_KEY, ROLE, CREATED_AT)"
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
        sqlQuery("ALTER TABLE REWARD_EVENTS ALTER COLUMN PUBLISHER_ID VARCHAR(512) DEFAULT NULL", function() {
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
            sqlQuery(sql_frames, function(err6) {
              if (err6) {
                MDS.log("[DB] initDB: failed to create FRAMES — " + err6);
                return;
              }
              sqlQuery(sql_channel_state, function(err7) {
                if (err7) {
                  MDS.log("[DB] initDB: failed to create CHANNEL_STATE — " + err7);
                  return;
                }
                sqlQuery("ALTER TABLE CHANNEL_STATE ALTER COLUMN VIEWER_KEY VARCHAR(512) NOT NULL", function() {
                  sqlQuery("ALTER TABLE FRAMES ADD COLUMN IF NOT EXISTS PUBLISHER_MX VARCHAR(512) DEFAULT ''", function() {
                    sqlQuery("ALTER TABLE CAMPAIGNS ADD COLUMN IF NOT EXISTS PUBLISHER_REWARD_VIEW DECIMAL(20,6) NOT NULL DEFAULT 0", function() {
                    sqlQuery("ALTER TABLE CAMPAIGNS ADD COLUMN IF NOT EXISTS MAX_PUBLISHER_BUDGET DECIMAL(20,6) NOT NULL DEFAULT 0", function() {
                    sqlQuery("ALTER TABLE CAMPAIGNS ADD COLUMN IF NOT EXISTS PUBLISHER_BUDGET_SPENT DECIMAL(20,6) NOT NULL DEFAULT 0", function() {
                    sqlQuery("ALTER TABLE CAMPAIGNS ADD COLUMN IF NOT EXISTS MAX_DAILY_VIEWS INT DEFAULT 100", function() {
                    sqlQuery("ALTER TABLE CAMPAIGNS ADD COLUMN IF NOT EXISTS MAX_DAILY_CLICKS INT DEFAULT 100", function() {
                    sqlQuery("ALTER TABLE CHANNEL_STATE ADD COLUMN IF NOT EXISTS SPLIT_COINID VARCHAR(66) DEFAULT ''", function() {
                    sqlQuery(sql_deferred_pub_rewards, function(dprErr) {
                      if (dprErr) { MDS.log("[DB] initDB: failed to create DEFERRED_PUB_REWARDS — " + dprErr); return; }
                    sqlQuery(sql_channel_history, function(chErr) {
                      if (chErr) { MDS.log("[DB] initDB: failed to create CHANNEL_HISTORY — " + chErr); return; }
                    sqlQuery("ALTER TABLE DEFERRED_PUB_REWARDS ADD COLUMN IF NOT EXISTS PUBLISHER_MX VARCHAR(1024) DEFAULT ''", function() {
                    sqlQuery("ALTER TABLE CHANNEL_STATE ADD COLUMN IF NOT EXISTS VIEWER_WALLET_PK VARCHAR(512) DEFAULT ''", function() {
                    sqlQuery("ALTER TABLE CAMPAIGNS ADD COLUMN IF NOT EXISTS COOLDOWN_MS BIGINT DEFAULT 300000", function() {
                    sqlQuery("ALTER TABLE CAMPAIGNS ADD COLUMN IF NOT EXISTS CREATOR_MX VARCHAR(1024) DEFAULT ''", function() {
                    sqlQuery("ALTER TABLE ADS ADD COLUMN IF NOT EXISTS IMAGE_DATA CLOB DEFAULT NULL", function() {
                    sqlQuery("ALTER TABLE ADS ADD COLUMN IF NOT EXISTS SHOW_TITLE SMALLINT DEFAULT 1", function() {
                    sqlQuery("ALTER TABLE ADS ADD COLUMN IF NOT EXISTS SHOW_BODY SMALLINT DEFAULT 1", function() {
                    sqlQuery("ALTER TABLE ADS ADD COLUMN IF NOT EXISTS SHOW_CTA SMALLINT DEFAULT 1", function() {
                    sqlQuery("ALTER TABLE ADS ADD COLUMN IF NOT EXISTS BG_COLOR VARCHAR(16) DEFAULT '#ffffff'", function() {
                    sqlQuery("ALTER TABLE ADS ADD COLUMN IF NOT EXISTS TEXT_COLOR VARCHAR(16) DEFAULT '#111111'", function() {
                    sqlQuery("ALTER TABLE ADS ADD COLUMN IF NOT EXISTS IMAGE_POSITION VARCHAR(32) DEFAULT 'center'", function() {
                    sqlQuery("ALTER TABLE ADS ADD COLUMN IF NOT EXISTS IMAGE_ZOOM FLOAT DEFAULT 1.0", function() {
                    sqlQuery("ALTER TABLE ADS ADD COLUMN IF NOT EXISTS IMAGE_WIDTH_PCT INT DEFAULT 40", function() {
                    sqlQuery("ALTER TABLE CAMPAIGNS ADD COLUMN IF NOT EXISTS VIEWER_BUDGET_SPENT DECIMAL(20,6) NOT NULL DEFAULT 0", function() {
                    sqlQuery("ALTER TABLE CAMPAIGNS ADD COLUMN IF NOT EXISTS PUBLISHER_BUDGET_EARNED DECIMAL(20,6) NOT NULL DEFAULT 0", function() {
                    sqlQuery("ALTER TABLE CHANNEL_STATE ADD COLUMN IF NOT EXISTS LAST_VOUCHER_AT BIGINT DEFAULT 0", function() {
                    sqlQuery("ALTER TABLE CHANNEL_STATE ADD COLUMN IF NOT EXISTS LAST_CLICK_VOUCHER_AT BIGINT DEFAULT 0", function() {
                    }); // end LAST_CLICK_VOUCHER_AT migration
                    }); // end LAST_VOUCHER_AT migration
                    }); // end PUBLISHER_BUDGET_EARNED migration
                    sqlQuery("UPDATE CAMPAIGNS SET MAX_PUBLISHER_BUDGET = PUBLISHER_REWARD_VIEW * 10 WHERE MAX_PUBLISHER_BUDGET <= 0 AND PUBLISHER_REWARD_VIEW > 0", function(patchErr) {
                      if (patchErr) { MDS.log("[DB] initDB: publisher budget patch failed — " + patchErr); }
                      else { MDS.log("[DB] initDB: stale MAX_PUBLISHER_BUDGET patched"); }
                      MDS.log("[DB] initDB: all tables ready");
                      signalFE("DB_READY", {});
                      if (cb) { cb(); }
                    }); // end publisher budget data migration
                    }); // end VIEWER_BUDGET_SPENT migration
                    }); // end IMAGE_WIDTH_PCT migration
                    }); // end IMAGE_ZOOM migration
                    }); // end IMAGE_POSITION migration
                    }); // end TEXT_COLOR migration
                    }); // end BG_COLOR migration
                    }); // end SHOW_CTA migration
                    }); // end SHOW_BODY migration
                    }); // end SHOW_TITLE migration
                    }); // end IMAGE_DATA migration
                    }); // end COOLDOWN_MS migration
                    }); // end CREATOR_MX migration
                    }); // end VIEWER_WALLET_PK migration
                    }); // end DEFERRED_PUB_REWARDS PUBLISHER_MX migration
                    }); // end CHANNEL_HISTORY creation
                    }); // end DEFERRED_PUB_REWARDS creation
                    }); // end SPLIT_COINID migration
                    }); // end MAX_DAILY_CLICKS migration
                    }); // end MAX_DAILY_VIEWS migration
                    }); // end PUBLISHER_BUDGET_SPENT migration
                    }); // end MAX_PUBLISHER_BUDGET migration
                    }); // end PUBLISHER_REWARD_VIEW migration
                  }); // end PUBLISHER_MX migration
                }); // end VIEWER_KEY migration
              });
            });
          });
        });
        }); // end ALTER TABLE migration callback
      });
    });
  });
}
