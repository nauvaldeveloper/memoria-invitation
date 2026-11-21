// ==========================================
// HALAMAN TIKET
// - Tiket tamu: hanya tiket QR milik tamu itu.
// - Tiket pendaftar: tiket QR, daftar teman (kirim/hapus/tambah), dan ubah kehadiran.
//   Token di URL sekaligus menjadi kunci untuk mengelola semua itu.
// ==========================================

const params = new URLSearchParams(window.location.search);
const token = params.get('t');
const state = params.get('s');
const rejected = Number(params.get('r')) || 0;
const eventRows = getEventRows();
let firstRender = true;
let addGuestFields = null;

const show = (id) => {
  ['loadingState', 'errorState', 'ticketState'].forEach((name) => {
    document.getElementById(name).classList.toggle('hidden', name !== id);
  });
};

async function callApi(payload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ ...payload, token })
  });
  return response.json();
}

async function loadTicket() {
  const response = await fetch(`${API_URL}?action=ticket&t=${encodeURIComponent(token)}`);
  const result = await response.json();
  return result.status === 'ok' ? result.ticket : null;
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!token) {
    show('errorState');
    return;
  }
  setupManager();
  setupGuestModal();
  await refresh();
});

async function refresh() {
  let ticket;
  try {
    ticket = await loadTicket();
  } catch (err) {
    console.error('Gagal memuat tiket', err);
    document.getElementById('errorMsg').textContent = 'Gagal memuat tiket. Cek koneksi internetmu, lalu muat ulang halaman ini.';
    show('errorState');
    return;
  }
  if (!ticket) {
    show('errorState');
    return;
  }

  render(ticket);
  show('ticketState');

  if (firstRender) {
    firstRender = false;
    showBanners(ticket);
    if (state === 'new' && ticket.kehadiran === 'hadir' && typeof window.fireConfetti === 'function') window.fireConfetti();
    // Link tetap bisa dibuka ulang tanpa memunculkan banner dan confetti lagi.
    window.history.replaceState(null, '', `tiket.html?t=${encodeURIComponent(token)}`);
  }
}

function render(ticket) {
  const list = document.getElementById('ticketList');
  list.replaceChildren();
  const isGuestTicket = ticket.kategori === 'Tamu';
  const declined = !isGuestTicket && ticket.kehadiran === 'tidak';

  document.getElementById('declinedPanel').classList.toggle('hidden', !declined);
  document.getElementById('guestManager').classList.toggle('hidden', isGuestTicket || declined);
  document.getElementById('cancelPanel').classList.toggle('hidden', isGuestTicket || declined || ticket.checkedIn);

  if (isGuestTicket) {
    list.appendChild(createTicketCard({
      token,
      nama: ticket.nama,
      meta: guestMeta(ticket),
      guestOf: ticket.pengundang,
      checkedIn: ticket.checkedIn,
      fileName: `tiket-memoria-tamu-${slugify(ticket.nama)}`
    }));
    return;
  }

  if (declined) {
    document.getElementById('declinedName').textContent = `${ticket.nama} · NIM ${ticket.nim}`;
    return;
  }

  list.appendChild(createTicketCard({
    token,
    nama: ticket.nama,
    meta: `NIM ${ticket.nim} · Angkatan ${ticket.angkatan}`,
    checkedIn: ticket.checkedIn,
    fileName: `tiket-memoria-${ticket.nim}`
  }));
  renderGuests(ticket);
}

function showBanners(ticket) {
  const banner = document.getElementById('statusBanner');
  const guests = (ticket.guests || []).length;
  let text = '';
  if (state === 'exists') {
    text = 'Kamu sudah terdaftar. Di sini kamu bisa melihat tiket, mengajak teman, atau mengubah kehadiran.';
  } else if (state === 'new') {
    text = guests ? 'Pendaftaran berhasil! Simpan tiketmu, lalu kirim tiket ke tiap temanmu di bawah.' : 'Pendaftaran berhasil! Simpan tiketmu ya.';
  }
  if (text) {
    banner.textContent = text;
    banner.classList.remove('hidden');
  }
  if (rejected) {
    setGuestBanner('warn', `${rejected} teman belum bisa didaftarkan karena kuota tamu sudah penuh.`);
  }
}

