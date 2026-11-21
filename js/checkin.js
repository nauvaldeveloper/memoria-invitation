// ==========================================
// HALAMAN CHECK-IN PANITIA
// ==========================================

const PIN_KEY = 'memoriaPanitiaPin';
const REFRESH_MS = 30000;
const NIM_PATTERN = /^\d{5,20}$/;

let pin = '';
let html5QrCode = null;
let scannerRunning = false;
let allData = [];
let dataLoaded = false;
let isProcessing = false;
let refreshTimer = null;
let activeTab = 'scan';

const pinGate = document.getElementById('pinGate');
const pinForm = document.getElementById('pinForm');
const pinInput = document.getElementById('pinInput');
const pinError = document.getElementById('pinError');
const pinSubmit = document.getElementById('pinSubmit');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const syncStatus = document.getElementById('syncStatus');
const manualForm = document.getElementById('manualForm');
const manualNim = document.getElementById('manualNim');
const manualNama = document.getElementById('manualNama');
const manualAngkatan = document.getElementById('manualAngkatan');
const manualJurusan = document.getElementById('manualJurusan');
const manualError = document.getElementById('manualError');
const manualSubmit = document.getElementById('manualSubmit');

const TABS = {
  scan: { button: document.getElementById('tabScanBtn'), view: document.getElementById('scanView') },
  search: { button: document.getElementById('tabSearchBtn'), view: document.getElementById('searchView') },
  manual: { button: document.getElementById('tabManualBtn'), view: document.getElementById('manualView') },
  list: { button: document.getElementById('tabListBtn'), view: document.getElementById('listView') }
};

async function callApi(payload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ ...payload, pin })
  });
  return response.json();
}

function savePin(value) {
  try { sessionStorage.setItem(PIN_KEY, value); } catch (e) {}
}

function readPin() {
  try { return sessionStorage.getItem(PIN_KEY) || ''; } catch (e) { return ''; }
}

function clearPin() {
  pin = '';
  try { sessionStorage.removeItem(PIN_KEY); } catch (e) {}
}

// --- LOGIN ---
function showPinGate(message = '') {
  clearInterval(refreshTimer);
  stopScanner();
  allData = [];
  dataLoaded = false;
  updateTotals();
  pinError.textContent = message;
  pinGate.classList.remove('hidden');
  pinGate.classList.add('flex');
  pinInput.value = '';
  pinInput.focus();
}

function enterApp() {
  pinGate.classList.add('hidden');
  pinGate.classList.remove('flex');
  fetchData();
  clearInterval(refreshTimer);
  refreshTimer = setInterval(fetchData, REFRESH_MS);
  switchTab(activeTab);
}

async function login(value) {
  pin = value;
  const result = await callApi({ action: 'login' });
  if (result.status === 'ok') {
    savePin(value);
    enterApp();
    return;
  }
  clearPin();
  showPinGate(result.status === 'unauthorized' ? 'PIN salah.' : 'Gagal masuk, coba lagi.');
}

pinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const value = pinInput.value.trim();
  if (!value) return;
  pinSubmit.disabled = true;
  pinError.textContent = '';
  try {
    await login(value);
  } catch (err) {
    console.error('Gagal login', err);
    pinError.textContent = 'Koneksi gagal, coba lagi.';
  } finally {
    pinSubmit.disabled = false;
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  clearPin();
  showPinGate();
});

// --- DATA PESERTA ---
function updateTotals() {
  const hadir = allData.filter((d) => d.checkedIn).length;
  const terdaftar = allData.filter((d) => d.kehadiran === 'hadir' || d.checkedIn).length;
  const tamuHadir = allData.filter((d) => d.kategori === 'Tamu' && d.checkedIn).length;
  document.getElementById('tamuHadir').textContent = tamuHadir ? `· ${tamuHadir} tamu` : '';
  document.getElementById('totalHadir').textContent = hadir;
  document.getElementById('totalTerdaftar').textContent = terdaftar;
  document.getElementById('progressBar').style.width = terdaftar ? `${Math.min(100, (hadir / terdaftar) * 100)}%` : '0';
  if (activeTab === 'list') renderList();
}

