// GitHub Pages demo glue: runs the Go backend (api.wasm) inside the browser and
// answers the frontend's API calls. Data lives in this browser's localStorage only.
(() => {
  const script = document.currentScript;
  const base = (script && script.dataset.base) || '';
  const STATE_KEY = 'ss-demo-state-v1';
  const SESSION_KEY = 'standard-setting-session';

  const store = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage full or blocked: demo keeps working in memory */ } },
    remove(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } }
  };

  let markReady;
  const ready = new Promise((resolve, reject) => { markReady = { resolve, reject }; });

  async function boot() {
    const go = new Go();
    const wasmUrl = `${base}/demo/api.wasm`;
    let result;
    try {
      result = await WebAssembly.instantiateStreaming(fetch(wasmUrl), go.importObject);
    } catch {
      const bytes = await (await fetch(wasmUrl)).arrayBuffer();
      result = await WebAssembly.instantiate(bytes, go.importObject);
    }
    go.run(result.instance);
    let saved = store.get(STATE_KEY);
    if (!saved || globalThis.ssImport(saved) !== '') {
      saved = await (await fetch(`${base}/demo/seed.json`, { cache: 'no-cache' })).text();
      const error = globalThis.ssImport(saved);
      if (error) throw new Error(`Data demo gagal dimuat: ${error}`);
      store.set(STATE_KEY, saved);
    }
  }
  boot().then(() => { markReady.resolve(); setStatus('ready'); }, (error) => { markReady.reject(error); setStatus('error', error.message); });

  globalThis.ssDemoFetch = async (input, init = {}) => {
    await ready;
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const headers = new Headers(init.headers || {});
    const method = (init.method || 'GET').toUpperCase();
    const body = typeof init.body === 'string' ? init.body : '';
    const res = await globalThis.ssHandle(method, url.pathname + url.search, headers.get('Authorization') || '', body);
    if (method !== 'GET') store.set(STATE_KEY, globalThis.ssExport());
    return new Response(res.status === 204 ? null : res.body, { status: res.status, headers: { 'Content-Type': 'application/json' } });
  };

  // ---- Demo banner -------------------------------------------------------
  let accounts = { password: 'demo123', accounts: [] };
  fetch(`${base}/demo/accounts.json`).then(r => r.json()).then(data => { accounts = data; render(); }).catch(() => {});

  const css = `
  .ssd{position:fixed;left:12px;bottom:12px;transition:bottom .2s;z-index:9999;font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#13302d}
  .ssd.raised{bottom:86px}
  .ssd *{box-sizing:border-box}
  .ssd-pill{display:flex;align-items:center;gap:8px;background:#fff7e6;border:1px solid #f0c27a;border-radius:999px;padding:7px 12px;box-shadow:0 4px 16px rgba(0,0,0,.12);cursor:pointer}
  .ssd-pill b{color:#8a4b00}
  .ssd-dot{width:8px;height:8px;border-radius:50%;background:#c58a2a}
  .ssd-dot.ready{background:#2e8b57}.ssd-dot.error{background:#c0392b}
  .ssd-panel{margin-bottom:8px;width:min(360px,calc(100vw - 24px));background:#fff;border:1px solid #d6e2df;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:14px;display:grid;gap:10px}
  .ssd-panel h4{margin:0;font-size:14px}
  .ssd-panel p{margin:0;color:#4b5f5b}
  .ssd-acc{display:grid;gap:6px}
  .ssd-acc button{all:unset;cursor:pointer;display:grid;gap:1px;padding:8px 10px;border:1px solid #d6e2df;border-radius:8px}
  .ssd-acc button:hover,.ssd-acc button:focus-visible{border-color:#2f6f69;background:#eef6f4}
  .ssd-acc small{color:#5b6b68}.ssd-acc code{font:12px ui-monospace,Menlo,monospace}
  .ssd-row{display:flex;gap:8px;justify-content:space-between;align-items:center}
  .ssd-reset{all:unset;cursor:pointer;color:#b03a2e;font-weight:600}
  .ssd-reset:focus-visible{outline:2px solid #b03a2e;outline-offset:2px}
  .ssd-close{all:unset;cursor:pointer;color:#4b5f5b}
  `;
  let open = false, status = 'loading', statusText = '';
  const root = document.createElement('div');
  root.className = 'ssd';
  function setStatus(next, text = '') { status = next; statusText = text; render(); }

  function fillLogin(username) {
    const set = (selector, value) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    };
    if (!location.pathname.endsWith('/login')) {
      store.remove(SESSION_KEY);
      sessionStorage.setItem('ssd-fill', username);
      location.href = `${base}/login`;
      return;
    }
    set('input[autocomplete="username"], input[name="username"], #username', username);
    set('input[type="password"]', accounts.password);
    open = false; render();
  }

  function render() {
    const label = status === 'ready' ? 'Mode demo' : status === 'error' ? 'Demo gagal dimuat' : 'Memuat demo…';
    root.innerHTML = `<style>${css}</style>${open ? `
      <div class="ssd-panel" role="dialog" aria-label="Info mode demo">
        <div class="ssd-row"><h4>Mode demo Standard Setting</h4><button class="ssd-close" data-close aria-label="Tutup">✕</button></div>
        <p>Aplikasi berjalan sepenuhnya di browser ini. Data contoh fiktif, perubahan hanya tersimpan di browser ini.</p>
        ${status === 'error' ? `<p style="color:#b03a2e">${statusText}</p>` : ''}
        <p>Klik akun untuk mengisi form login. Semua password: <code>${accounts.password}</code></p>
        <div class="ssd-acc">${accounts.accounts.map(a => `<button data-user="${a.username}"><span><b>${a.role}</b> · ${a.name}</span><small><code>${a.username}</code></small></button>`).join('')}</div>
        <div class="ssd-row"><small>Panelis, PIC, dan Admin bisa dicoba bergantian.</small><button class="ssd-reset" data-reset>Reset data demo</button></div>
      </div>` : ''}
      <div class="ssd-pill" role="button" tabindex="0" data-toggle><span class="ssd-dot ${status}"></span><b>${label}</b><span>· akun & reset</span></div>`;
  }
  root.addEventListener('click', (event) => {
    const t = event.target.closest('[data-toggle],[data-close],[data-user],[data-reset]');
    if (!t) return;
    if (t.dataset.user) return fillLogin(t.dataset.user);
    if ('reset' in t.dataset) { store.remove(STATE_KEY); store.remove(SESSION_KEY); location.href = `${base}/login`; return; }
    open = 'toggle' in t.dataset ? !open : false;
    render();
  });
  root.addEventListener('keydown', (event) => { if (event.key === 'Enter' && event.target.matches('[data-toggle]')) { open = !open; render(); } });

  function mount() {
    document.body.appendChild(root);
    // Sit above pages that have a sticky action footer (Panelis form, PIC monitoring).
    setInterval(() => root.classList.toggle('raised', !!document.querySelector('.sticky-actions')), 500);
    render();
    const pending = sessionStorage.getItem('ssd-fill');
    if (pending && location.pathname.endsWith('/login')) {
      sessionStorage.removeItem('ssd-fill');
      const tryFill = (n) => document.querySelector('input[type="password"]') ? fillLogin(pending) : n > 0 && setTimeout(() => tryFill(n - 1), 200);
      tryFill(25);
    }
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
