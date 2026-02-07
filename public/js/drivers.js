document.addEventListener('DOMContentLoaded', async () => {
  const tbody = document.getElementById('drivers-body');

  try {
    const response = await fetch('/api/drivers');

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const drivers = await response.json();

    // Handle both array response and object with data property
    const driversArray = Array.isArray(drivers) 
      ? drivers 
      : (drivers.data || []);

    tbody.innerHTML = '';

    driversArray.forEach((driver, index) => {
      const row = document.createElement('tr');

      row.innerHTML = `
        <td>${index + 1}</td>

        <td class="driver-cell">
          <div class="driver-info">
            <img src="${driver.image_url || '/img/default-driver.png'}"
               class="driver-avatar"
               alt="${driver.name}"
               onerror="this.src='/img/default-driver.png'">
            <span>${driver.name}</span>
          </div>
        </td>

        <td>${driver.team}</td>
        <td class="points">${driver.points ?? 0}</td>
        <td>${driver.wins ?? 0}</td>
        <td>${driver.polePositions ?? 0}</td>
        <td>${driver.starts ?? '-'}</td>
      `;

      tbody.appendChild(row);
    });

  } catch (err) {
    console.error('Failed to load drivers:', err);

    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; color:red;">
          Failed to load drivers data. Please try again later.
        </td>
      </tr>
    `;
  }
});