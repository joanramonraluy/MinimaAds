// T8 — Maxima message dispatcher.
// Decodes inbound Maxima hex payload and routes by payload.type to the
// corresponding campaign handler. Rhino-safe: var, function(), no arrow,
// no template literals, no trailing commas.
//
// Invoked from main.js MDS.init when msg.event === "MAXIMA".
// msg shape: { event: "MAXIMA", data: { from, to, data: "0x...", ... } }

function onMaxima(msg) {
  if (!msg || !msg.data || !msg.data.data) {
    MDS.log("[MAXIMA] invalid message — no data field");
    return;
  }

  var payload;
  try {
    payload = JSON.parse(hexToUtf8(msg.data.data));
  } catch (e) {
    MDS.log("[MAXIMA] failed to decode payload: " + e);
    return;
  }

  if (!payload || !payload.type) {
    MDS.log("[MAXIMA] payload missing type field");
    return;
  }

  if (payload.type === "CAMPAIGN_ANNOUNCE") {
    handleCampaignAnnounce(payload);
  } else if (payload.type === "CAMPAIGN_PAUSE") {
    handleCampaignPause(payload);
  } else if (payload.type === "CAMPAIGN_FINISH") {
    handleCampaignFinish(payload);
  } else if (payload.type === "REQUEST_CAMPAIGN_DATA") {
    handleRequestCampaignData(payload);
  } else if (payload.type === "CAMPAIGN_DATA_RESPONSE") {
    handleCampaignDataResponse(payload);
  } else {
    MDS.log("[MAXIMA] unknown type: " + payload.type);
  }
}
