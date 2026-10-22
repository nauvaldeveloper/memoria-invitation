document.addEventListener('DOMContentLoaded', () => {
  // --- 1. CURTAIN (TIRAI) ANIMATION ---
  const curtainLeft = document.getElementById('curtain-left');
  const curtainRight = document.getElementById('curtain-right');
  const curtainText = document.getElementById('curtain-text');
  const curtainContainer = document.getElementById('curtain-container');

  // Jalankan animasi setelah 1.5 detik (biar user baca "MEMORIA" dulu)
  setTimeout(() => {
    // Hilangkan teks
    curtainText.classList.add('opacity-0');
    
    // Buka tirai ke kiri dan kanan
    curtainLeft.classList.add('-translate-x-full');
    curtainRight.classList.add('translate-x-full');

    // Hapus elemen setelah animasi selesai
    setTimeout(() => {
      curtainContainer.style.display = 'none';
    }, 1000);
  }, 1500);

  // --- 2. SCROLL REVEAL SEDERHANA (Nanti kita kembangkan) ---
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('opacity-100', 'translate-y-0');
        entry.target.classList.remove('opacity-0', 'translate-y-10');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Nanti semua element dengan class ".reveal" akan dianimasikan
  document.querySelectorAll('.reveal').forEach(el => {
    el.classList.add('opacity-0', 'translate-y-10', 'transition-all', 'duration-1000', 'ease-out');
    observer.observe(el);
  });

    // --- 3. SCROLL REVEAL (Tailwind Version) ---
  const revealElements = document.querySelectorAll('.reveal');
  
  // Set initial state (sembunyi & turun sedikit)
  revealElements.forEach(el => {
    el.classList.add('opacity-0', 'translate-y-10', 'transition-all', 'duration-700', 'ease-out');
  });

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Munculkan elemen
        entry.target.classList.remove('opacity-0', 'translate-y-10');
        entry.target.classList.add('opacity-100', 'translate-y-0');
        
        // Berhenti observasi setelah muncul
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15, // Muncul saat 15% elemen terlihat
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));

     // --- 4. TIMELINE ANIMATION (NEW) ---
  const timelineContainer = document.querySelector('.timeline-container');
  const timelineProgress = document.querySelector('.timeline-progress');
  const timelineCards = document.querySelectorAll('.timeline-card');

  // Setup awal: sembunyikan kartu berdasarkan kiri/kanan
  timelineCards.forEach(card => {
    card.classList.add('opacity-0', 'transition-all', 'duration-700', 'ease-out');
    if (card.classList.contains('odd')) {
      card.classList.add('-translate-x-10'); // Sembunyi di kiri
    } else {
      card.classList.add('translate-x-10');  // Sembunyi di kanan
    }
  });

  // Animasi Garis Emas
  if (timelineContainer) {
    const lineObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          timelineProgress.style.transition = 'height 3s ease-in-out';
          timelineProgress.style.height = '100%';
        }
      });
    }, { threshold: 0.2 });
    lineObserver.observe(timelineContainer);
  }

  // Animasi Kartu Muncul
  const cardObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Hapus class sembunyi, tambahkan class muncul
        entry.target.classList.remove('opacity-0', '-translate-x-10', 'translate-x-10');
        entry.target.classList.add('opacity-100', 'translate-x-0');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -50px 0px' });

  timelineCards.forEach(card => cardObserver.observe(card));

    // --- 5. GALLERY PARALLAX ---
  const galleryImages = document.querySelectorAll('#gallery img');
  
  window.addEventListener('scroll', () => {
    // Hanya jalankan di desktop (layar > 768px)
    if (window.innerWidth < 768) return; 

    const scrolled = window.scrollY;
    
    galleryImages.forEach(img => {
      // Hitung posisi gambar relatif terhadap layar
      const rect = img.getBoundingClientRect();
      const speed = 0.05; // Atur kecepatan parallax (makin besar makin cepat)
      
      // Jika gambar ada di dalam viewport
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        // Geser gambar sedikit ke atas atau ke bawah
        const yPos = (rect.top - window.innerHeight / 2) * speed;
        // Gabungkan dengan scale hover agar tidak bentrok
        img.style.transform = `translateY(${yPos}px) scale(1.05)`; 
      }
    });
  });

    // --- 6. COUNTDOWN TIMER ---
  // ⚠️ GANTI TANGGAL DI BAWAH INI SESUAI TANGGAL ACARA MEMORIA ⚠️
  // Format: 'YYYY-MM-DDTHH:mm:ss+07:00' (Waktu Indonesia Barat)
  const eventDate = new Date('2025-12-20T18:00:00+07:00').getTime(); 

  const cdDays = document.getElementById('cd-days');
  const cdHours = document.getElementById('cd-hours');
  const cdMins = document.getElementById('cd-mins');
  const cdSecs = document.getElementById('cd-secs');

  if (cdDays) {
    const countdownInterval = setInterval(() => {
      const now = new Date().getTime();
      const distance = eventDate - now;

      if (distance < 0) {
        clearInterval(countdownInterval);
        cdDays.innerText = "00";
        cdHours.innerText = "00";
        cdMins.innerText = "00";
        cdSecs.innerText = "00";
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      // Tambahkan angka 0 di depan jika < 10
      cdDays.innerText = days < 10 ? "0" + days : days;
      cdHours.innerText = hours < 10 ? "0" + hours : hours;
      cdMins.innerText = minutes < 10 ? "0" + minutes : minutes;
      cdSecs.innerText = seconds < 10 ? "0" + seconds : seconds;
    }, 1000);
  }

  // --- 7. SCROLL TO TOP BUTTON ---
  const scrollTopBtn = document.getElementById('scrollTopBtn');
  
  if (scrollTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 500) {
        scrollTopBtn.classList.remove('opacity-0', 'translate-y-10', 'pointer-events-none');
        scrollTopBtn.classList.add('opacity-100', 'translate-y-0', 'pointer-events-auto');
      } else {
        scrollTopBtn.classList.add('opacity-0', 'translate-y-10', 'pointer-events-none');
        scrollTopBtn.classList.remove('opacity-100', 'translate-y-0', 'pointer-events-auto');
      }
    });

    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

    // --- 8. SHARE BUTTON (Dengan Custom Toast) ---
  const shareBtn = document.getElementById('shareBtn');
  const shareToast = document.getElementById('shareToast');
  let shareToastTimer;

  // Fungsi untuk memunculkan Toast Mewah
  function showShareToast() {
    if (!shareToast) return;
    
    // Animasi masuk (Slide Down & Fade In)
    shareToast.classList.remove('-translate-y-20', 'opacity-0');
    shareToast.classList.add('translate-y-0', 'opacity-100');

    // Hilangkan setelah 3.5 detik
    clearTimeout(shareToastTimer);
    shareToastTimer = setTimeout(() => {
      shareToast.classList.remove('translate-y-0', 'opacity-100');
      shareToast.classList.add('-translate-y-20', 'opacity-0');
    }, 3500);
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      const shareData = {
        title: 'Undangan Memoria - Diesnatalis SIKC',
        text: 'Merayakan perjalanan, menciptakan kenangan yang abadi. Yuk hadiri Memoria!',
        url: window.location.href
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (err) {
          // User membatalkan share, atau error, kita salin link
          copyToClipboard(shareData.url);
        }
      } else {
        // Jika di PC/Laptop yang tidak support native share
        copyToClipboard(shareData.url);
      }
    });
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        showShareToast(); // Panggil Toast Mewah
      }).catch(err => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showShareToast(); // Panggil Toast Mewah
    } catch (err) {
      console.error('Gagal menyalin', err);
    }
    document.body.removeChild(textArea);
  }

    // --- 9. THEME TOGGLE (LIGHT / DARK MODE) ---
  const themeToggle = document.getElementById('themeToggle');
  const iconMoon = document.getElementById('iconMoon');
  const iconSun = document.getElementById('iconSun');
  
  // Cek penyimpanan lokal (default: 'light')
  let currentTheme = localStorage.getItem('memoriaTheme') || 'light';

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('bg-memoria-black'); // Pastikan background gelap
      document.body.style.backgroundColor = '#0a0a0a'; // Fallback
      iconMoon.classList.add('hidden');
      iconSun.classList.remove('hidden');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('bg-memoria-black');
      document.body.style.backgroundColor = '#f5f5f5'; // Warna putih/abu terang
      iconSun.classList.add('hidden');
      iconMoon.classList.remove('hidden');
    }
  }

  // Terapkan saat pertama load
  applyTheme(currentTheme);

  // Aksi saat tombol diklik
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      currentTheme = currentTheme === 'light' ? 'dark' : 'light';
      localStorage.setItem('memoriaTheme', currentTheme);
      applyTheme(currentTheme);
    });
  }
});