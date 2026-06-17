// T7 — Service Worker bootstrap (runtime entry, zip-root).
// Defines LIMITS and APP_NAME, loads core + handler files on `inited`,
// routes MDS events to handlers. Rhino-safe syntax: var, function(), no
// template literals, no arrow functions, no trailing commas.

var APP_NAME = 'minima-ads';

var LIMITS = {
  MAX_VIEWS_PER_CAMPAIGN_PER_DAY:  100,
  MAX_CLICKS_PER_CAMPAIGN_PER_DAY: 100,
  COOLDOWN_BETWEEN_REWARDS_MS:     30000,
  MIN_VIEW_DURATION_MS:            3000,
  MAX_CAMPAIGNS_PER_SESSION:       10,
  MIN_BUDGET:                      100,
  MIN_REWARD_VIEW:                 0.001,
  MIN_REWARD_CLICK:                0.005,
  MAX_CAMPAIGN_DAYS:               90,
  MIN_PUBLISHER_REWARD_VIEW:       0.001,
  // Maximum Minima a viewer channel may reserve in a single CHANNEL_OPEN_REQUEST.
  // Prevents a single attacker channel from pre-reserving the entire campaign budget.
  MAX_CHANNEL_RESERVATION:         10
};

// Node identity — set once in onInited after maxima action:info
var MY_MAXIMA_PK   = '';
var MY_MX_ADDRESS  = '';
var MY_ADDRESS     = '';

// Liveness-check throttle: run checkCampaignStatuses every 20 blocks (~5 min)
var _livenessCheckBlock = 0;

// Escrow script address — deterministic, same for all nodes with this DApp
var ESCROW_ADDRESS    = '';
var ESCROW_ADDRESS_V3 = '';
var ESCROW_ADDRESS_V4 = '';

// Channel script: time-locked creator-only exit OR 2-of-2 MULTISIG(creator, viewer/publisher)
var CHANNEL_SCRIPT         = 'IF @COINAGE GT (40*1728) AND SIGNEDBY(PREVSTATE(1)) THEN RETURN TRUE ENDIF RETURN MULTISIG(2 PREVSTATE(1) PREVSTATE(2))';
var CHANNEL_SCRIPT_ADDRESS = '';

// Tracks escrow coinIds whose campaign is already in the local DB (no further action needed).
// Only set once the campaign is confirmed present. Coins for unknown campaigns are NOT cached
// here so REQUEST_CAMPAIGN_DATA can be retried on subsequent NEWBLOCKs.
var _knownEscrowCoins = {};

// Per-session escrow address scan flags (Change #3 perf).
// _escrowHasCoins[addr]=true  → coins were found at this address at some point this session.
// _escrowScanned[addr]=true   → at least one scan completed for this address this session.
// Legacy addresses (V? / V3) are skipped once confirmed empty for the session.
var _escrowHasCoins = {};
var _escrowScanned  = {};

// Rate-limits REQUEST_CAMPAIGN_DATA retries for unknown campaigns.
// Maps campaignId -> timestamp of last send. Retries at most once every 30 s.
var _pendingCampaignRequests = {};

// Prevents overlapping scanEscrowCoins calls (startup vs NEWBLOCK) that cause duplicate REQUEST_CAMPAIGN_DATA.
var _scanInFlight = false;

var ESCROW_SCRIPT = 'LET creatorkey=PREVSTATE(1) ASSERT SIGNEDBY(creatorkey) LET payout=STATE(10) LET change=@AMOUNT-payout IF change GT 0 THEN ASSERT VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE) ENDIF RETURN TRUE';

var ESCROW_SCRIPT_V3 =
  "LET creatorkey=PREVSTATE(1) " +
  "LET platformkey=PREVSTATE(5) " +
  "LET maxpubbudget=PREVSTATE(6) " +
  "LET status=PREVSTATE(7) " +
  "ASSERT SIGNEDBY(creatorkey) " +
  "LET payout=STATE(10) " +
  "LET feeflag=STATE(11) " +
  "LET change=@AMOUNT-payout " +
  "IF feeflag EQ 1 THEN " +
  "LET feeamount=STATE(12) " +
  "ASSERT VERIFYOUT(STATE(13) platformkey feeamount @TOKENID FALSE) " +
  "ENDIF " +
  "IF change GT 0 THEN " +
  "ASSERT VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE) " +
  "ENDIF " +
  "RETURN TRUE";