function timeLabel() {
  return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

async function fetchData() {
  try {
    const result = await callApi({ action: 'list' });
    if (result.status === 'ok') {
      allData = result.data;
      dataLoaded = true;
      updateTotals();
      syncStatus.textContent = `Panitia Check-In · diperbarui ${timeLabel()}`;
      syncStatus.classList.remove('text-red-300');
      if (activeTab === 'search') renderSearch();
    } else if (result.status === 'unauthorized') {
      clearPin();
      showPinGate('PIN sudah tidak berlaku. Masuk lagi.');
    }
  } catch (err) {
    console.error('Gagal ambil data', err);
    syncStatus.textContent = 'Koneksi terputus, data mungkin belum terbaru';
    syncStatus.classList.add('text-red-300');
  }
}

// --- NAVIGASI ---
function switchTab(name) {
  activeTab = name;
  Object.entries(TABS).forEach(([key, tab]) => {
    const active = key === name;
    tab.view.classList.toggle('hidden', !active);
    tab.button.classList.toggle('text-memoria-gold', active);
    tab.button.classList.toggle('text-gray-400', !active);
    if (active) tab.button.setAttribute('aria-current', 'page');
    else tab.button.removeAttribute('aria-current');
  });

  if (name === 'scan') {
    startScanner();
  } else {
    stopScanner();
  }

  if (name === 'search') {
    renderSearch();
    searchInput.focus();
  } else if (name === 'manual') {
    manualNim.focus();
  } else if (name === 'list') {
    renderList();
  }
}

Object.entries(TABS).forEach(([key, tab]) => {
  tab.button.addEventListener('click', () => switchTab(key));
});

// --- KAMERA ---
function startScanner() {
  if (scannerRunning) return;

  const readerDiv = document.getElementById('reader');
  readerDiv.innerHTML = '';

  html5QrCode = new Html5Qrcode('reader', {
    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    verbose: false
  });

  scannerRunning = true;
  html5QrCode.start(
    { facingMode: 'environment' },
    { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
    (decodedText) => {
      if (isProcessing) return;
      playBeep();
      submitCheckIn({ token: decodedText.trim() });
    },
    () => {}
  ).catch((err) => {
    console.error('Kamera gagal:', err);
    scannerRunning = false;
    showCameraError(readerDiv);
  });
}

function stopScanner() {
  if (!html5QrCode || !scannerRunning) return;
  scannerRunning = false;
  html5QrCode.stop().then(() => {
    document.getElementById('reader').innerHTML = '';
  }).catch((e) => console.log(e));
}

function showCameraError(container) {
  container.innerHTML = `
    <div class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
      <p class="font-semibold text-lg text-red-400 mb-2">Kamera tidak bisa dibuka</p>
      <p class="text-sm text-gray-300 mb-4">Pastikan web dibuka lewat HTTPS dan izin kamera sudah diberikan.</p>
      <button id="retryCameraBtn" type="button" class="px-5 py-2.5 bg-memoria-gold text-black rounded-lg font-bold">Coba Lagi</button>
    </div>`;
  document.getElementById('retryCameraBtn').addEventListener('click', startScanner);
}

function playBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
    oscillator.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
  } catch (e) {}
}

// --- CHECK-IN ---
async function submitCheckIn(target) {
  isProcessing = true;
  showOverlay('loading', 'Memproses...', '');

  try {
    const result = await callApi({ action: 'checkin', ...target });

    if (result.status === 'ok') {
      showOverlay('success', 'Berhasil!', who(result));
      markCheckedIn(result.id);
    } else if (result.status === 'already') {
      showOverlay('warning', 'Sudah Check-In', who(result));
    } else if (result.status === 'not_attending') {
      showOverlay('warning', 'RSVP Tidak Hadir', result.kategori === 'Tamu'
        ? `${who(result)}. Pengundangnya membatalkan kehadiran, jadi tiket ini tidak berlaku.`
        : `${result.nama}: daftarkan lewat menu Daftar Manual.`);
    } else if (result.status === 'not_found') {
      showOverlay('error', 'Tidak Dikenal', 'QR tidak terdaftar. Coba cari nama peserta.');
    } else {
      handleOtherResult(result);
    }
  } catch (err) {
    console.error('Gagal check-in', err);
    showOverlay('error', 'Koneksi Gagal', 'Periksa internet, lalu coba lagi.');
  }
}

function handleOtherResult(result) {
  if (result.status === 'unauthorized') {
    isProcessing = false;
    hideOverlay();
    clearPin();
    showPinGate('PIN sudah tidak berlaku. Masuk lagi.');
  } else {
    showOverlay('error', 'Gagal', result.message || 'Coba lagi.');
  }
}

