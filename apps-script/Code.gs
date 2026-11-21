/**
 * ============================================
 *  BACKEND MEMORIA - Google Apps Script
 *  Perayaan Perjalanan Hima SIKC
 * ============================================
 *
 * Kolom sheet:
 * A Timestamp | B NIM | C Nama | D Angkatan | E Kehadiran | F Pesan | G Status Check-In | H Token
 * I Sumber | J Jurusan | K Kategori | L Pengundang (NIM) | M Asal | N Instansi | O ID Tamu
 *
 * Kategori "Mahasiswa" = pendaftar ber-NIM. Kategori "Tamu" = teman yang diajak (tanpa batas per NIM),
 * kolom NIM-nya kosong, NIM pengundangnya di kolom L, dan tiap tamu punya ID sendiri di kolom O.
 *
 * Token tiket pendaftar sekaligus menjadi kunci untuk mengelola teman dan kehadirannya.
 *
 * Script Properties:
 * - PANITIA_PIN (wajib): PIN halaman check-in.
 * - KUOTA_TAMU (opsional): batas total tamu. Kosong = tanpa batas, 0 = tamu ditutup.
 */

const SHEET_NAME = 'Sheet1';
const COL = {
  NIM: 1, NAMA: 2, ANGKATAN: 3, KEHADIRAN: 4, CHECKIN: 6, TOKEN: 7,
  SUMBER: 8, JURUSAN: 9, KATEGORI: 10, PENGUNDANG: 11, ASAL: 12, INSTANSI: 13, GUEST_ID: 14
};
const HEADERS = { 8: 'Sumber', 9: 'Jurusan', 10: 'Kategori', 11: 'Pengundang (NIM)', 12: 'Asal', 13: 'Instansi', 14: 'ID Tamu' };
const ASAL_TAMU = { telkom: 'Mahasiswa Telkom', kampus_lain: 'Mahasiswa kampus lain', umum: 'Umum' };
const MAX_GUESTS_PER_REQUEST = 20;

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'rsvp';

    // Aksi publik: pendaftaran, cek tiket, dan pengelolaan oleh pemilik token.
    if (action === 'rsvp') return jsonResponse(handleRsvp_(data));
    if (action === 'lookup') return jsonResponse(handleLookup_(data));
    if (action === 'guest_add') return jsonResponse(handleGuestAdd_(data));
    if (action === 'guest_remove') return jsonResponse(handleGuestRemove_(data));
    if (action === 'attendance') return jsonResponse(handleAttendance_(data));

    // Semua aksi di bawah ini khusus panitia.
    if (!isPinValid_(data.pin)) {
      Utilities.sleep(1000); // memperlambat percobaan menebak PIN
      return jsonResponse({ status: 'unauthorized', message: 'PIN salah' });
    }
    if (action === 'login') return jsonResponse({ status: 'ok' });
    if (action === 'list') return jsonResponse(handleList_());
    if (action === 'checkin') return jsonResponse(handleCheckIn_(data));
    if (action === 'walkin') return jsonResponse(handleWalkIn_(data));
    if (action === 'walkin_guest') return jsonResponse(handleWalkInGuest_(data));

    return jsonResponse({ status: 'error', message: 'Aksi tidak dikenal' });
  } catch (err) {
    console.error(err);
    return jsonResponse({ status: 'error', message: 'Terjadi kesalahan di server' });
  }
}

/** GET publik hanya untuk membuka tiket lewat token, bukan daftar peserta. */
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    if (params.action === 'ticket') return jsonResponse(handleTicket_(params.t));
    return jsonResponse({ status: 'error', message: 'Aksi tidak dikenal' });
  } catch (err) {
    console.error(err);
    return jsonResponse({ status: 'error', message: 'Terjadi kesalahan di server' });
  }
}

// ---------- RSVP & CEK TIKET ----------

