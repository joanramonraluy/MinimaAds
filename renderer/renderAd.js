// T11 — Renderer: renderAd.js
// Injects a responsive ad banner into a DOM container.
// All ad fields passed through DOMPurify before DOM injection (MinimaAds.md §15.3).
// Falls back to textContent-only if DOMPurify is absent.

function renderAd(ad, containerId) {
  var container = document.getElementById(containerId);
  if (!container || !ad) { return false; }

  container.innerHTML = '';

  function safeText(val) {
    var s = val ? String(val) : '';
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(s, { ALLOWED_TAGS: [] });
    }
    return s;
  }

  function safeUrl(val) {
    var s = safeText(val);
    if (/^javascript:/i.test(s.trim())) { return '#'; }
    return s;
  }

  var banner = document.createElement('article');
  banner.className = 'ma-ad-banner';
  banner.style.cssText = 'display:flex;flex-wrap:wrap;gap:1rem;align-items:flex-start;padding:1rem;';

  var textBlock = document.createElement('div');
  textBlock.style.cssText = 'flex:1 1 180px;display:flex;flex-direction:column;gap:0.5rem;';

  var titleEl = document.createElement('strong');
  titleEl.textContent = safeText(ad.title);
  textBlock.appendChild(titleEl);

  if (ad.body) {
    var bodyEl = document.createElement('p');
    bodyEl.style.margin = '0';
    bodyEl.textContent = safeText(ad.body);
    textBlock.appendChild(bodyEl);
  }

  if (ad.cta_url) {
    var ctaEl = document.createElement('a');
    ctaEl.href = safeUrl(ad.cta_url);
    ctaEl.setAttribute('target', '_blank');
    ctaEl.setAttribute('rel', 'noopener noreferrer');
    ctaEl.setAttribute('role', 'button');
    ctaEl.textContent = safeText(ad.cta_label) || 'Visit';
    textBlock.appendChild(ctaEl);
  }

  banner.appendChild(textBlock);
  container.appendChild(banner);
  return true;
}
