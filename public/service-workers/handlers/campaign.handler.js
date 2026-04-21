// T8 — Campaign Maxima message handlers.
// Persists CAMPAIGN_ANNOUNCE / CAMPAIGN_PAUSE / CAMPAIGN_FINISH events
// via core/campaigns.js and signals the FE. Called from onMaxima in
// maxima.handler.js. Rhino-safe syntax.
//
// Payload schemas: MinimaAds.md §8.3 and §8.5.
// FE signals: MinimaAds.md §8.6 (NEW_CAMPAIGN, CAMPAIGN_UPDATED).

function handleCampaignAnnounce(payload) {
  if (!payload.campaign || !payload.ad || !payload.campaign.id) {
    MDS.log("[CAMPAIGN] ANNOUNCE missing campaign or ad");
    return;
  }
  var campaignId = payload.campaign.id;
  saveCampaign(payload.campaign, payload.ad, function(err) {
    if (err) {
      MDS.log("[CAMPAIGN] saveCampaign failed: " + err);
      return;
    }
    MDS.log("[CAMPAIGN] ANNOUNCE persisted, id: " + campaignId);
    signalFE("NEW_CAMPAIGN", { campaign_id: campaignId });
  });
}

function handleCampaignPause(payload) {
  if (!payload.campaign_id) {
    MDS.log("[CAMPAIGN] PAUSE missing campaign_id");
    return;
  }
  applyStatusChange(payload.campaign_id, "paused");
}

function handleCampaignFinish(payload) {
  if (!payload.campaign_id) {
    MDS.log("[CAMPAIGN] FINISH missing campaign_id");
    return;
  }
  applyStatusChange(payload.campaign_id, "finished");
}

function applyStatusChange(campaignId, status) {
  setCampaignStatus(campaignId, status, function(err) {
    if (err) {
      MDS.log("[CAMPAIGN] setCampaignStatus(" + status + ") failed: " + err);
      return;
    }
    MDS.log("[CAMPAIGN] status updated to " + status + ", id: " + campaignId);
    getCampaign(campaignId, function(err2, campaign) {
      var budget = (campaign && campaign.BUDGET_REMAINING !== undefined)
        ? parseFloat(campaign.BUDGET_REMAINING)
        : 0;
      signalFE("CAMPAIGN_UPDATED", {
        campaign_id: campaignId,
        status: status,
        budget_remaining: budget
      });
    });
  });
}
