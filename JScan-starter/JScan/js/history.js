
/* ==========================================
   JSCAN - ACTIVITY HISTORY
   QR + BARCODE + ALL TOOL FILES
   5-DAY TEMPORARY FILE RETENTION
   VIEW + DOWNLOAD + COPY + DELETE
   PAGINATION + AUTHENTICATION
========================================== */

document.addEventListener("DOMContentLoaded", async () => {
    "use strict";

    const db = window.jscanDB;

    const historyList = document.getElementById("historyList");
    const historyStatus = document.getElementById("historyStatus");
    const clearHistoryBtn = document.getElementById("clearHistoryBtn");

    const qrPreviewModal = document.getElementById("qrPreviewModal");
    const qrPreviewImage = document.getElementById("qrPreviewImage");
    const qrPreviewLoading = document.getElementById("qrPreviewLoading");
    const qrPreviewTitle = document.getElementById("qrPreviewTitle");
    const qrPreviewDownload = document.getElementById("qrPreviewDownload");
    const closeQrPreview = document.getElementById("closeQrPreview");
    const closeQrPreviewBtn = document.getElementById("closeQrPreviewBtn");

    let currentUser = null;
    let isDeleting = false;
    let isClearing = false;
    let isLoading = false;

    let currentPreviewUrl = null;
    let currentPreviewFileName = "jscan-qr-code.png";
    let previousFocusElement = null;

    let currentPageRecords = [];
    let currentScannerText = "";

    const PAGE_SIZE = 10;

    let currentPage = 1;
    let totalRecords = 0;
    let totalPages = 0;

    const TEMP_BUCKET = "jscan-temporary-files";
    const QR_BUCKET = "qr-codes";

    /* ==========================================
       CHECK REQUIRED ELEMENTS
    ========================================== */

    if (!historyList || !historyStatus || !clearHistoryBtn) {
        console.error("JScan: Required history page elements are missing.");
        return;
    }

    if (
        !qrPreviewModal ||
        !qrPreviewImage ||
        !qrPreviewLoading ||
        !qrPreviewTitle ||
        !qrPreviewDownload ||
        !closeQrPreview ||
        !closeQrPreviewBtn
    ) {
        console.error("JScan: QR preview modal elements are missing.");
        return;
    }

    if (!db) {
        historyStatus.textContent =
            "Unable to connect to JScan. Please refresh the page.";
        return;
    }

    /* ==========================================
       CREATE SCANNER COPY BUTTON
    ========================================== */

    const scannerCopyButton = document.createElement("button");

    scannerCopyButton.type = "button";
    scannerCopyButton.id = "scannerHistoryCopyButton";
    scannerCopyButton.className = qrPreviewDownload.className;
    scannerCopyButton.textContent = "Copy";
    scannerCopyButton.hidden = true;

    qrPreviewDownload.insertAdjacentElement(
        "beforebegin",
        scannerCopyButton
    );

    /* ==========================================
       CREATE TEMPORARY FILE NOTICE
    ========================================== */

    const temporaryNotice = document.createElement("div");

    temporaryNotice.className = "jscan-temporary-notice";

    temporaryNotice.innerHTML = `
        <strong>Temporary File Notice</strong>
        <p>
            Files generated with the other JScan tools are automatically
            deleted after 5 days. You can view, download or delete them
            at any time before then.
        </p>
        <p>
            After 5 days, the generated file is permanently deleted,
            but its activity history remains until you delete it.
            Downloading a file does not extend its storage period.
        </p>
    `;

    historyList.parentNode.insertBefore(temporaryNotice, historyList);

    /* ==========================================
       DYNAMIC STYLES
    ========================================== */

    const style = document.createElement("style");

    style.textContent = `
        .jscan-temporary-notice {
            margin: 0 0 20px;
            padding: 16px;
            border: 1px solid var(--border-color, #ddd);
            border-left: 4px solid var(--blue, #2563eb);
            border-radius: 10px;
            background: var(--card-bg, transparent);
            color: var(--text-color, inherit);
            font-size: 13px;
            line-height: 1.6;
        }

        .jscan-temporary-notice strong {
            display: block;
            margin-bottom: 6px;
            font-size: 14px;
        }

        .jscan-temporary-notice p {
            margin: 5px 0;
            color: var(--text-secondary, #777);
        }

        .history-expired {
            color: #dc5555;
            font-weight: 600;
        }

        .history-permanent {
            color: #16a36a;
            font-weight: 600;
        }

        .history-expiry {
            display: block;
            margin-top: 5px;
            color: var(--text-secondary, #777);
            font-size: 12px;
        }

        .history-result {
            display: block;
            margin-top: 8px;
            overflow-wrap: anywhere;
            font-size: 13px;
            color: var(--text-color, #333);
        }

        .history-result a,
        .scanner-history-link {
            color: var(--history-link-color, #60a5fa);
            text-decoration: underline;
            overflow-wrap: anywhere;
        }

        .history-item-actions {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: wrap;
            align-items: center;
            justify-content: flex-start;
            gap: 7px;
        }

        .history-item-actions button:disabled {
            opacity: .5;
            cursor: not-allowed;
        }

        .history-pagination {
            width: 100%;
            margin: 24px 0 35px;
        }

        .history-pagination-info {
            text-align: center;
            color: var(--text-secondary, #777);
            font-size: 13px;
            margin-bottom: 16px;
        }

        .history-pagination-controls {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-wrap: wrap;
            gap: 8px;
        }

        .history-page-btn {
            min-width: 38px;
            height: 38px;
            padding: 0 11px;
            border: 1px solid var(--border-color, #ddd);
            border-radius: 8px;
            background: var(--card-bg, transparent);
            color: var(--text-color, inherit);
            cursor: pointer;
            font-size: 14px;
            transition: .2s ease;
        }

        .history-page-btn:hover:not(:disabled) {
            border-color: var(--blue, #2563eb);
            color: var(--blue, #2563eb);
        }

        .history-page-btn.active {
            background: var(--blue, #2563eb);
            border-color: var(--blue, #2563eb);
            color: #fff;
        }

        .history-page-btn:disabled {
            opacity: .45;
            cursor: not-allowed;
        }

        .history-page-ellipsis {
            padding: 0 3px;
            color: var(--text-secondary, #777);
        }

        #scannerHistoryPreviewText {
            width: 100%;
            max-height: 65vh;
            overflow: auto;
            padding: 20px;
            border: 1px solid var(--border-color, #ddd);
            border-radius: 10px;
            background: var(--card-bg, transparent);
            color: var(--text-color, #222);
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            line-height: 1.6;
            font-size: 14px;
        }

        #scannerHistoryCopyButton {
            margin-right: 6px;
        }

        @media (max-width: 600px) {
            .history-item-actions {
                width: 100%;
                flex-direction: row !important;
                flex-wrap: wrap;
                justify-content: flex-start;
                align-items: center;
                padding-left: 64px;
                gap: 7px;
            }
        }

        @media (max-width: 480px) {
            .history-pagination-controls {
                gap: 5px;
            }

            .history-page-btn {
                min-width: 34px;
                height: 36px;
                padding: 0 8px;
                font-size: 13px;
            }
        }
    `;

    document.head.appendChild(style);

    /* ==========================================
       PAGINATION CONTAINER
    ========================================== */

    const paginationContainer = document.createElement("div");

    paginationContainer.id = "historyPagination";
    paginationContainer.className = "history-pagination";

    historyList.insertAdjacentElement("afterend", paginationContainer);

    /* ==========================================
       HELPERS
    ========================================== */

    function showMessage(message) {
        historyStatus.textContent = message;
    }

    function formatDate(date) {
        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return "Date unavailable";
        }

        return parsedDate.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
        });
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }

    function getDetails(record) {
        let details = record.details;

        if (typeof details === "string") {
            try {
                details = JSON.parse(details);
            } catch (error) {
                console.error("Unable to parse activity details:", error);
                return {};
            }
        }

        return details && typeof details === "object"
            ? details
            : {};
    }

    function getToolName(record) {
        return String(record.tool_name || "").toLowerCase();
    }

    function getScannerResult(record) {
        const details = getDetails(record);

        return String(
            details.scanned_text ||
            details.scan_result ||
            details.result ||
            details.value ||
            ""
        );
    }

    function getSafeHttpUrl(value) {
        try {
            const url = new URL(String(value).trim());

            if (
                url.protocol === "http:" ||
                url.protocol === "https:"
            ) {
                return url.href;
            }

        } catch (error) {
            return null;
        }

        return null;
    }

    function createScannerResultHTML(value) {
        const url = getSafeHttpUrl(value);

        if (url) {
            return `
                <a
                    class="scanner-history-link"
                    href="${escapeHTML(url)}"
                    target="_blank"
                    rel="noopener noreferrer">
                    ${escapeHTML(value)}
                </a>
            `;
        }

        return escapeHTML(value);
    }

    /* ==========================================
       PERMANENT TOOL CLASSIFICATION
    ========================================== */

    function isPermanentRecord(record) {
        const name = getToolName(record);

        return (
            record.is_permanent === true ||
            name.includes("qr") ||
            name.includes("barcode") ||
            name.includes("scanner")
        );
    }

    /* ==========================================
       TEMPORARY FILE VALIDATION
    ========================================== */

    function getTemporaryFile(record) {
        if (isPermanentRecord(record)) {
            return null;
        }

        if (record.storage_bucket !== TEMP_BUCKET) {
            return null;
        }

        const path = record.storage_path;

        if (
            typeof path !== "string" ||
            !path.trim() ||
            path.startsWith("/") ||
            path.includes("..") ||
            !path.startsWith(`${currentUser.id}/`)
        ) {
            return null;
        }

        return {
            bucket: TEMP_BUCKET,
            path
        };
    }

    function isExpired(record) {
        if (isPermanentRecord(record)) {
            return false;
        }

        if (String(record.status || "").toLowerCase() === "expired") {
            return true;
        }

        if (!record.expires_at) {
            return false;
        }

        const expiry = new Date(record.expires_at).getTime();

        return !Number.isNaN(expiry) && expiry <= Date.now();
    }

    /* ==========================================
       DISPLAY NAME
    ========================================== */

    function getDisplayName(record) {
        const name = getToolName(record);
        const details = getDetails(record);

        if (name.includes("qr")) {
            return details.title || record.file_name || "";
        }

        return record.file_name || "";
    }

    /* ==========================================
       TOOL ICON
    ========================================== */

    function getToolIcon(tool) {
        const name = String(tool ?? "").toLowerCase();

        if (name.includes("qr")) return "▦";
        if (name.includes("barcode")) return "▥";
        if (name.includes("scanner")) return "⌕";
        if (name.includes("compress")) return "⇣";
        if (name.includes("merge")) return "⊕";
        if (name.includes("split")) return "✂";
        if (name.includes("image")) return "▧";
        if (name.includes("word")) return "W";
        if (name.includes("ocr")) return "T";

        return "▤";
    }

    /* ==========================================
       QR IMAGE PATH
    ========================================== */

    function getQrImagePath(record) {
        if (!getToolName(record).includes("qr")) {
            return null;
        }

        const details = getDetails(record);
        const imagePath = details.image_path;

        if (
            typeof imagePath !== "string" ||
            !imagePath.trim() ||
            imagePath.startsWith("/") ||
            imagePath.includes("..") ||
            !imagePath.startsWith(`${currentUser.id}/`)
        ) {
            return null;
        }

        return imagePath;
    }

    /* ==========================================
       BARCODE DETAILS
    ========================================== */

    function isValidHex(value) {
        return (
            typeof value === "string" &&
            /^#[0-9A-Fa-f]{6}$/.test(value)
        );
    }

    function getBarcodeDetails(record) {
        if (!getToolName(record).includes("barcode")) {
            return null;
        }

        const details = getDetails(record);

        const value = details.barcode_value;
        const format = details.format;

        if (
            typeof value !== "string" ||
            !value.trim() ||
            typeof format !== "string"
        ) {
            return null;
        }

        const supportedFormats = [
            "EAN13",
            "UPC",
            "CODE39",
            "CODE128"
        ];

        if (!supportedFormats.includes(format.toUpperCase())) {
            return null;
        }

        return {
            value,
            format: format.toUpperCase(),
            foreground: isValidHex(details.foreground_color)
                ? details.foreground_color
                : "#000000",
            background: isValidHex(details.background_color)
                ? details.background_color
                : "#FFFFFF"
        };
    }

    function getBarcodeFileName(record) {
        const details = getDetails(record);
        const format = details.format || "barcode";

        return `jscan-${String(format).toLowerCase()}-barcode.png`;
    }

    /* ==========================================
       LOAD JSBARCODE LIBRARY
    ========================================== */

    let barcodeLibraryPromise = null;

    function loadBarcodeLibrary() {
        if (typeof window.JsBarcode === "function") {
            return Promise.resolve();
        }

        if (barcodeLibraryPromise) {
            return barcodeLibraryPromise;
        }

        barcodeLibraryPromise = new Promise((resolve, reject) => {
            const script = document.createElement("script");

            script.src =
                "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js";

            script.async = true;

            script.onload = () => {
                if (typeof window.JsBarcode === "function") {
                    resolve();
                } else {
                    reject(new Error("Barcode library did not initialize."));
                }
            };

            script.onerror = () => {
                reject(new Error("Unable to load barcode library."));
            };

            document.head.appendChild(script);
        }).catch(error => {
            barcodeLibraryPromise = null;
            throw error;
        });

        return barcodeLibraryPromise;
    }

    /* ==========================================
       CREATE BARCODE PNG
    ========================================== */

    async function createBarcodePngBlob(record) {
        const details = getBarcodeDetails(record);

        if (!details) {
            throw new Error(
                "This barcode does not contain enough information to recreate it."
            );
        }

        await loadBarcodeLibrary();

        const svg = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
        );

        window.JsBarcode(svg, details.value, {
            format: details.format,
            lineColor: details.foreground,
            background: details.background,
            width: 2,
            height: 100,
            displayValue: true,
            fontSize: 16,
            fontOptions: "bold",
            textMargin: 8,
            margin: 15
        });

        const svgData = new XMLSerializer().serializeToString(svg);

        const svgBlob = new Blob(
            [svgData],
            { type: "image/svg+xml;charset=utf-8" }
        );

        const svgUrl = URL.createObjectURL(svgBlob);

        try {
            const image = new Image();

            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = () => reject(
                    new Error("Unable to prepare barcode preview.")
                );

                image.src = svgUrl;
            });

            const canvas = document.createElement("canvas");
            const scale = 3;

            canvas.width = image.width * scale;
            canvas.height = image.height * scale;

            const context = canvas.getContext("2d");

            if (!context) {
                throw new Error("Unable to create barcode image.");
            }

            context.fillStyle = details.background;
            context.fillRect(0, 0, canvas.width, canvas.height);

            context.scale(scale, scale);
            context.drawImage(image, 0, 0);

            const pngBlob = await new Promise(resolve => {
                canvas.toBlob(resolve, "image/png");
            });

            if (!pngBlob) {
                throw new Error("Unable to create PNG barcode.");
            }

            return pngBlob;

        } finally {
            URL.revokeObjectURL(svgUrl);
        }
    }

    /* ==========================================
       SIGNED URL HELPERS
    ========================================== */

    async function getSignedUrl(bucket, path) {
        const { data, error } = await db
            .storage
            .from(bucket)
            .createSignedUrl(path, 300);

        if (error) {
            throw error;
        }

        if (!data?.signedUrl) {
            throw new Error("Unable to retrieve the file.");
        }

        return data.signedUrl;
    }

    async function getQrSignedUrl(imagePath) {
        return getSignedUrl(QR_BUCKET, imagePath);
    }

    /* ==========================================
       DOWNLOAD HELPERS
    ========================================== */

    async function downloadFromUrl(url, fileName) {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Unable to download the file.");
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = objectUrl;
        link.download = fileName || "jscan-file";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    }

    function downloadBlob(blob, fileName) {
        const objectUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = objectUrl;
        link.download = fileName || "jscan-file";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    }

    /* ==========================================
       SCANNER TEXT PREVIEW ELEMENT
    ========================================== */

    let scannerResultDisplay = document.getElementById(
        "scannerHistoryPreviewText"
    );

    if (!scannerResultDisplay) {
        scannerResultDisplay = document.createElement("div");
        scannerResultDisplay.id = "scannerHistoryPreviewText";
        scannerResultDisplay.hidden = true;

        qrPreviewImage.insertAdjacentElement(
            "afterend",
            scannerResultDisplay
        );
    }

    /* ==========================================
       PREVIEW MODAL
    ========================================== */

    function closePreview() {
        qrPreviewModal.classList.remove("active");
        qrPreviewModal.setAttribute("aria-hidden", "true");

        qrPreviewImage.src = "";
        qrPreviewImage.hidden = true;

        qrPreviewLoading.hidden = false;
        qrPreviewLoading.textContent = "Loading preview...";

        scannerResultDisplay.hidden = true;
        scannerResultDisplay.textContent = "";

        scannerCopyButton.hidden = true;
        scannerCopyButton.disabled = false;
        scannerCopyButton.textContent = "Copy";

        qrPreviewDownload.hidden = false;
        qrPreviewDownload.disabled = true;
        qrPreviewDownload.textContent = "Download";

        currentScannerText = "";

        if (currentPreviewUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(currentPreviewUrl);
        }

        currentPreviewUrl = null;
        currentPreviewFileName = "jscan-qr-code.png";

        document.body.style.overflow = "";

        if (previousFocusElement) {
            previousFocusElement.focus();
            previousFocusElement = null;
        }
    }

    function openPreviewModal(button, title, fileName) {
        previousFocusElement = button || null;

        qrPreviewModal.classList.add("active");
        qrPreviewModal.setAttribute("aria-hidden", "false");

        qrPreviewImage.src = "";
        qrPreviewImage.hidden = true;

        qrPreviewLoading.hidden = false;
        qrPreviewLoading.textContent = "Loading preview...";

        scannerResultDisplay.hidden = true;
        scannerResultDisplay.textContent = "";

        scannerCopyButton.hidden = true;
        scannerCopyButton.disabled = false;
        scannerCopyButton.textContent = "Copy";

        qrPreviewDownload.hidden = false;
        qrPreviewTitle.textContent = title;

        currentPreviewUrl = null;
        currentPreviewFileName = fileName;

        qrPreviewDownload.disabled = true;
        qrPreviewDownload.textContent = "Download";

        currentScannerText = "";

        document.body.style.overflow = "hidden";
    }

    function showPreviewImage(url) {
        currentPreviewUrl = url;

        qrPreviewImage.onload = () => {
            qrPreviewImage.hidden = false;
            qrPreviewLoading.hidden = true;
            qrPreviewDownload.disabled = false;
        };

        qrPreviewImage.onerror = () => {
            qrPreviewImage.hidden = true;
            qrPreviewLoading.hidden = false;
            qrPreviewLoading.textContent =
                "Unable to display this file preview.";

            qrPreviewDownload.disabled = true;
        };

        qrPreviewImage.src = url;
    }

    /* ==========================================
       VIEW QR CODE
    ========================================== */

    async function viewQrCode(imagePath, button, fileName) {
        if (button.disabled) return;

        openPreviewModal(
            button,
            "QR Code Preview",
            fileName || "jscan-qr-code.png"
        );

        button.disabled = true;
        button.textContent = "Opening...";

        try {
            const signedUrl = await getQrSignedUrl(imagePath);
            showPreviewImage(signedUrl);

        } catch (error) {
            console.error("QR viewing error:", error);

            qrPreviewLoading.textContent =
                "Unable to load this QR code. Please try again.";

        } finally {
            button.disabled = false;
            button.textContent = "View";
        }
    }

    /* ==========================================
       VIEW BARCODE
    ========================================== */

    async function viewBarcode(record, button) {
        if (button.disabled) return;

        openPreviewModal(
            button,
            "Barcode Preview",
            getBarcodeFileName(record)
        );

        button.disabled = true;
        button.textContent = "Opening...";

        try {
            const blob = await createBarcodePngBlob(record);
            showPreviewImage(URL.createObjectURL(blob));

        } catch (error) {
            console.error("Barcode viewing error:", error);

            qrPreviewLoading.textContent =
                "Unable to recreate this barcode. Please try again.";

        } finally {
            button.disabled = false;
            button.textContent = "View";
        }
    }

    /* ==========================================
       VIEW TEMPORARY FILE
    ========================================== */

    async function viewTemporaryFile(record, button) {
        if (button.disabled || isExpired(record)) return;

        const file = getTemporaryFile(record);

        if (!file) {
            alert("This file is not available to preview.");
            return;
        }

        button.disabled = true;
        button.textContent = "Opening...";

        try {
            const signedUrl = await getSignedUrl(
                file.bucket,
                file.path
            );

            const link = document.createElement("a");

            link.href = signedUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";

            document.body.appendChild(link);
            link.click();
            link.remove();

        } catch (error) {
            console.error("File viewing error:", error);
            alert("Unable to open this file. Please try again.");

        } finally {
            button.disabled = false;
            button.textContent = "View";
        }
    }

    /* ==========================================
       VIEW SCANNER RESULT
    ========================================== */

    function viewScannerResult(record, button) {
        const scannedText = getScannerResult(record);

        if (!scannedText) {
            alert("No scanned result is available for this record.");
            return;
        }

        openPreviewModal(
            button || null,
            "Scanned Result",
            "jscan-scanned-result.txt"
        );

        currentScannerText = scannedText;

        qrPreviewImage.hidden = true;
        qrPreviewLoading.hidden = true;
        scannerResultDisplay.hidden = false;

        scannerResultDisplay.innerHTML =
            createScannerResultHTML(scannedText);

        // Scanner results have Copy and Close only.
        qrPreviewDownload.hidden = true;

        scannerCopyButton.hidden = false;
        scannerCopyButton.disabled = false;
        scannerCopyButton.textContent = "Copy";
    }

    /* ==========================================
       COPY SCANNER RESULT
    ========================================== */

    async function copyScannerResult() {
        if (!currentScannerText) {
            alert("No scanned result is available.");
            return;
        }

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(currentScannerText);

            } else {
                const textarea = document.createElement("textarea");

                textarea.value = currentScannerText;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";

                document.body.appendChild(textarea);

                textarea.select();

                const copied = document.execCommand("copy");

                textarea.remove();

                if (!copied) {
                    throw new Error("Copy command failed.");
                }
            }

            scannerCopyButton.textContent = "Copied!";
            scannerCopyButton.disabled = true;

            setTimeout(() => {
                if (!scannerCopyButton.hidden) {
                    scannerCopyButton.textContent = "Copy";
                    scannerCopyButton.disabled = false;
                }
            }, 1500);

        } catch (error) {
            console.error("Scanner copy error:", error);

            alert("Unable to copy the result. Please try again.");
        }
    }

    scannerCopyButton.addEventListener("click", copyScannerResult);

    /* ==========================================
       DOWNLOAD QR CODE
    ========================================== */

    async function downloadQrCode(imagePath, button, fileName) {
        if (button.disabled) return;

        button.disabled = true;
        button.textContent = "Downloading...";

        try {
            const signedUrl = await getQrSignedUrl(imagePath);

            await downloadFromUrl(
                signedUrl,
                fileName || "jscan-qr-code.png"
            );

        } catch (error) {
            console.error("QR download error:", error);
            alert("Unable to download this QR code. Please try again.");

        } finally {
            button.disabled = false;
            button.textContent = "Download";
        }
    }

    /* ==========================================
       DOWNLOAD BARCODE
    ========================================== */

    async function downloadBarcode(record, button) {
        if (button.disabled) return;

        button.disabled = true;
        button.textContent = "Downloading...";

        try {
            const blob = await createBarcodePngBlob(record);

            downloadBlob(blob, getBarcodeFileName(record));

        } catch (error) {
            console.error("Barcode download error:", error);

            alert(
                "Unable to recreate or download this barcode. Please try again."
            );

        } finally {
            button.disabled = false;
            button.textContent = "Download";
        }
    }

    /* ==========================================
       DOWNLOAD TEMPORARY FILE
    ========================================== */

    async function downloadTemporaryFile(record, button) {
        if (button.disabled || isExpired(record)) return;

        const file = getTemporaryFile(record);

        if (!file) {
            alert("This file is no longer available.");
            return;
        }

        button.disabled = true;
        button.textContent = "Downloading...";

        try {
            const signedUrl = await getSignedUrl(
                file.bucket,
                file.path
            );

            const fileName =
                record.file_name ||
                file.path.split("/").pop() ||
                "jscan-file";

            await downloadFromUrl(signedUrl, fileName);

        } catch (error) {
            console.error("Temporary file download error:", error);

            alert("Unable to download this file. Please try again.");

        } finally {
            button.disabled = false;
            button.textContent = "Download";
        }
    }

    /* ==========================================
       PREVIEW DOWNLOAD BUTTON
    ========================================== */

    qrPreviewDownload.addEventListener("click", async () => {
        if (!currentPreviewUrl || qrPreviewDownload.disabled) return;

        qrPreviewDownload.disabled = true;
        qrPreviewDownload.textContent = "Downloading...";

        try {
            await downloadFromUrl(
                currentPreviewUrl,
                currentPreviewFileName
            );

        } catch (error) {
            console.error("Preview download error:", error);

            alert("Unable to download this image. Please try again.");

        } finally {
            qrPreviewDownload.disabled = false;
            qrPreviewDownload.textContent = "Download";
        }
    });

    closeQrPreview.addEventListener("click", closePreview);
    closeQrPreviewBtn.addEventListener("click", closePreview);

    qrPreviewModal.addEventListener("click", event => {
        if (event.target === qrPreviewModal) {
            closePreview();
        }
    });

    document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" &&
            qrPreviewModal.classList.contains("active")
        ) {
            closePreview();
        }
    });

    /* ==========================================
       DELETE ASSOCIATED STORAGE FILE
    ========================================== */

    async function deleteStorageForRecord(record) {
        const name = getToolName(record);

        let bucket = null;
        let path = null;

        const temporaryFile = getTemporaryFile(record);

        if (temporaryFile) {
            bucket = temporaryFile.bucket;
            path = temporaryFile.path;
        }

        if (name.includes("qr")) {
            const qrPath = getQrImagePath(record);

            if (qrPath) {
                bucket = QR_BUCKET;
                path = qrPath;
            }
        }

        // Scanner results and barcode records do not
        // have separate stored files to delete.

        if (!bucket || !path) {
            return true;
        }

        const { error } = await db.storage
            .from(bucket)
            .remove([path]);

        if (error) {
            console.error("Storage deletion error:", error);

            throw new Error(
                "The associated file could not be deleted. Your History record has been kept."
            );
        }

        return true;
    }

    /* ==========================================
       DELETE SINGLE HISTORY RECORD
    ========================================== */

    async function deleteHistory(id) {
        if (isDeleting) return false;

        const record = currentPageRecords.find(
            item => String(item.id) === String(id)
        );

        if (!record) {
            alert("This activity could not be found. Please refresh.");
            return false;
        }

        isDeleting = true;

        try {
            await deleteStorageForRecord(record);

            const { data, error } = await db
                .from("activity_history")
                .delete()
                .eq("id", id)
                .eq("user_id", currentUser.id)
                .select("id");

            if (error) {
                console.error("History deletion error:", error);

                alert(
                    "The file was handled, but the History record could not be deleted. Please try again."
                );

                return false;
            }

            if (!data || data.length === 0) {
                alert(
                    "The activity was not deleted. Please check your database permissions."
                );

                return false;
            }

            await loadHistory();

            return true;

        } catch (error) {
            console.error("Activity deletion error:", error);

            alert(
                error.message ||
                "Unable to delete this activity. Please try again."
            );

            return false;

        } finally {
            isDeleting = false;
        }
    }

    /* ==========================================
       PAGINATION
    ========================================== */

    function getPageNumbers() {
        const pages = new Set();

        pages.add(1);
        pages.add(totalPages);

        for (
            let page = Math.max(1, currentPage - 2);
            page <= Math.min(totalPages, currentPage + 2);
            page++
        ) {
            pages.add(page);
        }

        return [...pages].sort((a, b) => a - b);
    }

    function renderPagination() {
        if (totalRecords === 0) {
            paginationContainer.innerHTML = "";
            paginationContainer.hidden = true;
            return;
        }

        paginationContainer.hidden = false;

        const firstRecord = ((currentPage - 1) * PAGE_SIZE) + 1;

        const lastRecord = Math.min(
            currentPage * PAGE_SIZE,
            totalRecords
        );

        let controlsHTML = "";

        if (totalPages > 1) {
            controlsHTML += `
                <button
                    type="button"
                    class="history-page-btn"
                    data-page="${currentPage - 1}"
                    ${currentPage === 1 ? "disabled" : ""}>
                    Previous
                </button>
            `;

            const pages = getPageNumbers();
            let previousPage = 0;

            pages.forEach(page => {
                if (previousPage && page - previousPage > 1) {
                    controlsHTML += `
                        <span class="history-page-ellipsis">...</span>
                    `;
                }

                controlsHTML += `
                    <button
                        type="button"
                        class="history-page-btn ${page === currentPage ? "active" : ""}"
                        data-page="${page}"
                        ${page === currentPage ? 'aria-current="page"' : ""}>
                        ${page}
                    </button>
                `;

                previousPage = page;
            });

            controlsHTML += `
                <button
                    type="button"
                    class="history-page-btn"
                    data-page="${currentPage + 1}"
                    ${currentPage === totalPages ? "disabled" : ""}>
                    Next
                </button>
            `;
        }

        paginationContainer.innerHTML = `
            <div class="history-pagination-info">
                Showing ${firstRecord}–${lastRecord} of
                ${totalRecords} activities
            </div>

            <div class="history-pagination-controls">
                ${controlsHTML}
            </div>
        `;
    }

    paginationContainer.addEventListener("click", async event => {
        const button = event.target.closest("[data-page]");

        if (
            !button ||
            button.disabled ||
            isLoading ||
            isDeleting ||
            isClearing
        ) {
            return;
        }

        const requestedPage = Number(button.dataset.page);

        if (
            !Number.isInteger(requestedPage) ||
            requestedPage < 1 ||
            requestedPage > totalPages ||
            requestedPage === currentPage
        ) {
            return;
        }

        currentPage = requestedPage;
        await loadHistory();
    });

    /* ==========================================
       RENDER HISTORY
    ========================================== */

    function renderHistory(records) {
        currentPageRecords = records;

        if (!records.length) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <div style="font-size:42px;color:var(--blue)">✦</div>
                    <h2>No activity yet</h2>
                    <p>Your completed JScan activities will appear here.</p>
                    <a class="btn btn-primary" href="tools.html">
                        Explore tools
                    </a>
                </div>
            `;

            clearHistoryBtn.hidden = true;
            return;
        }

        clearHistoryBtn.hidden = false;

        historyList.innerHTML = records.map(record => {
            const permanent = isPermanentRecord(record);
            const expired = isExpired(record);

            const imagePath = getQrImagePath(record);
            const barcodeDetails = getBarcodeDetails(record);
            const temporaryFile = getTemporaryFile(record);

            const displayName = getDisplayName(record);

            const downloadFileName = displayName
                ? `${displayName.replace(/[\\/:*?"<>|]/g, "_")}.png`
                : "jscan-qr-code.png";

            const statusText = permanent
                ? "Permanent history"
                : expired
                    ? "Expired"
                    : (record.status || "Completed");

            const statusClass = permanent
                ? "history-permanent"
                : expired
                    ? "history-expired"
                    : "";

            const isScanner = getToolName(record).includes("scanner");

            const scannerResult = isScanner
                ? getScannerResult(record)
                : "";

            const canViewQr = Boolean(imagePath);
            const canViewBarcode = Boolean(barcodeDetails);

            const canViewTemporary =
                Boolean(temporaryFile) && !expired;

            const canViewScannerResult =
                isScanner && Boolean(scannerResult);

            return `
                <article
                    class="panel history-item"
                    data-history-id="${escapeHTML(record.id)}">

                    <div class="history-item-icon">
                        ${escapeHTML(getToolIcon(record.tool_name))}
                    </div>

                    <div class="history-item-content">
                        <h3>${escapeHTML(record.tool_name)}</h3>

                        <p>${escapeHTML(record.action)}</p>

                        ${displayName ? `
                            <p class="history-file-name">
                                ${escapeHTML(displayName)}
                            </p>
                        ` : ""}

                        ${scannerResult ? `
                            <span class="history-result">
                                ${createScannerResultHTML(scannerResult)}
                            </span>
                        ` : ""}

                        <small>
                            ${escapeHTML(formatDate(record.created_at))}
                        </small>

                        ${!permanent && record.expires_at && !expired ? `
                            <span class="history-expiry">
                                File expires: ${escapeHTML(formatDate(record.expires_at))}
                            </span>
                        ` : ""}
                    </div>

                    <div class="history-item-actions">

                        <span class="history-status ${statusClass}">
                            ${escapeHTML(statusText)}
                        </span>

                        ${canViewQr ? `
                            <button
                                type="button"
                                class="btn btn-ghost view-qr-btn"
                                data-image-path="${escapeHTML(imagePath)}"
                                data-file-name="${escapeHTML(downloadFileName)}">
                                View
                            </button>

                            <button
                                type="button"
                                class="btn btn-ghost download-qr-btn"
                                data-image-path="${escapeHTML(imagePath)}"
                                data-file-name="${escapeHTML(downloadFileName)}">
                                Download
                            </button>
                        ` : ""}

                        ${canViewBarcode ? `
                            <button
                                type="button"
                                class="btn btn-ghost view-barcode-btn"
                                data-id="${escapeHTML(record.id)}">
                                View
                            </button>

                            <button
                                type="button"
                                class="btn btn-ghost download-barcode-btn"
                                data-id="${escapeHTML(record.id)}">
                                Download
                            </button>
                        ` : ""}

                        ${canViewTemporary ? `
                            <button
                                type="button"
                                class="btn btn-ghost view-temporary-btn"
                                data-id="${escapeHTML(record.id)}">
                                View
                            </button>

                            <button
                                type="button"
                                class="btn btn-ghost download-temporary-btn"
                                data-id="${escapeHTML(record.id)}">
                                Download
                            </button>
                        ` : ""}

                        ${canViewScannerResult ? `
                            <button
                                type="button"
                                class="btn btn-ghost view-scanner-btn"
                                data-id="${escapeHTML(record.id)}">
                                View
                            </button>
                        ` : ""}

                        <button
                            type="button"
                            class="btn btn-ghost delete-history-btn"
                            data-id="${escapeHTML(record.id)}">
                            Delete
                        </button>

                    </div>
                </article>
            `;
        }).join("");
    }

    /* ==========================================
       LOAD HISTORY
    ========================================== */

    async function loadHistory() {
        if (isLoading) return false;

        isLoading = true;

        showMessage("Loading your activity history...");

        try {
            const from = (currentPage - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            const { data, error, count } = await db
                .from("activity_history")
                .select("*", { count: "exact" })
                .eq("user_id", currentUser.id)
                .order("created_at", { ascending: false })
                .range(from, to);

            if (error) {
                console.error("History loading error:", error);

                showMessage(
                    "Unable to load your history. Please try again."
                );

                return false;
            }

            totalRecords = count || 0;
            totalPages = Math.ceil(totalRecords / PAGE_SIZE);

            if (totalPages > 0 && currentPage > totalPages) {
                currentPage = totalPages;

                isLoading = false;

                return await loadHistory();
            }

            if (totalPages === 0) {
                currentPage = 1;
            }

            renderHistory(data || []);
            renderPagination();

            showMessage("");

            return true;

        } catch (error) {
            console.error("Unexpected history loading error:", error);

            showMessage(
                "Something went wrong while loading your history."
            );

            return false;

        } finally {
            isLoading = false;
        }
    }

    /* ==========================================
       HISTORY ACTION BUTTONS
    ========================================== */

    historyList.addEventListener("click", async event => {

        const viewQrButton = event.target.closest(".view-qr-btn");
        const downloadQrButton = event.target.closest(".download-qr-btn");

        const viewBarcodeButton = event.target.closest(".view-barcode-btn");
        const downloadBarcodeButton =
            event.target.closest(".download-barcode-btn");

        const viewTemporaryButton =
            event.target.closest(".view-temporary-btn");

        const downloadTemporaryButton =
            event.target.closest(".download-temporary-btn");

        const viewScannerButton =
            event.target.closest(".view-scanner-btn");

        const deleteButton =
            event.target.closest(".delete-history-btn");

        if (isDeleting || isClearing || isLoading) return;

        if (viewQrButton) {
            await viewQrCode(
                viewQrButton.dataset.imagePath,
                viewQrButton,
                viewQrButton.dataset.fileName
            );

            return;
        }

        if (downloadQrButton) {
            await downloadQrCode(
                downloadQrButton.dataset.imagePath,
                downloadQrButton,
                downloadQrButton.dataset.fileName
            );

            return;
        }

        if (viewBarcodeButton) {
            const record = currentPageRecords.find(
                item => String(item.id) === viewBarcodeButton.dataset.id
            );

            if (record) {
                await viewBarcode(record, viewBarcodeButton);
            }

            return;
        }

        if (downloadBarcodeButton) {
            const record = currentPageRecords.find(
                item => String(item.id) === downloadBarcodeButton.dataset.id
            );

            if (record) {
                await downloadBarcode(record, downloadBarcodeButton);
            }

            return;
        }

        if (viewTemporaryButton) {
            const record = currentPageRecords.find(
                item => String(item.id) === viewTemporaryButton.dataset.id
            );

            if (record) {
                await viewTemporaryFile(record, viewTemporaryButton);
            }

            return;
        }

        if (downloadTemporaryButton) {
            const record = currentPageRecords.find(
                item => String(item.id) === downloadTemporaryButton.dataset.id
            );

            if (record) {
                await downloadTemporaryFile(
                    record,
                    downloadTemporaryButton
                );
            }

            return;
        }

        if (viewScannerButton) {
            const record = currentPageRecords.find(
                item => String(item.id) === viewScannerButton.dataset.id
            );

            if (record) {
                viewScannerResult(record, viewScannerButton);
            }

            return;
        }

        if (!deleteButton) return;

        const id = deleteButton.dataset.id;

        if (!id) return;

        const record = currentPageRecords.find(
            item => String(item.id) === String(id)
        );

        const name = record?.tool_name || "this activity";

        if (!confirm(
            `Delete "${name}" from your History? Any associated stored file will also be deleted.`
        )) {
            return;
        }

        deleteButton.disabled = true;
        deleteButton.textContent = "Deleting...";

        await deleteHistory(id);
    });

    /* ==========================================
       CLEAR TEMPORARY HISTORY ONLY
    ========================================== */

    async function getAllTemporaryRecords() {
        const allRecords = [];
        const batchSize = 500;

        let offset = 0;

        while (true) {
            const { data, error } = await db
                .from("activity_history")
                .select("*")
                .eq("user_id", currentUser.id)
                .order("created_at", { ascending: false })
                .range(offset, offset + batchSize - 1);

            if (error) {
                throw error;
            }

            const batch = data || [];

            allRecords.push(...batch);

            if (batch.length < batchSize) {
                break;
            }

            offset += batchSize;
        }

        return allRecords.filter(record => !isPermanentRecord(record));
    }

    async function clearTemporaryHistory() {
        const records = await getAllTemporaryRecords();

        let deletedCount = 0;
        let failedCount = 0;

        for (const record of records) {
            try {
                await deleteStorageForRecord(record);

                const { data, error } = await db
                    .from("activity_history")
                    .delete()
                    .eq("id", record.id)
                    .eq("user_id", currentUser.id)
                    .select("id");

                if (error || !data?.length) {
                    failedCount++;

                    console.error(
                        "Could not delete temporary History record:",
                        error
                    );

                } else {
                    deletedCount++;
                }

            } catch (error) {
                failedCount++;

                console.error(
                    "Could not clear temporary activity:",
                    record.id,
                    error
                );
            }
        }

        return { deletedCount, failedCount };
    }

    clearHistoryBtn.addEventListener("click", async () => {
        if (isClearing || isDeleting || isLoading) return;

        if (!confirm(
            "Clear all temporary-tool activities from your History? QR Code Generator, Barcode Generator and QR & Barcode Scanner records will be kept. Associated temporary files will also be deleted."
        )) {
            return;
        }

        isClearing = true;

        clearHistoryBtn.disabled = true;
        clearHistoryBtn.textContent = "Clearing...";

        try {
            const result = await clearTemporaryHistory();

            currentPage = 1;

            await loadHistory();

            if (result.failedCount > 0) {
                alert(
                    `${result.deletedCount} activities deleted. ${result.failedCount} could not be deleted. Please try again for those activities.`
                );

            } else if (result.deletedCount === 0) {
                alert("There are no temporary activities to clear.");

            } else {
                alert(
                    `${result.deletedCount} temporary activities deleted successfully. Your permanent-tool History records were preserved.`
                );
            }

        } catch (error) {
            console.error("Clear history error:", error);

            alert(
                "Unable to clear temporary History. Please try again."
            );

        } finally {
            isClearing = false;

            clearHistoryBtn.disabled = false;
            clearHistoryBtn.textContent = "Clear history";
        }
    });

    /* ==========================================
       VERIFY USER SESSION
    ========================================== */

    const { data, error } = await db.auth.getSession();

    if (error || !data.session?.user) {
        window.location.replace("/login.html");
        return;
    }

    currentUser = data.session.user;

    /* ==========================================
       PROTECT PAGE AFTER LOGOUT
    ========================================== */

    const { data: authListener } = db.auth.onAuthStateChange(
        event => {
            if (event === "SIGNED_OUT") {
                window.location.replace("/login.html");
            }
        }
    );

    /* ==========================================
       INITIAL HISTORY LOAD
    ========================================== */

    await loadHistory();

    /* ==========================================
       CLEAN UP AUTH LISTENER
    ========================================== */

    window.addEventListener("pagehide", () => {
        authListener.subscription.unsubscribe();
    }, { once: true });

});