// V4 — adds the Minima Foundation fee branch. FOUNDATION_KEY at PREVSTATE(6),
// foundation fee amount at STATE(14), foundation fee output index at STATE(15),
// foundation fee flag at STATE(16). Byte-identical to the FE constant in creator.js.
var ESCROW_SCRIPT_V4 =
  "LET creatorkey=PREVSTATE(1) " +
  "LET platformkey=PREVSTATE(5) " +
  "LET foundationkey=PREVSTATE(6) " +
  "LET status=PREVSTATE(7) " +
  "ASSERT SIGNEDBY(creatorkey) " +
  "LET payout=STATE(10) " +
  "LET feeflag=STATE(11) " +
  "LET foundationfeeflag=STATE(16) " +
  "LET change=@AMOUNT-payout " +
  "IF feeflag EQ 1 THEN " +
  "LET feeamount=STATE(12) " +
  "ASSERT VERIFYOUT(STATE(13) platformkey feeamount @TOKENID FALSE) " +
  "ENDIF " +
  "IF foundationfeeflag EQ 1 THEN " +
  "LET foundationfeeamount=STATE(14) " +
  "ASSERT VERIFYOUT(STATE(15) foundationkey foundationfeeamount @TOKENID FALSE) " +
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
  MDS.load("public/service-workers/handlers/comms.handler.js");
  initDB(function() {
    MDS.keypair.get("CREATOR_PERMANENT_ROUTE", function(oldRes) {
      var oldRoute = (oldRes && oldRes.status && oldRes.value) ? oldRes.value : "";
      if (oldRoute) {
        MDS.log("[MIGRATION] Migrating CREATOR_PERMANENT_ROUTE to USER_PERMANENT_ROUTE");
        MDS.keypair.set("USER_PERMANENT_ROUTE", oldRoute, function() {
          MDS.keypair.set("CREATOR_PERMANENT_ROUTE", "", function() {
            proceedBootstrap();
          });
        });
      } else {
        proceedBootstrap();
      }
    });

    function proceedBootstrap() {
      MDS.keypair.get("PLATFORM_KEY_OVERRIDE", function(kpRes) {
        if (kpRes && kpRes.status && kpRes.value) {
          var pkVal = kpRes.value;
          if (typeof isHexKey === "function" && !isHexKey(pkVal)) {
            MDS.log("[ADS] Invalid/malformed PLATFORM_KEY_OVERRIDE detected (" + pkVal + "), clearing");
            MDS.keypair.set("PLATFORM_KEY_OVERRIDE", "", function() {});
          } else {
            PLATFORM_KEY = pkVal;
            MDS.log("[ADS] PLATFORM_KEY overridden: " + PLATFORM_KEY);
          }
        }
        MDS.keypair.get("FOUNDATION_KEY_OVERRIDE", function(fkRes) {
          if (fkRes && fkRes.status && fkRes.value) {
            var fkVal = fkRes.value;
            if (typeof isHexKey === "function" && !isHexKey(fkVal)) {
              MDS.log("[ADS] Invalid/malformed FOUNDATION_KEY_OVERRIDE detected (" + fkVal + "), clearing");
              MDS.keypair.set("FOUNDATION_KEY_OVERRIDE", "", function() {});
            } else {
              FOUNDATION_KEY = fkVal;
              MDS.log("[ADS] FOUNDATION_KEY overridden: " + FOUNDATION_KEY);
            }
          }
        MDS.keypair.get("MINIMAADS_CREATOR_ROUTE", function(routeRes) {
          var creatorRoute = (routeRes && routeRes.status && routeRes.value) ? routeRes.value : "";
          if (creatorRoute) {
            var routeParts = creatorRoute.split("#");
            if (routeParts.length === 3 && routeParts[0] === "MAX") {
              MINIMAADS_CREATOR_PK = normalizePublicKey(routeParts[1]);
            }
          }
          MDS.keypair.get("USER_PERMANENT_ROUTE", function(permRes) {
            var permRoute = (permRes && permRes.status && permRes.value) ? permRes.value : "";
            MDS.keypair.get("MLS_SERVER_ADDRESS", function(mlsRes) {
              var mlsAddr = (mlsRes && mlsRes.status && mlsRes.value) ? mlsRes.value : "";
              MDS.log("[CONFIG] =========== NODE CONFIGURATION ===========");
              MDS.log("[CONFIG] PLATFORM_KEY:             " + (PLATFORM_KEY || "(not set — config.js default null)"));
              MDS.log("[CONFIG] FOUNDATION_KEY:           " + (FOUNDATION_KEY || "(not set — config.js default null)"));
              MDS.log("[CONFIG] MINIMAADS_CREATOR_ROUTE:  " + (creatorRoute || "(not set)"));
              MDS.log("[CONFIG] MINIMAADS_CREATOR_PK:     " + (MINIMAADS_CREATOR_PK ? MINIMAADS_CREATOR_PK.substring(0, 30) + "..." : "(from config.js: " + (MINIMAADS_CREATOR_PK ? MINIMAADS_CREATOR_PK.substring(0, 20) : "null") + ")"));
              MDS.log("[CONFIG] USER_PERMANENT_ROUTE:     " + (permRoute || "(not set)"));
              MDS.log("[CONFIG] MLS_SERVER_ADDRESS:       " + (mlsAddr || "(not set)"));
              MDS.log("[CONFIG] =============================================");
              _initAfterDb();
            });
          });
        });
        });
      });
    }
  });
}

