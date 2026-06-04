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
  return str.replace(/'/g, "''");
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

function sendMaxima(publicKey, mxAddress, payload, cb) {
  var hex = "0x" + utf8ToHex(JSON.stringify(payload)).toUpperCase();
  if (publicKey) {
    MDS.cmd("maxima action:send publickey:" + publicKey + " application:" + APP_NAME + " data:" + hex + " poll:false", function(res) {
      if (!res.status && mxAddress) {
        MDS.cmd("maxima action:send to:" + mxAddress + " application:" + APP_NAME + " data:" + hex + " poll:false", function(res2) {
          cb(res2.status);
        });
      } else {
        cb(res.status);
      }
    });
  } else if (mxAddress) {
    MDS.cmd("maxima action:send to:" + mxAddress + " application:" + APP_NAME + " data:" + hex + " poll:false", function(res) {
      cb(res.status);
    });
  } else {
    cb(false);
  }
}

// Helper: Get current node's Maxima info (publickey, staticmls status, mls address).
// Works in both SW and FE contexts.
function getMaximaInfo(cb) {
  MDS.cmd("maxima action:info", function(resp) {
    if (resp.status) {
      cb(null, {
        publickey: resp.response.publickey,
        staticmls: resp.response.staticmls === true,
        mls: resp.response.mls || ""
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
  return { publickey: parts[1], mls: parts[2] };
}

// Helper: Build and store the creator permanent route MAX#<pk>#<mls>.
// Requires static MLS to be configured on the node.
function setCreatorMaximaRoute(cb) {
  getMaximaInfo(function(err, info) {
    if (err) { return cb(err); }
    if (!info.staticmls) { return cb(new Error("Node does not have static MLS configured")); }
    var permanentRoute = "MAX#" + info.publickey + "#" + info.mls;
    MDS.keypair.set("CREATOR_PERMANENT_ROUTE", permanentRoute, function() {
      cb(null, permanentRoute);
    });
  });
}

// Helper: Get the stored creator permanent route.
// Calls cb(route) where route is the MAX# string, or null if not set.
function getCreatorMaximaRoute(cb) {
  MDS.keypair.get("CREATOR_PERMANENT_ROUTE", function(res) {
    var route = (res && res.status && res.value) ? res.value : null;
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
