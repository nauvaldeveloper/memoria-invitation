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
  manual: { button: document.getElementById('tabManualBtn'), view: document.getElementById('manualView') }
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
  document.getElementById('totalHadir').textContent = hadir;
  document.getElementById('totalTerdaftar').textContent = terdaftar;
  document.getElementById('progressBar').style.width = terdaftar ? `${Math.min(100, (hadir / terdaftar) * 100)}%` : '0';
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
      showOverlay('success', 'Berhasil!', result.nama);
      markCheckedIn(result.nim);
    } else if (result.status === 'already') {
      showOverlay('warning', 'Sudah Check-In', result.nama);
    } else if (result.status === 'not_attending') {
      showOverlay('warning', 'RSVP Tidak Hadir', `${result.nama}: daftarkan lewat menu Daftar Manual.`);
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

function markCheckedIn(nim) {
  const peserta = allData.find((d) => d.nim === nim);
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
        allData.push({ nama: result.nama, nim: result.nim, angkatan: payload.angkatan, jurusan: payload.jurusan.toUpperCase(), kehadiran: 'hadir', checkedIn: true });
        updateTotals();
      } else {
        markCheckedIn(result.nim);
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
  button.textContent = 'Daftarkan Manual';
  button.addEventListener('click', () => {
    if (/^\d+$/.test(keyword)) {
      manualNim.value = keyword;
      manualNama.value = '';
    } else {
      manualNim.value = '';
      manualNama.value = keyword;
    }
    switchTab('manual');
  });

  box.append(text, button);
  return box;
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

  const filtered = allData.filter((d) => d.nama.toLowerCase().includes(keyword) || d.nim.includes(keyword));
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
  nim.textContent = [`NIM ${peserta.nim}`, peserta.angkatan, peserta.jurusan].filter(Boolean).join(' · ');
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
    action.addEventListener('click', () => submitCheckIn({ nim: peserta.nim }));
  }

  card.append(info, action);
  return card;
}

searchInput.addEventListener('input', renderSearch);

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
