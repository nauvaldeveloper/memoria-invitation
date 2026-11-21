// ==========================================
// ISIAN BEBERAPA TEMAN (tanpa batas)
// Dipakai di form RSVP dan di halaman tiket (tambah teman).
// ==========================================
(function () {
  const INPUT = 'w-full bg-memoria-black/50 border border-memoria-gold/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-memoria-gold focus:ring-1 focus:ring-memoria-gold transition-all duration-300 text-base';
  const LABEL = 'block text-memoria-gold text-xs tracking-widest uppercase mb-2 font-semibold';
  let uid = 0;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function createBlock(onRemove) {
    const n = ++uid;
    const block = el('div', 'rounded-lg border border-memoria-gold/20 bg-black/20 p-3 sm:p-4 space-y-4');
    block.dataset.guestBlock = '';

    const header = el('div', 'flex items-center justify-between gap-3');
    const title = el('p', 'text-sm font-semibold text-memoria-gold-light');
    const remove = el('button', 'text-xs font-semibold text-gray-400 hover:text-red-400 transition-colors', 'Hapus');
    remove.type = 'button';
    remove.addEventListener('click', () => onRemove(block));
    header.append(title, remove);

    const namaWrap = el('div');
    const namaLabel = el('label', LABEL, 'Nama Lengkap Teman');
    const nama = el('input', INPUT);
    nama.type = 'text';
    nama.maxLength = 100;
    nama.autocomplete = 'off';
    nama.placeholder = 'Masukkan nama temanmu';
    nama.id = `guestNama${n}`;
    nama.dataset.field = 'nama';
    namaLabel.htmlFor = nama.id;
    namaWrap.append(namaLabel, nama);

    const asalWrap = el('div', 'relative');
    const asalLabel = el('label', LABEL, 'Asal Teman');
    const asal = el('select', `${INPUT} pr-11 appearance-none cursor-pointer`);
    asal.id = `guestAsal${n}`;
    asal.dataset.field = 'asal';
    asalLabel.htmlFor = asal.id;
    [['', '-- Pilih Asal --'], ['telkom', 'Mahasiswa Telkom (prodi lain)'], ['kampus_lain', 'Mahasiswa kampus lain'], ['umum', 'Umum']].forEach(([value, text]) => {
      const option = el('option', '', text);
      option.value = value;
      if (!value) { option.disabled = true; option.selected = true; }
      asal.appendChild(option);
    });
    const chevron = el('div', 'absolute right-4 top-[2.4rem] pointer-events-none text-memoria-gold');
    chevron.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>';
    asalWrap.append(asalLabel, asal, chevron);

    const instansiWrap = el('div', 'hidden');
    const instansiLabel = el('label', LABEL, 'Nama Kampus');
    const instansi = el('input', INPUT);
    instansi.type = 'text';
    instansi.maxLength = 100;
    instansi.autocomplete = 'off';
    instansi.id = `guestInstansi${n}`;
    instansi.dataset.field = 'instansi';
    instansiLabel.htmlFor = instansi.id;
    instansiWrap.append(instansiLabel, instansi);

    asal.addEventListener('change', () => {
      const value = asal.value;
      instansiWrap.classList.toggle('hidden', value !== 'kampus_lain' && value !== 'umum');
      instansiLabel.textContent = value === 'kampus_lain' ? 'Nama Kampus' : 'Instansi / Pekerjaan (opsional)';
      instansi.placeholder = value === 'kampus_lain' ? 'Contoh: Universitas Padjadjaran' : 'Boleh dikosongkan';
    });

    block.append(header, namaWrap, asalWrap, instansiWrap);
    return { block, title, remove, nama, asal, instansi };
  }

  /**
   * container: tempat blok teman. addButton: tombol "+ Tambah teman".
   * Mengembalikan { values, validate, reset, count }.
   */
  window.GuestFields = function (container, addButton) {
    const blocks = [];

    function renumber() {
      blocks.forEach((b, i) => {
        b.title.textContent = `Teman ${i + 1}`;
        b.remove.classList.toggle('hidden', blocks.length === 1);
      });
    }

    function add() {
      const b = createBlock((node) => {
        const i = blocks.findIndex((x) => x.block === node);
        if (i !== -1) blocks.splice(i, 1);
        node.remove();
        renumber();
      });
      blocks.push(b);
      container.appendChild(b.block);
      renumber();
      return b;
    }

    function reset() {
      blocks.splice(0, blocks.length);
      container.replaceChildren();
      add();
    }

    function values() {
      return blocks.map((b) => ({
        nama: b.nama.value.replace(/\s+/g, ' ').trim(),
        asal: b.asal.value,
        instansi: b.instansi.value.replace(/\s+/g, ' ').trim()
      }));
    }

    // Mengembalikan pesan error pertama (dan memfokuskan isiannya), atau null kalau semua valid.
    function validate() {
      const list = values();
      for (let i = 0; i < list.length; i++) {
        const label = blocks.length > 1 ? ` ke-${i + 1}` : '';
        if (!list[i].nama) { blocks[i].nama.focus(); return `Nama teman${label} wajib diisi.`; }
        if (!list[i].asal) { blocks[i].asal.focus(); return `Pilih asal teman${label}.`; }
        if (list[i].asal === 'kampus_lain' && !list[i].instansi) { blocks[i].instansi.focus(); return `Nama kampus teman${label} wajib diisi.`; }
      }
      return null;
    }

    addButton.addEventListener('click', () => add().nama.focus());
    reset();
    return { values, validate, reset, count: () => blocks.length };
  };
})();
