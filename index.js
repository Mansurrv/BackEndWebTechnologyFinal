const express = require('express');
const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.get('/', (req, res) => {
  res.send(`
    <h1>Server is running!</h1>
    <ul>
      <li><a href="/hello?name=Alex">/hello?name=Alex</a></li>
      <li><a href="/hello">/hello (missing name)</a></li>
      <li><a href="/sum?a=5&b=3">/sum?a=5&b=3</a></li>
      <li><a href="/sum?a=5">/sum?a=5 (missing b)</a></li>
      <li><a href="/user/123">/user/123</a></li>
      <li><a href="/status">/status</a></li>
      <li><a href="/unknown">/unknown (404 test)</a></li>
    </ul>
  `);
});

app.get('/hello', (req, res) => {
  const name = req.query.name;
  if (!name) {
    return res.status(400).json({ error: "Missing 'name' query parameter" });
  }
  res.json({ message: `Hello, ${name}` });
});

app.get('/sum', (req, res) => {
  const a = parseFloat(req.query.a);
  const b = parseFloat(req.query.b);

  if (isNaN(a) || isNaN(b)) {
    return res.status(400).json({ error: "Both 'a' and 'b' must be valid numbers" });
  }

  res.json({ sum: a + b });
});

app.get('/user/:id', (req, res) => {
  const id = req.params.id;
  res.json({ id: id, role: 'user' });
});