function handleRsvp_(data) {
  const nim = normalizeCell_(data.nim);
  const nama = String(data.nama || '').replace(/\s+/g, ' ').trim();
  const angkatan = normalizeCell_(data.angkatan);
  const jurusan = normalizeJurusan_(data.jurusan);
  const kehadiran = normalizeCell_(data.kehadiran).toLowerCase();

  const invalid = validateParticipant_(nim, nama, angkatan, jurusan);
  if (invalid) return invalid;
  if (kehadiran !== 'hadir' && kehadiran !== 'tidak') return { status: 'error', message: 'Status kehadiran tidak valid' };

  const guests = kehadiran === 'hadir' ? parseGuestList_(data.teman) : { list: [] };
  if (guests.error) return { status: 'error', message: guests.error };

  return withLock_(function () {
    const sheet = getSheet_();
    const rows = sheet.getDataRange().getValues();
    ensureHeaders_(sheet, rows);
    const index = findRowIndex_(rows, COL.NIM, nim);

    // NIM sudah terdaftar: data tidak diubah, pendaftar diarahkan ke halaman tiketnya (Cek Tiket).
    if (index !== -1) {
      const row = rows[index];
      if (normalizeName_(row[COL.NAMA]) !== normalizeName_(nama)) return { status: 'ok', result: 'name_mismatch' };
      fillJurusan_(sheet, index, row, jurusan);
      return { status: 'ok', result: 'exists', token: ensureToken_(sheet, index, row) };
    }

    const token = Utilities.getUuid();
    sheet.appendRow(buildRow_({ nim: nim, nama: nama, angkatan: angkatan, kehadiran: kehadiran, pesan: data.pesan, token: token, jurusan: jurusan, kategori: 'Mahasiswa' }));
    if (kehadiran !== 'hadir') return { status: 'ok', result: 'declined', token: token };

    const added = addGuests_(sheet, rows, nim, guests.list);
    return { status: 'ok', result: 'registered', token: token, guestsAdded: added.added, guestsRejected: added.rejected };
  });
}

/** Cek Tiket: NIM + nama yang cocok mengembalikan token tiket pendaftar. Tidak mengubah data selain melengkapi token. */
function handleLookup_(data) {
  const nim = normalizeCell_(data.nim);
  const nama = String(data.nama || '').replace(/\s+/g, ' ').trim();
  if (!/^\d{5,20}$/.test(nim) || !nama) return { status: 'error', message: 'Isi NIM dan nama lengkap' };

  return withLock_(function () {
    const sheet = getSheet_();
    const rows = sheet.getDataRange().getValues();
    const index = findRowIndex_(rows, COL.NIM, nim);
    if (index === -1) return { status: 'not_found' };
    const row = rows[index];
    if (normalizeName_(row[COL.NAMA]) !== normalizeName_(nama)) return { status: 'name_mismatch' };
    return { status: 'ok', token: ensureToken_(sheet, index, row) };
  });
}

// ---------- PENGELOLAAN OLEH PEMILIK TOKEN ----------

function handleGuestAdd_(data) {
  const guests = parseGuestList_(data.teman);
  if (guests.error) return { status: 'error', message: guests.error };
  if (!guests.list.length) return { status: 'error', message: 'Isi data teman terlebih dahulu' };

  return withHost_(data.token, function (sheet, rows, index, row) {
    if (normalizeCell_(row[COL.KEHADIRAN]).toLowerCase() !== 'hadir') return { status: 'not_attending' };
    const result = addGuests_(sheet, rows, normalizeCell_(row[COL.NIM]), guests.list);
    return { status: 'ok', guestsAdded: result.added, guestsRejected: result.rejected };
  });
}

function handleGuestRemove_(data) {
  const guestId = normalizeCell_(data.guestId);
  return withHost_(data.token, function (sheet, rows, index, row) {
    const guestIndex = findRowIndex_(rows, COL.GUEST_ID, guestId);
    if (guestIndex === -1 || normalizeCell_(rows[guestIndex][COL.PENGUNDANG]) !== normalizeCell_(row[COL.NIM])) return { status: 'not_found' };
    if (rows[guestIndex][COL.CHECKIN] === 'Hadir') return { status: 'locked', nama: String(rows[guestIndex][COL.NAMA]) };
    sheet.deleteRow(guestIndex + 1);
    return { status: 'ok', nama: String(rows[guestIndex][COL.NAMA]) };
  });
}

