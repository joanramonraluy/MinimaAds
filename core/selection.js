// T4 — Core: selection.js
// Synchronous ad selection algorithm.
// Rhino-compatible: var only, no arrow functions, no template literals.
// Requires LIMITS to be defined in the global scope (set in main.js).

var _sessionCampaignCount = 0;

function selectAd(userAddress, userInterests, campaigns) {
  if (typeof LIMITS !== "undefined" && _sessionCampaignCount >= LIMITS.MAX_CAMPAIGNS_PER_SESSION) {
    return null;
  }

  var eligible = campaigns.filter(function(c) {
    return c.STATUS === "active"
      && parseFloat(c.BUDGET_REMAINING) >= parseFloat(c.REWARD_VIEW)
      && c.CREATOR_ADDRESS.toUpperCase() !== userAddress.toUpperCase();
  });

  var matched = eligible.filter(function(c) {
    if (!c.AD_INTERESTS || !userInterests) { return false; }
    var tags = c.AD_INTERESTS.split(",").map(function(t) { return t.trim(); });
    return userInterests.split(",").some(function(u) {
      return tags.indexOf(u.trim()) !== -1;
    });
  });

  var pool = matched.length > 0 ? matched : eligible;
  if (pool.length === 0) { return null; }

  _sessionCampaignCount = _sessionCampaignCount + 1;
  return pool[Math.floor(Math.random() * pool.length)];
}
