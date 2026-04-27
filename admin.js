'use strict';

// NOTE: This is a *client-side* password gate. Anyone who can view source can find the password.
// For real protection, use host-level auth (Netlify/Vercel) or a server-side admin workflow.
const ADMIN_PASSWORD = 'vestiga2024';

const SUPABASE_URL = 'https://vwhnnnuxxmdqhclkjopf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3aG5ubnV4eG1kcWhjbGtqb3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTU1MzksImV4cCI6MjA5MTc3MTUzOX0.1UjltDBWY9-tg3ZIFVe0hJYcg6-AlNsHRYqnDNs7rMA';

function supabaseUnavailableMessage() {
  return 'Supabase is unavailable (the Supabase script failed to load). Make sure you are online and not blocking cdn.jsdelivr.net. If you are opening this from your filesystem, run a local server instead of using file://.';
}

const memoryStorage = (() => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
  };
})();

function canUseLocalStorage() {
  try {
    const k = '__vestiga_ls_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

const localStorageOk = canUseLocalStorage();
const supabaseStorage = {
  getItem: (key) => {
    if (localStorageOk) {
      try { return window.localStorage.getItem(key); } catch { /* fall through */ }
    }
    return memoryStorage.getItem(key);
  },
  setItem: (key, value) => {
    if (localStorageOk) {
      try { window.localStorage.setItem(key, value); return; } catch { /* fall through */ }
    }
    memoryStorage.setItem(key, value);
  },
  removeItem: (key) => {
    if (localStorageOk) {
      try { window.localStorage.removeItem(key); return; } catch { /* fall through */ }
    }
    memoryStorage.removeItem(key);
  },
};

const db = (window.supabase && typeof window.supabase.createClient === 'function')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: localStorageOk,
      autoRefreshToken: localStorageOk,
      storage: supabaseStorage,
    },
  })
  : null;

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function ago(ts){const d=Math.floor((Date.now()-new Date(ts))/1000);if(d<60)return'just now';if(d<3600)return Math.floor(d/60)+'m ago';if(d<86400)return Math.floor(d/3600)+'h ago';return Math.floor(d/86400)+'d ago';}

function passwordGate(){
  const key = 'vestiga_admin_ok';
  if (sessionStorage.getItem(key) === '1') return true;
  const pass = prompt('Admin password:');
  if (pass !== ADMIN_PASSWORD) {
    alert('Wrong password.');
    location.href = 'index.html';
    return false;
  }
  sessionStorage.setItem(key, '1');
  return true;
}

let currentUser = null;

if (db) {
  db.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    updateAuthUi();
  });
}

async function initAuth(){
  if (!db) { updateAuthUi(); return; }
  const { data: { session } } = await db.auth.getSession();
  currentUser = session?.user || null;
  updateAuthUi();
}

function updateAuthUi(){
  const status = document.getElementById('admin-status');
  const signOutBtn = document.getElementById('admin-signout');
  const signInBtn = document.getElementById('admin-signin');
  if (currentUser) {
    status.textContent = 'Signed in as ' + (currentUser.email || 'user');
    signOutBtn.style.display = 'inline-block';
    signInBtn.style.display = 'none';
  } else {
    status.textContent = 'Not signed in';
    signOutBtn.style.display = 'none';
    signInBtn.style.display = 'inline-block';
  }
}

async function signIn(){
  if (!db) { alert(supabaseUnavailableMessage()); return; }
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-pass').value;
  if (!email || !password) { alert('Enter email + password'); return; }
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    const status = document.getElementById('admin-status');
    if (status) status.textContent = 'Sign-in failed: ' + error.message;
    setRlsHint('If you see a 400 on /auth/v1/token, double-check email/password and make sure the user is confirmed in Supabase Auth → Users. For quick testing you can disable email confirmation (Auth → Providers → Email) or manually confirm the user.');
    alert(error.message);
  }
}

async function signOut(){
  if (!db) { currentUser = null; updateAuthUi(); return; }
  await db.auth.signOut();
}

