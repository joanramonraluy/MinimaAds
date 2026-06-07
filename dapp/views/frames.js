// T-PUB7 — Frames management view.
// Lists publisher frames, allows creating new ones, shows SDK snippets and earnings.
// All DB access via core/frames.js. DOMPurify sanitizes all user-facing strings.

function renderFrames(root) {
  root.innerHTML = '';

  // Check for permanent Maxima route — redirect to settings if not registered.
  if (typeof getCreatorMaximaRoute === 'function') {
    getCreatorMaximaRoute(function(route) {
      if (!route) {
        window.location.hash = 'settings/maxima-routes';
      }
    });
  }

  var h2 = document.createElement('h2');
  h2.textContent = 'Publisher Frames';
  root.appendChild(h2);

  var listSection = document.createElement('div');
  listSection.id = 'ma-frames-list';
  root.appendChild(listSection);

  var createSection = document.createElement('div');
  createSection.className = 'ma-section';
  createSection.innerHTML = '<p class="ma-section-title">Create new Frame</p>'
    + '<form id="ma-frames-form">'
    + '<label>Frame label'
    + '  <input name="label" required maxlength="256" placeholder="My website">'
    + '</label>'
    + '<button type="submit">Create Frame</button>'
    + '<p id="ma-frames-msg" role="status"></p>'
    + '</form>';
  root.appendChild(createSection);


  // SDK integration guide — only shown when there are custom frames
  var helpDetails = document.createElement('details');
  helpDetails.id = 'ma-frames-help';
  helpDetails.className = 'ma-section';
  helpDetails.style.cssText = 'padding:.75rem 1rem;';
  var helpSummary = document.createElement('summary');
  helpSummary.style.cssText = 'font-weight:600;cursor:pointer;';
  helpSummary.textContent = 'How to embed a custom Frame';
  helpDetails.appendChild(helpSummary);
  var helpBody = document.createElement('div');
  helpBody.innerHTML = '<p style="margin-top:.75rem;">Create a custom Frame below, then click <strong>Snippet</strong> to get the embed code for your MiniDapp.</p>'
    + '<ol>'
    + '<li>Paste the full snippet (div + script) into your MiniDapp\'s <code>&lt;body&gt;</code>, right <strong>after</strong> the <code>&lt;script src="mds.js"&gt;</code> tag.</li>'
    + '<li>The <code>&lt;div id="minimaads-slot"&gt;</code> marks where the ad renders — move it anywhere in your layout.</li>'
    + '<li>The script hooks into your existing <code>MDS.init</code> automatically — no changes to your code needed.</li>'
    + '</ol>';
  helpDetails.appendChild(helpBody);
  root.appendChild(helpDetails);

  var form = document.getElementById('ma-frames-form');
  if (form) { form.addEventListener('submit', _onFrameSubmit); }

  _refreshFramesList();
  _openPublisherChannelsForExistingFrames();
}

function _refreshFramesList() {
  var listEl = document.getElementById('ma-frames-list');
  if (!listEl) { return; }
  listEl.innerHTML = '<p aria-busy="true">Loading frames…</p>';

  listFrames(function(err, rows) {
    var el = document.getElementById('ma-frames-list');
    if (!el) { return; }
    if (err) {
      el.innerHTML = '<div class="ma-section"><p>Error loading frames: '
        + DOMPurify.sanitize(String(err)) + '</p></div>';
      return;
    }
    _renderFramesList(rows || []);
  });
}

