// ==========================================
// ISIAN BEBERAPA TEMAN (tanpa batas, cukup nama)
// Dipakai di form RSVP dan di halaman tiket (tambah teman).
// ==========================================
(function () {
  const INPUT = 'w-full bg-memoria-black/50 border border-memoria-gold/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-memoria-gold focus:ring-1 focus:ring-memoria-gold transition-all duration-300 text-base';
  let uid = 0;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function createRow(onRemove) {
    const n = ++uid;
    const row = el('div', 'flex items-center gap-2');
    row.dataset.guestBlock = '';

    const label = el('label', 'sr-only');
    const nama = el('input', INPUT);
    nama.type = 'text';
    nama.maxLength = 100;
    nama.autocomplete = 'off';
    nama.id = `guestNama${n}`;
    nama.dataset.field = 'nama';
    label.htmlFor = nama.id;

    const remove = el('button', 'shrink-0 w-11 h-11 flex items-center justify-center rounded-lg border border-white/15 text-gray-400 hover:border-red-400 hover:text-red-300 transition-colors');
    remove.type = 'button';
    remove.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18"/></svg>';
    remove.addEventListener('click', () => onRemove(row));

    row.append(label, nama, remove);
    return { block: row, label, nama, remove };
  }

  /**
   * container: tempat isian nama teman. addButton: tombol "+ Tambah teman".
   * Mengembalikan { values, validate, reset, count }.
   */
  window.GuestFields = function (container, addButton) {
    const rows = [];

    function renumber() {
      rows.forEach((r, i) => {
        r.label.textContent = `Nama teman ${i + 1}`;
        r.nama.placeholder = `Nama lengkap teman ${i + 1}`;
        r.remove.setAttribute('aria-label', `Hapus teman ${i + 1}`);
        r.remove.classList.toggle('hidden', rows.length === 1);
      });
    }

    function add() {
      const r = createRow((node) => {
        const i = rows.findIndex((x) => x.block === node);
        if (i !== -1) rows.splice(i, 1);
        node.remove();
        renumber();
      });
      rows.push(r);
      container.appendChild(r.block);
      renumber();
      return r;
    }

    function reset() {
      rows.splice(0, rows.length);
      container.replaceChildren();
      add();
    }

    function values() {
      return rows.map((r) => ({ nama: r.nama.value.replace(/\s+/g, ' ').trim() }));
    }

    // Mengembalikan pesan error pertama (dan memfokuskan isiannya), atau null kalau semua valid.
    function validate() {
      const list = values();
      for (let i = 0; i < list.length; i++) {
        if (!list[i].nama) {
          rows[i].nama.focus();
          return rows.length > 1 ? `Nama teman ke-${i + 1} wajib diisi.` : 'Nama teman wajib diisi.';
        }
      }
      return null;
    }

    addButton.addEventListener('click', () => add().nama.focus());
    reset();
    return { values, validate, reset, count: () => rows.length };
  };
})();
