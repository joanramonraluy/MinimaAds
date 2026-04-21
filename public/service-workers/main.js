// T7 stub — minimal bootstrap for T1 verification
// Full implementation in T7.

var APP_NAME = 'minima-ads';

var LIMITS = {
  MAX_VIEWS_PER_CAMPAIGN_PER_DAY:  1,
  MAX_CLICKS_PER_CAMPAIGN_PER_DAY: 1,
  COOLDOWN_BETWEEN_REWARDS_MS:     30000,
  MIN_VIEW_DURATION_MS:            3000,
  MAX_CAMPAIGNS_PER_SESSION:       10
};

MDS.init(function(msg) {
  if (msg.event === "inited") {
    MDS.load("core/minima.js");
    MDS.load("public/service-workers/db-init.js");
    initDB();
  }
});
