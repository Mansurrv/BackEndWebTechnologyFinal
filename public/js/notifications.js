document.addEventListener('DOMContentLoaded', async () => {
    const list = document.getElementById('notificationsList');
    const dropdownList = document.getElementById('notificationDropdownList');
    const notificationCount = document.getElementById('notificationCount');
    const notificationBell = document.getElementById('notificationBell');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const lastSeenKey = 'f1tracker.lastSeenNotificationAt';
    let latestNotificationAt = null;

    if (notificationBell && notificationDropdown) {
        notificationBell.addEventListener('click', (event) => {
            event.stopPropagation();
            notificationDropdown.classList.toggle('open');
            if (notificationDropdown.classList.contains('open') && latestNotificationAt) {
                localStorage.setItem(lastSeenKey, latestNotificationAt);
                if (notificationCount) {
                    notificationCount.style.display = 'none';
                }
            }
        });

        document.addEventListener('click', (event) => {
            if (!notificationDropdown.classList.contains('open')) return;
            const target = event.target;
            if (notificationDropdown.contains(target) || notificationBell.contains(target)) return;
            notificationDropdown.classList.remove('open');
        });
    }

    if (!list && !dropdownList) return;

    try {
        const response = await fetch('/api/notifications?limit=5', { credentials: 'include' });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to load notifications');
        }

        const notifications = result.data || [];
        const total = Number.isFinite(result.total) ? result.total : notifications.length;
        latestNotificationAt = notifications[0]?.createdAt || null;
        const lastSeen = localStorage.getItem(lastSeenKey);
        const hasNew = latestNotificationAt
            ? !lastSeen || new Date(latestNotificationAt) > new Date(lastSeen)
            : false;

        if (notificationCount) {
            if (total > 0 && hasNew) {
                notificationCount.textContent = String(total);
                notificationCount.style.display = 'inline-flex';
            } else {
                notificationCount.style.display = 'none';
            }
        }

        if (!notifications.length) {
            if (list) {
                list.innerHTML = '<div class="notification-item">No notifications yet.</div>';
            }
            if (dropdownList) {
                dropdownList.innerHTML = '<div class="notification-empty">No notifications yet.</div>';
            }
            return;
        }

        const dashboardHtml = notifications.map((note) => {
            const createdAt = new Date(note.createdAt).toLocaleString();
            return `
                <div class="notification-item">
                    <strong>${note.title}</strong>
                    <div class="meta">${createdAt}</div>
                    <div>${note.message}</div>
                </div>
            `;
        }).join('');

        const dropdownHtml = notifications.map((note) => {
            const createdAt = new Date(note.createdAt).toLocaleString();
            return `
                <div class="notification-dropdown-item">
                    <strong>${note.title}</strong>
                    <div class="meta">${createdAt}</div>
                    <div>${note.message}</div>
                </div>
            `;
        }).join('');

        if (list) list.innerHTML = dashboardHtml;
        if (dropdownList) dropdownList.innerHTML = dropdownHtml;
    } catch (error) {
        if (list) {
            list.innerHTML = `<div class="notification-item">${error.message}</div>`;
        }
        if (dropdownList) {
            dropdownList.innerHTML = `<div class="notification-empty">${error.message}</div>`;
        }
    }
});