function _safeId(fid) {
  return String(fid).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function _renderFramesList(rows) {
  var listEl = document.getElementById('ma-frames-list');
  if (!listEl) { return; }
  listEl.innerHTML = '';

  if (rows.length === 0) {
    listEl.appendChild(mkEmptyState(
      'Your built-in Frame will appear here once the node initialises.',
      'Create a custom Frame below',
      '#ma-frames-form'
    ));
    return;
  }

  var sectionTitle = document.createElement('p');
  sectionTitle.className = 'ma-section-title';
  sectionTitle.textContent = 'My Frames';
  listEl.appendChild(sectionTitle);

  var hasCustom = rows.some(function(r) { return !(r.IS_BUILTIN === 'true' || r.IS_BUILTIN === true); });

  for (var i = 0; i < rows.length; i++) {
    (function(r) {
      var fid    = r.FRAME_ID || '';
      var label  = DOMPurify.sanitize(r.LABEL || '');
      var isB    = (r.IS_BUILTIN === 'true' || r.IS_BUILTIN === true);
      var isCreator = MY_ADDRESS && MY_ADDRESS === MINIMAADS_CREATOR_PK.toUpperCase();

      // Skip built-in frame if user is not the platform creator
      if (isB && !isCreator) { return; }

      var earned = fmtAmt(parseFloat(r.TOTAL_EARNED) || 0, 6);
      var sid    = _safeId(fid);

      var card = document.createElement('article');
      card.style.cssText = 'margin-bottom:1rem;';

      // Card header: label + type badge (left) | earned stat card (right)
      var cardHeader = document.createElement('header');
      cardHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap;';

      var titleGroup = document.createElement('div');
      titleGroup.style.cssText = 'display:flex;align-items:center;gap:.5rem;';
      var nameEl = document.createElement('strong');
      nameEl.textContent = label || '—';
      var typeMark = document.createElement('mark');
      typeMark.style.cssText = 'padding:.1rem .4rem;border-radius:.2rem;font-size:.75rem;background:var(--pico-secondary-background,#5d6b89);color:#fff;';
      typeMark.textContent = isB ? 'Built-in' : 'Custom';
      titleGroup.appendChild(nameEl);
      titleGroup.appendChild(typeMark);
      cardHeader.appendChild(titleGroup);

      var earnedCard = mkStatCard('Total earned', earned + ' MINIMA');
      earnedCard.style.flex = 'none';
      cardHeader.appendChild(earnedCard);
      card.appendChild(cardHeader);

      // Snippet <details> — only for custom frames
      if (!isB) {
        var snippetDetails = document.createElement('details');
        snippetDetails.id = 'ma-snippet-' + sid;
        snippetDetails.className = 'ma-campaign-details';
        var snippetSummary = document.createElement('summary');
        snippetSummary.className = 'ma-campaign-details-summary';
        var snippetSummaryRow = document.createElement('span');
        snippetSummaryRow.style.cssText = 'display:inline-flex;align-items:center;gap:.5rem;';
        var snippetLabel = document.createElement('span');
        snippetLabel.textContent = 'Snippet';
        snippetSummaryRow.appendChild(snippetLabel);
        var snippetCopyBtn = document.createElement('button');
        snippetCopyBtn.type = 'button';
        snippetCopyBtn.textContent = 'Copy';
        snippetCopyBtn.setAttribute('aria-label', 'Copy snippet');
        snippetCopyBtn.style.cssText = 'width:auto;margin:0;padding:.25rem .55rem;font-size:.8rem;line-height:1.2;border-radius:.25rem;'
          + 'background:var(--pico-primary-background,#0172ad);border-color:var(--pico-primary-border,#0172ad);'
          + 'color:var(--pico-primary-inverse,#fff);';
        snippetCopyBtn.addEventListener('mouseover', function() {
          snippetCopyBtn.style.background = 'var(--pico-primary-hover-background,var(--pico-primary-background,#0172ad))';
        });
        snippetCopyBtn.addEventListener('mouseout', function() {
          snippetCopyBtn.style.background = 'var(--pico-primary-background,#0172ad)';
        });
        snippetSummaryRow.appendChild(snippetCopyBtn);
        snippetSummary.appendChild(snippetSummaryRow);
        snippetDetails.appendChild(snippetSummary);
        var snippetBody = document.createElement('div');
        snippetBody.id = 'ma-snippet-body-' + sid;
        snippetBody.style.cssText = 'margin-top:.5rem;';
        snippetDetails.appendChild(snippetBody);
        var snippetLoaded = false;
        (function(details, body, frameId) {
          details.addEventListener('toggle', function() {
            if (details.open && !snippetLoaded) {
              snippetLoaded = true;
              body.appendChild(mkLoading('Loading snippet…'));
              _showSnippet(frameId);
            }
          });
          snippetCopyBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            _copyFrameSnippet(frameId, snippetCopyBtn);
          });
        })(snippetDetails, snippetBody, fid);
        card.appendChild(snippetDetails);
      }

      // Earnings <details>
      var earningsDetails = document.createElement('details');
      earningsDetails.id = 'ma-earnings-' + sid;
      earningsDetails.className = 'ma-campaign-details';
      var earningsSummary = document.createElement('summary');
      earningsSummary.textContent = 'Earnings';
      earningsSummary.className = 'ma-campaign-details-summary';
      earningsDetails.appendChild(earningsSummary);
      var earningsBody = document.createElement('div');
      earningsBody.id = 'ma-earnings-body-' + sid;
      earningsBody.style.cssText = 'margin-top:.5rem;';
      earningsDetails.appendChild(earningsBody);
      var earningsLoaded = false;
      earningsDetails.addEventListener('toggle', function() {
        if (earningsDetails.open && !earningsLoaded) {
          earningsLoaded = true;
          earningsBody.appendChild(mkLoading('Loading earnings…'));
          _showEarnings(fid);
        }
      });
      card.appendChild(earningsDetails);

      listEl.appendChild(card);
    })(rows[i]);
  }
}