function setRlsHint(msg){
  const el = document.getElementById('rls-hint');
  el.style.display = 'block';
  el.textContent = msg;
}

function looksLikeRlsOrPermError(error) {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();
  return (
    msg.includes('row-level security') ||
    msg.includes('rls') ||
    msg.includes('permission denied') ||
    msg.includes('not allowed') ||
    msg.includes('insufficient_privilege')
  );
}

const DEBUG = new URLSearchParams(location.search).has('debug');
let currentListStatus = 'pending';

function siteCard(s){
  const links=[];
  if(s.maps_url) links.push(`<a class="site-link" href="${esc(s.maps_url)}" target="_blank" rel="noopener">📍 Maps</a>`);
  if(s.phone) links.push(`<a class="site-link" href="tel:${esc(s.phone)}">📞 Call</a>`);
  if(s.email) links.push(`<a class="site-link" href="mailto:${esc(s.email)}">✉️ Email</a>`);
  if(s.website) links.push(`<a class="site-link" href="${esc(s.website)}" target="_blank" rel="noopener">🌐 Website</a>`);

  const img = s.image_url
    ? `<img src="${esc(s.image_url)}" alt="${esc(s.name)}" loading="lazy" onerror="this.parentElement.innerHTML='🏛️'">`
    : '🏛️';

  const st = String(s.status || '').toLowerCase();
  const badge =
    st === 'approved' ? `<span class="pending-badge" style="background:rgba(92,200,122,0.18);border:1px solid rgba(92,200,122,0.35);color:var(--success);">APPROVED</span>` :
    st === 'rejected' ? `<span class="pending-badge" style="background:rgba(224,82,82,0.16);border:1px solid rgba(224,82,82,0.32);color:var(--err);">REJECTED</span>` :
    `<span class="pending-badge">PENDING</span>`;

  const actions = st === 'pending'
    ? `<button class="rate-btn" style="background:var(--success);" onclick="approve(${s.id})">Approve</button>
       <button class="rate-btn" style="background:var(--err);" onclick="reject(${s.id})">Reject</button>`
    : '';

  return `<div class="site-card" id="p-${s.id}">
    <div class="site-card-img">${img}</div>
    <div class="site-card-body">
      <div class="site-card-name">${esc(s.name)} ${badge}</div>
      <div class="site-card-loc">📍 ${esc(s.location)}</div>
      ${s.description?`<div class="site-desc">${esc(s.description)}</div>`:''}
      <div class="admin-muted" style="margin-top:10px;">Submitted by ${esc(s.submitted_by||'anonymous')} · ${ago(s.created_at)}</div>
    </div>
    ${links.length?`<div class="site-links">${links.join('')}</div>`:''}
    <div class="site-footer" style="justify-content:flex-end;gap:10px;">
      ${actions}
      <button class="rate-btn" style="background:transparent;border:1px solid rgba(44,36,22,0.18);color:var(--stone);" onclick="deleteSite(${s.id})">Delete</button>
    </div>
  </div>`;
}