function setGuestBanner(type, text) {
  const el = document.getElementById('guestBanner');
  el.textContent = text;
  el.className = type === 'ok'
    ? 'mb-4 px-4 py-3 rounded-xl border border-green-500/40 bg-green-500/10 text-center text-sm text-green-300'
    : 'mb-4 px-4 py-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 text-center text-sm text-yellow-200';
}

// ---------- DAFTAR TEMAN ----------

function renderGuests(ticket) {
  const guests = ticket.guests || [];
  const rows = document.getElementById('guestRows');
  document.getElementById('guestCount').textContent = guests.length ? `${guests.length} orang` : '';
  document.getElementById('guestEmpty').classList.toggle('hidden', guests.length > 0);

  rows.replaceChildren(...guests.map((guest) => {
    const row = document.createElement('div');
    row.className = 'rounded-xl border border-memoria-gold/20 bg-memoria-velvet/20 p-4';
    row.dataset.guestId = guest.id;

    const top = document.createElement('div');
    top.className = 'flex items-start justify-between gap-3';
    const info = document.createElement('div');
    info.className = 'min-w-0';
    const name = document.createElement('p');
    name.className = 'font-semibold text-memoria-gold-light break-words';
    name.textContent = guest.nama;
    const meta = document.createElement('p');
    meta.className = 'text-xs text-gray-400 mt-0.5';
    meta.textContent = guestMeta(guest);
    info.append(name, meta);
    top.appendChild(info);
    if (guest.checkedIn) {
      const badge = document.createElement('span');
      badge.className = 'shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg border text-green-400 bg-green-500/10 border-green-500/30';
      badge.textContent = 'Sudah check-in';
      top.appendChild(badge);
    }

    const actions = document.createElement('div');
    actions.className = 'grid grid-cols-3 gap-2 mt-3';
    const view = document.createElement('button');
    view.type = 'button';
    view.dataset.action = 'view';
    view.className = 'py-2 text-xs font-semibold rounded-lg border border-memoria-gold/50 text-memoria-gold hover:bg-memoria-gold hover:text-black transition-colors';
    view.textContent = 'Lihat tiket';
    view.addEventListener('click', () => openGuestModal(guest, ticket.nama, view));
    const send = document.createElement('button');
    send.type = 'button';
    send.dataset.action = 'send';
    send.className = 'py-2 text-xs font-bold rounded-lg bg-memoria-gold text-black hover:bg-yellow-500 transition-colors';
    send.textContent = 'Kirim';
    send.addEventListener('click', () => shareGuest(guest));
    actions.append(view, send);

    if (!guest.checkedIn) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.dataset.action = 'remove';
      remove.className = 'py-2 text-xs font-semibold rounded-lg border border-white/15 text-gray-300 hover:border-red-400 hover:text-red-300 transition-colors disabled:opacity-50';
      remove.textContent = 'Hapus';
      remove.addEventListener('click', () => removeGuest(guest, remove));
      actions.appendChild(remove);
    }

    row.append(top, actions);
    return row;
  }));
}

// ---------- POPUP TIKET TEMAN ----------

let modalGuest = null;
let modalTrigger = null;

function openGuestModal(guest, hostName, trigger) {
  modalGuest = guest;
  modalTrigger = trigger;
  const body = document.getElementById('guestModalBody');
  body.replaceChildren(createTicketCard({
    token: guest.token,
    nama: guest.nama,
    meta: guestMeta(guest),
    guestOf: hostName,
    checkedIn: guest.checkedIn,
    fileName: `tiket-memoria-tamu-${slugify(guest.nama)}`
  }, 'Modal'));
  document.getElementById('guestModalSendBtn').textContent = `Kirim tiket ke ${guest.nama}`;
  document.getElementById('guestModalFeedback').classList.add('hidden');

  const modal = document.getElementById('guestModal');
  modal.classList.remove('hidden');
  modal.scrollTop = 0;
  document.body.classList.add('overflow-hidden');
  document.getElementById('closeGuestModalBtn').focus();
}