function _escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _showSnippet(fid) {
  var bodyEl = document.getElementById('ma-snippet-body-' + _safeId(fid));
  if (!bodyEl) { return; }
  _loadSnippet(fid, function(snippet) {
    bodyEl.innerHTML = '';
    _renderSnippet(bodyEl, fid, snippet);
  });
}

function _loadSnippet(fid, cb) {
  MDS.sql("SELECT PUBLISHER_KEY, PUBLISHER_MX FROM FRAMES WHERE UPPER(FRAME_ID) = UPPER('" + fid.replace(/'/g, "''") + "') LIMIT 1", function(res) {
    var row = (res && res.status && res.rows && res.rows.length > 0) ? res.rows[0] : null;
    var pubKey = row ? (row.PUBLISHER_KEY || '') : '';
    var pubMx  = row ? (row.PUBLISHER_MX  || '') : '';
    cb(_buildSnippet(fid, pubKey, pubMx));
  });
}

function _buildSnippet(fid, pubKey, pubMx) {
  return "<div id=\"minimaads-slot\"></div>\n"
    + "<script>\n"
    + "(function() {\n"
    + "  var publisherKey = '" + pubKey + "';\n"
    + "  var publisherMx  = '" + (pubMx || '') + "';\n"
    + "  var frameId      = '" + fid + "';\n"
    + "  var slotId  = 'minimaads-slot';\n"
    + "  var started = false;\n"
    + "  var contact = '';\n"
    + "\n"
    + "  function _render(ad) {\n"
    + "    var el = document.getElementById(slotId);\n"
    + "    if (!el || !ad) { return; }\n"
    + "    el.innerHTML = '';\n"
    + "    var bg  = ad.bg_color       || '#ffffff';\n"
    + "    var fg  = ad.text_color     || '#111111';\n"
    + "    var pos = ad.image_position || 'center';\n"
    + "    var zoom = parseFloat(ad.image_zoom) || 1.0;\n"
    + "    var wPct = parseInt(ad.image_width_pct, 10) || 40;\n"
    + "    var hasPic = !!(ad.image_data && /^data:image\\/(jpeg|png|gif|webp);base64,/.test(ad.image_data));\n"
    + "    var baseFs = hasPic ? (Math.max(0.70, Math.min(0.95, (100 - wPct) / 60 * 0.9)).toFixed(2) + 'rem') : '0.9rem';\n"
    + "    var isMobile = el.offsetWidth > 0 && el.offsetWidth < 480;\n"
    + "    var wrap = document.createElement('article');\n"
    + "    wrap.className = 'ma-ad-banner';\n"
    + "    if (isMobile && hasPic) {\n"
    + "      var zoomCss = 'transform:scale(' + zoom + ');transform-origin:' + pos + ';';\n"
    + "      wrap.style.cssText = 'display:block;overflow:hidden;border-radius:6px;padding:0;border:1px solid #e0e0e0;max-width:600px;width:100%;margin:0 auto;font-family:sans-serif;box-sizing:border-box;height:140px;position:relative;';\n"
    + "      var mobImg = document.createElement('img');\n"
    + "      mobImg.src = ad.image_data; mobImg.alt = ad.title || '';\n"
    + "      mobImg.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:' + pos + ';display:block;' + zoomCss;\n"
    + "      if (ad.cta_url) {\n"
    + "        var mobCtaUrl = /^javascript:/i.test((ad.cta_url || '').trim()) ? '' : ad.cta_url;\n"
    + "        var mobLink = document.createElement('a');\n"
    + "        mobLink.href = mobCtaUrl || '#';\n"
    + "        mobLink.target = '_blank'; mobLink.rel = 'noopener noreferrer';\n"
    + "        mobLink.style.cssText = 'display:block;width:100%;height:100%;cursor:pointer;';\n"
    + "        mobLink.addEventListener('click', function(e) {\n"
    + "          e.preventDefault();\n"
    + "          _trackClick(ad.campaign_id);\n"
    + "          if (mobCtaUrl) { window.open(mobCtaUrl, '_blank', 'noopener noreferrer'); }\n"
    + "        });\n"
    + "        mobLink.appendChild(mobImg);\n"
    + "        wrap.appendChild(mobLink);\n"
    + "      } else {\n"
    + "        wrap.appendChild(mobImg);\n"
    + "      }\n"
    + "      el.appendChild(wrap);\n"
    + "      return;\n"
    + "    }\n"
    + "    wrap.style.cssText = 'display:flex;overflow:hidden;border-radius:6px;padding:0;border:1px solid #e0e0e0;font-family:sans-serif;max-width:600px;width:100%;margin:0 auto;box-sizing:border-box;'\n"
    + "      + (hasPic ? 'flex-direction:row;align-items:stretch;min-height:80px;max-height:160px;' : 'flex-direction:column;');\n"
    + "    if (hasPic) {\n"
    + "      var zoomCss = ';transform:scale(' + zoom + ');transform-origin:' + pos + ';';\n"
    + "      var imgWrap = document.createElement('div');\n"
    + "      imgWrap.style.cssText = 'width:' + wPct + '%;flex-shrink:0;overflow:hidden;position:relative;';\n"
    + "      if (ad.cta_url) {\n"
    + "        var img = document.createElement('img');\n"
    + "        img.src = ad.image_data; img.alt = ad.title || '';\n"
    + "        img.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:' + pos + ';display:block;' + zoomCss;\n"
    + "        var imgCtaUrl = /^javascript:/i.test((ad.cta_url || '').trim()) ? '' : ad.cta_url;\n"
    + "        var imgLink = document.createElement('a');\n"
    + "        imgLink.href = imgCtaUrl || '#';\n"
    + "        imgLink.target = '_blank'; imgLink.rel = 'noopener noreferrer';\n"
    + "        imgLink.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;cursor:pointer;';\n"
    + "        imgLink.addEventListener('click', function(e) {\n"
    + "          e.preventDefault();\n"
    + "          _trackClick(ad.campaign_id);\n"
    + "          if (imgCtaUrl) { window.open(imgCtaUrl, '_blank', 'noopener noreferrer'); }\n"
    + "        });\n"
    + "        imgLink.appendChild(img);\n"
    + "        imgWrap.appendChild(imgLink);\n"
    + "      } else {\n"
    + "        var img = document.createElement('img');\n"
    + "        img.src = ad.image_data; img.alt = ad.title || '';\n"
    + "        img.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:' + pos + ';display:block;' + zoomCss;\n"
    + "        imgWrap.appendChild(img);\n"
    + "      }\n"
    + "      wrap.appendChild(imgWrap);\n"
    + "    }\n"
    + "    var textBlock = document.createElement('div');\n"
    + "    textBlock.style.cssText = 'padding:0.6rem 0.9rem;display:flex;flex-direction:column;justify-content:flex-start;font-size:' + baseFs + ';gap:0.3em;background:' + bg + ';box-sizing:border-box;' + (hasPic ? 'flex:1;' : '');\n"
    + "    if (ad.show_title !== 0) {\n"
    + "      var title = document.createElement('strong');\n"
    + "      title.style.cssText = 'color:' + fg + ';font-size:1.05em;line-height:1.3;';\n"
    + "      title.textContent = ad.title || '';\n"
    + "      textBlock.appendChild(title);\n"
    + "    }\n"
    + "    if (ad.body && ad.show_body !== 0) {\n"
    + "      var p = document.createElement('p');\n"
    + "      p.style.cssText = 'margin:0;font-size:0.95em;color:' + fg + ';line-height:1.4;';\n"
    + "      p.textContent = ad.body;\n"
    + "      textBlock.appendChild(p);\n"
    + "    }\n"
    + "    if (ad.cta_url && ad.show_cta !== 0) {\n"
    + "      var ctaUrl = /^javascript:/i.test((ad.cta_url || '').trim()) ? '' : ad.cta_url;\n"
    + "      var a = document.createElement('a');\n"
    + "      a.href = ctaUrl || '#';\n"
    + "      a.target = '_blank'; a.rel = 'noopener noreferrer';\n"
    + "      a.style.cssText = 'display:inline-block;margin-top:0.35em;padding:0.3em 0.75em;border-radius:4px;background:' + fg + ';color:' + bg + ';text-decoration:none;font-size:0.9em;font-weight:600;cursor:pointer;';\n"
    + "      a.textContent = ad.cta_label || 'Visit';\n"
    + "      a.addEventListener('click', function(e) {\n"
    + "        e.preventDefault();\n"
    + "        _trackClick(ad.campaign_id);\n"
    + "        if (ctaUrl) { window.open(ctaUrl, '_blank', 'noopener noreferrer'); }\n"
    + "      });\n"
    + "      textBlock.appendChild(a);\n"
    + "    }\n"
    + "    wrap.appendChild(textBlock);\n"
    + "    el.appendChild(wrap);\n"
    + "  }\n"
    + "\n"
    + "  function _requestAd() {\n"
    + "    window.MDS.comms.broadcast(JSON.stringify({\n"
    + "      type: 'MA_GET_AD', userAddress: contact, interests: []\n"
    + "    }), function() {});\n"
    + "  }\n"
    + "\n"
    + "  function _trackView(campaignId) {\n"
    + "    window.MDS.comms.broadcast(JSON.stringify({\n"
    + "      type: 'MA_TRACK_VIEW', campaignId: campaignId,\n"
    + "      userAddress: contact, publisherKey: publisherKey,\n"
    + "      frameId: frameId, publisherMx: publisherMx\n"
    + "    }), function() {});\n"
    + "  }\n"
    + "\n"
    + "  function _trackClick(campaignId) {\n"
    + "    window.MDS.comms.broadcast(JSON.stringify({\n"
    + "      type: 'MA_TRACK_CLICK', campaignId: campaignId,\n"
    + "      userAddress: contact, publisherKey: publisherKey,\n"
    + "      frameId: frameId, publisherMx: publisherMx\n"
    + "    }), function() {});\n"
    + "  }\n"
    + "\n"
    + "  function _onComms(msg) {\n"
    + "    if (!msg || msg.type !== 'MA_AD_RESPONSE' || !msg.found || !msg.ad) { return; }\n"
    + "    _render(msg.ad);\n"
    + "    setTimeout(function() { _trackView(msg.ad.campaign_id); }, 3000);\n"
    + "  }\n"
    + "\n"
    + "  function _start(mx) {\n"
    + "    console.log('[MA-PUBLISHER] ADDRESS FORMAT:', mx ? (mx.indexOf('MAX#')===0 ? 'PERMANENT_ROUTE' : 'DIRECT_CONTACT') : 'NONE');\n"
    + "    console.log('[MA-PUBLISHER] ADDRESS:', mx ? mx.substring(0,40)+'...' : '(empty)');\n"
    + "    if (started || !mx) { return; }\n"
    + "    started = true; contact = mx;\n"
    + "    console.log('[MA-PUBLISHER] sending MA_GET_AD');\n"
    + "    _requestAd();\n"
    + "  }\n"
    + "\n"
    + "  function _cmdRaw(cmd, cb) {\n"
    + "    var mx = window.MDS;\n"
    + "    if (typeof mx.executeRaw === 'function') { mx.executeRaw(cmd, cb); }\n"
    + "    else if (typeof mx.cmd === 'function') { mx.cmd(cmd, cb); }\n"
    + "  }\n"
    + "\n"
    + "  function _getMxContact(cb) {\n"
    + "    _cmdRaw('maxima action:info', function(res) {\n"
    + "      if (!res || !res.status || !res.response) { cb(''); return; }\n"
    + "      var pubkey = res.response.publickey || '';\n"
    + "      var mls = res.response.mls || '';\n"
    + "      if (!pubkey || !mls) { cb(''); return; }\n"
    + "      var permanentRoute = 'MAX#' + pubkey + '#' + mls;\n"
    + "      console.log('[MA-PUBLISHER] constructed PERMANENT_ROUTE: ' + permanentRoute);\n"
    + "      cb(permanentRoute);\n"
    + "    });\n"
    + "  }\n"
    + "\n"
    + "  function _doPatching(mx) {\n"
    + "    console.log('[MA] MDS found, patching init');\n"
    + "    var _orig = mx.init;\n"
    + "    mx.init = function(callback) {\n"
    + "      _orig.call(mx, function(msg) {\n"
    + "        if (msg && msg.event === 'inited' && !started) {\n"
    + "          console.log('[MA] inited — getting Maxima contact');\n"
    + "          _getMxContact(_start);\n"
    + "        }\n"
    + "        if (msg && msg.event === 'MDSCOMMS') {\n"
    + "          var raw = (msg.data && msg.data.message) ? msg.data.message : '';\n"
    + "          try {\n"
    + "            var parsed = JSON.parse(raw);\n"
    + "            console.log('[MA] MDSCOMMS:', parsed.type);\n"
    + "            _onComms(parsed);\n"
    + "          } catch(e) {}\n"
    + "        }\n"
    + "        if (callback) { callback(msg); }\n"
    + "      });\n"
    + "    };\n"
    + "    setTimeout(function() {\n"
    + "      if (!started) {\n"
    + "        console.log('[MA] fallback: MDS already inited, getting contact');\n"
    + "        _getMxContact(function(c) { _start(c); });\n"
    + "      }\n"
    + "    }, 500);\n"
    + "  }\n"
    + "\n"
    + "  function _patchMds() {\n"
    + "    if (window.MDS && typeof window.MDS.init === 'function') {\n"
    + "      _doPatching(window.MDS);\n"
    + "      return;\n"
    + "    }\n"
    + "    try {\n"
    + "      Object.defineProperty(window, 'MDS', {\n"
    + "        configurable: true, enumerable: true,\n"
    + "        set: function(val) {\n"
    + "          Object.defineProperty(window, 'MDS', {\n"
    + "            value: val, writable: true, configurable: true, enumerable: true\n"
    + "          });\n"
    + "          if (val && typeof val.init === 'function') { _doPatching(val); }\n"
    + "        }\n"
    + "      });\n"
    + "    } catch(e) { setTimeout(_patchMds, 50); }\n"
    + "  }\n"
    + "  console.log('[MA] snippet loaded, waiting for MDS...');\n"
    + "  _patchMds();\n"
    + "})();\n"
    + "</script>";
}

