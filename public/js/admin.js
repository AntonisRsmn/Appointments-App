(() => {
  const table = document.getElementById('appointmentsTable');
  const tbody = table.querySelector('tbody');
  const filterBarber = document.getElementById('filterBarber');
  const filterDate = document.getElementById('filterDate');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnClear = document.getElementById('btnClear');
  const btnCreateAppt = document.getElementById('btnCreateAppt');

  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  let stores = [];

  function fmtDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString();
  }

  function getStoreName(storeId) {
    if (!storeId) return '';
    const store = stores.find(s => s.id === storeId);
    return store ? store.name : storeId;
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
        <td>${getStoreName(a.store)}</td>
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
      const res = await fetch('/appointments/stores');
      stores = await res.json();
    } catch (e) {
      console.error('Failed to load stores', e);
    }
  }

  async function loadBarbers() {
    try {
      const res = await fetch('/appointments/barbers');
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

    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:#666;">Loading…</td></tr>';
    try {
      const res = await fetch('/appointments/all' + (params.toString() ? ('?' + params.toString()) : ''));
      const items = await res.json();
      renderRows(items);
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:#c00;">Failed to load</td></tr>';
    }
  }

  btnRefresh?.addEventListener('click', loadAppointments);
  btnClear?.addEventListener('click', () => {
    filterBarber.value = '';
    filterDate.value = '';
    loadAppointments();
  });

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
        if (!res.ok) throw new Error(await res.text());
        await loadAppointments();
      } catch (err) {
        alert('Failed to update status');
      } finally {
        btn.disabled = false;
      }
    }
    if (action === 'edit') {
      openEditModal(id);
    }
  });

  // Modal logic - Create
  const createModal = document.getElementById('createModal');
  const createForm = document.getElementById('createForm');
  const createCancel = document.getElementById('createCancel');
  const createMsg = document.getElementById('createMsg');
  const createName = document.getElementById('createName');
  const createEmail = document.getElementById('createEmail');
  const createPhone = document.getElementById('createPhone');
  const createService = document.getElementById('createService');
  const createStore = document.getElementById('createStore');
  const createBarber = document.getElementById('createBarber');
  const createDate = document.getElementById('createDate');
  const createTime = document.getElementById('createTime');

  function setCreateMsg(t, type='info') { createMsg.textContent = t || ''; createMsg.className = `msg ${type}`; }
  function showCreateModal() { createModal.hidden = false; }
  function hideCreateModal() { 
    createModal.hidden = true; 
    setCreateMsg(''); 
    createForm.reset();
    createBarber.disabled = true;
    createTime.disabled = true;
  }

  async function loadCreateStores() {
    createStore.innerHTML = '<option value="" disabled selected>Select a store…</option>' +
      stores.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }

  async function loadCreateBarbers(storeId) {
    createBarber.disabled = true;
    createBarber.innerHTML = '<option value="" disabled selected>Select a barber…</option>';
    createTime.disabled = true;
    createTime.innerHTML = '<option value="" disabled selected>Select a time…</option>';
    
    if (!storeId) return;
    
    try {
      const res = await fetch(`/appointments/barbers?store=${storeId}`);
      const barbers = await res.json();
      createBarber.innerHTML = '<option value="" disabled selected>Select a barber…</option>' +
        barbers.map(b => `<option value="${b}">${b}</option>`).join('');
      createBarber.disabled = false;
    } catch (e) {
      setCreateMsg('Failed to load barbers', 'error');
    }
  }

  async function loadCreateSlots() {
    const store = createStore.value;
    const barber = createBarber.value;
    const date = createDate.value;
    
    createTime.disabled = true;
    createTime.innerHTML = '<option value="" disabled selected>Select a time…</option>';
    
    if (!store || !barber || !date) return;
    
    try {
      const params = new URLSearchParams({ store, barber, date }).toString();
      const res = await fetch(`/appointments/slots?${params}`);
      const slots = await res.json();
      createTime.innerHTML = '<option value="" disabled selected>Select a time…</option>' +
        slots.map(s => `<option value="${s}">${s}</option>`).join('');
      createTime.disabled = false;
    } catch (e) {
      setCreateMsg('Failed to load available time slots', 'error');
    }
  }

  btnCreateAppt?.addEventListener('click', () => {
    loadCreateStores();
    showCreateModal();
  });

  createCancel?.addEventListener('click', hideCreateModal);
  createModal?.addEventListener('click', (e) => { if (e.target === createModal) hideCreateModal(); });

  createStore?.addEventListener('change', () => {
    loadCreateBarbers(createStore.value);
  });

  createBarber?.addEventListener('change', loadCreateSlots);
  createDate?.addEventListener('change', loadCreateSlots);

  createForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setCreateMsg('Creating…');
    
    const payload = {
      name: createName.value,
      email: createEmail.value,
      phone: createPhone.value,
      service: createService.value,
      store: createStore.value,
      barber: createBarber.value,
      date: createDate.value,
      time: createTime.value
    };
    
    try {
      const res = await fetch('/appointments/book', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      const text = await res.text();
      if (!res.ok) {
        setCreateMsg(text || 'Failed to create appointment', 'error');
        return;
      }
      hideCreateModal();
      await loadAppointments();
    } catch (err) {
      setCreateMsg('Network error', 'error');
    }
  });

  // Modal logic - Edit
  // Modal logic - Edit
  const modal = document.getElementById('editModal');
  const editForm = document.getElementById('editForm');
  const editCancel = document.getElementById('editCancel');
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

  async function loadEditBarbers(storeId) {
    editBarber.disabled = true;
    editBarber.innerHTML = '<option value="" disabled selected>Select a barber…</option>';
    editTime.disabled = true;
    editTime.innerHTML = TIME_PLACEHOLDER;
    
    if (!storeId) return;
    
    try {
      const res = await fetch(`/appointments/barbers?store=${storeId}`);
      const barbers = await res.json();
      editBarber.innerHTML = barbers.map(b => `<option value="${b}">${b}</option>`).join('');
      editBarber.disabled = false;
    } catch (e) {
      setEditMsg('Failed to load barbers', 'error');
    }
  }

  async function loadEditSlots() {
    const store = editStore.value;
    const date = editDate.value;
    const barber = editBarber.value;
    editTime.disabled = true;
    editTime.innerHTML = TIME_PLACEHOLDER;
    if (!date || !barber || !store) return;
    try {
      const params = new URLSearchParams({ store, date, barber }).toString();
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
      editService.value = a.service || '';
      
      // Fill stores
      editStore.innerHTML = stores.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
      editStore.value = a.store || '';
      
      // Load barbers for the store
      await loadEditBarbers(a.store);
      editBarber.value = a.barber || '';
      
      editDate.value = a.date || '';
      
      // Load slots for the current store/barber/date
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
      showModal();
    } catch (e) {
      alert('Failed to open editor');
    }
  }

  editCancel?.addEventListener('click', hideModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });

  editStore?.addEventListener('change', async () => {
    await loadEditBarbers(editStore.value);
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
      store: editStore.value,
      barber: editBarber.value,
      date: editDate.value,
      time: editTime.value
    };
    try {
      const res = await fetch(`/appointments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const text = await res.text();
      if (!res.ok) {
        setEditMsg(text || 'Failed to save', 'error');
        return;
      }
      hideModal();
      await loadAppointments();
    } catch (err) {
      setEditMsg('Network error', 'error');
    }
  });

  loadStores().then(() => {
    loadBarbers().then(loadAppointments);
  });
})();
