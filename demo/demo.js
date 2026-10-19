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

  // Panelist screens remember welcome / round start / practice timer per browser; a fresh demo must forget them.
  function clearPanelistFlags() {
    try { for (const key of Object.keys(localStorage)) if (/^ss-(sambutan|putaran|simulasi)-/.test(key)) localStorage.removeItem(key); } catch { /* ignore */ }
  }
  const fingerprint = (text) => { let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0; return `${text.length}:${h}`; };
  const SEED_KEY = 'ss-demo-seed';
  const MODE_KEY = 'ss-demo-mode'; // 'empty': only the Admin Super account, no projects or items
  let seedText = '';
  async function loadSeed() {
    const res = await fetch(`${base}/demo/seed.json`, { cache: 'no-cache' });
    const text = await res.text();
    // GitHub Pages answers a missing file with its HTML 404 page: say which file is missing instead of a parser error.
    if (!res.ok || !text.trimStart().startsWith('{')) throw new Error(`File demo/seed.json tidak ditemukan (HTTP ${res.status}). Pastikan folder demo di repo lengkap dan GitHub Pages selesai diperbarui, lalu muat ulang.`);
    seedText = text; return seedText;
  }
  // Start the demo again from the seed data (used by Reset and by the panelist tour).
  function resetDemo() {
    clearPanelistFlags(); store.remove(SESSION_KEY);
    const error = globalThis.ssImport(seedText);
    if (error) throw new Error(`Data demo gagal dimuat: ${error}`);
    store.set(STATE_KEY, seedText); store.set(SEED_KEY, fingerprint(seedText)); store.remove(MODE_KEY);
  }
  // Empty system: only the master Admin Super account (password demo123). Projects, items and all other accounts are gone,
  // so the admin can try the real start: import items from Excel, create a project, import names, generate accounts.
  function emptyDemo() {
    const seed = JSON.parse(seedText);
    const empty = { version: seed.version, users: seed.users.filter((u) => u.role === 'admin_super'), projects: [], items: [], rounds: [], submissions: [], panelistRounds: [], sessions: {} };
    const text = JSON.stringify(empty);
    clearPanelistFlags(); store.remove(SESSION_KEY);
    const error = globalThis.ssImport(text);
    if (error) throw new Error(`Data demo gagal dikosongkan: ${error}`);
    store.set(STATE_KEY, text); store.set(SEED_KEY, fingerprint(seedText)); store.set(MODE_KEY, 'empty');
  }

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
    await loadSeed();
    // A newly published demo (different seed) starts fresh instead of reusing old browser data.
    const saved = store.get(STATE_KEY);
    if (!saved || store.get(SEED_KEY) !== fingerprint(seedText) || globalThis.ssImport(saved) !== '') resetDemo();
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
  /* Demo tab sits on the right edge (vertical), so it never covers the header, footers or bottom buttons. */
  .ssd{position:fixed;top:38%;right:0;z-index:9999;font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#13302d}
  .ssd *{box-sizing:border-box}
  .ssd-pill{display:flex;align-items:center;gap:7px;writing-mode:vertical-rl;transform:rotate(180deg);background:#fff7e6;border:1px solid #f0c27a;border-left:0;border-radius:0 10px 10px 0;padding:12px 5px;box-shadow:-2px 0 10px rgba(0,0,0,.10);cursor:pointer;font-size:12.5px;white-space:nowrap}
  .ssd-pill:hover{background:#ffefcf}.ssd-pill:focus-visible{outline:2px solid #2f6f69;outline-offset:2px}
  .ssd-caret{display:none}
  .ssd-pill b{color:#8a4b00}
  .ssd-dot{width:8px;height:8px;border-radius:50%;background:#c58a2a}
  .ssd-dot.ready{background:#2e8b57}.ssd-dot.error{background:#c0392b}
  .ssd-panel{position:fixed;right:36px;top:76px;width:min(380px,calc(100vw - 24px));max-height:calc(100vh - 100px);max-height:calc(100dvh - 100px);background:#fff;border:1px solid #d6e2df;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.18);display:flex;flex-direction:column;overflow:hidden}
  @media (max-width:899px){
    .ssd-pill .ssd-more{display:none}
    .ssd-panel{right:8px;left:8px;width:auto;top:72px;max-height:calc(100dvh - 150px)}
  }
  .ssd-head{padding:12px 14px 8px;border-bottom:1px solid #e3ecea}
  .ssd-body{padding:10px 14px;display:grid;gap:9px;overflow-y:auto;overscroll-behavior:contain;min-height:0}
  .ssd-foot{padding:8px 14px;border-top:1px solid #e3ecea;background:#fafcfb}
  .ssd-panel h4{margin:0;font-size:14px}
  .ssd-panel p{margin:0;color:#4b5f5b}
  .ssd-acc{display:grid;gap:5px}
  .ssd-empty{margin:0;padding:8px 10px;border-radius:8px;background:#fff7e6;border:1px solid #f5d79e;color:#6b4300;font-size:12.5px}
  .ssd-empty-btn{color:#5b6b70!important}
  .ssd-group{margin:8px 0 0;font-size:12px;font-weight:800;color:#1f5f5b}.ssd-group span{font-weight:500;color:#5b6b70}
  .ssd-acc button{all:unset;cursor:pointer;display:grid;grid-template-columns:auto 1fr;column-gap:8px;align-items:center;padding:6px 9px;border:1px solid #d6e2df;border-radius:8px}
  .ssd-acc button>small{grid-column:2}
  .ssd-role{grid-row:span 2;align-self:center;min-width:52px;text-align:center;padding:2px 6px;border-radius:6px;background:#eef6f4;color:#235752;font-size:11px;font-weight:700}
  .ssd-acc span.ssd-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ssd-acc button:hover,.ssd-acc button:focus-visible{border-color:#2f6f69;background:#eef6f4}
  .ssd-acc small{color:#5b6b68}.ssd-acc small.ssd-note{color:#2f4f4b;font-size:11.5px;line-height:1.35;white-space:normal}
  .ssd-filter{width:100%;padding:7px 10px;border:1px solid #cfdcd9;border-radius:8px;font:inherit}
  .ssd-filter:focus{outline:2px solid #2f6f69;outline-offset:0;border-color:#2f6f69}.ssd-acc code{font:12px ui-monospace,Menlo,monospace}
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
  let open = false, status = 'loading', statusText = '', tourError = '', filter = '';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function shownAccounts() {
    const q = filter.trim().toLowerCase();
    return accounts.accounts.filter((a) => (store.get(MODE_KEY) !== 'empty' || a.role === 'Admin Super')
      && (!q || [a.name, a.username, a.role, a.group, a.note].join(' ').toLowerCase().includes(q)));
  }
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
        <div class="ssd-head ssd-row"><h4>Mode demo Standard Setting</h4><button class="ssd-close" data-close aria-label="Tutup">✕</button></div>
        <div class="ssd-body">
        <p>Data contoh fiktif; perubahan hanya tersimpan di browser ini.</p>
        ${status === 'error' ? `<p style="color:#b03a2e">${statusText}</p>` : ''}
        <div class="ssd-tours"><b>Tur terpandu</b><div><button data-tour="panelis">▶ Tur Panelis</button><button data-tour="pic">▶ Tur PIC Mapel</button></div><small>Tur Panelis memulai ulang data demo, jadi Citra mulai dari sambutan.</small></div>
        ${tourError ? `<p style="color:#b03a2e">${tourError}</p>` : ''}
        ${store.get(MODE_KEY) === 'empty' ? `<p class="ssd-empty"><b>Mode kosong.</b> Hanya akun Admin Super; belum ada proyek, butir, maupun akun lain. Unggah butir di menu ID Butir, buat proyek di wizard, unggah nama PIC/panelis di tahap 3, lalu buat akun di tahap 4 (username dan password awal tampil di sana dan di menu Akun). Klik <b>Reset data demo</b> untuk kembali ke data contoh.</p>` : ''}
        <p>Klik akun untuk mengisi form login · password <code>${accounts.password}</code></p>
        <input class="ssd-filter" type="search" data-filter placeholder="Cari nama, mapel, atau kasus (mis. kuesioner)" value="${esc(filter)}" aria-label="Cari akun demo"/>
        <div class="ssd-acc">${shownAccounts().map((a, i, all) => `${a.group && a.group !== all[i - 1]?.group ? `<p class="ssd-group">${esc(a.group)}${accounts.groups?.[a.group] ? ` <span>· ${esc(accounts.groups[a.group])}</span>` : ''}</p>` : ''}<button data-user="${esc(a.username)}" title="${esc(a.role)} · ${esc(a.name)}"><span class="ssd-role">${a.role === 'Admin Super' ? 'Admin' : a.role === 'PIC Mapel' ? 'PIC' : 'Panelis'}</span><span class="ssd-name">${esc(a.name)}</span>${a.note ? `<small class="ssd-note">${esc(a.note)}</small>` : ''}<small><code>${esc(a.username)}</code></small></button>`).join('') || '<p class="ssd-empty">Tidak ada akun yang cocok.</p>'}</div>
        </div>
        <div class="ssd-foot ssd-row"><button class="ssd-reset ssd-empty-btn" data-empty title="Hapus semua proyek, butir, dan akun kecuali Admin Super">Kosongkan data</button><button class="ssd-reset" data-reset>Reset data demo</button></div>
      </div>` : ''}
      <div class="ssd-pill" role="button" tabindex="0" aria-expanded="${open}" data-toggle><span class="ssd-dot ${status}"></span><b>${label}</b><span class="ssd-more">· tur, akun & reset</span><span class="ssd-caret" aria-hidden="true">▼</span></div>`;
    root.classList.toggle('open', open);
  }
  root.addEventListener('click', (event) => {
    const t = event.target.closest('[data-toggle],[data-close],[data-user],[data-reset],[data-empty],[data-tour]');
    if (!t) return;
    if (t.dataset.tour) return startTour(t.dataset.tour);
    if (t.dataset.user) return fillLogin(t.dataset.user);
    if ('empty' in t.dataset) {
      if (!confirm('Kosongkan data demo? Semua proyek, butir, dan akun dihapus; hanya Admin Super (master.bp3 / demo123) yang tersisa. Data contoh bisa dikembalikan dengan Reset data demo.')) return;
      ready.then(() => { emptyDemo(); location.href = `${base}/login`; }).catch((error) => { tourError = error.message; render(); });
      return;
    }
    if ('reset' in t.dataset) { store.remove(MODE_KEY); store.remove(STATE_KEY); store.remove(SESSION_KEY); clearPanelistFlags(); location.href = `${base}/login`; return; }
    open = 'toggle' in t.dataset ? !open : false;
    render();
  });
  root.addEventListener('input', (event) => {
    if (!event.target.matches('[data-filter]')) return;
    filter = event.target.value;
    const pos = event.target.selectionStart;
    render();
    const el = root.querySelector('[data-filter]'); if (el) { el.focus(); el.setSelectionRange(pos, pos); }
  });
  root.addEventListener('keydown', (event) => { if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-toggle]')) { event.preventDefault(); open = !open; render(); } });
  // Close the panel with Esc or a click elsewhere.
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && open) { open = false; render(); } });
  document.addEventListener('click', (event) => { if (open && !event.composedPath().includes(root)) { open = false; render(); } });


  // ---- Guided tours (Panelis / PIC Mapel) ---------------------------------
  const TOUR_KEY = 'ssd-tour';
  const TOURS = {
    panelis: {
      // The panelist page has its own welcome screen and in-app tour; the demo only opens it fresh for Citra (simulation project).
      title: 'Tur Panelis', path: '/panelis', fresh: true, account: () => accounts.accounts.find((a) => a.role === 'Panelis' && /^004\./.test(a.username)) || accounts.accounts.find((a) => a.role === 'Panelis'),
      steps: [
        { sel: '.welcome-card', title: 'Halaman pertama panelis', body: 'Anda masuk sebagai <b>Citra</b>, panelis IPA. Setelah login, panelis disambut dan melihat urutan kegiatannya: <b>latihan (simulasi) → penilaian → selesai</b>. Tutup kartu ini, lalu klik <b>Lihat tur singkat</b> untuk tur di dalam aplikasi, kemudian kerjakan 3 butir latihan.' },
        { sel: '.welcome-card .stage-actions', title: 'Setelah latihan', body: 'Simulasi berlangsung 10 menit. Setelah menekan <b>Saya selesai simulasi</b> (atau waktunya habis), panelis melihat layar <b>Menunggu PIC Mapel</b>. Begitu PIC IPA (<b>Bambang</b>) menekan <b>Akhiri Simulasi &amp; Mulai Putaran 1</b>, layar panelis berganti sendiri ke tombol <b>Mulai Putaran 1</b>. Coba lewat label Mode demo: login sebagai Bambang.', next: 'pic' }
      ]
    },
    pic: {
      title: 'Tur PIC Mapel', path: '/pic', account: () => accounts.accounts.find((a) => a.role === 'PIC Mapel'),
      steps: [
        { sel: '.timeline', title: 'Putaran penilaian', body: 'Anda masuk sebagai <b>Rina Wulandari</b>, PIC Matematika. Putaran 1 sudah dikunci, Putaran 2 sedang berlangsung. Klik <b>Putaran 1</b> untuk melihat hasilnya (hanya baca).' },
        { sel: '.jqc-editor', title: 'Definisi JQC', body: 'Definisi <b>peserta minimal kompeten</b> yang Anda tulis tampil di borang semua panelis sebagai pegangan bersama. Klik judulnya untuk membuka dan mengubah.' },
        { sel: '.monitor-queue', title: 'Antrean panelis', body: 'Progres tiap panelis dan kapan terakhir aktif, diperbarui tiap 10 detik. Status: <b>Selesai</b> (sudah klik Saya selesai), <b>Lengkap, belum klik Selesai</b> (tinggal diingatkan), <b>Sedang mengisi</b>, dan <b>Belum mulai</b>. Panelis yang lama tidak menyimpan diberi penanda <b>tidak aktif sejak …</b>.' },
        { sel: '.queue-row:nth-of-type(2) .eye-button', title: 'Lihat isian panelis', body: 'Tombol mata membuka isian panelis. Hanya bisa dilihat: PIC tidak dapat mengubah jawaban panelis.' },
        { before: () => clickFirst('.queue-row:nth-of-type(2) .eye-button'), sel: '.drawer', title: 'Preview jawaban', body: 'Semua butir yang dialokasikan beserta jawaban tersimpan panelis. Butir yang belum diisi bertanda <b>Belum</b>, sehingga mudah melihat siapa yang perlu diingatkan.' },
        { before: () => clickFirst('[aria-label="Tutup preview"]'), sel: '.monitor-stats', title: 'Statistik putaran', body: 'Statistik baru muncul setelah <b>semua panelis menyelesaikan semua butir</b>: cut-off tes dalam skor mentah dan persen, median, simpangan baku, dan rentang.' },
        { sel: '.compare-table', title: 'Hasil per butir antarputaran', body: 'Cut-off dan simpangan baku setiap butir di <b>Putaran 1, 2, …</b> berdampingan, beserta perubahannya. SD yang turun berarti panel makin sepakat; centang <b>Hanya yang kurang sepakat</b> untuk fokus diskusi.' },
        { sel: '.head-actions', title: 'Laporan', body: '<b>Cetak Laporan (PDF)</b> untuk pemangku kepentingan dan <b>Unduh Excel</b> (atau CSV) progres panelis.' },
        { sel: '.sticky-actions', title: 'Finalisasi atau batalkan putaran', body: '<b>Finalisasi Putaran</b> aktif setelah semua panelis menekan <b>Saya selesai Putaran N</b>, dengan konfirmasi dua tahap (mengetik frasa). Finalisasi mengunci putaran, membagikan hasilnya (tanpa nama) ke semua panelis beserta sorotan butir yang kurang sepakat, lalu membuka putaran berikutnya. Mengunci putaran terakhir (default Putaran 3) menjadikannya hasil akhir; bila perlu, <b>Tambah Putaran</b> menambah satu putaran lagi. <b>Batalkan Putaran Ini</b> mundur ke putaran sebelumnya; status Saya selesai panelis tetap sehingga putaran itu bisa langsung dikunci lagi, dan jawaban tidak dihapus.' },
        { sel: '.monitor-queue', title: 'Coba sendiri', body: 'Budi sudah mengirim Putaran 2. Supaya tombol Finalisasi aktif, login sebagai <b>Sari</b> dan <b>Andi</b> lewat label Mode demo, lengkapi borang lalu tekan <b>Saya selesai Putaran 2</b>, kemudian kembali sebagai Rina.', next: 'panelis' }
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
      // The panelist tour always starts from a fresh demo so Citra sees the welcome and the practice again.
      if (def.fresh) resetDemo();
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
