let usersPage = 1;
let notificationsPage = 1;
const usersLimit = 10;
const notificationsLimit = 5;

const usersTableBody = document.getElementById('usersTableBody');
const usersPageInfo = document.getElementById('usersPageInfo');
const prevUsers = document.getElementById('prevUsers');
const nextUsers = document.getElementById('nextUsers');
const userSearch = document.getElementById('userSearch');
const roleFilter = document.getElementById('roleFilter');
const statusFilter = document.getElementById('statusFilter');
const filterBtn = document.getElementById('filterBtn');

const notificationTitle = document.getElementById('notificationTitle');
const notificationMessage = document.getElementById('notificationMessage');
const sendNotificationBtn = document.getElementById('sendNotificationBtn');
const notificationStatus = document.getElementById('notificationStatus');
const notificationsList = document.getElementById('notificationsList');
const prevNotifications = document.getElementById('prevNotifications');
const nextNotifications = document.getElementById('nextNotifications');
const notificationsPageInfo = document.getElementById('notificationsPageInfo');

function buildUsersQuery() {
  const params = new URLSearchParams();
  params.set('page', String(usersPage));
  params.set('limit', String(usersLimit));
  if (userSearch.value.trim()) params.set('search', userSearch.value.trim());
  if (roleFilter.value) params.set('role', roleFilter.value);
  if (statusFilter.value) params.set('status', statusFilter.value);
  return params.toString();
}

async function loadUsers() {
  usersTableBody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
  try {
    const response = await fetch(`/api/admin/users?${buildUsersQuery()}`);
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to load users');
    }

    if (!result.data.length) {
      usersTableBody.innerHTML = '<tr><td colspan="5">No users found.</td></tr>';
    } else {
      usersTableBody.innerHTML = result.data.map(renderUserRow).join('');
    }
    usersPageInfo.textContent = `Page ${result.page} of ${result.pages || 1}`;
    prevUsers.disabled = usersPage <= 1;
    nextUsers.disabled = usersPage >= (result.pages || 1);
  } catch (error) {
    usersTableBody.innerHTML = `<tr><td colspan="5">Error: ${error.message}</td></tr>`;
  }
}

function renderUserRow(user) {
  const roleBadge = user.role === 'admin' ? 'admin' : 'user';
  const statusBadge = user.isActive === false ? 'disabled' : 'active';
  const statusLabel = user.isActive === false ? 'Disabled' : 'Active';
  const roleAction = user.role === 'admin' ? 'Make User' : 'Make Admin';
  const statusAction = user.isActive === false ? 'Enable' : 'Disable';

  return `
    <tr data-id="${user._id}">
      <td>
        <div><strong>${user.username}</strong></div>
        <div class="muted">${user.email}</div>
      </td>
      <td><span class="badge ${roleBadge}">${user.role}</span></td>
      <td><span class="badge ${statusBadge}">${statusLabel}</span></td>
      <td>${new Date(user.createdAt).toLocaleDateString()}</td>
      <td>
        <button class="btn secondary" data-action="role">${roleAction}</button>
        <button class="btn warning" data-action="status">${statusAction}</button>
        <button class="btn danger" data-action="delete">Delete</button>
      </td>
    </tr>
  `;
}

usersTableBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const row = button.closest('tr');
  const userId = row.getAttribute('data-id');
  const action = button.getAttribute('data-action');

  try {
    if (action === 'role') {
      const currentRole = row.querySelector('.badge.admin') ? 'admin' : 'user';
      const nextRole = currentRole === 'admin' ? 'user' : 'admin';
      await updateUserRole(userId, nextRole);
    }

    if (action === 'status') {
      const currentStatus = row.querySelector('.badge.disabled') ? 'disabled' : 'active';
      const nextStatus = currentStatus === 'disabled';
      await updateUserStatus(userId, nextStatus);
    }

    if (action === 'delete') {
      const confirmed = confirm('Delete this user? This cannot be undone.');
      if (!confirmed) return;
      await deleteUser(userId);
    }

    await loadUsers();
  } catch (error) {
    alert(error.message || 'Action failed');
  }
});

async function updateUserRole(userId, role) {
  const response = await fetch(`/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to update role');
}

async function updateUserStatus(userId, isActive) {
  const response = await fetch(`/api/admin/users/${userId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to update status');
}

async function deleteUser(userId) {
  const response = await fetch(`/api/admin/users/${userId}`, {
    method: 'DELETE'
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to delete user');
}

async function loadNotifications() {
  notificationsList.innerHTML = '<div class="notification-item">Loading...</div>';
  try {
    const response = await fetch(`/api/admin/notifications?page=${notificationsPage}&limit=${notificationsLimit}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to load notifications');

    if (!result.data.length) {
      notificationsList.innerHTML = '<div class="notification-item">No notifications yet.</div>';
    } else {
      notificationsList.innerHTML = result.data.map((note) => `
        <div class="notification-item">
          <strong>${note.title}</strong>
          <div class="muted">${new Date(note.createdAt).toLocaleString()}</div>
          <p>${note.message}</p>
        </div>
      `).join('');
    }
    notificationsPageInfo.textContent = `Page ${result.page} of ${result.pages || 1}`;
    prevNotifications.disabled = notificationsPage <= 1;
    nextNotifications.disabled = notificationsPage >= (result.pages || 1);
  } catch (error) {
    notificationsList.innerHTML = `<div class="notification-item">Error: ${error.message}</div>`;
  }
}

async function sendNotification() {
  const title = notificationTitle.value.trim();
  const message = notificationMessage.value.trim();
  notificationStatus.textContent = '';

  if (!title || !message) {
    notificationStatus.textContent = 'Title and message are required.';
    return;
  }

  try {
    const response = await fetch('/api/admin/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to send');

    notificationTitle.value = '';
    notificationMessage.value = '';
    notificationStatus.textContent = 'Notification sent.';
    notificationsPage = 1;
    await loadNotifications();
  } catch (error) {
    notificationStatus.textContent = error.message || 'Failed to send notification.';
  }
}

filterBtn.addEventListener('click', () => {
  usersPage = 1;
  loadUsers();
});

prevUsers.addEventListener('click', () => {
  if (usersPage > 1) {
    usersPage -= 1;
    loadUsers();
  }
});

nextUsers.addEventListener('click', () => {
  usersPage += 1;
  loadUsers();
});

prevNotifications.addEventListener('click', () => {
  if (notificationsPage > 1) {
    notificationsPage -= 1;
    loadNotifications();
  }
});

nextNotifications.addEventListener('click', () => {
  notificationsPage += 1;
  loadNotifications();
});

sendNotificationBtn.addEventListener('click', sendNotification);

document.addEventListener('DOMContentLoaded', () => {
  loadUsers();
  loadNotifications();
});
