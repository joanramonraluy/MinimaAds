// T2 — Core: minima.js
// Platform bridge: DB wrapper, Maxima broadcast, FE signaller.
// Rhino-compatible: var only, no arrow functions, no template literals, no TextEncoder.
// broadcastMaxima depends on APP_NAME defined in main.js (SW global scope).

function hexToUtf8(s) {
  return decodeURIComponent(
    s.replace(/\s+/g, '')
     .replace(/[0-9A-F]{2}/gi, '%$&')
  );
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
