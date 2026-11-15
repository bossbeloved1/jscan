
document.addEventListener('DOMContentLoaded', () => {

    const startBtn = document.getElementById('startScannerBtn');
    const stopBtn = document.getElementById('stopScannerBtn');
    const reader = document.getElementById('reader');

    const imageInput = document.getElementById('barcodeImageInput');
    const uploadFileName = document.getElementById('uploadFileName');

    const message = document.getElementById('scannerMessage');

    const resultBox = document.getElementById('scanResult');
    const resultText = document.getElementById('scanResultText');
    const preview = document.getElementById('scanPreview');

    const copyBtn = document.getElementById('copyResultBtn');
    const openBtn = document.getElementById('openResultBtn');

    const db = window.jscanDB;

    if (!startBtn || !stopBtn || !reader) return;

    let scanner = null;
    let cameraRunning = false;
    let lastResult = '';
    let imagePreviewUrl = null;
    let historySaveAttempted = false;

    const barcodeFormats = [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.CODABAR
    ];

    function showMessage(text, error = false) {
        if (!message) return;

        message.textContent = text;
        message.style.color = error ? '#dc2626' : 'var(--muted)';
    }

    function resetResult() {

        resultBox.hidden = true;
        resultText.textContent = '';

        openBtn.hidden = true;
        openBtn.removeAttribute('href');

        preview.hidden = true;
        preview.removeAttribute('src');

        if (imagePreviewUrl) {
            URL.revokeObjectURL(imagePreviewUrl);
            imagePreviewUrl = null;
        }

        lastResult = '';
        historySaveAttempted = false;
    }

    // ==========================================
    // SAVE BARCODE SCAN TO HISTORY
    // ==========================================

    async function saveScanToHistory(value, source) {

        if (!value || historySaveAttempted) return;

        historySaveAttempted = true;

        if (!db) {
            console.error('JScan database client is unavailable.');
            showMessage('Scan successful, but History could not be reached.', true);
            return;
        }

        try {

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
                    action: 'barcode_scan',
                    file_name: null,
                    status: 'completed',
                    details: {
                        scanned_text: value,
                        scan_result: value,
                        source: source,
                        barcode: true,
                        scanned_at: new Date().toISOString()
                    },
                    is_permanent: true,
                    expires_at: null
                });

            if (insertError) throw insertError;

            showMessage('Barcode scanned and added to History!');

        } catch (error) {

            console.error('Barcode History Error:', error);

            showMessage(
                'Barcode scanned, but could not be added to History.',
                true
            );

        }
    }

    // ==========================================
    // DISPLAY RESULT
    // ==========================================

    function displayResult(value, source = 'camera') {

        if (!value) return;

        lastResult = value;

        resultText.textContent = value;
        resultBox.hidden = false;

        try {

            const url = new URL(value);

            if (
                url.protocol === 'https:' ||
                url.protocol === 'http:'
            ) {
                openBtn.href = url.href;
                openBtn.hidden = false;
            } else {
                openBtn.hidden = true;
            }

        } catch {
            openBtn.hidden = true;
        }

        saveScanToHistory(value, source);

    }

    // ==========================================
    // STOP CAMERA
    // ==========================================

    async function stopCamera(silent = false) {

        if (scanner && cameraRunning) {

            try {

                await scanner.stop();
                await scanner.clear();

            } catch (error) {

                console.warn('Camera stop:', error);

            }

        }

        cameraRunning = false;

        reader.hidden = true;
        stopBtn.hidden = true;
        startBtn.hidden = false;
        startBtn.disabled = false;

        if (!silent) {
            showMessage('Camera stopped.');
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

        if (cameraRunning) return;

        resetResult();

        reader.hidden = false;
        startBtn.disabled = true;

        showMessage('Requesting camera permission...');

        try {

            scanner = new Html5Qrcode('reader', {
                formatsToSupport: barcodeFormats,
                verbose: false
            });

            await scanner.start(
                { facingMode: 'environment' },
                {
                    fps: 10,
                    qrbox: {
                        width: 300,
                        height: 150
                    }
                },
                (decodedText) => {

                    if (cameraRunning && !historySaveAttempted) {

                        displayResult(decodedText, 'camera');

                        stopCamera(true);

                    }

                },
                () => {}
            );

            cameraRunning = true;

            startBtn.hidden = true;
            startBtn.disabled = false;
            stopBtn.hidden = false;

            showMessage('Camera is active. Point it at a barcode.');

        } catch (error) {

            console.error('Camera error:', error);

            cameraRunning = false;

            reader.hidden = true;
            startBtn.hidden = false;
            startBtn.disabled = false;
            stopBtn.hidden = true;

            showMessage(
                'Camera access failed. Check camera permission and ensure the website uses HTTPS.',
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
    // SCAN UPLOADED BARCODE IMAGE
    // ==========================================

    if (imageInput) {

        imageInput.addEventListener('change', async () => {

            const file = imageInput.files[0];

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

            resetResult();

            if (uploadFileName) {
                uploadFileName.textContent = file.name;
            }

            imagePreviewUrl = URL.createObjectURL(file);

            preview.src = imagePreviewUrl;
            preview.hidden = false;

            reader.hidden = false;

            showMessage('Scanning uploaded barcode image...');

            let imageScanner = null;

            try {

                imageScanner = new Html5Qrcode('reader', {
                    formatsToSupport: barcodeFormats,
                    verbose: false
                });

                const decodedText = await imageScanner.scanFile(file, false);

                displayResult(decodedText, 'uploaded_image');

            } catch (error) {

                console.error('Image scan error:', error);

                showMessage(
                    'No supported barcode was detected. Try a clearer image.',
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

                reader.hidden = true;

            }

        });

    }

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

});
