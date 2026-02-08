// Auth Modal Management
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const closeLoginModal = document.getElementById('closeLoginModal');
const closeRegisterModal = document.getElementById('closeRegisterModal');
const showRegisterFromLogin = document.getElementById('showRegisterFromLogin');
const showLoginFromRegister = document.getElementById('showLoginFromRegister');

// User status elements
const userStatus = document.getElementById('userStatus');
const authButtons = document.getElementById('authButtons');
const usernameDisplay = document.getElementById('usernameDisplay');
const logoutBtn = document.getElementById('logoutBtn');

const adminNavLinks = [
    { href: '/admin', label: 'Admin' },
    { href: '/sqll', label: 'Datas' },
    { href: '/add', label: 'Add' }
];

// Check if user is logged in on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    setupModalEventListeners();
    addModalStyles();
});

// Setup all modal event listeners
function setupModalEventListeners() {
    // Open modals
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            loginModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }

    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            registerModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }

    // Close modals
    if (closeLoginModal) {
        closeLoginModal.addEventListener('click', () => {
            loginModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    }

    if (closeRegisterModal) {
        closeRegisterModal.addEventListener('click', () => {
            registerModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    }

    // Switch between modals
    if (showRegisterFromLogin) {
        showRegisterFromLogin.addEventListener('click', (e) => {
            e.preventDefault();
            loginModal.classList.remove('active');
            registerModal.classList.add('active');
        });
    }

    if (showLoginFromRegister) {
        showLoginFromRegister.addEventListener('click', (e) => {
            e.preventDefault();
            registerModal.classList.remove('active');
            loginModal.classList.add('active');
        });
    }

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
        if (e.target === registerModal) {
            registerModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    });

    // Close modals with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            loginModal.classList.remove('active');
            registerModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    });

    // Login form submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleLogin();
        });
    }

    // Register form submission
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleRegister();
        });
    }

    // Logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await logout();
        });
    }
}

// Check authentication status
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/status', {
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            if (data.authenticated) {
                showUserStatus(data.user);
            } else {
                showAuthButtons();
            }
        } else {
            showAuthButtons();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        showAuthButtons();
    }
}

// Show user status when logged in
function showUserStatus(user) {
    if (userStatus && authButtons) {
        userStatus.style.display = 'block';
        authButtons.style.display = 'none';
        if (usernameDisplay) {
            usernameDisplay.textContent = user.username;
        }
        syncAdminNavLinks(user);
        updateMobileMenuForLoggedInUser(user);
    }
}

// Show auth buttons when not logged in
function showAuthButtons() {
    if (userStatus && authButtons) {
        userStatus.style.display = 'none';
        authButtons.style.display = 'flex';
        syncAdminNavLinks(null);
        updateMobileMenuForLoggedOutUser();
    }
}

function syncAdminNavLinks(user) {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    navLinks.querySelectorAll('.admin-only').forEach((item) => item.remove());

    if (!user || user.role !== 'admin') return;

    const mongoLink = navLinks.querySelector('a[href="/mongo"], a[href="mongo"]');
    const mongoItem = mongoLink ? mongoLink.closest('li') : null;
    const insertBeforeNode = mongoItem ? mongoItem.nextElementSibling : navLinks.querySelector('.theme-toggle');

    adminNavLinks.forEach((link) => {
        const li = document.createElement('li');
        li.className = 'admin-only';
        li.innerHTML = `<a href="${link.href}">${link.label}</a>`;
        if (insertBeforeNode) {
            navLinks.insertBefore(li, insertBeforeNode);
        } else {
            navLinks.appendChild(li);
        }
    });
}

// Update mobile menu for logged in user
function updateMobileMenuForLoggedInUser(user) {
    const mobileMenu = document.querySelector('.nav-links');
    if (!mobileMenu) return;

    const existingAuthItems = mobileMenu.querySelectorAll('.mobile-auth-item');
    existingAuthItems.forEach(item => item.remove());

    const profileItem = document.createElement('li');
    profileItem.className = 'mobile-auth-item';
    profileItem.innerHTML = `
        <a href="/dashboard" class="mobile-user-item">
            <i class="fas fa-id-badge"></i> Profile
        </a>
    `;

    const logoutItem = document.createElement('li');
    logoutItem.className = 'mobile-auth-item';
    logoutItem.innerHTML = `
        <a href="#" id="mobileLogoutBtn">
            <i class="fas fa-sign-out-alt"></i> Logout
        </a>
    `;

    const themeToggle = mobileMenu.querySelector('.theme-toggle');
    if (themeToggle) {
        mobileMenu.insertBefore(profileItem, themeToggle);
        mobileMenu.insertBefore(logoutItem, themeToggle);
    } else {
        mobileMenu.appendChild(profileItem);
        mobileMenu.appendChild(logoutItem);
    }

    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
}