async function loadByStatus(status){
  if (!db) { alert(supabaseUnavailableMessage()); return; }
  currentListStatus = status;
  const label = status === 'approved' ? 'approved' : 'pending';
  document.getElementById('pending-grid').innerHTML = `<div style="font-size:14px;color:var(--ash);padding:1rem 0;">Loading ${label} sites...</div>`;
  document.getElementById('rls-hint').style.display = 'none';

  let data, error;
  ({ data, error } = await db.from('sites').select('*').eq('status', status).order('created_at',{ascending:false}));
  if (error && looksLikeRlsOrPermError(error) && currentUser?.id) {
    // Fallback: many setups allow users to read only their own submissions (by user_id).
    // This makes "I submitted a site but can't see it" work even when moderation is locked down.
    const fallback = await db.from('sites')
      .select('*')
      .eq('status', status)
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    data = fallback.data;
    error = fallback.error;
    if (!error) {
      setRlsHint(`Your Supabase Row Level Security prevents reading all ${label} submissions. Showing only ${label} sites submitted by the currently signed-in user.`);
    }
  }
  if (error) {
    document.getElementById('pending-grid').innerHTML = '';
    setRlsHint(`Could not read ${label} sites (likely blocked by RLS). If you just want to see your own submissions, ensure \`sites.user_id\` is set and add a SELECT policy for authenticated users where \`user_id = auth.uid()\`.`);
    alert(`Error loading ${label} sites:\n` + error.message);
    return;
  }

  const pending = data || [];
  if (DEBUG && !pending.length && currentUser?.id) {
    // If there are "no pending sites", it's often because the row was inserted with a different status,
    // or because the current signed-in user isn't the submitter. Show recent submissions for this user
    // to make debugging obvious.
    const mine = await db.from('sites').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(10);
    if (!mine.error && (mine.data || []).length) {
      setRlsHint(`No ${label} sites found. Showing your 10 most recent submissions (any status) because debug mode is enabled. If you submitted from a different browser/domain, sign in with the same account here.`);
      document.getElementById('pending-count').textContent = 'Showing your recent submissions';
      document.getElementById('pending-grid').innerHTML = mine.data.map(siteCard).join('');
      return;
    }
  }

  document.getElementById('pending-count').textContent = pending.length ? `${pending.length} ${label}` : `No ${label} sites`;
  const emptyMsg = status === 'approved' ? 'No approved sites.' : 'No pending sites.';
  document.getElementById('pending-grid').innerHTML = pending.length ? pending.map(siteCard).join('') : `<div class="empty"><div class="ico">🏛️</div><p>${emptyMsg}</p></div>`;
}

async function loadPending(){
  return loadByStatus('pending');
}

async function loadApproved(){
  return loadByStatus('approved');
}

async function setStatus(id, status){
  if (!db) { alert(supabaseUnavailableMessage()); return; }
  let error, data;
  ({ error, data } = await db.from('sites').update({ status }).eq('id', id).select('id,status'));
  if (error && looksLikeRlsOrPermError(error) && currentUser?.id) {
    // Fallback: some setups allow users to update only their own rows.
    const fallback = await db.from('sites').update({ status }).eq('id', id).eq('user_id', currentUser.id).select('id,status');
    error = fallback.error;
    data = fallback.data;
    if (!error && (data || []).length) {
      setRlsHint('Your Supabase Row Level Security prevents moderating other users. Updated status only for a site that belongs to the currently signed-in user.');
    }
  }
  if (!error && (!data || !data.length)) {
    const msg = 'Could not update this site because 0 rows were affected. This usually means Supabase RLS filtered the row (no permission), or it no longer exists.';
    setRlsHint(msg);
    alert(msg);
    return;
  }
  if (error) {
    setRlsHint('Could not update site status (likely blocked by RLS/update policy). For a quick demo, approve/reject in Supabase Dashboard → Table Editor → sites. For a real fix, add an UPDATE policy (admin-only or owner-only).');
    alert('Error updating site:\n' + error.message);
    return;
  }
  const el = document.getElementById('p-' + id);
  if (el) el.remove();
  // Keep the list/count accurate after moderation.
  loadByStatus(currentListStatus);
}

function looksLikeForeignKeyError(error) {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();
  return msg.includes('foreign key') || msg.includes('violates foreign key') || msg.includes('23503');
}

// ── CSV IMPORT ──
function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;

  const pushCell = () => { row.push(cur); cur = ''; };
  const pushRow = () => { rows.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { pushCell(); continue; }
    if (ch === '\n') { pushCell(); pushRow(); continue; }
    if (ch === '\r') { continue; }
    cur += ch;
  }

  // Final cell/row
  pushCell();
  pushRow();

  // Trim trailing empty row
  while (rows.length && rows[rows.length - 1].every(c => String(c || '').trim() === '')) rows.pop();
  return rows;
}