function _initAfterDb() {
  MDS.cmd("maxima action:info", function(resp) {
    if (!resp.status || !resp.response) {
      MDS.log("[ADS] maxima action:info failed: " + (resp.error || "no response") + " — retrying in 10s");
      return;
    }
    MY_MAXIMA_PK  = resp.response.publickey ? normalizePublicKey(resp.response.publickey) : "";
    MY_MX_ADDRESS = resp.response.contact || "";
    MDS.log("[ADS] Maxima PK: " + MY_MAXIMA_PK + " contact: " + MY_MX_ADDRESS);

    // Auto-sync Platform Creator Route on boot if this node is the Platform Creator
    if (MY_MAXIMA_PK && normalizePublicKey(MY_MAXIMA_PK) === normalizePublicKey(MINIMAADS_CREATOR_PK)) {
      MDS.keypair.get("USER_PERMANENT_ROUTE", function(permRes) {
        var permRoute = (permRes && permRes.status && permRes.value) ? permRes.value : "";
        if (permRoute) {
          MDS.keypair.get("MINIMAADS_CREATOR_ROUTE", function(curCrRes) {
            var curCrRoute = (curCrRes && curCrRes.status && curCrRes.value) ? curCrRes.value : "";
            if (curCrRoute !== permRoute) {
              MDS.log("[CONFIG] Auto-syncing MINIMAADS_CREATOR_ROUTE with USER_PERMANENT_ROUTE for Platform Creator");
              MDS.keypair.set("MINIMAADS_CREATOR_ROUTE", permRoute, function() {});
            }
          });
        }
      });
    }

    registerEscrowScript();
    MDS.cmd("getaddress", function(addrRes) {
      var walletAddr = (addrRes.status && addrRes.response && addrRes.response.address) ? addrRes.response.address : "";
      MY_ADDRESS = walletAddr;
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
      MDS.cmd("newscript script:\"" + ESCROW_SCRIPT_V3 + "\" trackall:false", function(resV3) {
          if (!resV3.status) {
            MDS.log("[ADS] newscript V3 failed: " + resV3.error);
          } else {
            ESCROW_ADDRESS_V3 = resV3.response.address;
            MDS.log("[ADS] ESCROW_ADDRESS_V3: " + ESCROW_ADDRESS_V3);
            MDS.keypair.set("ESCROW_ADDRESS_V3", ESCROW_ADDRESS_V3, function() {});
          }
          MDS.cmd("newscript script:\"" + ESCROW_SCRIPT_V4 + "\" trackall:false", function(resV4) {
            if (!resV4.status) {
              MDS.log("[ADS] newscript V4 failed: " + resV4.error);
            } else {
              ESCROW_ADDRESS_V4 = resV4.response.address;
              MDS.log("[ADS] ESCROW_ADDRESS_V4: " + ESCROW_ADDRESS_V4);
              MDS.keypair.set("ESCROW_ADDRESS_V4", ESCROW_ADDRESS_V4, function() {});
            }
          MDS.cmd("newscript script:\"" + CHANNEL_SCRIPT + "\" trackall:false", function(res3) {
            if (res3 && res3.status && res3.response && res3.response.address) {
              CHANNEL_SCRIPT_ADDRESS = res3.response.address;
              MDS.keypair.set("CHANNEL_SCRIPT_ADDRESS", CHANNEL_SCRIPT_ADDRESS, function() {});
              MDS.log("[ADS] CHANNEL_SCRIPT_ADDRESS: " + CHANNEL_SCRIPT_ADDRESS);
            } else {
              MDS.log("[ADS] CHANNEL_SCRIPT newscript failed — will fallback to keypair");
              MDS.keypair.get("CHANNEL_SCRIPT_ADDRESS", function(kpRes) {
                if (kpRes && kpRes.status && kpRes.value) {
                  CHANNEL_SCRIPT_ADDRESS = kpRes.value;
                  MDS.log("[ADS] CHANNEL_SCRIPT_ADDRESS from keypair: " + CHANNEL_SCRIPT_ADDRESS);
                }
              });
            }
            scanEscrowCoins();
          });
        });
      });
    });
  });
}

