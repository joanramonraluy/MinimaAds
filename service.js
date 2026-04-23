// T7 — Service Worker bootstrap (runtime entry, zip-root).
// Mirror of public/service-workers/main.js.
// Defines LIMITS and APP_NAME, loads core + handler files on `inited`,
// routes MDS events to handlers. Rhino-safe syntax: var, function(), no
// template literals, no arrow functions, no trailing commas.

var APP_NAME = 'minima-ads';

var LIMITS = {
  MAX_VIEWS_PER_CAMPAIGN_PER_DAY:  1,
  MAX_CLICKS_PER_CAMPAIGN_PER_DAY: 1,
  COOLDOWN_BETWEEN_REWARDS_MS:     30000,
  MIN_VIEW_DURATION_MS:            3000,
  MAX_CAMPAIGNS_PER_SESSION:       10
};

// Node identity — set once in onInited after maxima action:info
var MY_MAXIMA_PK   = '';
var MY_MX_ADDRESS  = '';

// Escrow script address — deterministic, same for all nodes with this DApp
var ESCROW_ADDRESS = '';

// Tracks which escrow coinIds have already triggered a REQUEST to avoid re-asking
var _knownEscrowCoins = {};

// Timer tick counter for re-broadcast throttle (AGENTS.md §5.3)
var _timerTicks = 0;
var REBROADCAST_EVERY_TICKS = 60; // 60 × 10s = 600s = 10 min

var ESCROW_SCRIPT = 'LET creatorkey=PREVSTATE(1) ASSERT SIGNEDBY(creatorkey) LET payout=STATE(10) LET change=@AMOUNT-payout IF change GT 0 THEN ASSERT VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE) ENDIF RETURN TRUE';

function onInited() {
  MDS.log("[ADS] SW inited — loading modules");
  MDS.load("core/minima.js");
  MDS.load("core/campaigns.js");
  MDS.load("core/selection.js");
  MDS.load("core/validation.js");
  MDS.load("core/rewards.js");
  MDS.load("public/service-workers/db-init.js");
  MDS.load("public/service-workers/handlers/maxima.handler.js");
  MDS.load("public/service-workers/handlers/campaign.handler.js");
  initDB(function() {
    MDS.cmd("maxima action:info", function(resp) {
      if (!resp.status || !resp.response) {
        MDS.log("[ADS] maxima action:info failed: " + (resp.error || "no response") + " — retrying in 10s");
        return;
      }
      MY_MAXIMA_PK  = resp.response.publickey ? resp.response.publickey.toUpperCase() : "";
      MY_MX_ADDRESS = resp.response.contact || "";
      MDS.log("[ADS] Maxima PK: " + MY_MAXIMA_PK + " contact: " + MY_MX_ADDRESS);
      registerEscrowScript();
    });
  });
}

function registerEscrowScript() {
  MDS.cmd("newscript script:\"" + ESCROW_SCRIPT + "\" trackall:true", function(res) {
    if (!res.status) {
      MDS.log("[ADS] newscript failed: " + res.error);
      return;
    }
    ESCROW_ADDRESS = res.response.address;
    MDS.log("[ADS] ESCROW_ADDRESS: " + ESCROW_ADDRESS);
    MDS.keypair.set("ESCROW_ADDRESS", ESCROW_ADDRESS, function() {
      scanEscrowCoins();
    });
  });
}

function scanEscrowCoins() {
  if (!ESCROW_ADDRESS) { return; }
  MDS.cmd("coins relevant:true address:" + ESCROW_ADDRESS, function(res) {
    if (!res.status || !res.response) {
      MDS.log("[DISCOVERY] coins query failed or empty response");
      return;
    }
    var coins = res.response;
    MDS.log("[DISCOVERY] escrow coins found: " + coins.length);
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
}

MDS.init(function(msg) {
  if (msg.event === "inited")              { onInited(); }
  if (msg.event === "MAXIMA")              { onMaxima(msg); }
  if (msg.event === "MDS_TIMER_10SECONDS") { onTimer(); }
  if (msg.event === "NEWBLOCK")            { scanEscrowCoins(); }
  if (msg.event === "MDS_PENDING")         { onPending(msg); }
});
