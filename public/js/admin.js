(() => {
  const table = document.getElementById('appointmentsTable');
  const tbody = table.querySelector('tbody');
  const filterBarber = document.getElementById('filterBarber');
  const filterDate = document.getElementById('filterDate');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnClear = document.getElementById('btnClear');

  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  function fmtDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString();
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
        <td>${fmtDateTime(a.createdAt)}</td>
        <td>${a.date || ''}</td>
        <td>${a.time || ''}</td>
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

    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#666;">Loading…</td></tr>';
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

  // Modal logic
  const modal = document.getElementById('editModal');
  const editForm = document.getElementById('editForm');
  const editCancel = document.getElementById('editCancel');
  const editMsg = document.getElementById('editMsg');
  const editId = document.getElementById('editId');
  const editName = document.getElementById('editName');
  const editEmail = document.getElementById('editEmail');
  const editPhone = document.getElementById('editPhone');
  const editService = document.getElementById('editService');
  const editBarber = document.getElementById('editBarber');
  const editDate = document.getElementById('editDate');
  const editTime = document.getElementById('editTime');

  function setEditMsg(t, type='info') { editMsg.textContent = t || ''; editMsg.className = `msg ${type}`; }
  function showModal() { modal.hidden = false; }
  function hideModal() { modal.hidden = true; setEditMsg(''); }

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
      // Fill barbers
      const resB = await fetch('/appointments/barbers');
      const barbers = await resB.json();
      editBarber.innerHTML = barbers.map(b => `<option value="${b}">${b}</option>`).join('');
      editBarber.value = a.barber || '';
      editDate.value = a.date || '';
      editTime.value = a.time || '';
      showModal();
    } catch (e) {
      alert('Failed to open editor');
    }
  }

  editCancel?.addEventListener('click', hideModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });

  editForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setEditMsg('Saving…');
    const id = editId.value;
    const payload = {
      name: editName.value,
      email: editEmail.value,
      phone: editPhone.value,
      service: editService.value,
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

  loadBarbers().then(loadAppointments);
})();