function scanEscrowCoins() {
  if (_scanInFlight) { return; }
  _scanInFlight = true;

  var pending = 0;

  function onScanDone() {
    pending--;
    if (pending === 0) {
      _scanInFlight = false;
    }
  }

  // V4 is the current active version — always scan.
  pending++;
  _scanAddress(ESCROW_ADDRESS_V4, onScanDone);

  // Legacy addresses: scan until confirmed empty for this session, then skip.
  // _escrowScanned[addr]=true means at least one scan completed. If coins were
  // never found there, no need to keep scanning (new campaigns always use V4).
  if (ESCROW_ADDRESS    && (!_escrowScanned[ESCROW_ADDRESS]    || _escrowHasCoins[ESCROW_ADDRESS])) {
    pending++;
    _scanAddress(ESCROW_ADDRESS, onScanDone);
  }
  if (ESCROW_ADDRESS_V3 && (!_escrowScanned[ESCROW_ADDRESS_V3] || _escrowHasCoins[ESCROW_ADDRESS_V3])) {
    pending++;
    _scanAddress(ESCROW_ADDRESS_V3, onScanDone);
  }
}

// _checkChannelCoinsOnBlock — performs ONE coins address:CHANNEL_SCRIPT_ADDRESS
// scan per NEWBLOCK and passes the result to both checkPendingVouchers and
// checkOpenChannelsSettled, eliminating up to K+1 redundant scans per block.
function _checkChannelCoinsOnBlock() {
  var chAddr = CHANNEL_SCRIPT_ADDRESS || '';
  if (!chAddr) {
    checkPendingVouchers(null);
    checkOpenChannelsSettled(null);
    return;
  }
  MDS.cmd("coins address:" + chAddr, function(cRes) {
    var coins = (cRes && cRes.status && cRes.response) ? cRes.response : [];
    checkPendingVouchers(coins);
    checkOpenChannelsSettled(coins);
  });
}

function _scanAddress(addr, onDone) {
  if (!addr) { if (onDone) { onDone(); } return; }
  MDS.cmd("coins address:" + addr, function(res) {
    if (!res.status || !res.response) { _escrowScanned[addr] = true; if (onDone) { onDone(); } return; }
    var coins = res.response;
    _escrowScanned[addr] = true;
    if (coins.length > 0) {
      _escrowHasCoins[addr] = true;
      MDS.log("[DISCOVERY] escrow coins at " + addr.substring(0, 10) + "...: " + coins.length);
      for (var i = 0; i < coins.length; i++) {
        processEscrowCoin(coins[i]);
      }
    }
    if (onDone) { onDone(); }
  });
}

