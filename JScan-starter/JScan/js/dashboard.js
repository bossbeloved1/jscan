
/* ==========================================
   JSCAN - USER DASHBOARD
   AUTHENTICATION & PROFILE MANAGEMENT
========================================== */

document.addEventListener('DOMContentLoaded', async () => {

    const db = window.jscanDB;

    // ======================================
    // DASHBOARD ELEMENTS
    // ======================================

    const userName = document.getElementById('userName');
    const dashboardProfileName = document.getElementById('dashboardProfileName');
    const dashboardProfileEmail = document.getElementById('dashboardProfileEmail');
    const dashboardAvatar = document.getElementById('dashboardAvatar');
    const dashboardMessage = document.getElementById('dashboardMessage');
    const logoutBtn = document.getElementById('logoutBtn');

    // ======================================
    // DEFAULT PROFILE PICTURE
    // ======================================

    const defaultAvatar =
        'https://placehold.co/160x160/eaf0ff/2563eb?text=J';

    // ======================================
    // DISPLAY MESSAGES
    // ======================================

    function showMessage(message, type = 'error') {

        if (!dashboardMessage) return;

        dashboardMessage.textContent = message;

        dashboardMessage.style.color =
            type === 'success' ? '#16a34a' :
            type === 'info' ? 'var(--blue)' :
            '#ef4444';
    }

    // ======================================
    // CHECK SUPABASE CONNECTION
    // ======================================

    if (!db) {

        console.error('JScan: Supabase connection unavailable.');

        showMessage(
            'Connection error. Please refresh the page.'
        );

        return;
    }

    // ======================================
    // CHECK LOGIN SESSION
    // ======================================

    let session;

    try {

        const { data, error } = await db.auth.getSession();

        if (error) throw error;

        session = data.session;

    } catch (error) {

        console.error('JScan session error:', error);

        window.location.replace('/login.html');

        return;
    }

    // ======================================
    // PROTECT DASHBOARD
    // ======================================

    if (!session) {

        window.location.replace('/login.html');

        return;
    }

    const user = session.user;

    // ======================================
    // FALLBACK ACCOUNT INFORMATION
    // ======================================

    const fallbackName =
        user.user_metadata?.display_name ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        'User';

    const userEmail = user.email || '';

    // ======================================
    // DISPLAY FALLBACK INFORMATION
    // ======================================

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
            dashboardAvatar.onerror = null;
            dashboardAvatar.src = defaultAvatar;
        };
    }

    // ======================================
    // LOAD USER PROFILE FROM SUPABASE
    // ======================================

    async function loadProfile() {

        try {

            const { data: profile, error } = await db
                .from('profiles')
                .select('display_name, avatar_url')
                .eq('id', user.id)
                .maybeSingle();

            if (error) throw error;

            if (!profile) return;

            // DISPLAY NAME

            const name =
                profile.display_name || fallbackName;

            if (userName) {
                userName.textContent = name;
            }

            if (dashboardProfileName) {
                dashboardProfileName.textContent = name;
            }

            // PROFILE PICTURE

            if (dashboardAvatar) {

                dashboardAvatar.src =
                    profile.avatar_url || defaultAvatar;

                dashboardAvatar.onerror = () => {
                    dashboardAvatar.onerror = null;
                    dashboardAvatar.src = defaultAvatar;
                };
            }

        } catch (error) {

            console.error('Profile loading error:', error);

            showMessage(
                'Unable to load some profile information.'
            );

        }

    }

    // ======================================
    // LOG OUT
    // ======================================

    if (logoutBtn) {

        logoutBtn.addEventListener('click', async () => {

            logoutBtn.disabled = true;
            logoutBtn.textContent = 'Logging out...';

            try {

                const { error } = await db.auth.signOut();

                if (error) throw error;

                window.location.replace('/login.html');

            } catch (error) {

                console.error('JScan logout error:', error);

                showMessage(
                    'Unable to log out. Please try again.'
                );

                logoutBtn.disabled = false;
                logoutBtn.textContent = 'Log out';

            }

        });

    }

    // ======================================
    // HANDLE AUTHENTICATION CHANGES
    // ======================================

    db.auth.onAuthStateChange((event, updatedSession) => {

        if (event === 'SIGNED_OUT' || !updatedSession) {

            window.location.replace('/login.html');

        }

    });

    // ======================================
    // LOAD DASHBOARD PROFILE
    // ======================================

    await loadProfile();

});
