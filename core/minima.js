// T2 — Core: minima.js
// Platform bridge: DB wrapper, Maxima broadcast, FE signaller.
// Rhino-compatible: var only, no arrow functions, no template literals, no TextEncoder.
// broadcastMaxima depends on APP_NAME defined in main.js (SW global scope).

function hexToUtf8(s) {
  var hex = s.replace(/\s+/g, '');
  if (hex.length >= 2 && hex.charAt(0) === '0' && (hex.charAt(1) === 'x' || hex.charAt(1) === 'X')) {
    hex = hex.substring(2);
  }
  return decodeURIComponent(hex.replace(/[0-9A-F]{2}/gi, '%$&'));
}

function utf8ToHex(str) {
  var hex = '';
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if (code < 128) {
      hex += ('0' + code.toString(16)).slice(-2);
    } else if (code < 2048) {
      hex += ('0' + ((code >> 6) | 192).toString(16)).slice(-2);
      hex += ('0' + ((code & 63) | 128).toString(16)).slice(-2);
    } else {
      hex += ('0' + ((code >> 12) | 224).toString(16)).slice(-2);
      hex += ('0' + (((code >> 6) & 63) | 128).toString(16)).slice(-2);
      hex += ('0' + ((code & 63) | 128).toString(16)).slice(-2);
    }
  }
  return hex;
}