/** Pendaftar mengubah kehadirannya. Tiket teman ikut tidak berlaku saat batal, dan berlaku lagi saat hadir. */
function handleAttendance_(data) {
  const kehadiran = normalizeCell_(data.kehadiran).toLowerCase();
  if (kehadiran !== 'hadir' && kehadiran !== 'tidak') return { status: 'error', message: 'Status kehadiran tidak valid' };

  return withHost_(data.token, function (sheet, rows, index, row) {
    if (row[COL.CHECKIN] === 'Hadir') return { status: 'locked' };
    sheet.getRange(index + 1, COL.KEHADIRAN + 1).setValue(kehadiran);
    const nim = normalizeCell_(row[COL.NIM]);
    guestIndexes_(rows, nim).forEach(function (i) {
      if (rows[i][COL.CHECKIN] !== 'Hadir') sheet.getRange(i + 1, COL.KEHADIRAN + 1).setValue(kehadiran);
    });
    return { status: 'ok', kehadiran: kehadiran };
  });
}

/** Menjalankan aksi atas nama pendaftar pemilik token (bukan token tamu). */
function withHost_(token, callback) {
  const value = normalizeCell_(token);
  if (!/^[0-9a-f-]{36}$/i.test(value)) return { status: 'not_found' };
  return withLock_(function () {
    const sheet = getSheet_();
    const rows = sheet.getDataRange().getValues();
    ensureHeaders_(sheet, rows);
    const index = findRowIndex_(rows, COL.TOKEN, value);
    if (index === -1 || isGuest_(rows[index])) return { status: 'not_found' };
    return callback(sheet, rows, index, rows[index]);
  });
}

/**
 * Menambah daftar teman untuk pendaftar. Nama yang sama dengan teman yang sudah ada dilewati.
 * Mengembalikan jumlah yang ditambahkan dan yang ditolak karena kuota total tamu penuh.
 */
function addGuests_(sheet, rows, nim, list) {
  const existing = {};
  guestIndexes_(rows, nim).forEach(function (i) { existing[normalizeName_(rows[i][COL.NAMA])] = true; });
  let active = countActiveGuests_(rows);
  const kuota = guestQuota_();
  let added = 0, rejected = 0;

  list.forEach(function (guest) {
    const key = normalizeName_(guest.nama);
    if (existing[key]) return;
    if (kuota !== null && active >= kuota) { rejected++; return; }
    sheet.appendRow(buildRow_({ nama: guest.nama, kehadiran: 'hadir', token: Utilities.getUuid(), kategori: 'Tamu', pengundang: nim, asal: guest.asal, instansi: guest.instansi, guestId: newGuestId_() }));
    existing[key] = true;
    active++;
    added++;
  });
  return { added: added, rejected: rejected };
}

// ---------- TIKET ----------

