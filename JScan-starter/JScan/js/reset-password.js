
/* ==========================================
   JSCAN - PASSWORD RESET SYSTEM
========================================== */

(() => {

    document.addEventListener('DOMContentLoaded', () => {

        const resetForm = document.getElementById('resetPasswordForm');
        const newPassword = document.getElementById('newPassword');
        const confirmPassword = document.getElementById('confirmPassword');
        const resetBtn = document.getElementById('resetPasswordBtn');
        const message = document.getElementById('resetMessage');
        const showPassword = document.getElementById('showPassword');

        let recoveryReady = false;
        let isSubmitting = false;

        // ======================================
        // DISPLAY MESSAGES
        // ======================================

        function showMessage(text, type = 'error') {

            if (!message) return;

            message.textContent = text;

            message.style.color =
                type === 'success' ? '#16a34a' :
                type === 'info' ? 'var(--blue)' :
                '#ef4444';
        }

        // ======================================
        // CHECK REQUIRED ELEMENTS
        // ======================================

        if (
            !resetForm ||
            !newPassword ||
            !confirmPassword ||
            !resetBtn
        ) {

            console.error(
                'JScan password reset: Required HTML elements are missing.'
            );

            return;
        }

        // ======================================
        // CHECK SUPABASE CONNECTION
        // ======================================

        const db = window.jscanDB;

        if (!db) {

            showMessage(
                'Unable to connect to JScan. Please refresh the page.'
            );

            resetBtn.disabled = true;

            return;
        }

        resetBtn.disabled = true;

        // ======================================
        // SHOW OR HIDE PASSWORDS
        // ======================================

        if (showPassword) {

            showPassword.addEventListener('change', () => {

                const type = showPassword.checked
                    ? 'text'
                    : 'password';

                newPassword.type = type;
                confirmPassword.type = type;

            });

        }

        // ======================================
        // PASSWORD RECOVERY STATUS
        // ======================================

        function enableRecovery() {

            recoveryReady = true;

            showMessage(
                'Recovery link verified. You can now create a new password.',
                'success'
            );

            resetBtn.disabled = false;
        }

        // ======================================
        // VERIFY PASSWORD RECOVERY EVENT
        // ======================================

        showMessage(
            'Verifying your password reset link...',
            'info'
        );

        const { data: authListener } =
            db.auth.onAuthStateChange((event, session) => {

                if (event === 'PASSWORD_RECOVERY' && session?.user) {

                    enableRecovery();

                }

                if (event === 'SIGNED_OUT') {

                    recoveryReady = false;

                    if (!isSubmitting) {
                        resetBtn.disabled = true;
                    }

                }

            });

        // ======================================
        // CHECK INITIAL AUTHENTICATION SESSION
        // ======================================

        async function checkRecoverySession() {

            try {

                const { data, error } = await db.auth.getSession();

                if (error) throw error;

                const session = data?.session;

                if (!session) {

                    showMessage(
                        'Please open the password reset link sent to your email. If it has expired, request a new one.'
                    );

                    return;
                }

                /*
                   An existing ordinary login session alone
                   does not authorize password recovery.

                   The PASSWORD_RECOVERY event is required
                   to enable this form.
                */

                if (!recoveryReady) {

                    showMessage(
                        'Please open the password reset link sent to your email. If it has expired, request a new one.'
                    );

                }

            } catch (error) {

                console.error(
                    'Recovery session check error:',
                    error
                );

                showMessage(
                    'Unable to verify your reset session. Please request a new reset link.'
                );

            }

        }

        checkRecoverySession();

        // ======================================
        // UPDATE PASSWORD
        // ======================================

        resetForm.addEventListener('submit', async (event) => {

            event.preventDefault();

            if (isSubmitting) return;

            const password = newPassword.value;
            const confirmation = confirmPassword.value;

            // PASSWORD LENGTH

            if (password.length < 8) {

                showMessage(
                    'Your password must contain at least 8 characters.'
                );

                newPassword.focus();

                return;
            }

            // PASSWORD MATCH

            if (password !== confirmation) {

                showMessage(
                    'Your passwords do not match.'
                );

                confirmPassword.focus();

                return;
            }

            // RECOVERY SESSION

            if (!recoveryReady) {

                showMessage(
                    'Your password reset link has not been verified or has expired. Please request a new reset link.'
                );

                return;
            }

            // START SUBMISSION

            isSubmitting = true;

            resetBtn.disabled = true;
            resetBtn.textContent = 'Updating password...';

            showMessage(
                'Updating your password...',
                'info'
            );

            try {

                // UPDATE PASSWORD IN SUPABASE

                const { error } = await db.auth.updateUser({

                    password: password

                });

                if (error) throw error;

                // PASSWORD UPDATED

                recoveryReady = false;

                showMessage(
                    'Your password has been updated successfully! Redirecting to login...',
                    'success'
                );

                resetForm.reset();

                if (showPassword) {
                    showPassword.checked = false;
                }

                newPassword.type = 'password';
                confirmPassword.type = 'password';

                // SIGN OUT AFTER PASSWORD UPDATE

                const { error: signOutError } =
                    await db.auth.signOut();

                if (signOutError) {

                    console.error(
                        'Sign out after password reset:',
                        signOutError
                    );

                }

                // REDIRECT TO PRODUCTION LOGIN PAGE

                window.location.replace('/login.html');

            } catch (error) {

                console.error(
                    'Password update error:',
                    error
                );

                showMessage(
                    error.message ||
                    'Unable to update your password. Please try again.'
                );

                isSubmitting = false;

                resetBtn.disabled = false;
                resetBtn.textContent = 'Update password';

            }

        });

        // ======================================
        // CLEAN UP AUTH LISTENER
        // ======================================

        window.addEventListener('pagehide', () => {

            if (authListener?.subscription) {
                authListener.subscription.unsubscribe();
            }

        });

    });

})();
