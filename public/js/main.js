(() => {
  const form = document.getElementById('appointmentForm');
  const msgEl = document.getElementById('formMessage');
  const serviceHidden = document.getElementById('serviceHidden');
  // Track multiple selected services
  let selectedServices = []; // [{ name, durationMinutes, price }]
  const servicesPicker = document.getElementById('servicesPicker');
  const selectedServiceNote = document.getElementById('selectedServiceNote');
  const storePicker = document.getElementById('storePicker');
  const storeHint = document.getElementById('storeHint');
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

  function updateSelectedServices(nextList) {
    selectedServices = nextList || [];
    if (!serviceHidden) return;
    // Store comma-separated names for backend; keep underlying API unchanged
    serviceHidden.value = selectedServices.map(s => s.name).join(', ');
    if (selectedServiceNote) {
      if (selectedServices.length) {
  const totalMin = selectedServices.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  const names = selectedServices.map(s => s.name).join(' + ');
  selectedServiceNote.textContent = `${names} • ${totalMin} min • € ${totalPrice}`;
        selectedServiceNote.className = 'msg';
        clearMessage();
      } else {
        selectedServiceNote.textContent = '';
      }
    }
    // Refresh slots to reflect new total duration
    if (storeSelect.value && barberSelect.value && dateInput.value) {
      loadSlots();
    }
  }

  function clearServiceSelectionVisuals() {
    if (!servicesPicker) return;
    // Remove selected row highlight
    servicesPicker.querySelectorAll('.service-item.selected').forEach(el => el.classList.remove('selected'));
  // Reset any selected buttons back to "Select"
    servicesPicker.querySelectorAll('button[data-name].selected').forEach(btn => {
      btn.classList.remove('selected');
  btn.textContent = 'Select';
    });
  }

  async function loadServices(storeOverride) {
    if (!servicesPicker) return;
    try {
      const params = new URLSearchParams();
      const store = storeOverride || storeSelect?.value;
      if (!store) {
        servicesPicker.textContent = 'Please choose a store first.';
        return;
      }
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
          const durLabel = item.durationMinutes >= 60 ? `${Math.floor(item.durationMinutes/60)}h${item.durationMinutes%60 ? ` ${item.durationMinutes%60}m` : ''}` : `${item.durationMinutes}m`;
          row.innerHTML = `
            <div>
              <div class="service-name">${item.name}</div>
              <div class="service-meta">${durLabel} · View details</div>
            </div>
            <div class="service-price">€ ${item.price}</div>
            <div><button type="button" class="btn btn-outline btn-select" data-name="${item.name}" data-duration="${item.durationMinutes}" data-price="${item.price}">Select</button></div>
          `;
          listWrap.appendChild(row);
        });
        // Reflect any current multi-selection in the UI
        const selectedNames = new Set(selectedServices.map(s => s.name));
        if (selectedNames.size) {
          [...listWrap.querySelectorAll('button[data-name]')].forEach(btn => {
            if (selectedNames.has(btn.dataset.name)) {
              btn.classList.add('selected');
              btn.textContent = 'Selected';
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
        const info = { name: btn.dataset.name, durationMinutes: Number(btn.dataset.duration), price: Number(btn.dataset.price) };
        const isSelected = btn.classList.contains('selected');
        if (isSelected) {
          // Remove from selection
          btn.classList.remove('selected');
          btn.textContent = 'Select';
          btn.closest('.service-item')?.classList.remove('selected');
          updateSelectedServices(selectedServices.filter(s => s.name !== info.name));
          return;
        }
        // Add to selection
        btn.classList.add('selected');
  btn.textContent = 'Selected';
        btn.closest('.service-item')?.classList.add('selected');
        updateSelectedServices([...selectedServices, info]);
        // Do not auto-scroll the page when a service is selected
      });
    } catch (e) {
      servicesPicker.textContent = 'Could not load services.';
    }
  }

  async function loadStores() {
    // Only populate options if the element is a visible <select>
    if (!storeSelect || storeSelect.tagName !== 'SELECT') return;
    try {
      const res = await fetch('/appointments/stores');
      const stores = await res.json();
      const STORE_LABELS = { 'Nikaia': 'Store 1', 'Aigaleo': 'Store 2' };
      storeSelect.innerHTML = '<option value="" disabled selected>Choose a store…</option>' +
        stores.map(s => `<option value="${s}">${STORE_LABELS[s] || s}</option>`).join('');
    } catch (e) { setMessage('Failed to load stores.', 'error'); }
  }

  async function loadBarbers() {
    try {
      const store = storeSelect.value || 'Nikaia';
      const res = await fetch('/appointments/barbers?' + new URLSearchParams({ store }));
      const barbers = await res.json();
  const anyoneOption = `<option value=\"ANY\">Any Barber</option>`;
      // Display enumerated barber labels (Barber 1, Barber 2, ...), keep original values for backend queries
      barberSelect.innerHTML = '<option value=\"\" disabled>Choose a barber…</option>' +
        anyoneOption +
        barbers.map((b, i) => `<option value=\"${b}\">Barber ${i + 1}</option>`).join('');
      barberSelect.disabled = false;
  // Default to Any Barber
      barberSelect.value = 'ANY';
    } catch (e) {
      setMessage('Failed to load barbers.', 'error');
    }
  }

  async function loadSlots() {
    const date = dateInput.value;
    const barber = barberSelect.value;
    const store = storeSelect.value || 'Nikaia';
    // If no service selected yet, use a sensible default (30m) so users can pick a time earlier
    const duration = selectedServices.length ? selectedServices.reduce((sum, s) => sum + (Number(s.durationMinutes)||0), 0) : 30;
    // Guard when store/barber/date are not selected
    if (!store || !barber || !date) {
      timeSelect.innerHTML = '<option value="" disabled selected>Select a barber and date first…</option>';
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

  if (storeSelect && storeSelect.tagName === 'SELECT') {
    storeSelect.addEventListener('change', () => {
      barberSelect.disabled = true;
      barberSelect.innerHTML = '<option value="" disabled selected>Choose a barber…</option>';
      loadBarbers();
      timeSelect.innerHTML = '<option value="" disabled selected>Select a barber and date first…</option>';
      timeSelect.disabled = true;
      updateSelectedServices([]);
      loadServices(storeSelect.value);
    });
  }
  barberSelect?.addEventListener('change', loadSlots);
  dateInput?.addEventListener('change', loadSlots);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!storeSelect?.value) {
      setMessage('Choose a store to continue', 'error');
      document.getElementById('choose-store')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (!data.service) {
      setMessage('Select one or more services to book', 'error');
      // Nudge the user to the services section if it's off-screen
      document.getElementById('services')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

  setMessage('Booking your appointment…', 'info');
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
  // Clear selections immediately for visual feedback
  form.reset();
  updateSelectedServices([]);
  clearServiceSelectionVisuals();
  timeSelect.disabled = true;
  barberSelect.disabled = true;
  barberSelect.innerHTML = '<option value="" disabled selected>Choose a barber…</option>';
  // Soft refresh so the page returns to initial state (default store preselected)
  setTimeout(() => { window.location.reload(); }, 900);
    } catch (e) {
  setMessage('Network error while booking.', 'error');
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
  updateSelectedServices([]);
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

  // New: store picker behavior
  storePicker?.addEventListener('click', (e) => {
    const card = e.target.closest('.store-card');
    if (!card) return;
    const chosen = card.dataset.store;
    // Visual selection
    storePicker.querySelectorAll('.store-card').forEach(el => el.classList.toggle('selected', el === card));
    // Reflect into the booking form
    if (storeSelect) {
      storeSelect.value = chosen;
      // Optional: lock the select to avoid accidental change
      // storeSelect.disabled = true;
    }
    // Load dependent data
    updateSelectedServices([]);
    loadServices(chosen);
    loadBarbers();
    // Nudge user to the services step
    document.getElementById('services')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (storeHint) storeHint.textContent = '';
  });

  // Ensure no preselected service (in case of browser autofill/back nav)
  if (serviceHidden) serviceHidden.value = '';
  // Also clear any visual selection on initial load and when navigating back to the page
  clearServiceSelectionVisuals();
  window.addEventListener('pageshow', () => {
    // In case of bfcache restore, ensure UI reflects no selection
    resetFormState();
    if (!serviceHidden.value) clearServiceSelectionVisuals();
    // Re-apply default store if needed after reset
    try { selectDefaultStoreIfMissing(); } catch {}
  });
  // Keep Book button enabled so users see inline error if they haven't selected a service
  
  // Helper: preselect Store 1 (Nikaia) if none selected
  function selectDefaultStoreIfMissing() {
    const defaultStore = 'Nikaia';
    if (!storeSelect) return;
    if (!storeSelect.value) {
      storeSelect.value = defaultStore;
      // visually mark the card
      const defaultCard = storePicker?.querySelector('.store-card[data-store="Nikaia"]');
      if (defaultCard && storePicker) {
        storePicker.querySelectorAll('.store-card').forEach(el => el.classList.toggle('selected', el === defaultCard));
      }
      // load dependent data without auto-scrolling
      updateSelectedServices([]);
      loadServices(defaultStore);
      loadBarbers();
      if (storeHint) storeHint.textContent = '';
    }
  }

  // Initial default selection
  selectDefaultStoreIfMissing();

  // Randomize a few subtle white glows per section so they are not fixed
  function rand(min, max) { return Math.random() * (max - min) + min; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function buildRandGlows(el, minCount = 2, maxCount = 4) {
    try {
      const rect = el.getBoundingClientRect();
      const count = Math.floor(rand(minCount, maxCount + 1));
      const parts = [];
      for (let i = 0; i < count; i++) {
        const xPct = clamp(Math.round(rand(-5, 105)), -5, 105);
        const yPct = clamp(Math.round(rand(-5, 105)), -5, 105);
        const base = Math.max(rect.width, rect.height);
        const rx = Math.round(rand(base * 0.14, base * 0.28));
        const ry = Math.round(rand(base * 0.08, base * 0.20));
        const alpha = rand(0.028, 0.065).toFixed(3);
        parts.push(`radial-gradient(${rx}px ${ry}px at ${xPct}% ${yPct}%, rgba(255,255,255,${alpha}), transparent 70%)`);
      }
      el.style.setProperty('--rand-glows', parts.join(', '));
    } catch {}
  }
  function applySectionGlows() {
    document.querySelectorAll('.masthead, .hero.full').forEach(el => buildRandGlows(el));
  }
  let glowDebounce;
  window.addEventListener('resize', () => { clearTimeout(glowDebounce); glowDebounce = setTimeout(applySectionGlows, 150); });
  if (document.readyState === 'complete' || document.readyState === 'interactive') applySectionGlows();
  else window.addEventListener('DOMContentLoaded', applySectionGlows, { once: true });
})();
