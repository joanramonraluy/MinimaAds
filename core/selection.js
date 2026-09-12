// T4 — Core: selection.js
// Synchronous ad selection algorithm.
// Rhino-compatible: var only, no arrow functions, no template literals.
// Requires LIMITS to be defined in the global scope (set in main.js).

var _seenCampaignIds = {};

function selectAd(userAddress, userInterests, campaigns, blockedCreators) {
  var blockedMap = {};
  if (Array.isArray(blockedCreators)) {
    for (var bi = 0; bi < blockedCreators.length; bi++) {
      if (blockedCreators[bi]) {
        blockedMap[(blockedCreators[bi] + '').toUpperCase()] = true;
      }
    }
  } else if (blockedCreators && typeof blockedCreators === 'object') {
    blockedMap = blockedCreators;
  }

  var eligible = campaigns.filter(function(c) {
    var cPk = (c.CREATOR_ADDRESS || '').toUpperCase();
    if (blockedMap[cPk]) { return false; }
    return c.STATUS === "active"
      && parseFloat(c.BUDGET_REMAINING) >= parseFloat(c.REWARD_VIEW)
      && cPk !== userAddress.toUpperCase()
      && (!c.EXPIRES_AT || parseInt(c.EXPIRES_AT, 10) > Date.now());
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

  // Prefer unseen campaigns; fall back to already-seen ones only when all have been shown.
  var unseen = pool.filter(function(c) { return !_seenCampaignIds[c.ID]; });
  var pickFrom = unseen.length > 0 ? unseen : pool;

  var selected = pickFrom[Math.floor(Math.random() * pickFrom.length)];
  selected.ALREADY_SEEN = !!_seenCampaignIds[selected.ID];
  _seenCampaignIds[selected.ID] = true;
  return selected;
}
