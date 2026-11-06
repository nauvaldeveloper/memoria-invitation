/**
 * ============================================
 *  BACKEND MEMORIA - Google Apps Script
 *  Perayaan Perjalanan Hima SIKC
 * ============================================
 *
 * Kolom sheet:
 * A Timestamp | B NIM | C Nama | D Angkatan | E Kehadiran | F Pesan | G Status Check-In | H Token
 *
 * Persiapan sekali saja:
 * 1. Project Settings > Script Properties: tambah PANITIA_PIN berisi PIN panjang.
 * 2. Jalankan fungsi setup() dari editor.
 */

const SHEET_NAME = 'Sheet1';
const ANGKATAN_VALID = ['2024', '2025', '2026'];
const COL = { NIM: 1, NAMA: 2, KEHADIRAN: 4, CHECKIN: 6, TOKEN: 7 };

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'rsvp';

    if (action === 'rsvp') return jsonResponse(handleRsvp_(data));

    // Semua aksi di bawah ini khusus panitia.
    if (!isPinValid_(data.pin)) {
      Utilities.sleep(1000); // memperlambat percobaan menebak PIN
      return jsonResponse({ status: 'unauthorized', message: 'PIN salah' });
    }
    if (action === 'login') return jsonResponse({ status: 'ok' });
    if (action === 'list') return jsonResponse(handleList_());
    if (action === 'checkin') return jsonResponse(handleCheckIn_(data));

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

function handleRsvp_(data) {
  const nim = normalizeCell_(data.nim);
  const nama = String(data.nama || '').replace(/\s+/g, ' ').trim();
  const angkatan = normalizeCell_(data.angkatan);
  const kehadiran = normalizeCell_(data.kehadiran).toLowerCase();

  if (!/^\d{5,20}$/.test(nim)) return { status: 'error', message: 'NIM tidak valid' };
  if (!nama || nama.length > 100) return { status: 'error', message: 'Nama tidak valid' };
  if (ANGKATAN_VALID.indexOf(angkatan) === -1) return { status: 'error', message: 'Angkatan tidak valid' };
  if (kehadiran !== 'hadir' && kehadiran !== 'tidak') return { status: 'error', message: 'Status kehadiran tidak valid' };

  return withLock_(function () {
    const sheet = getSheet_();
    const rows = sheet.getDataRange().getValues();
    const index = findRowIndex_(rows, COL.NIM, nim);

    if (index === -1) {
      const token = kehadiran === 'hadir' ? Utilities.getUuid() : '';
      sheet.appendRow([new Date(), nim, safeText_(nama), angkatan, kehadiran, safeText_(data.pesan), 'Belum Hadir', token]);
      return kehadiran === 'hadir'
        ? { status: 'ok', result: 'registered', token: token }
        : { status: 'ok', result: 'declined' };
    }

    const row = rows[index];
    if (normalizeName_(row[COL.NAMA]) !== normalizeName_(nama)) {
      return { status: 'ok', result: 'name_mismatch' };
    }

    const checkedIn = row[COL.CHECKIN] === 'Hadir';
    if (kehadiran === 'tidak' && !checkedIn) {
      sheet.getRange(index + 1, COL.KEHADIRAN + 1).setValue('tidak');
      return { status: 'ok', result: 'declined' };
    }

    const wasAttending = normalizeCell_(row[COL.KEHADIRAN]).toLowerCase() === 'hadir';
    if (!wasAttending) sheet.getRange(index + 1, COL.KEHADIRAN + 1).setValue('hadir');

    // Peserta lama belum punya token, jadi dibuatkan saat mendaftar ulang.
    let token = normalizeCell_(row[COL.TOKEN]);
    if (!token) {
      token = Utilities.getUuid();
      sheet.getRange(index + 1, COL.TOKEN + 1).setValue(token);
    }
    return { status: 'ok', result: wasAttending ? 'already' : 'registered', token: token };
  });
}

function handleTicket_(token) {
  const value = normalizeCell_(token);
  if (!/^[0-9a-f-]{36}$/i.test(value)) return { status: 'not_found' };

  const rows = getSheet_().getDataRange().getValues();
  const index = findRowIndex_(rows, COL.TOKEN, value);
  if (index === -1) return { status: 'not_found' };

  const row = rows[index];
  if (normalizeCell_(row[COL.KEHADIRAN]).toLowerCase() !== 'hadir') return { status: 'not_found' };

  return {
    status: 'ok',
    ticket: {
      nama: String(row[COL.NAMA]),
      nim: normalizeCell_(row[COL.NIM]),
      angkatan: normalizeCell_(row[3]),
      checkedIn: row[COL.CHECKIN] === 'Hadir'
    }
  };
}

function handleList_() {
  const rows = getSheet_().getDataRange().getValues().slice(1);
  return {
    status: 'ok',
    data: rows.filter(function (row) { return normalizeCell_(row[COL.NIM]); }).map(function (row) {
      return {
        nama: String(row[COL.NAMA]),
        nim: normalizeCell_(row[COL.NIM]),
        angkatan: normalizeCell_(row[3]),
        kehadiran: normalizeCell_(row[COL.KEHADIRAN]).toLowerCase(),
        checkedIn: row[COL.CHECKIN] === 'Hadir'
      };
    })
  };
}

/** Scanner mengirim token, pencarian manual panitia mengirim NIM. */
function handleCheckIn_(data) {
  const token = normalizeCell_(data.token);
  const nim = normalizeCell_(data.nim);
  if (!token && !nim) return { status: 'not_found' };

  return withLock_(function () {
    const sheet = getSheet_();
    const rows = sheet.getDataRange().getValues();
    const index = token ? findRowIndex_(rows, COL.TOKEN, token) : findRowIndex_(rows, COL.NIM, nim);
    if (index === -1) return { status: 'not_found' };

    const row = rows[index];
    const nama = String(row[COL.NAMA]);
    if (row[COL.CHECKIN] === 'Hadir') return { status: 'already', nama: nama };
    if (normalizeCell_(row[COL.KEHADIRAN]).toLowerCase() !== 'hadir') return { status: 'not_attending', nama: nama };

    sheet.getRange(index + 1, COL.CHECKIN + 1).setValue('Hadir');
    return { status: 'ok', nama: nama, nim: normalizeCell_(row[COL.NIM]) };
  });
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
  SpreadsheetApp.flush();
  Logger.log('Setup selesai. PANITIA_PIN ' + (PropertiesService.getScriptProperties().getProperty('PANITIA_PIN') ? 'sudah' : 'BELUM') + ' diisi.');
}
