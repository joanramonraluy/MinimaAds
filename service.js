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
  initDB();
}

function onTimer() {
  // T8+ : re-broadcast active campaigns, check expirations.
}

MDS.init(function(msg) {
  if (msg.event === "inited")              { onInited(); }
  if (msg.event === "MAXIMA")              { onMaxima(msg); }
  if (msg.event === "MDS_TIMER_10SECONDS") { onTimer(); }
});
