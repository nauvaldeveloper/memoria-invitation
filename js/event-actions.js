// ==========================================
// TOMBOL BUKA MAPS & SIMPAN KE KALENDER
// Pakai: <a data-event-action="maps"> dan <button data-event-action="calendar">
// ==========================================
(function () {
  const start = new Date(EVENT_INFO.mulai);
  const end = new Date(EVENT_INFO.selesai);
  const details = `Dress code: ${EVENT_INFO.dressCode}. Open gate ${EVENT_INFO.openGate}. Jangan lupa bawa tiket QR.`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(EVENT_INFO.mapsQuery)}`;

  // Format waktu kalender: 20261205T013000Z
  const toCalendarTime = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const googleCalendarUrl = () => 'https://calendar.google.com/calendar/render?' + new URLSearchParams({
    action: 'TEMPLATE',
    text: EVENT_INFO.judul,
    dates: `${toCalendarTime(start)}/${toCalendarTime(end)}`,
    details: `${details}\n${window.location.origin}`,
    location: EVENT_INFO.lokasi
  }).toString();

  // Teks dalam file .ics perlu meng-escape koma, titik koma, dan garis miring.
  const icsEscape = (text) => String(text).replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');

  const icsText = () => [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hima SIKC//Memoria//ID',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:memoria-2026@hima-sikc',
    `DTSTAMP:${toCalendarTime(new Date())}`,
    `DTSTART:${toCalendarTime(start)}`,
    `DTEND:${toCalendarTime(end)}`,
    `SUMMARY:${icsEscape(EVENT_INFO.judul)}`,
    `LOCATION:${icsEscape(EVENT_INFO.lokasi)}`,
    `DESCRIPTION:${icsEscape(details)}`,
    `URL:${window.location.origin}`,
    'END:VEVENT',
    'END:VCALENDAR',
    ''
  ].join('\r\n');

  // iPhone, iPad, dan Mac membuka file .ics langsung di aplikasi Kalender.
  const isApple = () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

  function addToCalendar() {
    if (isApple()) {
      const url = URL.createObjectURL(new Blob([icsText()], { type: 'text/calendar;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'memoria-2026.ics';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      window.open(googleCalendarUrl(), '_blank', 'noopener');
    }
  }

  document.querySelectorAll('[data-event-action="maps"]').forEach((link) => {
    link.href = mapsUrl;
    link.target = '_blank';
    link.rel = 'noopener';
  });
  document.querySelectorAll('[data-event-action="calendar"]').forEach((button) => {
    button.addEventListener('click', addToCalendar);
  });
})();