function _renderSnippet(detailEl, fid, snippet) {
  detailEl.innerHTML = '<div class="ma-section">'
    + '<p class="ma-section-title">SDK Snippet — ' + DOMPurify.sanitize(fid) + '</p>'
    + '<pre style="overflow-x:auto;white-space:pre-wrap;font-size:0.8rem">'
    + '<code id="ma-snippet-code">' + _escapeHtml(snippet) + '</code></pre>'
    + '<button id="ma-snippet-copy" type="button">Copy snippet</button>'
    + '</div>';

  var copyBtn = document.getElementById('ma-snippet-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      _copySnippetText(snippet, copyBtn, 'Copy snippet');
    });
  }
}

function _copyFrameSnippet(fid, btn) {
  var originalText = btn ? btn.textContent : 'Copy';
  if (btn) {
    btn.textContent = '...';
    btn.disabled = true;
  }
  _loadSnippet(fid, function(snippet) {
    _copySnippetText(snippet, btn, originalText);
  });
}

function _copySnippetText(snippet, btn, originalText) {
  function done(text) {
    if (!btn) { return; }
    btn.disabled = false;
    btn.textContent = text;
    setTimeout(function() { btn.textContent = originalText || 'Copy'; }, 2000);
  }

  if (navigator.clipboard) {
    navigator.clipboard.writeText(snippet).then(function() {
      done('Copied!');
    }, function() {
      done('Copy failed');
    });
  } else {
    var ta = document.createElement('textarea');
    ta.value = snippet;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    done(ok ? 'Copied!' : 'Copy failed');
  }
}

