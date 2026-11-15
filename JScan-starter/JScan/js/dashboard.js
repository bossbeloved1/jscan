
document.addEventListener('DOMContentLoaded', async () => {

    const db = window.jscanDB;

    // Dashboard elements
    const userName = document.getElementById('userName');
    const dashboardProfileName = document.getElementById('dashboardProfileName');
    const dashboardProfileEmail = document.getElementById('dashboardProfileEmail');
    const dashboardAvatar = document.getElementById('dashboardAvatar');
    const dashboardMessage = document.getElementById('dashboardMessage');
    const logoutBtn = document.getElementById('logoutBtn');

    // Default profile picture
    const defaultAvatar =
        'https://placehold.co/160x160/eaf0ff/2563eb?text=J';

    // Display messages
    function showMessage(message, type = 'error') {

        if (!dashboardMessage) return;

        dashboardMessage.textContent = message;

        dashboardMessage.style.color =
            type === 'success' ? '#16a34a' : '#ef4444';
    }

    // Check Supabase connection
    if (!db) {

        showMessage(
            'Connection error. Please refresh the page.'
        );

        return;
    }

    // Check login session
    let session;

    try {

        const { data, error } = await db.auth.getSession();

        if (error) throw error;

        session = data.session;

    } catch (error) {

        console.error('Session error:', error);

        window.location.replace('login.html');

        return;
    }

    // Protect dashboard
    if (!session) {

        window.location.replace('login.html');

        return;
    }

    const user = session.user;

    // Fallback account information
    const fallbackName =
        user.user_metadata?.display_name ||
        user.email?.split('@')[0] ||
        'User';

    const userEmail = user.email || '';

    // Display fallback information immediately
    if (userName) {
        userName.textContent = fallbackName;
    }

    if (dashboardProfileName) {
        dashboardProfileName.textContent = fallbackName;
    }

    if (dashboardProfileEmail) {
        dashboardProfileEmail.textContent = userEmail;
    }

    if (dashboardAvatar) {
        dashboardAvatar.src =
            user.user_metadata?.avatar_url || defaultAvatar;

        dashboardAvatar.onerror = () => {
            dashboardAvatar.src = defaultAvatar;
        };
    }

    // Load user profile from Supabase
    async function loadProfile() {

        try {

            const { data: profile, error } = await db
                .from('profiles')
                .select('display_name, avatar_url')
                .eq('id', user.id)
                .maybeSingle();

            if (error) throw error;

            if (profile) {

                // Display name
                const name =
                    profile.display_name || fallbackName;

                if (userName) {
                    userName.textContent = name;
                }

                if (dashboardProfileName) {
                    dashboardProfileName.textContent = name;
                }

                // Profile picture
                if (dashboardAvatar) {

                    dashboardAvatar.src =
                        profile.avatar_url || defaultAvatar;

                    dashboardAvatar.onerror = () => {
                        dashboardAvatar.src = defaultAvatar;
                    };
                }

            }

        } catch (error) {

            console.error('Profile loading error:', error);

            showMessage(
                'Unable to load some profile information.'
            );
        }
    }

    // Log out
    if (logoutBtn) {

        logoutBtn.addEventListener('click', async () => {

            logoutBtn.disabled = true;
            logoutBtn.textContent = 'Logging out...';

            try {

                const { error } = await db.auth.signOut();

                if (error) throw error;

                window.location.replace('login.html');

            } catch (error) {

                console.error('Logout error:', error);

                showMessage(
                    'Unable to log out. Please try again.'
                );

                logoutBtn.disabled = false;
                logoutBtn.textContent = 'Log out';
            }

        });
    }

    // Load dashboard profile
    await loadProfile();

});
