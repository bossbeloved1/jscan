
/* ==========================================
   JSCAN - USER REGISTRATION
   EMAIL OTP VERIFICATION
   PASSWORD STRENGTH VALIDATION
========================================== */

document.addEventListener('DOMContentLoaded', () => {

    const registerForm = document.getElementById('registerForm');
    const fullName = document.getElementById('fullName');
    const email = document.getElementById('email');
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');
    const registerBtn = document.getElementById('registerBtn');
    const message = document.getElementById('registerMessage');

    // Display messages
    function showMessage(text, type = 'error') {
        if (!message) return;

        message.textContent = text;

        message.style.color =
            type === 'success' ? '#16a34a' :
            type === 'info' ? 'var(--blue)' :
            '#ef4444';
    }

    // Check Supabase connection
    if (!window.jscanDB) {
        showMessage('Connection error. Please refresh the page.');

        if (registerBtn) registerBtn.disabled = true;
        return;
    }

    // ======================================
    // PASSWORD REQUIREMENTS
    // ======================================

    function validatePassword(value) {

        return {
            length: value.length >= 8,
            upper: /[A-Z]/.test(value),
            lower: /[a-z]/.test(value),
            number: /[0-9]/.test(value),
            special: /[^A-Za-z0-9]/.test(value)
        };

    }

    // ======================================
    // REGISTRATION FORM
    // ======================================

    registerForm.addEventListener('submit', async (event) => {

        event.preventDefault();

        const nameValue = fullName.value.trim();
        const emailValue = email.value.trim().toLowerCase();
        const passwordValue = password.value;
        const confirmValue = confirmPassword.value;

        if (!nameValue) {
            showMessage('Please enter your full name.');
            fullName.focus();
            return;
        }

        if (!emailValue) {
            showMessage('Please enter your email address.');
            email.focus();
            return;
        }

        // Validate all five password requirements
        const checks = validatePassword(passwordValue);

        if (!checks.length) {
            showMessage('Your password must contain at least 8 characters.');
            password.focus();
            return;
        }

        if (!checks.upper) {
            showMessage('Add at least one uppercase letter to your password.');
            password.focus();
            return;
        }

        if (!checks.lower) {
            showMessage('Add at least one lowercase letter to your password.');
            password.focus();
            return;
        }

        if (!checks.number) {
            showMessage('Add at least one number to your password.');
            password.focus();
            return;
        }

        if (!checks.special) {
            showMessage('Add at least one special character to your password.');
            password.focus();
            return;
        }

        if (passwordValue !== confirmValue) {
            showMessage('Your passwords do not match.');
            confirmPassword.focus();
            return;
        }

        // Disable button while registering
        registerBtn.disabled = true;
        registerBtn.textContent = 'Creating your account...';

        showMessage('Creating your JScan account...', 'info');

        try {

            const { data, error } =
                await window.jscanDB.auth.signUp({

                    email: emailValue,
                    password: passwordValue,

                    options: {
                        data: {
                            display_name: nameValue,
                            full_name: nameValue
                        }
                    }

                });

            if (error) throw error;

            if (!data.user) {
                throw new Error(
                    'We could not create your account. Please try again.'
                );
            }

            // Email OTP verification required
            if (!data.session) {

                sessionStorage.setItem(
                    'jscan_pending_email',
                    emailValue
                );

                showMessage(
                    'Account created! Sending your verification code...',
                    'success'
                );

                window.location.href =
                    'verify-email.html?email=' +
                    encodeURIComponent(emailValue);

                return;
            }

            // Immediate registration
            showMessage(
                'Account created successfully! Redirecting...',
                'success'
            );

            window.location.href = 'dashboard.html';

        } catch (error) {

            console.error('JScan registration error:', error);

            let errorMessage =
                error.message || 'Something went wrong. Please try again.';

            if (
                errorMessage.toLowerCase().includes('already registered') ||
                errorMessage.toLowerCase().includes('already exists')
            ) {
                errorMessage =
                    'This email already has an account. Please log in.';
            }

            showMessage(errorMessage);

        } finally {

            registerBtn.disabled = false;
            registerBtn.textContent = 'Create free account';

        }

    });

});
