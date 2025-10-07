/**
 * Profile menu interactions (top-right account dropdown)
 */

let profileMenuInitialized = false;

export function initializeProfileMenu() {
  if (profileMenuInitialized) return;

  const profileBtn = document.getElementById('profileBtn');
  const profileMenu = document.getElementById('profileMenu');
  const profileName = document.getElementById('profileName');
  const profileMenuLoggedIn = document.getElementById('profileMenuLoggedIn');
  const profileMenuLoggedOut = document.getElementById('profileMenuLoggedOut');
  const adminMenuItem = document.getElementById('adminMenuItem');
  const adminBanner = document.querySelector('#adminNav');

  if (!profileBtn || !profileMenu || !profileName || !profileMenuLoggedIn || !profileMenuLoggedOut) {
    return;
  }

  const updateProfileDisplay = () => {
    const username = window.localStorage?.getItem('username');
    const token = window.localStorage?.getItem('token');
    const role = window.localStorage?.getItem('role');

    if (token && username) {
      profileName.textContent = username;
      profileMenuLoggedIn.style.display = 'block';
      profileMenuLoggedOut.style.display = 'none';
      if (adminMenuItem) {
        adminMenuItem.style.display = role === 'admin' ? 'flex' : 'none';
      }
      if (adminBanner) {
        adminBanner.style.display = role === 'admin' ? 'block' : 'none';
      }
    } else {
      profileName.textContent = 'Guest';
      profileMenuLoggedIn.style.display = 'none';
      profileMenuLoggedOut.style.display = 'block';
      if (adminMenuItem) {
        adminMenuItem.style.display = 'none';
      }
      if (adminBanner) {
        adminBanner.style.display = 'none';
      }
    }
  };

  const toggleMenu = (event) => {
    event.stopPropagation();
    const isOpen = profileMenu.classList.contains('active');
    profileMenu.classList.toggle('active');
    profileBtn.setAttribute('aria-expanded', (!isOpen).toString());
  };

  const closeMenu = () => {
    profileMenu.classList.remove('active');
    profileBtn.setAttribute('aria-expanded', 'false');
  };

  profileBtn.addEventListener('click', toggleMenu);

  document.addEventListener('click', (event) => {
    if (!profileBtn.contains(event.target) && !profileMenu.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && profileMenu.classList.contains('active')) {
      closeMenu();
    }
  });

  updateProfileDisplay();
  window.addEventListener('storage', updateProfileDisplay);

  profileMenuInitialized = true;
}