function handleTicket_(token) {
  const value = normalizeCell_(token);
  if (!/^[0-9a-f-]{36}$/i.test(value)) return { status: 'not_found' };

  const rows = getSheet_().getDataRange().getValues();
  const index = findRowIndex_(rows, COL.TOKEN, value);
  if (index === -1) return { status: 'not_found' };
  const row = rows[index];
  const hadir = normalizeCell_(row[COL.KEHADIRAN]).toLowerCase() === 'hadir';

  if (isGuest_(row)) {
    if (!hadir) return { status: 'not_found' };
    const hostIndex = findRowIndex_(rows, COL.NIM, normalizeCell_(row[COL.PENGUNDANG]));
    if (hostIndex === -1) return { status: 'not_found' };
    return {
      status: 'ok',
      ticket: {
        kategori: 'Tamu',
        nama: String(row[COL.NAMA]),
        asal: asalLabel_(row[COL.ASAL]),
        instansi: normalizeCell_(row[COL.INSTANSI]),
        pengundang: String(rows[hostIndex][COL.NAMA]),
        checkedIn: row[COL.CHECKIN] === 'Hadir'
      }
    };
  }

  // Tiket pendaftar: tetap bisa dibuka saat tidak hadir, supaya bisa diubah lagi menjadi hadir.
  const nim = normalizeCell_(row[COL.NIM]);
  const ticket = {
    kategori: 'Mahasiswa',
    nama: String(row[COL.NAMA]),
    nim: nim,
    angkatan: normalizeCell_(row[COL.ANGKATAN]),
    kehadiran: hadir ? 'hadir' : 'tidak',
    checkedIn: row[COL.CHECKIN] === 'Hadir',
    guests: []
  };
  if (hadir) {
    ticket.guests = guestIndexes_(rows, nim)
      .filter(function (i) { return normalizeCell_(rows[i][COL.KEHADIRAN]).toLowerCase() === 'hadir'; })
      .map(function (i) {
        const g = rows[i];
        return {
          id: normalizeCell_(g[COL.GUEST_ID]),
          nama: String(g[COL.NAMA]),
          token: normalizeCell_(g[COL.TOKEN]),
          asal: asalLabel_(g[COL.ASAL]),
          instansi: normalizeCell_(g[COL.INSTANSI]),
          checkedIn: g[COL.CHECKIN] === 'Hadir'
        };
      });
  }
  return { status: 'ok', ticket: ticket };
}

// ---------- PANITIA ----------

function handleList_() {
  const rows = getSheet_().getDataRange().getValues().slice(1);
  const hostNames = {};
  rows.forEach(function (row) {
    if (!isGuest_(row) && normalizeCell_(row[COL.NIM])) hostNames[normalizeCell_(row[COL.NIM])] = String(row[COL.NAMA]);
  });

  return {
    status: 'ok',
    data: rows.filter(function (row) {
      return isGuest_(row) ? normalizeCell_(row[COL.NAMA]) : normalizeCell_(row[COL.NIM]);
    }).map(function (row) {
      const base = {
        nama: String(row[COL.NAMA]),
        kehadiran: normalizeCell_(row[COL.KEHADIRAN]).toLowerCase(),
        checkedIn: row[COL.CHECKIN] === 'Hadir'
      };
      if (isGuest_(row)) {
        const host = normalizeCell_(row[COL.PENGUNDANG]);
        base.id = normalizeCell_(row[COL.GUEST_ID]);
        base.kategori = 'Tamu';
        base.nim = '';
        base.angkatan = '';
        base.jurusan = '';
        base.asal = asalLabel_(row[COL.ASAL]);
        base.instansi = normalizeCell_(row[COL.INSTANSI]);
        base.pengundang = host;
        base.pengundangNama = hostNames[host] || '';
        return base;
      }
      base.id = normalizeCell_(row[COL.NIM]);
      base.kategori = 'Mahasiswa';
      base.nim = base.id;
      base.angkatan = normalizeCell_(row[COL.ANGKATAN]);
      base.jurusan = normalizeCell_(row[COL.JURUSAN]);
      return base;
    })
  };
}

/** Scanner mengirim token, pencarian manual mengirim NIM (mahasiswa) atau guestId (tamu). */
function handleCheckIn_(data) {
  const token = normalizeCell_(data.token);
  const nim = normalizeCell_(data.nim);
  const guestId = normalizeCell_(data.guestId);
  if (!token && !nim && !guestId) return { status: 'not_found' };

  return withLock_(function () {
    const sheet = getSheet_();
    const rows = sheet.getDataRange().getValues();
    let index;
    if (token) index = findRowIndex_(rows, COL.TOKEN, token);
    else if (nim) index = findRowIndex_(rows, COL.NIM, nim);
    else index = findRowIndex_(rows, COL.GUEST_ID, guestId);
    if (index === -1) return { status: 'not_found' };

    const row = rows[index];
    const info = describe_(rows, row);
    if (row[COL.CHECKIN] === 'Hadir') return Object.assign({ status: 'already' }, info);
    if (normalizeCell_(row[COL.KEHADIRAN]).toLowerCase() !== 'hadir') return Object.assign({ status: 'not_attending' }, info);

    sheet.getRange(index + 1, COL.CHECKIN + 1).setValue('Hadir');
    return Object.assign({ status: 'ok' }, info);
  });
}

