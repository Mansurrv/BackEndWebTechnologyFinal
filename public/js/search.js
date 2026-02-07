document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  const resultsContainer = document.getElementById('results');
  const loadingElement = document.querySelector('.loading');

  if (!searchInput || !resultsContainer) return;

  let searchTimeout;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    // Clear previous timeout
    clearTimeout(searchTimeout);
    
    // Clear results if query is too short
    if (query.length < 2) {
      resultsContainer.innerHTML = '';
      resultsContainer.style.display = 'none';
      return;
    }
    
    // Show loading
    if (loadingElement) {
      loadingElement.style.display = 'block';
    }
    
    // Set new timeout for debouncing
    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 300);
  });

  // Hide results when clicking outside
  document.addEventListener('click', (e) => {
    if (!resultsContainer.contains(e.target) && e.target !== searchInput) {
      resultsContainer.style.display = 'none';
    }
  });

  async function performSearch(query) {
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const results = await response.json();
      
      // Handle both array and object responses
      const resultsArray = Array.isArray(results) 
        ? results 
        : (results.data || []);
      
      displayResults(resultsArray);
      
    } catch (error) {
      console.error('Search error:', error);
      resultsContainer.innerHTML = `
        <div class="search-error">
          Search temporarily unavailable
        </div>
      `;
      resultsContainer.style.display = 'block';
    } finally {
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
    }
  }

  function displayResults(results) {
    if (!Array.isArray(results) || results.length === 0) {
      resultsContainer.innerHTML = `
        <div class="no-results">
          No results found
        </div>
      `;
      resultsContainer.style.display = 'block';
      return;
    }

    const resultsHTML = results.map(item => `
      <div class="search-result-item" data-type="${item.type}" data-id="${item.id}">
        <div class="result-header">
          <span class="result-type ${item.type}">${item.type}</span>
          <h3 class="result-name">${item.name}</h3>
        </div>
        <div class="result-details">
          <p class="result-description">${item.description || ''}</p>
          <p class="result-meta">${item.detail || ''}</p>
        </div>
      </div>
    `).join('');

    resultsContainer.innerHTML = resultsHTML;
    resultsContainer.style.display = 'block';

    // Add click handlers
    document.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const type = item.dataset.type;
        const id = item.dataset.id;
        
        if (type === 'driver') {
          window.location.href = `/driversPage`;
        } else if (type === 'constructor') {
          window.location.href = `/constructorsPage`;
        }
      });
    });
  }
});