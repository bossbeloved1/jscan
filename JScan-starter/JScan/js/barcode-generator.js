
/* ==========================================
   JSCAN - BARCODE GENERATOR
   Colour Customization + PNG + SVG
   Supabase Activity History Integration
========================================== */

document.addEventListener('DOMContentLoaded', () => {

    const barcodeText = document.getElementById('barcodeText');
    const barcodeFormat = document.getElementById('barcodeFormat');

    const generateBtn = document.getElementById('generateBarcodeBtn');

    const downloadPngBtn = document.getElementById('downloadPngBtn');
    const downloadSvgBtn = document.getElementById('downloadSvgBtn');

    const barcodeResult = document.getElementById('barcodeResult');
    const barcodeMessage = document.getElementById('barcodeMessage');

    const barcode = document.getElementById('barcode');
    const barcodePreview = document.getElementById('barcodePreview');

    const fg = document.getElementById('qrColor');
    const bg = document.getElementById('bgColor');

    const fgHex = document.getElementById('qrHex');
    const bgHex = document.getElementById('bgHex');

    const swatches = document.getElementById('swatches');
    const contrastNote = document.getElementById('contrastNote');

    let barcodeGenerated = false;
    let updateTimeout;


    /* ==========================================
       SUPABASE ACTIVITY LOGGER
    ========================================== */

    async function logActivity(action, fileName, details = {}) {

        const db = window.jscanDB;

        if (!db) {
            console.warn(
                'JScan: Supabase is unavailable. Activity not recorded.'
            );
            return;
        }

        try {

            const {
                data: { user },
                error: userError
            } = await db.auth.getUser();

            if (userError) {
                console.error(
                    'Unable to retrieve authenticated user:',
                    userError
                );
                return;
            }

            if (!user) {
                console.warn(
                    'JScan: No authenticated user. Activity not recorded.'
                );
                return;
            }

            const { error } = await db
                .from('activity_history')
                .insert({
                    user_id: user.id,
                    tool_name: 'Barcode Generator',
                    action: action,
                    file_name: fileName,
                    status: 'Success',
                    details: details
                });

            if (error) {
                console.error(
                    'Barcode activity logging error:',
                    error
                );
            } else {
                console.log(
                    'JScan: Barcode activity recorded successfully.'
                );
            }

        } catch (error) {

            console.error(
                'Unexpected barcode activity error:',
                error
            );

        }

    }


    /* ==========================================
       DISPLAY MESSAGE
    ========================================== */

    function showMessage(message, isError = false) {

        barcodeMessage.textContent = message;

        barcodeMessage.style.color = isError
            ? '#dc2626'
            : '#16a34a';

    }


    /* ==========================================
       CHECK HEX COLOUR
    ========================================== */

    function validHex(value) {

        return /^#[0-9A-Fa-f]{6}$/.test(value);

    }


    /* ==========================================
       HEX TO RGB
    ========================================== */

    function hexToRgb(hex) {

        const clean = hex.replace('#', '');

        return {
            r: parseInt(clean.substring(0, 2), 16),
            g: parseInt(clean.substring(2, 4), 16),
            b: parseInt(clean.substring(4, 6), 16)
        };

    }


    /* ==========================================
       RELATIVE LUMINANCE
    ========================================== */

    function luminance(hex) {

        const rgb = hexToRgb(hex);

        const channels = [rgb.r, rgb.g, rgb.b].map(value => {

            value /= 255;

            return value <= 0.04045
                ? value / 12.92
                : Math.pow((value + 0.055) / 1.055, 2.4);

        });

        return (
            0.2126 * channels[0] +
            0.7152 * channels[1] +
            0.0722 * channels[2]
        );

    }


    /* ==========================================
       CONTRAST RATIO
    ========================================== */

    function checkContrast() {

        const first = luminance(fg.value);
        const second = luminance(bg.value);

        const lighter = Math.max(first, second);
        const darker = Math.min(first, second);

        const ratio = (lighter + 0.05) / (darker + 0.05);

        contrastNote.style.display = ratio < 3 ? 'block' : 'none';

    }


    /* ==========================================
       GENERATE BARCODE
    ========================================== */

    function generateBarcode(shouldLog = false) {

        const value = barcodeText.value.trim();
        const format = barcodeFormat.value;

        if (!value) {

            barcodeGenerated = false;
            barcodeResult.hidden = true;

            showMessage('Please enter text or a number.', true);

            return false;

        }


        if (format === 'EAN13' && !/^\d{12,13}$/.test(value)) {

            barcodeGenerated = false;
            barcodeResult.hidden = true;

            showMessage('EAN-13 requires 12 or 13 digits.', true);

            return false;

        }


        if (format === 'UPC' && !/^\d{11,12}$/.test(value)) {

            barcodeGenerated = false;
            barcodeResult.hidden = true;

            showMessage('UPC-A requires 11 or 12 digits.', true);

            return false;

        }


        if (format === 'CODE39' && !/^[0-9A-Z\-. $/+%]+$/.test(value)) {

            barcodeGenerated = false;
            barcodeResult.hidden = true;

            showMessage(
                'Code 39 supports uppercase letters, numbers and selected symbols.',
                true
            );

            return false;

        }


        if (format === 'CODE128' && !/^[\x20-\x7E]+$/.test(value)) {

            barcodeGenerated = false;
            barcodeResult.hidden = true;

            showMessage(
                'Code 128 supports standard printable characters.',
                true
            );

            return false;

        }


        if (!validHex(fg.value) || !validHex(bg.value)) {

            showMessage('Please enter valid HEX colour codes.', true);

            return false;

        }


        if (typeof JsBarcode === 'undefined') {

            showMessage(
                'Barcode library could not load. Refresh the page.',
                true
            );

            return false;

        }


        try {

            barcode.innerHTML = '';

            JsBarcode(barcode, value, {

                format: format,

                lineColor: fg.value,

                background: bg.value,

                width: 2,

                height: 100,

                displayValue: true,

                fontSize: 16,

                fontOptions: 'bold',

                textMargin: 8,

                margin: 15

            });


            barcodePreview.style.backgroundColor = bg.value;

            barcodeResult.hidden = false;

            barcodeGenerated = true;

            checkContrast();

            showMessage('Barcode generated successfully!');


            /* ==========================================
               RECORD BARCODE GENERATION
               Include encoded value for future recreation
            ========================================== */

            if (shouldLog) {

                logActivity(
                    'Barcode generated',
                    `Barcode (${format})`,
                    {
                        barcode_value: value,
                        format: format,
                        foreground_color: fg.value,
                        background_color: bg.value
                    }
                );

            }

            return true;

        } catch (error) {

            console.error('Barcode generation error:', error);

            barcodeGenerated = false;
            barcodeResult.hidden = true;

            showMessage(
                'Unable to generate this barcode. Check your input and format.',
                true
            );

            return false;

        }

    }


    /* ==========================================
       DEBOUNCED LIVE UPDATE
    ========================================== */

    function liveUpdate() {

        clearTimeout(updateTimeout);

        updateTimeout = setTimeout(() => {

            if (barcodeGenerated) {

                generateBarcode(false);

            } else {

                checkContrast();

            }

        }, 180);

    }


    /* ==========================================
       SYNC COLOUR PICKER TO HEX
    ========================================== */

    fg.addEventListener('input', () => {

        fgHex.value = fg.value.toUpperCase();

        updateSelectedSwatch();

        liveUpdate();

    });


    bg.addEventListener('input', () => {

        bgHex.value = bg.value.toUpperCase();

        liveUpdate();

    });


    /* ==========================================
       SYNC HEX TO COLOUR PICKER
    ========================================== */

    fgHex.addEventListener('input', () => {

        const value = fgHex.value.trim();

        if (validHex(value)) {

            fg.value = value;

            updateSelectedSwatch();

            liveUpdate();

        }

    });


    bgHex.addEventListener('input', () => {

        const value = bgHex.value.trim();

        if (validHex(value)) {

            bg.value = value;

            liveUpdate();

        }

    });


    /* ==========================================
       VALIDATE HEX WHEN USER LEAVES INPUT
    ========================================== */

    fgHex.addEventListener('blur', () => {

        if (!validHex(fgHex.value.trim())) {

            fgHex.value = fg.value.toUpperCase();

        }

    });


    bgHex.addEventListener('blur', () => {

        if (!validHex(bgHex.value.trim())) {

            bgHex.value = bg.value.toUpperCase();

        }

    });


    /* ==========================================
       UPDATE SELECTED PRESET
    ========================================== */

    function updateSelectedSwatch() {

        swatches.querySelectorAll('button').forEach(button => {

            button.classList.toggle(
                'selected',
                button.dataset.color.toUpperCase() === fg.value.toUpperCase()
            );

        });

    }


    /* ==========================================
       PRESET COLOUR BUTTONS
    ========================================== */

    swatches.querySelectorAll('button').forEach(button => {

        button.addEventListener('click', () => {

            const colour = button.dataset.color;

            fg.value = colour;

            fgHex.value = colour.toUpperCase();

            updateSelectedSwatch();

            liveUpdate();

        });

    });


    /* ==========================================
       GENERATE BUTTON
    ========================================== */

    generateBtn.addEventListener('click', () => {

        generateBarcode(true);

    });


    /* ==========================================
       DOWNLOAD SVG
    ========================================== */

    downloadSvgBtn.addEventListener('click', () => {

        if (!barcodeGenerated) {

            showMessage(
                'Generate a barcode before downloading.',
                true
            );

            return;

        }


        try {

            const svgData = new XMLSerializer().serializeToString(barcode);

            const blob = new Blob(
                [svgData],
                { type: 'image/svg+xml;charset=utf-8' }
            );

            downloadBlob(blob, 'jscan-barcode.svg');

            logActivity(
                'Barcode downloaded (SVG)',
                'jscan-barcode.svg',
                {
                    barcode_value: barcodeText.value.trim(),
                    format: barcodeFormat.value,
                    foreground_color: fg.value,
                    background_color: bg.value,
                    file_type: 'SVG'
                }
            );

            showMessage('SVG barcode downloaded successfully!');

        } catch (error) {

            console.error(error);

            showMessage('Unable to download SVG barcode.', true);

        }

    });


    /* ==========================================
       DOWNLOAD PNG
    ========================================== */

    downloadPngBtn.addEventListener('click', () => {

        if (!barcodeGenerated) {

            showMessage(
                'Generate a barcode before downloading.',
                true
            );

            return;

        }


        try {

            const svgData = new XMLSerializer().serializeToString(barcode);

            const svgBlob = new Blob(
                [svgData],
                { type: 'image/svg+xml;charset=utf-8' }
            );

            const url = URL.createObjectURL(svgBlob);

            const image = new Image();


            image.onload = () => {

                const canvas = document.createElement('canvas');

                const scale = 3;

                canvas.width = image.width * scale;
                canvas.height = image.height * scale;

                const context = canvas.getContext('2d');

                context.fillStyle = bg.value;

                context.fillRect(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );

                context.scale(scale, scale);

                context.drawImage(image, 0, 0);

                URL.revokeObjectURL(url);


                canvas.toBlob(blob => {

                    if (!blob) {

                        showMessage(
                            'Unable to create PNG image.',
                            true
                        );

                        return;

                    }

                    downloadBlob(blob, 'jscan-barcode.png');

                    logActivity(
                        'Barcode downloaded (PNG)',
                        'jscan-barcode.png',
                        {
                            barcode_value: barcodeText.value.trim(),
                            format: barcodeFormat.value,
                            foreground_color: fg.value,
                            background_color: bg.value,
                            file_type: 'PNG'
                        }
                    );

                    showMessage('PNG barcode downloaded successfully!');

                }, 'image/png');

            };


            image.onerror = () => {

                URL.revokeObjectURL(url);

                showMessage(
                    'Unable to convert barcode to PNG.',
                    true
                );

            };


            image.src = url;

        } catch (error) {

            console.error(error);

            showMessage(
                'Unable to download PNG barcode.',
                true
            );

        }

    });


    /* ==========================================
       DOWNLOAD HELPER
    ========================================== */

    function downloadBlob(blob, filename) {

        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');

        link.href = url;
        link.download = filename;

        document.body.appendChild(link);

        link.click();

        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);

    }


    /* ==========================================
       ENTER KEY
    ========================================== */

    barcodeText.addEventListener('keydown', event => {

        if (event.key === 'Enter') {

            generateBarcode(true);

        }

    });


    /* ==========================================
       INITIAL SETTINGS
    ========================================== */

    fgHex.value = fg.value.toUpperCase();

    bgHex.value = bg.value.toUpperCase();

    updateSelectedSwatch();

    checkContrast();

});
