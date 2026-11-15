
document.addEventListener('DOMContentLoaded', () => {

    'use strict';

    const startBtn = document.getElementById('startScannerBtn');
    const stopBtn = document.getElementById('stopScannerBtn');
    const reader = document.getElementById('reader');

    const imageInput = document.getElementById('qrImageInput');
    const uploadFileName = document.getElementById('uploadFileName');

    const message = document.getElementById('scannerMessage');

    const resultBox = document.getElementById('scanResult');
    const resultText = document.getElementById('scanResultText');
    const preview = document.getElementById('scanPreview');

    const copyBtn = document.getElementById('copyResultBtn');
    const openBtn = document.getElementById('openResultBtn');

    if (!startBtn || !stopBtn || !reader || !imageInput) {
        console.error('JScan: Required scanner elements are missing.');
        return;
    }

    let scanner = null;
    let cameraRunning = false;
    let lastResult = '';
    let imagePreviewUrl = null;
    let historySaveAttempted = false;
    let imageScanInProgress = false;

    function showMessage(text, error = false) {
        if (!message) return;

        message.textContent = text;
        message.style.color = error ? '#dc2626' : 'var(--muted)';
    }

    // ==========================================
    // RESET RESULT
    // ==========================================

    function resetResult() {

        if (resultBox) resultBox.hidden = true;
        if (resultText) resultText.textContent = '';

        if (openBtn) {
            openBtn.hidden = true;
            openBtn.removeAttribute('href');
        }

        if (preview) {
            preview.hidden = true;
            preview.removeAttribute('src');
        }

        if (imagePreviewUrl) {
            URL.revokeObjectURL(imagePreviewUrl);
            imagePreviewUrl = null;
        }

        lastResult = '';
        historySaveAttempted = false;
    }

    // ==========================================
    // SAVE SCAN RESULT TO SUPABASE HISTORY
    // ==========================================

    async function saveScanToHistory(decodedText, source) {

        if (!decodedText || historySaveAttempted) return;

        historySaveAttempted = true;

        try {

            const db = window.jscanDB;

            if (!db) {
                throw new Error('Supabase database client is unavailable.');
            }

            showMessage('Scan successful. Saving to History...');

            const { data: userData, error: userError } =
                await db.auth.getUser();

            if (userError) throw userError;

            const user = userData?.user;

            if (!user) {
                throw new Error('Please sign in to save scan history.');
            }

            const { error: insertError } = await db
                .from('activity_history')
                .insert({
                    user_id: user.id,
                    tool_name: 'QR & Barcode Scanner',
                    action: 'scan',
                    file_name: null,
                    status: 'completed',
                    details: {
                        scanned_text: decodedText,
                        scan_result: decodedText,
                        source: source,
                        scanned_at: new Date().toISOString()
                    },
                    is_permanent: true,
                    expires_at: null
                });

            if (insertError) throw insertError;

            showMessage('Scan successful and added to History!');

        } catch (error) {

            console.error('Scanner History Error:', error);

            showMessage(
                'Scan successful, but could not be added to History. ' +
                (error.message || ''),
                true
            );
        }
    }

    // ==========================================
    // DISPLAY SCANNED RESULT
    // ==========================================

    function displayResult(decodedText, source = 'camera') {

        if (!decodedText) return;

        lastResult = decodedText;

        resultText.textContent = decodedText;
        resultBox.hidden = false;

        try {

            const parsedUrl = new URL(decodedText);

            if (
                parsedUrl.protocol === 'https:' ||
                parsedUrl.protocol === 'http:'
            ) {
                openBtn.href = parsedUrl.href;
                openBtn.hidden = false;
            } else {
                openBtn.hidden = true;
            }

        } catch {
            openBtn.hidden = true;
        }

        saveScanToHistory(decodedText, source);

        if (source === 'camera') {
            stopCamera(true);
        }
    }

    // ==========================================
    // STOP CAMERA
    // ==========================================

    async function stopCamera(silent = false) {

        if (!scanner || !cameraRunning) {

            cameraRunning = false;
            reader.hidden = true;
            stopBtn.hidden = true;
            startBtn.hidden = false;

            return;
        }

        try {

            await scanner.stop();

            cameraRunning = false;

            reader.hidden = true;
            stopBtn.hidden = true;
            startBtn.hidden = false;

            if (!silent) {
                showMessage('Camera stopped.');
            }

        } catch (error) {

            console.error('Camera stop error:', error);

            showMessage(
                'Unable to stop the camera. Please try again.',
                true
            );
        }
    }

    // ==========================================
    // START CAMERA
    // ==========================================

    async function startCamera() {

        if (typeof Html5Qrcode === 'undefined') {

            showMessage(
                'Scanner library could not load. Check your internet connection.',
                true
            );

            return;
        }

        if (cameraRunning || imageScanInProgress) return;

        resetResult();

        reader.hidden = false;
        startBtn.disabled = true;

        showMessage('Requesting camera permission...');

        try {

            if (!scanner) {
                scanner = new Html5Qrcode('reader');
            }

            await scanner.start(
                { facingMode: 'environment' },
                {
                    fps: 10,
                    qrbox: {
                        width: 250,
                        height: 250
                    },
                    aspectRatio: 1
                },
                (decodedText) => {

                    if (cameraRunning && !historySaveAttempted) {
                        displayResult(decodedText, 'camera');
                    }

                },
                () => {}
            );

            cameraRunning = true;

            startBtn.hidden = true;
            startBtn.disabled = false;

            stopBtn.hidden = false;

            showMessage('Camera is active. Point it at a QR code.');

        } catch (error) {

            console.error('Camera error:', error);

            cameraRunning = false;

            reader.hidden = true;

            startBtn.hidden = false;
            startBtn.disabled = false;

            stopBtn.hidden = true;

            showMessage(
                'Camera access failed. Allow camera permission and make sure the website uses HTTPS.',
                true
            );
        }
    }

    // ==========================================
    // BUTTON EVENTS
    // ==========================================

    startBtn.addEventListener('click', startCamera);

    stopBtn.addEventListener('click', () => stopCamera());

    // ==========================================
    // SCAN UPLOADED IMAGE
    // ==========================================

    imageInput.addEventListener('change', async () => {

        const file = imageInput.files?.[0];

        if (!file) return;

        if (!file.type.startsWith('image/')) {

            showMessage('Please select a valid image file.', true);
            imageInput.value = '';

            return;
        }

        if (file.size > 15 * 1024 * 1024) {

            showMessage('Image is too large. Maximum size is 15MB.', true);
            imageInput.value = '';

            return;
        }

        if (cameraRunning) {
            await stopCamera(true);
        }

        if (typeof Html5Qrcode === 'undefined') {

            showMessage('Scanner library could not load.', true);
            return;
        }

        if (imageScanInProgress) return;

        imageScanInProgress = true;

        resetResult();

        if (uploadFileName) {
            uploadFileName.textContent = file.name;
        }

        // Display uploaded image immediately.
        imagePreviewUrl = URL.createObjectURL(file);

        preview.src = imagePreviewUrl;
        preview.hidden = false;

        reader.hidden = true;

        showMessage('Reading uploaded image...');

        // Use a separate temporary scanner element.
        const temporaryReader = document.createElement('div');

        temporaryReader.id =
            'jscan-image-reader-' + Date.now();

        temporaryReader.style.display = 'none';

        document.body.appendChild(temporaryReader);

        let imageScanner = null;

        try {

            imageScanner = new Html5Qrcode(temporaryReader.id);

            const decodedText = await imageScanner.scanFile(
                file,
                false
            );

            if (decodedText) {

                displayResult(decodedText, 'uploaded_image');

            } else {

                showMessage(
                    'No QR code was detected. Try a clearer image.',
                    true
                );
            }

        } catch (error) {

            console.error('Image scan error:', error);

            showMessage(
                'No QR code was detected. Try a clearer image.',
                true
            );

        } finally {

            if (imageScanner) {

                try {
                    await imageScanner.clear();
                } catch (error) {
                    console.warn('Image scanner cleanup:', error);
                }
            }

            temporaryReader.remove();

            imageScanInProgress = false;
        }

    });

    // ==========================================
    // COPY RESULT
    // ==========================================

    if (copyBtn) {

        copyBtn.addEventListener('click', async () => {

            if (!lastResult) return;

            try {

                await navigator.clipboard.writeText(lastResult);

                showMessage('Result copied successfully!');

            } catch (error) {

                showMessage(
                    'Unable to copy. Please select and copy the result.',
                    true
                );
            }
        });
    }

    // ==========================================
    // INITIAL STATE
    // ==========================================

    reader.hidden = true;
    stopBtn.hidden = true;
    startBtn.hidden = false;
    resultBox.hidden = true;

    console.log('JScan QR scanner initialized successfully.');

});
