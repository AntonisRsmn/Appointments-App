(() => {
  const STORE_LABELS = {
    'Nikaia': 'Olympou 11, Nikea 184 54',
    'Aigaleo': 'Mark. Mpotsari 9, Egaleo 122 41'
  };
  const table = document.getElementById('appointmentsTable');
  const tbody = table.querySelector('tbody');
  const filterStore = document.getElementById('filterStore');
  const filterBarber = document.getElementById('filterBarber');
  const filterDate = document.getElementById('filterDate');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnClear = document.getElementById('btnClear');
  const btnCreate = document.getElementById('btnCreate');
  const adminMsg = document.getElementById('adminMsg');

  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

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
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:#666;">No appointments</td></tr>';
      return;
    }
    tbody.innerHTML = items.map(a => {
      const completed = a.status === 'completed';
      const rowClass = completed ? 'row-completed' : '';
      const status = a.status || 'booked';
      const statusClass = `status-${status}`;
      return `
      <tr class="${rowClass}" data-id="${a._id}">
        <td>${fmtDateTime(a.createdAt)}</td>
        <td>${a.date || ''}</td>
        <td>${a.time || ''}</td>
  <td>${STORE_LABELS[a.store || 'Nikaia'] || (a.store || 'Nikaia')}</td>
        <td>${a.barber || ''}</td>
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
    } catch (e) { /* noop */ }
  }

  async function loadBarbers() {
    try {
      const params = new URLSearchParams();
      if (filterStore && filterStore.value) params.set('store', filterStore.value);
      const res = await fetch('/appointments/barbers' + (params.toString() ? ('?' + params.toString()) : ''));
      const barbers = await res.json();
      filterBarber.innerHTML = '<option value="">All barbers</option>' +
        barbers.map(b => `<option value="${b}">${b}</option>`).join('');
    } catch (e) {
      // ignore
    }
  }

  async function loadAppointments() {
    const params = new URLSearchParams();
    if (filterBarber.value) params.set('barber', filterBarber.value);
    if (filterDate.value) params.set('date', filterDate.value);
    if (filterStore && filterStore.value) params.set('store', filterStore.value);

  tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:#666;">Loading…</td></tr>';
    try {
      const res = await fetch('/appointments/all' + (params.toString() ? ('?' + params.toString()) : ''));
      const items = await res.json();
      renderRows(items);
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#c00;">Failed to load</td></tr>';
    }
  }

  btnRefresh?.addEventListener('click', loadAppointments);
  btnClear?.addEventListener('click', () => {
    filterBarber.value = '';
    filterDate.value = '';
    if (filterStore && filterStore.dataset.locked !== 'true') filterStore.value = '';
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
        await loadAppointments();
        setAdminMsg('Status updated', 'success');
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

  function setEditMsg(t, type='info') { editMsg.textContent = t || ''; editMsg.className = `msg ${type}`; }
  function showModal() { modal.hidden = false; }
  function hideModal() { modal.hidden = true; setEditMsg(''); }

  const TIME_PLACEHOLDER = '<option value="" disabled selected>Select a time…</option>';

  async function loadEditSlots() {
    const date = editDate.value;
    const barber = editBarber.value;
    const store = (editStore && editStore.value) || 'Nikaia';
    editTime.disabled = true;
    editTime.innerHTML = TIME_PLACEHOLDER;
    if (!date || !barber) return;
    try {
      const params = new URLSearchParams({ date, barber, store }).toString();
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
    // Load current item from last fetched list by refetching a filtered all
    try {
      const res = await fetch('/appointments/all');
      const items = await res.json();
      const a = items.find(x => String(x._id) === String(id));
      if (!a) return alert('Appointment not found');
      // Populate fields
      editId.value = a._id;
      editName.value = a.name || '';
      editEmail.value = a.email || '';
      editPhone.value = a.phone || '';
      // Load services into the select and set the current value
      await loadServiceOptions();
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
      try {
        const resStores = await fetch('/appointments/stores');
        const stores = await resStores.json();
        if (editStore) editStore.innerHTML = stores.map(s => `<option value="${s}">${STORE_LABELS[s] || s}</option>`).join('');
      } catch {}
      if (editStore) editStore.value = a.store || 'Nikaia';
      // Fill barbers for selected store
      const resB = await fetch('/appointments/barbers?' + new URLSearchParams({ store: (editStore && editStore.value) || 'Nikaia' }));
      const barbers = await resB.json();
      // In edit mode, force choosing a specific barber to avoid validation errors
      editBarber.innerHTML = barbers.map(b => `<option value="${b}">${b}</option>`).join('');
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
  await loadServiceOptions();
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
      editBarber.innerHTML = `<option value="ANY">Οποιοσδήποτε Υπάλληλος</option>` +
        barbers.map(b => `<option value="${b}">${b}</option>`).join('');
      // No barber selected initially
      editBarber.insertAdjacentHTML('afterbegin', '<option value="" disabled selected>Choose a barber…</option>');
    } catch {}

  // Hide delete button in create mode even for master admin
  if (editDelete) editDelete.style.display = 'none';
  showModal();
  }

  editCancel?.addEventListener('click', hideModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });
  editDelete?.addEventListener('click', async () => {
    const id = editId.value;
    if (!id) return;
    const sure = confirm('Delete this appointment? This cannot be undone.');
    if (!sure) return;
    setEditMsg('Deleting…');
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
    }
  });

  editStore?.addEventListener('change', async () => {
    try {
      const resB = await fetch('/appointments/barbers?' + new URLSearchParams({ store: (editStore && editStore.value) || 'Nikaia' }));
      const barbers = await resB.json();
      editBarber.innerHTML = `<option value="ANY">Οποιοσδήποτε Υπάλληλος</option>` +
        barbers.map(b => `<option value="${b}">${b}</option>`).join('');
    } catch {}
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
  async function loadServiceOptions() {
    try {
      const res = await fetch('/appointments/services');
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
          og.appendChild(opt);
        });
        editService.appendChild(og);
      });
    } catch {}
  }

  loadStores().then(loadBarbers).then(loadAppointments);
})();
