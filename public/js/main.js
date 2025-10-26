(() => {
  const form = document.getElementById('appointmentForm');
  const msgEl = document.getElementById('formMessage');
  const barberSelect = document.getElementById('barberSelect');
  const dateInput = document.getElementById('dateInput');
  const timeSelect = document.getElementById('timeSelect');

  // Footer year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  function setMessage(text, type = 'info') {
    msgEl.textContent = text;
    msgEl.className = `msg ${type}`;
  }

  function setMinDateToday() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.min = `${yyyy}-${mm}-${dd}`;
  }

  async function loadBarbers() {
    try {
      const res = await fetch('/appointments/barbers');
      const barbers = await res.json();
      barberSelect.innerHTML = '<option value="" disabled selected>Choose a barber…</option>' +
        barbers.map(b => `<option value="${b}">${b}</option>`).join('');
    } catch (e) {
      setMessage('Failed to load barbers.', 'error');
    }
  }

  async function loadSlots() {
    const date = dateInput.value;
    const barber = barberSelect.value;
    timeSelect.disabled = true;
    if (!date || !barber) return;
    try {
      const params = new URLSearchParams({ date, barber }).toString();
      const res = await fetch(`/appointments/slots?${params}`);
      const slots = await res.json();
      timeSelect.innerHTML = '<option value="" disabled selected>Select a time…</option>' +
        slots.map(s => `<option value="${s}">${s}</option>`).join('');
      timeSelect.disabled = false;
    } catch (e) {
      setMessage('Failed to load available time slots.', 'error');
    }
  }

  barberSelect?.addEventListener('change', loadSlots);
  dateInput?.addEventListener('change', loadSlots);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage('Booking your appointment…', 'info');

    const data = Object.fromEntries(new FormData(form));
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
      timeSelect.disabled = true;
    } catch (e) {
      setMessage('Network error while booking.', 'error');
    }
  });

  setMinDateToday();
  loadBarbers();
})();
