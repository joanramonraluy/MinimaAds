// UI helpers — shared DOM builder functions used by all views.
// All functions return a DOM element; they never append to the document.

function mkStatusBadge(status) {
  var palette = {
    active:   { bg: '#2ecc71', fg: '#fff' },
    paused:   { bg: '#f39c12', fg: '#fff' },
    finished: { bg: '#95a5a6', fg: '#fff' },
    pending:  { bg: '#3498db', fg: '#fff' },
    settled:  { bg: '#9b59b6', fg: '#fff' },
    completed: { bg: '#e74c3c', fg: '#fff' }
  };
  var labels = {
    active: 'Active', paused: 'Paused', finished: 'Finished',
    pending: 'Pending', settled: 'Settled', completed: 'Limit Reached'
  };
  var normalized = (status || '').toLowerCase();
  var c = palette[normalized] || { bg: '#95a5a6', fg: '#fff' };
  var el = document.createElement('mark');
  el.style.cssText = 'background:' + c.bg + ';color:' + c.fg
    + ';padding:.15rem .5rem;border-radius:.25rem;font-size:.75rem;'
    + 'font-weight:600;white-space:nowrap;vertical-align:middle;';
  el.textContent = labels[normalized] || status;
  return el;
}

function mkStatCard(label, value, sub) {
  var card = document.createElement('div');
  card.style.cssText = 'display:flex;flex-direction:column;background:var(--pico-card-background-color,#fff);'
    + 'border:1px solid var(--pico-muted-border-color,#ddd);border-radius:.4rem;'
    + 'padding:.6rem .85rem;min-width:0;flex:1;';
  var lbl = document.createElement('small');
  lbl.style.cssText = 'display:block;color:var(--pico-muted-color,#6c757d);'
    + 'font-size:.72rem;margin-bottom:.2rem;text-transform:uppercase;letter-spacing:.04em;';
  lbl.textContent = label;
  var val = document.createElement('strong');
  val.style.cssText = 'display:block;font-size:1.05rem;'
    + (sub ? 'margin-top:.1rem;' : 'margin-top:auto;');
  val.textContent = value;
  card.appendChild(lbl);
  card.appendChild(val);
  if (sub) {
    var s = document.createElement('small');
    s.style.cssText = 'display:block;color:var(--pico-muted-color,#6c757d);'
      + 'font-size:.7rem;margin-top:auto;padding-top:.15rem;';
    s.textContent = sub;
    card.appendChild(s);
  }
  return card;
}

function mkProgressBar(pct, label) {
  var prog = document.createElement('progress');
  prog.max = 100;
  prog.value = Math.min(100, Math.max(0, Math.round(pct)));
  prog.style.cssText = 'width:100%;margin:.35rem 0 0;height:.45rem;';
  if (label) { prog.setAttribute('aria-label', label); }
  return prog;
}

function mkEmptyState(message, ctaText, ctaHref) {
  var div = document.createElement('div');
  div.style.cssText = 'text-align:center;padding:2.5rem 1rem;'
    + 'color:var(--pico-muted-color,#6c757d);';
  var p = document.createElement('p');
  p.style.cssText = 'margin:0 0 .75rem;';
  p.textContent = message;
  div.appendChild(p);
  if (ctaText && ctaHref) {
    var a = document.createElement('a');
    a.href = ctaHref;
    a.textContent = ctaText;
    a.setAttribute('role', 'button');
    a.className = 'secondary outline';
    a.style.cssText = 'display:inline-block;width:auto;padding:.4rem 1rem;font-size:.9rem;';
    div.appendChild(a);
  }
  return div;
}

function mkLoading(text) {
  var p = document.createElement('p');
  p.setAttribute('aria-busy', 'true');
  p.textContent = text || 'Loading…';
  return p;
}

function mkSectionTitle(text) {
  var el = document.createElement('strong');
  el.className = 'ma-section-title';
  el.textContent = text;
  return el;
}

function attachScrollIndicator(scrollEl, arrowRightEl, arrowLeftEl) {
  if (!scrollEl) { return; }
  
  function updateIndicator() {
    var hasOverflow = scrollEl.scrollWidth > scrollEl.clientWidth;
    
    // Right arrow
    var isScrollAtEnd = scrollEl.scrollLeft + scrollEl.clientWidth >= scrollEl.scrollWidth - 5;
    if (arrowRightEl) {
      if (hasOverflow && !isScrollAtEnd) {
        arrowRightEl.style.display = 'block';
      } else {
        arrowRightEl.style.display = 'none';
      }
    }
    
    // Left arrow
    var isScrollAtStart = scrollEl.scrollLeft <= 5;
    if (arrowLeftEl) {
      if (hasOverflow && !isScrollAtStart) {
        arrowLeftEl.style.display = 'block';
      } else {
        arrowLeftEl.style.display = 'none';
      }
    }
  }

  scrollEl.addEventListener('scroll', updateIndicator);
  window.addEventListener('resize', updateIndicator);
  
  if (arrowRightEl) {
    arrowRightEl.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      scrollEl.scrollBy({ left: 120, behavior: 'smooth' });
    });
  }
  
  if (arrowLeftEl) {
    arrowLeftEl.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      scrollEl.scrollBy({ left: -120, behavior: 'smooth' });
    });
  }
  
  return updateIndicator;
}
