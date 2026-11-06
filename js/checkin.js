// ==========================================
// HALAMAN CHECK-IN PANITIA
// ==========================================

const PIN_KEY = 'memoriaPanitiaPin';
const REFRESH_MS = 30000;

let pin = '';
let html5QrCode = null;
let scannerRunning = false;
let allData = [];
let isProcessing = false;
let refreshTimer = null;

const pinGate = document.getElementById('pinGate');
const pinForm = document.getElementById('pinForm');
const pinInput = document.getElementById('pinInput');
const pinError = document.getElementById('pinError');
const pinSubmit = document.getElementById('pinSubmit');
const tabScanBtn = document.getElementById('tabScanBtn');
const tabManualBtn = document.getElementById('tabManualBtn');
const scanContainer = document.getElementById('scanContainer');
const manualContainer = document.getElementById('manualContainer');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

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

// --- LOGIN PANITIA ---
function showPinGate(message = '') {
  clearInterval(refreshTimer);
  stopScanner();
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
  startScanner();
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

// --- DATA PESERTA ---
function updateTotal() {
  document.getElementById('totalHadir').textContent = allData.filter((d) => d.checkedIn).length;
}

async function fetchData() {
  try {
    const result = await callApi({ action: 'list' });
    if (result.status === 'ok') {
      allData = result.data;
      updateTotal();
      if (searchInput.value.trim().length >= 3) renderSearch();
    } else if (result.status === 'unauthorized') {
      clearPin();
      showPinGate('PIN sudah tidak berlaku. Masuk lagi.');
    }
  } catch (err) {
    console.error('Gagal ambil data', err);
  }
}

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
    <div class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-red-500 bg-black/80 z-50">
      <p class="font-bold text-lg mb-2">Kamera Gagal Nyala</p>
      <p class="text-xs text-gray-300 mb-4">Pastikan memakai HTTPS & izin kamera diberikan.</p>
      <button id="retryCameraBtn" type="button" class="px-4 py-2 bg-memoria-gold text-black rounded font-bold">Coba Lagi</button>
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
      showOverlay('warning', 'RSVP Tidak Hadir', `${result.nama}: minta peserta RSVP ulang sebagai Hadir.`);
    } else if (result.status === 'not_found') {
      showOverlay('error', 'Tidak Dikenal', 'QR tidak terdaftar. Coba cari nama di tab Cari Nama.');
    } else if (result.status === 'unauthorized') {
      isProcessing = false;
      hideOverlay();
      clearPin();
      showPinGate('PIN sudah tidak berlaku. Masuk lagi.');
    } else {
      showOverlay('error', 'Gagal', result.message || 'Coba lagi.');
    }
  } catch (err) {
    console.error('Gagal check-in', err);
    showOverlay('error', 'Koneksi Gagal', 'Periksa internet, lalu coba lagi.');
  }
}

function markCheckedIn(nim) {
  const peserta = allData.find((d) => d.nim === nim);
  if (peserta) peserta.checkedIn = true;
  updateTotal();
  if (searchInput.value.trim().length >= 3) renderSearch();
}

// --- OVERLAY HASIL ---
function showOverlay(type, title, desc) {
  const overlay = document.getElementById('scanOverlay');
  const content = document.getElementById('overlayContent');
  const icon = document.getElementById('overlayIcon');
  const titleEl = document.getElementById('overlayTitle');
  const descEl = document.getElementById('overlayDesc');
  const closeBtn = document.getElementById('closeOverlayBtn');

  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
  setTimeout(() => overlay.classList.remove('opacity-0'), 10);

  if (type === 'loading') {
    content.className = 'relative z-10 text-center p-8 bg-gray-900 border-2 border-yellow-500 rounded-2xl max-w-sm w-[90%] shadow-2xl';
    icon.innerHTML = '<div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-yellow-500 mx-auto"></div>';
    titleEl.className = 'text-2xl font-bold mb-2 text-yellow-500 mt-4';
    closeBtn.style.display = 'none';
  } else {
    closeBtn.style.display = 'block';
    descEl.className = 'text-gray-300 text-lg mt-2';
    if (type === 'success') {
      content.className = 'relative z-10 text-center p-8 bg-gray-900 border-2 border-green-500 rounded-2xl max-w-sm w-[90%] shadow-[0_0_50px_rgba(34,197,94,0.3)]';
      icon.textContent = '✅';
      titleEl.className = 'text-2xl font-bold mb-2 text-green-500';
    } else if (type === 'warning') {
      content.className = 'relative z-10 text-center p-8 bg-gray-900 border-2 border-yellow-500 rounded-2xl max-w-sm w-[90%] shadow-2xl';
      icon.textContent = '⚠️';
      titleEl.className = 'text-2xl font-bold mb-2 text-yellow-500';
    } else {
      content.className = 'relative z-10 text-center p-8 bg-gray-900 border-2 border-red-500 rounded-2xl max-w-sm w-[90%] shadow-2xl';
      icon.textContent = '❌';
      titleEl.className = 'text-2xl font-bold mb-2 text-red-500';
    }
  }
  titleEl.textContent = title;
  descEl.textContent = desc;
}

