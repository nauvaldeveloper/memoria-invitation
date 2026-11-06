// ==========================================
// HALAMAN TIKET: tampilkan QR, download PDF & PNG
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('t');
  const state = params.get('s');

  const show = (id) => {
    ['loadingState', 'errorState', 'ticketState'].forEach((name) => {
      document.getElementById(name).classList.toggle('hidden', name !== id);
    });
  };

  if (!token) {
    show('errorState');
    return;
  }

  let ticket;
  try {
    const response = await fetch(`${API_URL}?action=ticket&t=${encodeURIComponent(token)}`);
    const result = await response.json();
    if (result.status !== 'ok') {
      show('errorState');
      return;
    }
    ticket = result.ticket;
  } catch (err) {
    console.error('Gagal memuat tiket', err);
    document.getElementById('errorMsg').textContent = 'Gagal memuat tiket. Cek koneksi internetmu, lalu muat ulang halaman ini.';
    show('errorState');
    return;
  }

  document.getElementById('ticketName').textContent = ticket.nama;
  document.getElementById('ticketMeta').textContent = `NIM ${ticket.nim} · Angkatan ${ticket.angkatan}`;
  document.getElementById('checkedInLabel').classList.toggle('hidden', !ticket.checkedIn);

  const eventRows = getEventRows();
  const eventInfo = document.getElementById('eventInfo');
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
    eventInfo.appendChild(row);
  });

  const qrOptions = { text: token, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M };
  new QRCode(document.getElementById('qrcode'), { ...qrOptions, width: 440, height: 440 });
  new QRCode(document.getElementById('qrcodeHiRes'), { ...qrOptions, width: 720, height: 720 });

  const banner = document.getElementById('statusBanner');
  if (state === 'already') {
    banner.textContent = 'Kamu sudah terdaftar. Ini tiketmu.';
    banner.classList.remove('hidden');
  } else if (state === 'new') {
    banner.textContent = 'Pendaftaran berhasil! Simpan tiketmu ya.';
    banner.classList.remove('hidden');
  }

  show('ticketState');

  if (state === 'new' && typeof window.fireConfetti === 'function') {
    window.fireConfetti();
  }

  // Link tetap bisa dibuka ulang tanpa memunculkan banner dan confetti lagi.
  window.history.replaceState(null, '', `tiket.html?t=${encodeURIComponent(token)}`);

  const fileName = `tiket-memoria-${ticket.nim}`;
  const downloadError = document.getElementById('downloadError');

  document.getElementById('downloadPngBtn').addEventListener('click', async () => {
    downloadError.classList.add('hidden');
    try {
      const canvas = await renderTicketCanvas(ticket, eventRows);
      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Gagal membuat gambar', err);
      downloadError.classList.remove('hidden');
    }
  });

  document.getElementById('downloadPdfBtn').addEventListener('click', async () => {
    downloadError.classList.add('hidden');
    try {
      const canvas = await renderTicketCanvas(ticket, eventRows);
      const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a6' });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 105, 148, undefined, 'FAST');
      pdf.save(`${fileName}.pdf`);
    } catch (err) {
      console.error('Gagal membuat PDF', err);
      downloadError.classList.remove('hidden');
    }
  });
});

function getEventRows() {
  const rows = [];
  if (EVENT_INFO.tanggal) rows.push(['Tanggal', EVENT_INFO.tanggal]);
  if (EVENT_INFO.lokasi) rows.push(['Lokasi', EVENT_INFO.lokasi]);
  rows.push(['Open Gate', EVENT_INFO.openGate]);
  rows.push(['Dress Code', EVENT_INFO.dressCode]);
  return rows;
}

// Menggambar tiket ukuran A6 (300 dpi). Dipakai untuk PNG dan PDF.
async function renderTicketCanvas(ticket, eventRows) {
  await document.fonts.ready;

  const width = 1240;
  const height = 1748;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const gold = '#d4af37';
  const center = width / 2;

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

  const qrSource = document.querySelector('#qrcodeHiRes canvas');
  const qrSize = 720;
  const qrX = (width - qrSize) / 2;
  const qrY = 330;
  const padding = 40;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(qrX - padding, qrY - padding, qrSize + padding * 2, qrSize + padding * 2);
  ctx.drawImage(qrSource, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = '#f3e5ab';
  fitText(ctx, ticket.nama, center, 1190, width - 200, 64, 'Playfair Display, serif');

  ctx.fillStyle = '#d1d5db';
  ctx.font = '500 36px Inter, sans-serif';
  ctx.fillText(`NIM ${ticket.nim} · Angkatan ${ticket.angkatan}`, center, 1255);

  ctx.setLineDash([14, 12]);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(110, 1310);
  ctx.lineTo(width - 110, 1310);
  ctx.stroke();
  ctx.setLineDash([]);

  let y = 1380;
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
