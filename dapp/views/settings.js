// Settings view — global, accessible from drawer regardless of active mode.
// Route: #settings renders appearance + privacy controls.
// Route: #settings/maxima-routes renders renderMaximaRoutesSettings() from
//        settings-maxima-routes.js.

function renderSettings(root) {
  root.innerHTML = '';

  var hash = (window.location.hash || '').replace(/^#/, '');
  var openRoutes = (hash === 'settings/maxima-routes');

  var h2 = document.createElement('h2');
  h2.textContent = 'Settings';
  root.appendChild(h2);

  // ── Accordion 1: Appearance ──────────────────────────────────────────────
  var appDetails = document.createElement('details');
  if (!openRoutes) {
    appDetails.setAttribute('open', '');
  }
  
  var appSummary = document.createElement('summary');
  appSummary.style.cssText = 'font-weight:700;font-size:1.1rem;cursor:pointer;margin-bottom:0.5rem;';
  appSummary.textContent = 'Appearance';
  appDetails.appendChild(appSummary);

  var appearanceContent = document.createElement('div');
  appearanceContent.style.cssText = 'padding:0.5rem 0.75rem 1.5rem;';

  // Theme mode
  var themeLabel = document.createElement('small');
  themeLabel.style.cssText = 'display:block;margin-bottom:.5rem;color:var(--pico-muted-color,#6c757d);';
  themeLabel.textContent = 'Theme';
  appearanceContent.appendChild(themeLabel);

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
  appearanceContent.appendChild(themeRow);

  // Accent color
  var accentLabel = document.createElement('small');
  accentLabel.style.cssText = 'display:block;margin-bottom:.6rem;color:var(--pico-muted-color,#6c757d);';
  accentLabel.textContent = 'Accent color';
  appearanceContent.appendChild(accentLabel);

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

  appearanceContent.appendChild(accentRow);
  appDetails.appendChild(appearanceContent);
  root.appendChild(appDetails);

  // ── Accordion 2: Configure Maxima Routes ─────────────────────────────────
  var routesDetails = document.createElement('details');
  routesDetails.id = 'ma-settings-routes-details';
  if (openRoutes) {
    routesDetails.setAttribute('open', '');
  }

  var routesSummary = document.createElement('summary');
  routesSummary.style.cssText = 'font-weight:700;font-size:1.1rem;cursor:pointer;margin-bottom:0.5rem;';
  routesSummary.textContent = 'Configure Maxima Routes';
  routesDetails.appendChild(routesSummary);

  var routesContent = document.createElement('div');
  routesContent.style.cssText = 'padding:0.5rem 0.75rem 1.5rem;';

  if (typeof renderMaximaRoutesSettings === 'function') {
    renderMaximaRoutesSettings(routesContent);
  }

  routesDetails.appendChild(routesContent);
  root.appendChild(routesDetails);

  // ── Accordion 3: Privacy ──────────────────────────────────────────────────
  var privacyDetails = document.createElement('details');

  var privacySummary = document.createElement('summary');
  privacySummary.style.cssText = 'font-weight:700;font-size:1.1rem;cursor:pointer;margin-bottom:0.5rem;';
  privacySummary.textContent = 'Privacy';
  privacyDetails.appendChild(privacySummary);

  var privacyContent = document.createElement('div');
  privacyContent.style.cssText = 'padding:0.5rem 0.75rem 1.5rem;';

  var privMsg = document.createElement('p');
  privMsg.style.cssText = 'color:var(--pico-muted-color,#6c757d);font-size:.875rem;margin:0;';
  privMsg.textContent = 'Privacy preferences — coming soon.';
  privacyContent.appendChild(privMsg);

  privacyDetails.appendChild(privacyContent);
  root.appendChild(privacyDetails);

  // Sync active states
  _updateSettingsUI();

  // If openRoutes, scroll routesDetails into view smoothly
  if (openRoutes) {
    setTimeout(function() {
      routesDetails.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
}
