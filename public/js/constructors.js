const API_URL = '/api/constructors';
let currentConstructorId = null;
let allConstructors = [];

// DOM Elements
const elements = {
    team: document.getElementById('team'),
    pos: document.getElementById('pos'),
    color: document.getElementById('color'),
    colorPreview: document.getElementById('colorPreview'),
    drivers: document.getElementById('drivers'),
    points: document.getElementById('points'),
    wins: document.getElementById('wins'),
    podiums: document.getElementById('podiums'),
    constructorId: document.getElementById('constructorId'),
    formMode: document.getElementById('formMode'),
    constructorsList: document.getElementById('constructorsList'),
    searchInput: document.getElementById('searchInput'),
    showingCount: document.getElementById('showingCount'),
    totalCount: document.getElementById('totalCount'),
    totalConstructors: document.getElementById('totalConstructors'),
    totalPoints: document.getElementById('totalPoints'),
    totalWins: document.getElementById('totalWins'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),
    confirmModal: document.getElementById('confirmModal'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadConstructors();
    setupEventListeners();
    
    // Update color preview
    elements.color.addEventListener('input', updateColorPreview);
    updateColorPreview();
});

// Event Listeners
function setupEventListeners() {
    elements.confirmDeleteBtn.addEventListener('click', confirmDelete);
}

// Load all constructors
async function loadConstructors() {
    try {
        showLoading();
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            allConstructors = result.data;
            displayConstructors(allConstructors);
            updateStats();
        } else {
            throw new Error(result.error || 'Failed to load constructors');
        }
    } catch (error) {
        showError('Failed to load constructors: ' + error.message);
        showEmptyState();
    }
}

// Display constructors in table
function displayConstructors(constructors) {
    if (!constructors || constructors.length === 0) {
        showEmptyState();
        return;
    }

    const sortedConstructors = [...constructors].sort((a, b) => a.position - b.position);
    
    elements.constructorsList.innerHTML = sortedConstructors.map(constructor => `
        <tr data-id="${constructor._id}">
            <td>
                <div class="position-badge">${constructor.position}</div>
            </td>
            <td>
                <div class="team-cell">
                    <div class="team-color" style="background-color: ${constructor.color || '#FF0000'}"></div>
                    <strong>${constructor.team}</strong>
                </div>
            </td>
            <td>
                <div class="driver-badge">${constructor.drivers}</div>
            </td>
            <td>
                <div class="points-badge">${constructor.points || 0}</div>
            </td>
            <td>
                <div class="wins-badge">${constructor.wins || 0}</div>
            </td>
            <td>
                <div class="podiums-badge">${constructor.podiums || 0}</div>
            </td>
            <td class="actions-cell">
                <button class="action-btn edit-btn" onclick="editConstructor('${constructor._id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="action-btn delete-btn" onclick="showDeleteConfirm('${constructor._id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        </tr>
    `).join('');

    updateCounts(constructors.length);
}

// Save Constructor (Create or Update)
async function saveConstructor() {
    if (!validateForm()) {
        return;
    }

    const constructorData = {
        name: elements.team.value.trim(),
        position: parseInt(elements.pos.value),
        team: elements.team.value.trim(),
        color: elements.color.value,
        drivers: elements.drivers.value.trim(),
        points: parseInt(elements.points.value) || 0,
        wins: parseInt(elements.wins.value) || 0,
        podiums: parseInt(elements.podiums.value) || 0,
        season: new Date().getFullYear()
    };

    const method = currentConstructorId ? 'PUT' : 'POST';
    const url = currentConstructorId ? `${API_URL}/${currentConstructorId}` : API_URL;

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(constructorData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showToast(currentConstructorId ? 'Constructor updated successfully!' : 'Constructor created successfully!');
            resetForm();
            await loadConstructors();
        } else {
            throw new Error(result.error || 'Failed to save constructor');
        }
    } catch (error) {
        showError('Failed to save constructor: ' + error.message);
    }
}

// Edit constructor
async function editConstructor(id) {
    try {
        const response = await fetch(`${API_URL}/${id}`);
        const result = await response.json();

        if (response.ok && result.success) {
            const constructor = result.data;
            
            currentConstructorId = constructor._id;
            elements.constructorId.value = constructor._id;
            elements.team.value = constructor.team || '';
            elements.pos.value = constructor.position || '';
            elements.color.value = constructor.color || '#FF0000';
            elements.drivers.value = constructor.drivers || '';
            elements.points.value = constructor.points || 0;
            elements.wins.value = constructor.wins || 0;
            elements.podiums.value = constructor.podiums || 0;
            
            elements.formMode.textContent = 'EDIT';
            elements.formMode.style.background = 'var(--warning-color)';
            
            updateColorPreview();
            scrollToForm();
            
            showToast('Constructor loaded for editing');
        } else {
            throw new Error(result.error || 'Failed to load constructor');
        }
    } catch (error) {
        showError('Failed to load constructor: ' + error.message);
    }
}