function closeGuestModal() {
  const modal = document.getElementById('guestModal');
  if (modal.classList.contains('hidden')) return;
  modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  document.getElementById('guestModalBody').replaceChildren();
  modalGuest = null;
  if (modalTrigger && document.body.contains(modalTrigger)) modalTrigger.focus();
  modalTrigger = null;
}

function setupGuestModal() {
  document.getElementById('closeGuestModalBtn').addEventListener('click', closeGuestModal);
  document.getElementById('closeGuestModalBottomBtn').addEventListener('click', closeGuestModal);
  // Klik di area gelap di luar tiket juga menutup popup.
  document.getElementById('guestModalBackdrop').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeGuestModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeGuestModal();
  });
  document.getElementById('guestModalSendBtn').addEventListener('click', () => {
    if (modalGuest) shareGuest(modalGuest, document.getElementById('guestModalFeedback'));
  });
}

function guestFeedback(text, isError) {
  const el = document.getElementById('guestFeedback');
  el.textContent = text;
  el.className = `text-center text-sm mt-3 ${isError ? 'text-red-400' : 'text-green-400'}`;
}

// target: elemen pesan (opsional). Default: pesan di bawah daftar teman.
async function shareGuest(guest, target) {
  const url = `${window.location.origin}${window.location.pathname}?t=${encodeURIComponent(guest.token)}`;
  const text = `Hai ${guest.nama}, ini tiketmu untuk Memoria. Tunjukkan QR-nya ke panitia di pintu masuk ya!`;
  const say = (message) => {
    if (!target) return guestFeedback(message, false);
    target.textContent = message;
    target.className = 'text-center text-xs mt-3 text-green-400';
  };
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Tiket Memoria', text, url });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    say(`Link tiket ${guest.nama} sudah disalin. Tempel di chat untuk mengirimnya.`);
  } catch (err) {
    say(`Salin link ini untuk ${guest.nama}: ${url}`);
  }
}

async function removeGuest(guest, button) {
  if (!window.confirm(`Hapus ${guest.nama} dari daftar teman? Tiketnya tidak bisa dipakai lagi.`)) return;
  button.disabled = true;
  try {
    const result = await callApi({ action: 'guest_remove', guestId: guest.id });
    if (result.status === 'ok') {
      guestFeedback(`${guest.nama} sudah dihapus.`, false);
    } else if (result.status === 'locked') {
      guestFeedback(`${guest.nama} sudah check-in, jadi tidak bisa dihapus.`, true);
    } else {
      guestFeedback(result.message || 'Gagal menghapus, coba lagi.', true);
    }
  } catch (err) {
    console.error('Gagal menghapus teman', err);
    guestFeedback('Koneksi gagal, coba lagi.', true);
  }
  await refresh();
}

// ---------- TAMBAH TEMAN & KEHADIRAN ----------