function escapeSql(str) {
  return String(str == null ? '' : str).replace(/'/g, "''");
}

// Returns true if s is a bare 0x hex string with no whitespace or metacharacters.
// Used to validate remote payload fields before interpolating into MDS.cmd strings.
// Minima Maxima public keys are DER-encoded RSA 1024-bit keys: ~270 hex chars.
// Max set to 600 to accommodate current and future key sizes while blocking injection.
function isHexKey(s) {
  return typeof s === "string" && /^0[xX][0-9A-Fa-f]{2,600}$/.test(s);
}

// Returns true if s is a plausible Maxima contact string or MAX# permanent route
// with no whitespace (which would inject additional command parameters).
function isMaximaRoute(s) {
  return typeof s === "string" && s.length > 0 && s.length < 1200 && !/\s/.test(s);
}

function sqlQuery(query, cb) {
  MDS.sql(query, function(res) {
    if (!res.status) {
      MDS.log("[DB] sqlQuery error: " + res.error + " | query: " + query);
      cb(res.error);
      return;
    }
    cb(null, res.rows);
  });
}

// Delivery helper: res.status is always true (Minima default); real delivery
// result is in res.response.delivered (boolean). Log error when not delivered.
function _maxDelivered(res, label) {
  var delivered = !!(res && res.response && res.response.delivered);
  if (!delivered) {
    var err = "not delivered";
    if (res && res.response) {
      if (res.response.error) { err = res.response.error; }
      else if (res.response.message) { err = res.response.message; }
    }
    MDS.log("[MINIMA] " + label + " delivery failed: " + err + " | resp=" + JSON.stringify(res && res.response ? res.response : res));
  }
  return delivered;
}

function normalizePublicKey(pk) {
  if (!pk || typeof pk !== "string") { return ""; }
  var s = pk.trim();
  if (s.length >= 2 && s.charAt(0) === '0' && (s.charAt(1) === 'x' || s.charAt(1) === 'X')) {
    s = s.substring(2);
  }
  return "0x" + s.toUpperCase();
}

function _isNoContactError(res) {
  if (!res || !res.response) { return false; }
  var err = "";
  if (res.response.error) { err = res.response.error; }
  else if (res.response.message) { err = res.response.message; }
  if (typeof err === "string") {
    var lower = err.toLowerCase();
    if (lower.indexOf("no contact found") !== -1 || lower.indexOf("unknown publickey") !== -1) {
      return true;
    }
  }
  return false;
}

var _maximaOutbox = [];

function _queueMaximaMessage(publicKey, mxAddress, payload) {
  if (publicKey) {
    publicKey = normalizePublicKey(publicKey);
  }
  for (var i = 0; i < _maximaOutbox.length; i++) {
    var item = _maximaOutbox[i];
    if (item.publicKey === publicKey &&
        item.mxAddress === mxAddress &&
        item.payload && item.payload.type === payload.type) {
      item.payload = payload;
      item.timestamp = Date.now();
      item.retries = 0;
      MDS.log("[MINIMA] Outbox: updated duplicate pending message type=" + payload.type);
      return;
    }
  }
  _maximaOutbox.push({
    publicKey: publicKey,
    mxAddress: mxAddress,
    payload: payload,
    timestamp: Date.now(),
    retries: 0
  });
  MDS.log("[MINIMA] Outbox: queued message type=" + payload.type + " (outbox size: " + _maximaOutbox.length + ")");
}

function processMaximaOutbox() {
  if (_maximaOutbox.length === 0) { return; }
  MDS.log("[MINIMA] Processing Maxima outbox queue (" + _maximaOutbox.length + " pending)");
  var tempQueue = _maximaOutbox.slice(0);
  _maximaOutbox = [];
  
  var processNext = function(idx) {
    if (idx >= tempQueue.length) {
      MDS.log("[MINIMA] Finished processing outbox. Remaining pending: " + _maximaOutbox.length);
      return;
    }
    var item = tempQueue[idx];
    var now = Date.now();
    if (item.retries >= 15 || (now - item.timestamp > 24 * 60 * 60 * 1000)) {
      MDS.log("[MINIMA] Outbox message discarded: too many retries (" + item.retries + ") or expired");
      processNext(idx + 1);
      return;
    }
    item.retries++;
    MDS.log("[MINIMA] Retrying outbox message type=" + (item.payload && item.payload.type) + " to " + (item.publicKey ? item.publicKey.substring(0, 16) + "..." : "null") + " (attempt " + item.retries + ")");
    _sendMaximaDirect(item.publicKey, item.mxAddress, item.payload, function(ok, res, isContactErr) {
      if (ok) {
        MDS.log("[MINIMA] Outbox message successfully sent!");
      } else if (isContactErr) {
        MDS.log("[MINIMA] Outbox message failed with contact error again, re-queuing...");
        _maximaOutbox.push(item);
      } else {
        MDS.log("[MINIMA] Outbox message failed with other error, re-queuing...");
        _maximaOutbox.push(item);
      }
      processNext(idx + 1);
    });
  };
  processNext(0);
}

function _sendMaximaDirect(publicKey, mxAddress, payload, cb) {
  if (publicKey && !isHexKey(publicKey)) {
    MDS.log("[MINIMA] _sendMaximaDirect rejected: malformed publicKey");
    if (cb) { cb(false); }
    return;
  }
  if (mxAddress && !isMaximaRoute(mxAddress)) {
    MDS.log("[MINIMA] _sendMaximaDirect rejected: malformed mxAddress");
    if (cb) { cb(false); }
    return;
  }
  if (publicKey) {
    publicKey = normalizePublicKey(publicKey);
  }
  var hex = "0x" + utf8ToHex(JSON.stringify(payload)).toUpperCase();
  if (publicKey && mxAddress) {
    MDS.cmd("maxima action:send publickey:" + publicKey + " application:" + APP_NAME + " data:" + hex + " poll:false", function(res) {
      if (_maxDelivered(res, "publickey")) {
        if (cb) { cb(true, res, false); }
        return;
      }
      var isContactErr = _isNoContactError(res);
      MDS.cmd("maxima action:send to:" + mxAddress + " application:" + APP_NAME + " data:" + hex + " poll:false", function(res2) {
        var ok = _maxDelivered(res2, "to");
        if (cb) { cb(ok, res2, isContactErr && _isNoContactError(res2)); }
      });
    });
  } else if (publicKey) {
    MDS.cmd("maxima action:send publickey:" + publicKey + " application:" + APP_NAME + " data:" + hex + " poll:false", function(res) {
      var ok = _maxDelivered(res, "publickey");
      if (cb) { cb(ok, res, _isNoContactError(res)); }
    });
  } else if (mxAddress) {
    MDS.cmd("maxima action:send to:" + mxAddress + " application:" + APP_NAME + " data:" + hex + " poll:false", function(res) {
      var ok = _maxDelivered(res, "to");
      if (cb) { cb(ok, res, _isNoContactError(res)); }
    });
  } else {
    if (cb) { cb(false, null, false); }
  }
}

function sendMaxima(publicKey, mxAddress, payload, cb) {
  _sendMaximaDirect(publicKey, mxAddress, payload, function(ok, res, isContactError) {
    if (!ok && isContactError) {
      MDS.log("[MINIMA] sendMaxima: no contact found, queuing message in outbox...");
      _queueMaximaMessage(publicKey, mxAddress, payload);
      if (cb) { cb(false); }
    } else {
      if (cb) { cb(ok); }
    }
  });
}

// Helper: Get current node's Maxima info (publickey, staticmls status, mls address, contact).
// Works in both SW and FE contexts.
function getMaximaInfo(cb) {
  MDS.cmd("maxima action:info", function(resp) {
    if (resp.status) {
      cb(null, {
        publickey: resp.response.publickey,
        staticmls: resp.response.staticmls === true,
        mls: resp.response.mls || "",
        contact: resp.response.contact || "",
        p2pidentity: resp.response.p2pidentity || "",
        localidentity: resp.response.localidentity || ""
      });
    } else {
      cb(new Error("Cannot read maxima info"));
    }
  });
}

// Helper: Validate and parse a permanent route string MAX#<pk>#<mls>.
// Returns { publickey, mls } or null if invalid.
function parseMaximaRoute(route) {
  if (!route || typeof route !== "string") { return null; }
  if (route.indexOf("MAX#") !== 0) { return null; }
  var parts = route.split("#");
  if (parts.length !== 3) { return null; }
  var pk = parts[1];
  if (pk.indexOf("Mx") === 0 || pk.indexOf("mx") === 0 || pk.indexOf("MX") === 0) {
    return null;
  }
  return { publickey: normalizePublicKey(pk), mls: parts[2] };
}

// Helper: Build and store the creator permanent route MAX#<pk>#<mls>.
// Requires static MLS to be configured on the node.
function setCreatorMaximaRoute(cb) {
  MDS.cmd("maxima action:info", function(resp) {
    if (!resp.status || !resp.response) { return cb(new Error("Cannot read maxima info")); }
    var mls = resp.response.mls || "";
    if (!mls) { return cb(new Error("Node does not have static MLS configured")); }
    var maximaPk = resp.response.publickey || "";
    if (!maximaPk) { return cb(new Error("Node does not have a Maxima public key")); }
    var permanentRoute = "MAX#" + normalizePublicKey(maximaPk) + "#" + mls;
    MDS.keypair.set("USER_PERMANENT_ROUTE", permanentRoute, function() {
      if (normalizePublicKey(maximaPk) === normalizePublicKey(MINIMAADS_CREATOR_PK)) {
        MDS.keypair.set("MINIMAADS_CREATOR_ROUTE", permanentRoute, function() {
          cb(null, permanentRoute);
        });
      } else {
        cb(null, permanentRoute);
      }
    });
  });
}

// Helper: Get the stored creator permanent route.
// Calls cb(route) where route is the MAX# string, or null if not set.
// If stored route is in the outdated/invalid format, automatically clears it.
function getCreatorMaximaRoute(cb) {
  MDS.keypair.get("USER_PERMANENT_ROUTE", function(res) {
    var route = (res && res.status && res.value) ? res.value : null;
    if (route && !parseMaximaRoute(route)) {
      MDS.log("[MINIMA] Outdated permanent route format detected (" + route + "), clearing from keypairs");
      MDS.keypair.set("USER_PERMANENT_ROUTE", "", function() {
        MDS.cmd("maxima action:info", function(infoRes) {
          var pk = (infoRes && infoRes.status && infoRes.response && infoRes.response.publickey) ? infoRes.response.publickey : "";
          if (pk && normalizePublicKey(pk) === normalizePublicKey(MINIMAADS_CREATOR_PK)) {
            MDS.keypair.set("MINIMAADS_CREATOR_ROUTE", "", function() {
              cb(null);
            });
          } else {
            cb(null);
          }
        });
      });
      return;
    }
    cb(route);
  });
}

function broadcastMaxima(payload, cb) {
  var hex = "0x" + utf8ToHex(JSON.stringify(payload)).toUpperCase();
  MDS.cmd("maxima action:sendall application:" + APP_NAME + " data:" + hex, function(res) {
    cb(res.status);
  });
}

function signalFE(type, data) {
  var obj = { type: type };
  if (data) {
    for (var key in data) {
      if (data.hasOwnProperty(key)) {
        obj[key] = data[key];
      }
    }
  }
  MDS.comms.solo(JSON.stringify(obj));
}
