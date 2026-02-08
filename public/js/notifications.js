document.addEventListener('DOMContentLoaded', async () => {
    const list = document.getElementById('notificationsList');
    if (!list) return;

    try {
        const response = await fetch('/api/notifications?limit=5', { credentials: 'include' });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to load notifications');
        }

        const notifications = result.data || [];
        if (!notifications.length) {
            list.innerHTML = '<div class="notification-item">No notifications yet.</div>';
            return;
        }

        list.innerHTML = notifications.map((note) => {
            const createdAt = new Date(note.createdAt).toLocaleString();
            return `
                <div class="notification-item">
                    <strong>${note.title}</strong>
                    <div class="meta">${createdAt}</div>
                    <div>${note.message}</div>
                </div>
            `;
        }).join('');
    } catch (error) {
        list.innerHTML = `<div class="notification-item">${error.message}</div>`;
    }
});
