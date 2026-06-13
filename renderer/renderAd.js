// Renderer: renderAd.js
// Injects a responsive ad banner into a DOM container.
// Fully self-contained inline styles — no dependency on Pico CSS or any framework.
// Works identically in MinimaAds, Metachain, or any other MiniDapp.
// image_data is a JPEG data URI compressed by the creator and sent via Maxima.
// All ad fields passed through DOMPurify before DOM injection (MinimaAds.md §15.3).
// Layout: always row (image left, text right) when image present; text column when no image. Width-responsive via flex + 100% width.

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
    var t = s.trim();
    // Scheme whitelist: only http/https/mailto are allowed (closes L-3).
    if (!/^(https?:|mailto:)/i.test(t)) { return '#'; }
    return t;
  }

  // Validates advertiser-controlled CSS colour values to prevent CSS injection
  // (e.g. background-image beacons). Only #RGB / #RRGGBB / #RRGGBBAA hex allowed.
  function safeColor(val, fallback) {
    var s = val ? String(val).trim() : '';
    return /^#[0-9A-Fa-f]{3,8}$/.test(s) ? s : fallback;
  }

  // Restricts image_position to a fixed enum — raw value would go into cssText.
  function safePos(val) {
    var s = val ? String(val).trim().toLowerCase() : 'center';
    var allowed = { 'center': 1, 'top': 1, 'bottom': 1, 'left': 1, 'right': 1,
                    'top left': 1, 'top right': 1, 'bottom left': 1, 'bottom right': 1 };
    return allowed[s] ? s : 'center';
  }

  function safeImageData(val) {
    if (!val) { return ''; }
    var s = String(val);
    if (/^data:image\/(jpeg|png|gif|webp);base64,/.test(s)) { return s; }
    return '';
  }

  var bgColor    = safeColor(ad.bg_color, '#ffffff');
  var textColor  = safeColor(ad.text_color, '#111111');
  var imgPos     = safePos(ad.image_position);
  var imgZoom    = Math.max(1.0, Math.min(3.0, parseFloat(ad.image_zoom) || 1.0));
  var imgWidthPct = Math.max(10, Math.min(80, parseInt(ad.image_width_pct, 10) || 40));
  var imgSrc   = safeImageData(ad.image_data);

  var showTitle = ad.show_title !== undefined ? parseInt(ad.show_title, 10) : 1;
  var showBody  = ad.show_body  !== undefined ? parseInt(ad.show_body, 10)  : 1;
  var showCta   = ad.show_cta   !== undefined ? parseInt(ad.show_cta, 10)   : 1;

  var banner = document.createElement('article');
  banner.className = 'ma-ad-banner';

  var baseFs = imgSrc ? (Math.max(0.70, Math.min(0.95, (100 - imgWidthPct) / 60 * 0.9)).toFixed(2) + 'rem') : '0.9rem';

  banner.style.cssText = 'display:flex;overflow:hidden;border-radius:6px;padding:0;'
    + 'border:1px solid #e0e0e0;max-width:600px;width:100%;margin:0 auto;'
    + 'font-family:sans-serif;box-sizing:border-box;'
    + (imgSrc ? 'flex-direction:row;align-items:stretch;min-height:80px;max-height:160px;' : 'flex-direction:column;');

  if (imgSrc) {
    var imgWrap = document.createElement('div');
    imgWrap.style.cssText = 'width:' + imgWidthPct + '%;flex-shrink:0;overflow:hidden;position:relative;';

    var zoomCss = ';transform:scale(' + imgZoom + ');transform-origin:' + imgPos + ';';
    if (ad.cta_url) {
      var imgEl = document.createElement('img');
      imgEl.src = imgSrc;
      imgEl.alt = safeText(ad.title);
      imgEl.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:'
        + imgPos + ';display:block;' + zoomCss;
      var imgLink = document.createElement('a');
      imgLink.href = safeUrl(ad.cta_url);
      imgLink.setAttribute('target', '_blank');
      imgLink.setAttribute('rel', 'noopener noreferrer');
      imgLink.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
      imgLink.appendChild(imgEl);
      imgWrap.appendChild(imgLink);
    } else {
      var imgEl = document.createElement('img');
      imgEl.src = imgSrc;
      imgEl.alt = safeText(ad.title);
      imgEl.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;'
        + 'object-fit:cover;object-position:' + imgPos + ';display:block;' + zoomCss;
      imgWrap.appendChild(imgEl);
    }
    banner.appendChild(imgWrap);
  }

  var textBlock = document.createElement('div');
  textBlock.style.cssText = 'padding:0.75rem 1rem;display:flex;flex-direction:column;justify-content:flex-start;'
    + 'font-size:' + baseFs + ';gap:0.35em;background:' + bgColor + ';box-sizing:border-box;'
    + (imgSrc ? 'flex:1;' : '');

  if (showTitle !== 0) {
    var titleEl = document.createElement('strong');
    titleEl.style.cssText = 'color:' + textColor + ';font-size:1.05em;line-height:1.3;';
    titleEl.textContent = safeText(ad.title);
    textBlock.appendChild(titleEl);
  }

  if (ad.body && showBody !== 0) {
    var bodyEl = document.createElement('p');
    bodyEl.style.cssText = 'margin:0;font-size:0.95em;color:' + textColor + ';line-height:1.4;';
    bodyEl.textContent = safeText(ad.body);
    textBlock.appendChild(bodyEl);
  }

  if (ad.cta_url && showCta !== 0) {
    var ctaEl = document.createElement('a');
    ctaEl.href = safeUrl(ad.cta_url);
    ctaEl.setAttribute('target', '_blank');
    ctaEl.setAttribute('rel', 'noopener noreferrer');
    ctaEl.style.cssText = 'display:inline-block;align-self:flex-start;margin-top:0.4em;'
      + 'padding:0.35em 0.85em;border-radius:4px;background:' + textColor + ';'
      + 'color:' + bgColor + ';text-decoration:none;font-size:0.9em;font-weight:600;';
    ctaEl.textContent = safeText(ad.cta_label) || 'Visit';
    textBlock.appendChild(ctaEl);
  }

  banner.appendChild(textBlock);
  container.appendChild(banner);
  return true;
}