// Show delete confirmation
function showDeleteConfirm(id) {
    currentConstructorId = id;
    elements.confirmModal.style.display = 'flex';
}

// Confirm delete
async function confirmDelete() {
    if (!currentConstructorId) return;

    try {
        const response = await fetch(`${API_URL}/${currentConstructorId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showToast('Constructor deleted successfully!');
            closeModal();
            await loadConstructors();
        } else {
            throw new Error(result.error || 'Failed to delete constructor');
        }
    } catch (error) {
        showError('Failed to delete constructor: ' + error.message);
    } finally {
        currentConstructorId = null;
    }
}

// Close modal
function closeModal() {
    elements.confirmModal.style.display = 'none';
    currentConstructorId = null;
}

// Reset form
function resetForm() {
    elements.team.value = '';
    elements.pos.value = '';
    elements.color.value = '#FF0000';
    elements.drivers.value = '';
    elements.points.value = '';
    elements.wins.value = '';
    elements.podiums.value = '';
    elements.constructorId.value = '';
    
    currentConstructorId = null;
    elements.formMode.textContent = 'CREATE';
    elements.formMode.style.background = 'var(--primary-color)';
    
    updateColorPreview();
}

// Update color preview
function updateColorPreview() {
    elements.colorPreview.style.background = elements.color.value;
}

// Filter constructors
function filterConstructors() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    
    if (!searchTerm.trim()) {
        displayConstructors(allConstructors);
        return;
    }

    const filtered = allConstructors.filter(constructor => 
        constructor.team.toLowerCase().includes(searchTerm) ||
        constructor.drivers.toLowerCase().includes(searchTerm) ||
        constructor.position.toString().includes(searchTerm)
    );

    displayConstructors(filtered);
}

// Update stats
function updateStats() {
    const totalConstructors = allConstructors.length;
    const totalPoints = allConstructors.reduce((sum, c) => sum + (c.points || 0), 0);
    const totalWins = allConstructors.reduce((sum, c) => sum + (c.wins || 0), 0);

    elements.totalConstructors.textContent = totalConstructors;
    elements.totalPoints.textContent = totalPoints;
    elements.totalWins.textContent = totalWins;
}

// Update counts
function updateCounts(count) {
    elements.showingCount.textContent = count;
    elements.totalCount.textContent = allConstructors.length;
}

// Refresh constructors
function refreshConstructors() {
    loadConstructors();
    showToast('Constructors list refreshed');
}

// Export constructors
function exportConstructors() {
    const dataStr = JSON.stringify(allConstructors, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `constructors-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showToast('Constructors exported successfully!');
}

// Show loading state
function showLoading() {
    elements.constructorsList.innerHTML = `
        <tr class="loading-row">
            <td colspan="7">
                <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Loading constructors...</span>
                </div>
            </td>
        </tr>
    `;
}

// Show empty state
function showEmptyState() {
    elements.constructorsList.innerHTML = `
        <tr>
            <td colspan="7">
                <div class="empty-state">
                    <i class="fas fa-trophy"></i>
                    <h3>No Constructors Found</h3>
                    <p>Add your first constructor using the form above!</p>
                </div>
            </td>
        </tr>
    `;
    updateCounts(0);
}

// Show toast notification
function showToast(message) {
    elements.toastMessage.textContent = message;
    elements.toast.style.display = 'flex';
    
    setTimeout(() => {
        elements.toast.style.display = 'none';
    }, 3000);
}

// Show error message
function showError(message) {
    alert(`Error: ${message}`);
}

// Validate form
function validateForm() {
    if (!elements.team.value.trim()) {
        showError('Team name is required');
        elements.team.focus();
        return false;
    }
    
    if (!elements.pos.value || elements.pos.value < 1) {
        showError('Position must be at least 1');
        elements.pos.focus();
        return false;
    }
    
    if (!elements.drivers.value.trim()) {
        showError('Drivers are required');
        elements.drivers.focus();
        return false;
    }
    
    return true;
}

// Scroll to form
function scrollToForm() {
    document.querySelector('.form-card').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
}

// Close modal on outside click
window.onclick = function(event) {
    if (event.target === elements.confirmModal) {
        closeModal();
    }
};

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveConstructor();
    }
    
    if (e.key === 'Escape') {
        closeModal();
        resetForm();
    }
    
    if (e.key === 'Enter' && e.ctrlKey) {
        saveConstructor();
    }
});