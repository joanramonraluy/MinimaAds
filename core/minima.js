// T2 stub — minimal implementation for T1 verification
// Full implementation in T2.

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

function signalFE(type, data) {
  var payload = JSON.stringify({ type: type, data: data });
  MDS.comms.solo(payload);
}
