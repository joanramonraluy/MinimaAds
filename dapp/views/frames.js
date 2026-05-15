// T-PUB7 — Frames management view.
// Lists publisher frames, allows creating new ones, shows SDK snippets and earnings.
// All DB access via core/frames.js. DOMPurify sanitizes all user-facing strings.

function renderFrames(root) {
  root.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.textContent = 'Publisher Frames';
  root.appendChild(h2);

  var listSection = document.createElement('div');
  listSection.id = 'ma-frames-list';
  root.appendChild(listSection);

  var detailSection = document.createElement('div');
  detailSection.id = 'ma-frame-detail';
  root.appendChild(detailSection);

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

  var helpSection = document.createElement('div');
  helpSection.className = 'ma-section';
  helpSection.innerHTML = '<p class="ma-section-title">Publisher SDK integration guide</p>'
    + '<p>The snippet is fully self-contained and zero-config. Just paste it — no changes to your existing <code>MDS.init</code> required.</p>'
    + '<ol>'
    + '<li>Click <strong>Snippet</strong> next to a frame and copy the generated code block.</li>'
    + '<li>Paste the code block inside the <code>&lt;head&gt;</code> of your MiniDapp page, <strong>after</strong> <code>mds.js</code> is loaded.</li>'
    + '<li>Done. The snippet auto-detects your Maxima key, loads the SDK, and shows ads with publisher rewards.</li>'
    + '</ol>';
  root.appendChild(helpSection);

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

function _renderFramesList(rows) {
  var listEl = document.getElementById('ma-frames-list');
  if (!listEl) { return; }

  if (rows.length === 0) {
    listEl.innerHTML = '<div class="ma-section">'
      + '<p>No frames yet. Your built-in frame will appear here once the node initialises.</p>'
      + '</div>';
    return;
  }

  var html = '<div class="ma-section">'
    + '<p class="ma-section-title">My Frames</p>'
    + '<div style="overflow-x:auto"><table role="grid" style="margin:0"><thead><tr>'
    + '<th>Label</th><th>Type</th><th>Total earned</th><th></th>'
    + '</tr></thead><tbody>';

  for (var i = 0; i < rows.length; i++) {
    var r      = rows[i];
    var label  = DOMPurify.sanitize(r.LABEL || '');
    var fid    = DOMPurify.sanitize(r.FRAME_ID || '');
    var isB    = (r.IS_BUILTIN === 'true' || r.IS_BUILTIN === true);
    var earned = (parseFloat(r.TOTAL_EARNED) || 0).toFixed(6);
    html += '<tr>'
      + '<td>' + (label || '<em>—</em>') + '</td>'
      + '<td>' + (isB ? 'Built-in' : 'Custom') + '</td>'
      + '<td>' + earned + ' MINIMA</td>'
      + '<td style="white-space:nowrap">'
      + '<button class="outline" style="margin:0 0.25rem 0 0;padding:0.2rem 0.5rem"'
      + ' data-fid="' + fid + '" data-action="snippet" type="button">Snippet</button>'
      + '<button class="outline" style="margin:0;padding:0.2rem 0.5rem"'
      + ' data-fid="' + fid + '" data-action="earnings" type="button">Earnings</button>'
      + '</td>'
      + '</tr>';
  }
  html += '</tbody></table></div></div>';
  listEl.innerHTML = html;

  var table = listEl.querySelector('table');
  if (table) {
    table.addEventListener('click', function(e) {
      var btn = e.target;
      if (!btn || btn.tagName !== 'BUTTON') { return; }
      var fid    = btn.getAttribute('data-fid');
      var action = btn.getAttribute('data-action');
      if (!fid) { return; }
      if (action === 'snippet')  { _showSnippet(fid); }
      if (action === 'earnings') { _showEarnings(fid); }
    });
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
  var detailEl = document.getElementById('ma-frame-detail');
  if (!detailEl) { return; }
  MDS.sql("SELECT PUBLISHER_KEY FROM FRAMES WHERE UPPER(FRAME_ID) = UPPER('" + fid.replace(/'/g, "''") + "') LIMIT 1", function(res) {
    var pubKey = (res && res.status && res.rows && res.rows.length > 0) ? (res.rows[0].PUBLISHER_KEY || '') : '';
    _renderSnippet(detailEl, fid, pubKey);
  });
}

function _renderSnippet(detailEl, fid, pubKey) {
  var snippet = "<div id=\"minimaads-slot\"></div>\n"
    + "<script>\n"
    + "(function() {\n"
    + "  var publisherKey = '" + pubKey + "';\n"
    + "  var slotId  = 'minimaads-slot';\n"
    + "  var started = false;\n"
    + "  var contact = '';\n"
    + "\n"
    + "  function _render(ad) {\n"
    + "    var el = document.getElementById(slotId);\n"
    + "    if (!el || !ad) { return; }\n"
    + "    el.innerHTML = '';\n"
    + "    var wrap = document.createElement('article');\n"
    + "    wrap.style.cssText = 'padding:0.5rem 0.75rem;font-size:0.85rem;border:1px solid #ccc;border-radius:4px;';\n"
    + "    var title = document.createElement('strong');\n"
    + "    title.textContent = ad.title || '';\n"
    + "    wrap.appendChild(title);\n"
    + "    if (ad.body) {\n"
    + "      var p = document.createElement('p');\n"
    + "      p.style.margin = '0.25rem 0 0';\n"
    + "      p.textContent = ad.body;\n"
    + "      wrap.appendChild(p);\n"
    + "    }\n"
    + "    if (ad.cta_url) {\n"
    + "      var a = document.createElement('a');\n"
    + "      a.href = /^javascript:/i.test((ad.cta_url || '').trim()) ? '#' : ad.cta_url;\n"
    + "      a.target = '_blank'; a.rel = 'noopener noreferrer';\n"
    + "      a.textContent = ad.cta_label || 'Visit';\n"
    + "      a.style.cssText = 'display:inline-block;margin-top:0.25rem;';\n"
    + "      wrap.appendChild(a);\n"
    + "    }\n"
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
    + "      userAddress: contact, publisherKey: publisherKey\n"
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
    + "    console.log('[MA] _start contact:', mx ? mx.substring(0,20)+'...' : '(empty)');\n"
    + "    if (started || !mx) { return; }\n"
    + "    started = true; contact = mx;\n"
    + "    console.log('[MA] sending MA_GET_AD');\n"
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
    + "      cb((res && res.status && res.response && res.response.publickey) ? res.response.publickey : '');\n"
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
  detailEl.innerHTML = '<div class="ma-section">'
    + '<p class="ma-section-title">SDK Snippet — ' + DOMPurify.sanitize(fid) + '</p>'
    + '<pre style="overflow-x:auto;white-space:pre-wrap;font-size:0.8rem">'
    + '<code id="ma-snippet-code">' + _escapeHtml(snippet) + '</code></pre>'
    + '<button id="ma-snippet-copy" type="button">Copy snippet</button>'
    + '</div>';

  var copyBtn = document.getElementById('ma-snippet-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(snippet).then(function() {
          copyBtn.textContent = 'Copied!';
          setTimeout(function() { copyBtn.textContent = 'Copy snippet'; }, 2000);
        });
      } else {
        var el = document.getElementById('ma-snippet-code');
        if (el) {
          var range = document.createRange();
          range.selectNodeContents(el);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    });
  }
}

function _showEarnings(fid) {
  var detailEl = document.getElementById('ma-frame-detail');
  if (!detailEl) { return; }
  detailEl.innerHTML = '<div class="ma-section"><p aria-busy="true">Loading earnings…</p></div>';

  getFrameEarnings(fid, function(err, data) {
    var el = document.getElementById('ma-frame-detail');
    if (!el) { return; }
    if (err) {
      el.innerHTML = '<div class="ma-section"><p>Error: ' + DOMPurify.sanitize(String(err)) + '</p></div>';
      return;
    }
    el.innerHTML = '<div class="ma-section">'
      + '<p class="ma-section-title">Earnings — ' + DOMPurify.sanitize(fid) + '</p>'
      + '<ul>'
      + '<li>Total earned: <strong>' + (data.total_earned || 0).toFixed(6) + ' MINIMA</strong></li>'
      + '<li>Publisher view events: <strong>' + (data.event_count || 0) + '</strong></li>'
      + '</ul>'
      + '</div>';
  });
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