app.get('/status', (req, res) => {
  res.json({
    status: 'Server is running',
    time: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).send('404 - Page not found');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});


// ================= Constructor Manager Static Files =================
app.get('/js/constructors.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
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
        if (elements.color) {
            elements.color.addEventListener('input', updateColorPreview);
            updateColorPreview();
        }
        
        // Attach event listeners to buttons
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
          if (button.textContent.includes('Save Constructor')) {
            button.addEventListener('click', saveConstructor);
          } else if (button.textContent.includes('Refresh')) {
            button.addEventListener('click', refreshConstructors);
          } else if (button.textContent.includes('Export')) {
            button.addEventListener('click', exportConstructors);
          } else if (button.textContent.includes('Reset Form')) {
            button.addEventListener('click', resetForm);
          }
        });
        
        // Attach to search input
        if (elements.searchInput) {
          elements.searchInput.addEventListener('input', filterConstructors);
        }
    });

    // Event Listeners
    function setupEventListeners() {
        if (elements.confirmDeleteBtn) {
            elements.confirmDeleteBtn.addEventListener('click', confirmDelete);
        }
    }

    // Load all constructors
    async function loadConstructors() {
        try {
            showLoading();
            const response = await fetch(API_URL);
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
        
        if (elements.constructorsList) {
            elements.constructorsList.innerHTML = sortedConstructors.map(constructor => \`
                <tr data-id="\${constructor._id}">
                    <td><div class="position-badge">\${constructor.position}</div></td>
                    <td>
                        <div class="team-cell">
                            <div class="team-color" style="background-color: \${constructor.color || '#FF0000'}"></div>
                            <strong>\${constructor.team}</strong>
                        </div>
                    </td>
                    <td><div class="driver-badge">\${constructor.drivers}</div></td>
                    <td><div class="points-badge">\${constructor.points || 0}</div></td>
                    <td><div class="wins-badge">\${constructor.wins || 0}</div></td>
                    <td><div class="podiums-badge">\${constructor.podiums || 0}</div></td>
                    <td class="actions-cell">
                        <button class="action-btn edit-btn" data-id="\${constructor._id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="action-btn delete-btn" data-id="\${constructor._id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            \`).join('');
            
            // Attach event listeners to dynamically created buttons
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    editConstructor(this.getAttribute('data-id'));
                });
            });
            
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    showDeleteConfirm(this.getAttribute('data-id'));
                });
            });
        }
        updateCounts(constructors.length);
    }

    // Save Constructor (Create or Update)
    async function saveConstructor() {
        if (!validateForm()) return;

        const constructorData = {
            position: parseInt(elements.pos.value),
            team: elements.team.value.trim(),
            color: elements.color.value,
            drivers: elements.drivers.value.trim(),
            points: parseInt(elements.points.value) || 0,
            wins: parseInt(elements.wins.value) || 0,
            podiums: parseInt(elements.podiums.value) || 0,
            season: 2024
        };

        const method = currentConstructorId ? 'PUT' : 'POST';
        const url = currentConstructorId ? \`\${API_URL}/\${currentConstructorId}\` : API_URL;

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(constructorData)
            });
            const result = await response.json();

            if (response.ok && result.success) {
                showToast(currentConstructorId ? 'Constructor updated!' : 'Constructor created!');
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
            const response = await fetch(\`\${API_URL}/\${id}\`);
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
                elements.formMode.style.background = '#f59e0b';
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
        if (elements.confirmModal) {
            elements.confirmModal.style.display = 'flex';
        }
    }

    // Confirm delete
    async function confirmDelete() {
        if (!currentConstructorId) return;
        try {
            const response = await fetch(\`\${API_URL}/\${currentConstructorId}\`, {
                method: 'DELETE'
            });
            const result = await response.json();

            if (response.ok && result.success) {
                showToast('Constructor deleted!');
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
        if (elements.confirmModal) {
            elements.confirmModal.style.display = 'none';
        }
        currentConstructorId = null;
    }

    // Reset form
    function resetForm() {
        if (!elements.team) return;
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
        elements.formMode.style.background = '#dc0000';
        updateColorPreview();
    }

    // Update color preview
    function updateColorPreview() {
        if (elements.colorPreview && elements.color) {
            elements.colorPreview.style.background = elements.color.value;
        }
    }

    // Filter constructors
    function filterConstructors() {
        if (!elements.searchInput) return;
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
        if (!allConstructors.length) return;
        const totalConstructors = allConstructors.length;
        const totalPoints = allConstructors.reduce((sum, c) => sum + (c.points || 0), 0);
        const totalWins = allConstructors.reduce((sum, c) => sum + (c.wins || 0), 0);

        if (elements.totalConstructors) elements.totalConstructors.textContent = totalConstructors;
        if (elements.totalPoints) elements.totalPoints.textContent = totalPoints;
        if (elements.totalWins) elements.totalWins.textContent = totalWins;
    }

    // Update counts
    function updateCounts(count) {
        if (elements.showingCount) elements.showingCount.textContent = count;
        if (elements.totalCount) elements.totalCount.textContent = allConstructors.length;
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
        const exportFileDefaultName = \`constructors-\${new Date().toISOString().split('T')[0]}.json\`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        showToast('Constructors exported!');
    }

    // Show loading state
    function showLoading() {
        if (elements.constructorsList) {
            elements.constructorsList.innerHTML = \`
                <tr class="loading-row">
                    <td colspan="7">
                        <div class="loading-spinner">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>Loading constructors...</span>
                        </div>
                    </td>
                </tr>
            \`;
        }
    }

    // Show empty state
    function showEmptyState() {
        if (elements.constructorsList) {
            elements.constructorsList.innerHTML = \`
                <tr>
                    <td colspan="7">
                        <div class="empty-state">
                            <i class="fas fa-trophy"></i>
                            <h3>No Constructors Found</h3>
                            <p>Add your first constructor using the form above!</p>
                        </div>
                    </td>
                </tr>
            \`;
        }
        updateCounts(0);
    }

    // Show toast notification
    function showToast(message) {
        if (!elements.toast || !elements.toastMessage) return;
        elements.toastMessage.textContent = message;
        elements.toast.style.display = 'flex';
        setTimeout(() => {
            elements.toast.style.display = 'none';
        }, 3000);
    }

    // Show error message
    function showError(message) {
        alert(\`Error: \${message}\`);
    }

    // Validate form
    function validateForm() {
        if (!elements.team || !elements.team.value.trim()) {
            showError('Team name is required');
            if (elements.team) elements.team.focus();
            return false;
        }
        if (!elements.pos || !elements.pos.value || elements.pos.value < 1) {
            showError('Position must be at least 1');
            if (elements.pos) elements.pos.focus();
            return false;
        }
        if (!elements.drivers || !elements.drivers.value.trim()) {
            showError('Drivers are required');
            if (elements.drivers) elements.drivers.focus();
            return false;
        }
        return true;
    }

    // Scroll to form
    function scrollToForm() {
        const formCard = document.querySelector('.form-card');
        if (formCard) {
            formCard.scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    // Close modal on outside click
    window.onclick = function(event) {
        if (elements.confirmModal && event.target === elements.confirmModal) {
            closeModal();
        }
    };

    // Make functions available globally
    window.saveConstructor = saveConstructor;
    window.editConstructor = editConstructor;
    window.showDeleteConfirm = showDeleteConfirm;
    window.filterConstructors = filterConstructors;
    window.refreshConstructors = refreshConstructors;
    window.exportConstructors = exportConstructors;
    window.resetForm = resetForm;
    window.closeModal = closeModal;
  `);
});
