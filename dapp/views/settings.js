// Settings view — global, accessible from drawer regardless of active mode.
// Route: #settings. Renders appearance controls (theme + accent) and
// a placeholder for privacy preferences (coming soon).

function renderSettings(root) {
  root.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.textContent = 'Settings';
  root.appendChild(h2);

  // ── Appearance ──────────────────────────────────────────────────────────
  var appearanceSection = document.createElement('section');
  appearanceSection.style.cssText = 'margin-bottom:2rem;';

  var appTitle = mkSectionTitle('Appearance');
  appearanceSection.appendChild(appTitle);

  // Theme mode
  var themeLabel = document.createElement('small');
  themeLabel.style.cssText = 'display:block;margin-bottom:.5rem;color:var(--pico-muted-color,#6c757d);';
  themeLabel.textContent = 'Theme';
  appearanceSection.appendChild(themeLabel);

  var themeRow = document.createElement('div');
  themeRow.style.cssText = 'display:flex;gap:.5rem;margin-bottom:1.5rem;max-width:16rem;';

  var lightBtn = document.createElement('button');
  lightBtn.id = 'ma-settings-theme-light';
  lightBtn.className = 'ma-theme-mode-btn secondary';
  lightBtn.textContent = 'Light';
  lightBtn.addEventListener('click', function() { setThemeMode('light'); });

  var darkBtn = document.createElement('button');
  darkBtn.id = 'ma-settings-theme-dark';
  darkBtn.className = 'ma-theme-mode-btn secondary';
  darkBtn.textContent = 'Dark';
  darkBtn.addEventListener('click', function() { setThemeMode('dark'); });

  themeRow.appendChild(lightBtn);
  themeRow.appendChild(darkBtn);
  appearanceSection.appendChild(themeRow);

  // Accent color
  var accentLabel = document.createElement('small');
  accentLabel.style.cssText = 'display:block;margin-bottom:.6rem;color:var(--pico-muted-color,#6c757d);';
  accentLabel.textContent = 'Accent color';
  appearanceSection.appendChild(accentLabel);

  var accentRow = document.createElement('div');
  accentRow.style.cssText = 'display:flex;gap:.75rem;flex-wrap:wrap;align-items:center;margin-bottom:.5rem;';

  var accentDefs = [
    { name: 'indigo',  color: '#6366f1', label: 'Indigo' },
    { name: 'emerald', color: '#059669', label: 'Emerald' },
    { name: 'orange',  color: '#ea580c', label: 'Orange' },
    { name: 'slate',   color: '#475569', label: 'Slate' }
  ];

  for (var i = 0; i < accentDefs.length; i++) {
    (function(def) {
      var swatch = document.createElement('button');
      swatch.id = 'ma-accent-' + def.name;
      swatch.className = 'ma-accent-swatch';
      swatch.title = def.label;
      swatch.setAttribute('aria-label', def.label);
      swatch.style.cssText = 'background:' + def.color + ';color:' + def.color + ';';
      swatch.addEventListener('click', function() { setAccent(def.name); });
      accentRow.appendChild(swatch);
    })(accentDefs[i]);
  }

  appearanceSection.appendChild(accentRow);

  // Accent labels row
  var accentNames = document.createElement('div');
  accentNames.style.cssText = 'display:flex;gap:.75rem;flex-wrap:wrap;';
  for (var j = 0; j < accentDefs.length; j++) {
    var lbl = document.createElement('small');
    lbl.style.cssText = 'width:2.2rem;text-align:center;color:var(--pico-muted-color,#6c757d);font-size:.68rem;';
    lbl.textContent = accentDefs[j].label;
    accentNames.appendChild(lbl);
  }
  appearanceSection.appendChild(accentNames);

  root.appendChild(appearanceSection);

  // ── Privacy ─────────────────────────────────────────────────────────────
  var privacySection = document.createElement('section');

  var privTitle = mkSectionTitle('Privacy');
  privacySection.appendChild(privTitle);

  var privMsg = document.createElement('p');
  privMsg.style.cssText = 'color:var(--pico-muted-color,#6c757d);font-size:.875rem;margin:.5rem 0 0;';
  privMsg.textContent = 'Privacy preferences — coming soon.';
  privacySection.appendChild(privMsg);

  root.appendChild(privacySection);

  // Sync active states
  _updateSettingsUI();
}