function _showEarnings(fid) {
  var bodyEl = document.getElementById('ma-earnings-body-' + _safeId(fid));
  if (!bodyEl) { return; }

  getFrameEarnings(fid, function(err, data) {
    var el = document.getElementById('ma-earnings-body-' + _safeId(fid));
    if (!el) { return; }
    el.innerHTML = '';
    if (err) {
      var errP = document.createElement('p');
      errP.textContent = 'Error: ' + DOMPurify.sanitize(String(err));
      el.appendChild(errP);
      return;
    }
    var statsRow = document.createElement('div');
    statsRow.style.cssText = 'display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.25rem;';
    statsRow.appendChild(mkStatCard('Total earned', fmtAmt(data.total_earned || 0, 6) + ' MINIMA'));
    statsRow.appendChild(mkStatCard('Publisher views', String(data.event_count || 0)));
    el.appendChild(statsRow);
  });
}

function _frameEarningsTitle(fid) {
  var frameId = String(fid || '');
  if (frameId.toLowerCase().indexOf('builtin:') === 0) {
    return 'Earnings — Built-in viewer';
  }
  return 'Earnings — ' + DOMPurify.sanitize(frameId);
}

function _openPublisherChannelsForExistingFrames() {
  listFrames(function(err, rows) {
    if (err || !rows || rows.length === 0) { return; }
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var isBuiltin = (r.IS_BUILTIN === 'true' || r.IS_BUILTIN === true);
      if (!isBuiltin && r.FRAME_ID) {
        MDS.comms.broadcast(JSON.stringify({
          type:         'MA_OPEN_PUBLISHER_CHANNELS',
          frame_id:     r.FRAME_ID,
          publisher_mx: r.PUBLISHER_MX || ''
        }), function() {});
      }
    }
  });
}

