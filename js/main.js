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

  // --- 2. ELEMEN MUNCUL SAAT DI-SCROLL ---
  // Pengguna yang memilih "kurangi animasi" langsung melihat semua isi tanpa efek.
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealElements = document.querySelectorAll('.reveal');
  
  if (!reduceMotion) {
    revealElements.forEach(el => {
      el.classList.add('opacity-0', 'translate-y-10', 'transition-all', 'duration-700', 'ease-out');
    });

    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('opacity-0', 'translate-y-10');
          entry.target.classList.add('opacity-100', 'translate-y-0');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

    revealElements.forEach(el => revealObserver.observe(el));
  }

  // --- 3. TIMELINE ANIMATION ---
  const timelineContainer = document.querySelector('.timeline-container');
  const timelineProgress = document.querySelector('.timeline-progress');
  const timelineCards = document.querySelectorAll('.timeline-card');

  // Setup awal: sembunyikan kartu berdasarkan kiri/kanan
  if (!reduceMotion) timelineCards.forEach(card => {
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

  if (!reduceMotion) timelineCards.forEach(card => cardObserver.observe(card));

  // --- 3B. GALERI: PERBESAR FOTO ---
  const galleryButtons = [...document.querySelectorAll('#galleryGrid [data-gallery-index]')];
  const lightbox = document.getElementById('galleryLightbox');

  if (galleryButtons.length && lightbox) {
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxCaption = document.getElementById('lightboxCaption');
    const photos = galleryButtons.map((button) => {
      const img = button.querySelector('img');
      const large = img.srcset.split(',').map((s) => s.trim().split(' ')[0]).pop();
      return { src: large, alt: img.alt, caption: button.querySelector('span p')?.textContent.trim() || '' };
    });
    let current = 0;
    let lastTrigger = null;

    const showPhoto = (index) => {
      current = (index + photos.length) % photos.length;
      lightboxImg.src = photos[current].src;
      lightboxImg.alt = photos[current].alt;
      const nomor = `${current + 1}/${photos.length}`;
      lightboxCaption.textContent = photos[current].caption ? `${photos[current].caption} · ${nomor}` : nomor;
    };
    const openLightbox = (index, trigger) => {
      lastTrigger = trigger;
      showPhoto(index);
      lightbox.classList.remove('hidden');
      lightbox.classList.add('flex');
      document.body.classList.add('overflow-hidden');
      document.getElementById('lightboxClose').focus();
    };
    const closeLightbox = () => {
      if (lightbox.classList.contains('hidden')) return;
      lightbox.classList.add('hidden');
      lightbox.classList.remove('flex');
      document.body.classList.remove('overflow-hidden');
      if (lastTrigger) lastTrigger.focus();
    };

    galleryButtons.forEach((button) => {
      button.addEventListener('click', () => openLightbox(Number(button.dataset.galleryIndex), button));
    });
    document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
    document.getElementById('lightboxPrev').addEventListener('click', () => showPhoto(current - 1));
    document.getElementById('lightboxNext').addEventListener('click', () => showPhoto(current + 1));
    // Klik di area gelap (bukan di foto atau tombol) menutup tampilan.
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (lightbox.classList.contains('hidden')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') showPhoto(current - 1);
      if (e.key === 'ArrowRight') showPhoto(current + 1);
    });

    // Geser foto di HP
    let touchX = null;
    lightbox.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    lightbox.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) showPhoto(current + (dx < 0 ? 1 : -1));
      touchX = null;
    });
  }

  // --- 4. CAROUSEL DRESS CODE ---
  const dressCarousel = document.getElementById('dressCarousel');
  const dressPrev = document.getElementById('dressPrev');
  const dressNext = document.getElementById('dressNext');
  const dressCount = document.getElementById('dressCount');

  if (dressCarousel && dressPrev && dressNext && dressCount) {
    const cards = dressCarousel.children;

    const getLayout = () => {
      const gap = parseFloat(getComputedStyle(dressCarousel).columnGap) || 0;
      const step = cards[0].getBoundingClientRect().width + gap;
      return { gap, step, visible: Math.max(1, Math.round((dressCarousel.clientWidth + gap) / step)) };
    };

    const updateDressNav = () => {
      const { step, visible } = getLayout();
      const first = Math.round(dressCarousel.scrollLeft / step);
      const last = Math.min(cards.length, first + visible);
      dressCount.textContent = `${first + 1}–${last} dari ${cards.length}`;
      dressPrev.disabled = dressCarousel.scrollLeft <= 1;
      dressNext.disabled = dressCarousel.scrollLeft + dressCarousel.clientWidth >= dressCarousel.scrollWidth - 1;
    };

    const slideDress = (direction) => {
      const { gap } = getLayout();
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      dressCarousel.scrollBy({ left: direction * (dressCarousel.clientWidth + gap), behavior: reduceMotion ? 'auto' : 'smooth' });
    };

    dressPrev.addEventListener('click', () => slideDress(-1));
    dressNext.addEventListener('click', () => slideDress(1));
    dressCarousel.addEventListener('scroll', updateDressNav, { passive: true });
    window.addEventListener('resize', updateDressNav);
    updateDressNav();
  }

  // --- 5. COUNTDOWN TIMER ---
  // Jam mulai dan selesai acara diatur di js/config.js
  const eventStart = new Date(EVENT_INFO.mulai).getTime();
  const eventEnd = new Date(EVENT_INFO.selesai).getTime();

  const cdDays = document.getElementById('cd-days');
  const cdHours = document.getElementById('cd-hours');
  const cdMins = document.getElementById('cd-mins');
  const cdSecs = document.getElementById('cd-secs');
  const cdTitle = document.getElementById('cdTitle');
  const cdSubtitle = document.getElementById('cdSubtitle');
  const cdGrid = document.getElementById('cdGrid');
  const calendarButton = document.querySelector('#eventActions [data-event-action="calendar"]');

  if (cdDays && cdTitle && cdGrid) {
    const pad = (value) => String(value).padStart(2, '0');
    let countdownInterval;

    const showStatus = (title, subtitle) => {
      cdTitle.textContent = title;
      cdSubtitle.textContent = subtitle;
      cdGrid.classList.add('hidden');
    };

    const tick = () => {
      const now = Date.now();

      if (now >= eventEnd) {
        showStatus('Terima Kasih', 'Terima kasih telah menjadi bagian dari kenangan Memoria.');
        if (calendarButton) calendarButton.classList.add('hidden');
        clearInterval(countdownInterval);
        return;
      }
      if (now >= eventStart) {
        showStatus('Acara Sedang Berlangsung', 'Sampai jumpa di Aula FEB, Telkom University!');
        return;
      }

      const distance = eventStart - now;
      cdDays.textContent = pad(Math.floor(distance / (1000 * 60 * 60 * 24)));
      cdHours.textContent = pad(Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
      cdMins.textContent = pad(Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)));
      cdSecs.textContent = pad(Math.floor((distance % (1000 * 60)) / 1000));
    };

    tick();
    countdownInterval = setInterval(tick, 1000);
  }

  // --- 6. TOMBOL KEMBALI KE ATAS ---
  const scrollTopBtn = document.getElementById('scrollTopBtn');
  
  if (scrollTopBtn) {
    let scrollTicking = false;
    const updateScrollTop = () => {
      const show = window.scrollY > 500;
      scrollTopBtn.classList.toggle('opacity-0', !show);
      scrollTopBtn.classList.toggle('translate-y-10', !show);
      scrollTopBtn.classList.toggle('pointer-events-none', !show);
      scrollTicking = false;
    };
    window.addEventListener('scroll', () => {
      if (!scrollTicking) {
        scrollTicking = true;
        requestAnimationFrame(updateScrollTop);
      }
    }, { passive: true });

    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  // --- 7. BAGIKAN UNDANGAN ---
  const shareButtons = document.querySelectorAll('[data-share]');
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

  shareButtons.forEach((shareBtn) => {
    shareBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      const shareData = {
        title: 'Undangan Memoria - Hima SIKC',
        text: 'Merayakan perjalanan, menciptakan kenangan yang abadi. Yuk hadiri Memoria!',
        url: window.location.origin + window.location.pathname
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
  });

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
});