// Nama untuk layar hasil: tamu ditambah keterangan pengundangnya.
function who(result) {
  return result.kategori === 'Tamu' && result.pengundangNama ? `${result.nama} · Tamu dari ${result.pengundangNama}` : result.nama;
}

function markCheckedIn(id) {
  const peserta = allData.find((d) => d.id === id);
  if (peserta) {
    peserta.checkedIn = true;
    peserta.kehadiran = 'hadir';
  }
  updateTotals();
  if (activeTab === 'search') renderSearch();
}

// --- DAFTAR MANUAL ---
manualForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    action: 'walkin',
    nim: manualNim.value.trim(),
    nama: manualNama.value.replace(/\s+/g, ' ').trim(),
    angkatan: manualAngkatan.value.trim(),
    jurusan: manualJurusan.value.replace(/\s+/g, ' ').trim()
  };

  if (!NIM_PATTERN.test(payload.nim)) {
    manualError.textContent = 'NIM harus berupa 5–20 angka.';
    manualNim.focus();
    return;
  }
  if (!payload.nama) {
    manualError.textContent = 'Nama wajib diisi.';
    manualNama.focus();
    return;
  }
  if (!/^20\d{2}$/.test(payload.angkatan)) {
    manualError.textContent = 'Angkatan harus berupa tahun, misalnya 2024.';
    manualAngkatan.focus();
    return;
  }
  if (!payload.jurusan) {
    manualError.textContent = 'Jurusan wajib diisi.';
    manualJurusan.focus();
    return;
  }

  manualError.textContent = '';
  manualSubmit.disabled = true;
  isProcessing = true;
  showOverlay('loading', 'Memproses...', '');

  try {
    const result = await callApi(payload);

    if (result.status === 'ok') {
      showOverlay('success', 'Berhasil!', `${result.nama} tercatat hadir.`);
      if (result.result === 'new') {
        allData.push({ id: result.id, kategori: 'Mahasiswa', nama: result.nama, nim: result.nim, angkatan: payload.angkatan, jurusan: payload.jurusan.toUpperCase(), kehadiran: 'hadir', checkedIn: true });
        updateTotals();
      } else {
        markCheckedIn(result.id);
      }
      manualForm.reset();
    } else if (result.status === 'already') {
      showOverlay('warning', 'Sudah Check-In', result.nama);
      manualForm.reset();
    } else if (result.status === 'name_mismatch') {
      showOverlay('warning', 'NIM Sudah Terdaftar', `Terdaftar atas nama ${result.nama}. Cek KTM peserta terlebih dahulu.`);
    } else {
      handleOtherResult(result);
    }
  } catch (err) {
    console.error('Gagal daftar manual', err);
    showOverlay('error', 'Koneksi Gagal', 'Periksa internet, lalu coba lagi.');
  } finally {
    manualSubmit.disabled = false;
  }
});

// --- DAFTAR MANUAL: TAMU (TEMAN) ---
const guestForm = document.getElementById('guestForm');
const guestHost = document.getElementById('guestHost');
const guestHostInfo = document.getElementById('guestHostInfo');
const guestNama = document.getElementById('guestNama');
const guestError = document.getElementById('guestError');
const guestSubmit = document.getElementById('guestSubmit');
const modeButtons = document.querySelectorAll('#manualModes [data-mode]');
let manualMode = 'mahasiswa';

