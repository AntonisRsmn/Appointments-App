(() => {
  const form = document.getElementById('appointmentForm');
  const msgEl = document.getElementById('formMessage');
  const serviceHidden = document.getElementById('serviceHidden');
  const servicesPicker = document.getElementById('servicesPicker');
  const selectedServiceNote = document.getElementById('selectedServiceNote');
  const storeSelect = document.getElementById('storeSelect');
  const barberSelect = document.getElementById('barberSelect');
  const dateInput = document.getElementById('dateInput');
  const timeSelect = document.getElementById('timeSelect');
  const submitBtn = form?.querySelector('button[type="submit"]');

  // Footer year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  function setMessage(text, type = 'info') {
    msgEl.textContent = text;
    msgEl.className = `msg ${type}`;
  }

  function clearMessage() {
    if (!msgEl) return;
    msgEl.textContent = '';
    msgEl.className = 'msg';
  }

  function setMinDateToday() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.min = `${yyyy}-${mm}-${dd}`;
  }

  function setSelectedService(name, info) {
    if (!serviceHidden) return;
    serviceHidden.value = name || '';
    if (selectedServiceNote) {
      if (name) {
        selectedServiceNote.textContent = `${name} • ${info?.durationMinutes || 30} λεπτά • € ${info?.price ?? ''}`;
        selectedServiceNote.className = 'msg';
      } else {
        selectedServiceNote.textContent = '';
      }
    }
    // Clear any previous error near the Book button when a selection is made
    if (name) clearMessage();
  }

  async function loadServices() {
    if (!servicesPicker) return;
    try {
      const res = await fetch('/appointments/services');
      const byCat = await res.json();
      const cats = Object.keys(byCat);
      if (!cats.length) return;
      const catList = document.createElement('div');
      catList.className = 'service-cats';
      cats.forEach((c, i) => {
        const el = document.createElement('div');
        el.className = 'service-cat' + (i === 0 ? ' active' : '');
        el.dataset.cat = c;
        el.innerHTML = `<span>${c}</span><span class="count">(${byCat[c].length})</span>`;
        catList.appendChild(el);
      });

      const listWrap = document.createElement('div');
      listWrap.className = 'service-list';

      function renderCat(cat) {
        listWrap.innerHTML = '';
        (byCat[cat] || []).forEach(item => {
          const row = document.createElement('div');
          row.className = 'service-item';
          row.innerHTML = `
            <div>
              <div class="service-name">${item.name}</div>
              <div class="service-meta">${item.durationMinutes >= 60 ? `${Math.floor(item.durationMinutes/60)} ώρα ${item.durationMinutes%60 ? item.durationMinutes%60 + ' λεπτά' : ''}` : `${item.durationMinutes} λεπτά`} · Προβολή Λεπτομερειών</div>
            </div>
            <div class="service-price">€ ${item.price}</div>
            <div><button type="button" class="btn btn-outline btn-select" data-name="${item.name}" data-duration="${item.durationMinutes}" data-price="${item.price}">Επιλογή</button></div>
          `;
          listWrap.appendChild(row);
        });

        // If we already have a selected service, reflect it in the UI
        const current = serviceHidden?.value;
        if (current) {
          [...listWrap.querySelectorAll('button[data-name]')].forEach(btn => {
            if (btn.dataset.name === current) {
              btn.classList.add('selected');
              btn.textContent = 'Επιλεγμένο';
              btn.closest('.service-item')?.classList.add('selected');
            }
          });
        }
      }

      function setActive(cat) {
        [...catList.children].forEach(x => x.classList.toggle('active', x.dataset.cat === cat));
        renderCat(cat);
      }

      catList.addEventListener('click', (e) => {
        const el = e.target.closest('.service-cat');
        if (!el) return;
        setActive(el.dataset.cat);
      });

      servicesPicker.replaceChildren(catList, listWrap);
      setActive(cats[0]);

      listWrap.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-name]');
        if (!btn) return;
        const info = { durationMinutes: Number(btn.dataset.duration), price: Number(btn.dataset.price) };
        // Determine if clicking the already-selected service (toggle off)
        const prevBtn = listWrap.querySelector('button[data-name].selected');
        const alreadySelected = prevBtn && prevBtn === btn;
        // Clear previous selection styling
        const prevRow = listWrap.querySelector('.service-item.selected');
        prevRow?.classList.remove('selected');
        if (prevBtn) { prevBtn.classList.remove('selected'); prevBtn.textContent = 'Επιλογή'; }

        if (alreadySelected) {
          // Toggle off: clear selection
          setSelectedService('', null);
          return;
        }

        // Apply new selection styling
        btn.classList.add('selected');
        btn.textContent = 'Επιλεγμένο';
        btn.closest('.service-item')?.classList.add('selected');

        setSelectedService(btn.dataset.name, info);
        document.getElementById('appointmentForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (e) {
      servicesPicker.textContent = 'Could not load services.';
    }
  }

  async function loadStores() {
    try {
      const res = await fetch('/appointments/stores');
      const stores = await res.json();
      const STORE_LABELS = {
        'Nikaia': 'Olympou 11, Nikea 184 54',
        'Aigaleo': 'Mark. Mpotsari 9, Egaleo 122 41'
      };
      storeSelect.innerHTML = '<option value="" disabled selected>Choose a store…</option>' +
        stores.map(s => `<option value="${s}">${STORE_LABELS[s] || s}</option>`).join('');
    } catch (e) {
      setMessage('Failed to load stores.', 'error');
    }
  }

  async function loadBarbers() {
    try {
      const store = storeSelect.value || 'Nikaia';
      const res = await fetch('/appointments/barbers?' + new URLSearchParams({ store }));
      const barbers = await res.json();
      barberSelect.innerHTML = '<option value="" disabled selected>Choose a barber…</option>' +
        barbers.map(b => `<option value="${b}">${b}</option>`).join('');
      barberSelect.disabled = false;
    } catch (e) {
      setMessage('Failed to load barbers.', 'error');
    }
  }

  async function loadSlots() {
    const date = dateInput.value;
    const barber = barberSelect.value;
    const store = storeSelect.value || 'Nikaia';
    // Guard when store/barber/date are not selected
    if (!store || !barber || !date) {
      timeSelect.innerHTML = '<option value="" disabled selected>Select a barber and date first…</option>';
      timeSelect.disabled = true;
      return;
    }
    timeSelect.disabled = true;
    try {
      const params = new URLSearchParams({ date, barber, store }).toString();
      const res = await fetch(`/appointments/slots?${params}`);
      const slots = await res.json();
      if (!Array.isArray(slots) || slots.length === 0) {
        timeSelect.innerHTML = '<option value="" disabled selected>No times available</option>';
        timeSelect.disabled = false;
      } else {
        timeSelect.innerHTML = '<option value="" disabled selected>Select a time…</option>' +
          slots.map(s => `<option value="${s}">${s}</option>`).join('');
        timeSelect.disabled = false;
      }
    } catch (e) {
      setMessage('Failed to load available time slots.', 'error');
      timeSelect.innerHTML = '<option value="" disabled selected>Could not load times</option>';
      timeSelect.disabled = false;
    }
  }

  storeSelect?.addEventListener('change', () => {
    barberSelect.disabled = true;
    barberSelect.innerHTML = '<option value="" disabled selected>Choose a barber…</option>';
    loadBarbers();
    timeSelect.innerHTML = '<option value="" disabled selected>Select a barber and date first…</option>';
    timeSelect.disabled = true;
  });
  barberSelect?.addEventListener('change', loadSlots);
  dateInput?.addEventListener('change', loadSlots);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.service) {
      setMessage('Select a service to book', 'error');
      // Nudge the user to the services section if it's off-screen
      document.getElementById('services')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setMessage('Κλείνουμε το ραντεβού σας…', 'info');
    try {
      const res = await fetch('/appointments/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const text = await res.text();
      if (!res.ok) {
        setMessage(text || 'Booking failed', 'error');
        return;
      }
      setMessage(text, 'success');
      // Refresh slots to reflect the newly booked time
      await loadSlots();
      form.reset();
      setSelectedService('', null);
      timeSelect.disabled = true;
      barberSelect.disabled = true;
      barberSelect.innerHTML = '<option value="" disabled selected>Choose a barber…</option>';
    } catch (e) {
      setMessage('Σφάλμα δικτύου κατά την κράτηση.', 'error');
    }
  });

  setMinDateToday();
  // Initialize selects with guidance text
  timeSelect.innerHTML = '<option value="" disabled selected>Select a barber and date first…</option>';
  timeSelect.disabled = true;
  barberSelect.disabled = true;
  loadStores();
  loadServices();

  // Ensure no preselected service (in case of browser autofill/back nav)
  if (serviceHidden) serviceHidden.value = '';
  // Keep Book button enabled so users see inline error if they haven't selected a service
})();
