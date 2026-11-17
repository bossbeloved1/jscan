
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

    // Logo background
    const logoBgColor = $('logoBgColor');
    const logoBgHex = $('logoBgHex');

    // Logo border
    const logoBorderEnabled = $('logoBorderEnabled');
    const logoBorderControls = $('logoBorderControls');
    const logoBorderColor = $('logoBorderColor');
    const logoBorderHex = $('logoBorderHex');
    const logoBorderWidth = $('logoBorderWidth');
    const logoBorderWidthValue = $('logoBorderWidthValue');
    const logoBorderOpacity = $('logoBorderOpacity');
    const logoBorderOpacityValue = $('logoBorderOpacityValue');

    // QR appearance
    const qrPattern = $('qrPattern');
    const qrCorner = $('qrCorner');

    // Content type
    const qrContentType = $('qrContentType');
    const qrDynamicFields = $('qrDynamicFields');

    // Gradient
    const qrGradientEnabled = $('qrGradientEnabled');
    const qrGradientControls = $('qrGradientControls');
    const qrGradientType = $('qrGradientType');
    const qrGradientStart = $('qrGradientStart');
    const qrGradientStartHex = $('qrGradientStartHex');
    const qrGradientEnd = $('qrGradientEnd');
    const qrGradientEndHex = $('qrGradientEndHex');
    const qrGradientRotation = $('qrGradientRotation');

    // Outer border
    const qrBorderEnabled = $('qrBorderEnabled');
    const qrBorderControls = $('qrBorderControls');
    const qrBorderColor = $('qrBorderColor');
    const qrBorderHex = $('qrBorderHex');
    const qrBorderWidth = $('qrBorderWidth');
    const qrBorderWidthValue = $('qrBorderWidthValue');
    const qrBorderPadding = $('qrBorderPadding');
    const qrBorderPaddingValue = $('qrBorderPaddingValue');
    const qrBorderRadius = $('qrBorderRadius');
    const qrBorderRadiusValue = $('qrBorderRadiusValue');
    const qrBorderStyle = $('qrBorderStyle');

    // Creative frame
    const qrFrameEnabled = $('qrFrameEnabled');
    const qrFrameControls = $('qrFrameControls');
    const qrFrameStyle = $('qrFrameStyle');
    const qrFrameText = $('qrFrameText');
    const qrFrameTextColor = $('qrFrameTextColor');
    const qrFrameTextHex = $('qrFrameTextHex');
    const qrFrameBgColor = $('qrFrameBgColor');
    const qrFrameBgHex = $('qrFrameBgHex');

    // Export format preference
    const qrExportFormat = $('qrExportFormat');

    let qrInstance = null;
    let uploadedLogo = null;
    let logoReady = false;
    let isSaving = false;
    let generatedContent = '';
    let generatedSvg = null;
    let generatedDesign = null;

    // ==========================================
    // 2. GENERAL HELPERS
    // ==========================================

    const validHex = value =>
        typeof value === 'string' &&
        /^#[0-9a-f]{6}$/i.test(value.trim());

    function escapeXml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function escapeWifi(value) {
        return String(value ?? '').replace(/([\\;,":])/g, '\\$1');
    }

    function escapeVCard(value) {
        return String(value ?? '')
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/,/g, '\\,')
            .replace(/;/g, '\\;');
    }

    function escapeICalendar(value) {
        return String(value ?? '')
            .replace(/\\/g, '\\\\')
            .replace(/\r?\n/g, '\\n')
            .replace(/,/g, '\\,')
            .replace(/;/g, '\\;');
    }

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
        if (!input || !hex) return;

        hex.value = input.value.toUpperCase();
    }

    function bindColor(input, hex, onChange = clearGeneratedQr) {
        if (!input || !hex) return;

        input.addEventListener('input', () => {
            syncColor(input, hex);
            onChange();
        });

        hex.addEventListener('input', () => {
            const value = hex.value.trim();

            if (validHex(value)) {
                input.value = value;
                onChange();
            }
        });

        hex.addEventListener('blur', () => {
            const value = hex.value.trim();

            if (validHex(value)) {
                input.value = value;
                hex.value = value.toUpperCase();
            } else {
                syncColor(input, hex);
            }
        });

        syncColor(input, hex);
    }

    function showSaveMessage(message, type = 'info') {
        if (!saveQrMessage) return;

        saveQrMessage.textContent = message;

        saveQrMessage.style.color =
            type === 'success' ? '#16a34a' :
            type === 'error' ? '#ef4444' :
            'var(--blue)';
    }

    function setVisibility(toggle, container) {
        if (!toggle || !container) return;

        container.hidden = !toggle.checked;
    }

    function updateRangeValue(input, output, suffix = '') {
        if (!input || !output) return;

        output.textContent = input.value + suffix;
    }

    function getSelectedStyles() {
        return {
            content_type: qrContentType?.value || 'url',

            qr_pattern: qrPattern?.value || 'square',
            qr_corner: qrCorner?.value || 'square',

            gradient_enabled: Boolean(qrGradientEnabled?.checked),
            gradient_type: qrGradientType?.value || 'linear',
            gradient_start: qrGradientStart?.value?.toUpperCase() || null,
            gradient_end: qrGradientEnd?.value?.toUpperCase() || null,
            gradient_rotation: Number(qrGradientRotation?.value || 0),

            outer_border_enabled: Boolean(qrBorderEnabled?.checked),
            outer_border_color: qrBorderColor?.value?.toUpperCase() || null,
            outer_border_width: Number(qrBorderWidth?.value || 0),
            outer_border_padding: Number(qrBorderPadding?.value || 0),
            outer_border_radius: Number(qrBorderRadius?.value || 0),
            outer_border_style: qrBorderStyle?.value || 'solid',

            frame_enabled: Boolean(qrFrameEnabled?.checked),
            frame_style: qrFrameStyle?.value || 'simple',
            frame_text: qrFrameText?.value || '',

            logo_shape: uploadedLogo && logoReady
                ? logoShape.value
                : null,

            logo_size: uploadedLogo && logoReady
                ? Number(logoSize.value)
                : null,

            logo_background_color: uploadedLogo && logoReady
                ? logoBgColor.value.toUpperCase()
                : null,

            logo_border_enabled: Boolean(
                uploadedLogo &&
                logoReady &&
                logoBorderEnabled?.checked
            ),

            logo_border_color: logoBorderColor?.value?.toUpperCase() || null,
            logo_border_width: Number(logoBorderWidth?.value || 0),
            logo_border_opacity: Number(logoBorderOpacity?.value || 100)
        };
    }

    function downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = fileName;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    function dataUrlToBase64(dataUrl) {
        const comma = dataUrl.indexOf(',');

        if (comma === -1) {
            throw new Error('Invalid image data.');
        }

        return dataUrl.slice(comma + 1);
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(
                new Error('Unable to read the generated image.')
            );

            reader.readAsDataURL(blob);
        });
    }

    function base64EncodeUnicode(value) {
        const bytes = new TextEncoder().encode(value);
        let binary = '';

        bytes.forEach(byte => {
            binary += String.fromCharCode(byte);
        });

        return btoa(binary);
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

            if (!user) {
                return {
                    success: false,
                    skipped: true
                };
            }

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

            const { error } = await db
                .from('activity_history')
                .insert([{
                    user_id: user.id,
                    tool_name: 'QR Code Generator',
                    action,
                    file_name: fileName,
                    status: 'Completed',
                    details
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
    // 4. DYNAMIC QR CONTENT FIELDS
    // ==========================================

    const contentFieldDefinitions = {
        wifi: [
            { id: 'wifiSsid', label: 'Network name (SSID)', placeholder: 'Enter Wi-Fi name' },
            { id: 'wifiPassword', label: 'Password', placeholder: 'Enter Wi-Fi password', type: 'password' },
            {
                id: 'wifiSecurity',
                label: 'Security type',
                type: 'select',
                options: [
                    ['WPA', 'WPA / WPA2'],
                    ['WEP', 'WEP'],
                    ['nopass', 'No password']
                ]
            },
            { id: 'wifiHidden', label: 'Hidden network', type: 'checkbox' }
        ],

        vcard: [
            { id: 'vcardFirst', label: 'First name', placeholder: 'First name' },
            { id: 'vcardLast', label: 'Last name', placeholder: 'Last name' },
            { id: 'vcardOrg', label: 'Organisation', placeholder: 'Company or organisation' },
            { id: 'vcardPhone', label: 'Phone number', placeholder: '+234...' },
            { id: 'vcardEmail', label: 'Email address', placeholder: 'name@example.com' },
            { id: 'vcardWebsite', label: 'Website', placeholder: 'https://example.com' }
        ],

        email: [
            { id: 'emailAddress', label: 'Email address', placeholder: 'name@example.com' },
            { id: 'emailSubject', label: 'Subject', placeholder: 'Email subject' },
            { id: 'emailBody', label: 'Message', placeholder: 'Write your message', type: 'textarea' }
        ],

        whatsapp: [
            { id: 'whatsappPhone', label: 'WhatsApp number', placeholder: '2348012345678' },
            { id: 'whatsappMessage', label: 'Pre-filled message', placeholder: 'Hello!' }
        ],

        sms: [
            { id: 'smsPhone', label: 'Phone number', placeholder: '+234...' },
            { id: 'smsMessage', label: 'Message', placeholder: 'Your message', type: 'textarea' }
        ],

        phone: [
            { id: 'phoneNumber', label: 'Phone number', placeholder: '+234...' }
        ],

        location: [
            { id: 'locationLatitude', label: 'Latitude', placeholder: '6.5244' },
            { id: 'locationLongitude', label: 'Longitude', placeholder: '3.3792' }
        ],

        event: [
            { id: 'eventTitle', label: 'Event title', placeholder: 'Event name' },
            { id: 'eventLocation', label: 'Location', placeholder: 'Event venue' },
            { id: 'eventStart', label: 'Start date and time', type: 'datetime-local' },
            { id: 'eventEnd', label: 'End date and time', type: 'datetime-local' },
            { id: 'eventDescription', label: 'Description', placeholder: 'Event details', type: 'textarea' }
        ],

        instagram: [
            { id: 'instagramProfile', label: 'Instagram username or profile URL', placeholder: '@username or https://instagram.com/username' }
        ],

        facebook: [
            { id: 'facebookProfile', label: 'Facebook profile or page URL', placeholder: 'https://facebook.com/yourpage' }
        ],

        linkedin: [
            { id: 'linkedinProfile', label: 'LinkedIn profile URL', placeholder: 'https://linkedin.com/in/username' }
        ],

        youtube: [
            { id: 'youtubeProfile', label: 'YouTube channel or video URL', placeholder: 'https://youtube.com/@channel' }
        ],

        x: [
            { id: 'xProfile', label: 'X username or profile URL', placeholder: '@username or https://x.com/username' }
        ],

        paypal: [
            { id: 'paypalLink', label: 'PayPal payment or profile URL', placeholder: 'https://paypal.me/username' }
        ],

        app: [
            { id: 'appLink', label: 'App download URL', placeholder: 'https://example.com/app' }
        ]
    };

    function createField(definition) {
        const wrapper = document.createElement('div');
        wrapper.className = 'qr-dynamic-field';

        const label = document.createElement('label');
        label.htmlFor = definition.id;
        label.textContent = definition.label;

        let input;

        if (definition.type === 'textarea') {
            input = document.createElement('textarea');
            input.rows = 3;
        } else if (definition.type === 'select') {
            input = document.createElement('select');

            definition.options.forEach(([value, labelText]) => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = labelText;
                input.appendChild(option);
            });
        } else if (definition.type === 'checkbox') {
            const checkboxWrapper = document.createElement('label');
            checkboxWrapper.className = 'qr-dynamic-checkbox';

            input = document.createElement('input');
            input.type = 'checkbox';
            input.id = definition.id;

            checkboxWrapper.append(input, document.createTextNode(' ' + definition.label));

            wrapper.appendChild(checkboxWrapper);

            return wrapper;
        } else {
            input = document.createElement('input');
            input.type = definition.type || 'text';
        }

        input.id = definition.id;
        input.name = definition.id;

        if (definition.placeholder) {
            input.placeholder = definition.placeholder;
        }

        input.addEventListener('input', clearGeneratedQr);
        input.addEventListener('change', clearGeneratedQr);

        wrapper.append(label, input);

        return wrapper;
    }

    function renderDynamicFields() {
        if (!qrDynamicFields || !qrContentType) return;

        qrDynamicFields.replaceChildren();

        const type = qrContentType.value;

        if (type === 'url' || type === 'text') {
            if (text) {
                text.placeholder = type === 'url'
                    ? 'Enter a website URL'
                    : 'Enter the text you want to encode';
            }

            return;
        }

        const definitions = contentFieldDefinitions[type] || [];

        definitions.forEach(definition => {
            qrDynamicFields.appendChild(createField(definition));
        });

        clearGeneratedQr();
    }

    function fieldValue(id) {
        return $(id)?.value.trim() || '';
    }

    function fieldChecked(id) {
        return Boolean($(id)?.checked);
    }

    function normalizePhone(value) {
        return String(value || '').replace(/[^\d+]/g, '');
    }

    function normalizeProfileUrl(value, base) {
        const input = String(value || '').trim();

        if (!input) return '';

        if (/^https?:\/\//i.test(input)) {
            return input;
        }

        return base + input.replace(/^@/, '').replace(/^\/+/, '');
    }

    function getQrContent() {
        const type = qrContentType?.value || 'url';

        if (type === 'url' || type === 'text') {
            return text.value.trim();
        }

        if (type === 'wifi') {
            const ssid = fieldValue('wifiSsid');
            const password = fieldValue('wifiPassword');
            const security = $('wifiSecurity')?.value || 'WPA';
            const hidden = fieldChecked('wifiHidden');

            if (!ssid) {
                throw new Error('Please enter the Wi-Fi network name.');
            }

            if (security !== 'nopass' && !password) {
                throw new Error('Please enter the Wi-Fi password.');
            }

            return `WIFI:T:${security};S:${escapeWifi(ssid)};P:${security === 'nopass' ? '' : escapeWifi(password)};H:${hidden ? 'true' : 'false'};;`;
        }

        if (type === 'vcard') {
            const first = fieldValue('vcardFirst');
            const last = fieldValue('vcardLast');
            const phone = fieldValue('vcardPhone');
            const email = fieldValue('vcardEmail');

            if (!first && !last && !phone && !email) {
                throw new Error('Enter at least a name, phone number or email address.');
            }

            return [
                'BEGIN:VCARD',
                'VERSION:3.0',
                `N:${escapeVCard(last)};${escapeVCard(first)};;;`,
                `FN:${escapeVCard(`${first} ${last}`.trim())}`,
                fieldValue('vcardOrg') ? `ORG:${escapeVCard(fieldValue('vcardOrg'))}` : '',
                phone ? `TEL;TYPE=CELL:${escapeVCard(phone)}` : '',
                email ? `EMAIL:${escapeVCard(email)}` : '',
                fieldValue('vcardWebsite') ? `URL:${escapeVCard(fieldValue('vcardWebsite'))}` : '',
                'END:VCARD'
            ].filter(Boolean).join('\r\n');
        }

        if (type === 'email') {
            const address = fieldValue('emailAddress');

            if (!address) {
                throw new Error('Please enter an email address.');
            }

            const params = new URLSearchParams();

            if (fieldValue('emailSubject')) {
                params.set('subject', fieldValue('emailSubject'));
            }

            if (fieldValue('emailBody')) {
                params.set('body', fieldValue('emailBody'));
            }

            const query = params.toString();

            return `mailto:${address}${query ? '?' + query : ''}`;
        }

        if (type === 'whatsapp') {
            const phone = fieldValue('whatsappPhone').replace(/\D/g, '');

            if (!phone) {
                throw new Error('Please enter a WhatsApp phone number with country code.');
            }

            const message = fieldValue('whatsappMessage');

            return `https://wa.me/${phone}${message ? '?text=' + encodeURIComponent(message) : ''}`;
        }

        if (type === 'sms') {
            const phone = normalizePhone(fieldValue('smsPhone'));

            if (!phone) {
                throw new Error('Please enter a phone number.');
            }

            const message = fieldValue('smsMessage');

            return `SMSTO:${phone}:${message}`;
        }

        if (type === 'phone') {
            const phone = normalizePhone(fieldValue('phoneNumber'));

            if (!phone) {
                throw new Error('Please enter a phone number.');
            }

            return `tel:${phone}`;
        }

        if (type === 'location') {
            const latitude = fieldValue('locationLatitude');
            const longitude = fieldValue('locationLongitude');

            if (!latitude || !longitude) {
                throw new Error('Please enter both latitude and longitude.');
            }

            const lat = Number(latitude);
            const lon = Number(longitude);

            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lon) ||
                lat < -90 || lat > 90 ||
                lon < -180 || lon > 180
            ) {
                throw new Error('Please enter valid latitude and longitude coordinates.');
            }

            return `geo:${lat},${lon}`;
        }

        if (type === 'event') {
            const title = fieldValue('eventTitle');
            const start = fieldValue('eventStart');
            const end = fieldValue('eventEnd');

            if (!title || !start || !end) {
                throw new Error('Please enter the event title, start time and end time.');
            }

            const startDate = new Date(start);
            const endDate = new Date(end);

            if (
                Number.isNaN(startDate.getTime()) ||
                Number.isNaN(endDate.getTime()) ||
                endDate <= startDate
            ) {
                throw new Error('Please enter valid event dates. The end must be after the start.');
            }

            const formatDate = date =>
                date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

            return [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//JScan//QR Event//EN',
                'BEGIN:VEVENT',
                `DTSTART:${formatDate(startDate)}`,
                `DTEND:${formatDate(endDate)}`,
                `SUMMARY:${escapeICalendar(title)}`,
                fieldValue('eventLocation')
                    ? `LOCATION:${escapeICalendar(fieldValue('eventLocation'))}`
                    : '',
                fieldValue('eventDescription')
                    ? `DESCRIPTION:${escapeICalendar(fieldValue('eventDescription'))}`
                    : '',
                'END:VEVENT',
                'END:VCALENDAR'
            ].filter(Boolean).join('\r\n');
        }

        const profileTypes = {
            instagram: ['instagramProfile', 'https://www.instagram.com/'],
            facebook: ['facebookProfile', 'https://www.facebook.com/'],
            linkedin: ['linkedinProfile', 'https://www.linkedin.com/in/'],
            youtube: ['youtubeProfile', 'https://www.youtube.com/'],
            x: ['xProfile', 'https://x.com/'],
            paypal: ['paypalLink', 'https://paypal.me/'],
            app: ['appLink', '']
        };

        if (profileTypes[type]) {
            const [id, base] = profileTypes[type];
            const value = fieldValue(id);

            if (!value) {
                throw new Error('Please enter the required link or profile.');
            }

            const url = normalizeProfileUrl(value, base);

            if (!/^https?:\/\//i.test(url)) {
                throw new Error('Please enter a valid website URL.');
            }

            return url;
        }

        return text.value.trim();
    }

    if (qrContentType) {
        qrContentType.addEventListener('change', renderDynamicFields);
        renderDynamicFields();
    }

    // ==========================================
    // 5. CREATE SHAPED LOGO WITH OPTIONAL BORDER
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

        function buildShapePath() {
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
                        const angle = Math.PI / 3 * i - Math.PI / 6;

                        const px = dimension / 2 +
                            boxSize / 2 * Math.cos(angle);

                        const py = dimension / 2 +
                            boxSize / 2 * Math.sin(angle);

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
        }

        // Fill the logo shape with its independent background colour.
        buildShapePath();

        ctx.fillStyle = logoBgColor?.value || '#FFFFFF';
        ctx.fill();

        // Clip the uploaded image to the selected shape.
        ctx.save();
        buildShapePath();
        ctx.clip();

        ctx.drawImage(
            uploadedLogo,
            drawX,
            drawY,
            drawWidth,
            drawHeight
        );

        ctx.restore();

        // Draw the optional outline along the selected shape.
        if (logoBorderEnabled?.checked) {
            const borderWidth = Number(logoBorderWidth?.value || 0);
            const opacity = Number(logoBorderOpacity?.value || 100) / 100;

            if (borderWidth > 0 && validHex(logoBorderColor?.value)) {
                ctx.save();

                buildShapePath();

                ctx.strokeStyle = logoBorderColor.value;
                ctx.lineWidth = borderWidth * 2;
                ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';

                ctx.stroke();
                ctx.restore();
            }
        }

        return canvas.toDataURL('image/png');
    }

    // ==========================================
    // 6. LOGO UPLOAD
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
    // 7. LOGO CONTROLS
    // ==========================================

    if (logoSize) {
        logoSize.addEventListener('input', function () {
            updateRangeValue(logoSize, logoSizeValue, '%');
            clearGeneratedQr();
        });
    }

    if (logoShape) {
        logoShape.addEventListener('change', clearGeneratedQr);
    }

    bindColor(logoBgColor, logoBgHex);

    if (logoBorderEnabled) {
        logoBorderEnabled.addEventListener('change', () => {
            setVisibility(logoBorderEnabled, logoBorderControls);
            clearGeneratedQr();
        });

        setVisibility(logoBorderEnabled, logoBorderControls);
    }

    bindColor(logoBorderColor, logoBorderHex);

    if (logoBorderWidth) {
        logoBorderWidth.addEventListener('input', () => {
            updateRangeValue(logoBorderWidth, logoBorderWidthValue, 'px');
            clearGeneratedQr();
        });
    }

    if (logoBorderOpacity) {
        logoBorderOpacity.addEventListener('input', () => {
            updateRangeValue(logoBorderOpacity, logoBorderOpacityValue, '%');
            clearGeneratedQr();
        });
    }

    if (removeLogo) {
        removeLogo.addEventListener('click', () => {
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
    // 8. GRADIENT CONTROLS
    // ==========================================

    if (qrGradientEnabled) {
        qrGradientEnabled.addEventListener('change', () => {
            setVisibility(qrGradientEnabled, qrGradientControls);
            clearGeneratedQr();
        });

        setVisibility(qrGradientEnabled, qrGradientControls);
    }

    bindColor(qrGradientStart, qrGradientStartHex);
    bindColor(qrGradientEnd, qrGradientEndHex);

    if (qrGradientType) {
        qrGradientType.addEventListener('change', clearGeneratedQr);
    }

    if (qrGradientRotation) {
        qrGradientRotation.addEventListener('input', clearGeneratedQr);
    }

    // ==========================================
    // 9. OUTER BORDER CONTROLS
    // ==========================================

    if (qrBorderEnabled) {
        qrBorderEnabled.addEventListener('change', () => {
            setVisibility(qrBorderEnabled, qrBorderControls);
            clearGeneratedQr();
        });

        setVisibility(qrBorderEnabled, qrBorderControls);
    }

    bindColor(qrBorderColor, qrBorderHex);

    if (qrBorderWidth) {
        qrBorderWidth.addEventListener('input', () => {
            updateRangeValue(qrBorderWidth, qrBorderWidthValue, 'px');
            clearGeneratedQr();
        });
    }

    if (qrBorderPadding) {
        qrBorderPadding.addEventListener('input', () => {
            updateRangeValue(qrBorderPadding, qrBorderPaddingValue, 'px');
            clearGeneratedQr();
        });
    }

    if (qrBorderRadius) {
        qrBorderRadius.addEventListener('input', () => {
            updateRangeValue(qrBorderRadius, qrBorderRadiusValue, 'px');
            clearGeneratedQr();
        });
    }

    if (qrBorderStyle) {
        qrBorderStyle.addEventListener('change', clearGeneratedQr);
    }

    // ==========================================
    // 10. CREATIVE FRAME CONTROLS
    // ==========================================

    if (qrFrameEnabled) {
        qrFrameEnabled.addEventListener('change', () => {
            setVisibility(qrFrameEnabled, qrFrameControls);
            clearGeneratedQr();
        });

        setVisibility(qrFrameEnabled, qrFrameControls);
    }

    if (qrFrameStyle) {
        qrFrameStyle.addEventListener('change', clearGeneratedQr);
    }

    if (qrFrameText) {
        qrFrameText.addEventListener('input', clearGeneratedQr);
    }

    bindColor(qrFrameTextColor, qrFrameTextHex);
    bindColor(qrFrameBgColor, qrFrameBgHex);

    // ==========================================
    // 11. CLEAR GENERATED QR CODE
    // ==========================================

    function clearGeneratedQr() {
        if (!holder) return;

        holder.replaceChildren();
        holder.style.display = 'none';

        if (placeholder) {
            placeholder.hidden = false;
        }

        qrInstance = null;
        generatedContent = '';
        generatedSvg = null;
        generatedDesign = null;

        if (downloadPng) downloadPng.disabled = true;
        if (downloadSvg) downloadSvg.disabled = true;

        if (saveQrCode) {
            saveQrCode.disabled = true;
        }
    }

    // ==========================================
    // 12. BUILD QR GRADIENT OPTIONS
    // ==========================================

    function getGradientOptions() {
        if (!qrGradientEnabled?.checked) {
            return {
                color: fg.value
            };
        }

        if (
            !validHex(qrGradientStart?.value) ||
            !validHex(qrGradientEnd?.value)
        ) {
            throw new Error('Please select valid gradient colours.');
        }

        return {
            gradient: {
                type: qrGradientType?.value === 'radial'
                    ? 'radial'
                    : 'linear',

                rotation: Number(qrGradientRotation?.value || 0) *
                    Math.PI / 180,

                colorStops: [
                    {
                        offset: 0,
                        color: qrGradientStart.value
                    },
                    {
                        offset: 1,
                        color: qrGradientEnd.value
                    }
                ]
            }
        };
    }

    // ==========================================
    // 13. CREATE COMPOSED SVG ARTWORK
    // ==========================================

    function createComposedSvg(qrSvgText, dimension) {
        const borderEnabled = Boolean(qrBorderEnabled?.checked);
        const frameEnabled = Boolean(qrFrameEnabled?.checked);

        const borderWidth = borderEnabled
            ? Math.max(0, Number(qrBorderWidth?.value || 0))
            : 0;

        const padding = borderEnabled
            ? Math.max(0, Number(qrBorderPadding?.value || 0))
            : 0;

        const radius = borderEnabled
            ? Math.max(0, Number(qrBorderRadius?.value || 0))
            : 0;

        const outerSpace = borderWidth + padding;

        const qrX = outerSpace;
        const qrY = outerSpace;

        const qrArea = dimension;
        const frameHeight = frameEnabled ? 76 : 0;

        const outputWidth = dimension + outerSpace * 2;
        const outputHeight = dimension + outerSpace * 2 + frameHeight;

        const borderColor = validHex(qrBorderColor?.value)
            ? qrBorderColor.value
            : '#000000';

        const frameBackground = validHex(qrFrameBgColor?.value)
            ? qrFrameBgColor.value
            : '#FFFFFF';

        const frameTextColor = validHex(qrFrameTextColor?.value)
            ? qrFrameTextColor.value
            : '#000000';

        const frameText = escapeXml(qrFrameText?.value || 'SCAN ME');

        const style = qrFrameStyle?.value || 'simple';

        let background = '';
        let border = '';
        let frame = '';

        if (borderEnabled) {
            let dashArray = '';

            if (qrBorderStyle?.value === 'dashed') {
                dashArray = `stroke-dasharray="${borderWidth * 3} ${borderWidth * 2}"`;
            } else if (qrBorderStyle?.value === 'dotted') {
                dashArray = `stroke-dasharray="${Math.max(1, borderWidth)} ${borderWidth * 2}" stroke-linecap="round"`;
            }

            background = `
                <rect
                    x="0"
                    y="0"
                    width="${outputWidth}"
                    height="${outputHeight}"
                    fill="${escapeXml(bg.value)}"
                />
            `;

            border = `
                <rect
                    x="${borderWidth / 2}"
                    y="${borderWidth / 2}"
                    width="${outputWidth - borderWidth}"
                    height="${outputHeight - borderWidth}"
                    rx="${radius}"
                    ry="${radius}"
                    fill="none"
                    stroke="${escapeXml(borderColor)}"
                    stroke-width="${borderWidth}"
                    ${dashArray}
                />
            `;
        }

        if (frameEnabled) {
            const frameY = dimension + outerSpace * 2;

            let frameRect = '';
            let frameTextElement = '';

            if (style === 'bold') {
                frameRect = `
                    <rect
                        x="${outerSpace}"
                        y="${frameY}"
                        width="${dimension}"
                        height="${frameHeight}"
                        fill="${escapeXml(frameBackground)}"
                    />
                `;

                frameTextElement = `
                    <text
                        x="${outputWidth / 2}"
                        y="${frameY + 48}"
                        text-anchor="middle"
                        font-family="Arial, sans-serif"
                        font-size="25"
                        font-weight="900"
                        letter-spacing="2"
                        fill="${escapeXml(frameTextColor)}"
                    >${frameText}</text>
                `;
            } else if (style === 'minimal') {
                frameRect = `
                    <rect
                        x="${outerSpace}"
                        y="${frameY}"
                        width="${dimension}"
                        height="${frameHeight}"
                        fill="${escapeXml(frameBackground)}"
                    />
                `;

                frameTextElement = `
                    <text
                        x="${outputWidth / 2}"
                        y="${frameY + 46}"
                        text-anchor="middle"
                        font-family="Arial, sans-serif"
                        font-size="20"
                        font-weight="500"
                        fill="${escapeXml(frameTextColor)}"
                    >${frameText}</text>
                `;
            } else if (style === 'rounded') {
                frameRect = `
                    <rect
                        x="${outerSpace}"
                        y="${frameY}"
                        width="${dimension}"
                        height="${frameHeight}"
                        rx="18"
                        ry="18"
                        fill="${escapeXml(frameBackground)}"
                    />
                `;

                frameTextElement = `
                    <text
                        x="${outputWidth / 2}"
                        y="${frameY + 47}"
                        text-anchor="middle"
                        font-family="Arial, sans-serif"
                        font-size="23"
                        font-weight="700"
                        fill="${escapeXml(frameTextColor)}"
                    >${frameText}</text>
                `;
            } else {
                frameRect = `
                    <rect
                        x="${outerSpace}"
                        y="${frameY}"
                        width="${dimension}"
                        height="${frameHeight}"
                        fill="${escapeXml(frameBackground)}"
                    />
                `;

                frameTextElement = `
                    <text
                        x="${outputWidth / 2}"
                        y="${frameY + 47}"
                        text-anchor="middle"
                        font-family="Arial, sans-serif"
                        font-size="23"
                        font-weight="700"
                        letter-spacing="1"
                        fill="${escapeXml(frameTextColor)}"
                    >${frameText}</text>
                `;
            }

            frame = frameRect + frameTextElement;
        }

        const qrData = base64EncodeUnicode(qrSvgText);

        return `
            <svg
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
                width="${outputWidth}"
                height="${outputHeight}"
                viewBox="0 0 ${outputWidth} ${outputHeight}"
            >
                ${background}

                <image
                    x="${qrX}"
                    y="${qrY}"
                    width="${qrArea}"
                    height="${qrArea}"
                    href="data:image/svg+xml;base64,${qrData}"
                    xlink:href="data:image/svg+xml;base64,${qrData}"
                />

                ${frame}
                ${border}
            </svg>
        `.trim();
    }

    // ==========================================
    // 14. CONVERT COMPOSED SVG TO PNG
    // ==========================================

    async function svgToPngBlob(svgText) {
        const svgBlob = new Blob(
            [svgText],
            { type: 'image/svg+xml;charset=utf-8' }
        );

        const svgUrl = URL.createObjectURL(svgBlob);

        try {
            const image = new Image();

            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = () => reject(
                    new Error('Unable to render the final QR artwork.')
                );

                image.src = svgUrl;
            });

            const viewBoxMatch = svgText.match(
                /viewBox="0 0 ([\d.]+) ([\d.]+)"/
            );

            const width = viewBoxMatch
                ? Number(viewBoxMatch[1])
                : Number(size.value);

            const height = viewBoxMatch
                ? Number(viewBoxMatch[2])
                : Number(size.value);

            const canvas = document.createElement('canvas');

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');

            if (!ctx) {
                throw new Error('Unable to create the PNG image.');
            }

            ctx.drawImage(image, 0, 0, width, height);

            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/png');
            });

            if (!blob) {
                throw new Error('Unable to export the PNG image.');
            }

            return blob;

        } finally {
            URL.revokeObjectURL(svgUrl);
        }
    }

    // ==========================================
    // 15. GENERATE QR CODE
    // ==========================================

    async function generateQr() {
        clearGeneratedQr();

        let content;

        try {
            content = getQrContent();
        } catch (error) {
            contrastNote.textContent = error.message;
            return false;
        }

        if (!content) {
            contrastNote.textContent =
                'Please enter the information you want to encode.';

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

        if (
            uploadedLogo &&
            logoReady &&
            !validHex(logoBgColor.value)
        ) {
            contrastNote.textContent =
                'Please choose a valid logo background colour.';

            return false;
        }

        try {
            const logoImage = uploadedLogo && logoReady
                ? createShapedLogo()
                : null;

            const gradientOptions = getGradientOptions();

            const pattern = qrPattern?.value || 'square';
            const corner = qrCorner?.value || 'square';

            const options = {
                width: dimension,
                height: dimension,
                type: 'svg',
                data: content,
                margin: 12,

                qrOptions: {
                    errorCorrectionLevel: 'H'
                },

                backgroundOptions: {
                    color: bg.value
                },

                dotsOptions: {
                    ...gradientOptions,
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

            // Obtain the SVG generated by QRCodeStyling.
            const rawSvgBlob = await qrInstance.getRawData('svg');

            if (!rawSvgBlob) {
                throw new Error('The QR code could not be rendered.');
            }

            const rawSvgText = await rawSvgBlob.text();

            // Compose the border and frame around the original QR.
            const finalSvg = createComposedSvg(
                rawSvgText,
                dimension
            );

            generatedSvg = finalSvg;
            generatedContent = content;
            generatedDesign = getSelectedStyles();

            // Display the exact composed artwork in the preview.
            const previewImage = document.createElement('img');

            previewImage.alt = 'Generated JScan QR code';
            previewImage.style.display = 'block';
            previewImage.style.width = '100%';
            previewImage.style.maxWidth = '100%';
            previewImage.style.height = 'auto';
            previewImage.style.objectFit = 'contain';

            const previewBlob = new Blob(
                [finalSvg],
                { type: 'image/svg+xml;charset=utf-8' }
            );

            previewImage.src = URL.createObjectURL(previewBlob);

            previewImage.onload = () => {
                if (previewImage.src.startsWith('blob:')) {
                    URL.revokeObjectURL(previewImage.src);
                }
            };

            holder.replaceChildren(previewImage);
            holder.style.display = 'block';

            if (placeholder) {
                placeholder.hidden = true;
            }

            // Contrast check.
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

            if (downloadPng) downloadPng.disabled = false;
            if (downloadSvg) downloadSvg.disabled = false;

            if (saveQrCode) {
                saveQrCode.disabled = isSaving;
            }

            return true;

        } catch (error) {
            console.error('QR generation error:', error);

            clearGeneratedQr();

            contrastNote.textContent =
                error.message || 'Unable to generate QR code. Please try again.';

            return false;
        }
    }

    // ==========================================
    // 16. MAIN QR COLOUR CONTROLS
    // ==========================================

    bindColor(fg, fgHex);
    bindColor(bg, bgHex);

    // ==========================================
    // 17. QR CONTENT AND SIZE EVENTS
    // ==========================================

    if (text) {
        text.addEventListener('input', clearGeneratedQr);
    }

    if (size) {
        size.addEventListener('change', clearGeneratedQr);
    }

    // ==========================================
    // 18. QR PATTERN AND CORNER EVENTS
    // ==========================================

    if (qrPattern) {
        qrPattern.addEventListener('change', clearGeneratedQr);
    }

    if (qrCorner) {
        qrCorner.addEventListener('change', clearGeneratedQr);
    }

    // ==========================================
    // 19. GENERATE BUTTON
    // ==========================================

    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
            const generated = await generateQr();

            if (!generated) return;

            await logActivity(
                'QR code generated',
                null,
                {
                    size: Number(size.value),
                    content_type: qrContentType?.value || 'url',
                    foreground_color: fg.value.toUpperCase(),
                    background_color: bg.value.toUpperCase(),
                    logo_used: Boolean(uploadedLogo && logoReady),
                    ...generatedDesign
                }
            );
        });
    }

    // ==========================================
    // 20. POPULAR COLOUR PRESETS
    // ==========================================

    const swatches = $('swatches');

    if (swatches) {
        swatches.addEventListener('click', event => {
            const button = event.target.closest('[data-color]');

            if (!button) return;

            fg.value = button.dataset.color;

            syncColor(fg, fgHex);

            swatches.querySelectorAll('button').forEach(item => {
                item.classList.toggle('selected', item === button);
            });

            clearGeneratedQr();
        });
    }

    // ==========================================
    // 21. CREATE FINAL QR IMAGE BLOB
    // ==========================================

    async function createQrImageBlob(extension) {
        if (!generatedSvg) {
            throw new Error('Please generate a QR code first.');
        }

        if (extension === 'svg') {
            return new Blob(
                [generatedSvg],
                { type: 'image/svg+xml;charset=utf-8' }
            );
        }

        if (extension === 'png') {
            return await svgToPngBlob(generatedSvg);
        }

        throw new Error('Unsupported image format.');
    }

    // ==========================================
    // 22. DOWNLOAD PNG
    // ==========================================

    if (downloadPng) {
        downloadPng.addEventListener('click', async () => {
            if (!generatedSvg) {
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
                        content_type: qrContentType?.value || 'url',
                        foreground_color: fg.value.toUpperCase(),
                        background_color: bg.value.toUpperCase(),
                        ...generatedDesign
                    }
                );

            } catch (error) {
                console.error('PNG download error:', error);
                alert(error.message || 'Unable to download the QR code.');
            }
        });
    }

    // ==========================================
    // 23. DOWNLOAD SVG
    // ==========================================

    if (downloadSvg) {
        downloadSvg.addEventListener('click', async () => {
            if (!generatedSvg) {
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
                        content_type: qrContentType?.value || 'url',
                        foreground_color: fg.value.toUpperCase(),
                        background_color: bg.value.toUpperCase(),
                        ...generatedDesign
                    }
                );

            } catch (error) {
                console.error('SVG download error:', error);
                alert(error.message || 'Unable to download the QR code.');
            }
        });
    }

    // ==========================================
    // 24. SAVE QR CODE AND IMAGE TO SUPABASE
    // ==========================================

    if (saveQrCode) {
        saveQrCode.addEventListener('click', async () => {
            if (isSaving) return;

            const content = generatedContent;

            if (!content) {
                showSaveMessage(
                    'Please generate your QR code before saving.',
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

            if (!generatedSvg) {
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
                // A. CHECK LOGIN SESSION

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

                // B. CREATE THE FINAL COMPOSED PNG

                const imageBlob = await createQrImageBlob('png');

                // C. CREATE UNIQUE IMAGE FILE NAME

                const uniqueId = window.crypto?.randomUUID
                    ? window.crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

                const fileName = `${uniqueId}.png`;
                const imagePath = `${user.id}/${fileName}`;

                // D. UPLOAD IMAGE TO SUPABASE STORAGE

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

                // E. PREPARE DATABASE INFORMATION

                const qrData = {
                    user_id: user.id,
                    title: titleInput.value.trim() || 'Untitled QR Code',
                    content,
                    foreground_color: fg.value.toUpperCase(),
                    background_color: bg.value.toUpperCase(),
                    size: Number(size.value),
                    image_path: imagePath
                };

                // F. SAVE QR DETAILS TO DATABASE

                showSaveMessage('Saving QR details...', 'info');

                const { error: saveError } =
                    await window.jscanDB
                        .from('qr_codes')
                        .insert([qrData]);

                if (saveError) throw saveError;

                qrSavedToDatabase = true;

                // G. RECORD ACTIVITY

                showSaveMessage('Recording activity...', 'info');

                const activityResult = await logActivity(
                    'QR code saved to account',
                    fileName,
                    {
                        title: qrData.title,
                        size: qrData.size,
                        content_type: qrContentType?.value || 'url',
                        foreground_color: qrData.foreground_color,
                        background_color: qrData.background_color,
                        image_path: imagePath,
                        logo_used: Boolean(uploadedLogo && logoReady),
                        ...generatedDesign
                    }
                );

                // H. SUCCESS MESSAGE

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

                // I. CLEAN UP IF DATABASE SAVE FAILED

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

                saveQrCode.disabled = !generatedSvg;
                saveQrCode.textContent = 'Save QR Code';
            }
        });
    }

    // ==========================================
    // 25. INITIALIZE
    // ==========================================

    // Initialize range labels.
    updateRangeValue(logoSize, logoSizeValue, '%');
    updateRangeValue(logoBorderWidth, logoBorderWidthValue, 'px');
    updateRangeValue(logoBorderOpacity, logoBorderOpacityValue, '%');

    updateRangeValue(qrBorderWidth, qrBorderWidthValue, 'px');
    updateRangeValue(qrBorderPadding, qrBorderPaddingValue, 'px');
    updateRangeValue(qrBorderRadius, qrBorderRadiusValue, 'px');

    // Initialize colour HEX fields.
    syncColor(fg, fgHex);
    syncColor(bg, bgHex);

    // Start with an empty QR preview.
    clearGeneratedQr();

})();
