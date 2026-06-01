// Profile view — global, accessible from drawer regardless of active mode.
// Route: #profile. Shows Maxima name (editable), avatar (editable), address, interests, total earned.

function renderProfile(root) {
  root.innerHTML = '';

  // ── Avatar + name header ─────────────────────────────────────────────────
  var heroSection = document.createElement('section');
  heroSection.style.cssText = 'display:flex;align-items:center;gap:1.25rem;margin-bottom:2rem;';

  // Avatar — clickable to change photo
  var avatarWrap = document.createElement('div');
  avatarWrap.style.cssText = 'position:relative;flex-shrink:0;cursor:pointer;';
  avatarWrap.title = 'Click to change photo';

  var avatarEl = document.createElement('div');
  avatarEl.id = 'ma-profile-avatar';
  _renderAvatarContent(avatarEl);
  avatarWrap.appendChild(avatarEl);

  // Hover overlay
  var avatarOverlay = document.createElement('div');
  avatarOverlay.style.cssText = 'position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,.45);'
    + 'display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;';
  avatarOverlay.innerHTML = '<small style="color:#fff;font-size:.65rem;text-align:center;padding:0 .2rem;">Change</small>';
  avatarWrap.appendChild(avatarOverlay);
  avatarWrap.addEventListener('mouseenter', function() { avatarOverlay.style.opacity = '1'; });
  avatarWrap.addEventListener('mouseleave', function() { avatarOverlay.style.opacity = '0'; });

  // Hidden file input
  var photoInput = document.createElement('input');
  photoInput.type = 'file';
  photoInput.accept = 'image/*';
  photoInput.style.cssText = 'display:none;';
  photoInput.addEventListener('change', function() {
    var file = photoInput.files && photoInput.files[0];
    if (!file) { return; }
    _compressAndSaveIcon(file, function() {
      var el = document.getElementById('ma-profile-avatar');
      if (el) { _renderAvatarContent(el); }
    });
  });
  avatarWrap.appendChild(photoInput);
  avatarWrap.addEventListener('click', function() { photoInput.click(); });

  heroSection.appendChild(avatarWrap);

  // Name — editable input
  var nameGroup = document.createElement('div');
  nameGroup.style.cssText = 'min-width:0;flex:1;display:flex;flex-direction:column;gap:.25rem;';

  var nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = MY_MX_NAME || '';
  nameInput.placeholder = 'Your Maxima name';
  nameInput.style.cssText = 'margin:0;font-size:1.1rem;font-weight:600;';
  nameInput.addEventListener('blur', function() {
    var val = nameInput.value.trim();
    if (!val || val === MY_MX_NAME) { return; }
    MDS.cmd('maxima action:setname name:' + encodeURIComponent(val), function(res) {
      if (res && res.status) {
        MY_MX_NAME = val;
        // Sync drawer avatar initial
        var drawerAvatar = document.getElementById('ma-drawer-avatar-circle');
        if (drawerAvatar) { drawerAvatar.textContent = val.charAt(0).toUpperCase(); }
      }
    });
  });

  var nameHint = document.createElement('small');
  nameHint.style.cssText = 'display:block;color:var(--pico-muted-color,#6c757d);font-size:.75rem;margin-top:.5rem;';
  nameHint.textContent = 'Visible to your Maxima contacts';

  nameGroup.appendChild(nameInput);
  nameGroup.appendChild(nameHint);
  heroSection.appendChild(nameGroup);

  root.appendChild(heroSection);

  // ── Maxima address ───────────────────────────────────────────────────────
  var addrSection = document.createElement('section');
  addrSection.style.cssText = 'margin-bottom:1.5rem;';

  var addrTitle = mkSectionTitle('Maxima address');
  addrSection.appendChild(addrTitle);

  var addrRow = document.createElement('div');
  addrRow.style.cssText = 'display:flex;gap:.4rem;align-items:center;';

  var addrInput = document.createElement('input');
  addrInput.type = 'text';
  addrInput.readOnly = true;
  addrInput.value = MY_MX_ADDRESS || '—';
  addrInput.style.cssText = 'flex:1;font-size:.75rem;font-family:monospace;margin:0;';

  var copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy';
  copyBtn.style.cssText = 'width:auto;margin:0;padding:.3rem .65rem;font-size:.85rem;';
  copyBtn.addEventListener('click', function() {
    if (!MY_MX_ADDRESS) { return; }
    try {
      var ta = document.createElement('textarea');
      ta.value = MY_MX_ADDRESS;
      ta.style.cssText = 'position:fixed;left:-9999px;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copyBtn.textContent = 'Copied!';
      setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1500);
    } catch (e) {}
  });

  addrRow.appendChild(addrInput);
  addrRow.appendChild(copyBtn);
  addrSection.appendChild(addrRow);
  root.appendChild(addrSection);

  // ── Interests ────────────────────────────────────────────────────────────
  var intSection = document.createElement('section');
  intSection.style.cssText = 'margin-bottom:1.5rem;';

  var intTitle = mkSectionTitle('My interests');
  intSection.appendChild(intTitle);

  var intInput = document.createElement('input');
  intInput.type = 'text';
  intInput.id = 'ma-profile-interests';
  intInput.placeholder = 'e.g. technology, sport, music';
  intInput.addEventListener('input', function() {
    clearTimeout(_profileInterestsSaveTimer);
    var val = intInput.value.trim();
    _profileInterestsSaveTimer = setTimeout(function() {
      updateUserProfile(MY_ADDRESS, { interests: val || null }, function() {});
    }, 800);
  });
  intSection.appendChild(intInput);
  root.appendChild(intSection);

  // ── Total earned ─────────────────────────────────────────────────────────
  var earnedSection = document.createElement('section');
  earnedSection.style.cssText = 'margin-bottom:1.5rem;';
  earnedSection.appendChild(mkSectionTitle('Total earned'));
  var earnedVal = document.createElement('p');
  earnedVal.id = 'ma-profile-total-earned-card';
  earnedVal.style.cssText = 'margin:0;font-size:1rem;';
  earnedVal.textContent = '—';
  earnedSection.appendChild(earnedVal);
  root.appendChild(earnedSection);

  // Load profile data
  if (MY_ADDRESS && typeof getUserProfile === 'function') {
    getUserProfile(MY_ADDRESS, function(err, profile) {
      var inp = document.getElementById('ma-profile-interests');
      var earnedEl = document.getElementById('ma-profile-total-earned-card');
      if (!err && profile) {
        if (profile.INTERESTS && inp) { inp.value = profile.INTERESTS; }
        var total = parseFloat(profile.TOTAL_EARNED) || 0;
        if (earnedEl) { earnedEl.textContent = total.toFixed(6) + ' MINIMA'; }
      } else {
        if (earnedEl) { earnedEl.textContent = '0.000000 MINIMA'; }
      }
    });
  }
}