function hideOverlay() {
  const overlay = document.getElementById('scanOverlay');
  overlay.classList.add('opacity-0');
  setTimeout(() => {
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
    document.getElementById('overlayDesc').textContent = '';
  }, 300);
}

// Scanner baru aktif lagi setelah panitia menutup hasil, supaya QR yang sama tidak terbaca berulang.
document.getElementById('closeOverlayBtn').addEventListener('click', () => {
  hideOverlay();
  isProcessing = false;
});

// --- TAB ---
const TAB_ACTIVE = 'flex-1 py-2.5 bg-memoria-gold text-black font-bold rounded-lg transition-colors shadow-[0_0_15px_rgba(212,175,55,0.3)]';
const TAB_IDLE = 'flex-1 py-2.5 bg-gray-800 text-gray-300 font-bold rounded-lg transition-colors';

tabScanBtn.addEventListener('click', () => {
  scanContainer.classList.remove('hidden');
  manualContainer.classList.add('hidden');
  manualContainer.classList.remove('flex');
  tabScanBtn.className = TAB_ACTIVE;
  tabManualBtn.className = TAB_IDLE;
  startScanner();
});

tabManualBtn.addEventListener('click', () => {
  scanContainer.classList.add('hidden');
  manualContainer.classList.remove('hidden');
  manualContainer.classList.add('flex');
  tabManualBtn.className = TAB_ACTIVE;
  tabScanBtn.className = TAB_IDLE;
  stopScanner();
  searchInput.value = '';
  setSearchMessage('Ketik nama atau NIM untuk mencari.');
  searchInput.focus();
});

// --- CARI MANUAL ---
function setSearchMessage(message) {
  const p = document.createElement('p');
  p.className = 'text-center text-gray-500 text-sm mt-10';
  p.textContent = message;
  searchResults.replaceChildren(p);
}

function renderSearch() {
  const keyword = searchInput.value.trim().toLowerCase();

  if (keyword.length < 3) {
    setSearchMessage('Ketik minimal 3 huruf...');
    return;
  }

  const filtered = allData.filter((d) => d.nama.toLowerCase().includes(keyword) || d.nim.includes(keyword));
  if (filtered.length === 0) {
    setSearchMessage('Tidak ditemukan.');
    return;
  }

  searchResults.replaceChildren(...filtered.map(createResultCard));
}

function createResultCard(peserta) {
  const card = document.createElement('div');
  card.className = 'bg-gray-900 border border-gray-800 p-4 rounded-xl flex justify-between items-center gap-3';

  const info = document.createElement('div');
  info.className = 'flex-1 min-w-0';
  const name = document.createElement('p');
  name.className = 'font-bold text-white text-sm line-clamp-1';
  name.textContent = peserta.nama;
  const nim = document.createElement('p');
  nim.className = 'text-xs text-gray-400';
  nim.textContent = `NIM: ${peserta.nim}`;
  info.append(name, nim);

  let action;
  if (peserta.checkedIn) {
    action = document.createElement('span');
    action.className = 'text-green-500 text-xs font-bold px-3 py-1.5 bg-green-500/20 rounded border border-green-500/30 shrink-0';
    action.textContent = 'SUDAH HADIR';
  } else if (peserta.kehadiran !== 'hadir') {
    action = document.createElement('span');
    action.className = 'text-gray-400 text-xs font-bold px-3 py-1.5 bg-gray-800 rounded border border-gray-700 shrink-0';
    action.textContent = 'RSVP TIDAK HADIR';
  } else {
    action = document.createElement('button');
    action.type = 'button';
    action.className = 'bg-memoria-gold text-black text-xs font-bold px-4 py-2 rounded hover:bg-yellow-500 transition-colors shrink-0';
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
