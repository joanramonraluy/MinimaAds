// Settings section: Maxima Routes Configuration.
// Shared by Creator and Publisher setup flows.
// Rendered by renderSettings() when route is #settings/maxima-routes
// or when a Creator/Publisher view redirects here (no permanent route set).

function utf8ToHex(str) {
  var hex = '';
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if (code < 128) {
      hex += ('0' + code.toString(16)).slice(-2);
    } else if (code < 2048) {
      hex += ('0' + (192 | (code >> 6)).toString(16)).slice(-2);
      hex += ('0' + (128 | (code & 63)).toString(16)).slice(-2);
    } else {
      hex += ('0' + (224 | (code >> 12)).toString(16)).slice(-2);
      hex += ('0' + (128 | ((code >> 6) & 63)).toString(16)).slice(-2);
      hex += ('0' + (128 | (code & 63)).toString(16)).slice(-2);
    }
  }
  return hex;
}

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
    if (addr.indexOf('MAX#') === 0) {
      var parts = addr.split('#');
      if (parts.length === 3) {
        addr = parts[2];
      }
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

  // Load current MLS address from keypair
  MDS.keypair.get('MLS_SERVER_ADDRESS', function(res) {
    var savedAddr = (res && res.status && res.value) ? res.value : null;
    if (savedAddr) {
      mlsStatus.textContent = '✓ ' + savedAddr;
      mlsStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
      mlsStatus.style.color = 'var(--pico-ins-color, #27ae60)';
    } else {
      mlsStatus.textContent = '✗ No MLS address saved';
      mlsStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
      mlsStatus.style.color = 'var(--pico-del-color, #c0392b)';
    }
  });

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
  permanentStatusDisplay.style.cssText = 'padding:0.75rem;margin-bottom:0.75rem;border-radius:0.375rem;font-family:monospace;font-size:0.8rem;border:1px solid var(--pico-muted-border-color);word-break:break-all;';
  permanentStatusDisplay.textContent = 'Checking registration status…';
  permanentSection.appendChild(permanentStatusDisplay);

  var permanentBtn = document.createElement('button');
  permanentBtn.textContent = 'Register as Permanent';
  permanentBtn.className = 'primary';
  permanentBtn.style.cssText = 'width:auto;margin:0;';

  // Check if already registered
  MDS.keypair.get('USER_PERMANENT_ROUTE', function(res) {
    if (res && res.status && res.value) {
      permanentStatusDisplay.textContent = '✓ Registered permanent route: ' + res.value;
      permanentStatusDisplay.style.borderColor = 'var(--pico-ins-color, #27ae60)';
      permanentStatusDisplay.style.color = 'var(--pico-ins-color, #27ae60)';
      permanentBtn.textContent = 'Re-register as Permanent';
      permanentBtn.className = 'secondary outline';
    } else {
      permanentStatusDisplay.textContent = '✗ Not yet registered as permanent';
      permanentStatusDisplay.style.borderColor = 'var(--pico-del-color, #c0392b)';
      permanentStatusDisplay.style.color = 'var(--pico-del-color, #c0392b)';
      permanentBtn.textContent = 'Register as Permanent';
      permanentBtn.className = 'primary';
    }
  });

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

      permanentStatus.style.color = 'var(--pico-ins-color,#27ae60)';
      permanentStatus.textContent = 'Registering with MLS...';

      // Request SW to register permanent route (runs in background even if DApp closed)
      MDS.comms.solo(JSON.stringify({
        type: "DO_REGISTER_PERMANENT",
        publickey: info.publickey,
        requester_contact: info.contact || ''
      }));

      // Check route after 2 seconds (SW processes asynchronously)
      setTimeout(function() {
        permanentBtn.disabled = false;
        permanentBtn.textContent = 'Register as Permanent';

        if (typeof setCreatorMaximaRoute === 'function') {
          setCreatorMaximaRoute(function(err, route) {
            if (!err && route) {
              permanentStatus.style.color = 'var(--pico-ins-color,#27ae60)';
              permanentStatus.textContent = 'Success! Route registered: ' + route;
              permanentStatusDisplay.textContent = '✓ Registered permanent route: ' + route;
              permanentStatusDisplay.style.borderColor = 'var(--pico-ins-color, #27ae60)';
              permanentStatusDisplay.style.color = 'var(--pico-ins-color, #27ae60)';
              permanentBtn.textContent = 'Re-register as Permanent';
              permanentBtn.className = 'secondary outline';
              setTimeout(function() {
                if (typeof goHome === 'function') {
                  goHome();
                } else {
                  window.location.hash = 'viewer';
                }
                location.reload();
              }, 1500);
            } else {
              permanentStatus.style.color = 'var(--pico-del-color,#c0392b)';
              permanentStatus.textContent = 'Error retrieving route: ' + (err ? err.message : 'Check MLS configuration');
            }
          });
        }
      }, 2000);
    });
  });

  permanentSection.appendChild(permanentBtn);
  permanentSection.appendChild(permanentStatus);
  root.appendChild(permanentSection);

  // ── Section 3: MinimaAds Platform Creator Route Configuration ───────────
  var platformCreatorSection = document.createElement('section');
  platformCreatorSection.className = 'ma-section';
  platformCreatorSection.style.cssText = 'margin-top:1.5rem;padding:1rem;background:var(--pico-card-sectionning-background-color,rgba(0,0,0,0.03));border-radius:0.5rem;';

  var pcTitle = document.createElement('h3');
  pcTitle.textContent = 'MinimaAds Platform Creator Route';
  pcTitle.style.cssText = 'margin-top:0;margin-bottom:0.5rem;';
  platformCreatorSection.appendChild(pcTitle);

  var pcDesc = document.createElement('p');
  pcDesc.textContent = 'Register the stable Maxima route (MAX#...) of the MinimaAds platform creator node. This is used by campaign creators and publishers to route reward notifications correctly.';
  pcDesc.style.cssText = 'font-size:0.875rem;color:var(--pico-muted-color,#6c757d);margin:0.25rem 0 1rem;';
  platformCreatorSection.appendChild(pcDesc);

  // Status display for current route
  var pcStatus = document.createElement('div');
  pcStatus.style.cssText = 'padding:0.75rem;margin-bottom:0.75rem;border-radius:0.375rem;font-family:monospace;font-size:0.8rem;word-break:break-all;border:1px solid var(--pico-muted-border-color);';
  pcStatus.textContent = 'Loading…';
  platformCreatorSection.appendChild(pcStatus);

  // Input row for setting/updating
  var pcInputRow = document.createElement('div');
  pcInputRow.style.cssText = 'display:flex;gap:0.5rem;align-items:stretch;flex-wrap:wrap;';

  var pcInput = document.createElement('input');
  pcInput.type = 'text';
  pcInput.placeholder = 'MAX#pk#mls_address';
  pcInput.style.cssText = 'flex:1;min-width:200px;margin:0;';

  var pcSaveBtn = document.createElement('button');
  pcSaveBtn.textContent = 'Save Route';
  pcSaveBtn.className = 'primary';
  pcSaveBtn.style.cssText = 'width:auto;margin:0;white-space:nowrap;';

  var pcClearBtn = document.createElement('button');
  pcClearBtn.textContent = 'Clear';
  pcClearBtn.className = 'secondary';
  pcClearBtn.style.cssText = 'width:auto;margin:0;white-space:nowrap;';

  pcSaveBtn.addEventListener('click', function() {
    var route = (pcInput.value || '').trim();
    if (!route) {
      alert('Please enter a Maxima route');
      return;
    }
    if (route.indexOf('MAX#') !== 0) {
      alert('Invalid format. Route must start with MAX#');
      return;
    }
    pcSaveBtn.disabled = true;
    MDS.keypair.set('MINIMAADS_CREATOR_ROUTE', route, function() {
      pcSaveBtn.disabled = false;
      pcInput.value = '';
      pcStatus.textContent = '✓ Saved Creator Route: ' + route;
      pcStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
      pcStatus.style.color = 'var(--pico-ins-color, #27ae60)';
    });
  });

  pcClearBtn.addEventListener('click', function() {
    MDS.keypair.set('MINIMAADS_CREATOR_ROUTE', '', function() {
      pcStatus.textContent = '✗ No Platform Creator Route saved';
      pcStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
      pcStatus.style.color = 'var(--pico-del-color, #c0392b)';
    });
  });

  pcInputRow.appendChild(pcInput);
  pcInputRow.appendChild(pcSaveBtn);
  pcInputRow.appendChild(pcClearBtn);
  platformCreatorSection.appendChild(pcInputRow);

  // Load currently saved Platform Creator Route
  MDS.keypair.get('MINIMAADS_CREATOR_ROUTE', function(res) {
    var savedRoute = (res && res.status && res.value) ? res.value : null;
    if (savedRoute) {
      pcStatus.textContent = '✓ ' + savedRoute;
      pcStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
      pcStatus.style.color = 'var(--pico-ins-color, #27ae60)';
    } else {
      pcStatus.textContent = '✗ No Platform Creator Route saved';
      pcStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
      pcStatus.style.color = 'var(--pico-del-color, #c0392b)';
    }
  });

  root.appendChild(platformCreatorSection);
}