function setManualMode(mode) {
  manualMode = mode;
  manualForm.classList.toggle('hidden', mode !== 'mahasiswa');
  guestForm.classList.toggle('hidden', mode !== 'tamu');
  modeButtons.forEach((button) => {
    const active = button.dataset.mode === mode;
    button.className = `py-2 rounded-lg text-sm font-semibold transition-colors ${active ? 'bg-memoria-gold text-black' : 'text-gray-300 hover:text-white'}`;
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}
modeButtons.forEach((button) => button.addEventListener('click', () => {
  setManualMode(button.dataset.mode);
  (manualMode === 'tamu' ? guestHost : manualNim).focus();
}));
setManualMode('mahasiswa');

// Menampilkan nama pengundang begitu NIM-nya cocok dengan data peserta.
function updateGuestHostInfo() {
  const nim = guestHost.value.trim();
  if (!NIM_PATTERN.test(nim)) {
    guestHostInfo.textContent = '';
    return;
  }
  const host = allData.find((d) => d.kategori !== 'Tamu' && d.nim === nim);
  const guestCount = allData.filter((d) => d.kategori === 'Tamu' && d.pengundang === nim).length;
  if (!host) {
    guestHostInfo.className = 'text-xs text-yellow-300 mt-1.5 min-h-[1rem]';
    guestHostInfo.textContent = 'NIM ini belum terdaftar. Daftarkan pengundangnya dulu di tab Mahasiswa.';
  } else {
    guestHostInfo.className = 'text-xs text-gray-300 mt-1.5 min-h-[1rem]';
    guestHostInfo.textContent = guestCount ? `Pengundang: ${host.nama} · sudah mengajak ${guestCount} teman` : `Pengundang: ${host.nama}`;
  }
}

guestHost.addEventListener('input', updateGuestHostInfo);

guestForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    action: 'walkin_guest',
    pengundang: guestHost.value.trim(),
    nama: guestNama.value.replace(/\s+/g, ' ').trim()
  };

  if (!NIM_PATTERN.test(payload.pengundang)) {
    guestError.textContent = 'NIM pengundang harus berupa 5–20 angka.';
    guestHost.focus();
    return;
  }
  if (!payload.nama) {
    guestError.textContent = 'Nama tamu wajib diisi.';
    guestNama.focus();
    return;
  }

  guestError.textContent = '';
  guestSubmit.disabled = true;
  isProcessing = true;
  showOverlay('loading', 'Memproses...', '');

  try {
    const result = await callApi(payload);

    if (result.status === 'ok') {
      showOverlay('success', 'Berhasil!', `${result.nama} tercatat hadir · Tamu dari ${result.pengundangNama}`);
      if (result.result === 'new') {
        allData.push({ id: result.id, kategori: 'Tamu', nama: result.nama, nim: '', angkatan: '', jurusan: '', asal: result.asal, instansi: result.instansi, pengundang: result.pengundang, pengundangNama: result.pengundangNama, kehadiran: 'hadir', checkedIn: true });
        updateTotals();
      } else {
        markCheckedIn(result.id);
      }
      guestForm.reset();
      updateGuestHostInfo();
    } else if (result.status === 'already') {
      showOverlay('warning', 'Sudah Check-In', `${result.nama} · Tamu dari ${result.pengundangNama}`);
    } else if (result.status === 'host_not_found') {
      showOverlay('warning', 'Pengundang Belum Terdaftar', 'Daftarkan mahasiswa pengundangnya dulu di tab Mahasiswa.');
    } else if (result.status === 'host_not_attending') {
      showOverlay('warning', 'RSVP Pengundang Tidak Hadir', `${result.pengundangNama} tercatat tidak hadir. Daftarkan ulang pengundangnya di tab Mahasiswa terlebih dahulu.`);
    } else if (result.status === 'quota_full') {
      showOverlay('warning', 'Kuota Tamu Penuh', 'Tamu baru tidak bisa didaftarkan lagi.');
    } else {
      handleOtherResult(result);
    }
  } catch (err) {
    console.error('Gagal daftar tamu', err);
    showOverlay('error', 'Koneksi Gagal', 'Periksa internet, lalu coba lagi.');
  } finally {
    guestSubmit.disabled = false;
  }
});

// --- OVERLAY HASIL ---
const OVERLAY_STYLES = {
  loading: {
    border: 'border-memoria-gold',
    title: 'text-memoria-gold',
    icon: '<div class="animate-spin rounded-full h-14 w-14 border-4 border-memoria-gold/20 border-t-memoria-gold"></div>'
  },
  success: {
    border: 'border-green-500',
    title: 'text-green-400',
    icon: '<svg class="w-16 h-16 text-green-400" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.5l2 2 4-4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
  },
  warning: {
    border: 'border-yellow-500',
    title: 'text-yellow-400',
    icon: '<svg class="w-16 h-16 text-yellow-400" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 3.5h.01M10.3 4.2L2.8 17.2A2 2 0 004.5 20h15a2 2 0 001.7-2.8L13.7 4.2a2 2 0 00-3.4 0z"/></svg>'
  },
  error: {
    border: 'border-red-500',
    title: 'text-red-400',
    icon: '<svg class="w-16 h-16 text-red-400" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 9l-6 6m0-6l6 6m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
  }
};

