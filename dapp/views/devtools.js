// DEV TOOL — Settings panel (Ctrl+Shift+D to toggle).
// Not intended for production; safe to ship (no server access, FE-only).

(function () {
  var _modal = null;

  function buildModal() {
    var overlay = document.createElement('div');
    overlay.id = 'ma-devtools';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15, 23, 42, 0.45);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s ease-in-out;';

    var panel = document.createElement('div');
    panel.style.cssText = 'background:var(--pico-card-background-color);color:var(--pico-color);border:1px solid var(--pico-muted-border-color);border-radius:1rem;padding:2rem;width:95%;max-width:600px;display:flex;flex-direction:column;gap:1.5rem;max-height:85vh;overflow-y:auto;box-shadow:0 20px 25px -5px rgba(0,0,0,0.15), 0 10px 10px -5px rgba(0,0,0,0.06);transform:scale(0.95);transition:transform 0.2s ease-in-out;';

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

    // Helpers for Keypair Inspector
    var kpListContainer = document.createElement('div');
    kpListContainer.style.cssText = 'display:flex;flex-direction:column;gap:0.4rem;';

    var kpRows = {};

    function addKpRow(keyName) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-direction:column;gap:0.15rem;font-family:monospace;font-size:0.75rem;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);padding:0.5rem;border-radius:0.375rem;';
      
      var nameEl = document.createElement('strong');
      nameEl.textContent = keyName;
      nameEl.style.color = 'var(--pico-primary)';
      row.appendChild(nameEl);

      var valEl = document.createElement('span');
      valEl.style.cssText = 'word-break:break-all;color:var(--pico-muted-color,#6c757d);';
      valEl.textContent = 'Loading…';
      row.appendChild(valEl);

      row.valEl = valEl;
      kpRows[keyName] = row;
      kpListContainer.appendChild(row);
    }

    function refreshKeypairInspector() {
      Object.keys(kpRows).forEach(function(keyName) {
        var valEl = kpRows[keyName].valEl;
        MDS.keypair.get(keyName, function(res) {
          var val = (res && res.status && res.value) ? res.value : null;
          valEl.textContent = val || '(not set)';
          if (val) {
            valEl.style.color = 'var(--pico-color)';
          } else {
            valEl.style.color = 'var(--pico-muted-color,#6c757d)';
          }
        });
      });
    }

    // ==========================================
    // SECTION 1: MLS Configuration
    // ==========================================
    var mlsSec = document.createElement('section');
    mlsSec.style.cssText = 'background:var(--pico-card-sectionning-background-color, rgba(0,0,0,0.02));border:1px solid var(--pico-muted-border-color);border-left:4px solid var(--pico-primary);border-radius:0.75rem;padding:1.25rem;display:flex;flex-direction:column;gap:1.25rem;margin:0;';

    var mlsTitle = document.createElement('strong');
    mlsTitle.textContent = '1. MLS';
    mlsTitle.style.cssText = 'display:block;font-size:0.95rem;font-weight:700;color:var(--pico-primary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.1rem;';
    mlsSec.appendChild(mlsTitle);

    // Sub-item 1.1: MLS Server Node & Permanent Registration
    var selfMlsSub = document.createElement('div');
    selfMlsSub.style.cssText = 'display:flex;flex-direction:column;gap:0.4rem;';
    
    var selfMlsSubTitle = document.createElement('span');
    selfMlsSubTitle.textContent = '1.1 MLS Server Node';
    selfMlsSubTitle.style.cssText = 'font-size:0.75rem;font-weight:700;color:var(--pico-muted-color);text-transform:uppercase;letter-spacing:0.05em;';
    selfMlsSub.appendChild(selfMlsSubTitle);

    var selfMlsActions = document.createElement('div');
    selfMlsActions.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;';

    var mlsRegisterBtn = document.createElement('button');
    mlsRegisterBtn.textContent = 'Register This Node as MLS Server';
    mlsRegisterBtn.className = 'primary';
    mlsRegisterBtn.style.cssText = 'width:auto;margin:0;padding:0.4rem 0.8rem;font-size:0.75rem;line-height:1.2;';
    mlsRegisterBtn.addEventListener('click', function() {
      mlsRegisterBtn.disabled = true;
      mlsRegisterBtn.textContent = 'Registering…';
      getMaximaInfo(function(err, info) {
        if (err) {
          mlsRegisterBtn.disabled = false;
          mlsRegisterBtn.textContent = '✕ Error: ' + err.message;
          setTimeout(function() {
            mlsRegisterBtn.textContent = 'Register This Node as MLS Server';
          }, 2000);
          return;
        }
        var p2pId = info.p2pidentity || info.localidentity || info.contact;
        MDS.cmd('maxextra action:staticmls host:' + p2pId, function(res) {
          mlsRegisterBtn.disabled = false;
          if (res.status) {
            mlsRegisterBtn.textContent = '✓ Registered!';
            MDS.keypair.set('MLS_SERVER_ADDRESS', p2pId, function() {
              // Implicitly enable relay: a node that acts as MLS server
              // must also process REGISTER_PERMANENT_REQUEST from other nodes.
              MDS.keypair.set('MINIMAADS_ALLOW_RELAY', 'true', function() {
                updateMlsStatus();
                refreshKeypairInspector();
              });
            });
          } else {
            mlsRegisterBtn.textContent = '✕ Failed: ' + (res.error || 'unknown');
          }
          setTimeout(function() {
            mlsRegisterBtn.textContent = 'Register This Node as MLS Server';
          }, 2000);
        });
      });
    });
    selfMlsActions.appendChild(mlsRegisterBtn);

    var mlsCopyBtn = document.createElement('button');
    mlsCopyBtn.textContent = 'Copy Server Address';
    mlsCopyBtn.className = 'outline secondary';
    mlsCopyBtn.style.cssText = 'width:auto;margin:0;padding:0.4rem 0.8rem;font-size:0.75rem;line-height:1.2;';
    mlsCopyBtn.addEventListener('click', function() {
      MDS.keypair.get('MLS_SERVER_ADDRESS', function(res) {
        var stored = (res && res.status && res.value) ? res.value : null;
        if (!stored) {
          mlsCopyBtn.textContent = '✕ No Address';
          setTimeout(function() {
            mlsCopyBtn.textContent = 'Copy Server Address';
          }, 1500);
          return;
        }
        navigator.clipboard.writeText(stored);
        mlsCopyBtn.textContent = '✓ Copied!';
        setTimeout(function() {
          mlsCopyBtn.textContent = 'Copy Server Address';
        }, 1500);
      });
    });
    selfMlsActions.appendChild(mlsCopyBtn);
    selfMlsSub.appendChild(selfMlsActions);
    mlsSec.appendChild(selfMlsSub);

    // Sub-item 1.2: Connect to MLS Server
    var connMlsSub = document.createElement('div');
    connMlsSub.style.cssText = 'display:flex;flex-direction:column;gap:0.4rem;border-top:1px dashed var(--pico-muted-border-color);padding-top:0.75rem;';

    var connMlsSubTitle = document.createElement('span');
    connMlsSubTitle.textContent = '1.2 Connect to MLS Server';
    connMlsSubTitle.style.cssText = 'font-size:0.75rem;font-weight:700;color:var(--pico-muted-color);text-transform:uppercase;letter-spacing:0.05em;';
    connMlsSub.appendChild(connMlsSubTitle);

    var mlsStatus = document.createElement('pre');
    mlsStatus.id = 'ma-dev-mls-status';
    mlsStatus.style.cssText = 'font-family:monospace;font-size:0.75rem;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);padding:0.6rem 0.75rem;border-radius:0.375rem;margin:0;word-break:break-all;color:var(--pico-color);line-height:1.4;white-space:pre-wrap;';
    mlsStatus.textContent = 'Loading MLS server address…';
    connMlsSub.appendChild(mlsStatus);

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
          
          if (stored) {
            mlsStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
            mlsStatus.style.color = 'var(--pico-ins-color, #27ae60)';
          } else {
            mlsStatus.style.borderColor = 'var(--pico-muted-border-color)';
            mlsStatus.style.color = 'var(--pico-color)';
          }
        });
      });
    }
    setTimeout(updateMlsStatus, 100);

    var mlsInputRow = document.createElement('div');
    mlsInputRow.style.cssText = 'display:flex;gap:0.5rem;align-items:stretch;';
    var mlsInput = document.createElement('input');
    mlsInput.type = 'text';
    mlsInput.placeholder = 'Paste server MLS address (Mx...@host:port)';
    mlsInput.style.cssText = 'flex:1;min-width:200px;margin:0;padding:0 0.5rem;font-size:0.75rem;font-family:monospace;height:2rem;box-sizing:border-box;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);color:var(--pico-color);border-radius:0.375rem;';
    var mlsBtn = document.createElement('button');
    mlsBtn.textContent = 'Connect';
    mlsBtn.className = 'primary';
    mlsBtn.style.cssText = 'width:auto;margin:0;padding:0 1rem;font-size:0.75rem;height:2rem;box-sizing:border-box;display:flex;align-items:center;justify-content:center;line-height:2rem;white-space:nowrap;';
    mlsBtn.addEventListener('click', function() {
      var addr = (mlsInput.value || '').trim();
      if (!addr) {
        mlsBtn.textContent = '✕ Empty!';
        setTimeout(function() {
          mlsBtn.textContent = 'Connect';
        }, 1500);
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
        if (cmdRes.status) {
          mlsBtn.textContent = '✓ Connected!';
          MDS.keypair.set('MLS_SERVER_ADDRESS', addr, function() {
            mlsInput.value = '';
            updateMlsStatus();
            refreshKeypairInspector();
          });
        } else {
          mlsBtn.textContent = '✕ Failed!';
        }
        setTimeout(function() {
          mlsBtn.textContent = 'Connect';
        }, 1500);
      });
    });
    mlsInputRow.appendChild(mlsInput);
    mlsInputRow.appendChild(mlsBtn);
    connMlsSub.appendChild(mlsInputRow);
    mlsSec.appendChild(connMlsSub);



    panel.appendChild(mlsSec);

    // ==========================================
    // SECTION 2: Minima Foundation Fee Address (3%)
    // ==========================================
    var foundationSec = document.createElement('section');
    foundationSec.style.cssText = 'background:var(--pico-card-sectionning-background-color, rgba(0,0,0,0.02));border:1px solid var(--pico-muted-border-color);border-left:4px solid #0ea5e9;border-radius:0.75rem;padding:1.25rem;display:flex;flex-direction:column;gap:1.25rem;margin:0;';

    var foundationTitle = document.createElement('strong');
    foundationTitle.textContent = '2. Minima Foundation Fee Address (3%)';
    foundationTitle.style.cssText = 'display:block;font-size:0.95rem;font-weight:700;color:#0ea5e9;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.1rem;';
    foundationSec.appendChild(foundationTitle);

    var fkDesc = document.createElement('span');
    fkDesc.textContent = 'Wallet address that receives the 3% Minima Foundation fee on each campaign. Leave unset to disable foundation fee (MVP mode).';
    fkDesc.style.cssText = 'font-size:0.7rem;color:var(--pico-muted-color,#6c757d);';
    foundationSec.appendChild(fkDesc);

    var fkStatus = document.createElement('pre');
    fkStatus.id = 'ma-dev-fk-status';
    fkStatus.style.cssText = 'font-family:monospace;font-size:0.75rem;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);padding:0.6rem 0.75rem;border-radius:0.375rem;margin:0;word-break:break-all;color:var(--pico-color);line-height:1.4;';
    fkStatus.textContent = 'Loading Foundation Key…';

    function updateFoundationKeyStatus() {
      MDS.keypair.get('FOUNDATION_KEY_OVERRIDE', function(res) {
        var override = (res && res.status && res.value) ? res.value : '';
        var activeKey = override || (typeof FOUNDATION_KEY !== 'undefined' && FOUNDATION_KEY ? FOUNDATION_KEY : '');

        var displayLabel = override ? 'Current FOUNDATION_KEY (overridden): ' + activeKey : 'Current FOUNDATION_KEY: ' + (activeKey || '(not set)');
        fkStatus.textContent = displayLabel;

        if (activeKey) {
          fkStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
          fkStatus.style.color = 'var(--pico-ins-color, #27ae60)';
        } else {
          fkStatus.style.borderColor = 'var(--pico-muted-border-color)';
          fkStatus.style.color = 'var(--pico-color)';
        }
      });
    }
    setTimeout(updateFoundationKeyStatus, 100);
    foundationSec.appendChild(fkStatus);

    var fkActions = document.createElement('div');
    fkActions.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;';

    var fkSetSelfBtn = document.createElement('button');
    fkSetSelfBtn.textContent = 'Set Self Wallet';
    fkSetSelfBtn.className = 'primary';
    fkSetSelfBtn.style.cssText = 'width:auto;margin:0;padding:0.4rem 0.8rem;font-size:0.75rem;line-height:1.2;background-color:#0ea5e9;border-color:#0ea5e9;';
    fkSetSelfBtn.addEventListener('click', function() {
      fkSetSelfBtn.disabled = true;
      fkSetSelfBtn.textContent = 'Reading…';
      MDS.cmd('getaddress', function(res) {
        fkSetSelfBtn.disabled = false;
        fkSetSelfBtn.textContent = 'Set Self Wallet';
        if (!res || !res.status || !res.response || !res.response.address) {
          fkStatus.textContent = 'ERROR: could not read wallet address';
          fkStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
          fkStatus.style.color = 'var(--pico-del-color, #c0392b)';
          return;
        }
        var addr = res.response.address;
        if (typeof isHexKey === 'function' && !isHexKey(addr)) {
          fkStatus.textContent = 'ERROR: derived address is invalid hex';
          fkStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
          fkStatus.style.color = 'var(--pico-del-color, #c0392b)';
          return;
        }
        MDS.keypair.set('FOUNDATION_KEY_OVERRIDE', addr, function() {
          FOUNDATION_KEY = addr;
          updateFoundationKeyStatus();
          refreshKeypairInspector();
        });
      });
    });
    fkActions.appendChild(fkSetSelfBtn);

    var fkClearBtn = document.createElement('button');
    fkClearBtn.textContent = 'Clear Override';
    fkClearBtn.className = 'outline secondary';
    fkClearBtn.style.cssText = 'width:auto;margin:0;padding:0.4rem 0.8rem;font-size:0.75rem;line-height:1.2;';
    fkClearBtn.addEventListener('click', function() {
      MDS.keypair.set('FOUNDATION_KEY_OVERRIDE', '', function() {
        FOUNDATION_KEY = null;
        updateFoundationKeyStatus();
        refreshKeypairInspector();
      });
    });
    fkActions.appendChild(fkClearBtn);

    var fkCopyBtn = document.createElement('button');
    fkCopyBtn.textContent = 'Copy';
    fkCopyBtn.className = 'outline secondary';
    fkCopyBtn.style.cssText = 'width:auto;margin:0;padding:0.4rem 0.8rem;font-size:0.75rem;line-height:1.2;';
    fkCopyBtn.addEventListener('click', function() {
      MDS.keypair.get('FOUNDATION_KEY_OVERRIDE', function(res) {
        var override = (res && res.status && res.value) ? res.value : '';
        var currentKey = override || (typeof FOUNDATION_KEY !== 'undefined' && FOUNDATION_KEY ? FOUNDATION_KEY : '');
        if (!currentKey) {
          fkCopyBtn.textContent = '✕ No Key';
          setTimeout(function() { fkCopyBtn.textContent = 'Copy'; }, 1500);
          return;
        }
        navigator.clipboard.writeText(currentKey);
        fkCopyBtn.textContent = '✓ Copied!';
        setTimeout(function() { fkCopyBtn.textContent = 'Copy'; }, 1500);
      });
    });
    fkActions.appendChild(fkCopyBtn);
    foundationSec.appendChild(fkActions);

    var fkRow = document.createElement('div');
    fkRow.style.cssText = 'display:flex;gap:0.5rem;align-items:stretch;';
    var fkInput = document.createElement('input');
    fkInput.type = 'text';
    fkInput.placeholder = 'Or paste custom foundation address (0xABC…)';
    fkInput.style.cssText = 'flex:1;margin:0;padding:0 0.5rem;font-size:0.75rem;font-family:monospace;height:2rem;box-sizing:border-box;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);color:var(--pico-color);border-radius:0.375rem;';
    var fkSaveBtn = document.createElement('button');
    fkSaveBtn.textContent = 'Save';
    fkSaveBtn.className = 'primary';
    fkSaveBtn.style.cssText = 'width:auto;margin:0;padding:0 1rem;font-size:0.75rem;height:2rem;box-sizing:border-box;display:flex;align-items:center;justify-content:center;line-height:2rem;white-space:nowrap;background-color:#0ea5e9;border-color:#0ea5e9;';
    fkSaveBtn.addEventListener('click', function() {
      var fk = (fkInput.value || '').trim();
      if (!fk) {
        fkStatus.textContent = 'ERROR: enter a wallet address first';
        fkStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
        fkStatus.style.color = 'var(--pico-del-color, #c0392b)';
        return;
      }
      if (typeof isHexKey === 'function' && !isHexKey(fk)) {
        fkStatus.textContent = 'ERROR: invalid wallet address (must start with 0x and be hex)';
        fkStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
        fkStatus.style.color = 'var(--pico-del-color, #c0392b)';
        return;
      }
      MDS.keypair.set('FOUNDATION_KEY_OVERRIDE', fk, function() {
        FOUNDATION_KEY = fk;
        updateFoundationKeyStatus();
        fkInput.value = '';
        refreshKeypairInspector();
      });
    });
    fkRow.appendChild(fkInput);
    fkRow.appendChild(fkSaveBtn);
    foundationSec.appendChild(fkRow);

    panel.appendChild(foundationSec);

    // ==========================================
    // SECTION 3: MinimaAds Creator Configuration
    // ==========================================
    var creatorSec = document.createElement('section');
    creatorSec.style.cssText = 'background:var(--pico-card-sectionning-background-color, rgba(0,0,0,0.02));border:1px solid var(--pico-muted-border-color);border-left:4px solid #a855f7;border-radius:0.75rem;padding:1.25rem;display:flex;flex-direction:column;gap:1.25rem;margin:0;';

    var creatorTitle = document.createElement('strong');
    creatorTitle.textContent = '3. MinimaAds Creator';
    creatorTitle.style.cssText = 'display:block;font-size:0.95rem;font-weight:700;color:#a855f7;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.1rem;';
    creatorSec.appendChild(creatorTitle);

    // Sub-item 3.1: Platform Creator Route (MinimaAds Developer)
    var pcDevSub = document.createElement('div');
    pcDevSub.style.cssText = 'display:flex;flex-direction:column;gap:0.4rem;';

    var pcDevSubTitle = document.createElement('span');
    pcDevSubTitle.textContent = '3.1 Platform Creator Route (MinimaAds Developer)';
    pcDevSubTitle.style.cssText = 'font-size:0.75rem;font-weight:700;color:var(--pico-muted-color);text-transform:uppercase;letter-spacing:0.05em;';
    pcDevSub.appendChild(pcDevSubTitle);

    var registerPlatformBtn = document.createElement('button');
    registerPlatformBtn.textContent = 'Register as Permanent User';
    registerPlatformBtn.className = 'primary';
    registerPlatformBtn.style.cssText = 'width:auto;margin:0;padding:0.4rem 0.8rem;font-size:0.75rem;line-height:1.2;background-color:#a855f7;border-color:#a855f7;align-self:flex-start;';
    registerPlatformBtn.addEventListener('click', function() {
      registerPlatformBtn.disabled = true;
      registerPlatformBtn.textContent = 'Registering…';
      getMaximaInfo(function(err, info) {
        if (err) {
          registerPlatformBtn.disabled = false;
          registerPlatformBtn.textContent = 'Register as Permanent User';
          pcDevStatus.textContent = 'ERROR: ' + err.message;
          pcDevStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
          pcDevStatus.style.color = 'var(--pico-del-color, #c0392b)';
          return;
        }
        
        MDS.comms.solo(JSON.stringify({
          type: "DO_REGISTER_PERMANENT",
          publickey: info.publickey,
          requester_contact: info.contact || ''
        }));

        setTimeout(function() {
          registerPlatformBtn.disabled = false;
          registerPlatformBtn.textContent = 'Register as Permanent User';
          setCreatorMaximaRoute(function(err2, route) {
            if (err2) {
              pcDevStatus.textContent = 'ERROR: ' + err2.message;
              pcDevStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
              pcDevStatus.style.color = 'var(--pico-del-color, #c0392b)';
            } else {
              MDS.keypair.set('MINIMAADS_CREATOR_ROUTE', route, function() {
                updatePcDevStatus();
                refreshKeypairInspector();
              });
            }
          });
        }, 2000);
      });
    });
    pcDevSub.appendChild(registerPlatformBtn);

    var pcDevStatus = document.createElement('div');
    pcDevStatus.id = 'ma-dev-pc-status';
    pcDevStatus.style.cssText = 'font-family:monospace;font-size:0.75rem;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);padding:0.6rem 0.75rem;border-radius:0.375rem;margin:0;word-break:break-all;color:var(--pico-color);line-height:1.4;';
    pcDevStatus.textContent = 'Loading Platform Creator Route…';
    
    function updatePcDevStatus() {
      MDS.keypair.get('MINIMAADS_CREATOR_ROUTE', function(res) {
        var route = (res && res.status && res.value) ? res.value : '';
        pcDevStatus.textContent = route ? 'Current Route: ' + route : 'Current Route: (not set)';
        if (route) {
          pcDevStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
          pcDevStatus.style.color = 'var(--pico-ins-color, #27ae60)';
        } else {
          pcDevStatus.style.borderColor = 'var(--pico-muted-border-color)';
          pcDevStatus.style.color = 'var(--pico-color)';
        }
      });
    }
    setTimeout(updatePcDevStatus, 100);
    pcDevSub.appendChild(pcDevStatus);

    var pcDevCopyBtn = document.createElement('button');
    pcDevCopyBtn.textContent = 'Copy';
    pcDevCopyBtn.className = 'outline secondary';
    pcDevCopyBtn.style.cssText = 'width:auto;margin:0;padding:0.4rem 0.8rem;font-size:0.75rem;line-height:1.2;align-self:flex-start;';
    pcDevCopyBtn.addEventListener('click', function() {
      MDS.keypair.get('MINIMAADS_CREATOR_ROUTE', function(res) {
        var currentRoute = (res && res.status && res.value) ? res.value : '';
        if (!currentRoute) {
          pcDevCopyBtn.textContent = '✕ No Route';
          setTimeout(function() { pcDevCopyBtn.textContent = 'Copy'; }, 1500);
          return;
        }
        navigator.clipboard.writeText(currentRoute);
        pcDevCopyBtn.textContent = '✓ Copied!';
        setTimeout(function() { pcDevCopyBtn.textContent = 'Copy'; }, 1500);
      });
    });
    pcDevSub.appendChild(pcDevCopyBtn);

    var pcDevInputRow = document.createElement('div');
    pcDevInputRow.style.cssText = 'display:flex;gap:0.5rem;align-items:center;';
    var pcDevInput = document.createElement('input');
    pcDevInput.type = 'text';
    pcDevInput.placeholder = 'Paste Platform Creator Route (MAX#...)';
    pcDevInput.style.cssText = 'flex:1;margin:0;font-size:0.75rem;height:2rem;box-sizing:border-box;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);color:var(--pico-color);border-radius:0.375rem;';
    var pcDevSaveBtn = document.createElement('button');
    pcDevSaveBtn.textContent = 'Save';
    pcDevSaveBtn.className = 'primary';
    pcDevSaveBtn.style.cssText = 'width:auto;margin:0;padding:0 1rem;font-size:0.75rem;height:2rem;box-sizing:border-box;display:flex;align-items:center;justify-content:center;line-height:2rem;white-space:nowrap;background-color:#a855f7;border-color:#a855f7;';
    pcDevSaveBtn.addEventListener('click', function() {
      var route = (pcDevInput.value || '').trim();
      if (!route) {
        pcDevSaveBtn.textContent = '✕ Empty';
        setTimeout(function() { pcDevSaveBtn.textContent = 'Save'; }, 1500);
        return;
      }
      if (route.indexOf('MAX#') !== 0) {
        pcDevSaveBtn.textContent = '✕ Invalid';
        setTimeout(function() { pcDevSaveBtn.textContent = 'Save'; }, 1500);
        return;
      }
      pcDevSaveBtn.disabled = true;
      MDS.keypair.set('MINIMAADS_CREATOR_ROUTE', route, function() {
        pcDevSaveBtn.disabled = false;
        pcDevSaveBtn.textContent = '✓ Saved';
        pcDevInput.value = '';
        updatePcDevStatus();
        refreshKeypairInspector();
        setTimeout(function() { pcDevSaveBtn.textContent = 'Save'; }, 1500);
      });
    });
    var pcDevClearBtn = document.createElement('button');
    pcDevClearBtn.textContent = 'Clear';
    pcDevClearBtn.className = 'outline secondary';
    pcDevClearBtn.style.cssText = 'width:auto;margin:0;padding:0 1rem;font-size:0.75rem;height:2rem;box-sizing:border-box;display:flex;align-items:center;justify-content:center;line-height:2rem;white-space:nowrap;';
    pcDevClearBtn.addEventListener('click', function() {
      MDS.keypair.set('MINIMAADS_CREATOR_ROUTE', '', function() {
        updatePcDevStatus();
        refreshKeypairInspector();
      });
    });
    pcDevInputRow.appendChild(pcDevInput);
    pcDevInputRow.appendChild(pcDevSaveBtn);
    pcDevInputRow.appendChild(pcDevClearBtn);
    pcDevSub.appendChild(pcDevInputRow);
    creatorSec.appendChild(pcDevSub);

    // Sub-item 3.2: Platform Key (PLATFORM_KEY)
    var pkSub = document.createElement('div');
    pkSub.style.cssText = 'display:flex;flex-direction:column;gap:0.4rem;border-top:1px dashed var(--pico-muted-border-color);padding-top:0.75rem;';
    
    var pkSubTitle = document.createElement('span');
    pkSubTitle.textContent = '3.2 Platform Key (PLATFORM_KEY)';
    pkSubTitle.style.cssText = 'font-size:0.75rem;font-weight:700;color:var(--pico-muted-color);text-transform:uppercase;letter-spacing:0.05em;';
    pkSub.appendChild(pkSubTitle);

    var pkStatus = document.createElement('div');
    pkStatus.id = 'ma-dev-pk-status';
    pkStatus.style.cssText = 'font-family:monospace;font-size:0.75rem;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);padding:0.6rem 0.75rem;border-radius:0.375rem;margin:0;word-break:break-all;color:var(--pico-color);line-height:1.4;';
    pkStatus.textContent = 'Loading Platform Key…';
    
    function updatePlatformKeyStatus() {
      MDS.keypair.get('PLATFORM_KEY_OVERRIDE', function(res) {
        var override = (res && res.status && res.value) ? res.value : '';
        var activeKey = override || (typeof PLATFORM_KEY !== 'undefined' && PLATFORM_KEY ? PLATFORM_KEY : '');
        
        var displayLabel = override ? 'Current PLATFORM_KEY (overridden): ' + activeKey : 'Current PLATFORM_KEY: ' + (activeKey || '(not set)');
        pkStatus.textContent = displayLabel;

        if (activeKey) {
          pkStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
          pkStatus.style.color = 'var(--pico-ins-color, #27ae60)';
        } else {
          pkStatus.style.borderColor = 'var(--pico-muted-border-color)';
          pkStatus.style.color = 'var(--pico-color)';
        }
      });
    }
    setTimeout(updatePlatformKeyStatus, 100);
    pkSub.appendChild(pkStatus);

    var pkActions = document.createElement('div');
    pkActions.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;';

    var setSelfBtn = document.createElement('button');
    setSelfBtn.textContent = 'Set Self Wallet';
    setSelfBtn.className = 'primary';
    setSelfBtn.style.cssText = 'width:auto;margin:0;padding:0.4rem 0.8rem;font-size:0.75rem;line-height:1.2;background-color:#a855f7;border-color:#a855f7;';
    setSelfBtn.addEventListener('click', function() {
      setSelfBtn.disabled = true;
      setSelfBtn.textContent = 'Reading…';
      MDS.cmd('getaddress', function(res) {
        setSelfBtn.disabled = false;
        setSelfBtn.textContent = 'Set Self Wallet';
        if (!res || !res.status || !res.response || !res.response.address) {
          pkStatus.textContent = 'ERROR: could not read wallet address';
          pkStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
          pkStatus.style.color = 'var(--pico-del-color, #c0392b)';
          return;
        }
        var addr = res.response.address;
        if (typeof isHexKey === 'function' && !isHexKey(addr)) {
          pkStatus.textContent = 'ERROR: derived address is invalid hex';
          pkStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
          pkStatus.style.color = 'var(--pico-del-color, #c0392b)';
          return;
        }
        MDS.keypair.set('PLATFORM_KEY_OVERRIDE', addr, function() {
          PLATFORM_KEY = addr;
          updatePlatformKeyStatus();
          refreshKeypairInspector();
        });
      });
    });
    pkActions.appendChild(setSelfBtn);

    var clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear Override';
    clearBtn.className = 'outline secondary';
    clearBtn.style.cssText = 'width:auto;margin:0;padding:0.4rem 0.8rem;font-size:0.75rem;line-height:1.2;';
    clearBtn.addEventListener('click', function() {
      MDS.keypair.set('PLATFORM_KEY_OVERRIDE', '', function() {
        updatePlatformKeyStatus();
        refreshKeypairInspector();
      });
    });
    pkActions.appendChild(clearBtn);

    var pkCopyBtn = document.createElement('button');
    pkCopyBtn.textContent = 'Copy';
    pkCopyBtn.className = 'outline secondary';
    pkCopyBtn.style.cssText = 'width:auto;margin:0;padding:0.4rem 0.8rem;font-size:0.75rem;line-height:1.2;';
    pkCopyBtn.addEventListener('click', function() {
      MDS.keypair.get('PLATFORM_KEY_OVERRIDE', function(res) {
        var override = (res && res.status && res.value) ? res.value : '';
        var currentKey = override || (typeof PLATFORM_KEY !== 'undefined' && PLATFORM_KEY ? PLATFORM_KEY : '');
        if (!currentKey) {
          pkCopyBtn.textContent = '✕ No Key';
          setTimeout(function() { pkCopyBtn.textContent = 'Copy'; }, 1500);
          return;
        }
        navigator.clipboard.writeText(currentKey);
        pkCopyBtn.textContent = '✓ Copied!';
        setTimeout(function() { pkCopyBtn.textContent = 'Copy'; }, 1500);
      });
    });
    pkActions.appendChild(pkCopyBtn);
    pkSub.appendChild(pkActions);

    var extRow = document.createElement('div');
    extRow.style.cssText = 'display:flex;gap:0.5rem;align-items:stretch;';
    var extInput = document.createElement('input');
    extInput.type = 'text';
    extInput.placeholder = 'Or paste custom platform address (0xABC…)';
    extInput.style.cssText = 'flex:1;margin:0;padding:0 0.5rem;font-size:0.75rem;font-family:monospace;height:2rem;box-sizing:border-box;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);color:var(--pico-color);border-radius:0.375rem;';
    var extBtn = document.createElement('button');
    extBtn.textContent = 'Save';
    extBtn.className = 'primary';
    extBtn.style.cssText = 'width:auto;margin:0;padding:0 1rem;font-size:0.75rem;height:2rem;box-sizing:border-box;display:flex;align-items:center;justify-content:center;line-height:2rem;white-space:nowrap;background-color:#a855f7;border-color:#a855f7;';
    extBtn.addEventListener('click', function() {
      var pk = (extInput.value || '').trim();
      if (!pk) {
        pkStatus.textContent = 'ERROR: enter a wallet address first';
        pkStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
        pkStatus.style.color = 'var(--pico-del-color, #c0392b)';
        return;
      }
      if (typeof isHexKey === 'function' && !isHexKey(pk)) {
        pkStatus.textContent = 'ERROR: invalid wallet address (must start with 0x and be hex)';
        pkStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
        pkStatus.style.color = 'var(--pico-del-color, #c0392b)';
        return;
      }
      MDS.keypair.set('PLATFORM_KEY_OVERRIDE', pk, function() {
        PLATFORM_KEY = pk;
        updatePlatformKeyStatus();
        extInput.value = '';
        refreshKeypairInspector();
      });
    });
    extRow.appendChild(extInput);
    extRow.appendChild(extBtn);
    pkSub.appendChild(extRow);
    creatorSec.appendChild(pkSub);



    panel.appendChild(creatorSec);

    // ==========================================
    // SECTION 4: Database & storage console
    // ==========================================
    var dbSec = document.createElement('section');
    dbSec.style.cssText = 'background:var(--pico-card-sectionning-background-color, rgba(0,0,0,0.02));border:1px solid var(--pico-muted-border-color);border-left:4px solid var(--pico-muted-color, #6c757d);border-radius:0.75rem;padding:1.25rem;display:flex;flex-direction:column;gap:1.25rem;margin:0;';

    var dbTitle = document.createElement('strong');
    dbTitle.textContent = '4. Database & Storage Console';
    dbTitle.style.cssText = 'display:block;font-size:0.95rem;font-weight:700;color:var(--pico-muted-color, #6c757d);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.1rem;';
    dbSec.appendChild(dbTitle);

    // Sub-item 3.1: DApp Keypair Inspector
    var kpSub = document.createElement('div');
    kpSub.style.cssText = 'display:flex;flex-direction:column;gap:0.4rem;';

    var kpSubTitle = document.createElement('span');
    kpSubTitle.textContent = 'DApp Keypair Storage';
    kpSubTitle.style.cssText = 'font-size:0.75rem;font-weight:700;color:var(--pico-muted-color);text-transform:uppercase;letter-spacing:0.05em;';
    kpSub.appendChild(kpSubTitle);

    kpSub.appendChild(kpListContainer);
    dbSec.appendChild(kpSub);

    addKpRow('MLS_SERVER_ADDRESS');
    addKpRow('USER_PERMANENT_ROUTE');
    addKpRow('MINIMAADS_CREATOR_ROUTE');
    addKpRow('PLATFORM_KEY_OVERRIDE');
    addKpRow('FOUNDATION_KEY_OVERRIDE');
    refreshKeypairInspector();

    // Sub-item 3.2: SQL Console
    var sqlSub = document.createElement('div');
    sqlSub.style.cssText = 'display:flex;flex-direction:column;gap:0.4rem;border-top:1px dashed var(--pico-muted-border-color);padding-top:0.75rem;';

    var sqlSubTitle = document.createElement('span');
    sqlSubTitle.textContent = 'SQL Console';
    sqlSubTitle.style.cssText = 'font-size:0.75rem;font-weight:700;color:var(--pico-muted-color);text-transform:uppercase;letter-spacing:0.05em;';
    sqlSub.appendChild(sqlSubTitle);

    var sqlDesc = document.createElement('span');
    sqlDesc.textContent = 'Execute raw SQL queries against the local MinimaAds H2 database.';
    sqlDesc.style.cssText = 'font-size:0.7rem;color:var(--pico-muted-color,#6c757d);';
    sqlSub.appendChild(sqlDesc);

    var sqlTextarea = document.createElement('textarea');
    sqlTextarea.placeholder = 'SELECT * FROM campaigns LIMIT 5;';
    sqlTextarea.style.cssText = 'width:100%;min-height:70px;font-family:monospace;font-size:0.75rem;margin:0;padding:0.4rem;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);color:var(--pico-color);border-radius:0.375rem;box-sizing:border-box;resize:vertical;';
    sqlSub.appendChild(sqlTextarea);

    var sqlBtnRow = document.createElement('div');
    sqlBtnRow.style.cssText = 'display:flex;gap:0.5rem;align-items:center;';

    var sqlRunBtn = document.createElement('button');
    sqlRunBtn.textContent = 'Run Query';
    sqlRunBtn.className = 'primary';
    sqlRunBtn.style.cssText = 'width:auto;margin:0;padding:0.4rem 0.8rem;font-size:0.75rem;line-height:1.2;';
    sqlBtnRow.appendChild(sqlRunBtn);

    var sqlClearBtn = document.createElement('button');
    sqlClearBtn.textContent = 'Clear';
    sqlClearBtn.className = 'outline secondary';
    sqlClearBtn.style.cssText = 'width:auto;margin:0;padding:0.4rem 0.8rem;font-size:0.75rem;line-height:1.2;';
    sqlBtnRow.appendChild(sqlClearBtn);

    var sqlCopyBtn = document.createElement('button');
    sqlCopyBtn.textContent = 'Copy Result';
    sqlCopyBtn.className = 'outline secondary';
    sqlCopyBtn.style.cssText = 'width:auto;margin:0;padding:0.4rem 0.8rem;font-size:0.75rem;line-height:1.2;display:none;';
    sqlBtnRow.appendChild(sqlCopyBtn);

    sqlSub.appendChild(sqlBtnRow);

    var sqlResult = document.createElement('pre');
    sqlResult.style.cssText = 'font-family:monospace;font-size:0.7rem;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);padding:0.6rem 0.75rem;border-radius:0.375rem;margin:0.25rem 0 0 0;word-break:break-all;white-space:pre-wrap;color:var(--pico-color);line-height:1.4;max-height:150px;overflow-y:auto;display:none;';
    sqlSub.appendChild(sqlResult);

    sqlRunBtn.addEventListener('click', function() {
      var query = (sqlTextarea.value || '').trim();
      if (!query) {
        sqlRunBtn.textContent = '✕ Empty';
        setTimeout(function() { sqlRunBtn.textContent = 'Run Query'; }, 1500);
        return;
      }
      sqlRunBtn.disabled = true;
      sqlRunBtn.textContent = 'Running…';
      sqlResult.style.display = 'block';
      sqlResult.textContent = 'Executing query…';
      sqlResult.style.borderColor = 'var(--pico-muted-border-color)';
      sqlCopyBtn.style.display = 'none';

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
      }).catch(function() {
        sqlCopyBtn.textContent = '✕ Failed';
        setTimeout(function() {
          sqlCopyBtn.textContent = 'Copy Result';
        }, 1500);
      });
    });

    sqlClearBtn.addEventListener('click', function() {
      sqlTextarea.value = '';
      sqlResult.textContent = '';
      sqlResult.style.display = 'none';
      sqlResult.style.borderColor = 'var(--pico-muted-border-color)';
      sqlCopyBtn.style.display = 'none';
    });

    dbSec.appendChild(sqlSub);
    panel.appendChild(dbSec);

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
