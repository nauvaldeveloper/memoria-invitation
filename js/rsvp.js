// ==========================================
// LOGIKA RSVP
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('rsvpForm');
  const submitBtn = document.getElementById('submitBtn');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');

  let toastTimer;

  function showToast(message, isError = false) {
    toastMsg.textContent = message;

    if (isError) {
      toast.classList.remove('border-memoria-gold', 'text-memoria-gold-light', 'shadow-[0_10px_40px_rgba(212,175,55,0.4)]');
      toast.classList.add('border-red-500', 'text-red-200', 'shadow-[0_10px_40px_rgba(239,68,68,0.4)]');
    } else {
      toast.classList.add('border-memoria-gold', 'text-memoria-gold-light', 'shadow-[0_10px_40px_rgba(212,175,55,0.4)]');
      toast.classList.remove('border-red-500', 'text-red-200', 'shadow-[0_10px_40px_rgba(239,68,68,0.4)]');
    }

    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-20', 'opacity-0');
    }, 4500);
  }

  // state: new (baru daftar) atau exists (NIM sudah terdaftar). rejected: jumlah teman yang tertolak kuota.
  function goToTicket(token, state, rejected) {
    const extra = rejected ? `&r=${encodeURIComponent(rejected)}` : '';
    window.location.href = `tiket.html?t=${encodeURIComponent(token)}&s=${state}${extra}`;
  }

  // --- AJAK TEMAN (tanpa batas) ---
  const guestSection = document.getElementById('guestSection');
  const guestFields = document.getElementById('guestFields');
  const ajakTeman = document.getElementById('ajakTeman');
  const guests = window.GuestFields(document.getElementById('guestList'), document.getElementById('addGuestBtn'));

  function updateGuestForm() {
    const hadir = form.kehadiran.value === 'hadir';
    guestSection.classList.toggle('hidden', !hadir);
    guestFields.classList.toggle('hidden', !(hadir && ajakTeman.checked));
  }

  form.kehadiran.addEventListener('change', updateGuestForm);
  ajakTeman.addEventListener('change', updateGuestForm);
  form.addEventListener('reset', () => setTimeout(() => { guests.reset(); updateGuestForm(); }, 0));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
      action: 'rsvp',
      nim: form.nim.value.trim(),
      nama: form.nama.value.trim(),
      angkatan: form.angkatan.value.trim(),
      jurusan: form.jurusan.value.replace(/\s+/g, ' ').trim(),
      kehadiran: form.kehadiran.value
    };

    if (!formData.nim || !formData.nama || !formData.angkatan || !formData.jurusan || !formData.kehadiran) {
      showToast('⚠ Mohon lengkapi semua field wajib!', true);
      return;
    }

    if (!/^20\d{2}$/.test(formData.angkatan)) {
      showToast('⚠ Angkatan harus berupa tahun, misalnya 2024.', true);
      form.angkatan.focus();
      return;
    }

    if (formData.kehadiran === 'hadir' && ajakTeman.checked) {
      const error = guests.validate();
      if (error) {
        showToast('⚠ ' + error, true);
        return;
      }
      formData.teman = guests.values();
    }

    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      <span>Mengirim...</span>
    `;

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(formData)
      });
      const result = await response.json();

      if (result.status !== 'ok') {
        showToast('⚠ ' + (result.message || 'Gagal mengirim, coba lagi.'), true);
      } else if (result.result === 'registered') {
        goToTicket(result.token, 'new', result.guestsRejected);
      } else if (result.result === 'exists') {
        // NIM sudah terdaftar: data tidak diubah, langsung ke halaman tiket (Cek Tiket).
        goToTicket(result.token, 'exists');
      } else if (result.result === 'declined') {
        showToast('✓ Terima kasih, konfirmasimu sudah tersimpan.');
        form.reset();
      } else if (result.result === 'name_mismatch') {
        showToast('⚠ NIM sudah terdaftar dengan nama lain. Hubungi panitia.', true);
      } else {
        showToast('⚠ Gagal mengirim, coba lagi.', true);
      }
    } catch (error) {
      console.error('RSVP Error:', error);
      showToast('⚠ Gagal mengirim. Cek koneksi internetmu.', true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHTML;
    }
  });
});