function _renderAvatarContent(el) {
  el.innerHTML = '';
  el.style.cssText = 'width:4rem;height:4rem;border-radius:50%;overflow:hidden;'
    + 'display:flex;align-items:center;justify-content:center;';
  if (MY_MX_ICON) {
    var img = document.createElement('img');
    img.src = MY_MX_ICON;
    img.alt = MY_MX_NAME || 'Avatar';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    el.appendChild(img);
  } else {
    var initial = (MY_MX_NAME || MY_MX_ADDRESS || '?').charAt(0).toUpperCase();
    el.style.cssText += 'background:var(--pico-primary-background,#ea580c);color:#fff;'
      + 'font-size:1.6rem;font-weight:700;';
    el.textContent = initial;
  }
}

function _compressAndSaveIcon(file, cb) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var size = 128;
      var canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext('2d');
      // Crop to square from centre
      var s = Math.min(img.width, img.height);
      var ox = (img.width  - s) / 2;
      var oy = (img.height - s) / 2;
      ctx.drawImage(img, ox, oy, s, s, 0, 0, size, size);
      var dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      var encoded = encodeURIComponent(dataUrl);
      MDS.cmd('maxima action:seticon icon:' + encoded, function(res) {
        if (res && res.status) {
          MY_MX_ICON = dataUrl;
          // Sync drawer avatar
          var drawerAvatar = document.getElementById('ma-drawer-avatar-circle');
          if (drawerAvatar) { _syncDrawerAvatar(drawerAvatar); }
          if (cb) { cb(); }
        }
      });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function _syncDrawerAvatar(el) {
  if (MY_MX_ICON) {
    el.innerHTML = '';
    el.style.cssText = el.style.cssText; // keep existing styles
    var img = document.createElement('img');
    img.src = MY_MX_ICON;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
    el.appendChild(img);
  } else {
    var name = MY_MX_NAME || MY_MX_ADDRESS || '';
    el.textContent = name ? name.charAt(0).toUpperCase() : '?';
  }
}