function setupManager() {
  const form = document.getElementById('addGuestForm');
  const openBtn = document.getElementById('openAddGuestBtn');
  const error = document.getElementById('addGuestError');
  const save = document.getElementById('saveGuestBtn');
  addGuestFields = window.GuestFields(document.getElementById('addGuestList'), document.getElementById('addGuestMoreBtn'));

  const closeForm = () => {
    form.classList.add('hidden');
    openBtn.classList.remove('hidden');
    addGuestFields.reset();
    error.textContent = '';
  };

  openBtn.addEventListener('click', () => {
    form.classList.remove('hidden');
    openBtn.classList.add('hidden');
    form.querySelector('input').focus();
  });
  document.getElementById('cancelAddGuestBtn').addEventListener('click', closeForm);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = addGuestFields.validate();
    if (message) {
      error.textContent = message;
      return;
    }
    error.textContent = '';
    save.disabled = true;
    save.textContent = 'Menyimpan...';
    try {
      const result = await callApi({ action: 'guest_add', teman: addGuestFields.values() });
      if (result.status === 'ok') {
        closeForm();
        const parts = [];
        if (result.guestsAdded) parts.push(`${result.guestsAdded} teman berhasil ditambahkan.`);
        if (!result.guestsAdded && !result.guestsRejected) parts.push('Teman dengan nama itu sudah ada di daftar.');
        if (result.guestsRejected) parts.push(`${result.guestsRejected} teman belum bisa ditambahkan karena kuota tamu penuh.`);
        guestFeedback(parts.join(' '), !result.guestsAdded);
        await refresh();
      } else if (result.status === 'not_attending') {
        error.textContent = 'Kehadiranmu tercatat tidak hadir. Ubah kehadiran dulu.';
      } else {
        error.textContent = result.message || 'Gagal menyimpan, coba lagi.';
      }
    } catch (err) {
      console.error('Gagal menambah teman', err);
      error.textContent = 'Koneksi gagal, coba lagi.';
    }
    save.disabled = false;
    save.textContent = 'Simpan';
  });

  const setAttendance = async (kehadiran, button) => {
    button.disabled = true;
    try {
      const result = await callApi({ action: 'attendance', kehadiran });
      if (result.status === 'ok') {
        setGuestBanner('ok', kehadiran === 'hadir' ? 'Kehadiranmu sudah diubah menjadi hadir. Tiket QR-mu aktif lagi.' : 'Kehadiranmu sudah dibatalkan. Kamu bisa mengubahnya lagi kapan saja sebelum acara.');
      } else if (result.status === 'locked') {
        setGuestBanner('warn', 'Kamu sudah check-in, jadi kehadiran tidak bisa diubah.');
      } else {
        setGuestBanner('warn', result.message || 'Gagal mengubah kehadiran, coba lagi.');
      }
    } catch (err) {
      console.error('Gagal mengubah kehadiran', err);
      setGuestBanner('warn', 'Koneksi gagal, coba lagi.');
    }
    button.disabled = false;
    await refresh();
  };

  document.getElementById('attendBtn').addEventListener('click', (e) => setAttendance('hadir', e.currentTarget));
  document.getElementById('cancelAttendBtn').addEventListener('click', (e) => {
    if (!window.confirm('Batalkan kehadiranmu? Tiket teman yang belum check-in juga ikut tidak berlaku.')) return;
    setAttendance('tidak', e.currentTarget);
  });
}

// ---------- KARTU TIKET ----------

function guestMeta(guest) {
  return [guest.asal, guest.instansi].filter(Boolean).join(' · ') || 'Tamu';
}

function slugify(text) {
  return String(text).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'tamu';
}

