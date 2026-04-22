// T9 — SDK: sdk/index.js
// Public publisher API: MinimaAds.{init, getAd, render, trackView, trackClick}
// Callback-based to match Core API pattern (MinimaAds.md §7.5).
// Depends on (loaded before this file):
//   core/minima.js, core/campaigns.js, core/selection.js,
//   core/validation.js, core/rewards.js, renderer/renderAd.js

(function() {
  var _config = null;
  var _inited = false;

  function init(config, cb) {
    _config = config || {};
    if (_inited) {
      if (cb) { cb(null, true); }
      return;
    }
    if (typeof MDS === 'undefined' || typeof MDS.init !== 'function') {
      if (cb) { cb('MDS not available', false); }
      return;
    }
    MDS.init(function(event) {
      if (event && event.event === 'inited' && !_inited) {
        _inited = true;
        if (cb) { cb(null, true); }
      }
    });
  }

  // Enrich each campaign with ad fields (AD_ID, AD_INTERESTS, …).
  // Required because selection.js filters by c.AD_INTERESTS but CAMPAIGNS has no such column.
  function _enrichWithAds(campaigns, cb) {
    if (!campaigns || campaigns.length === 0) {
      cb(null, []);
      return;
    }
    sqlQuery(
      "SELECT ID, CAMPAIGN_ID, TITLE, BODY, CTA_LABEL, CTA_URL, INTERESTS FROM ADS",
      function(err, rows) {
        if (err) { cb(err, null); return; }
        var byCampaign = {};
        var list = rows || [];
        for (var i = 0; i < list.length; i++) {
          var row = list[i];
          if (row.CAMPAIGN_ID) {
            byCampaign[row.CAMPAIGN_ID.toUpperCase()] = row;
          }
        }
        var enriched = campaigns.map(function(c) {
          var ad = byCampaign[(c.ID || '').toUpperCase()];
          if (ad) {
            c.AD_ID = ad.ID;
            c.AD_TITLE = ad.TITLE;
            c.AD_BODY = ad.BODY;
            c.AD_CTA_LABEL = ad.CTA_LABEL;
            c.AD_CTA_URL = ad.CTA_URL;
            c.AD_INTERESTS = ad.INTERESTS;
          }
          return c;
        });
        cb(null, enriched);
      }
    );
  }

  function getAd(userAddress, interests, cb) {
    getCampaigns(function(err, campaigns) {
      if (err) { cb(err, null); return; }
      _enrichWithAds(campaigns || [], function(err2, enriched) {
        if (err2) { cb(err2, null); return; }
        var ad = selectAd(userAddress, interests, enriched);
        cb(null, ad);
      });
    });
  }

  function render(ad, containerId) {
    if (typeof renderAd !== 'function') {
      if (typeof MDS !== 'undefined' && MDS.log) {
        MDS.log("[SDK] renderAd not loaded");
      }
      return false;
    }
    return renderAd(ad, containerId);
  }

  function _lookupAdId(campaignId, cb) {
    sqlQuery(
      "SELECT ID FROM ADS WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')",
      function(err, rows) {
        if (err) { cb(err, null); return; }
        cb(null, (rows && rows.length > 0) ? rows[0].ID : null);
      }
    );
  }

  function _trackEvent(type, campaignId, userAddress, cb) {
    var validate = (type === 'view') ? validateView : validateClick;
    validate(campaignId, userAddress, function(result) {
      if (!result.valid) {
        cb(null, { confirmed: false, reason: result.reason });
        return;
      }
      getCampaign(campaignId, function(err, campaign) {
        if (err) { cb(err, null); return; }
        if (!campaign) {
          cb(null, { confirmed: false, reason: 'campaign not found' });
          return;
        }
        if (campaign.CREATOR_ADDRESS.toUpperCase() === userAddress.toUpperCase()) {
          cb(null, { confirmed: false, reason: 'creator cannot earn from own campaign' });
          return;
        }
        _lookupAdId(campaignId, function(err2, adId) {
          if (err2) { cb(err2, null); return; }
          var amount = (type === 'view')
            ? parseFloat(campaign.REWARD_VIEW)
            : parseFloat(campaign.REWARD_CLICK);
          var params = {
            campaign_id: campaignId,
            ad_id: adId || '',
            user_address: userAddress,
            type: type,
            amount: amount,
            publisher_id: (_config && _config.publisher_id) ? _config.publisher_id : null
          };
          createRewardEvent(params, function(err3, evt) {
            if (err3) { cb(err3, null); return; }
            cb(null, { confirmed: !!evt, event: evt });
          });
        });
      });
    });
  }

  function trackView(campaignId, userAddress, cb) {
    _trackEvent('view', campaignId, userAddress, cb);
  }

  function trackClick(campaignId, userAddress, cb) {
    _trackEvent('click', campaignId, userAddress, cb);
  }

  if (typeof window !== 'undefined') {
    window.MinimaAds = {
      init: init,
      getAd: getAd,
      render: render,
      trackView: trackView,
      trackClick: trackClick
    };
  }
})();
