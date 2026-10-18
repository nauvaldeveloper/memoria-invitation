// ==========================================
// LOGIKA RSVP & GOOGLE SHEETS
// ==========================================

// link api nya
const API_URL = 'https://script.google.com/macros/s/AKfycbxzmrp8hJdNG1hTIYy3odv_bgPPdhmtGsDL_yQSXVfBYjRm36hfdo7SJKJVeOAPiMAoCg/exec';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('rsvpForm');
  const submitBtn = document.getElementById('submitBtn');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  
  let toastTimer;

  // Fungsi untuk menampilkan notifikasi melayang
  function showToast(message, isError = false) {
    toastMsg.textContent = message;
    
    // Ubah warna jika error
    if (isError) {
      toast.classList.remove('border-memoria-gold', 'text-memoria-gold-light', 'shadow-[0_10px_40px_rgba(212,175,55,0.4)]');
      toast.classList.add('border-red-500', 'text-red-200', 'shadow-[0_10px_40px_rgba(239,68,68,0.4)]');
    } else {
      toast.classList.add('border-memoria-gold', 'text-memoria-gold-light', 'shadow-[0_10px_40px_rgba(212,175,55,0.4)]');
      toast.classList.remove('border-red-500', 'text-red-200', 'shadow-[0_10px_40px_rgba(239,68,68,0.4)]');
    }

    // Munculkan
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    // Hilangkan setelah 3.5 detik
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-20', 'opacity-0');
    }, 3500);
  }

  // Handle Submit Form
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Ambil data
    const formData = {
      nim: form.nim.value.trim(),          
      nama: form.nama.value.trim(),
      angkatan: form.angkatan.value.trim(),
      kehadiran: form.kehadiran.value,
      pesan: form.pesan.value.trim()
    };

    // Validasi
    if (!formData.nim || !formData.nama || !formData.angkatan || !formData.kehadiran) {
      showToast('⚠ Mohon lengkapi semua field wajib!', true);
      return;
    }

    // Ubah tombol jadi loading
    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      <span>Mengirim...</span>
    `;

    try {
      // Kirim ke Google Apps Script
      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors', // PENTING untuk Apps Script
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(formData)
      });

      // Simpan backup di localStorage
      const list = JSON.parse(localStorage.getItem('rsvpMemoria') || '[]');
      list.push({ ...formData, waktu: new Date().toISOString() });
      localStorage.setItem('rsvpMemoria', JSON.stringify(list));

      // Sukses!
      showToast('✓ Terima kasih, ' + formData.nama + '!');

            // Sukses!
      showToast('✓ Terima kasih, ' + formData.nama + '!');
      
      // --- TAMBAHKAN KODE MODAL QR DI SINI ---
      const ticketModal = document.getElementById('ticketModal');
      const ticketContent = document.getElementById('ticketContent');
      const qrcodeDiv = document.getElementById('qrcode');
      
      // Set teks di tiket
      document.getElementById('ticketName').textContent = formData.nama;
      document.getElementById('ticketNim').textContent = 'NIM: ' + formData.nim;
      
      // Generate QR Code (isinya NIM)
    //   qrcodeDiv.innerHTML = ""; // Bersihkan QR lama
    //         new QRCode(qrcodeDiv, {
    //     text: formData.nim,
    //     width: 150,
    //     height: 150,
    //     colorDark : "#000000", 
    //     colorLight : "#ffffff",
    //     correctLevel : QRCode.CorrectLevel.H
    //   });

            // Generate QR Code (isinya NIM)
      qrcodeDiv.innerHTML = ""; // Bersihkan QR lama
      
      new QRCode(qrcodeDiv, {
        text: formData.nim,
        width: 180,
        height: 180,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
      // -------------------------------------------

      // Tampilkan Modal
      ticketModal.classList.remove('opacity-0', 'pointer-events-none');
      ticketContent.classList.remove('scale-90');
      ticketContent.classList.add('scale-100');

      // Logika Tutup Modal
      document.getElementById('closeTicketBtn').onclick = () => {
        ticketModal.classList.add('opacity-0', 'pointer-events-none');
        ticketContent.classList.remove('scale-100');
        ticketContent.classList.add('scale-90');
        form.reset(); // Reset form setelah ditutup
      };
      // ----------------------------------------

      if (typeof window.fireConfetti === 'function') {
        window.fireConfetti();
      }
      
      // Reset form
      form.reset();
      
      // Panggil fungsi confetti (dari file confetti.js)
      if (typeof window.fireConfetti === 'function') {
        window.fireConfetti();
      }

    } catch (error) {
      console.error('RSVP Error:', error);
      showToast('⚠ Gagal mengirim. Cek koneksi internetmu.', true);
    } finally {
      // Kembalikan tombol ke semula
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHTML;
    }
  });
});