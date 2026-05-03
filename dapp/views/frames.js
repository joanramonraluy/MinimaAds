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

  var form = document.getElementById('ma-frames-form');
  if (form) { form.addEventListener('submit', _onFrameSubmit); }

  _refreshFramesList();
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

function _showSnippet(fid) {
  var detailEl = document.getElementById('ma-frame-detail');
  if (!detailEl) { return; }
  var walletHint = MY_ADDRESS || '0x…your_maxima_pk…';
  var snippet = "MinimaAds.init({ wallet: '" + walletHint + "', frameId: '" + fid + "' }, function(err) {\n"
    + "  if (err) { console.error(err); return; }\n"
    + "  MinimaAds.getAd(function(ad) {\n"
    + "    if (ad) { MinimaAds.render(ad, 'ad-slot'); }\n"
    + "  });\n"
    + "});";
  detailEl.innerHTML = '<div class="ma-section">'
    + '<p class="ma-section-title">SDK Snippet — ' + DOMPurify.sanitize(fid) + '</p>'
    + '<pre style="overflow-x:auto;white-space:pre-wrap;font-size:0.8rem">'
    + '<code id="ma-snippet-code">' + DOMPurify.sanitize(snippet) + '</code></pre>'
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
  var frame = {
    frame_id:         frameId,
    publisher_key:    MY_ADDRESS,
    publisher_wallet: MY_ADDRESS,
    label:            label,
    is_builtin:       false,
    created_at:       Date.now()
  };

  var submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.setAttribute('disabled', ''); }
  if (msgEl) { msgEl.textContent = 'Creating frame…'; }

  saveFrame(frame, function(err) {
    if (submitBtn) { submitBtn.removeAttribute('disabled'); }
    if (err) {
      if (msgEl) { msgEl.textContent = 'Error: ' + String(err); }
      return;
    }
    if (msgEl) { msgEl.textContent = ''; }
    form.reset();
    _refreshFramesList();
    _showSnippet(frameId);
  });
}

// Called from app.js handleMdsComms on PUBLISHER_REWARD_CONFIRMED.
function onPublisherRewardConfirmed(parsed) {
  _refreshFramesList();
}
