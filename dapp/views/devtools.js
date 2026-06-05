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

    var crInputRow = document.createElement('div');
    crInputRow.style.cssText = 'display:flex;gap:0.5rem;align-items:stretch;margin-top:0.25rem;';

    var crInput = document.createElement('input');
    crInput.type = 'text';
    crInput.placeholder = 'Custom permanent route (MAX#pk#mls)';
    crInput.style.cssText = 'flex:1;margin:0;padding:0 0.75rem;font-size:0.8rem;font-family:monospace;height:2.2rem;box-sizing:border-box;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);color:var(--pico-color);border-radius:0.375rem;';

    var crSaveBtn = document.createElement('button');
    crSaveBtn.textContent = 'Save';
    crSaveBtn.className = 'primary';
    crSaveBtn.style.cssText = 'width:auto;margin:0;padding:0 1.2rem;font-size:0.8rem;height:2.2rem;box-sizing:border-box;display:flex;align-items:center;justify-content:center;line-height:2.2rem;white-space:nowrap;';
    crSaveBtn.addEventListener('click', function() {
      var route = (crInput.value || '').trim();
      if (!route) {
        crStatus.textContent = 'ERROR: enter a permanent route first';
        crStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
        return;
      }
      if (route.indexOf('MAX#') !== 0) {
        crStatus.textContent = 'ERROR: route must start with MAX#';
        crStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
        return;
      }
      MDS.keypair.set('CREATOR_PERMANENT_ROUTE', route, function() {
        crStatus.textContent = 'CREATOR_PERMANENT_ROUTE set to: ' + route;
        crStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
        crInput.value = '';
      });
    });
    crInputRow.appendChild(crInput);
    crInputRow.appendChild(crSaveBtn);
    crSection.appendChild(crInputRow);

    panel.appendChild(crSection);

    // Section 1.5: MLS Server Configuration
    var mlsSection = document.createElement('section');
    mlsSection.style.cssText = 'background:var(--pico-card-sectionning-background-color, rgba(0,0,0,0.03));border:1px solid var(--pico-muted-border-color);border-radius:0.5rem;padding:1.25rem;display:flex;flex-direction:column;gap:0.75rem;margin:0;';

    var mlsTitle = document.createElement('strong');
    mlsTitle.textContent = 'MLS Server Configuration';
    mlsTitle.style.cssText = 'display:block;font-size:0.9rem;font-weight:700;color:var(--pico-primary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;';
    mlsSection.appendChild(mlsTitle);

    var mlsStatus = document.createElement('div');
    mlsStatus.id = 'ma-dev-mls-status';
    mlsStatus.style.cssText = 'font-family:monospace;font-size:0.75rem;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);padding:0.75rem;border-radius:0.375rem;margin:0;word-break:break-all;color:var(--pico-color);line-height:1.4;';
    mlsStatus.textContent = 'Loading MLS server address…';
    MDS.keypair.get('MLS_SERVER_ADDRESS', function(res) {
      var stored = (res && res.status && res.value) ? res.value : null;
      mlsStatus.textContent = stored
        ? 'Current MLS server: ' + stored
        : 'No MLS server configured yet.';
    });
    mlsSection.appendChild(mlsStatus);

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
      mlsBtn.disabled = true;
      mlsBtn.textContent = 'Saving…';
      var cmd = 'maxextra action:staticmls host:' + addr;
      MDS.cmd(cmd, function(cmdRes) {
        mlsBtn.disabled = false;
        mlsBtn.textContent = 'Save';
        if (cmdRes.status) {
          MDS.keypair.set('MLS_SERVER_ADDRESS', addr, function() {
            mlsStatus.textContent = 'MLS server applied and saved: ' + addr;
            mlsStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
            mlsInput.value = '';
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
        var p2pId = info.mls;
        MDS.cmd('maxextra action:staticmls host:' + p2pId, function(res) {
          mlsRegisterBtn.disabled = false;
          mlsRegisterBtn.textContent = 'Register This Node as MLS Server';
          if (res.status) {
            MDS.keypair.set('MLS_SERVER_ADDRESS', p2pId, function() {
              mlsStatus.textContent = 'MLS server registered successfully!\nThis node is now an MLS server.';
              mlsStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
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
