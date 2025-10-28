(() => {
  const form = document.getElementById('appointmentForm');
  const msgEl = document.getElementById('formMessage');
  const serviceHidden = document.getElementById('serviceHidden');
  let selectedServiceInfo = null; // { durationMinutes, price }
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
    selectedServiceInfo = info || null;
    // Clear any previous error near the Book button when a selection is made
    if (name) clearMessage();
    // If clearing the selection, also remove any visual selection in the services list
    if (!name) {
      clearServiceSelectionVisuals();
    }
    // If user already picked store/barber/date, refresh slots to reflect selected service duration
    if (storeSelect.value && barberSelect.value && dateInput.value) {
      loadSlots();
    }
  }

  function clearServiceSelectionVisuals() {
    if (!servicesPicker) return;
    // Remove selected row highlight
    servicesPicker.querySelectorAll('.service-item.selected').forEach(el => el.classList.remove('selected'));
    // Reset any selected buttons back to "Επιλογή"
    servicesPicker.querySelectorAll('button[data-name].selected').forEach(btn => {
      btn.classList.remove('selected');
      btn.textContent = 'Επιλογή';
    });
  }

  async function loadServices(storeOverride) {
    if (!servicesPicker) return;
    try {
      const params = new URLSearchParams();
      const store = storeOverride || storeSelect?.value || 'Nikaia';
      if (store) params.set('store', store);
      const res = await fetch('/appointments/services' + (params.toString() ? ('?' + params.toString()) : ''));
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
        'Nikaia': 'Ολύμπου 11, Νίκαια',
        'Aigaleo': 'Μαρκ. Μπότσαρη 9, Αιγάλεω'
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
      const anyoneOption = `<option value=\"ANY\">Οποιοσδήποτε Υπάλληλος</option>`;
      barberSelect.innerHTML = '<option value=\"\" disabled>Choose a barber…</option>' +
        anyoneOption +
        barbers.map(b => `<option value=\"${b}\">${b}</option>`).join('');
      barberSelect.disabled = false;
      // Default to Οποιοσδήποτε Υπάλληλος
      barberSelect.value = 'ANY';
    } catch (e) {
      setMessage('Failed to load barbers.', 'error');
    }
  }

  async function loadSlots() {
    const date = dateInput.value;
    const barber = barberSelect.value;
    const store = storeSelect.value || 'Nikaia';
    const duration = selectedServiceInfo?.durationMinutes || null;
    // Guard when store/barber/date are not selected
    if (!store || !barber || !date || !duration) {
      timeSelect.innerHTML = '<option value="" disabled selected>Select a service, barber and date first…</option>';
      timeSelect.disabled = true;
      return;
    }
    timeSelect.disabled = true;
    try {
      const params = new URLSearchParams({ date, barber, store, duration }).toString();
      const res = await fetch(`/appointments/slots?${params}`);
      const slots = await res.json();
      if (!Array.isArray(slots) || slots.length === 0) {
        timeSelect.innerHTML = '<option value="" disabled selected>No times available</option>';
        timeSelect.disabled = true;
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
    // Reload services for the selected store and clear any previous selection
    setSelectedService('', null);
    loadServices(storeSelect.value || 'Nikaia');
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
    if (submitBtn) submitBtn.disabled = true;
    try {
      const res = await fetch('/appointments/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const text = await res.text();
      if (!res.ok) {
        // Handle common cases with clearer guidance
        if (res.status === 409) {
          if ((data.barber === 'ANY') || (data.barber === 'Anyone')) {
            setMessage(text || 'No available barber at that time. Please pick another time or choose a specific barber.', 'error');
          } else {
            setMessage(text || 'Selected time is no longer available for that barber. Please choose another time.', 'error');
          }
          // Refresh slots to reflect up-to-date availability
          await loadSlots();
        } else if (res.status === 400) {
          setMessage(text || 'Please check your details and try again.', 'error');
        } else if (res.status === 500) {
          setMessage(text || 'Server error during booking. Please try again.', 'error');
        } else {
          setMessage(text || 'Booking failed', 'error');
        }
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
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  setMinDateToday();
  // Initialize selects with guidance text
  timeSelect.innerHTML = '<option value="" disabled selected>Select a service, barber and date first…</option>';
  timeSelect.disabled = true;
  barberSelect.disabled = true;
  // Reset all form fields on page load/refresh
  function resetFormState() {
    try { form?.reset(); } catch {}
    clearMessage();
    setSelectedService('', null);
    // Reset selects explicitly
    if (storeSelect) storeSelect.value = '';
    if (barberSelect) {
      barberSelect.disabled = true;
      barberSelect.innerHTML = '<option value="" disabled selected>Choose a barber…</option>';
    }
    if (dateInput) dateInput.value = '';
    if (timeSelect) {
      timeSelect.disabled = true;
  timeSelect.innerHTML = '<option value="" disabled selected>Select a service, barber and date first…</option>';
    }
  }
  resetFormState();
  loadStores();
  loadServices('Nikaia');

  // Ensure no preselected service (in case of browser autofill/back nav)
  if (serviceHidden) serviceHidden.value = '';
  // Also clear any visual selection on initial load and when navigating back to the page
  clearServiceSelectionVisuals();
  window.addEventListener('pageshow', () => {
    // In case of bfcache restore, ensure UI reflects no selection
    resetFormState();
    if (!serviceHidden.value) clearServiceSelectionVisuals();
  });
  // Keep Book button enabled so users see inline error if they haven't selected a service
})();
