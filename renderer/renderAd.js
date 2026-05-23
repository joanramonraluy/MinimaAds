// Renderer: renderAd.js
// Injects a responsive ad banner into a DOM container.
// Fully self-contained inline styles — no dependency on Pico CSS or any framework.
// Works identically in MinimaAds, Metachain, or any other MiniDapp.
// image_data is a JPEG data URI compressed by the creator and sent via Maxima.
// All ad fields passed through DOMPurify before DOM injection (MinimaAds.md §15.3).
// Layout: ≥480px container → row (image left, text right); <480px with image → image only; <480px no image → text column.

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

  function safeImageData(val) {
    if (!val) { return ''; }
    var s = String(val);
    if (/^data:image\/(jpeg|png|gif|webp);base64,/.test(s)) { return s; }
    return '';
  }

  var bgColor    = ad.bg_color        || '#ffffff';
  var textColor  = ad.text_color      || '#111111';
  var imgPos     = ad.image_position  || 'center';
  var imgZoom    = parseFloat(ad.image_zoom) || 1.0;
  var imgWidthPct = parseInt(ad.image_width_pct, 10) || 40;
  var imgSrc   = safeImageData(ad.image_data);
  var isMobile = container.offsetWidth > 0 && container.offsetWidth < 480;

  var banner = document.createElement('article');
  banner.className = 'ma-ad-banner';

  if (isMobile && imgSrc) {
    var zoomCssMob = 'transform:scale(' + imgZoom + ');transform-origin:' + imgPos + ';';
    banner.style.cssText = 'display:block;overflow:hidden;border-radius:6px;padding:0;'
      + 'border:1px solid #e0e0e0;max-width:600px;width:100%;margin:0 auto;'
      + 'font-family:sans-serif;box-sizing:border-box;height:140px;position:relative;';
    var mobImg = document.createElement('img');
    mobImg.src = imgSrc;
    mobImg.alt = safeText(ad.title);
    mobImg.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:'
      + imgPos + ';display:block;' + zoomCssMob;
    if (ad.cta_url) {
      var mobLink = document.createElement('a');
      mobLink.href = safeUrl(ad.cta_url);
      mobLink.setAttribute('target', '_blank');
      mobLink.setAttribute('rel', 'noopener noreferrer');
      mobLink.style.cssText = 'display:block;width:100%;height:100%;';
      mobLink.appendChild(mobImg);
      banner.appendChild(mobLink);
    } else {
      banner.appendChild(mobImg);
    }
    container.appendChild(banner);
    return true;
  }

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

  if (ad.show_title !== 0) {
    var titleEl = document.createElement('strong');
    titleEl.style.cssText = 'color:' + textColor + ';font-size:1.05em;line-height:1.3;';
    titleEl.textContent = safeText(ad.title);
    textBlock.appendChild(titleEl);
  }

  if (ad.body && ad.show_body !== 0) {
    var bodyEl = document.createElement('p');
    bodyEl.style.cssText = 'margin:0;font-size:0.95em;color:' + textColor + ';line-height:1.4;';
    bodyEl.textContent = safeText(ad.body);
    textBlock.appendChild(bodyEl);
  }

  if (ad.cta_url && ad.show_cta !== 0) {
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
