
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

    if (!startBtn || !stopBtn || !reader) return;

    let scanner = null;
    let cameraRunning = false;
    let lastResult = '';
    let imagePreviewUrl = null;

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

    function displayResult(value) {
        if (!value) return;

        lastResult = value;
        resultText.textContent = value;
        resultBox.hidden = false;

        try {
            const url = new URL(value);

            if (url.protocol === 'https:' || url.protocol === 'http:') {
                openBtn.href = url.href;
                openBtn.hidden = false;
            } else {
                openBtn.hidden = true;
            }
        } catch {
            openBtn.hidden = true;
        }

        showMessage('Barcode scanned successfully!');
    }

    async function stopCamera() {
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

        showMessage('Camera stopped.');
    }

    async function startCamera() {
        if (typeof Html5Qrcode === 'undefined') {
            showMessage('Scanner library could not load. Check your internet connection.', true);
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
                    qrbox: { width: 300, height: 150 }
                },
                (decodedText) => {
                    displayResult(decodedText);
                    stopCamera();
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

        showMessage('Scanning uploaded barcode image...');

        try {
            const imageScanner = new Html5Qrcode('reader', {
                formatsToSupport: barcodeFormats,
                verbose: false
            });

            const decodedText = await imageScanner.scanFile(file, false);

            displayResult(decodedText);

            imageScanner.clear();

        } catch (error) {
            console.error('Image scan error:', error);

            showMessage(
                'No supported barcode was detected. Try a clearer image.',
                true
            );
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
