// Settings section: Maxima Routes Configuration.
// Shared by Creator and Publisher setup flows.
// Rendered by renderSettings() when route is #settings/maxima-routes
// or when a Creator/Publisher view redirects here (no permanent route set).

function renderMaximaRoutesSettings(root) {
  root.innerHTML = '';

  var desc = document.createElement('p');
  desc.textContent = 'Configure how your node connects to an MLS server and registers as a permanent user.';
  desc.style.cssText = 'color:var(--pico-muted-color,#6c757d);margin-bottom:1.5rem;';
  root.appendChild(desc);

  // ── Section 1: MLS Server Address ───────────────────────────────────────
  var mlsSection = document.createElement('section');
  mlsSection.className = 'ma-section';
  mlsSection.style.cssText = 'margin-bottom:1.5rem;padding:1rem;background:var(--pico-card-sectionning-background-color,rgba(0,0,0,0.03));border-radius:0.5rem;';

  var mlsTitle = document.createElement('h3');
  mlsTitle.textContent = 'MLS Server Address';
  mlsTitle.style.cssText = 'margin-top:0;margin-bottom:0.5rem;';
  mlsSection.appendChild(mlsTitle);

  var mlsDesc = document.createElement('p');
  mlsDesc.textContent = 'The Maxima Location Service (MLS) server your node connects to for permanent route registration.';
  mlsDesc.style.cssText = 'font-size:0.875rem;color:var(--pico-muted-color,#6c757d);margin:0.25rem 0 1rem;';
  mlsSection.appendChild(mlsDesc);

  // Status display
  var mlsStatus = document.createElement('div');
  mlsStatus.style.cssText = 'padding:0.75rem;margin-bottom:0.75rem;border-radius:0.375rem;font-family:monospace;font-size:0.8rem;word-break:break-all;border:1px solid var(--pico-muted-border-color);';
  mlsStatus.textContent = 'Loading…';
  mlsSection.appendChild(mlsStatus);

  // Input row for changing MLS
  var mlsInputRow = document.createElement('div');
  mlsInputRow.style.cssText = 'display:flex;gap:0.5rem;align-items:stretch;flex-wrap:wrap;';

  var mlsInput = document.createElement('input');
  mlsInput.type = 'text';
  mlsInput.placeholder = 'Mx...@host:port (leave empty to change)';
  mlsInput.style.cssText = 'flex:1;min-width:200px;margin:0;';

  var mlsSaveBtn = document.createElement('button');
  mlsSaveBtn.textContent = 'Apply to Node';
  mlsSaveBtn.className = 'primary';
  mlsSaveBtn.style.cssText = 'width:auto;margin:0;white-space:nowrap;';
  mlsSaveBtn.addEventListener('click', function() {
    var addr = (mlsInput.value || '').trim();
    if (!addr) {
      alert('Please enter an MLS server address');
      return;
    }
    mlsSaveBtn.disabled = true;
    mlsSaveBtn.textContent = 'Applying…';
    // First apply it to the node
    var cmd = 'maxextra action:staticmls host:' + addr;
    MDS.cmd(cmd, function(cmdRes) {
      if (cmdRes.status) {
        // Only save AFTER applying succeeds
        MDS.keypair.set('MLS_SERVER_ADDRESS', addr, function() {
          mlsSaveBtn.disabled = false;
          mlsSaveBtn.textContent = 'Apply to Node';
          mlsInput.value = '';
          mlsStatus.textContent = '✓ MLS applied and saved: ' + addr;
          mlsStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
          mlsStatus.style.color = 'var(--pico-ins-color, #27ae60)';
        });
      } else {
        mlsSaveBtn.disabled = false;
        mlsSaveBtn.textContent = 'Apply to Node';
        mlsStatus.textContent = '✗ Failed to apply MLS: ' + (cmdRes.error || 'Unknown error');
        mlsStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
        mlsStatus.style.color = 'var(--pico-del-color, #c0392b)';
      }
    });
  });

  mlsInputRow.appendChild(mlsInput);
  mlsInputRow.appendChild(mlsSaveBtn);
  mlsSection.appendChild(mlsInputRow);

  // Load current MLS status from node (via getMaximaInfo)
  // This is the SOURCE OF TRUTH — what matters is whether node has staticmls: true
  if (typeof getMaximaInfo === 'function') {
    getMaximaInfo(function(err, info) {
      if (err || !info) {
        mlsStatus.textContent = '✗ Unable to check node status';
        mlsStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
        mlsStatus.style.color = 'var(--pico-del-color, #c0392b)';
        return;
      }

      if (info.staticmls === true) {
        mlsStatus.textContent = '✓ MLS configured on node';
        mlsStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
        mlsStatus.style.color = 'var(--pico-ins-color, #27ae60)';
      } else {
        mlsStatus.textContent = '✗ No MLS configured on node. Enter address and click "Apply to Node" below.';
        mlsStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
        mlsStatus.style.color = 'var(--pico-del-color, #c0392b)';
      }
    });
  } else {
    mlsStatus.textContent = '? Cannot verify MLS status';
  }

  root.appendChild(mlsSection);

  // ── Section 2: Register as Permanent ────────────────────────────────────
  var permanentSection = document.createElement('section');
  permanentSection.className = 'ma-section';
  permanentSection.style.cssText = 'margin-bottom:1.5rem;padding:1rem;background:var(--pico-card-sectionning-background-color,rgba(0,0,0,0.03));border-radius:0.5rem;';

  var permanentTitle = document.createElement('h3');
  permanentTitle.textContent = 'Register as Permanent User';
  permanentTitle.style.cssText = 'margin-top:0;margin-bottom:0.5rem;';
  permanentSection.appendChild(permanentTitle);

  var permanentDesc = document.createElement('p');
  permanentDesc.innerHTML = 'Creates a stable MAX# address on the MLS server. Other nodes can discover and contact you directly using this permanent address, even if your contact address changes. <strong>This feature is essential for both campaign creators and publishers.</strong>';
  permanentDesc.style.cssText = 'font-size:0.875rem;color:var(--pico-muted-color,#6c757d);margin:0.25rem 0 1rem;';
  permanentSection.appendChild(permanentDesc);

  // Status display for permanent registration
  var permanentStatusDisplay = document.createElement('div');
  permanentStatusDisplay.style.cssText = 'padding:0.75rem;margin-bottom:0.75rem;border-radius:0.375rem;font-family:monospace;font-size:0.8rem;border:1px solid var(--pico-muted-border-color);';
  permanentStatusDisplay.textContent = 'Checking registration status…';
  permanentSection.appendChild(permanentStatusDisplay);

  // Check if already registered
  MDS.keypair.get('CREATOR_PERMANENT_ROUTE', function(res) {
    if (res && res.status && res.value) {
      permanentStatusDisplay.textContent = '✓ Registered as permanent';
      permanentStatusDisplay.style.borderColor = 'var(--pico-ins-color, #27ae60)';
      permanentStatusDisplay.style.color = 'var(--pico-ins-color, #27ae60)';
    } else {
      permanentStatusDisplay.textContent = '✗ Not yet registered as permanent';
      permanentStatusDisplay.style.borderColor = 'var(--pico-del-color, #c0392b)';
      permanentStatusDisplay.style.color = 'var(--pico-del-color, #c0392b)';
    }
  });

  var permanentBtn = document.createElement('button');
  permanentBtn.textContent = 'Register as Permanent';
  permanentBtn.className = 'primary';
  permanentBtn.style.cssText = 'width:auto;margin:0;';

  var permanentStatus = document.createElement('small');
  permanentStatus.style.cssText = 'display:block;margin-top:0.5rem;';

  permanentBtn.addEventListener('click', function() {
    permanentBtn.disabled = true;
    permanentBtn.textContent = 'Registering…';
    permanentStatus.textContent = '';
    permanentStatus.style.color = '';

    if (typeof getMaximaInfo !== 'function') {
      permanentBtn.disabled = false;
      permanentBtn.textContent = 'Register as Permanent';
      permanentStatus.style.color = 'var(--pico-del-color,#c0392b)';
      permanentStatus.textContent = 'Error: getMaximaInfo() not available';
      return;
    }

    getMaximaInfo(function(err, info) {
      if (err) {
        permanentBtn.disabled = false;
        permanentBtn.textContent = 'Register as Permanent';
        permanentStatus.style.color = 'var(--pico-del-color,#c0392b)';
        permanentStatus.textContent = 'Error: ' + err.message;
        return;
      }

      var cmd = 'maxextra action:addpermanent publickey:' + info.publickey;
      MDS.cmd(cmd, function(res) {
        permanentBtn.disabled = false;
        permanentBtn.textContent = 'Register as Permanent';

        if (res.status) {
          // Success: now register the permanent route in MinimaAds
          if (typeof setCreatorMaximaRoute === 'function') {
            setCreatorMaximaRoute(function(err, route) {
              if (!err && route) {
                permanentStatus.style.color = 'var(--pico-ins-color,#27ae60)';
                permanentStatus.textContent = 'Success! Route registered: ' + route;
                permanentStatusDisplay.textContent = '✓ Registered as permanent';
                permanentStatusDisplay.style.borderColor = 'var(--pico-ins-color, #27ae60)';
                permanentStatusDisplay.style.color = 'var(--pico-ins-color, #27ae60)';
                setTimeout(function() { location.reload(); }, 1500);
              } else {
                permanentStatus.style.color = 'var(--pico-del-color,#c0392b)';
                permanentStatus.textContent = 'Error: ' + (err ? err.message : 'Make sure you have static MLS configured on your node (see Step 1 above)');
              }
            });
          }
        } else {
          permanentStatus.style.color = 'var(--pico-del-color,#c0392b)';
          permanentStatus.textContent = 'Error: ' + (res.error || 'Unknown error. Make sure you have static MLS configured.');
        }
      });
    });
  });

  permanentSection.appendChild(permanentBtn);
  permanentSection.appendChild(permanentStatus);
  root.appendChild(permanentSection);

  // ── Section 3: Finalise — Register Permanent Route in MinimaAds ─────────
  var routeSection = document.createElement('section');
  routeSection.className = 'ma-section';

  var routeTitle = mkSectionTitle('Finalise Route Registration');
  routeSection.appendChild(routeTitle);

  var routeDesc = document.createElement('p');
  routeDesc.textContent = 'After registering as permanent above, click the button below to save your MAX# permanent route into MinimaAds. This must be done once before creating campaigns or managing frames.';
  routeDesc.style.cssText = 'font-size:.875rem;color:var(--pico-muted-color,#6c757d);margin:.25rem 0 .75rem;';
  routeSection.appendChild(routeDesc);

  var routeStatus = document.createElement('small');
  routeStatus.style.cssText = 'display:block;margin-top:.5rem;';

  // Show current stored route if any
  var currentRouteEl = document.createElement('p');
  currentRouteEl.style.cssText = 'font-size:.8rem;color:var(--pico-muted-color,#6c757d);margin-bottom:.75rem;word-break:break-all;';
  currentRouteEl.textContent = 'Checking stored route…';
  routeSection.appendChild(currentRouteEl);

  if (typeof getCreatorMaximaRoute === 'function') {
    getCreatorMaximaRoute(function(route) {
      var el = currentRouteEl;
      if (!el) { return; }
      if (route) {
        el.textContent = 'Current route: ' + route;
        el.style.color = 'var(--pico-ins-color,#27ae60)';
      } else {
        el.textContent = 'No route registered yet.';
      }
    });
  } else {
    currentRouteEl.textContent = '';
  }

  var registerRouteBtn = document.createElement('button');
  registerRouteBtn.textContent = 'Check & Register Route';
  registerRouteBtn.style.cssText = 'width:auto;margin:0;';

  registerRouteBtn.addEventListener('click', function() {
    registerRouteBtn.disabled = true;
    registerRouteBtn.textContent = 'Checking…';
    routeStatus.textContent = '';
    routeStatus.style.color = '';

    if (typeof setCreatorMaximaRoute !== 'function') {
      registerRouteBtn.disabled = false;
      registerRouteBtn.textContent = 'Check & Register Route';
      routeStatus.style.color = 'var(--pico-del-color,#c0392b)';
      routeStatus.textContent = 'Error: setCreatorMaximaRoute() not available';
      return;
    }

    setCreatorMaximaRoute(function(err, route) {
      registerRouteBtn.disabled = false;
      registerRouteBtn.textContent = 'Check & Register Route';
      if (err) {
        routeStatus.style.color = 'var(--pico-del-color,#c0392b)';
        routeStatus.textContent = 'Error: ' + err.message + '. Make sure your static MLS is configured.';
      } else {
        routeStatus.style.color = 'var(--pico-ins-color,#27ae60)';
        routeStatus.textContent = 'Route registered: ' + route;
        currentRouteEl.textContent = 'Current route: ' + route;
        currentRouteEl.style.color = 'var(--pico-ins-color,#27ae60)';
      }
    });
  });

  routeSection.appendChild(registerRouteBtn);
  routeSection.appendChild(routeStatus);
  root.appendChild(routeSection);
}
