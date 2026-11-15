
(() => {
    const $ = id => document.getElementById(id);

    // ==========================================
    // 1. GET HTML ELEMENTS
    // ==========================================

    const text = $('qrText');
    const titleInput = $('qrTitle');
    const fg = $('qrColor');
    const bg = $('bgColor');
    const fgHex = $('qrHex');
    const bgHex = $('bgHex');

    const size = $('qrSize');
    const holder = $('qrcode');
    const placeholder = $('qrPlaceholder');

    const downloadPng = $('downloadPng');
    const downloadSvg = $('downloadSvg');
    const generateBtn = $('generateBtn');
    const contrastNote = $('contrastNote');

    const saveQrCode = $('saveQrCode');
    const saveQrMessage = $('saveQrMessage');

    // Logo elements
    const logoInput = $('qrLogo');
    const logoPreview = $('logoPreview');
    const logoOptions = $('logoOptions');
    const logoSize = $('logoSize');
    const logoSizeValue = $('logoSizeValue');
    const removeLogo = $('removeLogo');

    let qr = null;
    let debounce;
    let uploadedLogo = null;
    let logoReady = false;
    let isSaving = false;

    // ==========================================
    // 2. VALIDATION
    // ==========================================

    const validHex = value => /^#[0-9a-f]{6}$/i.test(value);

    function contrastRatio(a, b) {
        const lum = hex => {
            const rgb = hex.match(/[a-f0-9]{2}/gi)
                .map(x => parseInt(x, 16) / 255)
                .map(x =>
                    x <= 0.04045
                        ? x / 12.92
                        : ((x + 0.055) / 1.055) ** 2.4
                );

            return (
                0.2126 * rgb[0] +
                0.7152 * rgb[1] +
                0.0722 * rgb[2]
            );
        };

        const x = lum(a);
        const y = lum(b);

        return (Math.max(x, y) + 0.05) /
            (Math.min(x, y) + 0.05);
    }

    function syncColor(input, hex) {
        hex.value = input.value.toUpperCase();
    }

    function showSaveMessage(message, type = 'info') {
        if (!saveQrMessage) return;

        saveQrMessage.textContent = message;

        saveQrMessage.style.color =
            type === 'success' ? '#16a34a' :
            type === 'error' ? '#ef4444' :
            'var(--blue)';
    }

    // ==========================================
    // 3. LOGO UPLOAD
    // ==========================================

    if (logoInput) {
        logoInput.addEventListener('change', function () {
            const file = this.files[0];

            if (!file) return;

            const allowedTypes = [
                'image/png',
                'image/jpeg',
                'image/webp'
            ];

            if (!allowedTypes.includes(file.type)) {
                alert('Please upload a PNG, JPG or WEBP image.');
                this.value = '';
                return;
            }

            if (file.size > 2 * 1024 * 1024) {
                alert('Please upload an image smaller than 2MB.');
                this.value = '';
                return;
            }

            const reader = new FileReader();

            reader.onload = function (event) {
                const image = new Image();

                image.onload = function () {
                    uploadedLogo = image;
                    logoReady = true;

                    logoPreview.replaceChildren();

                    const previewImage = document.createElement('img');
                    previewImage.src = event.target.result;
                    previewImage.alt = 'Uploaded logo';

                    const successText = document.createElement('p');
                    successText.textContent = 'Logo uploaded successfully';

                    const fileName = document.createElement('small');
                    fileName.textContent = file.name;

                    logoPreview.append(
                        previewImage,
                        successText,
                        fileName
                    );

                    logoOptions.hidden = false;

                    update();
                };

                image.onerror = function () {
                    alert('Unable to load this image. Please try another file.');
                    logoInput.value = '';
                };

                image.src = event.target.result;
            };

            reader.onerror = function () {
                alert('Unable to read this file. Please try again.');
            };

            reader.readAsDataURL(file);
        });
    }

    // ==========================================
    // 4. LOGO SIZE CONTROL
    // ==========================================

    if (logoSize) {
        logoSize.addEventListener('input', function () {
            logoSizeValue.textContent = this.value + '%';
            schedule();
        });
    }

    // ==========================================
    // 5. REMOVE LOGO
    // ==========================================

    if (removeLogo) {
        removeLogo.addEventListener('click', function () {
            uploadedLogo = null;
            logoReady = false;

            logoInput.value = '';

            logoPreview.replaceChildren();

            const plus = document.createElement('span');
            plus.textContent = '＋';

            const instruction = document.createElement('p');
            instruction.textContent = 'Click to upload your logo';

            const details = document.createElement('small');
            details.textContent = 'PNG, JPG or WEBP · Maximum 2MB';

            logoPreview.append(plus, instruction, details);

            logoOptions.hidden = true;

            update();
        });
    }

    // ==========================================
    // 6. DRAW LOGO ON QR CANVAS
    // ==========================================

    function drawLogo(canvas) {
        if (!uploadedLogo || !logoReady || !canvas) return;

        const ctx = canvas.getContext('2d');

        const dimension = canvas.width;
        const logoPercentage = Number(logoSize.value) / 100;
        const logoDimension = dimension * logoPercentage;

        const x = (dimension - logoDimension) / 2;
        const y = (dimension - logoDimension) / 2;

        const padding = logoDimension * 0.18;

        const boxX = x - padding;
        const boxY = y - padding;
        const boxSize = logoDimension + padding * 2;

        ctx.save();

        ctx.fillStyle = bg.value;

        const radius = Math.min(logoDimension * 0.12, 12);

        ctx.beginPath();

        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(
                boxX,
                boxY,
                boxSize,
                boxSize,
                radius
            );
        } else {
            ctx.rect(boxX, boxY, boxSize, boxSize);
        }

        ctx.fill();

        const ratio = Math.min(
            logoDimension / uploadedLogo.width,
            logoDimension / uploadedLogo.height
        );

        const drawWidth = uploadedLogo.width * ratio;
        const drawHeight = uploadedLogo.height * ratio;

        const drawX = (dimension - drawWidth) / 2;
        const drawY = (dimension - drawHeight) / 2;

        ctx.drawImage(
            uploadedLogo,
            drawX,
            drawY,
            drawWidth,
            drawHeight
        );

        ctx.restore();
    }

    // ==========================================
    // 7. QR GENERATION
    // ==========================================

    function update() {
        const content = text.value.trim();

        downloadPng.disabled = !content;
        downloadSvg.disabled = !content;

        if (saveQrCode) {
            saveQrCode.disabled = !content || isSaving;
        }

        if (!content) {
            holder.innerHTML = '';
            holder.style.display = 'none';
            placeholder.hidden = false;
            qr = null;
            return;
        }

        if (!window.QRCode) {
            contrastNote.textContent =
                'QR library did not load. Check your internet connection and refresh.';

            return;
        }

        holder.innerHTML = '';
        holder.style.display = 'block';
        placeholder.hidden = true;

        const dimension = Number(size.value);

        qr = new QRCode(holder, {
            text: content,
            width: dimension,
            height: dimension,
            colorDark: fg.value,
            colorLight: bg.value,
            correctLevel: QRCode.CorrectLevel.H
        });

        const canvas = holder.querySelector('canvas');

        if (canvas && uploadedLogo && logoReady) {
            drawLogo(canvas);
        }

        const ratio = contrastRatio(fg.value, bg.value);

        if (ratio < 3) {
            contrastNote.textContent =
                '⚠ Low contrast. Choose a darker code colour or lighter background to improve scanning.';

            contrastNote.classList.add('warning');
        } else {
            contrastNote.textContent =
                '✓ Colour contrast looks suitable for scanning.';

            contrastNote.classList.remove('warning');
        }
    }

    // ==========================================
    // 8. UPDATE DEBOUNCE
    // ==========================================

    function schedule() {
        clearTimeout(debounce);
        debounce = setTimeout(update, 180);
    }

    // ==========================================
    // 9. COLOUR PICKER EVENTS
    // ==========================================

    fg.addEventListener('input', () => {
        syncColor(fg, fgHex);
        schedule();
    });

    bg.addEventListener('input', () => {
        syncColor(bg, bgHex);
        schedule();
    });

    // ==========================================
    // 10. HEX COLOUR INPUTS
    // ==========================================

    fgHex.addEventListener('input', () => {
        if (validHex(fgHex.value)) {
            fg.value = fgHex.value;
            schedule();
        }
    });

    bgHex.addEventListener('input', () => {
        if (validHex(bgHex.value)) {
            bg.value = bgHex.value;
            schedule();
        }
    });

    // ==========================================
    // 11. CONTENT AND SIZE EVENTS
    // ==========================================

    text.addEventListener('input', schedule);

    size.addEventListener('change', schedule);

    generateBtn.addEventListener('click', update);

    // ==========================================
    // 12. POPULAR COLOUR PRESETS
    // ==========================================

    $('swatches').addEventListener('click', event => {
        const button = event.target.closest('[data-color]');

        if (!button) return;

        fg.value = button.dataset.color;

        syncColor(fg, fgHex);

        document.querySelectorAll('.swatches button')
            .forEach(item => {
                item.classList.toggle('selected', item === button);
            });

        schedule();
    });

    // ==========================================
    // 13. GET GENERATED QR CANVAS
    // ==========================================

    function getCanvas() {
        return holder.querySelector('canvas');
    }

    // ==========================================
    // 14. CREATE PNG BLOB
    // ==========================================

    function createQrImageBlob(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (!blob) {
                    reject(new Error('Could not create the QR image.'));
                    return;
                }

                resolve(blob);
            }, 'image/png');
        });
    }

    // ==========================================
    // 15. DOWNLOAD PNG
    // ==========================================

    downloadPng.addEventListener('click', () => {
        const canvas = getCanvas();

        if (!canvas) {
            alert('Generate a QR code first.');
            return;
        }

        const output = document.createElement('canvas');
        const dimension = Number(size.value);

        output.width = dimension;
        output.height = dimension;

        const ctx = output.getContext('2d');

        ctx.fillStyle = bg.value;
        ctx.fillRect(0, 0, dimension, dimension);

        ctx.drawImage(canvas, 0, 0, dimension, dimension);

        const link = document.createElement('a');

        link.download = 'jscan-qr-code.png';
        link.href = output.toDataURL('image/png');

        link.click();
    });

    // ==========================================
    // 16. DOWNLOAD SVG
    // ==========================================

    downloadSvg.addEventListener('click', () => {
        const canvas = getCanvas();

        if (!canvas) {
            alert('Generate a QR code first.');
            return;
        }

        const dimension = Number(size.value);
        const image = canvas.toDataURL('image/png');

        const svg = `
            <svg
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
                width="${dimension}"
                height="${dimension}"
                viewBox="0 0 ${dimension} ${dimension}"
            >
                <rect
                    width="100%"
                    height="100%"
                    fill="${bg.value}"
                />

                <image
                    href="${image}"
                    xlink:href="${image}"
                    width="${dimension}"
                    height="${dimension}"
                />
            </svg>
        `;

        const blob = new Blob(
            [svg],
            { type: 'image/svg+xml;charset=utf-8' }
        );

        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');

        link.href = url;
        link.download = 'jscan-qr-code.svg';

        link.click();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
    });

    // ==========================================
    // 17. SAVE QR CODE AND IMAGE TO SUPABASE
    // ==========================================

    if (saveQrCode) {
        saveQrCode.addEventListener('click', async () => {

            if (isSaving) return;

            const content = text.value.trim();

            if (!content) {
                showSaveMessage(
                    'Please enter some text or a website URL first.',
                    'error'
                );
                return;
            }

            if (!window.jscanDB) {
                showSaveMessage(
                    'Supabase connection unavailable. Please refresh the page.',
                    'error'
                );
                return;
            }

            const canvas = getCanvas();

            if (!canvas) {
                showSaveMessage(
                    'Please generate your QR code before saving.',
                    'error'
                );
                return;
            }

            isSaving = true;
            saveQrCode.disabled = true;
            saveQrCode.textContent = 'Saving...';

            showSaveMessage('Saving your QR code...', 'info');

            let uploadedImagePath = null;

            try {

                // ----------------------------------
                // A. CHECK LOGIN SESSION
                // ----------------------------------

                const { data: sessionData, error: sessionError } =
                    await window.jscanDB.auth.getSession();

                if (sessionError) throw sessionError;

                const user = sessionData.session?.user;

                if (!user) {
                    showSaveMessage(
                        'Please log in to save QR codes to your account.',
                        'error'
                    );

                    return;
                }

                // ----------------------------------
                // B. CONVERT QR CANVAS TO PNG
                // ----------------------------------

                const imageBlob = await createQrImageBlob(canvas);

                // ----------------------------------
                // C. CREATE UNIQUE IMAGE FILE NAME
                // ----------------------------------

                const uniqueId = window.crypto?.randomUUID
                    ? window.crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

                const fileName = `${uniqueId}.png`;

                // Store each user's images inside their own folder.
                const imagePath = `${user.id}/${fileName}`;

                // ----------------------------------
                // D. UPLOAD IMAGE TO SUPABASE STORAGE
                // ----------------------------------

                showSaveMessage('Uploading QR image...', 'info');

                const { error: uploadError } =
                    await window.jscanDB
                        .storage
                        .from('qr-codes')
                        .upload(imagePath, imageBlob, {
                            contentType: 'image/png',
                            cacheControl: '3600',
                            upsert: false
                        });

                if (uploadError) throw uploadError;

                uploadedImagePath = imagePath;

                // ----------------------------------
                // E. PREPARE QR DATABASE INFORMATION
                // ----------------------------------

                const qrData = {
                    user_id: user.id,
                    title: titleInput.value.trim() || 'Untitled QR Code',
                    content: content,
                    foreground_color: fg.value.toUpperCase(),
                    background_color: bg.value.toUpperCase(),
                    size: Number(size.value),
                    image_path: imagePath
                };

                // ----------------------------------
                // F. SAVE QR DETAILS TO DATABASE
                // ----------------------------------

                showSaveMessage('Saving QR details...', 'info');

                const { error: saveError } =
                    await window.jscanDB
                        .from('qr_codes')
                        .insert([qrData]);

                if (saveError) throw saveError;

                // ----------------------------------
                // G. SUCCESS
                // ----------------------------------

                showSaveMessage(
                    '✓ QR code and image saved successfully to your JScan account!',
                    'success'
                );

            } catch (error) {

                console.error('QR save error:', error);

                // ----------------------------------
                // H. CLEAN UP IMAGE IF DATABASE SAVE FAILED
                // ----------------------------------

                if (uploadedImagePath) {
                    const { error: removeError } =
                        await window.jscanDB
                            .storage
                            .from('qr-codes')
                            .remove([uploadedImagePath]);

                    if (removeError) {
                        console.error(
                            'Could not remove uploaded QR image:',
                            removeError
                        );
                    }
                }

                showSaveMessage(
                    error.message || 'Unable to save your QR code. Please try again.',
                    'error'
                );

            } finally {

                isSaving = false;

                saveQrCode.disabled = !text.value.trim();
                saveQrCode.textContent = 'Save QR Code';

            }
        });
    }

    // ==========================================
    // 18. INITIALIZE
    // ==========================================

    update();

})();
