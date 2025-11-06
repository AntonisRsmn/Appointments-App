(() => {
  const STORE_LABELS = {
    'Nikaia': 'Store 1',
    'Aigaleo': 'Store 2'
  };
  const table = document.getElementById('appointmentsTable');
  const tbody = table.querySelector('tbody');
  const filterStore = document.getElementById('filterStore');
  const filterBarber = document.getElementById('filterBarber');
  const filterDate = document.getElementById('filterDate');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnClear = document.getElementById('btnClear');
  const btnCreate = document.getElementById('btnCreate');
  const btnCompleted = document.getElementById('btnCompleted');
  const adminMsg = document.getElementById('adminMsg');

  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // Enumerated labels per store for barbers (Barber 1, Barber 2, ...)
  const BARBER_INDEX = { Nikaia: new Map(), Aigaleo: new Map() };
  async function refreshBarberIndex(store) {
    try {
      const res = await fetch('/appointments/barbers?' + new URLSearchParams({ store }));
      const list = await res.json();
      const map = new Map();
      list.forEach((name, i) => map.set(name, i + 1));
      BARBER_INDEX[store] = map;
    } catch {}
  }
  async function ensureAllBarberIndexes() {
    await Promise.all(['Nikaia', 'Aigaleo'].map(refreshBarberIndex));
  }
  function labelBarber(name, store) {
    if (!name) return '';
    const idx = BARBER_INDEX[store || 'Nikaia']?.get(name);
    return idx ? `Barber ${idx}` : name;
  }

  function fmtDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString();
  }

  function setAdminMsg(text, type = 'info', timeoutMs = 4000) {
    if (!adminMsg) return;
    adminMsg.textContent = text || '';
    adminMsg.className = `msg ${type}`;
    if (text && timeoutMs) {
      clearTimeout(setAdminMsg._t);
      setAdminMsg._t = setTimeout(() => { if (adminMsg.textContent === text) setAdminMsg(''); }, timeoutMs);
    }
  }

  async function extractError(res) {
    let message = '';
    try {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await res.json();
        message = j && (j.error || j.message) || '';
      } else {
        message = await res.text();
      }
    } catch {}
    return message || `Error ${res.status}`;
  }

  function renderRows(items) {
    if (!items || !items.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:#666;">No appointments</td></tr>';
      return;
    }
    tbody.innerHTML = items.map(a => {
      const completed = a.status === 'completed';
      const rowClass = completed ? 'row-completed' : '';
      const status = a.status || 'booked';
      const statusClass = `status-${status}`;
      return `
      <tr class="${rowClass}" data-id="${a._id}">
        <td>${a.date || ''}</td>
        <td>${a.time || ''}</td>
  <td>${STORE_LABELS[a.store || 'Nikaia'] || (a.store || 'Nikaia')}</td>
  <td>${labelBarber(a.barber || '', a.store || 'Nikaia')}</td>
        <td>${a.service || ''}</td>
        <td>${a.name || ''}</td>
        <td>${a.email || ''}</td>
        <td>${a.phone || ''}</td>
        <td class="status-cell"><span class="badge ${statusClass}">${status}</span></td>
        <td class="cell-actions">
          <button class="btn btn-gray" data-action="status" data-status="${completed ? 'booked' : 'completed'}">${completed ? 'Undo' : 'Mark done'}</button>
          <button class="btn" data-action="edit">Edit</button>
        </td>
      </tr>`;
    }).join('');
  }

  async function loadStores() {
    try {
      // If the store select is locked (store-specific admin), set it and disable
      if (filterStore && filterStore.dataset.locked === 'true') {
        const s = filterStore.dataset.store || 'Nikaia';
        filterStore.innerHTML = `<option value="${s}">${STORE_LABELS[s] || s}</option>`;
        filterStore.value = s;
        filterStore.disabled = true;
        return;
      }
      const res = await fetch('/appointments/stores');
      const stores = await res.json();
      if (filterStore) filterStore.innerHTML = '<option value="">All stores</option>' + stores.map(s => `<option value="${s}">${STORE_LABELS[s] || s}</option>`).join('');
      // Build barber index maps for all stores
      await ensureAllBarberIndexes();
    } catch (e) { /* noop */ }
  }

  async function loadBarbers() {
    try {
      const selectedStore = (filterStore && filterStore.value) || '';
      let barbers = [];
      if (selectedStore) {
        // Single store
        const res = await fetch('/appointments/barbers?' + new URLSearchParams({ store: selectedStore }));
        barbers = await res.json();
        const map = new Map();
        barbers.forEach((name, i) => map.set(name, i + 1));
        BARBER_INDEX[selectedStore] = map;
      } else {
        // All stores: union of barbers across every store
        const resStores = await fetch('/appointments/stores');
        const stores = await resStores.json();
        const lists = await Promise.all(stores.map(s => fetch('/appointments/barbers?' + new URLSearchParams({ store: s })).then(r => r.json()).catch(() => [])));
        const set = new Set();
        lists.forEach(arr => arr.forEach(name => set.add(name)));
        barbers = [...set];
        // Build/refresh per-store indexes too
        stores.forEach((s, storeIdx) => {
          const map = new Map();
          (lists[storeIdx] || []).forEach((name, i) => map.set(name, i + 1));
          BARBER_INDEX[s] = map;
        });
      }
      filterBarber.innerHTML = '<option value="">All barbers</option>' +
        barbers.map((b, i) => `<option value="${b}">Barber ${i + 1}</option>`).join('');
    } catch (e) {
      // ignore
    }
  }

  async function loadAppointments() {
    const params = new URLSearchParams();
    if (filterBarber.value) params.set('barber', filterBarber.value);
    if (filterDate.value) params.set('date', filterDate.value);
    if (filterStore && filterStore.value) params.set('store', filterStore.value);
    if (loadAppointments.completedMode) params.set('status', 'completed');

  tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:#666;">Loading…</td></tr>';
    try {
      if (loadAppointments.completedMode) setAdminMsg('Showing completed appointments', 'info', 1500);
      const res = await fetch('/appointments/all' + (params.toString() ? ('?' + params.toString()) : ''));
      let items = await res.json();
      // Enforce client-side guardrails for status filtering to match UX expectations
      if (loadAppointments.completedMode) {
        // Completed view: show only completed
        items = (items || []).filter(a => (a && a.status) === 'completed');
      } else {
        // Default view: hide completed by default
        items = (items || []).filter(a => (a && a.status) !== 'completed');
      }
      // Client-side stable sort to guarantee grouping; within same date+time, newest first
      const keyDate = (x) => x?.date || '';
      const keyTime = (x) => x?.time || '';
      items.sort((a, b) => {
        const d = keyDate(a).localeCompare(keyDate(b));
        if (d !== 0) return d;
        const t = keyTime(a).localeCompare(keyTime(b));
        if (t !== 0) return t;
        const ca = a?.createdAt || a?.updatedAt || '';
        const cb = b?.createdAt || b?.updatedAt || '';
        return String(cb).localeCompare(String(ca));
      });
      renderRows(items);
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:#c00;">Failed to load</td></tr>';
    }
  }
  loadAppointments.completedMode = false;

  btnRefresh?.addEventListener('click', loadAppointments);
  btnClear?.addEventListener('click', () => {
    filterBarber.value = '';
    filterDate.value = '';
    if (filterStore && filterStore.dataset.locked !== 'true') filterStore.value = '';
    loadAppointments.completedMode = false;
    if (btnCompleted) btnCompleted.textContent = 'Completed';
    loadAppointments();
  });
  btnCompleted?.addEventListener('click', () => {
    loadAppointments.completedMode = !loadAppointments.completedMode;
    if (btnCompleted) {
      btnCompleted.textContent = loadAppointments.completedMode ? 'Show All' : 'Completed';
      btnCompleted.setAttribute('aria-pressed', String(loadAppointments.completedMode));
    }
    loadAppointments();
  });
  filterStore?.addEventListener('change', () => { loadBarbers(); loadAppointments(); });
  // Auto-refresh when selecting a specific barber or date
  filterBarber?.addEventListener('change', loadAppointments);
  filterDate?.addEventListener('change', loadAppointments);

  // Row action handlers
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const tr = btn.closest('tr');
    const id = tr?.dataset.id;
    if (!id) return;
    const action = btn.dataset.action;
    if (action === 'status') {
      const newStatus = btn.dataset.status || 'completed';
      btn.disabled = true;
      try {
        const res = await fetch(`/appointments/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
        if (!res.ok) {
          const msg = await extractError(res);
          setAdminMsg(msg || 'Failed to update status', 'error');
          return;
        }
        // Keep current view after update; do not auto-switch to Completed section
        if (newStatus === 'completed') setAdminMsg('Marked as completed', 'success');
        else if (newStatus === 'booked') setAdminMsg('Marked as booked', 'success');
        else setAdminMsg('Status updated', 'success');
        await loadAppointments();
      } catch (err) {
        setAdminMsg('Network error while updating status', 'error');
      } finally {
        btn.disabled = false;
      }
    }
    if (action === 'edit') {
      openEditModal(id);
    }
  });

  // Modal logic
  const modal = document.getElementById('editModal');
  const editForm = document.getElementById('editForm');
  const editCancel = document.getElementById('editCancel');
  const editDelete = document.getElementById('editDelete');
  const editMsg = document.getElementById('editMsg');
  const editId = document.getElementById('editId');
  const editName = document.getElementById('editName');
  const editEmail = document.getElementById('editEmail');
  const editPhone = document.getElementById('editPhone');
  const editService = document.getElementById('editService');
  const editStore = document.getElementById('editStore');
  const editBarber = document.getElementById('editBarber');
  const editDate = document.getElementById('editDate');
  const editTime = document.getElementById('editTime');
  const editTitle = document.getElementById('editModalTitle');
  const editSubmit = document.getElementById('editSubmit');

  function setEditMsg(t, type='info') { editMsg.textContent = t || ''; editMsg.className = `msg ${type}`; }
  function showModal() { modal.hidden = false; }
  function hideModal() { modal.hidden = true; setEditMsg(''); }

  const TIME_PLACEHOLDER = '<option value="" disabled selected>Select a time…</option>';

  async function loadEditSlots() {
    const date = editDate.value;
    const barber = editBarber.value;
    const store = (editStore && editStore.value) || 'Nikaia';
    const dur = Number(editService?.selectedOptions?.[0]?.dataset?.duration || '30');
    editTime.disabled = true;
    editTime.innerHTML = TIME_PLACEHOLDER;
    if (!date || !barber) return;
    try {
      const params = new URLSearchParams({ date, barber, store, duration: String(dur) }).toString();
      const res = await fetch(`/appointments/slots?${params}`);
      const slots = await res.json();
      editTime.innerHTML = TIME_PLACEHOLDER +
        slots.map(s => `<option value="${s}">${s}</option>`).join('');
      editTime.disabled = false;
    } catch (e) {
      setEditMsg('Failed to load available time slots.', 'error');
    }
  }

  async function openEditModal(id) {
    // Load only the needed appointment to improve performance
    try {
  const res = await fetch(`/appointments/item/${id}`);
      if (!res.ok) throw new Error(await res.text());
      const a = await res.json();
      if (!a) return alert('Appointment not found');
      // Populate fields
      editId.value = a._id;
      editName.value = a.name || '';
      editEmail.value = a.email || '';
      editPhone.value = a.phone || '';
      // Load services, stores and barbers in parallel
      await Promise.all([
        loadServiceOptions(a.store || 'Nikaia'),
        (async () => {
          try {
            const resStores = await fetch('/appointments/stores');
            const stores = await resStores.json();
            if (editStore) editStore.innerHTML = stores.map(s => `<option value="${s}">${STORE_LABELS[s] || s}</option>`).join('');
          } catch {}
        })(),
        (async () => {
          const resB = await fetch('/appointments/barbers?' + new URLSearchParams({ store: (a.store || 'Nikaia') }));
          const barbers = await resB.json();
          // Update index for this store
          const st = a.store || 'Nikaia';
          const map = new Map();
          barbers.forEach((name, i) => map.set(name, i + 1));
          BARBER_INDEX[st] = map;
          // In edit mode, force specific barber (no ANY)
          editBarber.innerHTML = barbers.map((b, i) => `<option value="${b}">Barber ${i + 1}</option>`).join('');
        })()
      ]);
      // If the service isn't found in options (legacy), add it
      if (a.service) {
        const optFound = [...editService.options].some(o => o.value === a.service);
        if (!optFound) {
          const opt = document.createElement('option');
          opt.value = a.service;
          opt.textContent = a.service;
          editService.appendChild(opt);
        }
        editService.value = a.service;
      } else {
        editService.value = '';
      }
      // Fill stores
      if (editStore) editStore.value = a.store || 'Nikaia';
      // Services select value was set after loadServiceOptions
      editBarber.value = a.barber || '';
      editDate.value = a.date || '';
      // Load slots for the current barber and date
      await loadEditSlots();
      // Set the time value; if not in slots, add it as an option
      const currentTime = a.time || '';
      if (currentTime) {
        const timeOption = editTime.querySelector(`option[value="${CSS.escape(currentTime)}"]`);
        if (!timeOption) {
          // Add the current time as an extra option if not present
          const opt = document.createElement('option');
          opt.value = currentTime;
          opt.textContent = currentTime;
          editTime.appendChild(opt);
        }
        editTime.value = currentTime;
      }
  // Title and buttons for edit mode
  if (editTitle) editTitle.textContent = 'Edit appointment';
  if (editSubmit) editSubmit.textContent = 'Save';
  // Ensure delete button visible for edit (if present, i.e., master admin view)
  if (editDelete) editDelete.style.display = '';
  showModal();
    } catch (e) {
      setAdminMsg('Failed to open editor', 'error');
    }
  }

  async function openCreateModal() {
    // Prepare modal for creating a new appointment
    setEditMsg('');
    editId.value = '';
    editName.value = '';
    editEmail.value = '';
    editPhone.value = '';
  await loadServiceOptions((editStore && editStore.value) || 'Nikaia');
  editService.value = '';
    editDate.value = '';
    editTime.innerHTML = TIME_PLACEHOLDER;
    editTime.disabled = true;

    // Load stores for the select
    try {
      const resStores = await fetch('/appointments/stores');
      const stores = await resStores.json();
      if (editStore) editStore.innerHTML = stores.map(s => `<option value="${s}">${STORE_LABELS[s] || s}</option>`).join('');
    } catch {}
    // Determine default store: locked admin -> locked store; else current filter selection or Nikaia
    const locked = filterStore && filterStore.dataset.locked === 'true';
    const defaultStore = locked ? (filterStore.dataset.store || 'Nikaia') : (filterStore.value || 'Nikaia');
    if (editStore) editStore.value = defaultStore;

    // Load barbers for selected/default store
    try {
      const resB = await fetch('/appointments/barbers?' + new URLSearchParams({ store: (editStore && editStore.value) || 'Nikaia' }));
      const barbers = await resB.json();
      // Update index for default store
      const st = (editStore && editStore.value) || 'Nikaia';
      const map = new Map();
      barbers.forEach((name, i) => map.set(name, i + 1));
      BARBER_INDEX[st] = map;
      editBarber.innerHTML = `<option value="ANY">Any Barber</option>` +
        barbers.map((b, i) => `<option value="${b}">Barber ${i + 1}</option>`).join('');
      // No barber selected initially
      editBarber.insertAdjacentHTML('afterbegin', '<option value="" disabled selected>Choose a barber…</option>');
    } catch {}

  // Title and buttons for create mode
  if (editTitle) editTitle.textContent = 'Create appointment';
  if (editSubmit) editSubmit.textContent = 'Create';
  // Hide delete button in create mode even for master admin
  if (editDelete) editDelete.style.display = 'none';
  showModal();
  }

  editCancel?.addEventListener('click', hideModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });
  editDelete?.addEventListener('click', async () => {
    const id = editId.value;
    if (!id) return;
    setEditMsg('Deleting…');
    editDelete.disabled = true;
    try {
      const res = await fetch(`/appointments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const msg = await extractError(res);
        setEditMsg(msg || 'Failed to delete', 'error');
        return;
      }
      hideModal();
      await loadAppointments();
      setAdminMsg('Appointment deleted', 'success');
    } catch (err) {
      setEditMsg('Network error', 'error');
    } finally {
      editDelete.disabled = false;
    }
  });

  editStore?.addEventListener('change', async () => {
    try {
      const resB = await fetch('/appointments/barbers?' + new URLSearchParams({ store: (editStore && editStore.value) || 'Nikaia' }));
      const barbers = await resB.json();
      // Update index for selected store
      const st = (editStore && editStore.value) || 'Nikaia';
      const map = new Map();
      barbers.forEach((name, i) => map.set(name, i + 1));
      BARBER_INDEX[st] = map;
      // In edit mode (existing id), do not include the ANY option, as backend requires a specific barber.
      const isEditing = !!(editId && editId.value);
      editBarber.innerHTML = (isEditing ? '' : `<option value="ANY">Any Barber</option>`) +
        barbers.map((b, i) => `<option value="${b}">Barber ${i + 1}</option>`).join('');
    } catch {}
    // Reload services for the selected store
    try { await loadServiceOptions((editStore && editStore.value) || 'Nikaia'); } catch {}
    await loadEditSlots();
  });
  editBarber?.addEventListener('change', loadEditSlots);
  editDate?.addEventListener('change', loadEditSlots);

  editForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setEditMsg('Saving…');
    const id = editId.value;
    const payload = {
      name: editName.value,
      email: editEmail.value,
      phone: editPhone.value,
      service: editService.value,
      store: (editStore && editStore.value) || 'Nikaia',
      barber: editBarber.value,
      date: editDate.value,
      time: editTime.value
    };
    try {
      let res, text;
      if (!id) {
        // Create new appointment via public booking endpoint
        res = await fetch('/appointments/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        text = await res.text();
      } else {
        res = await fetch(`/appointments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        text = await res.text();
      }
      if (!res.ok) {
        // Map common errors to friendlier messages
        let friendly = text || 'Failed to save';
        if (res.status === 400) friendly = text || 'Please check all fields and try again.';
        if (res.status === 403) friendly = text || 'Forbidden. You may not have permission for this action.';
        if (res.status === 404) friendly = text || 'Appointment not found.';
        if (res.status === 409) friendly = text || 'Selected time is no longer available.';
        setEditMsg(friendly, 'error');
        return;
      }
      hideModal();
      await loadAppointments();
      setAdminMsg('Appointment saved', 'success');
    } catch (err) {
      setEditMsg('Network error', 'error');
    }
  });

  btnCreate?.addEventListener('click', openCreateModal);

  // Load services into the Service select (with categories)
  async function loadServiceOptions(store) {
    try {
      const params = store ? ('?' + new URLSearchParams({ store })) : '';
      const res = await fetch('/appointments/services' + params);
      const byCat = await res.json();
      const cats = Object.keys(byCat);
      editService.innerHTML = '<option value="" disabled selected>Choose a service…</option>';
      cats.forEach(cat => {
        const og = document.createElement('optgroup');
        og.label = cat;
        (byCat[cat] || []).forEach(svc => {
          const opt = document.createElement('option');
          opt.value = svc.name; // store service name as before
          const dur = svc.durationMinutes;
          const durLabel = dur >= 60 ? `${Math.floor(dur/60)}h${dur%60?` ${dur%60}m`:''}` : `${dur}m`;
          opt.textContent = `${svc.name} • €${svc.price} • ${durLabel}`;
          opt.dataset.duration = String(dur);
          og.appendChild(opt);
        });
        editService.appendChild(og);
      });
    } catch {}
  }

  // Refresh slots when service changes to align time grid with duration
  editService?.addEventListener('change', loadEditSlots);

  // Set default date to today on first load if empty
  function todayLocalYYYYMMDD() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  (async function initAdmin() {
    await loadStores();
    await loadBarbers();
    if (filterDate && !filterDate.value) {
      filterDate.value = todayLocalYYYYMMDD();
    }
    await loadAppointments();
  })();
})();