/** Panitia mendaftarkan mahasiswa di tempat, sekaligus mencatatnya hadir. */
function handleWalkIn_(data) {
  const nim = normalizeCell_(data.nim);
  const nama = String(data.nama || '').replace(/\s+/g, ' ').trim();
  const angkatan = normalizeCell_(data.angkatan);
  const jurusan = normalizeJurusan_(data.jurusan);

  const invalid = validateParticipant_(nim, nama, angkatan, jurusan);
  if (invalid) return invalid;

  return withLock_(function () {
    const sheet = getSheet_();
    const rows = sheet.getDataRange().getValues();
    ensureHeaders_(sheet, rows);
    const index = findRowIndex_(rows, COL.NIM, nim);

    if (index === -1) {
      sheet.appendRow(buildRow_({ nim: nim, nama: nama, angkatan: angkatan, kehadiran: 'hadir', checkin: 'Hadir', token: Utilities.getUuid(), sumber: 'On The Spot', jurusan: jurusan, kategori: 'Mahasiswa' }));
      return { status: 'ok', result: 'new', nama: nama, nim: nim, id: nim, kategori: 'Mahasiswa' };
    }

    const row = rows[index];
    const namaTerdaftar = String(row[COL.NAMA]);
    if (normalizeName_(namaTerdaftar) !== normalizeName_(nama)) {
      return { status: 'name_mismatch', nama: namaTerdaftar };
    }
    fillJurusan_(sheet, index, row, jurusan);
    if (row[COL.CHECKIN] === 'Hadir') return { status: 'already', nama: namaTerdaftar };

    sheet.getRange(index + 1, COL.KEHADIRAN + 1).setValue('hadir');
    sheet.getRange(index + 1, COL.CHECKIN + 1).setValue('Hadir');
    return { status: 'ok', result: 'existing', nama: namaTerdaftar, nim: nim, id: nim, kategori: 'Mahasiswa' };
  });
}

/** Panitia mendaftarkan tamu di tempat untuk mahasiswa yang sudah terdaftar, sekaligus check-in. */
function handleWalkInGuest_(data) {
  const host = normalizeCell_(data.pengundang);
  if (!/^\d{5,20}$/.test(host)) return { status: 'error', message: 'NIM pengundang tidak valid' };
  const guest = parseGuest_(data);
  if (guest.error) return { status: 'error', message: guest.error };

  return withLock_(function () {
    const sheet = getSheet_();
    const rows = sheet.getDataRange().getValues();
    ensureHeaders_(sheet, rows);
    const hostIndex = findRowIndex_(rows, COL.NIM, host);
    if (hostIndex === -1) return { status: 'host_not_found' };

    const hostRow = rows[hostIndex];
    const hostNama = String(hostRow[COL.NAMA]);
    if (normalizeCell_(hostRow[COL.KEHADIRAN]).toLowerCase() !== 'hadir') return { status: 'host_not_attending', pengundangNama: hostNama };

    // Tamu dengan nama sama dari pengundang yang sama dianggap orang yang sama.
    const sameIndex = guestIndexes_(rows, host).filter(function (i) {
      return normalizeName_(rows[i][COL.NAMA]) === normalizeName_(guest.nama);
    })[0];
    if (sameIndex !== undefined) {
      const g = rows[sameIndex];
      if (g[COL.CHECKIN] === 'Hadir') return { status: 'already', nama: String(g[COL.NAMA]), pengundangNama: hostNama };
      sheet.getRange(sameIndex + 1, COL.KEHADIRAN + 1).setValue('hadir');
      sheet.getRange(sameIndex + 1, COL.CHECKIN + 1).setValue('Hadir');
      return { status: 'ok', result: 'existing', nama: String(g[COL.NAMA]), id: normalizeCell_(g[COL.GUEST_ID]), kategori: 'Tamu', pengundangNama: hostNama };
    }

    const kuota = guestQuota_();
    if (kuota !== null && countActiveGuests_(rows) >= kuota) return { status: 'quota_full' };
    const guestId = newGuestId_();
    sheet.appendRow(buildRow_({ nama: guest.nama, kehadiran: 'hadir', checkin: 'Hadir', token: Utilities.getUuid(), sumber: 'On The Spot', kategori: 'Tamu', pengundang: host, asal: guest.asal, instansi: guest.instansi, guestId: guestId }));
    return { status: 'ok', result: 'new', nama: guest.nama, id: guestId, kategori: 'Tamu', pengundangNama: hostNama, asal: asalLabel_(guest.asal), instansi: guest.instansi, pengundang: host };
  });
}

