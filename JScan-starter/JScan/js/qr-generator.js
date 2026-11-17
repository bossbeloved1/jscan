
(() => {
    'use strict';

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
    const logoShape = $('logoShape');
    const removeLogo = $('removeLogo');

    // QR appearance elements
    const qrPattern = $('qrPattern');
    const qrCorner = $('qrCorner');

    let qrInstance = null;
    let uploadedLogo = null;
    let logoReady = false;
    let isSaving = false;

    // ==========================================
    // 2. VALIDATION AND HELPERS
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

    function getSelectedStyles() {
        return {
            qr_pattern: qrPattern.value,
            qr_corner: qrCorner.value,
            logo_shape: uploadedLogo && logoReady
                ? logoShape.value
                : null,
            logo_size: uploadedLogo && logoReady
                ? Number(logoSize.value)
                : null
        };
    }

    function getCanvas() {
        return holder.querySelector('canvas');
    }

    function downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = fileName;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1500);
    }

    // ==========================================
    // 3. ACTIVITY HISTORY LOGGER
    // ==========================================

    async function logActivity(action, fileName = null, details = {}) {
        try {
            const db = window.jscanDB;

            if (!db) {
                throw new Error('Supabase is not connected.');
            }

            const { data, error: sessionError } =
                await db.auth.getSession();

            if (sessionError) throw sessionError;

            const user = data.session?.user;

            // Do not record guest activities.
            if (!user) {
                return {
                    success: false,
                    skipped: true
                };
            }

            // ----------------------------------
            // PREVENT DUPLICATE SAVED QR ENTRIES
            // ----------------------------------

            if (
                action === 'QR code saved to account' &&
                details.image_path
            ) {
                const { data: existing, error: lookupError } =
                    await db
                        .from('activity_history')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('tool_name', 'QR Code Generator')
                        .eq('action', action)
                        .eq('details->>image_path', details.image_path)
                        .limit(1);

                if (lookupError) throw lookupError;

                if (existing && existing.length > 0) {
                    return {
                        success: true,
                        duplicate: true
                    };
                }
            }

            // ----------------------------------
            // INSERT ACTIVITY
            // ----------------------------------

            const { error } = await db
                .from('activity_history')
                .insert([{
                    user_id: user.id,
                    tool_name: 'QR Code Generator',
                    action: action,
                    file_name: fileName,
                    status: 'Completed',
                    details: details
                }]);

            if (error) throw error;

            return {
                success: true
            };

        } catch (error) {
            console.error('Activity logging error:', error);

            return {
                success: false,
                error: error.message || 'Activity logging failed.'
            };
        }
    }

    // ==========================================
    // 4. CREATE SHAPED LOGO
    // ==========================================

    function createShapedLogo() {
        if (!uploadedLogo || !logoReady) {
            return null;
        }

        const dimension = 512;
        const canvas = document.createElement('canvas');

        canvas.width = dimension;
        canvas.height = dimension;

        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('Unable to prepare the uploaded logo.');
        }

        const shape = logoShape.value;
        const padding = dimension * 0.08;

        const x = padding;
        const y = padding;
        const boxSize = dimension - padding * 2;

        const innerPadding = boxSize * 0.19;

        const imageSize = boxSize - innerPadding * 2;

        const imageRatio = Math.min(
            imageSize / uploadedLogo.width,
            imageSize / uploadedLogo.height
        );

        const drawWidth = uploadedLogo.width * imageRatio;
        const drawHeight = uploadedLogo.height * imageRatio;

        const drawX = (dimension - drawWidth) / 2;
        const drawY = (dimension - drawHeight) / 2;

        ctx.save();

        // Create the selected logo shape.
        ctx.beginPath();

        switch (shape) {

            case 'circle':
                ctx.arc(
                    dimension / 2,
                    dimension / 2,
                    boxSize / 2,
                    0,
                    Math.PI * 2
                );
                break;

            case 'rounded':
                ctx.roundRect(
                    x,
                    y,
                    boxSize,
                    boxSize,
                    boxSize * 0.22
                );
                break;

            case 'diamond':
                ctx.moveTo(dimension / 2, y);
                ctx.lineTo(x + boxSize, dimension / 2);
                ctx.lineTo(dimension / 2, y + boxSize);
                ctx.lineTo(x, dimension / 2);
                ctx.closePath();
                break;

            case 'hexagon':
                for (let i = 0; i < 6; i++) {
                    const angle =
                        (Math.PI / 3) * i - Math.PI / 6;

                    const px =
                        dimension / 2 +
                        (boxSize / 2) * Math.cos(angle);

                    const py =
                        dimension / 2 +
                        (boxSize / 2) * Math.sin(angle);

                    if (i === 0) {
                        ctx.moveTo(px, py);
                    } else {
                        ctx.lineTo(px, py);
                    }
                }

                ctx.closePath();
                break;

            case 'shield':
                ctx.moveTo(dimension / 2, y);
                ctx.lineTo(x + boxSize, y + boxSize * 0.13);
                ctx.lineTo(x + boxSize * 0.88, y + boxSize * 0.65);
                ctx.lineTo(dimension / 2, y + boxSize);
                ctx.lineTo(x + boxSize * 0.12, y + boxSize * 0.65);
                ctx.lineTo(x, y + boxSize * 0.13);
                ctx.closePath();
                break;

            default:
                ctx.rect(x, y, boxSize, boxSize);
                break;
        }

        // Fill the selected shape with the QR background colour.
        ctx.fillStyle = bg.value;
        ctx.fill();

        // Clip the logo to the selected shape.
        ctx.clip();

        ctx.drawImage(
            uploadedLogo,
            drawX,
            drawY,
            drawWidth,
            drawHeight
        );

        ctx.restore();

        return canvas.toDataURL('image/png');
    }

    // ==========================================
    // 5. LOGO UPLOAD
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

                    clearGeneratedQr();
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
    // 6. LOGO SIZE CONTROL
    // ==========================================

    if (logoSize) {
        logoSize.addEventListener('input', function () {
            logoSizeValue.textContent = this.value + '%';
            clearGeneratedQr();
        });
    }

    // ==========================================
    // 7. LOGO SHAPE CONTROL
    // ==========================================

    if (logoShape) {
        logoShape.addEventListener('change', clearGeneratedQr);
    }

    // ==========================================
    // 8. REMOVE LOGO
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

            clearGeneratedQr();
        });
    }

    // ==========================================
    // 9. CLEAR GENERATED QR CODE
    // ==========================================

    function clearGeneratedQr() {
        holder.replaceChildren();
        holder.style.display = 'none';

        placeholder.hidden = false;

        qrInstance = null;

        downloadPng.disabled = true;
        downloadSvg.disabled = true;

        if (saveQrCode) {
            saveQrCode.disabled = true;
        }
    }

    // ==========================================
    // 10. GENERATE QR CODE
    // ==========================================

    function generateQr() {
        const content = text.value.trim();

        clearGeneratedQr();

        if (!content) {
            contrastNote.textContent =
                'Please enter some text or a website URL first.';

            return false;
        }

        if (!window.QRCodeStyling) {
            contrastNote.textContent =
                'QR styling library did not load. Check your internet connection and refresh.';

            return false;
        }

        const dimension = Number(size.value);

        if (!Number.isFinite(dimension) || dimension <= 0) {
            contrastNote.textContent =
                'Please select a valid QR code size.';

            return false;
        }

        try {
            let logoImage = null;

            if (uploadedLogo && logoReady) {
                logoImage = createShapedLogo();
            }

            const pattern = qrPattern.value;
            const corner = qrCorner.value;

            const options = {
                width: dimension,
                height: dimension,
                type: 'canvas',
                data: content,

                margin: 12,

                qrOptions: {
                    errorCorrectionLevel: 'H'
                },

                backgroundOptions: {
                    color: bg.value
                },

                dotsOptions: {
                    color: fg.value,
                    type: pattern
                },

                cornersSquareOptions: {
                    color: fg.value,
                    type: corner
                },

                cornersDotOptions: {
                    color: fg.value,
                    type: corner === 'dot' ? 'dot' : 'square'
                },

                imageOptions: {
                    hideBackgroundDots: true,
                    imageSize: uploadedLogo && logoReady
                        ? Number(logoSize.value) / 100
                        : 0.18,
                    margin: 8,
                    crossOrigin: 'anonymous'
                }
            };

            if (logoImage) {
                options.image = logoImage;
            }

            qrInstance = new QRCodeStyling(options);

            holder.replaceChildren();
            holder.style.display = 'block';

            qrInstance.append(holder);

            placeholder.hidden = true;

            // Check colour contrast.
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

            downloadPng.disabled = false;
            downloadSvg.disabled = false;

            if (saveQrCode) {
                saveQrCode.disabled = isSaving;
            }

            return true;

        } catch (error) {
            console.error('QR generation error:', error);

            clearGeneratedQr();

            contrastNote.textContent =
                'Unable to generate QR code. Please try again.';

            return false;
        }
    }

    // ==========================================
    // 11. COLOUR PICKER EVENTS
    // ==========================================

    fg.addEventListener('input', () => {
        syncColor(fg, fgHex);
        clearGeneratedQr();
    });

    bg.addEventListener('input', () => {
        syncColor(bg, bgHex);
        clearGeneratedQr();
    });

    // ==========================================
    // 12. HEX COLOUR INPUTS
    // ==========================================

    fgHex.addEventListener('input', () => {
        if (validHex(fgHex.value)) {
            fg.value = fgHex.value;
            clearGeneratedQr();
        }
    });

    bgHex.addEventListener('input', () => {
        if (validHex(bgHex.value)) {
            bg.value = bgHex.value;
            clearGeneratedQr();
        }
    });

    // ==========================================
    // 13. CONTENT AND SIZE EVENTS
    // ==========================================

    text.addEventListener('input', clearGeneratedQr);

    size.addEventListener('change', clearGeneratedQr);

    // ==========================================
    // 14. QR PATTERN AND CORNER EVENTS
    // ==========================================

    if (qrPattern) {
        qrPattern.addEventListener('change', clearGeneratedQr);
    }

    if (qrCorner) {
        qrCorner.addEventListener('change', clearGeneratedQr);
    }

    // ==========================================
    // 15. GENERATE BUTTON
    // ==========================================

    generateBtn.addEventListener('click', async () => {
        const generated = generateQr();

        if (!generated) return;

        await logActivity(
            'QR code generated',
            null,
            {
                size: Number(size.value),
                foreground_color: fg.value.toUpperCase(),
                background_color: bg.value.toUpperCase(),
                logo_used: Boolean(uploadedLogo && logoReady),
                ...getSelectedStyles()
            }
        );
    });

    // ==========================================
    // 16. POPULAR COLOUR PRESETS
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

        clearGeneratedQr();
    });

    // ==========================================
    // 17. CREATE QR IMAGE BLOB
    // ==========================================

    async function createQrImageBlob(extension) {
        if (!qrInstance) {
            throw new Error('Please generate a QR code first.');
        }

        const blob = await qrInstance.getRawData(extension);

        if (!blob) {
            throw new Error('Could not create the QR image.');
        }

        return blob;
    }

    // ==========================================
    // 18. DOWNLOAD PNG
    // ==========================================

    downloadPng.addEventListener('click', async () => {
        if (!qrInstance) {
            alert('Generate a QR code first.');
            return;
        }

        try {
            const blob = await createQrImageBlob('png');
            const fileName = 'jscan-qr-code.png';

            downloadBlob(blob, fileName);

            await logActivity(
                'QR code downloaded as PNG',
                fileName,
                {
                    size: Number(size.value),
                    foreground_color: fg.value.toUpperCase(),
                    background_color: bg.value.toUpperCase(),
                    ...getSelectedStyles()
                }
            );

        } catch (error) {
            console.error('PNG download error:', error);
            alert(error.message || 'Unable to download the QR code.');
        }
    });

    // ==========================================
    // 19. DOWNLOAD SVG
    // ==========================================

    downloadSvg.addEventListener('click', async () => {
        if (!qrInstance) {
            alert('Generate a QR code first.');
            return;
        }

        try {
            const blob = await createQrImageBlob('svg');
            const fileName = 'jscan-qr-code.svg';

            downloadBlob(blob, fileName);

            await logActivity(
                'QR code downloaded as SVG',
                fileName,
                {
                    size: Number(size.value),
                    foreground_color: fg.value.toUpperCase(),
                    background_color: bg.value.toUpperCase(),
                    ...getSelectedStyles()
                }
            );

        } catch (error) {
            console.error('SVG download error:', error);
            alert(error.message || 'Unable to download the QR code.');
        }
    });

    // ==========================================
    // 20. SAVE QR CODE AND IMAGE TO SUPABASE
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

            if (!qrInstance) {
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
            let qrSavedToDatabase = false;

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
                // B. CONVERT QR TO PNG
                // ----------------------------------

                const imageBlob = await createQrImageBlob('png');

                // ----------------------------------
                // C. CREATE UNIQUE IMAGE FILE NAME
                // ----------------------------------

                const uniqueId = window.crypto?.randomUUID
                    ? window.crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

                const fileName = `${uniqueId}.png`;
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

                qrSavedToDatabase = true;

                // ----------------------------------
                // G. RECORD ACTIVITY
                // ----------------------------------

                showSaveMessage('Recording activity...', 'info');

                const activityResult = await logActivity(
                    'QR code saved to account',
                    fileName,
                    {
                        title: qrData.title,
                        size: qrData.size,
                        foreground_color: qrData.foreground_color,
                        background_color: qrData.background_color,
                        image_path: imagePath,
                        logo_used: Boolean(uploadedLogo && logoReady),
                        ...getSelectedStyles()
                    }
                );

                // ----------------------------------
                // H. SUCCESS OR ACTIVITY WARNING
                // ----------------------------------

                if (activityResult.success) {
                    showSaveMessage(
                        '✓ QR code and image saved successfully to your JScan account!',
                        'success'
                    );
                } else {
                    showSaveMessage(
                        'Your QR code was saved successfully, but Activity History could not be updated. Your QR code is safe.',
                        'info'
                    );
                }

            } catch (error) {

                console.error('QR save error:', error);

                // ----------------------------------
                // I. CLEAN UP IF DATABASE SAVE FAILED
                // ----------------------------------

                if (uploadedImagePath && !qrSavedToDatabase) {
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

                saveQrCode.disabled = !qrInstance;
                saveQrCode.textContent = 'Save QR Code';

            }
        });
    }

    // ==========================================
    // 21. INITIALIZE
    // ==========================================

    // Do not generate a QR code automatically on page load.
    clearGeneratedQr();

})();