// Update mobile menu for logged out user
function updateMobileMenuForLoggedOutUser() {
    const mobileMenu = document.querySelector('.nav-links');
    if (!mobileMenu) return;

    const existingAuthItems = mobileMenu.querySelectorAll('.mobile-auth-item');
    existingAuthItems.forEach(item => item.remove());

    const loginItem = document.createElement('li');
    loginItem.className = 'mobile-auth-item';
    loginItem.innerHTML = `
        <a href="#" id="mobileLoginBtn">
            <i class="fas fa-sign-in-alt"></i> Login
        </a>
    `;

    const registerItem = document.createElement('li');
    registerItem.className = 'mobile-auth-item';
    registerItem.innerHTML = `
        <a href="#" id="mobileRegisterBtn">
            <i class="fas fa-user-plus"></i> Register
        </a>
    `;

    const themeToggle = mobileMenu.querySelector('.theme-toggle');
    if (themeToggle) {
        mobileMenu.insertBefore(loginItem, themeToggle);
        mobileMenu.insertBefore(registerItem, themeToggle);
    } else {
        mobileMenu.appendChild(loginItem);
        mobileMenu.appendChild(registerItem);
    }

    const mobileLoginBtn = document.getElementById('mobileLoginBtn');
    if (mobileLoginBtn) {
        mobileLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loginModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            document.querySelector('.nav-links').classList.remove('active');
        });
    }

    const mobileRegisterBtn = document.getElementById('mobileRegisterBtn');
    if (mobileRegisterBtn) {
        mobileRegisterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            registerModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            document.querySelector('.nav-links').classList.remove('active');
        });
    }
}