function csvTemplateText() {
  return [
    'name,location,description,phone,email,website,maps_url,image_url,submitted_by,status',
    '"[FILL: Site name]","[FILL: City, Region, Country]","[FILL: About this site]","","","","","","Admin Import","approved"',
  ].join('\n') + '\n';
}

function downloadCsvTemplate() {
  const blob = new Blob([csvTemplateText()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vestiga-sites-template.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function setCsvStatus(msg) {
  const el = document.getElementById('csv-status');
  if (el) el.textContent = msg || '';
}

function pickCsvDefaultStatus() {
  const el = document.getElementById('csv-default-status');
  const v = String(el?.value || 'approved').toLowerCase();
  return (v === 'pending' || v === 'approved' || v === 'rejected') ? v : 'approved';
}

function cleanStatus(v, fallback) {
  const s = String(v || '').trim().toLowerCase();
  return (s === 'pending' || s === 'approved' || s === 'rejected') ? s : fallback;
}

function nonEmptyOrNull(v) {
  const s = String(v || '').trim();
  return s ? s : null;
}

async function importCsv() {
  if (!db) { alert(supabaseUnavailableMessage()); return; }
  if (!currentUser) { alert('Sign in as admin first.'); return; }

  const fileInput = document.getElementById('csv-file');
  const file = fileInput?.files?.[0] || null;
  if (!file) { alert('Choose a CSV file first.'); return; }

  const btn = document.getElementById('btn-csv-import');
  btn.disabled = true;
  setCsvStatus('Reading CSV...');

  let text = '';
  try { text = await file.text(); }
  catch (e) {
    btn.disabled = false;
    setCsvStatus('');
    alert('Could not read CSV file.');
    return;
  }

  const rows = parseCsv(text);
  if (!rows.length) {
    btn.disabled = false;
    setCsvStatus('');
    alert('CSV is empty.');
    return;
  }

  const headers = rows[0].map(normalizeHeader);
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
  const required = ['name', 'location', 'description'];
  const missing = required.filter(h => idx[h] === undefined);
  if (missing.length) {
    btn.disabled = false;
    setCsvStatus('');
    alert('CSV missing required columns: ' + missing.join(', '));
    return;
  }

  const fallbackStatus = pickCsvDefaultStatus();
  const payloads = [];
  const errors = [];

  for (let r = 1; r < rows.length; r++) {
    const line = rows[r];
    const get = (key) => (idx[key] === undefined ? '' : (line[idx[key]] ?? ''));

    const name = String(get('name') || '').trim();
    const location = String(get('location') || '').trim();
    const description = String(get('description') || '').trim();
    if (!name || !location || !description) {
      errors.push(`Row ${r + 1}: missing name/location/description`);
      continue;
    }

    const status = cleanStatus(get('status'), fallbackStatus);
    payloads.push({
      name,
      location,
      description,
      phone: nonEmptyOrNull(get('phone')),
      email: nonEmptyOrNull(get('email')),
      website: nonEmptyOrNull(get('website')),
      maps_url: nonEmptyOrNull(get('maps_url')),
      image_url: nonEmptyOrNull(get('image_url')),
      submitted_by: nonEmptyOrNull(get('submitted_by')) || 'Admin Import',
      status,
      user_id: currentUser.id, // attribute imports to the signed-in admin
    });
  }

  if (!payloads.length) {
    btn.disabled = false;
    setCsvStatus('');
    alert('No valid rows to import.\n' + (errors.slice(0, 8).join('\n') || ''));
    return;
  }

  if (errors.length) {
    if (!confirm(`Proceed importing ${payloads.length} rows?\n\nSkipped ${errors.length} invalid rows.\n(You can continue; invalid rows will be ignored.)`)) {
      btn.disabled = false;
      setCsvStatus('');
      return;
    }
  }

  const chunkSize = 100;
  let inserted = 0;
  setCsvStatus(`Importing 0 / ${payloads.length}...`);

  for (let i = 0; i < payloads.length; i += chunkSize) {
    const chunk = payloads.slice(i, i + chunkSize);
    const { error } = await db.from('sites').insert(chunk);
    if (error) {
      btn.disabled = false;
      setCsvStatus('');
      setRlsHint('CSV import failed. This is commonly blocked by Row Level Security (RLS) INSERT policy on public.sites. Ensure authenticated users (or admin users) are allowed to INSERT into sites.');
      alert('Import failed:\n' + error.message);
      return;
    }
    inserted += chunk.length;
    setCsvStatus(`Importing ${inserted} / ${payloads.length}...`);
  }

  btn.disabled = false;
  setCsvStatus(`Imported ${inserted} sites.`);
  loadByStatus(currentListStatus);
}

async function deleteSiteImpl(id){
  if (!db) { alert(supabaseUnavailableMessage()); return; }
  if (!confirm('Delete this site permanently?')) return;

  let error, data;
  ({ error, data } = await db.from('sites').delete().eq('id', id).select('id'));
  if (!error && (!data || !data.length) && currentUser?.id) {
    const fallback = await db.from('sites').delete().eq('id', id).eq('user_id', currentUser.id).select('id');
    error = fallback.error;
    data = fallback.data;
    if (!error && (data || []).length) {
      setRlsHint('Your Supabase Row Level Security prevents deleting other users. Deleted a site only when it belongs to the currently signed-in user.');
    }
  }
  if (!error && (!data || !data.length)) {
    const msg = 'Could not delete this site because 0 rows were affected. This usually means Supabase RLS filtered the row (no permission), or it no longer exists.';
    setRlsHint(msg);
    alert(msg);
    return;
  }
  if (error && looksLikeForeignKeyError(error)) {
    // Common when related rows exist (e.g., ratings referencing site_id).
    // Fall back to "soft delete" by marking as rejected, so it disappears from approved/pending lists.
    const soft = await db.from('sites').update({ status: 'rejected' }).eq('id', id).select('id,status');
    if (!soft.error) {
      if (!soft.data || !soft.data.length) {
        const msg = 'Could not mark this site as rejected because 0 rows were affected (likely RLS).';
        setRlsHint(msg);
        alert(msg);
        return;
      }
      setRlsHint('Could not hard-delete this site because it is referenced by other records (e.g., ratings). Marked it as REJECTED instead so it no longer appears in lists. For real deletion, add ON DELETE CASCADE or delete dependent rows first.');
      const el = document.getElementById('p-' + id);
      if (el) el.remove();
      loadByStatus(currentListStatus);
      return;
    }
  }
  if (error) {
    setRlsHint(`Could not delete site. ${error.message || error} (likely RLS/delete policy or constraints). Delete it in Supabase Dashboard → Table Editor → sites, or add an admin-only DELETE policy.`);
    alert('Error deleting site:\n' + error.message);
    return;
  }
  const el = document.getElementById('p-' + id);
  if (el) el.remove();
  loadByStatus(currentListStatus);
}

window.approve = (id) => setStatus(id, 'approved');
window.reject = (id) => setStatus(id, 'rejected');
window.deleteSite = (id) => deleteSiteImpl(id);

if (passwordGate()) {
  initAuth();
  document.getElementById('admin-signin').addEventListener('click', signIn);
  document.getElementById('admin-signout').addEventListener('click', signOut);
  document.getElementById('btn-load').addEventListener('click', loadPending);
  document.getElementById('btn-load-approved').addEventListener('click', loadApproved);
  document.getElementById('btn-csv-template')?.addEventListener('click', downloadCsvTemplate);
  document.getElementById('btn-csv-import')?.addEventListener('click', importCsv);
  if (!db) {
    const status = document.getElementById('admin-status');
    if (status) status.textContent = supabaseUnavailableMessage();
    document.getElementById('admin-signin').disabled = true;
    document.getElementById('btn-load').disabled = true;
    document.getElementById('btn-load-approved').disabled = true;
    const importBtn = document.getElementById('btn-csv-import');
    if (importBtn) importBtn.disabled = true;
  }
}

