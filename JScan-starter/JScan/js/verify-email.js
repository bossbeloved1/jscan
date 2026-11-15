
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

    let expiryTime = Date.now() + (10 * 60 * 1000);
    let countdownInterval;
    let resendInterval;

    // Check required elements
    if (
        !window.jscanDB ||
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
        return;
    }

    if (!email) {
        showMessage('No verification email found. Please register again.');
        verifyBtn.disabled = true;
        resendBtn.disabled = true;
        return;
    }

    verificationEmail.textContent = email;

    // Messages
    function showMessage(message, type = 'error') {
        verifyMessage.textContent = message;
        verifyMessage.style.color =
            type === 'success' ? 'green' : 'red';
    }

    function showResendMessage(message, type = 'error') {
        resendMessage.textContent = message;
        resendMessage.style.color =
            type === 'success' ? 'green' : 'red';
    }

    // OTP expiry countdown
    function startCountdown() {
        clearInterval(countdownInterval);

        expiryTime = Date.now() + (10 * 60 * 1000);

        countdownInterval = setInterval(() => {
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
        }, 1000);
    }

    // Resend cooldown: 60 seconds
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

    // Start timers
    startCountdown();
    startResendCooldown();

    // Allow numbers only
    otpCode.addEventListener('input', () => {
        otpCode.value = otpCode.value
            .replace(/\D/g, '')
            .slice(0, 6);
    });

    // VERIFY OTP
    verifyForm.addEventListener('submit', async (event) => {

        event.preventDefault();

        const token = otpCode.value.trim();

        if (!/^\d{6}$/.test(token)) {
            showMessage('Please enter a valid 6-digit verification code.');
            return;
        }

        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';

        showMessage('Verifying your email address...', 'success');

        try {
            const { data, error } =
                await window.jscanDB.auth.verifyOtp({
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

            sessionStorage.removeItem('jscan_pending_email');

            clearInterval(countdownInterval);
            clearInterval(resendInterval);

            showMessage(
                'Your email has been verified! Redirecting to your dashboard...',
                'success'
            );

            verifyBtn.textContent = 'Verified successfully';

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1200);

        } catch (error) {
            console.error('JScan OTP verification error:', error);

            showMessage(
                error.message || 'Invalid or expired code. Please try again.'
            );

            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify email address';
        }
    });

    // RESEND OTP
    resendBtn.addEventListener('click', async () => {

        if (resendBtn.disabled) return;

        resendBtn.disabled = true;
        resendBtn.textContent = 'Sending...';

        showResendMessage(
            'Requesting a new verification code...',
            'success'
        );

        try {
            const { error } =
                await window.jscanDB.auth.resend({
                    type: 'signup',
                    email: email
                });

            if (error) throw error;

            otpCode.value = '';

            showResendMessage(
                'A new verification code has been sent to your email.',
                'success'
            );

            startCountdown();
            startResendCooldown();

        } catch (error) {
            console.error('JScan resend OTP error:', error);

            showResendMessage(
                error.message || 'Unable to resend code. Please try again.'
            );

            resendBtn.disabled = false;
            resendBtn.textContent = 'Resend code';
        }
    });

});
