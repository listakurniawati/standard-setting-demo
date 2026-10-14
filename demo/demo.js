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
  .ssd-tours{display:grid;gap:6px;padding:10px;border-radius:10px;background:#eef6f4;border:1px solid #cfe3df}
  .ssd-tours>div{display:flex;gap:8px;flex-wrap:wrap}
  .ssd-tours button{all:unset;cursor:pointer;padding:7px 11px;border-radius:8px;background:#2f6f69;color:#fff;font-weight:600}
  .ssd-tours button:hover,.ssd-tours button:focus-visible{background:#235752}
  .ssd-tours small{color:#4b5f5b}
  `;
  let open = false, status = 'loading', statusText = '', tourError = '';
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
        <div class="ssd-tours"><b>Tur terpandu</b><div><button data-tour="panelis">▶ Tur Panelis</button><button data-tour="pic">▶ Tur PIC Mapel</button></div><small>Login otomatis lalu menjelaskan layar langkah demi langkah.</small></div>
        ${tourError ? `<p style="color:#b03a2e">${tourError}</p>` : ''}
        <p>Atau klik akun untuk mengisi form login. Semua password: <code>${accounts.password}</code></p>
        <div class="ssd-acc">${accounts.accounts.map(a => `<button data-user="${a.username}"><span><b>${a.role}</b> · ${a.name}</span><small><code>${a.username}</code></small></button>`).join('')}</div>
        <div class="ssd-row"><small>Panelis, PIC, dan Admin bisa dicoba bergantian.</small><button class="ssd-reset" data-reset>Reset data demo</button></div>
      </div>` : ''}
      <div class="ssd-pill" role="button" tabindex="0" data-toggle><span class="ssd-dot ${status}"></span><b>${label}</b><span>· tur, akun & reset</span></div>`;
  }
  root.addEventListener('click', (event) => {
    const t = event.target.closest('[data-toggle],[data-close],[data-user],[data-reset],[data-tour]');
    if (!t) return;
    if (t.dataset.tour) return startTour(t.dataset.tour);
    if (t.dataset.user) return fillLogin(t.dataset.user);
    if ('reset' in t.dataset) { store.remove(STATE_KEY); store.remove(SESSION_KEY); location.href = `${base}/login`; return; }
    open = 'toggle' in t.dataset ? !open : false;
    render();
  });
  root.addEventListener('keydown', (event) => { if (event.key === 'Enter' && event.target.matches('[data-toggle]')) { open = !open; render(); } });


  // ---- Guided tours (Panelis / PIC Mapel) ---------------------------------
  const TOUR_KEY = 'ssd-tour';
  const TOURS = {
    panelis: {
      title: 'Tur Panelis', path: '/panelis', account: () => accounts.accounts.find((a) => a.role === 'Panelis'),
      steps: [
        { sel: '.panelist-header', title: 'Borang penilaian Anda', body: 'Anda masuk sebagai <b>Sari Pertiwi</b>, panelis Matematika. Judul menunjukkan putaran yang sedang berjalan. Borang hanya berisi butir yang ditugaskan ke mapel Anda.' },
        { sel: '.text-size', title: 'Ukuran teks', body: 'Bila huruf terasa kecil, pilih <b>A+</b> atau <b>A++</b>. Pilihan ini diingat di komputer Anda.' },
        { sel: '.guide', title: 'Petunjuk pengisian', body: 'Ringkasan cara mengisi beserta contoh. Klik judulnya untuk membuka atau menyembunyikan.' },
        { sel: '.form-progress', title: 'Progres', body: 'Menghitung butir yang <b>sudah tersimpan</b>. Tombol <b>Ke butir yang belum diisi</b> langsung membawa Anda ke butir berikutnya yang masih kosong.' },
        { sel: '.question-nav', title: 'Daftar butir', body: 'Klik nomor butir untuk melompat. Tulisan <b>Selesai</b> berarti sudah tersimpan, <b>Belum</b> berarti masih perlu diisi.' },
        { sel: '.question-card .single-score', title: 'Butir Pilihan Ganda', body: 'Bayangkan 100 kandidat yang kemampuannya <b>tepat di batas lulus</b>. Tulis berapa dari mereka yang Anda perkirakan menjawab benar (0–100). Bisa diketik langsung atau memakai tombol <b>−</b> / <b>+</b>.' },
        { sel: '.question-card .distribution-wrap', title: 'Butir PG Kompleks / Essay', body: 'Bagikan 100 kandidat batas lulus ke setiap skor. Kotak di bawahnya membantu menghitung: <b>Kurang</b>, <b>Lebih</b>, atau <b>Pas ✓</b>.' },
        { sel: '.question-card .previous-round', title: 'Jawaban putaran sebelumnya', body: 'Jawaban Anda di putaran 1 ditampilkan sebagai pembanding. Setelah diskusi panel, Anda boleh mengubah atau mempertahankannya.' },
        { sel: '.question-card .question-status', title: 'Tersimpan otomatis', body: 'Jawaban disimpan otomatis setelah Anda berhenti mengetik. Statusnya berubah menjadi <b>Tersimpan</b>. Bila koneksi gagal, muncul tombol <b>Coba Simpan Lagi</b>.' },
        { sel: '.sticky-actions', title: 'Tombol di bawah layar', body: '<b>Simpan Sekarang</b> mengirim semua isian sekaligus (biasanya tidak perlu, karena sudah otomatis). <b>Butir berikutnya yang belum diisi</b> membawa Anda ke butir yang masih kosong.' },
        { sel: '.question-card:nth-of-type(4)', title: 'Coba sekarang', body: 'Isi butir ini, misalnya <b>70</b>, lalu lihat progres naik menjadi 4 dari 6. Setelah semua panelis lengkap, PIC Mapel dapat memfinalisasi putaran.', next: 'pic' }
      ]
    },
    pic: {
      title: 'Tur PIC Mapel', path: '/pic', account: () => accounts.accounts.find((a) => a.role === 'PIC Mapel'),
      steps: [
        { sel: '.timeline', title: 'Putaran penilaian', body: 'Anda masuk sebagai <b>Rina Wulandari</b>, PIC Matematika. Putaran 1 sudah difinalisasi, putaran 2 sedang berlangsung. Putaran berikutnya terbuka otomatis saat putaran ini difinalisasi.' },
        { sel: '.card.data-table', title: 'Antrean panelis', body: 'Progres tiap panelis dan kapan terakhir aktif, diperbarui tiap 10 detik. Status: <b>Selesai</b>, <b>Menilai</b>, <b>Perlu Perhatian</b> (sudah mulai tapi tidak aktif lebih dari 24 jam), dan <b>Belum Menilai</b>.' },
        { sel: '.monitor-row:nth-of-type(3) .eye-button', title: 'Lihat isian panelis', body: 'Tombol mata membuka isian panelis. Hanya bisa dilihat: PIC tidak dapat mengubah jawaban panelis.' },
        { before: () => clickFirst('.monitor-row:nth-of-type(3) .eye-button'), sel: '.drawer', title: 'Preview jawaban', body: 'Semua butir yang dialokasikan beserta jawaban tersimpan panelis. Butir yang belum diisi bertanda <b>Belum</b>, sehingga mudah melihat siapa yang perlu diingatkan.' },
        { before: () => clickFirst('[aria-label="Tutup preview"]'), sel: '.monitor-summary', title: 'Ringkasan penilaian', body: 'Statistik baru muncul setelah <b>semua panelis menyelesaikan semua butir</b>: cut-off tes dalam skor mentah dan persen, median, simpangan baku, dan rentang.' },
        { sel: '.section-head .button', title: 'Unduh laporan', body: 'Mengunduh progres semua panelis untuk putaran ini dalam bentuk CSV.' },
        { sel: '.sticky-actions', title: 'Finalisasi atau rollback', body: '<b>Finalisasi Putaran</b> aktif setelah semua respons lengkap, dengan konfirmasi dua tahap (mengetik frasa). Finalisasi mengunci putaran ini dan membuka putaran berikutnya, lengkap dengan riwayat jawaban. <b>Rollback</b> kembali ke putaran sebelumnya tanpa menghapus respons.' },
        { sel: '.card.data-table', title: 'Coba sendiri', body: 'Supaya tombol Finalisasi aktif, login sebagai <b>Sari</b> dan <b>Andi</b> lewat label Mode demo, lengkapi borang mereka, lalu kembali sebagai Rina.', next: 'panelis' }
      ]
    }
  };
  let tour = null;
  try { tour = JSON.parse(sessionStorage.getItem(TOUR_KEY) || 'null'); } catch { tour = null; }
  const tourRoot = document.createElement('div');
  const tourCss = `
  .ssd-spot{position:fixed;z-index:10000;border-radius:10px;box-shadow:0 0 0 9999px rgba(15,23,42,.55);outline:3px solid #f5b041;pointer-events:none;transition:all .25s ease}
  .ssd-card{position:fixed;z-index:10001;width:min(360px,calc(100vw - 24px));background:#fff;border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.3);padding:16px;display:grid;gap:10px;font:13.5px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;color:#13302d;transition:top .25s ease,left .25s ease}
  .ssd-card h4{margin:0;font-size:15px}
  .ssd-card p{margin:0;color:#334b47}
  .ssd-card .ssd-meta{display:flex;justify-content:space-between;align-items:center;color:#6b7c78;font-size:12px}
  .ssd-card .ssd-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
  .ssd-card button{all:unset;cursor:pointer;padding:7px 12px;border-radius:8px;font-weight:600;border:1px solid #cfdcd9}
  .ssd-card button.primary{background:#2f6f69;color:#fff;border-color:#2f6f69}
  .ssd-card button:focus-visible{outline:2px solid #f5b041;outline-offset:2px}
  .ssd-card .ssd-x{border:0;padding:2px 6px;color:#6b7c78}
  .ssd-dots{display:flex;gap:4px}.ssd-dots i{width:6px;height:6px;border-radius:50%;background:#cfdcd9}.ssd-dots i.on{background:#2f6f69}
  @media (max-width:640px){.ssd-card{left:12px!important;right:12px;bottom:12px;top:auto!important;width:auto}}
  @media (prefers-reduced-motion:reduce){.ssd-spot,.ssd-card{transition:none}}`;
  let tourTarget = null, tourTimer = null, tourToken = 0;

  function clickFirst(selector) { document.querySelector(selector)?.click(); }
  function saveTour() { try { tour ? sessionStorage.setItem(TOUR_KEY, JSON.stringify(tour)) : sessionStorage.removeItem(TOUR_KEY); } catch { /* ignore */ } }

  async function startTour(kind) {
    const def = TOURS[kind];
    tourError = '';
    try {
      await ready;
      const account = def.account();
      if (!account) throw new Error('Akun demo tidak ditemukan');
      const res = await globalThis.ssDemoFetch(`${location.origin}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: account.username, password: accounts.password }) });
      const json = await res.json();
      if (!res.ok || json.data?.user?.mustChangePassword) throw new Error(json.message || 'Password akun demo sudah diganti');
      const d = json.data;
      store.set(SESSION_KEY, JSON.stringify({ accessToken: d.accessToken, refreshToken: d.refreshToken, expiresAt: Date.now() + d.expiresIn * 1000, user: d.user }));
      tour = { kind, step: 0 }; saveTour();
      location.href = `${base}${def.path}`;
    } catch (error) {
      tourError = `${error.message}. Klik "Reset data demo" lalu coba lagi.`;
      open = true; render();
    }
  }

  function endTour() { tour = null; saveTour(); tourTarget = null; clearInterval(tourTimer); tourRoot.innerHTML = ''; }

  function waitFor(selector, timeout = 12000) {
    return new Promise((resolve) => {
      const started = Date.now();
      const tick = () => {
        const el = document.querySelector(selector);
        if (el && el.getClientRects().length) return resolve(el);
        if (Date.now() - started > timeout) return resolve(null);
        setTimeout(tick, 150);
      };
      tick();
    });
  }

  async function showStep() {
    if (!tour) return;
    const def = TOURS[tour.kind];
    if (!def || !location.pathname.endsWith(def.path)) return;
    const token = ++tourToken;
    const step = def.steps[tour.step];
    if (!step) return endTour();
    if (step.before) { step.before(); await new Promise((r) => setTimeout(r, 350)); }
    const el = await waitFor(step.sel);
    if (token !== tourToken || !tour) return;
    if (!el) { // element missing (data changed): skip forward
      if (tour.step < def.steps.length - 1) { tour.step += 1; saveTour(); return showStep(); }
      return endTour();
    }
    tourTarget = el;
    el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    const last = tour.step === def.steps.length - 1;
    const other = step.next ? TOURS[step.next] : null;
    tourRoot.innerHTML = `<style>${tourCss}</style><div class="ssd-spot"></div>
      <div class="ssd-card" role="dialog" aria-live="polite" aria-label="${def.title}">
        <div class="ssd-meta"><span>${def.title} · ${tour.step + 1}/${def.steps.length}</span><button class="ssd-x" data-t="close" aria-label="Tutup tur">✕</button></div>
        <h4>${step.title}</h4><p>${step.body}</p>
        <div class="ssd-meta"><span class="ssd-dots">${def.steps.map((_, i) => `<i class="${i === tour.step ? 'on' : ''}"></i>`).join('')}</span>
        <span class="ssd-actions">${tour.step > 0 ? '<button data-t="prev">Kembali</button>' : ''}${last
          ? `${other ? `<button data-t="other">${other.title}</button>` : ''}<button class="primary" data-t="close">Selesai</button>`
          : '<button class="primary" data-t="next">Lanjut</button>'}</span></div>
      </div>`;
    position();
    clearInterval(tourTimer);
    tourTimer = setInterval(position, 120);
    tourRoot.querySelector('[data-t="next"],[data-t="close"].primary')?.focus({ preventScroll: true });
  }

  function position() {
    const spot = tourRoot.querySelector('.ssd-spot'), card = tourRoot.querySelector('.ssd-card');
    if (!spot || !card || !tourTarget?.isConnected) return;
    const r = tourTarget.getBoundingClientRect(), pad = 6, vw = innerWidth, vh = innerHeight;
    Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const cw = card.offsetWidth, ch = card.offsetHeight, gap = 14;
    let top = r.bottom + gap;
    if (top + ch > vh - 12) top = r.top - ch - gap;            // above
    if (top < 12) top = Math.min(Math.max(12, r.top), vh - ch - 12); // beside, clamped
    let left = r.left + (r.width - cw) / 2;
    if (top >= r.top - ch - gap && top <= r.bottom && r.width > vw - cw - 40) left = vw - cw - 16;
    else if (top >= r.top - ch - gap && top <= r.bottom) left = r.right + gap + cw < vw ? r.right + gap : r.left - cw - gap;
    left = Math.min(Math.max(12, left), vw - cw - 12);
    Object.assign(card.style, { top: `${top}px`, left: `${left}px` });
  }

  tourRoot.addEventListener('click', (event) => {
    const t = event.target.closest('[data-t]');
    if (!t || !tour) return;
    const action = t.dataset.t;
    if (action === 'close') return endTour();
    if (action === 'other') { const next = TOURS[tour.kind].steps[tour.step].next; endTour(); return startTour(next); }
    tour.step += action === 'next' ? 1 : -1;
    // Steps that opened a drawer: going back past them closes it again.
    if (action === 'prev') clickFirst('[aria-label="Tutup preview"]');
    saveTour(); showStep();
  });
  document.addEventListener('keydown', (event) => {
    if (!tour || !tourRoot.contains(document.activeElement)) return;
    if (event.key === 'Escape') endTour();
    if (event.key === 'ArrowRight') tourRoot.querySelector('[data-t="next"]')?.click();
    if (event.key === 'ArrowLeft') tourRoot.querySelector('[data-t="prev"]')?.click();
  });

  function mount() {
    document.body.appendChild(tourRoot);
    if (tour) ready.then(() => showStep());
    document.body.appendChild(root);
    // Sit above pages that have a sticky action footer (Panelis form, PIC monitoring).
    setInterval(() => { const bar = document.querySelector('.sticky-actions'); root.style.bottom = bar ? `${bar.offsetHeight + 12}px` : ''; }, 500);
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
