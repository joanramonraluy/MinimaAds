// DEV TOOL — Settings panel (Ctrl+Shift+D to toggle).
// Not intended for production; safe to ship (no server access, FE-only).

(function () {
  var _modal = null;

  function buildModal() {
    var overlay = document.createElement('div');
    overlay.id = 'ma-devtools';
    // Glassmorphism overlay with animation support
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15, 23, 42, 0.45);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s ease-in-out;';

    var panel = document.createElement('div');
    panel.style.cssText = 'background:var(--pico-card-background-color);color:var(--pico-color);border:1px solid var(--pico-muted-border-color);border-radius:1rem;padding:2rem;width:90%;max-width:550px;display:flex;flex-direction:column;gap:1.5rem;max-height:85vh;overflow-y:auto;box-shadow:0 20px 25px -5px rgba(0,0,0,0.15), 0 10px 10px -5px rgba(0,0,0,0.06);transform:scale(0.95);transition:transform 0.2s ease-in-out;';

    // Header
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--pico-muted-border-color);padding-bottom:0.75rem;';
    
    var title = document.createElement('h3');
    title.textContent = 'MinimaAds DevTools';
    title.style.cssText = 'margin:0;font-size:1.25rem;font-weight:700;color:var(--pico-primary);flex-grow:1;';

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.className = 'outline secondary';
    closeBtn.style.cssText = 'background:none;border:none;color:var(--pico-muted-color);cursor:pointer;font-size:1.25rem;padding:0 .5rem;margin:0;width:auto;height:auto;line-height:1;transition:color 0.15s;';
    closeBtn.addEventListener('mouseenter', function() { closeBtn.style.color = 'var(--pico-color)'; });
    closeBtn.addEventListener('mouseleave', function() { closeBtn.style.color = 'var(--pico-muted-color)'; });
    closeBtn.addEventListener('click', hideDevtools);

    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Section 1: Platform Key Configuration
    var pkSection = document.createElement('section');
    pkSection.style.cssText = 'background:var(--pico-card-sectionning-background-color, rgba(0,0,0,0.03));border:1px solid var(--pico-muted-border-color);border-radius:0.5rem;padding:1.25rem;display:flex;flex-direction:column;gap:0.75rem;margin:0;';

    var pkTitle = document.createElement('strong');
    pkTitle.textContent = 'Platform Key Configuration';
    pkTitle.style.cssText = 'display:block;font-size:0.9rem;font-weight:700;color:var(--pico-primary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;';
    pkSection.appendChild(pkTitle);

    var pkStatus = document.createElement('div');
    pkStatus.id = 'ma-dev-pk-status';
    pkStatus.style.cssText = 'font-family:monospace;font-size:0.75rem;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);padding:0.75rem;border-radius:0.375rem;margin:0;word-break:break-all;color:var(--pico-color);line-height:1.4;';
    pkStatus.textContent = 'Current PLATFORM_KEY: ' + (typeof PLATFORM_KEY !== 'undefined' && PLATFORM_KEY ? PLATFORM_KEY : '(not set)');
    pkSection.appendChild(pkStatus);

    var pkActions = document.createElement('div');
    pkActions.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;';

    var setSelfBtn = document.createElement('button');
    setSelfBtn.textContent = 'Set as Platform Node';
    setSelfBtn.className = 'primary';
    setSelfBtn.style.cssText = 'width:auto;margin:0;padding:0.45rem 0.9rem;font-size:0.8rem;line-height:1.2;';
    setSelfBtn.addEventListener('click', function() {
      setSelfBtn.disabled = true;
      setSelfBtn.textContent = 'Reading…';
      MDS.cmd('getaddress', function(res) {
        setSelfBtn.disabled = false;
        setSelfBtn.textContent = 'Set as Platform Node';
        if (!res || !res.status || !res.response || !res.response.address) {
          pkStatus.textContent = 'ERROR: could not read wallet address';
          pkStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
          return;
        }
        var addr = res.response.address;
        MDS.keypair.set('PLATFORM_KEY_OVERRIDE', addr, function() {
          PLATFORM_KEY = addr;
          pkStatus.textContent = 'PLATFORM_KEY set to: ' + addr + '\n(reload SW to apply)';
          pkStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
        });
      });
    });
    pkActions.appendChild(setSelfBtn);

    var clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear Override';
    clearBtn.className = 'outline secondary';
    clearBtn.style.cssText = 'width:auto;margin:0;padding:0.45rem 0.9rem;font-size:0.8rem;line-height:1.2;';
    clearBtn.addEventListener('click', function() {
      MDS.keypair.set('PLATFORM_KEY_OVERRIDE', '', function() {
        pkStatus.textContent = 'PLATFORM_KEY override cleared\n(reload SW to apply)';
        pkStatus.style.borderColor = 'var(--pico-muted-border-color)';
      });
    });
    pkActions.appendChild(clearBtn);

    var pkCopyBtn = document.createElement('button');
    pkCopyBtn.textContent = 'Copy Address';
    pkCopyBtn.className = 'outline secondary';
    pkCopyBtn.style.cssText = 'width:auto;margin:0;padding:0.45rem 0.9rem;font-size:0.8rem;line-height:1.2;';
    pkCopyBtn.addEventListener('click', function() {
      var currentKey = (typeof PLATFORM_KEY !== 'undefined' && PLATFORM_KEY) ? PLATFORM_KEY : '';
      if (!currentKey) {
        pkStatus.textContent = 'ERROR: No Platform Key is set to copy';
        pkStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
        return;
      }
      navigator.clipboard.writeText(currentKey);
      var oldText = pkStatus.textContent;
      pkStatus.textContent = 'Platform Key copied to clipboard!';
      pkStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
      setTimeout(function() {
        pkStatus.textContent = oldText;
        pkStatus.style.borderColor = 'var(--pico-muted-border-color)';
      }, 2000);
    });
    pkActions.appendChild(pkCopyBtn);

    pkSection.appendChild(pkActions);

    // Register Input row
    var extRow = document.createElement('div');
    extRow.style.cssText = 'display:flex;gap:0.5rem;align-items:stretch;margin-top:0.25rem;';
    
    var extInput = document.createElement('input');
    extInput.type = 'text';
    extInput.placeholder = 'Custom address (0xABC…)';
    extInput.style.cssText = 'flex:1;margin:0;padding:0 0.75rem;font-size:0.8rem;font-family:monospace;height:2.2rem;box-sizing:border-box;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);color:var(--pico-color);border-radius:0.375rem;';
    
    var extBtn = document.createElement('button');
    extBtn.textContent = 'Save';
    extBtn.className = 'primary';
    extBtn.style.cssText = 'width:auto;margin:0;padding:0 1.2rem;font-size:0.8rem;height:2.2rem;box-sizing:border-box;display:flex;align-items:center;justify-content:center;line-height:2.2rem;white-space:nowrap;';
    extBtn.addEventListener('click', function() {
      var pk = (extInput.value || '').trim();
      if (!pk) {
        pkStatus.textContent = 'ERROR: enter a wallet address first';
        pkStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
        return;
      }
      MDS.keypair.set('PLATFORM_KEY_OVERRIDE', pk, function() {
        pkStatus.textContent = 'PLATFORM_KEY set to: ' + pk + '\n(reload SW to apply)';
        pkStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
        extInput.value = '';
      });
    });
    extRow.appendChild(extInput);
    extRow.appendChild(extBtn);
    pkSection.appendChild(extRow);
    
    panel.appendChild(pkSection);

    // Section 1.5: MLS Server Configuration
    var mlsSection = document.createElement('section');
    mlsSection.style.cssText = 'background:var(--pico-card-sectionning-background-color, rgba(0,0,0,0.03));border:1px solid var(--pico-muted-border-color);border-radius:0.5rem;padding:1.25rem;display:flex;flex-direction:column;gap:0.75rem;margin:0;';

    var mlsTitle = document.createElement('strong');
    mlsTitle.textContent = 'MLS Server Configuration';
    mlsTitle.style.cssText = 'display:block;font-size:0.9rem;font-weight:700;color:var(--pico-primary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;';
    mlsSection.appendChild(mlsTitle);

    var mlsStatus = document.createElement('pre');
    mlsStatus.id = 'ma-dev-mls-status';
    mlsStatus.style.cssText = 'font-family:monospace;font-size:0.75rem;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);padding:0.75rem;border-radius:0.375rem;margin:0;word-break:break-all;color:var(--pico-color);line-height:1.4;white-space:pre-wrap;';
    mlsStatus.textContent = 'Loading MLS server address…';
    mlsSection.appendChild(mlsStatus);

    function updateMlsStatus() {
      if (typeof getMaximaInfo !== 'function') {
        mlsStatus.textContent = 'Error: getMaximaInfo function not available';
        return;
      }
      getMaximaInfo(function(err, info) {
        MDS.keypair.get('MLS_SERVER_ADDRESS', function(res) {
          var stored = (res && res.status && res.value) ? res.value : null;
          var text = '';
          text += '• DApp Stored MLS: ' + (stored || '(not set)') + '\n';
          if (err) {
            text += '• System Maxima Info: Error (' + err.message + ')';
          } else {
            text += '• System staticmls: ' + info.staticmls + '\n';
            text += '• System mls host: ' + (info.mls || '(none)') + '\n';
            text += '• System P2P identity: ' + (info.p2pidentity || info.contact || '(none)');
          }
          mlsStatus.textContent = text;
          
          var isOwnMls = info && (
            (info.p2pidentity && stored === info.p2pidentity) || 
            (info.localidentity && stored === info.localidentity) || 
            (info.contact && stored === info.contact)
          );
          if (isOwnMls) {
            mlsStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
            mlsStatus.style.color = 'var(--pico-ins-color, #27ae60)';
          } else if (stored) {
            mlsStatus.style.borderColor = 'var(--pico-primary)';
            mlsStatus.style.color = 'var(--pico-color)';
          } else {
            mlsStatus.style.borderColor = 'var(--pico-muted-border-color)';
            mlsStatus.style.color = 'var(--pico-color)';
          }
        });
      });
    }

    // Load initial status
    setTimeout(updateMlsStatus, 100);

    var mlsInputRow = document.createElement('div');
    mlsInputRow.style.cssText = 'display:flex;gap:0.5rem;align-items:stretch;';
    
    var mlsInput = document.createElement('input');
    mlsInput.type = 'text';
    mlsInput.placeholder = 'Mx...@host:port (your server MLS p2p-identity)';
    mlsInput.style.cssText = 'flex:1;min-width:200px;margin:0;padding:0 0.6rem;font-size:0.8rem;font-family:monospace;height:2.2rem;box-sizing:border-box;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);color:var(--pico-color);border-radius:0.375rem;';
    
    var mlsBtn = document.createElement('button');
    mlsBtn.textContent = 'Save';
    mlsBtn.className = 'primary';
    mlsBtn.style.cssText = 'width:auto;margin:0;padding:0 1.2rem;font-size:0.8rem;height:2.2rem;box-sizing:border-box;display:flex;align-items:center;justify-content:center;line-height:2.2rem;white-space:nowrap;';
    mlsBtn.addEventListener('click', function() {
      var addr = (mlsInput.value || '').trim();
      if (!addr) {
        mlsStatus.textContent = 'ERROR: enter an MLS server address first';
        mlsStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
        return;
      }
      if (addr.indexOf('MAX#') === 0) {
        var parts = addr.split('#');
        if (parts.length === 3) {
          addr = parts[2];
        }
      }
      mlsBtn.disabled = true;
      mlsBtn.textContent = 'Saving…';
      var cmd = 'maxextra action:staticmls host:' + addr;
      MDS.cmd(cmd, function(cmdRes) {
        mlsBtn.disabled = false;
        mlsBtn.textContent = 'Save';
        if (cmdRes.status) {
          MDS.keypair.set('MLS_SERVER_ADDRESS', addr, function() {
            mlsInput.value = '';
            updateMlsStatus();
          });
        } else {
          mlsStatus.textContent = 'ERROR: ' + (cmdRes.error || 'Failed to apply MLS server');
          mlsStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
        }
      });
    });
    mlsInputRow.appendChild(mlsInput);
    mlsInputRow.appendChild(mlsBtn);
    mlsSection.appendChild(mlsInputRow);

    var mlsActionRow = document.createElement('div');
    mlsActionRow.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;';

    var mlsRegisterBtn = document.createElement('button');
    mlsRegisterBtn.textContent = 'Register This Node as MLS Server';
    mlsRegisterBtn.className = 'primary';
    mlsRegisterBtn.style.cssText = 'width:auto;margin:0;padding:0.45rem 0.9rem;font-size:0.8rem;line-height:1.2;';
    mlsRegisterBtn.addEventListener('click', function() {
      mlsRegisterBtn.disabled = true;
      mlsRegisterBtn.textContent = 'Registering…';
      if (typeof getMaximaInfo !== 'function') {
        mlsStatus.textContent = 'ERROR: getMaximaInfo() not available (core/minima.js not loaded).';
        mlsStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
        mlsRegisterBtn.disabled = false;
        mlsRegisterBtn.textContent = 'Register This Node as MLS Server';
        return;
      }
      getMaximaInfo(function(err, info) {
        if (err) {
          mlsStatus.textContent = 'Error: ' + err.message;
          mlsStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
          mlsRegisterBtn.disabled = false;
          mlsRegisterBtn.textContent = 'Register This Node as MLS Server';
          return;
        }
        var p2pId = info.p2pidentity || info.localidentity || info.contact;
        MDS.cmd('maxextra action:staticmls host:' + p2pId, function(res) {
          mlsRegisterBtn.disabled = false;
          mlsRegisterBtn.textContent = 'Register This Node as MLS Server';
          if (res.status) {
            MDS.keypair.set('MLS_SERVER_ADDRESS', p2pId, function() {
              updateMlsStatus();
            });
          } else {
            mlsStatus.textContent = 'Error registering MLS server: ' + (res.error || 'unknown error');
            mlsStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
          }
        });
      });
    });
    mlsActionRow.appendChild(mlsRegisterBtn);

    var mlsCopyBtn = document.createElement('button');
    mlsCopyBtn.textContent = 'Copy Address';
    mlsCopyBtn.className = 'outline secondary';
    mlsCopyBtn.style.cssText = 'width:auto;margin:0;padding:0.45rem 0.9rem;font-size:0.8rem;line-height:1.2;';
    mlsCopyBtn.addEventListener('click', function() {
      MDS.keypair.get('MLS_SERVER_ADDRESS', function(res) {
        var stored = (res && res.status && res.value) ? res.value : null;
        if (!stored) {
          mlsStatus.textContent = 'ERROR: No MLS server configured to copy';
          mlsStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
          return;
        }
        navigator.clipboard.writeText(stored);
        var oldText = mlsStatus.textContent;
        mlsStatus.textContent = 'MLS server address copied to clipboard!';
        mlsStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
        setTimeout(function() {
          mlsStatus.textContent = oldText;
          mlsStatus.style.borderColor = 'var(--pico-muted-border-color)';
        }, 2000);
      });
    });
    mlsActionRow.appendChild(mlsCopyBtn);

    mlsSection.appendChild(mlsActionRow);

    panel.appendChild(mlsSection);

    // Section 1.5.5: MLS Permanent Registration
    var regSection = document.createElement('section');
    regSection.style.cssText = 'background:var(--pico-card-sectionning-background-color, rgba(0,0,0,0.03));border:1px solid var(--pico-muted-border-color);border-radius:0.5rem;padding:1.25rem;display:flex;flex-direction:column;gap:0.75rem;margin:0;';

    var regTitle = document.createElement('strong');
    regTitle.textContent = 'MLS Permanent Registration';
    regTitle.style.cssText = 'display:block;font-size:0.9rem;font-weight:700;color:var(--pico-primary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;';
    regSection.appendChild(regTitle);

    var regStatus = document.createElement('div');
    regStatus.id = 'ma-dev-reg-status';
    regStatus.style.cssText = 'font-family:monospace;font-size:0.75rem;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);padding:0.75rem;border-radius:0.375rem;margin:0;word-break:break-all;color:var(--pico-color);line-height:1.4;';
    regStatus.textContent = 'Checking MLS server registration...';
    regSection.appendChild(regStatus);

    if (typeof getMaximaInfo === 'function') {
      getMaximaInfo(function(err, info) {
        if (err) {
          regStatus.textContent = 'Not registered locally or failed to fetch Maxima info.';
        } else {
          regStatus.textContent = 'Your Maxima PK:\n' + info.publickey + '\n\nReady to register on the MLS server.';
        }
      });
    } else {
      regStatus.textContent = 'getMaximaInfo not loaded.';
    }

    var regActionRow = document.createElement('div');
    regActionRow.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;';

    var registerSelfKeyBtn = document.createElement('button');
    registerSelfKeyBtn.textContent = 'Register Self Key on MLS';
    registerSelfKeyBtn.className = 'primary';
    registerSelfKeyBtn.style.cssText = 'width:auto;margin:0;padding:0.45rem 0.9rem;font-size:0.8rem;line-height:1.2;';
    registerSelfKeyBtn.addEventListener('click', function() {
      registerSelfKeyBtn.disabled = true;
      registerSelfKeyBtn.textContent = 'Registering…';
      if (typeof getMaximaInfo !== 'function') {
        regStatus.textContent = 'ERROR: getMaximaInfo() not available (core/minima.js not loaded).';
        regStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
        registerSelfKeyBtn.disabled = false;
        registerSelfKeyBtn.textContent = 'Register Self Key on MLS';
        return;
      }
      getMaximaInfo(function(err, info) {
        if (err) {
          regStatus.textContent = 'Error: ' + err.message;
          regStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
          registerSelfKeyBtn.disabled = false;
          registerSelfKeyBtn.textContent = 'Register Self Key on MLS';
          return;
        }
        var pk = info.publickey;
        MDS.cmd('maxextra action:addpermanent publickey:' + pk, function(res) {
          registerSelfKeyBtn.disabled = false;
          registerSelfKeyBtn.textContent = 'Register Self Key on MLS';
          if (res.status) {
            regStatus.textContent = 'Success! Key registered on local MLS server:\n' + pk;
            regStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
          } else {
            regStatus.textContent = 'Error: ' + (res.error || 'unknown error');
            regStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
          }
        });
      });
    });
    regActionRow.appendChild(registerSelfKeyBtn);
    regSection.appendChild(regActionRow);

    panel.appendChild(regSection);

    // Section 1.2: Creator Permanent Route Configuration
    var crSection = document.createElement('section');
    crSection.style.cssText = 'background:var(--pico-card-sectionning-background-color, rgba(0,0,0,0.03));border:1px solid var(--pico-muted-border-color);border-radius:0.5rem;padding:1.25rem;display:flex;flex-direction:column;gap:0.75rem;margin:0;';

    var crTitle = document.createElement('strong');
    crTitle.textContent = 'Creator Permanent Route Configuration';
    crTitle.style.cssText = 'display:block;font-size:0.9rem;font-weight:700;color:var(--pico-primary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;';
    crSection.appendChild(crTitle);

    var crStatus = document.createElement('div');
    crStatus.id = 'ma-dev-cr-status';
    crStatus.style.cssText = 'font-family:monospace;font-size:0.75rem;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);padding:0.75rem;border-radius:0.375rem;margin:0;word-break:break-all;color:var(--pico-color);line-height:1.4;';
    crStatus.textContent = 'Loading Creator Permanent Route…';
    MDS.keypair.get('CREATOR_PERMANENT_ROUTE', function(res) {
      var route = (res && res.status && res.value) ? res.value : '';
      crStatus.textContent = route ? 'Current Route: ' + route : 'Current Route: (not set)';
    });
    crSection.appendChild(crStatus);

    var crActions = document.createElement('div');
    crActions.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;';

    var setSelfCrBtn = document.createElement('button');
    setSelfCrBtn.textContent = 'Set as Self Route';
    setSelfCrBtn.className = 'primary';
    setSelfCrBtn.style.cssText = 'width:auto;margin:0;padding:0.45rem 0.9rem;font-size:0.8rem;line-height:1.2;';
    setSelfCrBtn.addEventListener('click', function() {
      setSelfCrBtn.disabled = true;
      setSelfCrBtn.textContent = 'Setting…';
      if (typeof setCreatorMaximaRoute === 'function') {
        setCreatorMaximaRoute(function(err, route) {
          setSelfCrBtn.disabled = false;
          setSelfCrBtn.textContent = 'Set as Self Route';
          if (err) {
            crStatus.textContent = 'ERROR: ' + err.message;
            crStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
          } else {
            crStatus.textContent = 'Route set to: ' + route;
            crStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
          }
        });
      } else {
        setSelfCrBtn.disabled = false;
        setSelfCrBtn.textContent = 'Set as Self Route';
        crStatus.textContent = 'ERROR: setCreatorMaximaRoute not found';
        crStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
      }
    });
    crActions.appendChild(setSelfCrBtn);

    var clearCrBtn = document.createElement('button');
    clearCrBtn.textContent = 'Clear Route';
    clearCrBtn.className = 'outline secondary';
    clearCrBtn.style.cssText = 'width:auto;margin:0;padding:0.45rem 0.9rem;font-size:0.8rem;line-height:1.2;';
    clearCrBtn.addEventListener('click', function() {
      MDS.keypair.set('CREATOR_PERMANENT_ROUTE', '', function() {
        crStatus.textContent = 'Creator permanent route cleared';
        crStatus.style.borderColor = 'var(--pico-muted-border-color)';
      });
    });
    crActions.appendChild(clearCrBtn);

    var crCopyBtn = document.createElement('button');
    crCopyBtn.textContent = 'Copy Route';
    crCopyBtn.className = 'outline secondary';
    crCopyBtn.style.cssText = 'width:auto;margin:0;padding:0.45rem 0.9rem;font-size:0.8rem;line-height:1.2;';
    crCopyBtn.addEventListener('click', function() {
      MDS.keypair.get('CREATOR_PERMANENT_ROUTE', function(res) {
        var currentRoute = (res && res.status && res.value) ? res.value : '';
        if (!currentRoute) {
          crStatus.textContent = 'ERROR: No Creator Permanent Route is set to copy';
          crStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
          return;
        }
        navigator.clipboard.writeText(currentRoute);
        var oldText = crStatus.textContent;
        crStatus.textContent = 'Creator Permanent Route copied to clipboard!';
        crStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
        setTimeout(function() {
          crStatus.textContent = oldText;
          crStatus.style.borderColor = 'var(--pico-muted-border-color)';
        }, 2000);
      });
    });
    crActions.appendChild(crCopyBtn);

    crSection.appendChild(crActions);
    panel.appendChild(crSection);

    // ── Section 4: Platform Creator Route Configuration ───────────────────
    var pcDevSection = document.createElement('div');
    pcDevSection.style.cssText = 'border-top:1px dashed var(--pico-muted-border-color);padding-top:1rem;display:flex;flex-direction:column;gap:0.5rem;';

    var pcDevTitle = document.createElement('strong');
    pcDevTitle.textContent = 'Platform Creator Route Configuration';
    pcDevTitle.style.cssText = 'display:block;font-size:0.9rem;font-weight:700;color:var(--pico-primary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;';
    pcDevSection.appendChild(pcDevTitle);

    var pcDevStatus = document.createElement('div');
    pcDevStatus.id = 'ma-dev-pc-status';
    pcDevStatus.style.cssText = 'font-family:monospace;font-size:0.75rem;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);padding:0.75rem;border-radius:0.375rem;margin:0;word-break:break-all;color:var(--pico-color);line-height:1.4;';
    pcDevStatus.textContent = 'Loading Platform Creator Route…';
    MDS.keypair.get('MINIMAADS_CREATOR_ROUTE', function(res) {
      var route = (res && res.status && res.value) ? res.value : '';
      pcDevStatus.textContent = route ? 'Current Route: ' + route : 'Current Route: (not set)';
      if (route) {
        pcDevStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
      }
    });
    pcDevSection.appendChild(pcDevStatus);

    var pcDevInputRow = document.createElement('div');
    pcDevInputRow.style.cssText = 'display:flex;gap:0.5rem;align-items:center;';

    var pcDevInput = document.createElement('input');
    pcDevInput.type = 'text';
    pcDevInput.placeholder = 'Paste Platform Creator Route (MAX#...)';
    pcDevInput.style.cssText = 'flex:1;margin:0;font-size:0.8rem;height:2.2rem;';
    pcDevInputRow.appendChild(pcDevInput);

    var pcDevSaveBtn = document.createElement('button');
    pcDevSaveBtn.textContent = 'Save';
    pcDevSaveBtn.className = 'primary';
    pcDevSaveBtn.style.cssText = 'width:auto;margin:0;padding:0.45rem 0.9rem;font-size:0.8rem;line-height:1.2;height:2.2rem;';
    pcDevSaveBtn.addEventListener('click', function() {
      var route = (pcDevInput.value || '').trim();
      if (!route) {
        alert('Please enter a Maxima route');
        return;
      }
      if (route.indexOf('MAX#') !== 0) {
        alert('Invalid format. Route must start with MAX#');
        return;
      }
      pcDevSaveBtn.disabled = true;
      MDS.keypair.set('MINIMAADS_CREATOR_ROUTE', route, function() {
        pcDevSaveBtn.disabled = false;
        pcDevInput.value = '';
        pcDevStatus.textContent = 'Route set to: ' + route;
        pcDevStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
      });
    });
    pcDevInputRow.appendChild(pcDevSaveBtn);

    var pcDevClearBtn = document.createElement('button');
    pcDevClearBtn.textContent = 'Clear';
    pcDevClearBtn.className = 'outline secondary';
    pcDevClearBtn.style.cssText = 'width:auto;margin:0;padding:0.45rem 0.9rem;font-size:0.8rem;line-height:1.2;height:2.2rem;';
    pcDevClearBtn.addEventListener('click', function() {
      MDS.keypair.set('MINIMAADS_CREATOR_ROUTE', '', function() {
        pcDevStatus.textContent = 'Current Route: (not set)';
        pcDevStatus.style.borderColor = 'var(--pico-muted-border-color)';
      });
    });
    pcDevInputRow.appendChild(pcDevClearBtn);

    pcDevSection.appendChild(pcDevInputRow);
    panel.appendChild(pcDevSection);

    // ── Section 5: SQL Console ───────────────────────────────────────────
    var sqlSection = document.createElement('section');
    sqlSection.style.cssText = 'background:var(--pico-card-sectionning-background-color, rgba(0,0,0,0.03));border:1px solid var(--pico-muted-border-color);border-radius:0.5rem;padding:1.25rem;display:flex;flex-direction:column;gap:0.75rem;margin:0;';

    var sqlTitle = document.createElement('strong');
    sqlTitle.textContent = 'SQL Console';
    sqlTitle.style.cssText = 'display:block;font-size:0.9rem;font-weight:700;color:var(--pico-primary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;';
    sqlSection.appendChild(sqlTitle);

    var sqlDesc = document.createElement('span');
    sqlDesc.textContent = 'Execute raw SQL queries against the local MinimaAds H2 database.';
    sqlDesc.style.cssText = 'font-size:0.75rem;color:var(--pico-muted-color,#6c757d);';
    sqlSection.appendChild(sqlDesc);

    var sqlTextarea = document.createElement('textarea');
    sqlTextarea.placeholder = 'SELECT * FROM campaigns LIMIT 5;';
    sqlTextarea.style.cssText = 'width:100%;min-height:80px;font-family:monospace;font-size:0.8rem;margin:0;padding:0.5rem;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);color:var(--pico-color);border-radius:0.375rem;box-sizing:border-box;resize:vertical;';
    sqlSection.appendChild(sqlTextarea);

    var sqlBtnRow = document.createElement('div');
    sqlBtnRow.style.cssText = 'display:flex;gap:0.5rem;align-items:center;';

    var sqlRunBtn = document.createElement('button');
    sqlRunBtn.textContent = 'Run Query';
    sqlRunBtn.className = 'primary';
    sqlRunBtn.style.cssText = 'width:auto;margin:0;padding:0.45rem 0.9rem;font-size:0.8rem;line-height:1.2;';
    sqlBtnRow.appendChild(sqlRunBtn);

    var sqlClearBtn = document.createElement('button');
    sqlClearBtn.textContent = 'Clear';
    sqlClearBtn.className = 'outline secondary';
    sqlClearBtn.style.cssText = 'width:auto;margin:0;padding:0.45rem 0.9rem;font-size:0.8rem;line-height:1.2;';
    sqlBtnRow.appendChild(sqlClearBtn);

    var sqlCopyBtn = document.createElement('button');
    sqlCopyBtn.textContent = 'Copy Result';
    sqlCopyBtn.className = 'outline secondary';
    sqlCopyBtn.style.cssText = 'width:auto;margin:0;padding:0.45rem 0.9rem;font-size:0.8rem;line-height:1.2;display:none;';
    sqlBtnRow.appendChild(sqlCopyBtn);

    sqlSection.appendChild(sqlBtnRow);

    var sqlResult = document.createElement('pre');
    sqlResult.style.cssText = 'font-family:monospace;font-size:0.75rem;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);padding:0.75rem;border-radius:0.375rem;margin:0;word-break:break-all;white-space:pre-wrap;color:var(--pico-color);line-height:1.4;max-height:200px;overflow-y:auto;display:none;';
    sqlSection.appendChild(sqlResult);

    sqlRunBtn.addEventListener('click', function() {
      var query = (sqlTextarea.value || '').trim();
      if (!query) {
        alert('Please enter a SQL query');
        return;
      }
      sqlRunBtn.disabled = true;
      sqlRunBtn.textContent = 'Running…';
      sqlResult.style.display = 'block';
      sqlResult.textContent = 'Executing query…';
      sqlResult.style.borderColor = 'var(--pico-muted-border-color)';
      sqlCopyBtn.style.display = 'none';

      if (typeof sqlQuery !== 'function') {
        sqlRunBtn.disabled = false;
        sqlRunBtn.textContent = 'Run Query';
        sqlResult.textContent = 'Error: sqlQuery wrapper function not available (core/minima.js not loaded).';
        sqlResult.style.borderColor = 'var(--pico-del-color, #c0392b)';
        return;
      }

      sqlQuery(query, function(err, rows) {
        sqlRunBtn.disabled = false;
        sqlRunBtn.textContent = 'Run Query';
        if (err) {
          sqlResult.textContent = 'ERROR: ' + err;
          sqlResult.style.borderColor = 'var(--pico-del-color, #c0392b)';
        } else {
          sqlResult.textContent = JSON.stringify(rows, null, 2);
          sqlResult.style.borderColor = 'var(--pico-ins-color, #27ae60)';
          sqlCopyBtn.style.display = 'inline-block';
        }
      });
    });

    sqlCopyBtn.addEventListener('click', function() {
      var text = sqlResult.textContent;
      navigator.clipboard.writeText(text).then(function() {
        var oldText = sqlCopyBtn.textContent;
        sqlCopyBtn.textContent = '✓ Copied!';
        setTimeout(function() {
          sqlCopyBtn.textContent = oldText;
        }, 1500);
      }).catch(function(e) {
        alert('Failed to copy: ' + e);
      });
    });

    sqlClearBtn.addEventListener('click', function() {
      sqlTextarea.value = '';
      sqlResult.textContent = '';
      sqlResult.style.display = 'none';
      sqlResult.style.borderColor = 'var(--pico-muted-border-color)';
      sqlCopyBtn.style.display = 'none';
    });

    panel.appendChild(sqlSection);

    overlay.appendChild(panel);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) { hideDevtools(); }
    });

    return overlay;
  }

  function showDevtools() {
    if (!_modal) {
      _modal = buildModal();
      document.body.appendChild(_modal);
    }
    _modal.style.display = 'flex';
    // Force layout reflow for animation
    _modal.offsetHeight;
    _modal.style.opacity = '1';
    _modal.firstChild.style.transform = 'scale(1)';
  }

  function hideDevtools() {
    if (_modal) {
      _modal.style.opacity = '0';
      _modal.firstChild.style.transform = 'scale(0.95)';
      setTimeout(function() {
        if (_modal.style.opacity === '0') {
          _modal.style.display = 'none';
        }
      }, 200);
    }
  }

  function toggleDevtools() {
    if (!_modal || _modal.style.display === 'none') {
      showDevtools();
    } else {
      hideDevtools();
    }
  }

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      toggleDevtools();
    }
  });
})();