// ---------- BANTUAN ----------

function validateParticipant_(nim, nama, angkatan, jurusan) {
  if (!/^\d{5,20}$/.test(nim)) return { status: 'error', message: 'NIM tidak valid' };
  if (!nama || nama.length > 100) return { status: 'error', message: 'Nama tidak valid' };
  if (!/^20\d{2}$/.test(angkatan)) return { status: 'error', message: 'Angkatan harus berupa tahun, misalnya 2024' };
  if (!jurusan || jurusan.length > 100) return { status: 'error', message: 'Jurusan wajib diisi' };
  return null;
}

/** Data satu teman: nama wajib; asal telkom/kampus_lain/umum; nama kampus wajib untuk kampus_lain. */
function parseGuest_(value) {
  const nama = String((value && value.nama) || '').replace(/\s+/g, ' ').trim();
  const asal = normalizeCell_(value && value.asal).toLowerCase();
  const instansi = String((value && value.instansi) || '').replace(/\s+/g, ' ').trim();
  if (!nama || nama.length > 100) return { error: 'Nama teman wajib diisi' };
  if (!ASAL_TAMU[asal]) return { error: 'Asal teman tidak valid' };
  if (asal === 'kampus_lain' && !instansi) return { error: 'Nama kampus teman wajib diisi' };
  if (instansi.length > 100) return { error: 'Nama instansi terlalu panjang' };
  return { nama: nama, asal: asal, instansi: asal === 'telkom' ? '' : instansi };
}

/** Daftar teman (array, atau satu objek). Nama yang sama dalam satu kiriman hanya dihitung sekali. */
function parseGuestList_(value) {
  if (!value) return { list: [] };
  const items = Array.isArray(value) ? value : [value];
  if (items.length > MAX_GUESTS_PER_REQUEST) return { error: 'Terlalu banyak teman dalam satu kiriman' };
  const list = [], seen = {};
  for (let i = 0; i < items.length; i++) {
    const guest = parseGuest_(items[i]);
    if (guest.error) return { error: items.length > 1 ? guest.error + ' (teman ke-' + (i + 1) + ')' : guest.error };
    const key = normalizeName_(guest.nama);
    if (seen[key]) continue;
    seen[key] = true;
    list.push(guest);
  }
  return { list: list };
}

function guestQuota_() {
  const raw = PropertiesService.getScriptProperties().getProperty('KUOTA_TAMU');
  if (raw === null || String(raw).trim() === '') return null;
  const kuota = parseInt(raw, 10);
  return isNaN(kuota) ? null : kuota;
}

function countActiveGuests_(rows) {
  return rows.filter(function (row) {
    return isGuest_(row) && normalizeCell_(row[COL.KEHADIRAN]).toLowerCase() === 'hadir';
  }).length;
}

function guestIndexes_(rows, hostNim) {
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    if (isGuest_(rows[i]) && normalizeCell_(rows[i][COL.PENGUNDANG]) === hostNim) result.push(i);
  }
  return result;
}

function newGuestId_() {
  return 'T' + Utilities.getUuid().replace(/-/g, '').slice(-10).toUpperCase();
}

/** Peserta lama mungkin belum punya token; dibuatkan saat dibutuhkan. */
function ensureToken_(sheet, index, row) {
  let token = normalizeCell_(row[COL.TOKEN]);
  if (!token) {
    token = Utilities.getUuid();
    sheet.getRange(index + 1, COL.TOKEN + 1).setValue(token);
  }
  return token;
}

