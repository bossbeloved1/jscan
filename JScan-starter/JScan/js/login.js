
/* ==========================================
   JSCAN - USER LOGIN SYSTEM
========================================== */

document.addEventListener('DOMContentLoaded', () => {

    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const message = document.getElementById('loginMessage');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');

    // ======================================
    // DISPLAY FEEDBACK MESSAGES
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
    // CHECK SUPABASE CONNECTION
    // ======================================

    const db = window.jscanDB;

    if (!db) {

        showMessage(
            'Unable to connect to JScan. Please refresh the page.'
        );

        if (loginBtn) loginBtn.disabled = true;
        if (forgotPasswordBtn) forgotPasswordBtn.disabled = true;

        return;
    }

    // ======================================
    // USER LOGIN
    // ======================================

    if (loginForm) {

        loginForm.addEventListener('submit', async (event) => {

            event.preventDefault();

            const email = emailInput?.value.trim() || '';
            const password = passwordInput?.value || '';

            if (!email || !password) {

                showMessage(
                    'Please enter your email and password.'
                );

                return;
            }

            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.textContent = 'Logging in...';
            }

            showMessage(
                'Verifying your account...',
                'info'
            );

            try {

                const { data, error } =
                    await db.auth.signInWithPassword({
                        email: email,
                        password: password
                    });

                if (error) throw error;

                if (!data.session) {

                    throw new Error(
                        'Login could not be completed. Please try again.'
                    );

                }

                showMessage(
                    'Login successful! Redirecting to your dashboard...',
                    'success'
                );

                window.location.replace('/dashboard.html');

            } catch (error) {

                console.error('Login error:', error);

                const errorText = (error.message || '').toLowerCase();

                if (
                    errorText.includes('invalid login credentials') ||
                    errorText.includes('invalid email or password')
                ) {

                    showMessage(
                        'Incorrect email or password. Please try again.'
                    );

                }

                else if (errorText.includes('email not confirmed')) {

                    showMessage(
                        'Please confirm your email address before logging in.'
                    );

                }

                else {

                    showMessage(
                        error.message ||
                        'Unable to log in. Please try again.'
                    );

                }

                if (loginBtn) {
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Log in to JScan';
                }

            }

        });

    }

    // ======================================
    // FORGOT PASSWORD
    // ======================================

    if (forgotPasswordBtn) {

        forgotPasswordBtn.addEventListener('click', async () => {

            const email = emailInput?.value.trim() || '';

            if (!email) {

                showMessage(
                    'Enter your email address first, then click Forgot password.'
                );

                emailInput?.focus();

                return;
            }

            forgotPasswordBtn.disabled = true;
            forgotPasswordBtn.textContent = 'Sending...';

            showMessage(
                'Sending password reset email...',
                'info'
            );

            try {

                // JSCAN PRODUCTION RESET PAGE

                const resetURL = new URL(
                    '/reset-password.html',
                    window.location.origin
                ).toString();

                // SEND SUPABASE PASSWORD RECOVERY EMAIL

                const { error } =
                    await db.auth.resetPasswordForEmail(email, {
                        redirectTo: resetURL
                    });

                if (error) throw error;

                showMessage(
                    'If an account exists for this email, a password reset link will be sent. Please check your inbox.',
                    'success'
                );

            } catch (error) {

                console.error(
                    'Password reset error:',
                    error
                );

                showMessage(
                    error.message ||
                    'Unable to send the reset email. Please try again.'
                );

            } finally {

                forgotPasswordBtn.disabled = false;
                forgotPasswordBtn.textContent = 'Forgot password?';

            }

        });

    }

});
