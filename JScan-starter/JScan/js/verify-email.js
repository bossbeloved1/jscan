
/* ==========================================
   JSCAN - EMAIL OTP VERIFICATION
========================================== */

document.addEventListener('DOMContentLoaded', () => {

    const verifyForm = document.getElementById('verifyForm');
    const otpCode = document.getElementById('otpCode');
    const verifyBtn = document.getElementById('verifyBtn');
    const resendBtn = document.getElementById('resendBtn');

    const verifyMessage = document.getElementById('verifyMessage');
    const resendMessage = document.getElementById('resendMessage');
    const countdown = document.getElementById('otpCountdown');
    const verificationEmail = document.getElementById('verificationEmail');

    const params = new URLSearchParams(window.location.search);

    const email =
        params.get('email') ||
        sessionStorage.getItem('jscan_pending_email');

    const db = window.jscanDB;

    let expiryTime;
    let countdownInterval;
    let resendInterval;

    // ======================================
    // DISPLAY VERIFICATION MESSAGES
    // ======================================

    function showMessage(message, type = 'error') {

        if (!verifyMessage) return;

        verifyMessage.textContent = message;

        verifyMessage.style.color =
            type === 'success' ? '#16a34a' :
            type === 'info' ? 'var(--blue)' :
            '#ef4444';
    }

    // ======================================
    // DISPLAY RESEND MESSAGES
    // ======================================

    function showResendMessage(message, type = 'error') {

        if (!resendMessage) return;

        resendMessage.textContent = message;

        resendMessage.style.color =
            type === 'success' ? '#16a34a' :
            type === 'info' ? 'var(--blue)' :
            '#ef4444';
    }

    // ======================================
    // CHECK REQUIRED ELEMENTS
    // ======================================

    if (
        !db ||
        !verifyForm ||
        !otpCode ||
        !verifyBtn ||
        !resendBtn ||
        !verifyMessage ||
        !resendMessage ||
        !countdown ||
        !verificationEmail
    ) {

        console.error('JScan verification setup is incomplete.');

        showMessage(
            'Unable to load email verification. Please refresh the page.'
        );

        return;
    }

    // ======================================
    // CHECK EMAIL ADDRESS
    // ======================================

    if (!email) {

        showMessage(
            'No verification email found. Please register again.'
        );

        verifyBtn.disabled = true;
        resendBtn.disabled = true;

        return;
    }

    verificationEmail.textContent = email;

    // ======================================
    // OTP EXPIRY COUNTDOWN
    // ======================================

    function startCountdown() {

        clearInterval(countdownInterval);

        // Display a 10-minute estimated countdown.
        // Actual OTP expiry is controlled by Supabase.

        expiryTime = Date.now() + (10 * 60 * 1000);

        function updateCountdown() {

            const remaining = Math.max(
                0,
                Math.ceil((expiryTime - Date.now()) / 1000)
            );

            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;

            countdown.textContent =
                `Code expires in ${minutes}:${String(seconds).padStart(2, '0')}`;

            if (remaining <= 0) {

                clearInterval(countdownInterval);

                countdown.textContent =
                    'Code may have expired. Request a new code.';

            }

        }

        updateCountdown();

        countdownInterval = setInterval(updateCountdown, 1000);
    }

    // ======================================
    // RESEND COOLDOWN
    // ======================================

    function startResendCooldown() {

        clearInterval(resendInterval);

        let remaining = 60;

        resendBtn.disabled = true;

        resendBtn.textContent =
            `Resend code (${remaining}s)`;

        resendInterval = setInterval(() => {

            remaining--;

            if (remaining <= 0) {

                clearInterval(resendInterval);

                resendBtn.disabled = false;
                resendBtn.textContent = 'Resend code';

                return;
            }

            resendBtn.textContent =
                `Resend code (${remaining}s)`;

        }, 1000);
    }

    // ======================================
    // START TIMERS
    // ======================================

    startCountdown();
    startResendCooldown();

    // ======================================
    // ALLOW NUMBERS ONLY
    // ======================================

    otpCode.addEventListener('input', () => {

        otpCode.value = otpCode.value
            .replace(/\D/g, '')
            .slice(0, 6);

    });

    // ======================================
    // VERIFY OTP
    // ======================================

    verifyForm.addEventListener('submit', async (event) => {

        event.preventDefault();

        const token = otpCode.value.trim();

        if (!/^\d{6}$/.test(token)) {

            showMessage(
                'Please enter a valid 6-digit verification code.'
            );

            otpCode.focus();

            return;
        }

        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';

        showMessage(
            'Verifying your email address...',
            'info'
        );

        try {

            const { data, error } = await db.auth.verifyOtp({

                email: email,
                token: token,
                type: 'signup'

            });

            if (error) throw error;

            if (!data.session) {

                throw new Error(
                    'Verification succeeded, but your login session was not established. Please log in.'
                );

            }

            // Clear pending verification email
            sessionStorage.removeItem('jscan_pending_email');

            // Stop timers
            clearInterval(countdownInterval);
            clearInterval(resendInterval);

            showMessage(
                'Your email has been verified! Redirecting to your dashboard...',
                'success'
            );

            verifyBtn.textContent = 'Verified successfully';

            setTimeout(() => {

                window.location.replace('/dashboard.html');

            }, 1200);

        } catch (error) {

            console.error(
                'JScan OTP verification error:',
                error
            );

            showMessage(
                error.message ||
                'Invalid or expired code. Please try again.'
            );

            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify email address';

        }

    });

    // ======================================
    // RESEND OTP
    // ======================================

    resendBtn.addEventListener('click', async () => {

        if (resendBtn.disabled) return;

        resendBtn.disabled = true;
        resendBtn.textContent = 'Sending...';

        showResendMessage(
            'Requesting a new verification code...',
            'info'
        );

        try {

            const { error } = await db.auth.resend({

                type: 'signup',
                email: email

            });

            if (error) throw error;

            otpCode.value = '';

            showResendMessage(
                'A new verification code has been sent to your email.',
                'success'
            );

            // Restart timers after successful resend
            startCountdown();
            startResendCooldown();

        } catch (error) {

            console.error(
                'JScan resend OTP error:',
                error
            );

            showResendMessage(
                error.message ||
                'Unable to resend code. Please try again.'
            );

            // Restore resend button after failed request
            resendBtn.disabled = false;
            resendBtn.textContent = 'Resend code';

        }

    });

    // ======================================
    // CLEAN UP TIMERS WHEN LEAVING
    // ======================================

    window.addEventListener('pagehide', () => {

        clearInterval(countdownInterval);
        clearInterval(resendInterval);

    });

});
