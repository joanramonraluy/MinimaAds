// DEV TOOL — SQL console (Ctrl+Shift+D to toggle).
// Uses sqlQuery() from core/minima.js — must be loaded after it.
// Not intended for production; safe to ship (no server access, FE-only).

(function () {
  var _modal = null;
  var _textarea = null;
  var _output = null;

  function buildModal() {
    var overlay = document.createElement('div');
    overlay.id = 'ma-devtools';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;';

    var panel = document.createElement('div');
    panel.style.cssText = 'background:#1e1e1e;color:#d4d4d4;border-radius:.5rem;padding:1.5rem;width:95%;max-width:1000px;font-family:monospace;display:flex;flex-direction:column;gap:.75rem;max-height:90vh;overflow-y:auto;';

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
    var title = document.createElement('strong');
    title.textContent = 'MinimaAds — SQL Console';
    title.style.color = '#569cd6';
    var closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'background:none;border:none;color:#888;cursor:pointer;font-size:1.2rem;padding:0;';
    closeBtn.addEventListener('click', hideDevtools);
    header.appendChild(title);
    header.appendChild(closeBtn);

    _textarea = document.createElement('textarea');
    _textarea.rows = 5;
    _textarea.placeholder = 'SELECT * FROM CAMPAIGNS LIMIT 10';
    _textarea.style.cssText = 'background:#252526;color:#d4d4d4;border:1px solid #3c3c3c;border-radius:.25rem;padding:.5rem;font-family:monospace;font-size:.85rem;resize:vertical;width:100%;box-sizing:border-box;';
    _textarea.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { runQuery(); }
    });

    var runBtn = document.createElement('button');
    runBtn.textContent = 'Run  (Ctrl+Enter)';
    runBtn.style.cssText = 'align-self:flex-start;background:#0e639c;color:#fff;border:none;border-radius:.25rem;padding:.4rem 1rem;cursor:pointer;font-size:.85rem;';
    runBtn.addEventListener('click', runQuery);

    _output = document.createElement('pre');
    _output.style.cssText = 'background:#252526;border:1px solid #3c3c3c;border-radius:.25rem;padding:.75rem;overflow:auto;max-height:40vh;font-size:.8rem;margin:0;white-space:pre-wrap;word-break:break-all;';
    _output.textContent = 'Results appear here.';

    var devSep = document.createElement('hr');
    devSep.style.cssText = 'border-color:#3c3c3c;margin:.25rem 0;';

    var devTitle = document.createElement('strong');
    devTitle.textContent = 'Dev Settings — Platform Key';
    devTitle.style.cssText = 'color:#569cd6;font-size:.85rem;';

    var pkStatus = document.createElement('p');
    pkStatus.id = 'ma-dev-pk-status';
    pkStatus.style.cssText = 'font-size:.8rem;color:#9cdcfe;margin:0;word-break:break-all;';
    pkStatus.textContent = 'Current PLATFORM_KEY: ' + (typeof PLATFORM_KEY !== 'undefined' && PLATFORM_KEY ? PLATFORM_KEY : '(not set)');

    var setSelfBtn = document.createElement('button');
    setSelfBtn.textContent = 'Set as Platform Node';
    setSelfBtn.style.cssText = 'align-self:flex-start;background:#0e639c;color:#fff;border:none;border-radius:.25rem;padding:.35rem .85rem;cursor:pointer;font-size:.8rem;';
    setSelfBtn.addEventListener('click', function() {
      setSelfBtn.disabled = true;
      setSelfBtn.textContent = 'Reading…';
      MDS.cmd('getaddress', function(res) {
        setSelfBtn.disabled = false;
        setSelfBtn.textContent = 'Set as Platform Node';
        if (!res || !res.status || !res.response || !res.response.address) {
          pkStatus.textContent = 'ERROR: could not read wallet address';
          return;
        }
        var addr = res.response.address;
        MDS.keypair.set('PLATFORM_KEY_OVERRIDE', addr, function() {
          PLATFORM_KEY = addr;
          pkStatus.textContent = 'PLATFORM_KEY set to: ' + addr + ' (reload SW to apply)';
        });
      });
    });

    var extRow = document.createElement('div');
    extRow.style.cssText = 'display:flex;gap:.5rem;align-items:stretch;flex-wrap:wrap;';
    var extInput = document.createElement('input');
    extInput.type = 'text';
    extInput.placeholder = '0xABC… (platform wallet address)';
    extInput.style.cssText = 'flex:1;min-width:200px;background:#252526;color:#d4d4d4;border:1px solid #3c3c3c;border-radius:.25rem;padding:.35rem .5rem;font-family:monospace;font-size:.8rem;box-sizing:border-box;';
    var extBtn = document.createElement('button');
    extBtn.textContent = 'Register';
    extBtn.style.cssText = 'background:#6a9955;color:#fff;border:none;border-radius:.25rem;padding:.35rem .75rem;cursor:pointer;font-size:.8rem;white-space:nowrap;';
    extBtn.addEventListener('click', function() {
      var pk = (extInput.value || '').trim();
      if (!pk) { pkStatus.textContent = 'ERROR: enter a wallet address first'; return; }
      MDS.keypair.set('PLATFORM_KEY_OVERRIDE', pk, function() {
        pkStatus.textContent = 'PLATFORM_KEY set to: ' + pk + ' (reload SW to apply)';
        extInput.value = '';
      });
    });
    extRow.appendChild(extInput);
    extRow.appendChild(extBtn);

    var clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear Override';
    clearBtn.style.cssText = 'align-self:flex-start;background:#6e3030;color:#fff;border:none;border-radius:.25rem;padding:.35rem .75rem;cursor:pointer;font-size:.8rem;';
    clearBtn.addEventListener('click', function() {
      MDS.keypair.set('PLATFORM_KEY_OVERRIDE', '', function() {
        pkStatus.textContent = 'PLATFORM_KEY override cleared (reload SW to apply)';
      });
    });

    var routeSep = document.createElement('hr');
    routeSep.style.cssText = 'border-color:#3c3c3c;margin:.25rem 0;';

    var routeTitle = document.createElement('strong');
    routeTitle.textContent = 'Dev Settings — Maxima Routes';
    routeTitle.style.cssText = 'color:#569cd6;font-size:.85rem;';

    var routeStatus = document.createElement('p');
    routeStatus.id = 'ma-dev-route-status';
    routeStatus.style.cssText = 'font-size:.8rem;color:#9cdcfe;margin:0;word-break:break-all;';
    routeStatus.textContent = 'Checking stored route…';
    MDS.keypair.get('CREATOR_PERMANENT_ROUTE', function(res) {
      var stored = (res && res.status && res.value) ? res.value : null;
      routeStatus.textContent = stored
        ? 'Current route: ' + stored
        : 'No route registered yet.';
    });

    var routeStaticMlsBtn = document.createElement('button');
    routeStaticMlsBtn.textContent = 'Copy: maxextra action:staticmls host:<your-mls-p2p-identity>';
    routeStaticMlsBtn.style.cssText = 'align-self:flex-start;background:#3c3c3c;color:#d4d4d4;border:1px solid #555;border-radius:.25rem;padding:.35rem .75rem;cursor:pointer;font-size:.8rem;margin-bottom:.25rem;';
    routeStaticMlsBtn.addEventListener('click', function() {
      navigator.clipboard.writeText('maxextra action:staticmls host:<your-mls-p2p-identity>');
      routeStatus.textContent = 'Command copied to clipboard!';
    });

    var routeRegisterBtn = document.createElement('button');
    routeRegisterBtn.textContent = 'Register Creator Route';
    routeRegisterBtn.style.cssText = 'align-self:flex-start;background:#0e639c;color:#fff;border:none;border-radius:.25rem;padding:.35rem .85rem;cursor:pointer;font-size:.8rem;';
    routeRegisterBtn.addEventListener('click', function() {
      routeRegisterBtn.disabled = true;
      routeRegisterBtn.textContent = 'Registering…';
      if (typeof setCreatorMaximaRoute !== 'function') {
        routeStatus.textContent = 'ERROR: setCreatorMaximaRoute() not available (core/minima.js not loaded).';
        routeRegisterBtn.disabled = false;
        routeRegisterBtn.textContent = 'Register Creator Route';
        return;
      }
      setCreatorMaximaRoute(function(err, route) {
        routeRegisterBtn.disabled = false;
        routeRegisterBtn.textContent = 'Register Creator Route';
        if (err) {
          routeStatus.style.color = '#f44747';
          routeStatus.textContent = 'Error: ' + err.message;
        } else {
          routeStatus.style.color = '#4ec9b0';
          routeStatus.textContent = 'Route registered: ' + route;
        }
      });
    });

    panel.appendChild(header);
    panel.appendChild(_textarea);
    panel.appendChild(runBtn);
    panel.appendChild(_output);
    panel.appendChild(devSep);
    panel.appendChild(devTitle);
    panel.appendChild(pkStatus);
    panel.appendChild(setSelfBtn);
    panel.appendChild(extRow);
    panel.appendChild(clearBtn);
    panel.appendChild(routeSep);
    panel.appendChild(routeTitle);
    panel.appendChild(routeStatus);
    panel.appendChild(routeStaticMlsBtn);
    panel.appendChild(routeRegisterBtn);
    overlay.appendChild(panel);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) { hideDevtools(); }
    });

    return overlay;
  }

  function runQuery() {
    var sql = (_textarea.value || '').trim();
    if (!sql) { return; }
    _output.textContent = 'Running…';
    if (typeof sqlQuery !== 'function') {
      _output.textContent = 'ERROR: sqlQuery() not available (core/minima.js not loaded).';
      return;
    }
    sqlQuery(sql, function (err, rows) {
      if (err) {
        _output.textContent = 'ERROR:\n' + err;
        return;
      }
      if (!rows || rows.length === 0) {
        _output.textContent = '(0 rows)';
        return;
      }
      _output.textContent = '(' + rows.length + ' row' + (rows.length === 1 ? '' : 's') + ')\n\n'
        + JSON.stringify(rows, null, 2);
    });
  }

  function showDevtools() {
    if (!_modal) {
      _modal = buildModal();
      document.body.appendChild(_modal);
    }
    _modal.style.display = 'flex';
    setTimeout(function () { if (_textarea) { _textarea.focus(); } }, 50);
  }

  function hideDevtools() {
    if (_modal) { _modal.style.display = 'none'; }
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
