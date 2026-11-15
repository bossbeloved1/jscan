
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
    // CHECK REQUIRED ELEMENTS
    // ======================================

    if (
        !registerForm ||
        !fullName ||
        !email ||
        !password ||
        !confirmPassword ||
        !registerBtn
    ) {
        console.error('JScan: Registration form elements are missing.');
        showMessage('Unable to load the registration form correctly. Please refresh the page.');
        return;
    }

    // ======================================
    // CHECK SUPABASE CONNECTION
    // ======================================

    const db = window.jscanDB;

    if (!db) {

        showMessage('Connection error. Please refresh the page.');

        registerBtn.disabled = true;

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

        // Validate full name
        if (!nameValue) {

            showMessage('Please enter your full name.');
            fullName.focus();

            return;
        }

        // Validate email
        if (!emailValue) {

            showMessage('Please enter your email address.');
            email.focus();

            return;
        }

        // Validate email format
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(emailValue)) {

            showMessage('Please enter a valid email address.');
            email.focus();

            return;
        }

        // Validate password requirements
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

        // Confirm password
        if (passwordValue !== confirmValue) {

            showMessage('Your passwords do not match.');
            confirmPassword.focus();

            return;
        }

        // ======================================
        // START REGISTRATION
        // ======================================

        registerBtn.disabled = true;
        registerBtn.textContent = 'Creating your account...';

        showMessage('Creating your JScan account...', 'info');

        try {

            const { data, error } = await db.auth.signUp({

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

            // ======================================
            // EMAIL OTP VERIFICATION REQUIRED
            // ======================================

            if (!data.session) {

                sessionStorage.setItem(
                    'jscan_pending_email',
                    emailValue
                );

                showMessage(
                    'Account created! Redirecting to email verification...',
                    'success'
                );

                window.location.href =
                    '/verify-email.html?email=' +
                    encodeURIComponent(emailValue);

                return;
            }

            // ======================================
            // IMMEDIATE REGISTRATION
            // ======================================

            showMessage(
                'Account created successfully! Redirecting...',
                'success'
            );

            window.location.replace('/dashboard.html');

        } catch (error) {

            console.error('JScan registration error:', error);

            let errorMessage =
                error.message || 'Something went wrong. Please try again.';

            const errorText = errorMessage.toLowerCase();

            if (
                errorText.includes('already registered') ||
                errorText.includes('already exists') ||
                errorText.includes('user already registered')
            ) {

                errorMessage =
                    'This email already has an account. Please log in.';

            }

            showMessage(errorMessage);

            registerBtn.disabled = false;
            registerBtn.textContent = 'Create free account';

        }

    });

});
