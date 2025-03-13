// Common authentication functions for all pages

// Initialize authentication
function initializeAuth() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  console.log('Auth initialization - Token exists:', !!token);
  console.log('Auth initialization - User:', user);
  
  // Update navigation based on authentication status
  updateAuthNavigation();
}

// Update navigation based on authentication status
function updateAuthNavigation() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const authNavItem = document.getElementById('auth-nav-item');
  
  if (!authNavItem) {
    console.error('Auth nav item not found');
    return;
  }
  
  if (token) {
    // User is logged in
    authNavItem.innerHTML = `
      <div class="dropdown">
        <a class="nav-link dropdown-toggle" href="#" role="button" id="userDropdown" data-bs-toggle="dropdown" aria-expanded="false">
          <span id="username-display">${user.username || 'User'}</span>
        </a>
        <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
          <li><a class="dropdown-item" href="/profile">My Profile</a></li>
          <li><a class="dropdown-item" href="/tournaments">My Tournaments</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item" href="#" id="logout-btn">Logout</a></li>
        </ul>
      </div>
    `;
    
    // Add event listener to logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        // Clear authentication data
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('user');
        localStorage.removeItem('currentTournamentId');
        // Redirect to home page
        window.location.href = '/';
      });
    }
  } else {
    // User is not logged in
    authNavItem.innerHTML = `
      <a class="nav-link" href="/login">Login</a>
    `;
  }
}

// Function to fetch user data
async function fetchUserData(token) {
  try {
    const response = await fetch('/api/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user data');
    }
    
    const userData = await response.json();
    // Use the user's actual name - prioritize full name, then firstName, then username
    let displayName;
    if (userData.data.firstName && userData.data.lastName) {
      displayName = `${userData.data.firstName} ${userData.data.lastName}`;
    } else if (userData.data.firstName) {
      displayName = userData.data.firstName;
    } else if (userData.data.username) {
      displayName = userData.data.username;
    } else if (userData.data.email) {
      // Use email name part if nothing else is available
      displayName = userData.data.email.split('@')[0];
    } else {
      displayName = 'Player';
    }
    
    // Store user's name in localStorage for future use
    localStorage.setItem('username', displayName);
    
    // Update navigation with username
    updateNavWithUsername(displayName);
  } catch (error) {
    console.error('Error fetching user data:', error);
    // If we can't get the user data, try to use email from token if it's a JWT
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const tokenPayload = JSON.parse(atob(tokenParts[1]));
        if (tokenPayload.email) {
          const emailName = tokenPayload.email.split('@')[0];
          localStorage.setItem('username', emailName);
          updateNavWithUsername(emailName);
          return;
        }
      }
    } catch (e) {
      console.error('Error parsing token:', e);
    }
    
    // Last resort fallback
    updateNavWithUsername('Player');
  }
}

// Function to update navigation with username
function updateNavWithUsername(username) {
  const authNavItem = document.getElementById('auth-nav-item');
  if (!authNavItem) return;
  
  authNavItem.innerHTML = `
    <div class="dropdown">
      <a class="nav-link dropdown-toggle" href="#" role="button" id="profileDropdown" data-bs-toggle="dropdown" aria-expanded="false">
        ${username}
      </a>
      <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="profileDropdown">
        <li><a class="dropdown-item" href="/profile">My Profile</a></li>
        <li><a class="dropdown-item" href="/my-tournaments">My Tournaments</a></li>
        <li><hr class="dropdown-divider"></li>
        <li><a class="dropdown-item" href="#" id="logout-btn">Logout</a></li>
      </ul>
    </div>
  `;
  
  // Add logout functionality
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('user');
      localStorage.removeItem('currentTournamentId');
      window.location.href = '/';
    });
  }
}

// Initialize authentication when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeAuth); 