function showOverlay(type, title, desc) {
  const overlay = document.getElementById('scanOverlay');
  const style = OVERLAY_STYLES[type];
  const closeBtn = document.getElementById('closeOverlayBtn');

  document.getElementById('overlayContent').className = `relative z-10 w-full max-w-sm p-8 text-center bg-neutral-900 border-2 rounded-2xl shadow-2xl ${style.border}`;
  document.getElementById('overlayIcon').innerHTML = style.icon;

  const titleEl = document.getElementById('overlayTitle');
  titleEl.className = `text-2xl font-bold ${style.title}`;
  titleEl.textContent = title;
  document.getElementById('overlayDesc').textContent = desc;

  closeBtn.textContent = activeTab === 'scan' ? 'Lanjut Scan' : 'Selesai';
  closeBtn.style.display = type === 'loading' ? 'none' : 'block';

  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
  setTimeout(() => overlay.classList.remove('opacity-0'), 10);
}

function hideOverlay() {
  const overlay = document.getElementById('scanOverlay');
  overlay.classList.add('opacity-0');
  setTimeout(() => {
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
  }, 300);
}

// Scanner aktif lagi setelah hasil ditutup, supaya QR yang sama tidak terbaca berulang.
document.getElementById('closeOverlayBtn').addEventListener('click', () => {
  hideOverlay();
  isProcessing = false;
});

// --- CARI NAMA ---
function setSearchMessage(message) {
  const p = document.createElement('p');
  p.className = 'text-center text-gray-500 text-sm py-10';
  p.textContent = message;
  searchResults.replaceChildren(p);
}

function createNotFound(keyword) {
  const box = document.createElement('div');
  box.className = 'text-center py-8';

  const text = document.createElement('p');
  text.className = 'text-gray-400 text-sm mb-4';
  text.textContent = 'Peserta tidak ditemukan.';

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'registerFromSearchBtn';
  button.className = 'px-5 py-2.5 border border-memoria-gold text-memoria-gold font-semibold rounded-lg hover:bg-memoria-gold hover:text-black transition-colors';
  button.textContent = 'Daftarkan Mahasiswa';
  button.addEventListener('click', () => {
    if (/^\d+$/.test(keyword)) {
      manualNim.value = keyword;
      manualNama.value = '';
    } else {
      manualNim.value = '';
      manualNama.value = keyword;
    }
    setManualMode('mahasiswa');
    switchTab('manual');
  });

  const actions = document.createElement('div');
  actions.className = 'flex flex-wrap justify-center gap-2';
  actions.append(button);

  // Nama yang tidak ditemukan bisa juga didaftarkan sebagai tamu.
  if (!/^\d+$/.test(keyword)) {
    const guestButton = document.createElement('button');
    guestButton.type = 'button';
    guestButton.id = 'registerGuestFromSearchBtn';
    guestButton.className = button.className;
    guestButton.textContent = 'Daftarkan sebagai Tamu';
    guestButton.addEventListener('click', () => {
      guestNama.value = keyword;
      setManualMode('tamu');
      switchTab('manual');
      guestHost.focus();
    });
    actions.append(guestButton);
  }

  box.append(text, actions);
  return box;
}

function participantMeta(peserta) {
  if (peserta.kategori === 'Tamu') {
    return [`Tamu dari ${peserta.pengundangNama || peserta.pengundang}`, peserta.asal, peserta.instansi].filter(Boolean).join(' · ');
  }
  return [`NIM ${peserta.nim}`, peserta.angkatan, peserta.jurusan].filter(Boolean).join(' · ');
}

function matchesKeyword(peserta, keyword) {
  return [peserta.nama, peserta.nim, peserta.jurusan, peserta.pengundangNama, peserta.instansi]
    .some((v) => String(v || '').toLowerCase().includes(keyword));
}

function renderSearch() {
  const raw = searchInput.value.replace(/\s+/g, ' ').trim();
  const keyword = raw.toLowerCase();

  if (keyword.length < 3) {
    setSearchMessage('Ketik minimal 3 huruf atau angka.');
    return;
  }
  if (!dataLoaded) {
    setSearchMessage('Memuat data peserta...');
    return;
  }

  const filtered = allData.filter((d) => matchesKeyword(d, keyword));
  if (filtered.length === 0) {
    searchResults.replaceChildren(createNotFound(raw));
    return;
  }

  searchResults.replaceChildren(...filtered.map(createResultCard));
}

