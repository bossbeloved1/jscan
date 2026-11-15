
(() => {
    const root = document.documentElement;

    // 1. THEME SETTINGS
    const saved = localStorage.getItem('jscan-theme');

    root.dataset.theme =
        saved ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light');

    function updateThemeButton() {
        document.querySelectorAll('[data-theme-toggle]').forEach(button => {
            button.textContent =
                root.dataset.theme === 'dark' ? '☀' : '☾';
        });
    }

    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
        button.addEventListener('click', () => {
            root.dataset.theme =
                root.dataset.theme === 'dark' ? 'light' : 'dark';

            localStorage.setItem('jscan-theme', root.dataset.theme);
            updateThemeButton();
        });
    });

    updateThemeButton();


    // 2. RESPONSIVE MOBILE MENU
    const menu = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.main-nav');

    function closeMenu() {
        if (!menu || !nav) return;

        nav.classList.remove('open');
        menu.classList.remove('active');
        menu.textContent = '☰';
        menu.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-label', 'Open navigation menu');
    }

    if (menu && nav) {
        menu.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-label', 'Open navigation menu');

        menu.addEventListener('click', () => {
            const isOpen = nav.classList.toggle('open');

            menu.classList.toggle('active', isOpen);
            menu.textContent = isOpen ? '✕' : '☰';
            menu.setAttribute('aria-expanded', String(isOpen));
            menu.setAttribute(
                'aria-label',
                isOpen ? 'Close navigation menu' : 'Open navigation menu'
            );
        });

        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', closeMenu);
        });

        document.addEventListener('click', event => {
            if (!nav.contains(event.target) && !menu.contains(event.target)) {
                closeMenu();
            }
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 650) {
                closeMenu();
            }
        });
    }


    // 3. LOAD SUPABASE WHEN NECESSARY
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(
                new Error('Could not load ' + src)
            );
            document.head.appendChild(script);
        });
    }


    // 4. INITIALIZE SITE-WIDE AUTHENTICATION
    async function initializeAuthentication() {
        try {
            if (!window.supabase) {
                await loadScript(
                    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
                );
            }

            if (!window.jscanDB) {
                await loadScript('js/supabase.js');
            }

            const db = window.jscanDB;

            if (!db) {
                throw new Error('Supabase client not found.');
            }


            // 5. FIND HEADER LOGIN AND REGISTER LINKS
            const containers = document.querySelectorAll(
                '.site-header .header-actions, ' +
                '.site-header .header-buttons, ' +
                '.site-header .auth-actions'
            );

            const headers = [];

            containers.forEach(container => {
                const login = container.querySelector(
                    'a[href*="login.html"]'
                );

                const register = container.querySelector(
                    'a[href*="register.html"]'
                );

                if (!login && !register) return;

                headers.push({
                    container,
                    login,
                    register,
                    dashboard: null,
                    history: null,
                    logout: null
                });
            });


            // 6. UPDATE HEADER BASED ON LOGIN STATUS
            function updateHeader(user) {
                headers.forEach(header => {
                    const {
                        container,
                        login,
                        register
                    } = header;

                    if (user) {
                        if (login) login.style.display = 'none';
                        if (register) register.style.display = 'none';

                        // DASHBOARD LINK
                        if (!header.dashboard) {
                            const dashboard = document.createElement('a');

                            dashboard.href = 'dashboard.html';
                            dashboard.textContent = 'Dashboard';
                            dashboard.className =
                                login?.className || 'btn btn-ghost';

                            header.dashboard = dashboard;
                            container.appendChild(dashboard);
                        }

                        // HISTORY LINK
                        if (!header.history) {
                            const history = document.createElement('a');

                            history.href = 'history.html';
                            history.textContent = 'History';
                            history.className =
                                login?.className || 'btn btn-ghost';

                            header.history = history;
                            container.appendChild(history);
                        }

                        // LOGOUT BUTTON
                        if (!header.logout) {
                            const logout = document.createElement('button');

                            logout.type = 'button';
                            logout.textContent = 'Log out';
                            logout.className =
                                register?.className || 'btn btn-primary';

                            logout.addEventListener('click', async () => {
                                logout.disabled = true;
                                logout.textContent = 'Logging out...';

                                const { error } = await db.auth.signOut();

                                if (error) {
                                    console.error(error);
                                    logout.disabled = false;
                                    logout.textContent = 'Log out';
                                    alert('Unable to log out. Please try again.');
                                }
                            });

                            header.logout = logout;
                            container.appendChild(logout);
                        }

                    } else {
                        if (login) login.style.display = '';
                        if (register) register.style.display = '';

                        if (header.dashboard) {
                            header.dashboard.remove();
                            header.dashboard = null;
                        }

                        if (header.history) {
                            header.history.remove();
                            header.history = null;
                        }

                        if (header.logout) {
                            header.logout.remove();
                            header.logout = null;
                        }
                    }
                });
            }


            // 7. CHECK EXISTING LOGIN SESSION
            const { data, error } = await db.auth.getSession();

            if (error) throw error;

            updateHeader(data.session?.user || null);


            // 8. WATCH FOR LOGIN AND LOGOUT CHANGES
            db.auth.onAuthStateChange((event, session) => {
                updateHeader(session?.user || null);
            });

            console.log('JScan authentication is ready.');

        } catch (error) {
            console.error('JScan authentication error:', error);
        }
    }

    initializeAuthentication();

})();
