
document.addEventListener('DOMContentLoaded', () => {

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

    if (!startBtn || !stopBtn || !reader) return;

    let scanner = null;
    let cameraRunning = false;
    let lastResult = '';
    let imagePreviewUrl = null;

    function showMessage(text, error = false) {
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
    }

    function displayResult(decodedText) {

        if (!decodedText) return;

        lastResult = decodedText;

        resultText.textContent = decodedText;
        resultBox.hidden = false;

        let parsedUrl;

        try {
            parsedUrl = new URL(decodedText);

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

        showMessage('QR code scanned successfully!');

        stopCamera();
    }

    async function stopCamera() {

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

            showMessage('Camera stopped.');

        } catch (error) {

            console.error('Camera stop error:', error);

            showMessage('Unable to stop the camera. Please try again.', true);

        }
    }

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
                    if (cameraRunning) {
                        displayResult(decodedText);
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

    startBtn.addEventListener('click', startCamera);

    stopBtn.addEventListener('click', stopCamera);

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
            await stopCamera();
        }

        if (typeof Html5Qrcode === 'undefined') {
            showMessage('Scanner library could not load.', true);
            return;
        }

        resetResult();

        uploadFileName.textContent = file.name;

        imagePreviewUrl = URL.createObjectURL(file);

        preview.src = imagePreviewUrl;
        preview.hidden = false;

        reader.hidden = false;

        showMessage('Scanning uploaded image...');

        let imageScanner = null;

        try {

            imageScanner = new Html5Qrcode('reader');

            const decodedText = await imageScanner.scanFile(file, false);

            lastResult = decodedText;

            resultText.textContent = decodedText;
            resultBox.hidden = false;

            let parsedUrl;

            try {

                parsedUrl = new URL(decodedText);

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

            showMessage('QR code detected successfully!');

        } catch (error) {

            console.error('Image scan error:', error);

            showMessage(
                'No QR code was detected. Try a clearer image.',
                true
            );

            preview.hidden = false;

        } finally {

            if (imageScanner) {
                try {
                    await imageScanner.clear();
                } catch (error) {
                    console.warn('Scanner cleanup:', error);
                }
            }

            reader.hidden = true;

        }

    });

    copyBtn.addEventListener('click', async () => {

        if (!lastResult) return;

        try {

            await navigator.clipboard.writeText(lastResult);

            showMessage('Result copied successfully!');

        } catch (error) {

            showMessage('Unable to copy. Please select and copy the result.', true);

        }

    });

    reader.hidden = true;
    stopBtn.hidden = true;
    startBtn.hidden = false;
    resultBox.hidden = true;

});