/** Ringkasan untuk layar hasil check-in. */
function describe_(rows, row) {
  if (isGuest_(row)) {
    const hostIndex = findRowIndex_(rows, COL.NIM, normalizeCell_(row[COL.PENGUNDANG]));
    return {
      nama: String(row[COL.NAMA]),
      id: normalizeCell_(row[COL.GUEST_ID]),
      kategori: 'Tamu',
      pengundangNama: hostIndex === -1 ? '' : String(rows[hostIndex][COL.NAMA])
    };
  }
  const nim = normalizeCell_(row[COL.NIM]);
  return { nama: String(row[COL.NAMA]), nim: nim, id: nim, kategori: 'Mahasiswa' };
}

function buildRow_(o) {
  const row = new Array(15).fill('');
  row[0] = new Date();
  row[COL.NIM] = o.nim || '';
  row[COL.NAMA] = safeText_(o.nama);
  row[COL.ANGKATAN] = o.angkatan || '';
  row[COL.KEHADIRAN] = o.kehadiran;
  row[5] = safeText_(o.pesan);
  row[COL.CHECKIN] = o.checkin || 'Belum Hadir';
  row[COL.TOKEN] = o.token || '';
  row[COL.SUMBER] = o.sumber || '';
  row[COL.JURUSAN] = safeText_(o.jurusan);
  row[COL.KATEGORI] = o.kategori;
  row[COL.PENGUNDANG] = o.pengundang || '';
  row[COL.ASAL] = o.asal || '';
  row[COL.INSTANSI] = safeText_(o.instansi);
  row[COL.GUEST_ID] = o.guestId || '';
  return row;
}

function isGuest_(row) {
  return normalizeCell_(row[COL.KATEGORI]) === 'Tamu';
}

function asalLabel_(value) {
  return ASAL_TAMU[normalizeCell_(value)] || '';
}

/** Huruf besar dan spasi rapi membuat isian yang sama lebih mudah direkap. */
function normalizeJurusan_(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function ensureHeaders_(sheet, rows) {
  Object.keys(HEADERS).forEach(function (col) {
    if (rows[0][col] !== HEADERS[col]) sheet.getRange(1, Number(col) + 1).setValue(HEADERS[col]);
  });
}

/** Peserta lama belum punya jurusan, jadi dilengkapi saat mendaftar ulang. */
function fillJurusan_(sheet, index, row, jurusan) {
  if (!normalizeCell_(row[COL.JURUSAN])) sheet.getRange(index + 1, COL.JURUSAN + 1).setValue(safeText_(jurusan));
}

/** Mencegah dua proses menulis ke sheet pada waktu yang sama. */
function withLock_(callback) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { status: 'busy', message: 'Server sedang sibuk, coba lagi' };
  try {
    const result = callback();
    SpreadsheetApp.flush();
    return result;
  } finally {
    lock.releaseLock();
  }
}

function isPinValid_(pin) {
  const expected = PropertiesService.getScriptProperties().getProperty('PANITIA_PIN');
  return Boolean(expected) && String(pin || '') === expected;
}

function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

function findRowIndex_(rows, column, value) {
  if (!value) return -1;
  for (let i = 1; i < rows.length; i++) {
    if (normalizeCell_(rows[i][column]) === value) return i;
  }
  return -1;
}

function normalizeCell_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeName_(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Mencegah isian form dijalankan sebagai rumus Sheets, misalnya =IMPORTXML(...). */
function safeText_(value) {
  const text = String(value || '').slice(0, 500);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Jalankan sekali dari editor Apps Script. */
function setup() {
  const sheet = getSheet_();
  sheet.getRange(1, COL.TOKEN + 1).setValue('Token');
  Object.keys(HEADERS).forEach(function (col) {
    sheet.getRange(1, Number(col) + 1).setValue(HEADERS[col]);
  });
  SpreadsheetApp.flush();
  Logger.log('Setup selesai. PANITIA_PIN ' + (PropertiesService.getScriptProperties().getProperty('PANITIA_PIN') ? 'sudah' : 'BELUM') + ' diisi.');
}