function createResultCard(peserta) {
  const card = document.createElement('div');
  card.className = 'bg-neutral-900 border border-white/10 p-4 rounded-xl flex justify-between items-center gap-3';

  const info = document.createElement('div');
  info.className = 'flex-1 min-w-0';
  const name = document.createElement('p');
  name.className = 'font-semibold text-white truncate';
  name.textContent = peserta.nama;
  const nim = document.createElement('p');
  nim.className = 'text-xs text-gray-400 mt-0.5';
  nim.textContent = participantMeta(peserta);
  info.append(name, nim);

  let action;
  if (peserta.checkedIn) {
    action = document.createElement('span');
    action.className = 'text-green-400 text-xs font-semibold px-3 py-1.5 bg-green-500/10 rounded-lg border border-green-500/30 shrink-0';
    action.textContent = 'SUDAH HADIR';
  } else if (peserta.kehadiran !== 'hadir') {
    action = document.createElement('span');
    action.className = 'text-gray-400 text-xs font-semibold px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 shrink-0';
    action.textContent = 'RSVP TIDAK HADIR';
  } else {
    action = document.createElement('button');
    action.type = 'button';
    action.className = 'bg-memoria-gold text-black text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-yellow-500 transition-colors shrink-0';
    action.textContent = 'CHECK-IN';
    action.addEventListener('click', () => submitCheckIn(peserta.kategori === 'Tamu' ? { guestId: peserta.id } : { nim: peserta.nim }));
  }

  card.append(info, action);
  return card;
}

searchInput.addEventListener('input', renderSearch);

// --- DAFTAR PESERTA & EXPORT ---
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const listSearch = document.getElementById('listSearch');
const participantList = document.getElementById('participantList');
const listSummary = document.getElementById('listSummary');
const exportBtn = document.getElementById('exportBtn');
const exportError = document.getElementById('exportError');
const filterButtons = document.querySelectorAll('#listFilters [data-filter]');
const kategoriButtons = document.querySelectorAll('#kategoriFilters [data-kategori]');
let listFilter = 'semua';
let listKategori = 'semua';

const STATUS = {
  hadir: { label: 'Sudah hadir', badge: 'text-green-400 bg-green-500/10 border-green-500/30' },
  belum: { label: 'Belum hadir', badge: 'text-memoria-gold bg-memoria-gold/10 border-memoria-gold/30' },
  tidak: { label: 'RSVP tidak hadir', badge: 'text-gray-400 bg-white/5 border-white/10' }
};

function statusOf(peserta) {
  if (peserta.checkedIn) return 'hadir';
  return peserta.kehadiran === 'hadir' ? 'belum' : 'tidak';
}

function filteredParticipants() {
  const keyword = listSearch.value.replace(/\s+/g, ' ').trim().toLowerCase();
  return allData
    .filter((d) => listKategori === 'semua' || (d.kategori || 'Mahasiswa') === listKategori)
    .filter((d) => listFilter === 'semua' || statusOf(d) === listFilter)
    .filter((d) => !keyword || matchesKeyword(d, keyword))
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
}

