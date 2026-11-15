
/* =========================================
   JSCAN — EXCEL TO WORD & PDF
   File: js/excel-to-word.js
========================================= */

(() => {
    "use strict";

    const API_URL = "http://localhost:8000";

    const EW = {
        files: [],
        results: [],
        currentDocument: null,
        currentFilename: "",
        currentResult: null,
        isConverting: false,
        fontUrls: [],
        savedRange: null
    };

    const $ = id => document.getElementById(id);

    const el = {
        input: $("ewInput"),
        dropArea: $("ewDropArea"),
        fileList: $("ewFileList"),
        wordBtn: $("ewConvertWordBtn"),
        pdfBtn: $("ewConvertPdfBtn"),
        clearBtn: $("ewClearBtn"),
        status: $("ewStatus"),
        results: $("ewResults"),
        resultList: $("ewResultList"),

        editor: $("ewEditor"),
        closeEditor: $("ewCloseEditor"),
        outputName: $("ewOutputName"),
        fontFamily: $("ewFontFamily"),
        fontSize: $("ewFontSize"),
        customFont: $("ewCustomFont"),
        document: $("ewDocument"),
        editorStatus: $("ewEditorStatus"),
        previewBtn: $("ewPreviewBtn"),
        downloadBtn: $("ewDownloadBtn"),

        viewer: $("ewViewer"),
        viewerTitle: $("ewViewerTitle"),
        viewerContent: $("ewViewerContent"),
        closeViewer: $("ewCloseViewer"),

        preview: $("ewPreview"),
        previewContent: $("ewPreviewContent"),
        closePreview: $("ewClosePreview")
    };

    /* =========================================
       INITIALIZATION
    ========================================= */

    function init() {
        const required = [
            "input", "dropArea", "fileList",
            "wordBtn", "pdfBtn", "clearBtn",
            "status", "results", "resultList"
        ];

        const missing = required.filter(key => !el[key]);

        if (missing.length) {
            console.error("JScan Excel tool: Missing HTML elements:", missing);
            return;
        }

        bindEvents();
        renderFiles();
        updateButtons();

        console.log("JScan Excel to Word & PDF initialized successfully.");
    }

    /* =========================================
       UTILITIES
    ========================================= */

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }

    function getBaseName(filename) {
        return filename.replace(/\.[^/.]+$/, "");
    }

    function formatSize(bytes) {
        if (!bytes) return "0 Bytes";

        const units = ["Bytes", "KB", "MB", "GB"];
        const index = Math.min(
            Math.floor(Math.log(bytes) / Math.log(1024)),
            units.length - 1
        );

        return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
    }

    function makeId() {
        return window.crypto?.randomUUID
            ? window.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    function setStatus(message, type = "") {
        if (!el.status) return;

        el.status.textContent = message;
        el.status.className = `word-excel-status ${type}`.trim();
        el.status.style.display = "block";
    }

    function setEditorStatus(message) {
        if (el.editorStatus) {
            el.editorStatus.textContent = message;
        }
    }

    function updateButtons() {
        const hasFiles = EW.files.length > 0;

        el.wordBtn.disabled = !hasFiles || EW.isConverting;
        el.pdfBtn.disabled = !hasFiles || EW.isConverting;
        el.clearBtn.disabled = !hasFiles || EW.isConverting;
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 30000);
    }

    function showModal(modal) {
        if (modal) modal.classList.add("active");
    }

    function hideModal(modal) {
        if (modal) modal.classList.remove("active");
    }

    function saveEditorSelection() {
        const selection = window.getSelection();

        if (!selection || !selection.rangeCount || !el.document) return;

        const range = selection.getRangeAt(0);

        if (el.document.contains(range.commonAncestorContainer)) {
            EW.savedRange = range.cloneRange();
        }
    }

    function restoreEditorSelection() {
        if (!EW.savedRange || !el.document) return false;

        try {
            el.document.focus();

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(EW.savedRange);

            return true;
        } catch (error) {
            console.warn("Could not restore editor selection:", error);
            return false;
        }
    }

    /* =========================================
       EVENT LISTENERS
    ========================================= */

    function bindEvents() {
        el.input.addEventListener("change", event => {
            addFiles(event.target.files);
            event.target.value = "";
        });

        el.wordBtn.addEventListener("click", () => convertFiles("word"));
        el.pdfBtn.addEventListener("click", () => convertFiles("pdf"));
        el.clearBtn.addEventListener("click", clearFiles);

        el.dropArea.addEventListener("dragover", event => {
            event.preventDefault();
            el.dropArea.classList.add("drag-over");
        });

        el.dropArea.addEventListener("dragleave", () => {
            el.dropArea.classList.remove("drag-over");
        });

        el.dropArea.addEventListener("drop", event => {
            event.preventDefault();
            el.dropArea.classList.remove("drag-over");
            addFiles(event.dataTransfer.files);
        });

        el.fileList.addEventListener("click", handleFileActions);
        el.resultList.addEventListener("click", handleResultActions);

        el.closeEditor?.addEventListener("click", closeEditor);
        el.closeViewer?.addEventListener("click", closeViewer);
        el.closePreview?.addEventListener("click", closePreview);

        el.previewBtn?.addEventListener("click", showDocumentPreview);
        el.downloadBtn?.addEventListener("click", downloadEditedDocument);

        // Preserve selected text before toolbar controls take focus.
        el.editor?.querySelectorAll(
            ".word-excel-editor-toolbar button, .word-excel-editor-toolbar select, .word-excel-editor-toolbar input"
        ).forEach(control => {
            control.addEventListener("mousedown", saveEditorSelection);
            control.addEventListener("focus", saveEditorSelection);
        });

        el.fontFamily?.addEventListener("change", () => {
            restoreEditorSelection();
            applyFormat("fontName", el.fontFamily.value);
            saveEditorSelection();
        });

        el.fontSize?.addEventListener("change", () => {
            const size = parseFloat(el.fontSize.value);

            if (size >= 8 && size <= 72) {
                restoreEditorSelection();
                applyFontSize(size);
                saveEditorSelection();
            }
        });

        el.customFont?.addEventListener("change", loadCustomFont);

        el.editor?.addEventListener("click", event => {
            const button = event.target.closest("[data-ew-command]");

            if (!button) return;

            restoreEditorSelection();
            applyFormat(button.dataset.ewCommand);
            saveEditorSelection();
        });

        el.document?.addEventListener("keyup", saveEditorSelection);
        el.document?.addEventListener("mouseup", saveEditorSelection);

        [el.viewer, el.preview].forEach(modal => {
            modal?.addEventListener("click", event => {
                if (event.target === modal) hideModal(modal);
            });
        });

        window.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                closeViewer();
                closePreview();
            }
        });

        window.ewFormat = command => applyFormat(command);
    }

    /* =========================================
       FILE UPLOAD
    ========================================= */

    function addFiles(fileList) {
        const selectedFiles = Array.from(fileList || []);
        let added = 0;

        selectedFiles.forEach(file => {
            const extension = file.name.split(".").pop().toLowerCase();

            if (!["xlsx", "xls", "csv"].includes(extension)) {
                setStatus(
                    `${file.name} is not supported. Select XLSX, XLS or CSV.`,
                    "error"
                );
                return;
            }

            const duplicate = EW.files.some(item =>
                item.file.name === file.name &&
                item.file.size === file.size &&
                item.file.lastModified === file.lastModified
            );

            if (duplicate) return;

            EW.files.push({
                id: makeId(),
                file,
                workbook: null
            });

            added++;
        });

        renderFiles();
        updateButtons();

        if (added) {
            setStatus(`${added} file(s) added successfully.`, "success");
        }
    }

    /* =========================================
       READ EXCEL WORKBOOK
    ========================================= */

    async function getWorkbook(item) {
        if (item.workbook) return item.workbook;

        if (typeof XLSX === "undefined") {
            throw new Error("Excel library did not load.");
        }

        const buffer = await item.file.arrayBuffer();

        item.workbook = XLSX.read(buffer, {
            type: "array",
            cellDates: true
        });

        return item.workbook;
    }

    /* =========================================
       REAL SPREADSHEET THUMBNAILS
    ========================================= */

    function renderFiles() {
        if (!EW.files.length) {
            el.fileList.innerHTML = `
                <div class="empty-state">
                    <p>No Excel files selected.</p>
                </div>
            `;
            return;
        }

        el.fileList.innerHTML = EW.files.map(item => `
            <div class="word-excel-file" data-id="${escapeHTML(item.id)}">

                <div class="word-excel-thumbnail" data-action="preview" data-id="${escapeHTML(item.id)}">
                    <canvas
                        data-thumbnail-id="${escapeHTML(item.id)}"
                        width="560"
                        height="340"
                        aria-label="Spreadsheet thumbnail">
                    </canvas>
                </div>

                <div class="word-excel-file-info">
                    <strong>${escapeHTML(item.file.name)}</strong>
                    <small>${formatSize(item.file.size)}</small>
                </div>

                <div class="word-excel-file-actions">

                    <button
                        type="button"
                        data-action="preview"
                        data-id="${escapeHTML(item.id)}">
                        Preview
                    </button>

                    <button
                        type="button"
                        class="remove"
                        data-action="remove"
                        data-id="${escapeHTML(item.id)}">
                        Remove
                    </button>

                </div>
            </div>
        `).join("");

        EW.files.forEach(item => {
            renderThumbnail(item);
        });
    }

    async function renderThumbnail(item) {
        const canvas = el.fileList.querySelector(
            `canvas[data-thumbnail-id="${item.id}"]`
        );

        if (!canvas) return;

        const ctx = canvas.getContext("2d");

        if (!ctx) return;

        drawThumbnailMessage(ctx, "Loading spreadsheet...");

        try {
            const workbook = await getWorkbook(item);
            const firstSheetName = workbook.SheetNames[0];

            if (!firstSheetName) {
                drawThumbnailMessage(ctx, "Empty spreadsheet");
                return;
            }

            const sheet = workbook.Sheets[firstSheetName];

            const rows = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                raw: false,
                defval: "",
                blankrows: false
            });

            drawSpreadsheetThumbnail(ctx, rows);

        } catch (error) {
            console.error("Thumbnail error:", error);
            drawThumbnailMessage(ctx, "Preview unavailable");
        }
    }

    function drawThumbnailMessage(ctx, message) {
        ctx.clearRect(0, 0, 560, 340);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 560, 340);

        ctx.fillStyle = "#64748b";
        ctx.font = "22px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(message, 280, 170);
    }

    function drawSpreadsheetThumbnail(ctx, rows) {
        const width = 560;
        const height = 340;
        const padding = 18;
        const visibleRows = 9;
        const visibleCols = 5;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        if (!rows.length) {
            drawThumbnailMessage(ctx, "Empty spreadsheet");
            return;
        }

        const rowCount = Math.min(rows.length, visibleRows);
        const colCount = Math.min(
            visibleCols,
            Math.max(1, ...rows.slice(0, rowCount).map(row => row.length))
        );

        const tableWidth = width - padding * 2;
        const rowHeight = (height - padding * 2) / rowCount;
        const colWidth = tableWidth / colCount;

        ctx.font = "13px Arial";
        ctx.textBaseline = "middle";

        for (let r = 0; r < rowCount; r++) {
            for (let c = 0; c < colCount; c++) {
                const x = padding + c * colWidth;
                const y = padding + r * rowHeight;

                const value = String(rows[r]?.[c] ?? "");

                ctx.fillStyle = r === 0 ? "#dbeafe" : "#ffffff";
                ctx.fillRect(x, y, colWidth, rowHeight);

                ctx.strokeStyle = "#cbd5e1";
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, colWidth, rowHeight);

                ctx.save();
                ctx.beginPath();
                ctx.rect(x + 5, y, colWidth - 10, rowHeight);
                ctx.clip();

                ctx.fillStyle = r === 0 ? "#1e3a8a" : "#334155";
                ctx.font = r === 0
                    ? "bold 13px Arial"
                    : "12px Arial";

                ctx.textAlign = "left";
                ctx.fillText(value, x + 6, y + rowHeight / 2);

                ctx.restore();
            }
        }

        if (rows.length > visibleRows) {
            ctx.fillStyle = "#64748b";
            ctx.font = "11px Arial";
            ctx.textAlign = "right";
            ctx.fillText(
                `Showing first ${visibleRows} rows`,
                width - padding,
                height - 5
            );
        }
    }

    async function handleFileActions(event) {
        const button = event.target.closest("[data-action]");

        if (!button) return;

        const item = EW.files.find(
            file => file.id === button.dataset.id
        );

        if (!item) return;

        if (button.dataset.action === "remove") {
            EW.files = EW.files.filter(file => file.id !== item.id);

            renderFiles();
            updateButtons();

            setStatus("File removed.", "success");
        }

        if (button.dataset.action === "preview") {
            await previewExcel(item);
        }
    }

    function clearFiles() {
        if (EW.isConverting) return;

        EW.files = [];
        EW.results = [];

        el.resultList.innerHTML = "";
        el.results.style.display = "none";

        renderFiles();
        updateButtons();

        setStatus("Files cleared.");
    }

    /* =========================================
       EXCEL PREVIEW
    ========================================= */

    async function previewExcel(item) {
        try {
            setStatus(`Preparing ${item.file.name} preview...`);

            const workbook = await getWorkbook(item);

            let html = `
                <div class="excel-preview">
                    <h3>${escapeHTML(item.file.name)}</h3>
            `;

            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];

                html += `
                    <h4>${escapeHTML(sheetName)}</h4>
                    <div class="excel-preview-table">
                        ${XLSX.utils.sheet_to_html(sheet)}
                    </div>
                `;
            });

            html += "</div>";

            el.viewerTitle.textContent = item.file.name;
            el.viewerContent.innerHTML = html;

            showModal(el.viewer);
            setStatus("Excel preview ready.", "success");

        } catch (error) {
            console.error(error);
            setStatus(
                error.message || "Unable to preview this Excel file.",
                "error"
            );
        }
    }

    function closeViewer() {
        hideModal(el.viewer);
    }

    /* =========================================
       CONVERSION
    ========================================= */

    async function convertFiles(format) {
        if (EW.isConverting || !EW.files.length) return;

        EW.isConverting = true;
        EW.results = [];

        el.resultList.innerHTML = "";
        el.results.style.display = "block";

        updateButtons();

        let successful = 0;
        let failed = 0;

        try {
            for (let i = 0; i < EW.files.length; i++) {
                const file = EW.files[i].file;

                setStatus(
                    `Converting ${i + 1} of ${EW.files.length}: ${file.name}`
                );

                try {
                    const result = await convertOne(file, format);

                    EW.results.push(result);
                    successful++;

                } catch (error) {
                    console.error("Conversion failed:", error);

                    EW.results.push({
                        id: makeId(),
                        originalName: file.name,
                        format,
                        error: error.message
                    });

                    failed++;
                }

                renderResults();
            }

        } finally {
            EW.isConverting = false;
            updateButtons();
        }

        if (successful && !failed) {
            setStatus(
                `${successful} file(s) converted successfully.`,
                "success"
            );
        } else if (successful && failed) {
            setStatus(
                `${successful} converted successfully; ${failed} failed.`,
                "error"
            );
        } else {
            setStatus(
                "Conversion failed. Check your JScan API connection.",
                "error"
            );
        }

        if (format === "word") {
            const firstWord = EW.results.find(
                result => result.format === "word" && result.blob
            );

            if (firstWord) {
                await openEditor(firstWord);
            }
        }
    }

    async function convertOne(file, format) {
        const endpoint = format === "word"
            ? `${API_URL}/excel-to-word`
            : `${API_URL}/excel-to-pdf`;

        const formData = new FormData();
        formData.append("file", file, file.name);

        let response;

        try {
            response = await fetch(endpoint, {
                method: "POST",
                body: formData
            });
        } catch (error) {
            throw new Error(
                "Cannot connect to JScan API. Make sure Docker is running and localhost:8000 is accessible."
            );
        }

        if (!response.ok) {
            let message = `Server returned error ${response.status}.`;

            try {
                const data = await response.json();
                message = data.detail || data.message || message;
            } catch (_) {}

            throw new Error(message);
        }

        const blob = await response.blob();

        if (!blob.size) {
            throw new Error("The server returned an empty document.");
        }

        const signature = new Uint8Array(
            await blob.slice(0, 8).arrayBuffer()
        );

        const isPDF =
            signature[0] === 0x25 &&
            signature[1] === 0x50 &&
            signature[2] === 0x44 &&
            signature[3] === 0x46;

        const isDOCX =
            signature[0] === 0x50 &&
            signature[1] === 0x4B;

        if (format === "pdf" && !isPDF) {
            throw new Error("The API did not return a valid PDF.");
        }

        if (format === "word" && !isDOCX) {
            throw new Error("The API did not return a valid DOCX file.");
        }

        const extension = format === "word" ? "docx" : "pdf";

        return {
            id: makeId(),
            originalName: file.name,
            filename: `${getBaseName(file.name)}.${extension}`,
            format,
            blob
        };
    }

    /* =========================================
       RESULTS
    ========================================= */

    function renderResults() {
        el.results.style.display = "block";

        el.resultList.innerHTML = EW.results.map(result => {
            if (result.error) {
                return `
                    <div class="word-excel-result error">
                        <div class="word-excel-result-details">
                            <strong>${escapeHTML(result.originalName)}</strong>
                            <small>${escapeHTML(result.error)}</small>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="word-excel-result" data-id="${escapeHTML(result.id)}">

                    <div class="word-excel-result-details">
                        <strong>${escapeHTML(result.filename)}</strong>
                        <small>
                            ${result.format.toUpperCase()} ·
                            ${formatSize(result.blob.size)}
                        </small>
                    </div>

                    <div class="word-excel-result-actions">

                        ${result.format === "word" ? `
                            <button
                                type="button"
                                class="btn btn-ghost"
                                data-action="edit"
                                data-id="${escapeHTML(result.id)}">
                                Edit
                            </button>
                        ` : ""}

                        <button
                            type="button"
                            class="btn btn-primary"
                            data-action="download"
                            data-id="${escapeHTML(result.id)}">
                            Download
                        </button>

                    </div>
                </div>
            `;
        }).join("");
    }

    function handleResultActions(event) {
        const button = event.target.closest("[data-action]");

        if (!button) return;

        const result = EW.results.find(
            item => item.id === button.dataset.id
        );

        if (!result || result.error) return;

        if (button.dataset.action === "download") {
            downloadResult(result);
        }

        if (button.dataset.action === "edit") {
            openEditor(result);
        }
    }

    function downloadResult(result) {
        downloadBlob(result.blob, result.filename);
    }

    /* =========================================
       WORD EDITOR
    ========================================= */

    async function openEditor(result) {
        if (!el.editor || !el.document || !el.outputName) {
            setStatus("Word editor elements are missing from the HTML.", "error");
            return;
        }

        if (typeof mammoth === "undefined") {
            setStatus("Word editor library did not load. Refresh the page and try again.", "error");
            return;
        }

        if (!result?.blob) {
            setStatus("The converted Word document is unavailable.", "error");
            return;
        }

        EW.currentResult = result;
        EW.currentDocument = result.blob;
        EW.currentFilename = result.filename;
        EW.savedRange = null;

        setEditorStatus("Opening document...");

        try {
            const buffer = await result.blob.arrayBuffer();

            const converted = await mammoth.convertToHtml({
                arrayBuffer: buffer
            });

            if (!converted.value || !converted.value.trim()) {
                throw new Error("The Word document contains no editable content.");
            }

            el.document.innerHTML = converted.value;
            el.outputName.value = getBaseName(result.filename);

            showModal(el.editor);

            setEditorStatus("Document ready for editing.");

            // Bring the editor into view after it opens.
            el.editor.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        } catch (error) {
            console.error("Word editor error:", error);

            setEditorStatus(
                error.message || "Unable to open this Word document."
            );

            setStatus(
                `Could not open ${result.filename} in the editor. ${error.message || ""}`,
                "error"
            );
        }
    }

    function closeEditor() {
        hideModal(el.editor);

        EW.currentDocument = null;
        EW.currentFilename = "";
        EW.currentResult = null;
        EW.savedRange = null;
    }

    /* =========================================
       TEXT FORMATTING
    ========================================= */

    function applyFormat(command, value = null) {
        if (!el.document) return;

        restoreEditorSelection();
        el.document.focus();

        try {
            document.execCommand(command, false, value);
            saveEditorSelection();
            setEditorStatus("Formatting applied.");
        } catch (error) {
            console.error("Formatting error:", error);
            setEditorStatus("Unable to apply this formatting.");
        }
    }

    function applyFontSize(size) {
        if (!el.document) return;

        restoreEditorSelection();
        el.document.focus();

        const selection = window.getSelection();

        if (!selection || !selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        if (!el.document.contains(range.commonAncestorContainer)) return;

        if (range.collapsed) {
            document.execCommand("fontSize", false, "7");

            el.document.querySelectorAll('font[size="7"]').forEach(node => {
                const span = document.createElement("span");
                span.style.fontSize = `${size}pt`;
                span.innerHTML = node.innerHTML;
                node.replaceWith(span);
            });
        } else {
            const span = document.createElement("span");
            span.style.fontSize = `${size}pt`;

            try {
                span.appendChild(range.extractContents());
                range.insertNode(span);

                const newRange = document.createRange();
                newRange.selectNodeContents(span);

                selection.removeAllRanges();
                selection.addRange(newRange);

            } catch (error) {
                console.error("Font size error:", error);
                setEditorStatus("Unable to apply the selected font size.");
                return;
            }
        }

        saveEditorSelection();
        setEditorStatus(`Font size changed to ${size}pt.`);
    }

    /* =========================================
       CUSTOM FONT
    ========================================= */

    async function loadCustomFont(event) {
        const file = event.target.files?.[0];

        if (!file) return;

        if (!/\.(ttf|otf|woff|woff2)$/i.test(file.name)) {
            setEditorStatus("Select a valid TTF, OTF, WOFF or WOFF2 font.");
            event.target.value = "";
            return;
        }

        const fontName = getBaseName(file.name)
            .replace(/[^a-zA-Z0-9_-]/g, "");

        const url = URL.createObjectURL(file);

        try {
            const font = new FontFace(
                fontName,
                `url("${url}")`
            );

            const loadedFont = await font.load();

            document.fonts.add(loadedFont);
            EW.fontUrls.push(url);

            if (el.fontFamily) {
                let option = Array.from(el.fontFamily.options).find(
                    item => item.value === fontName
                );

                if (!option) {
                    option = document.createElement("option");
                    option.value = fontName;
                    option.textContent = fontName;
                    el.fontFamily.appendChild(option);
                }

                el.fontFamily.value = fontName;
            }

            restoreEditorSelection();
            applyFormat("fontName", fontName);

            setEditorStatus(`${fontName} loaded and applied successfully.`);

        } catch (error) {
            console.error("Custom font error:", error);

            URL.revokeObjectURL(url);

            setEditorStatus(
                "Unable to load this font. Check that the font file is valid."
            );
        }

        event.target.value = "";
    }

    /* =========================================
       DOCUMENT PREVIEW
    ========================================= */

    function showDocumentPreview() {
        if (!el.preview || !el.previewContent || !el.document) return;

        el.previewContent.innerHTML = `
            <div class="document-preview-content">
                ${el.document.innerHTML}
            </div>
        `;

        showModal(el.preview);
    }

    function closePreview() {
        hideModal(el.preview);
    }

    /* =========================================
       DOWNLOAD EDITED WORD DOCUMENT
    ========================================= */

    function downloadEditedDocument() {
        if (!EW.currentResult || !el.document) {
            setEditorStatus("No Word document is open.");
            return;
        }

        if (typeof htmlDocx === "undefined" || !htmlDocx.asBlob) {
            setEditorStatus("Word document download library did not load.");
            return;
        }

        const name = el.outputName?.value.trim();

        if (!name) {
            setEditorStatus("Please enter a document name.");
            return;
        }

        try {
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">

                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            font-size: 11pt;
                            line-height: 1.5;
                        }

                        table {
                            border-collapse: collapse;
                            width: 100%;
                        }

                        td, th {
                            border: 1px solid #999;
                            padding: 6px;
                        }

                        img {
                            max-width: 100%;
                        }
                    </style>
                </head>

                <body>
                    ${el.document.innerHTML}
                </body>
                </html>
            `;

            const blob = htmlDocx.asBlob(html);
            const filename = `${name.replace(/\.docx$/i, "")}.docx`;

            EW.currentResult.filename = filename;
            EW.currentResult.blob = blob;

            EW.currentDocument = blob;
            EW.currentFilename = filename;

            downloadBlob(blob, filename);
            renderResults();

            setEditorStatus("Edited Word document downloaded successfully.");

        } catch (error) {
            console.error(error);
            setEditorStatus("Unable to generate the edited Word document.");
        }
    }

    /* =========================================
       START APPLICATION
    ========================================= */

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }

})();