// Handle login form submission
async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorElement = document.getElementById('loginError');
    const successElement = document.getElementById('loginSuccess');
    const submitBtn = document.querySelector('#loginForm button[type="submit"]');

    errorElement.style.display = 'none';
    successElement.style.display = 'none';

    if (!email || !password) {
        errorElement.textContent = 'Please fill in all fields';
        errorElement.style.display = 'flex';
        return;
    }

    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            successElement.textContent = data.message || 'Login successful!';
            successElement.style.display = 'flex';
            showUserStatus(data.user);
            document.getElementById('loginForm').reset();

            setTimeout(() => {
                loginModal.classList.remove('active');
                document.body.style.overflow = 'auto';
            }, 1500);
        } else {
            errorElement.textContent = data.message || 'Login failed';
            errorElement.style.display = 'flex';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorElement.textContent = 'Login failed. Please try again.';
        errorElement.style.display = 'flex';
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Handle register form submission
async function handleRegister() {
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const errorElement = document.getElementById('registerError');
    const successElement = document.getElementById('registerSuccess');
    const submitBtn = document.querySelector('#registerForm button[type="submit"]');

    errorElement.style.display = 'none';
    successElement.style.display = 'none';

    if (!username || !email || !password || !confirmPassword) {
        errorElement.textContent = 'Please fill in all fields';
        errorElement.style.display = 'flex';
        return;
    }

    if (password !== confirmPassword) {
        errorElement.textContent = 'Passwords do not match';
        errorElement.style.display = 'flex';
        return;
    }

    if (password.length < 8) {
        errorElement.textContent = 'Password must be at least 8 characters long';
        errorElement.style.display = 'flex';
        return;
    }

    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password, confirmPassword }),
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            successElement.textContent = data.message || 'Registration successful!';
            successElement.style.display = 'flex';
            document.getElementById('registerForm').reset();

            if (data.user) {
                showUserStatus(data.user);

                setTimeout(() => {
                    registerModal.classList.remove('active');
                    document.body.style.overflow = 'auto';
                    successElement.style.display = 'none';
                }, 1000);
            } else {
                setTimeout(() => {
                    registerModal.classList.remove('active');
                    loginModal.classList.add('active');
                    successElement.style.display = 'none';
                }, 2000);
            }
        } else {
            errorElement.textContent = data.message || 'Registration failed';
            errorElement.style.display = 'flex';
        }
    } catch (error) {
        console.error('Registration error:', error);
        errorElement.textContent = 'Registration failed. Please try again.';
        errorElement.style.display = 'flex';
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Password validation for register form
function validateRegisterPassword() {
    const password = document.getElementById('registerPassword');
    const confirmPassword = document.getElementById('registerConfirmPassword');
    const matchMessage = document.getElementById('passwordMatchMessage');

    if (!password || !confirmPassword || !matchMessage) return;

    if (confirmPassword.value && password.value !== confirmPassword.value) {
        matchMessage.style.display = 'block';
    } else {
        matchMessage.style.display = 'none';
    }
}

window.validateRegisterPassword = validateRegisterPassword;

// Logout functionality
async function logout() {
    try {
        const response = await fetch('/logout', {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            showAuthButtons();
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Add CSS for modal functionality
function addModalStyles() {
    if (document.getElementById('modal-styles')) return;

    const modalStyles = `
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 1000;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(5px);
        }

        .modal.active {
            display: flex;
        }

        .modal-content {
            background: var(--card-bg);
            border-radius: 15px;
            width: 100%;
            max-width: 450px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            border: 1px solid var(--border-color);
            animation: modalSlideIn 0.3s ease;
        }

        @keyframes modalSlideIn {
            from {
                opacity: 0;
                transform: translateY(-50px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 25px 30px;
            border-bottom: 1px solid var(--border-color);
        }

        .modal-header h2 {
            margin: 0;
            color: var(--text-primary);
            font-family: Arial, sans-serif;
            font-size: 1.5rem;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .modal-close {
            background: none;
            border: none;
            color: var(--text-secondary);
            font-size: 28px;
            cursor: pointer;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.3s ease;
        }

        .modal-close:hover {
            background: var(--bg-light);
            color: var(--primary-color);
        }

        .modal-body {
            padding: 30px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: var(--text-primary);
            font-weight: 500;
            font-size: 0.95rem;
        }

        .form-group input {
            width: 100%;
            padding: 12px 15px;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            background: var(--bg-light);
            color: var(--text-primary);
            font-size: 1rem;
            transition: all 0.3s ease;
            box-sizing: border-box;
        }

        .form-group input:focus {
            outline: none;
            border-color: var(--primary-color);
            box-shadow: 0 0 0 3px rgba(220, 0, 0, 0.1);
        }

        .password-hint {
            font-size: 0.85rem;
            color: var(--text-secondary);
            margin-top: 5px;
        }

        .btn-block {
            width: 100%;
            padding: 14px;
        }

        .error-message {
            background: rgba(220, 53, 69, 0.1);
            border: 1px solid rgba(220, 53, 69, 0.3);
            color: #dc3545;
            padding: 12px 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .success-message {
            background: rgba(25, 135, 84, 0.1);
            border: 1px solid rgba(25, 135, 84, 0.3);
            color: #198754;
            padding: 12px 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .user-menu {
            position: relative;
            display: inline-block;
        }

        .user-welcome {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 15px;
            background: var(--bg-light);
            border-radius: 20px;
            color: var(--text-primary);
            text-decoration: none;
            transition: all 0.3s ease;
        }

        .user-welcome:hover {
            background: var(--primary-color);
            color: white;
        }

        .user-welcome i {
            font-size: 0.9rem;
        }

        .dropdown-menu {
            display: none;
            position: absolute;
            top: 100%;
            right: 0;
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            min-width: 180px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            z-index: 100;
            margin-top: 10px;
        }

        .user-menu:hover .dropdown-menu {
            display: block;
        }

        .dropdown-item {
            display: block;
            padding: 12px 15px;
            color: var(--text-primary);
            text-decoration: none;
            transition: all 0.3s ease;
            border-bottom: 1px solid var(--border-color);
        }

        .dropdown-item:last-child {
            border-bottom: none;
        }

        .dropdown-item:hover {
            background: var(--primary-color);
            color: white;
        }

        .dropdown-item i {
            margin-right: 10px;
            width: 20px;
            text-align: center;
        }

        .btn-small {
            padding: 8px 15px;
            font-size: 0.9rem;
        }

        #authButtons {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .auth-links {
            text-align: center;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid var(--border-color);
        }

        .auth-links a {
            color: var(--primary-color);
            text-decoration: none;
            font-weight: 500;
            transition: color 0.3s ease;
        }

        .auth-links a:hover {
            text-decoration: underline;
        }

        .mobile-auth-item {
            display: none;
        }

        @media (max-width: 768px) {
            .modal-content {
                width: 95%;
                margin: 10px;
            }

            #authButtons {
                display: none;
            }

            .mobile-auth-item {
                display: block;
            }

            .user-menu .dropdown-menu {
                position: static;
                margin-top: 0;
                box-shadow: none;
                border: none;
                background: transparent;
            }

            .user-menu:hover .dropdown-menu {
                display: none;
            }

            .user-menu.active .dropdown-menu {
                display: block;
            }
        }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.id = 'modal-styles';
    styleSheet.textContent = modalStyles;
    document.head.appendChild(styleSheet);
}
