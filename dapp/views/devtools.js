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
      MDS.keypair.set('MLS_SERVER_ADDRESS', addr, function() {
        mlsStatus.textContent = 'MLS server saved: ' + addr;
        mlsStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
        mlsInput.value = '';
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

    // Section 1.7: Client Mode (connect to MLS server)
    var clientSection = document.createElement('section');
    clientSection.style.cssText = 'background:var(--pico-card-sectionning-background-color, rgba(0,0,0,0.03));border:1px solid var(--pico-muted-border-color);border-radius:0.5rem;padding:1.25rem;display:flex;flex-direction:column;gap:0.75rem;margin:0;';

    var clientTitle = document.createElement('strong');
    clientTitle.textContent = 'Client Mode (Advanced)';
    clientTitle.style.cssText = 'display:block;font-size:0.9rem;font-weight:700;color:var(--pico-primary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;';
    clientSection.appendChild(clientTitle);

    var clientDesc = document.createElement('p');
    clientDesc.textContent = 'To be discoverable by other users and receive offline messages, connect to an always-online MLS server.';
    clientDesc.style.cssText = 'font-size:0.8rem;color:var(--pico-color);margin:0;line-height:1.5;';
    clientSection.appendChild(clientDesc);

    var clientStatus = document.createElement('div');
    clientStatus.id = 'ma-dev-client-status';
    clientStatus.style.cssText = 'font-family:monospace;font-size:0.75rem;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);padding:0.75rem;border-radius:0.375rem;margin:0.5rem 0;word-break:break-all;color:var(--pico-color);line-height:1.4;min-height:40px;display:flex;align-items:center;';
    clientStatus.textContent = 'Checking connection status…';
    MDS.keypair.get('CREATOR_PERMANENT_ROUTE', function(res) {
      var stored = (res && res.status && res.value) ? res.value : null;
      if (stored) {
        clientStatus.innerHTML = '<span style="color:var(--pico-ins-color, #27ae60);">✓ Connected to: ' + stored + '</span>';
        clientStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
      } else {
        clientStatus.innerHTML = '<span style="color:var(--pico-muted-color, #999);">Not connected to any MLS server</span>';
      }
    });
    clientSection.appendChild(clientStatus);

    var clientInputRow = document.createElement('div');
    clientInputRow.style.cssText = 'display:flex;gap:0.5rem;align-items:stretch;';
    
    var clientInput = document.createElement('input');
    clientInput.type = 'text';
    clientInput.placeholder = 'Mx...@host:port (MLS server address)';
    clientInput.style.cssText = 'flex:1;min-width:200px;margin:0;padding:0 0.6rem;font-size:0.8rem;font-family:monospace;height:2.2rem;box-sizing:border-box;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);color:var(--pico-color);border-radius:0.375rem;';
    
    var clientConnectBtn = document.createElement('button');
    clientConnectBtn.textContent = 'Connect';
    clientConnectBtn.className = 'primary';
    clientConnectBtn.style.cssText = 'width:auto;margin:0;padding:0 1.2rem;font-size:0.8rem;height:2.2rem;box-sizing:border-box;display:flex;align-items:center;justify-content:center;line-height:2.2rem;white-space:nowrap;';
    clientConnectBtn.addEventListener('click', function() {
      var serverAddr = (clientInput.value || '').trim();
      if (!serverAddr) {
        clientStatus.textContent = 'ERROR: enter an MLS server address first';
        clientStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
        return;
      }
      clientConnectBtn.disabled = true;
      clientConnectBtn.textContent = 'Connecting…';
      MDS.cmd('maxextra action:staticmls host:' + serverAddr, function(res) {
        clientConnectBtn.disabled = false;
        clientConnectBtn.textContent = 'Connect';
        if (res.status) {
          MDS.keypair.set('MLS_SERVER_ADDRESS', serverAddr, function() {
            clientStatus.innerHTML = '<span style="color:var(--pico-ins-color, #27ae60);">✓ Connected to: ' + serverAddr + '</span>';
            clientStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
            clientInput.value = '';
          });
        } else {
          clientStatus.textContent = 'Error connecting to server: ' + (res.error || 'unknown error');
          clientStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
        }
      });
    });
    clientInputRow.appendChild(clientInput);
    clientInputRow.appendChild(clientConnectBtn);
    clientSection.appendChild(clientInputRow);

    var clientDisconnectBtn = document.createElement('button');
    clientDisconnectBtn.textContent = 'Disconnect';
    clientDisconnectBtn.className = 'outline';
    clientDisconnectBtn.style.cssText = 'width:auto;margin:0;padding:0.45rem 0.9rem;font-size:0.8rem;line-height:1.2;';
    clientDisconnectBtn.addEventListener('click', function() {
      clientDisconnectBtn.disabled = true;
      clientDisconnectBtn.textContent = 'Disconnecting…';
      MDS.cmd('maxextra action:staticmls host:clear', function(res) {
        clientDisconnectBtn.disabled = false;
        clientDisconnectBtn.textContent = 'Disconnect';
        if (res.status) {
          MDS.keypair.set('CREATOR_PERMANENT_ROUTE', '', function() {
            clientStatus.innerHTML = '<span style="color:var(--pico-muted-color, #999);">Not connected to any MLS server</span>';
            clientStatus.style.borderColor = 'var(--pico-muted-border-color)';
          });
        } else {
          clientStatus.textContent = 'Error disconnecting: ' + (res.error || 'unknown error');
          clientStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
        }
      });
    });
    clientSection.appendChild(clientDisconnectBtn);

    panel.appendChild(clientSection);

    // Section 1.9: Register MinimaAds Creator as Permanent
    var creatorRegSection = document.createElement('section');
    creatorRegSection.style.cssText = 'background:var(--pico-card-sectionning-background-color, rgba(0,0,0,0.03));border:1px solid var(--pico-muted-border-color);border-radius:0.5rem;padding:1.25rem;display:flex;flex-direction:column;gap:0.75rem;margin:0;';

    var creatorRegTitle = document.createElement('strong');
    creatorRegTitle.textContent = 'Register MinimaAds Creator as Permanent (Server Mode)';
    creatorRegTitle.style.cssText = 'display:block;font-size:0.9rem;font-weight:700;color:var(--pico-primary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;';
    creatorRegSection.appendChild(creatorRegTitle);

    var creatorRegDesc = document.createElement('p');
    creatorRegDesc.textContent = 'If this node is running as an MLS server, execute this command ON THIS SERVER to register the MinimaAds creator as a permanent user.';
    creatorRegDesc.style.cssText = 'font-size:0.8rem;color:var(--pico-color);margin:0;line-height:1.5;';
    creatorRegSection.appendChild(creatorRegDesc);

    var creatorRegStatus = document.createElement('div');
    creatorRegStatus.id = 'ma-dev-creator-reg-status';
    creatorRegStatus.style.cssText = 'font-family:monospace;font-size:0.75rem;background:var(--pico-background-color);border:1px solid var(--pico-muted-border-color);padding:0.75rem;border-radius:0.375rem;margin:0.5rem 0;word-break:break-all;color:var(--pico-color);line-height:1.4;min-height:50px;';
    creatorRegStatus.textContent = 'Fetching creator publickey…';

    getMaximaInfo(function(err, info) {
      if (err) {
        creatorRegStatus.textContent = 'Error: ' + err.message;
        creatorRegStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
      } else {
        creatorRegStatus.innerHTML = 'Run on server terminal:<br/><code style="display:block; margin-top:0.5rem;">maxextra action:addpermanent publickey:' + info.publickey + '</code>';
      }
    });
    creatorRegSection.appendChild(creatorRegStatus);

    var creatorRegBtn = document.createElement('button');
    creatorRegBtn.textContent = 'Register Creator as Permanent';
    creatorRegBtn.className = 'primary';
    creatorRegBtn.style.cssText = 'width:auto;margin:0;padding:0.45rem 0.9rem;font-size:0.8rem;line-height:1.2;';
    creatorRegBtn.addEventListener('click', function() {
      creatorRegBtn.disabled = true;
      creatorRegBtn.textContent = 'Registering…';
      getMaximaInfo(function(err, info) {
        if (err) {
          creatorRegStatus.textContent = 'Error: ' + err.message;
          creatorRegStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
          creatorRegBtn.disabled = false;
          creatorRegBtn.textContent = 'Register Creator as Permanent';
          return;
        }
        var cmd = 'maxextra action:addpermanent publickey:' + info.publickey;
        MDS.cmd(cmd, function(res) {
          creatorRegBtn.disabled = false;
          creatorRegBtn.textContent = 'Register Creator as Permanent';
          if (res.status) {
            creatorRegStatus.innerHTML = '<span style="color:var(--pico-ins-color, #27ae60);">✓ Creator registered as permanent!</span><br/><code style="display:block; margin-top:0.5rem; font-size:0.7rem;">' + info.publickey + '</code>';
            creatorRegStatus.style.borderColor = 'var(--pico-ins-color, #27ae60)';
          } else {
            creatorRegStatus.innerHTML = '<span style="color:var(--pico-del-color, #c0392b);">✗ Registration failed</span><br/>' + (res.error || 'Unknown error');
            creatorRegStatus.style.borderColor = 'var(--pico-del-color, #c0392b)';
          }
        });
      });
    });
    creatorRegSection.appendChild(creatorRegBtn);

    panel.appendChild(creatorRegSection);

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
