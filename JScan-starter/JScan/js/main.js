(() => {
    'use strict';

    const root = document.documentElement;
    const header = document.querySelector('.site-header');

    // ==========================================
    // 1. THEME SETTINGS
    // ==========================================

    let savedTheme = null;

    try {
        savedTheme = localStorage.getItem('jscan-theme');
    } catch (error) {
        console.warn('JScan: Unable to access saved theme.', error);
    }

    root.dataset.theme = savedTheme || (
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
    );

    function updateThemeButton() {
        document.querySelectorAll('[data-theme-toggle]').forEach(button => {
            button.textContent = root.dataset.theme === 'dark' ? '☀' : '☾';
            button.setAttribute(
                'aria-label',
                root.dataset.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            );
        });
    }

    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
        button.addEventListener('click', () => {
            root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';

            try {
                localStorage.setItem('jscan-theme', root.dataset.theme);
            } catch (error) {
                console.warn('JScan: Unable to save theme.', error);
            }

            updateThemeButton();
        });
    });

    updateThemeButton();

    // ==========================================
    // 2. STANDARDIZE THE HEADER ON EVERY PAGE
    // ==========================================

    let nav = header?.querySelector('.main-nav');
    let headerActions = header?.querySelector('.header-actions');

    if (header && !headerActions) {
        headerActions = document.createElement('div');
        headerActions.className = 'header-actions';
        header.appendChild(headerActions);
    }

    if (header && !nav) {
        nav = document.createElement('nav');
        nav.className = 'main-nav';
        nav.setAttribute('aria-label', 'Main navigation');
        header.insertBefore(nav, headerActions || null);
    }

    function ensureNavLink(href, label) {
        if (!nav) return null;

        let link = nav.querySelector(`a[href="${href}"]`);

        if (!link) {
            link = document.createElement('a');
            link.href = href;
            link.textContent = label;
            nav.appendChild(link);
        }

        return link;
    }

    if (nav) {
        ensureNavLink('index.html', 'Home');
        ensureNavLink('tools.html', 'Explore tools');
        ensureNavLink('about.html', 'About');
        ensureNavLink('contact.html', 'Contact');
    }

    // Keep the hamburger beside the theme toggle in the header actions.
    let menu = header?.querySelector('.menu-toggle');

    if (header && headerActions && !menu) {
        menu = document.createElement('button');
        menu.type = 'button';
        menu.className = 'menu-toggle';
        menu.textContent = '☰';
        menu.setAttribute('aria-controls', 'mainNavigation');
        headerActions.appendChild(menu);
    } else if (menu && headerActions && menu.parentElement !== headerActions) {
        headerActions.appendChild(menu);
    }

    if (nav && !nav.id) nav.id = 'mainNavigation';
    if (menu && nav) menu.setAttribute('aria-controls', nav.id);

    // Mobile-only account links live inside the dropdown navigation.
    let mobileAuthLinks = nav?.querySelector('.mobile-auth-links');

    if (nav && !mobileAuthLinks) {
        mobileAuthLinks = document.createElement('div');
        mobileAuthLinks.className = 'mobile-auth-links';
        nav.appendChild(mobileAuthLinks);
    }

    // Ensure desktop login/register controls exist on pages that do not have them.
    function ensureDesktopAuthLink(href, label, className) {
        if (!headerActions) return null;

        let link = headerActions.querySelector(`a[href="${href}"]`);

        if (!link) {
            link = document.createElement('a');
            link.href = href;
            link.textContent = label;
            link.className = className;

            const themeButton = headerActions.querySelector('[data-theme-toggle]');
            headerActions.insertBefore(link, themeButton || menu || null);
        }

        return link;
    }

    const desktopLogin = ensureDesktopAuthLink('login.html', 'Log in', 'btn btn-ghost');
    const desktopRegister = ensureDesktopAuthLink('register.html', 'Create account', 'btn btn-primary');

    // Ensure the theme control exists and remains before the hamburger.
    let themeButton = headerActions?.querySelector('[data-theme-toggle]');

    if (headerActions && !themeButton) {
        themeButton = document.createElement('button');
        themeButton.type = 'button';
        themeButton.className = 'icon-btn';
        themeButton.setAttribute('data-theme-toggle', '');
        themeButton.setAttribute('aria-label', 'Toggle theme');
        themeButton.textContent = root.dataset.theme === 'dark' ? '☀' : '☾';

        headerActions.insertBefore(themeButton, menu || null);

        themeButton.addEventListener('click', () => {
            root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';

            try {
                localStorage.setItem('jscan-theme', root.dataset.theme);
            } catch (error) {
                console.warn('JScan: Unable to save theme.', error);
            }

            updateThemeButton();
        });
    }

    // Keep Dashboard immediately to the left of the theme toggle.
    let dashboardLink = headerActions?.querySelector('.dashboard-shortcut');

    if (headerActions && !dashboardLink) {
        dashboardLink = document.createElement('a');
        dashboardLink.href = 'dashboard.html';
        dashboardLink.textContent = 'Dashboard';
        dashboardLink.className = 'btn btn-ghost dashboard-shortcut';

        headerActions.insertBefore(dashboardLink, themeButton || menu || null);
    }

    function closeMenu() {
        if (!menu || !nav) return;

        nav.classList.remove('open');
        menu.classList.remove('active');
        menu.textContent = '☰';
        menu.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-label', 'Open navigation menu');
    }

    if (menu && nav) {
        menu.type = 'button';
        menu.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-label', 'Open navigation menu');

        menu.addEventListener('click', event => {
            event.stopPropagation();

            const isOpen = nav.classList.toggle('open');

            menu.classList.toggle('active', isOpen);
            menu.textContent = isOpen ? '✕' : '☰';
            menu.setAttribute('aria-expanded', String(isOpen));
            menu.setAttribute(
                'aria-label',
                isOpen ? 'Close navigation menu' : 'Open navigation menu'
            );
        });

        nav.addEventListener('click', event => {
            if (event.target.closest('a')) closeMenu();
        });

        document.addEventListener('click', event => {
            if (!nav.contains(event.target) && !menu.contains(event.target)) {
                closeMenu();
            }
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 650) closeMenu();
        });
    }

    // ==========================================
    // 3. LOAD REQUIRED SCRIPTS WHEN NECESSARY
    // ==========================================

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');

            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error('Could not load ' + src));

            document.head.appendChild(script);
        });
    }

    // ==========================================
    // 4. SITE-WIDE AUTHENTICATION NAVIGATION
    // ==========================================

    async function initializeAuthentication() {
        try {
            if (!window.supabase) {
                await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
            }

            if (!window.jscanDB) {
                await loadScript('js/supabase.js');
            }

            const db = window.jscanDB;

            if (!db) throw new Error('Supabase client not found.');

            function makeLogoutButton(className, label = 'Log out') {
                const button = document.createElement('button');

                button.type = 'button';
                button.textContent = label;
                button.className = className;

                button.addEventListener('click', async () => {
                    button.disabled = true;
                    button.textContent = 'Logging out...';

                    try {
                        const { error } = await db.auth.signOut();

                        if (error) throw error;

                        window.location.replace('login.html');
                    } catch (error) {
                        console.error('JScan logout error:', error);

                        button.disabled = false;
                        button.textContent = label;

                        alert('Unable to log out. Please try again.');
                    }
                });

                return button;
            }

            function ensureMenuLink(href, label, className = '') {
                if (!mobileAuthLinks) return null;

                let link = mobileAuthLinks.querySelector(`a[href="${href}"]`);

                if (!link) {
                    link = document.createElement('a');
                    link.href = href;
                    link.textContent = label;

                    if (className) link.className = className;

                    mobileAuthLinks.appendChild(link);
                }

                return link;
            }

            function updateHeader(user) {
                if (!headerActions || !mobileAuthLinks) return;

                // Remove only dynamically managed account actions before rebuilding.
                mobileAuthLinks.replaceChildren();

                const existingDesktopHistory = headerActions.querySelector('.desktop-history-link');

                if (existingDesktopHistory) existingDesktopHistory.remove();

                const existingDesktopLogout = headerActions.querySelector('.desktop-header-logout');

                if (existingDesktopLogout) existingDesktopLogout.remove();

                if (user) {
                    if (desktopLogin) desktopLogin.style.display = 'none';
                    if (desktopRegister) desktopRegister.style.display = 'none';

                    if (dashboardLink) dashboardLink.style.display = 'inline-flex';

                    const desktopHistory = document.createElement('a');

                    desktopHistory.href = 'history.html';
                    desktopHistory.textContent = 'History';
                    desktopHistory.className = 'btn btn-ghost desktop-history-link';

                    headerActions.insertBefore(
                        desktopHistory,
                        themeButton || menu || null
                    );

                    // Reuse the dashboard page's existing logout button when present.
                    const dashboardLogout = headerActions.querySelector('#logoutBtn');

                    if (!dashboardLogout) {
                        const desktopLogout = makeLogoutButton(
                            'btn btn-primary desktop-header-logout'
                        );

                        headerActions.insertBefore(
                            desktopLogout,
                            themeButton || menu || null
                        );
                    }

                    ensureMenuLink('history.html', 'History', 'btn btn-ghost');

                    mobileAuthLinks.appendChild(
                        makeLogoutButton('btn btn-primary')
                    );

                } else {
                    if (desktopLogin) desktopLogin.style.display = '';
                    if (desktopRegister) desktopRegister.style.display = '';

                    if (dashboardLink) dashboardLink.style.display = 'none';

                    ensureMenuLink('login.html', 'Log in', 'btn btn-ghost');
                    ensureMenuLink('register.html', 'Create account', 'btn btn-primary');
                }
            }

            const { data, error } = await db.auth.getSession();

            if (error) throw error;

            updateHeader(data.session?.user || null);

            db.auth.onAuthStateChange((event, session) => {
                updateHeader(session?.user || null);
            });

            console.log('JScan authentication navigation is ready.');

        } catch (error) {
            console.error('JScan authentication error:', error);
        }
    }

    initializeAuthentication();

})();