function onComms(msg) {
  var raw = msg.data && msg.data.message ? msg.data.message : null;
  if (!raw) { return; }
  var payload = null;
  try { payload = JSON.parse(raw); } catch (e) { return; }
  if (payload.type === "MA_PING") {
    MDS.log("[COMMS] MA_PING from " + (msg.data.minidapp || "?") + " — sending MA_PONG");
    MDS.comms.broadcast(JSON.stringify({type: "MA_PONG", ok: true}), function() {});
  } else if (payload.type === "MA_GET_AD") {
    handleGetAd(payload);
  } else if (payload.type === "MA_TRACK_VIEW") {
    handleTrackView(payload);
  } else if (payload.type === "MA_TRACK_CLICK") {
    handleTrackClick(payload);
  } else if (payload.type === "MA_LOCAL_STATUS") {
    handleLocalStatusChange(payload);
  } else if (payload.type === "DO_REGISTER_PERMANENT") {
    handleRegisterPermanent(payload);
  }
}

function handleRegisterPermanent(payload) {
  if (!payload.publickey) {
    MDS.log("[SW] DO_REGISTER_PERMANENT: missing publickey");
    return;
  }
  var pubkey = payload.publickey;
  var requesterContact = payload.requester_contact || '';
  MDS.log("[SW] DO_REGISTER_PERMANENT received for key: " + pubkey.substring(0, 20) + "... requester: " + (requesterContact ? requesterContact.substring(0, 30) + "..." : "unknown"));

  MDS.keypair.get("MLS_SERVER_ADDRESS", function(res) {
    var mlsAddr = (res && res.status && res.value) ? res.value : null;
    if (!mlsAddr) {
      MDS.log("[SW] DO_REGISTER_PERMANENT: no MLS_SERVER_ADDRESS configured");
      return;
    }

    var myContact = MY_MX_ADDRESS || '';
    MDS.log("[SW] DO_REGISTER_PERMANENT: MY contact=" + myContact.substring(0, 60));
    MDS.log("[SW] DO_REGISTER_PERMANENT: MLS address=" + mlsAddr.substring(0, 60));
    var isSelf = myContact && mlsAddr && myContact.substring(0, 60) === mlsAddr.substring(0, 60);

    if (isSelf) {
      MDS.log("[SW] DO_REGISTER_PERMANENT: MLS is self, executing locally");
      MDS.cmd("maxextra action:addpermanent publickey:" + pubkey, function(cmdRes) {
        MDS.log("[SW] DO_REGISTER_PERMANENT: local execution ok=" + cmdRes.status);
      });
    } else {
      MDS.log("[SW] DO_REGISTER_PERMANENT: sending request to MLS");
      var registerReq = {
        type: "REGISTER_PERMANENT_REQUEST",
        publickey: pubkey,
        requester_contact: requesterContact
      };

      sendMaxima(null, mlsAddr, registerReq, function(ok) {
        MDS.log("[SW] DO_REGISTER_PERMANENT: request sent to MLS, ok=" + ok);
      });
    }
  });
}

MDS.init(function(msg) {
  if (msg.event === "inited")   { onInited(); }
  if (msg.event === "MAXIMA")   { onMaxima(msg); }
  if (msg.event === "NEWBLOCK") {
    scanEscrowCoins(); checkPendingChannelOpens(); checkExpiredCampaigns(); _checkChannelCoinsOnBlock(); pruneDedupLog();
    processMaximaOutbox();
    _livenessCheckBlock++;
    if (_livenessCheckBlock % 20 === 0) { checkCampaignStatuses(); }
  }
  if (msg.event === "MDS_PENDING")         { onPending(msg); }
  if (msg.event === "MDSCOMMS")            { onComms(msg); }
  if (msg.event === "MAXIMACONTACTS")      { processMaximaOutbox(); }
  if (msg.event === "MAXIMAHOSTS")         { processMaximaOutbox(); }
});