// suffix membedakan id kartu di popup ("Modal") dari kartu utama di halaman.
function createTicketCard(data, suffix = '') {
  const card = document.getElementById('ticketTemplate').content.firstElementChild.cloneNode(true);
  const part = (role) => card.querySelector(`[data-role="${role}"]`);
  const ids = { qr: 'qrcode', qrHiRes: 'qrcodeHiRes', name: 'ticketName', meta: 'ticketMeta', checked: 'checkedInLabel', eventInfo: 'eventInfo', pdf: 'downloadPdfBtn', png: 'downloadPngBtn', feedback: 'downloadError' };
  Object.entries(ids).forEach(([role, id]) => { part(role).id = id + suffix; });

  part('name').textContent = data.nama;
  part('meta').textContent = data.meta;
  part('checked').classList.toggle('hidden', !data.checkedIn);
  if (data.guestOf) {
    part('guestOf').textContent = `Tamu dari ${data.guestOf}`;
    part('guestOf').classList.remove('hidden');
  }

  eventRows.forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'flex justify-between gap-4';
    const dt = document.createElement('dt');
    dt.className = 'text-gray-400';
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.className = 'text-gray-200 text-right';
    dd.textContent = value;
    row.append(dt, dd);
    part('eventInfo').appendChild(row);
  });

  const qrOptions = { text: data.token, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M };
  new QRCode(part('qr'), { ...qrOptions, width: 440, height: 440 });
  new QRCode(part('qrHiRes'), { ...qrOptions, width: 720, height: 720 });

  const feedback = part('feedback');
  const fail = (err) => {
    console.error('Gagal membuat file', err);
    feedback.textContent = 'Gagal membuat file. Coba lagi, atau screenshot tiket ini.';
    feedback.className = 'text-center text-xs mt-3 text-red-400';
  };
  const canvasData = { nama: data.nama, meta: data.meta, guestOf: data.guestOf };
  const qrCanvas = () => part('qrHiRes').querySelector('canvas');

  part('png').addEventListener('click', async () => {
    feedback.classList.add('hidden');
    try {
      const canvas = await renderTicketCanvas(canvasData, qrCanvas(), eventRows);
      const link = document.createElement('a');
      link.download = `${data.fileName}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      fail(err);
    }
  });

  part('pdf').addEventListener('click', async () => {
    feedback.classList.add('hidden');
    try {
      const canvas = await renderTicketCanvas(canvasData, qrCanvas(), eventRows);
      const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a6' });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 105, 148, undefined, 'FAST');
      pdf.save(`${data.fileName}.pdf`);
    } catch (err) {
      fail(err);
    }
  });

  return card;
}

function getEventRows() {
  const rows = [];
  if (EVENT_INFO.tanggal) rows.push(['Tanggal', EVENT_INFO.tanggal]);
  if (EVENT_INFO.lokasi) rows.push(['Lokasi', EVENT_INFO.lokasi]);
  rows.push(['Open Gate', EVENT_INFO.openGate]);
  rows.push(['Dress Code', EVENT_INFO.dressCode]);
  return rows;
}

// Menggambar tiket ukuran A6 (300 dpi). Dipakai untuk PNG dan PDF.
async function renderTicketCanvas(data, qrSource, eventRows) {
  await document.fonts.ready;

  const width = 1240;
  const height = 1748;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const gold = '#d4af37';
  const center = width / 2;
  // Tiket tamu punya satu baris tambahan "Tamu dari ...", jadi bagian bawah turun sedikit.
  const shift = data.guestOf ? 40 : 0;

  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, '#3a0505');
  background.addColorStop(0.6, '#0a0a0a');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = gold;
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, width - 80, height - 80);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = gold;
  ctx.font = '600 32px Inter, sans-serif';
  ctx.fillText('HIMA SIKC PRESENTS', center, 125);
  ctx.font = '700 104px Cinzel, serif';
  ctx.fillText('MEMORIA', center, 235);

  const qrSize = 720;
  const qrX = (width - qrSize) / 2;
  const qrY = 330;
  const padding = 40;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(qrX - padding, qrY - padding, qrSize + padding * 2, qrSize + padding * 2);
  ctx.drawImage(qrSource, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = '#f3e5ab';
  fitText(ctx, data.nama, center, 1190, width - 200, 64, 'Playfair Display, serif');

  ctx.fillStyle = '#d1d5db';
  fitText(ctx, data.meta, center, 1255, width - 200, 36, 'Inter, sans-serif', '500');

  if (data.guestOf) {
    ctx.fillStyle = gold;
    fitText(ctx, `TAMU DARI ${data.guestOf.toUpperCase()}`, center, 1305, width - 200, 30, 'Inter, sans-serif', '600');
  }

  ctx.setLineDash([14, 12]);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(110, 1310 + shift);
  ctx.lineTo(width - 110, 1310 + shift);
  ctx.stroke();
  ctx.setLineDash([]);

  let y = 1380 + shift;
  const maxValueWidth = width - 560;
  eventRows.forEach(([label, value]) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9ca3af';
    ctx.font = '400 34px Inter, sans-serif';
    ctx.fillText(label, 110, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f3f4f6';
    fitText(ctx, value, width - 110, y, maxValueWidth, 34, 'Inter, sans-serif', '500');
    y += 62;
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#9ca3af';
  ctx.font = '400 28px Inter, sans-serif';
  ctx.fillText('Tunjukkan QR ini ke panitia di pintu masuk.', center, height - 80);

  return canvas;
}

function fitText(ctx, text, x, y, maxWidth, startSize, family, weight = '400') {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && size > 20) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  ctx.fillText(text, x, y);
}
