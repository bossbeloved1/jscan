
/* ==========================================
   JSCAN - PASSWORD RESET SYSTEM
========================================== */

(() => {

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
        console.error('JScan password reset: Required HTML elements are missing.');
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
    // VERIFY PASSWORD RECOVERY EVENT
    // ======================================

    showMessage(
        'Verifying your password reset link...',
        'info'
    );

    const {
        data: authListener
    } = db.auth.onAuthStateChange((event, session) => {

        if (event === 'PASSWORD_RECOVERY' && session?.user) {

            recoveryReady = true;

            showMessage(
                'Recovery link verified. You can now create a new password.',
                'success'
            );

            resetBtn.disabled = false;

        }

    });


    // ======================================
    // CHECK INITIAL SESSION
    // ======================================

    db.auth.getSession().then(({ error }) => {

        if (error) {

            console.error('Recovery session check error:', error);

            showMessage(
                'Unable to verify your reset session. Please request a new reset link.'
            );

            return;
        }

        // An ordinary login session does not authorize password recovery.
        // Only PASSWORD_RECOVERY enables the form.

        if (!recoveryReady) {

            showMessage(
                'Please open the password reset link sent to your email. If it has expired, request a new one.'
            );

        }

    }).catch(error => {

        console.error('Session verification error:', error);

        showMessage(
            'Unable to verify your reset session. Please try again.'
        );

    });


    // ======================================
    // UPDATE PASSWORD
    // ======================================

    resetForm.addEventListener('submit', async (event) => {

        event.preventDefault();

        if (isSubmitting) return;

        const password = newPassword.value;
        const confirmation = confirmPassword.value;


        // CHECK PASSWORD LENGTH

        if (password.length < 8) {

            showMessage(
                'Your password must contain at least 8 characters.'
            );

            return;
        }


        // CHECK PASSWORD MATCH

        if (password !== confirmation) {

            showMessage(
                'Your passwords do not match.'
            );

            return;
        }


        // CHECK RECOVERY SESSION

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


            // PASSWORD UPDATED SUCCESSFULLY

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


            // SIGN OUT SO THE USER CAN LOG IN WITH THE NEW PASSWORD

            const { error: signOutError } = await db.auth.signOut();

            if (signOutError) {
                console.error(
                    'Sign out after password reset:',
                    signOutError
                );
            }


            // RETURN TO LOGIN PAGE

            window.location.replace('login.html');


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


})();
