(() => {
  'use strict';

  function esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getIdFromQuery() {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) return null;
    const n = Number(id);
    return Number.isFinite(n) ? n : id;
  }

  async function loadSiteById(id) {
    // If Supabase is available (index uses it), prefer live data.
    if (window.db && typeof window.db.from === 'function') {
      const { data, error } = await window.db.from('sites').select('*').eq('id', id).single();
      if (!error && data) return data;
    }
    return null;
  }

  function linkRow(label, href, text) {
    return `<div class="site-kv">
      <div class="site-k">${esc(label)}</div>
      <div class="site-v"><a class="site-link" href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a></div>
    </div>`;
  }

  function render(site) {
    const titleEl = document.getElementById('site-title');
    const detailEl = document.getElementById('site-detail');
    if (!titleEl || !detailEl) return;

    if (!site) {
      titleEl.textContent = 'Site not found';
      detailEl.innerHTML = `<div class="empty"><div class="ico">🏛️</div><p>This site could not be loaded.<br><span style="font-size:12px;opacity:.9;">Check the link, or go back to the directory.</span></p></div>`;
      return;
    }

    titleEl.textContent = site.name || 'Heritage Site';
    document.title = `${site.name || 'Site'} — Vestiga`;

    const img = site.image_url
      ? `<img class="site-hero-img" src="${esc(site.image_url)}" alt="${esc(site.name || 'Site image')}" loading="eager" decoding="async" onerror="this.style.display='none'">`
      : `<div class="site-hero-ph" aria-label="No image provided">🏛️</div>`;

    const rows = [];
    if (site.location) rows.push(`<div class="site-kv"><div class="site-k">Location</div><div class="site-v">${esc(site.location)}</div></div>`);
    if (site.submitted_by) rows.push(`<div class="site-kv"><div class="site-k">Uploaded by</div><div class="site-v">${esc(site.submitted_by)}</div></div>`);
    if (site.description) rows.push(`<div class="site-kv"><div class="site-k">About</div><div class="site-v">${esc(site.description)}</div></div>`);
    if (site.maps_url) rows.push(linkRow('Google Maps', site.maps_url, 'Open map'));
    if (site.website) rows.push(linkRow('Website', site.website, site.website));
    if (site.phone) rows.push(linkRow('Phone', `tel:${site.phone}`, site.phone));
    if (site.email) rows.push(linkRow('Email', `mailto:${site.email}`, site.email));

    detailEl.innerHTML = `
      <div class="site-hero">
        ${img}
      </div>
      <div class="site-meta">
        ${rows.join('')}
      </div>
    `;
  }

  async function init() {
    const id = getIdFromQuery();
    if (!id) {
      render(null);
      return;
    }
    const site = await loadSiteById(id);
    render(site);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