function renderList() {
  // Jumlah per status mengikuti kategori yang dipilih.
  const inKategori = allData.filter((d) => listKategori === 'semua' || (d.kategori || 'Mahasiswa') === listKategori);
  const counts = { semua: inKategori.length, hadir: 0, belum: 0, tidak: 0 };
  inKategori.forEach((d) => { counts[statusOf(d)]++; });

  const kategoriCounts = { Mahasiswa: 0, Tamu: 0 };
  allData.forEach((d) => { kategoriCounts[d.kategori === 'Tamu' ? 'Tamu' : 'Mahasiswa']++; });
  kategoriButtons.forEach((button) => {
    const active = button.dataset.kategori === listKategori;
    const count = button.querySelector('[data-count]');
    if (count) count.textContent = `(${kategoriCounts[button.dataset.kategori]})`;
    button.className = `px-3 py-1 rounded-lg border text-xs font-semibold transition-colors ${active ? 'bg-white/10 text-white border-white/40' : 'text-gray-400 border-white/10 hover:border-white/30'}`;
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  filterButtons.forEach((button) => {
    const active = button.dataset.filter === listFilter;
    button.querySelector('[data-count]').textContent = `(${counts[button.dataset.filter]})`;
    button.className = `shrink-0 px-3.5 py-1.5 rounded-full border text-sm font-semibold transition-colors ${active ? 'bg-memoria-gold text-black border-memoria-gold' : 'text-gray-300 border-white/15 hover:border-memoria-gold/60'}`;
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  if (!dataLoaded) {
    listSummary.textContent = 'Memuat data...';
    participantList.replaceChildren();
    exportBtn.disabled = true;
    return;
  }

  const rows = filteredParticipants();
  listSummary.textContent = `Menampilkan ${rows.length} dari ${allData.length} peserta`;
  exportBtn.disabled = rows.length === 0;

  if (rows.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'text-center text-gray-500 text-sm py-10';
    empty.textContent = 'Tidak ada peserta yang cocok.';
    participantList.replaceChildren(empty);
    return;
  }

  participantList.replaceChildren(...rows.map((peserta) => {
    const row = document.createElement('div');
    row.className = 'bg-neutral-900 border border-white/10 px-4 py-3 rounded-xl flex items-center justify-between gap-3';

    const info = document.createElement('div');
    info.className = 'min-w-0';
    const name = document.createElement('p');
    name.className = 'font-semibold text-white truncate';
    name.textContent = peserta.nama;
    const meta = document.createElement('p');
    meta.className = 'text-xs text-gray-400 mt-0.5 truncate';
    meta.textContent = participantMeta(peserta);
    info.append(name, meta);

    const status = STATUS[statusOf(peserta)];
    const badge = document.createElement('span');
    badge.className = `shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${status.badge}`;
    badge.textContent = status.label;

    row.append(info, badge);
    return row;
  }));
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    listFilter = button.dataset.filter;
    renderList();
  });
});
kategoriButtons.forEach((button) => {
  button.addEventListener('click', () => {
    listKategori = button.dataset.kategori;
    renderList();
  });
});
listSearch.addEventListener('input', renderList);

function loadXlsx() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = XLSX_URL;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Library Excel gagal dimuat'));
    document.head.appendChild(script);
  });
}

function exportFileName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const filter = listFilter === 'semua' ? '' : `-${listFilter === 'hadir' ? 'sudah-hadir' : listFilter === 'belum' ? 'belum-hadir' : 'tidak-hadir'}`;
  const kategori = listKategori === 'semua' ? '' : `-${listKategori.toLowerCase()}`;
  return `memoria-peserta${kategori}${filter}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.xlsx`;
}

exportBtn.addEventListener('click', async () => {
  exportError.classList.add('hidden');
  exportBtn.disabled = true;
  const label = exportBtn.querySelector('span');
  label.textContent = 'Menyiapkan...';
  try {
    await fetchData();
    await loadXlsx();
    const rows = filteredParticipants().map((p, i) => ({
      No: i + 1,
      Kategori: p.kategori || 'Mahasiswa',
      NIM: p.nim || '',
      Nama: p.nama,
      Angkatan: p.angkatan || '',
      Jurusan: p.jurusan || '',
      Pengundang: p.kategori === 'Tamu' ? `${p.pengundangNama || ''} (${p.pengundang})` : '',
      RSVP: p.kehadiran === 'hadir' ? 'Hadir' : 'Tidak hadir',
      'Check-In': p.checkedIn ? 'Sudah' : 'Belum'
    }));
    // Semua sel ditulis sebagai teks, jadi isian seperti "=..." tidak dijalankan sebagai rumus.
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = [{ wch: 5 }, { wch: 11 }, { wch: 14 }, { wch: 30 }, { wch: 10 }, { wch: 32 }, { wch: 34 }, { wch: 12 }, { wch: 10 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Peserta');
    XLSX.writeFile(book, exportFileName());
  } catch (err) {
    console.error('Gagal export', err);
    exportError.classList.remove('hidden');
  } finally {
    label.textContent = 'Export';
    renderList();
  }
});

// --- MULAI ---
window.addEventListener('load', () => {
  const savedPin = readPin();
  if (savedPin) {
    login(savedPin).catch((err) => {
      console.error('Gagal login', err);
      showPinGate('Koneksi gagal, masukkan PIN lagi.');
    });
  } else {
    showPinGate();
  }
});
