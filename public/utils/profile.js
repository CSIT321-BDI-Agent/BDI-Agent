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

  const showElement = (element, displayClass = 'flex') => {
    if (!element) return;
    element.classList.remove('hidden');
    if (displayClass) {
      element.classList.add(displayClass);
    }
  };

  const hideElement = (element, displayClass = 'flex') => {
    if (!element) return;
    element.classList.add('hidden');
    if (displayClass) {
      element.classList.remove(displayClass);
    }
  };

  const updateProfileDisplay = () => {
    const username = window.localStorage?.getItem('username');
    const token = window.localStorage?.getItem('token');
    const role = window.localStorage?.getItem('role');

    if (token && username) {
      profileName.textContent = username;
      showElement(profileMenuLoggedIn, 'flex');
      hideElement(profileMenuLoggedOut, 'flex');
      if (adminMenuItem) {
        if (role === 'admin') {
          showElement(adminMenuItem, 'flex');
        } else {
          hideElement(adminMenuItem, 'flex');
        }
      }
      if (adminBanner) {
        if (role === 'admin') {
          showElement(adminBanner, 'flex');
        } else {
          hideElement(adminBanner, 'flex');
        }
      }
    } else {
      profileName.textContent = 'Guest';
      hideElement(profileMenuLoggedIn, 'flex');
      showElement(profileMenuLoggedOut, 'flex');
      if (adminMenuItem) {
        hideElement(adminMenuItem, 'flex');
      }
      if (adminBanner) {
        hideElement(adminBanner, 'flex');
      }
    }
  };

  const toggleMenu = (event) => {
    event.stopPropagation();
    const isOpen = !profileMenu.classList.contains('hidden');
    profileMenu.classList.toggle('hidden');
    profileBtn.setAttribute('aria-expanded', (!isOpen).toString());
  };

  const closeMenu = () => {
    profileMenu.classList.add('hidden');
    profileBtn.setAttribute('aria-expanded', 'false');
  };

  profileBtn.addEventListener('click', toggleMenu);

  document.addEventListener('click', (event) => {
    if (!profileBtn.contains(event.target) && !profileMenu.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !profileMenu.classList.contains('hidden')) {
      closeMenu();
    }
  });

  updateProfileDisplay();
  window.addEventListener('storage', updateProfileDisplay);

  profileMenuInitialized = true;
}
