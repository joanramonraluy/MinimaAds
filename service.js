// T7 — Service Worker bootstrap (runtime entry, zip-root).
// Defines LIMITS and APP_NAME, loads core + handler files on `inited`,
// routes MDS events to handlers. Rhino-safe syntax: var, function(), no
// template literals, no arrow functions, no trailing commas.

var APP_NAME = 'minima-ads';

var LIMITS = {
  MAX_VIEWS_PER_CAMPAIGN_PER_DAY:  1,
  MAX_CLICKS_PER_CAMPAIGN_PER_DAY: 1,
  COOLDOWN_BETWEEN_REWARDS_MS:     30000,
  MIN_VIEW_DURATION_MS:            3000,
  MAX_CAMPAIGNS_PER_SESSION:       10,
  MIN_BUDGET:                      100,
  MIN_REWARD_VIEW:                 0.001,
  MIN_REWARD_CLICK:                0.005,
  MAX_CAMPAIGN_DAYS:               90,
  MIN_PUBLISHER_REWARD_VIEW:       0.001
};

// Node identity — set once in onInited after maxima action:info
var MY_MAXIMA_PK   = '';
var MY_MX_ADDRESS  = '';

// Escrow script address — deterministic, same for all nodes with this DApp
var ESCROW_ADDRESS    = '';
var ESCROW_ADDRESS_V2 = '';

// Tracks which escrow coinIds have already triggered a REQUEST to avoid re-asking
var _knownEscrowCoins = {};

// Timer tick counter for re-broadcast throttle (AGENTS.md §5.3)
var _timerTicks = 0;
var REBROADCAST_EVERY_TICKS = 60; // 60 × 10s = 600s = 10 min

var ESCROW_SCRIPT = 'LET creatorkey=PREVSTATE(1) ASSERT SIGNEDBY(creatorkey) LET payout=STATE(10) LET change=@AMOUNT-payout IF change GT 0 THEN ASSERT VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE) ENDIF RETURN TRUE';

var ESCROW_SCRIPT_V2 =
  "LET creatorkey=PREVSTATE(1) " +
  "ASSERT SIGNEDBY(creatorkey) " +
  "LET payout=STATE(10) " +
  "LET feeflag=STATE(11) " +
  "LET change=@AMOUNT-payout " +
  "IF feeflag EQ 1 THEN " +
  "LET platformkey=PREVSTATE(5) " +
  "LET feeamount=STATE(12) " +
  "ASSERT VERIFYOUT(STATE(13) platformkey feeamount @TOKENID FALSE) " +
  "ENDIF " +
  "IF change GT 0 THEN " +
  "ASSERT VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE) " +
  "ENDIF " +
  "RETURN TRUE";

function onInited() {
  MDS.log("[ADS] SW inited — loading modules");
  MDS.load("config.js");
  MDS.load("core/minima.js");
  MDS.load("core/campaigns.js");
  MDS.load("core/selection.js");
  MDS.load("core/validation.js");
  MDS.load("core/rewards.js");
  MDS.load("core/channels.js");
  MDS.load("core/frames.js");
  MDS.load("public/service-workers/db-init.js");
  MDS.load("public/service-workers/handlers/maxima.handler.js");
  MDS.load("public/service-workers/handlers/campaign.handler.js");
  MDS.load("public/service-workers/handlers/channel.handler.js");
  initDB(function() {
    MDS.keypair.get("PLATFORM_KEY_OVERRIDE", function(kpRes) {
      if (kpRes && kpRes.status && kpRes.value) {
        PLATFORM_KEY = kpRes.value;
        MDS.log("[ADS] PLATFORM_KEY overridden: " + PLATFORM_KEY);
      }
      _initAfterDb();
    });
  });
}

function _initAfterDb() {
  MDS.cmd("maxima action:info", function(resp) {
    if (!resp.status || !resp.response) {
      MDS.log("[ADS] maxima action:info failed: " + (resp.error || "no response") + " — retrying in 10s");
      return;
    }
    MY_MAXIMA_PK  = resp.response.publickey ? resp.response.publickey.toUpperCase() : "";
    MY_MX_ADDRESS = resp.response.contact || "";
    MDS.log("[ADS] Maxima PK: " + MY_MAXIMA_PK + " contact: " + MY_MX_ADDRESS);
    registerEscrowScript();
    MDS.cmd("getaddress", function(addrRes) {
      var walletAddr = (addrRes.status && addrRes.response && addrRes.response.address) ? addrRes.response.address : "";
      initBuiltinFrame(MY_MAXIMA_PK, walletAddr);
    });
  });
}

function registerEscrowScript() {
  MDS.cmd("newscript script:\"" + ESCROW_SCRIPT + "\" trackall:false", function(res) {
    if (!res.status) {
      MDS.log("[ADS] newscript failed: " + res.error);
      return;
    }
    ESCROW_ADDRESS = res.response.address;
    MDS.log("[ADS] ESCROW_ADDRESS: " + ESCROW_ADDRESS);
    MDS.keypair.set("ESCROW_ADDRESS", ESCROW_ADDRESS, function() {
      MDS.cmd("newscript script:\"" + ESCROW_SCRIPT_V2 + "\" trackall:false", function(res2) {
        if (!res2.status) {
          MDS.log("[ADS] newscript V2 failed: " + res2.error);
          scanEscrowCoins();
          return;
        }
        ESCROW_ADDRESS_V2 = res2.response.address;
        MDS.log("[ADS] ESCROW_ADDRESS_V2: " + ESCROW_ADDRESS_V2);
        scanEscrowCoins();
      });
    });
  });
}

function scanEscrowCoins() {
  _scanAddress(ESCROW_ADDRESS);
  _scanAddress(ESCROW_ADDRESS_V2);
}

function _scanAddress(addr) {
  if (!addr) { return; }
  MDS.cmd("coins address:" + addr, function(res) {
    if (!res.status || !res.response) { return; }
    var coins = res.response;
    if (coins.length > 0) {
      MDS.log("[DISCOVERY] escrow coins at " + addr.substring(0, 10) + "...: " + coins.length);
    }
    for (var i = 0; i < coins.length; i++) {
      processEscrowCoin(coins[i]);
    }
  });
}

function onTimer() {
  if (!ESCROW_ADDRESS) {
    MDS.log("[TIMER] ESCROW_ADDRESS not set — retrying init");
    MDS.cmd("maxima action:info", function(resp) {
      if (!resp.status || !resp.response) { return; }
      MY_MAXIMA_PK  = resp.response.publickey ? resp.response.publickey.toUpperCase() : "";
      MY_MX_ADDRESS = resp.response.contact || "";
      MDS.log("[ADS] Maxima PK (retry): " + MY_MAXIMA_PK);
      registerEscrowScript();
    });
    return;
  }
  _timerTicks++;
  if (_timerTicks >= REBROADCAST_EVERY_TICKS) {
    _timerTicks = 0;
    rebroadcastActiveCampaigns();
  }
}

function rebroadcastActiveCampaigns() {
  MDS.log("[TIMER] Re-broadcast active campaigns (not yet fully implemented)");
  if (typeof logPendingChannelState === "function") {
    logPendingChannelState();
  }
}

MDS.init(function(msg) {
  if (msg.event === "inited")              { onInited(); }
  if (msg.event === "MAXIMA")              { onMaxima(msg); }
  if (msg.event === "MDS_TIMER_10SECONDS") { onTimer(); }
  if (msg.event === "NEWBLOCK")            { scanEscrowCoins(); checkPendingVouchers(); }
  if (msg.event === "MDS_PENDING")         { onPending(msg); }
});