function _onFrameSubmit(e) {
  e.preventDefault();
  var form  = e.target;
  var msgEl = document.getElementById('ma-frames-msg');
  if (msgEl) { msgEl.textContent = ''; }

  var labelInput = form.elements['label'];
  var label = (labelInput ? labelInput.value : '').trim();
  if (!label) {
    if (msgEl) { msgEl.textContent = 'Label is required.'; }
    return;
  }

  var frameId = generateUID();
  var submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.setAttribute('disabled', ''); }
  if (msgEl) { msgEl.textContent = 'Creating frame…'; }

  MDS.cmd('maxima action:info', function(mxRes) {
    var publisherMx = (mxRes && mxRes.status && mxRes.response && mxRes.response.contact)
      ? mxRes.response.contact : '';
    var frame = {
      frame_id:         frameId,
      publisher_key:    MY_ADDRESS,
      publisher_wallet: MY_ADDRESS,
      publisher_mx:     publisherMx,
      label:            label,
      is_builtin:       false,
      created_at:       Date.now()
    };
    _doSaveFrame(frame, submitBtn, msgEl, frameId, form);
  });
}

function _doSaveFrame(frame, submitBtn, msgEl, frameId, form) {
  saveFrame(frame, function(err) {
    if (submitBtn) { submitBtn.removeAttribute('disabled'); }
    if (err) {
      if (msgEl) { msgEl.textContent = 'Error: ' + String(err); }
      return;
    }
    if (msgEl) { msgEl.textContent = ''; }
    if (form) { form.reset(); }
    _refreshFramesList();
    _showSnippet(frameId);
    MDS.comms.broadcast(JSON.stringify({
      type:         'MA_OPEN_PUBLISHER_CHANNELS',
      frame_id:     frameId,
      publisher_mx: frame.publisher_mx || ''
    }), function() {});
  });
}

// Called from app.js handleMdsComms on PUBLISHER_REWARD_CONFIRMED.
function onPublisherRewardConfirmed(parsed) {
  _refreshFramesList();
}
