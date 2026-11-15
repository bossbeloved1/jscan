
/* =========================================
   JSCAN — WORD & PDF TO EXCEL
   WITH SCANNED PDF OCR SUPPORT
   ========================================= */

const wordExcelInput = document.getElementById("wordExcelInput");
const wordExcelDropArea = document.getElementById("wordExcelDropArea");
const wordExcelFileList = document.getElementById("wordExcelFileList");
const wordExcelConvertBtn = document.getElementById("wordExcelConvertBtn");
const wordExcelClearBtn = document.getElementById("wordExcelClearBtn");
const wordExcelStatus = document.getElementById("wordExcelStatus");

const wordExcelResults = document.getElementById("wordExcelResults");
const wordExcelResultList = document.getElementById("wordExcelResultList");

const wordExcelEditor = document.getElementById("wordExcelEditor");
const wordExcelTable = document.getElementById("wordExcelTable");
const wordExcelTableHead = document.getElementById("wordExcelTableHead");
const wordExcelTableBody = document.getElementById("wordExcelTableBody");

const wordExcelOutputName = document.getElementById("wordExcelOutputName");
const wordExcelFontFamily = document.getElementById("wordExcelFontFamily");
const wordExcelFontSize = document.getElementById("wordExcelFontSize");
const wordExcelCustomFont = document.getElementById("wordExcelCustomFont");
const wordExcelEditorStatus = document.getElementById("wordExcelEditorStatus");

const wordExcelViewer = document.getElementById("wordExcelViewer");
const wordExcelViewerTitle = document.getElementById("wordExcelViewerTitle");
const wordExcelViewerContent = document.getElementById("wordExcelViewerContent");

const wordExcelPreview = document.getElementById("wordExcelPreview");
const wordExcelPreviewContent = document.getElementById("wordExcelPreviewContent");

let wordExcelFiles = [];
let wordExcelResultsData = [];
let currentWorkbookData = null;
let currentWorkbookName = "";
let selectedCell = null;
let customFontNames = [];

/* =========================================
   PDF.JS CONFIGURATION
   ========================================= */

if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

/* =========================================
   HELPERS
   ========================================= */

function wordExcelFormatSize(bytes) {
    if (bytes < 1024) return bytes + " B";

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function wordExcelSafeName(name) {
    return name
        .replace(/\.[^/.]+$/, "")
        .replace(/[\\/:*?"<>|]/g, "")
        .trim() || "Converted Document";
}

function wordExcelShowStatus(message, type = "") {
    wordExcelStatus.textContent = message;
    wordExcelStatus.className = "word-excel-status " + type;
    wordExcelStatus.style.display = "block";
}

function wordExcelUpdateButtons() {
    const hasFiles = wordExcelFiles.length > 0;

    wordExcelConvertBtn.disabled = !hasFiles;
    wordExcelClearBtn.disabled = !hasFiles;
}

/* =========================================
   FILE VALIDATION
   ========================================= */

function wordExcelIsSupported(file) {
    const extension = file.name.split(".").pop().toLowerCase();

    return extension === "pdf" || extension === "docx";
}

function wordExcelAddFiles(fileList) {
    const incomingFiles = Array.from(fileList);

    let added = 0;
    let rejected = 0;

    incomingFiles.forEach(file => {
        if (!wordExcelIsSupported(file)) {
            rejected++;
            return;
        }

        const alreadyAdded = wordExcelFiles.some(
            item =>
                item.file.name === file.name &&
                item.file.size === file.size &&
                item.file.lastModified === file.lastModified
        );

        if (alreadyAdded) return;

        wordExcelFiles.push({
            id: crypto.randomUUID(),
            file,
            type: file.name.toLowerCase().endsWith(".pdf")
                ? "pdf"
                : "docx"
        });

        added++;
    });

    wordExcelRenderFiles();
    wordExcelUpdateButtons();

    if (rejected) {
        wordExcelShowStatus(
            `${rejected} unsupported file(s) skipped. Please select PDF or DOCX files.`,
            "error"
        );
    } else if (added) {
        wordExcelShowStatus(
            `${added} file(s) added successfully.`,
            "success"
        );
    }
}

wordExcelInput.addEventListener("change", event => {
    wordExcelAddFiles(event.target.files);
    event.target.value = "";
});

/* =========================================
   DRAG AND DROP
   ========================================= */

wordExcelDropArea.addEventListener("dragover", event => {
    event.preventDefault();
    wordExcelDropArea.classList.add("drag-over");
});

wordExcelDropArea.addEventListener("dragleave", () => {
    wordExcelDropArea.classList.remove("drag-over");
});

wordExcelDropArea.addEventListener("drop", event => {
    event.preventDefault();
    wordExcelDropArea.classList.remove("drag-over");

    wordExcelAddFiles(event.dataTransfer.files);
});

/* =========================================
   FILE THUMBNAILS
   ========================================= */

function wordExcelRenderFiles() {
    wordExcelFileList.innerHTML = "";

    wordExcelFiles.forEach(item => {
        const card = document.createElement("div");
        card.className = "word-excel-file";

        const thumbnail = document.createElement("div");
        thumbnail.className = "word-excel-thumbnail";

        const icon = document.createElement("div");
        icon.className = "word-excel-thumbnail-placeholder";

        icon.innerHTML = item.type === "pdf"
            ? '<div style="font-size:48px;color:#ef4444">PDF</div><div>PDF document</div>'
            : '<div style="font-size:48px;color:#2563eb">W</div><div>Word document</div>';

        thumbnail.appendChild(icon);

        const info = document.createElement("div");
        info.className = "word-excel-file-info";

        const name = document.createElement("strong");
        name.textContent = item.file.name;

        const details = document.createElement("small");
        details.textContent =
            `${item.type.toUpperCase()} • ${wordExcelFormatSize(item.file.size)}`;

        info.append(name, details);

        const actions = document.createElement("div");
        actions.className = "word-excel-file-actions";

        const viewButton = document.createElement("button");
        viewButton.type = "button";
        viewButton.textContent = "View document";

        viewButton.addEventListener("click", () => {
            wordExcelViewOriginal(item);
        });

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove";
        removeButton.textContent = "Remove";

        removeButton.addEventListener("click", () => {
            wordExcelRemoveFile(item.id);
        });

        actions.append(viewButton, removeButton);
        card.append(thumbnail, info, actions);

        wordExcelFileList.appendChild(card);

        if (item.type === "pdf") {
            wordExcelRenderPDFThumbnail(item.file, thumbnail);
        } else {
            wordExcelRenderWordThumbnail(item.file, thumbnail);
        }
    });
}

async function wordExcelRenderPDFThumbnail(file, container) {
    try {
        const buffer = await file.arrayBuffer();

        const pdf = await pdfjsLib.getDocument({
            data: new Uint8Array(buffer)
        }).promise;

        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.65 });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
            canvasContext: context,
            viewport
        }).promise;

        if (container.isConnected) {
            container.innerHTML = "";
            container.appendChild(canvas);
        }

    } catch (error) {
        console.error("PDF thumbnail error:", error);
    }
}

async function wordExcelRenderWordThumbnail(file, container) {
    try {
        const buffer = await file.arrayBuffer();

        const result = await mammoth.convertToHtml({
            arrayBuffer: buffer
        });

        const preview = document.createElement("div");

        preview.style.background = "white";
        preview.style.color = "#333";
        preview.style.width = "85%";
        preview.style.height = "145px";
        preview.style.padding = "12px";
        preview.style.overflow = "hidden";
        preview.style.fontSize = "10px";
        preview.style.lineHeight = "1.4";
        preview.style.boxShadow = "0 2px 8px rgba(0,0,0,.12)";

        preview.textContent =
            result.value.replace(/\s+/g, " ").trim().slice(0, 350) ||
            "Word document";

        if (container.isConnected) {
            container.innerHTML = "";
            container.appendChild(preview);
        }

    } catch (error) {
        console.error("Word thumbnail error:", error);
    }
}

/* =========================================
   REMOVE AND CLEAR FILES
   ========================================= */

function wordExcelRemoveFile(id) {
    wordExcelFiles = wordExcelFiles.filter(item => item.id !== id);

    wordExcelRenderFiles();
    wordExcelUpdateButtons();

    if (!wordExcelFiles.length) {
        wordExcelShowStatus("No files selected.");
    }
}

wordExcelClearBtn.addEventListener("click", () => {
    wordExcelFiles = [];
    wordExcelFileList.innerHTML = "";
    wordExcelResultsData = [];

    wordExcelResultList.innerHTML = "";
    wordExcelResults.style.display = "none";

    wordExcelEditor.classList.remove("active");
    currentWorkbookData = null;
    selectedCell = null;

    wordExcelShowStatus("All files cleared.");

    wordExcelUpdateButtons();
});

/* =========================================
   ORIGINAL DOCUMENT VIEWER
   ========================================= */

async function wordExcelViewOriginal(item) {
    wordExcelViewerTitle.textContent = item.file.name;
    wordExcelViewerContent.innerHTML = "Loading document...";

    wordExcelViewer.classList.add("active");

    try {
        if (item.type === "docx") {
            const buffer = await item.file.arrayBuffer();

            const result = await mammoth.convertToHtml({
                arrayBuffer: buffer
            });

            wordExcelViewerContent.innerHTML = result.value;

        } else {
            await wordExcelRenderPDFViewer(item.file);
        }

    } catch (error) {
        console.error(error);

        wordExcelViewerContent.textContent =
            "Unable to preview this document.";
    }
}

async function wordExcelRenderPDFViewer(file) {
    const buffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer)
    }).promise;

    wordExcelViewerContent.innerHTML = "";

    for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
    ) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.15 });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        canvas.style.display = "block";
        canvas.style.maxWidth = "100%";
        canvas.style.height = "auto";
        canvas.style.margin = "0 auto 20px";

        await page.render({
            canvasContext: context,
            viewport
        }).promise;

        wordExcelViewerContent.appendChild(canvas);
    }
}

document.getElementById("wordExcelCloseViewer")
    .addEventListener("click", () => {
        wordExcelViewer.classList.remove("active");
    });

wordExcelViewer.addEventListener("click", event => {
    if (event.target === wordExcelViewer) {
        wordExcelViewer.classList.remove("active");
    }
});

/* =========================================
   WORD DOCUMENT EXTRACTION
   ========================================= */

async function wordExcelExtractWord(file) {
    const buffer = await file.arrayBuffer();

    const result = await mammoth.convertToHtml({
        arrayBuffer: buffer
    });

    const parser = new DOMParser();

    const documentHTML = parser.parseFromString(
        result.value,
        "text/html"
    );

    const rows = [];

    documentHTML.querySelectorAll("table").forEach(
        (table, tableIndex) => {
            const tableRows = Array.from(
                table.querySelectorAll("tr")
            );

            tableRows.forEach(row => {
                const cells = Array.from(
                    row.querySelectorAll("th, td")
                ).map(cell => cell.innerText.trim());

                if (cells.some(Boolean)) {
                    rows.push([
                        `Table ${tableIndex + 1}`,
                        ...cells
                    ]);
                }
            });
        }
    );

    const paragraphs = Array.from(
        documentHTML.body.querySelectorAll(
            "p, h1, h2, h3, h4, h5, h6, li"
        )
    );

    paragraphs.forEach(element => {
        if (element.closest("table")) return;

        const text = element.innerText.trim();

        if (text) {
            rows.push(["Text", text]);
        }
    });

    return {
        rows: wordExcelNormalizeRows(rows),
        warnings: result.messages || []
    };
}

/* =========================================
   OCR WORKER
   ========================================= */

async function wordExcelCreateOCRWorker() {
    if (!window.Tesseract) {
        throw new Error(
            "OCR library could not load. Check your internet connection and reload JScan."
        );
    }

    return await Tesseract.createWorker(
        "eng",
        1,
        {
            logger: message => {
                if (
                    message.status === "loading language traineddata"
                ) {
                    wordExcelShowStatus(
                        "Downloading English OCR language data..."
                    );
                }
            }
        }
    );
}

/* =========================================
   PDF DOCUMENT EXTRACTION + OCR
   ========================================= */

async function wordExcelExtractPDF(file) {
    const buffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer)
    }).promise;

    const rows = [];

    let ocrWorker = null;
    let scannedPages = 0;

    try {
        for (
            let pageNumber = 1;
            pageNumber <= pdf.numPages;
            pageNumber++
        ) {
            const page = await pdf.getPage(pageNumber);

            wordExcelShowStatus(
                `Reading page ${pageNumber} of ${pdf.numPages}: ${file.name}`
            );

            const content = await page.getTextContent();

            const items = content.items
                .filter(item => item.str && item.str.trim())
                .map(item => ({
                    text: item.str.trim(),
                    x: item.transform[4],
                    y: item.transform[5]
                }));

            // ---------------------------------
            // SELECTABLE TEXT PAGE
            // ---------------------------------

            if (items.length > 0) {
                const lines = [];

                items.forEach(item => {
                    let line = lines.find(existing =>
                        Math.abs(existing.y - item.y) < 3
                    );

                    if (!line) {
                        line = {
                            y: item.y,
                            items: []
                        };

                        lines.push(line);
                    }

                    line.items.push(item);
                });

                lines.sort((a, b) => b.y - a.y);

                lines.forEach(line => {
                    line.items.sort((a, b) => a.x - b.x);

                    const cells = [];
                    let previousX = null;

                    line.items.forEach(item => {
                        if (
                            previousX !== null &&
                            item.x - previousX > 45
                        ) {
                            cells.push("");
                        }

                        if (!cells.length) {
                            cells.push(item.text);
                        } else {
                            cells[cells.length - 1] +=
                                (cells[cells.length - 1] ? " " : "") +
                                item.text;
                        }

                        previousX = item.x + item.text.length * 4;
                    });

                    if (cells.some(Boolean)) {
                        rows.push([
                            `Page ${pageNumber}`,
                            ...cells
                        ]);
                    }
                });

                continue;
            }

            // ---------------------------------
            // SCANNED PAGE — OCR REQUIRED
            // ---------------------------------

            scannedPages++;

            if (!ocrWorker) {
                wordExcelShowStatus(
                    "Preparing OCR engine. Please wait..."
                );

                ocrWorker = await wordExcelCreateOCRWorker();
            }

            const viewport = page.getViewport({
                scale: 2
            });

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);

            await page.render({
                canvasContext: context,
                viewport
            }).promise;

            wordExcelShowStatus(
                `Recognizing scanned page ${pageNumber} of ${pdf.numPages}...`
            );

            const result = await ocrWorker.recognize(canvas);

            const extractedText = result.data.text || "";

            const ocrLines = extractedText
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(Boolean);

            ocrLines.forEach(line => {
                rows.push([
                    `Page ${pageNumber}`,
                    line
                ]);
            });

            canvas.width = 0;
            canvas.height = 0;
        }

    } finally {
        if (ocrWorker) {
            await ocrWorker.terminate();
        }
    }

    return {
        rows: wordExcelNormalizeRows(rows),
        warnings: [],
        scannedPages
    };
}

/* =========================================
   NORMALIZE SPREADSHEET ROWS
   ========================================= */

function wordExcelNormalizeRows(rows) {
    const cleaned = rows.map(row =>
        row.map(value => String(value ?? "").trim())
    );

    const maxColumns = Math.max(
        2,
        ...cleaned.map(row => row.length)
    );

    return cleaned.map(row => {
        while (row.length < maxColumns) {
            row.push("");
        }

        return row;
    });
}

/* =========================================
   CONVERT ALL DOCUMENTS
   ========================================= */

wordExcelConvertBtn.addEventListener(
    "click",
    wordExcelConvertAll
);

async function wordExcelConvertAll() {
    if (!wordExcelFiles.length) return;

    wordExcelConvertBtn.disabled = true;
    wordExcelClearBtn.disabled = true;

    wordExcelResultsData = [];
    wordExcelResultList.innerHTML = "";
    wordExcelResults.style.display = "none";

    let successful = 0;
    let failed = 0;

    try {
        for (
            let index = 0;
            index < wordExcelFiles.length;
            index++
        ) {
            const item = wordExcelFiles[index];

            wordExcelShowStatus(
                `Processing ${index + 1} of ${wordExcelFiles.length}: ${item.file.name}`
            );

            try {
                const extracted = item.type === "docx"
                    ? await wordExcelExtractWord(item.file)
                    : await wordExcelExtractPDF(item.file);

                if (!extracted.rows.length) {
                    throw new Error(
                        item.type === "pdf"
                            ? "No readable text found in this PDF. OCR could not detect any text."
                            : "No readable text or tables found in this Word document."
                    );
                }

                const workbookData = {
                    id: item.id,
                    originalName: item.file.name,
                    outputName: wordExcelSafeName(item.file.name),
                    rows: extracted.rows,
                    warnings: extracted.warnings || [],
                    scannedPages: extracted.scannedPages || 0
                };

                wordExcelResultsData.push(workbookData);

                wordExcelCreateResult(workbookData);

                successful++;

            } catch (error) {
                console.error(
                    `Conversion error: ${item.file.name}`,
                    error
                );

                failed++;

                wordExcelCreateErrorResult(
                    item.file.name,
                    error.message || "Conversion failed."
                );
            }
        }

    } finally {
        wordExcelResults.style.display = "grid";

        wordExcelShowStatus(
            `Conversion finished. ${successful} successful, ${failed} failed.`,
            failed ? "" : "success"
        );

        wordExcelConvertBtn.disabled = wordExcelFiles.length === 0;
        wordExcelClearBtn.disabled = wordExcelFiles.length === 0;
    }
}

/* =========================================
   RESULT CARDS
   ========================================= */

function wordExcelCreateResult(data) {
    const card = document.createElement("div");
    card.className = "word-excel-result";

    const details = document.createElement("div");
    details.className = "word-excel-result-details";

    const name = document.createElement("strong");
    name.textContent = data.originalName;

    const description = document.createElement("small");

    description.textContent =
        `${data.rows.length} spreadsheet rows extracted` +
        (
            data.scannedPages
                ? ` • OCR used on ${data.scannedPages} scanned page(s)`
                : ""
        );

    details.append(name, description);

    const actions = document.createElement("div");
    actions.className = "word-excel-result-actions";

    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.className = "btn btn-ghost";
    downloadButton.textContent = "Download Excel";

    downloadButton.addEventListener("click", () => {
        wordExcelDownload(data);
    });

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "btn btn-primary";
    editButton.textContent = "Edit spreadsheet";

    editButton.addEventListener("click", () => {
        wordExcelOpenEditor(data);
    });

    actions.append(downloadButton, editButton);
    card.append(details, actions);

    wordExcelResultList.appendChild(card);
}

function wordExcelCreateErrorResult(filename, message) {
    const card = document.createElement("div");
    card.className = "word-excel-result";

    const details = document.createElement("div");
    details.className = "word-excel-result-details";

    const name = document.createElement("strong");
    name.textContent = filename;

    const error = document.createElement("small");
    error.style.color = "#ef4444";
    error.textContent = message;

    details.append(name, error);
    card.appendChild(details);

    wordExcelResultList.appendChild(card);
}

/* =========================================
   CREATE EXCEL WORKBOOK
   ========================================= */

async function wordExcelBuildWorkbook(data) {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = "JScan";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Extracted Data");

    const maxColumns = Math.max(
        1,
        ...data.rows.map(row => row.length)
    );

    const headers = Array.from(
        { length: maxColumns },
        (_, index) => `Column ${index + 1}`
    );

    worksheet.addRow(headers);

    data.rows.forEach(row => {
        worksheet.addRow(row);
    });

    worksheet.getRow(1).font = {
        bold: true,
        size: 12,
        name: "Arial"
    };

    worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDCEAFE" }
    };

    worksheet.columns.forEach(column => {
        column.width = 22;
    });

    worksheet.views = [
        { state: "frozen", ySplit: 1 }
    ];

    worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: maxColumns }
    };

    return workbook;
}

/* =========================================
   DIRECT EXCEL DOWNLOAD
   ========================================= */

async function wordExcelDownload(data) {
    try {
        const workbook = await wordExcelBuildWorkbook(data);

        const buffer = await workbook.xlsx.writeBuffer();

        const blob = new Blob(
            [buffer],
            {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download =
            wordExcelSafeName(data.outputName) + ".xlsx";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);

    } catch (error) {
        console.error(error);
        alert("Unable to create the Excel file.");
    }
}

/* =========================================
   OPEN SPREADSHEET EDITOR
   ========================================= */

function wordExcelOpenEditor(data) {
    currentWorkbookData = {
        ...data,
        rows: data.rows.map(row => [...row])
    };

    currentWorkbookName = data.outputName;

    wordExcelOutputName.value = data.outputName;

    wordExcelRenderSpreadsheet();

    wordExcelEditor.classList.add("active");

    wordExcelEditor.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    wordExcelEditorStatus.textContent =
        "Spreadsheet loaded. Select a cell to edit.";
}

/* =========================================
   RENDER SPREADSHEET
   ========================================= */

function wordExcelRenderSpreadsheet() {
    if (!currentWorkbookData) return;

    wordExcelTableHead.innerHTML = "";
    wordExcelTableBody.innerHTML = "";

    const maxColumns = Math.max(
        1,
        ...currentWorkbookData.rows.map(row => row.length)
    );

    const headerRow = document.createElement("tr");

    const rowNumberHeader = document.createElement("th");
    rowNumberHeader.textContent = "#";

    headerRow.appendChild(rowNumberHeader);

    for (let column = 0; column < maxColumns; column++) {
        const th = document.createElement("th");

        th.textContent = wordExcelColumnName(column);

        headerRow.appendChild(th);
    }

    wordExcelTableHead.appendChild(headerRow);

    currentWorkbookData.rows.forEach((row, rowIndex) => {
        const tr = document.createElement("tr");

        const numberCell = document.createElement("td");
        numberCell.textContent = rowIndex + 1;

        tr.appendChild(numberCell);

        for (let column = 0; column < maxColumns; column++) {
            const td = document.createElement("td");

            td.contentEditable = "true";
            td.spellcheck = true;
            td.textContent = row[column] ?? "";

            td.dataset.row = rowIndex;
            td.dataset.column = column;

            td.addEventListener("focus", () => {
                selectedCell = td;
            });

            td.addEventListener("input", () => {
                currentWorkbookData.rows[rowIndex][column] =
                    td.textContent;

                wordExcelEditorStatus.textContent =
                    "Changes saved in editor.";
            });

            tr.appendChild(td);
        }

        wordExcelTableBody.appendChild(tr);
    });
}

function wordExcelColumnName(index) {
    let name = "";

    while (index >= 0) {
        name = String.fromCharCode((index % 26) + 65) + name;
        index = Math.floor(index / 26) - 1;
    }

    return name;
}

/* =========================================
   EDITOR CONTROLS
   ========================================= */

function wordExcelGetSelectedCells() {
    const active = document.activeElement;

    if (
        active &&
        active.matches("#wordExcelTable td[contenteditable='true']")
    ) {
        selectedCell = active;
    }

    return selectedCell ? [selectedCell] : [];
}

function wordExcelApplyCellStyle(style) {
    const cells = wordExcelGetSelectedCells();

    if (!cells.length) {
        wordExcelEditorStatus.textContent =
            "Select a spreadsheet cell first.";

        return;
    }

    cells.forEach(cell => {
        Object.assign(cell.style, style);
    });

    wordExcelEditorStatus.textContent =
        "Cell formatting updated.";
}

wordExcelFontFamily.addEventListener("change", () => {
    wordExcelApplyCellStyle({
        fontFamily: wordExcelFontFamily.value
    });
});

wordExcelFontSize.addEventListener("change", () => {
    wordExcelApplyCellStyle({
        fontSize: wordExcelFontSize.value + "pt"
    });
});

document.getElementById("wordExcelBoldBtn")
    .addEventListener("click", () => {
        const cell = wordExcelGetSelectedCells()[0];

        if (!cell) return;

        cell.style.fontWeight =
            cell.style.fontWeight === "bold"
                ? "normal"
                : "bold";
    });

document.getElementById("wordExcelItalicBtn")
    .addEventListener("click", () => {
        const cell = wordExcelGetSelectedCells()[0];

        if (!cell) return;

        cell.style.fontStyle =
            cell.style.fontStyle === "italic"
                ? "normal"
                : "italic";
    });

document.getElementById("wordExcelUnderlineBtn")
    .addEventListener("click", () => {
        const cell = wordExcelGetSelectedCells()[0];

        if (!cell) return;

        cell.style.textDecoration =
            cell.style.textDecoration === "underline"
                ? "none"
                : "underline";
    });

/* =========================================
   ADD ROW
   ========================================= */

document.getElementById("wordExcelAddRowBtn")
    .addEventListener("click", () => {
        if (!currentWorkbookData) return;

        const columns = Math.max(
            1,
            ...currentWorkbookData.rows.map(row => row.length)
        );

        currentWorkbookData.rows.push(
            Array(columns).fill("")
        );

        wordExcelRenderSpreadsheet();

        wordExcelEditorStatus.textContent =
            "New row added.";
    });

/* =========================================
   ADD COLUMN
   ========================================= */

document.getElementById("wordExcelAddColumnBtn")
    .addEventListener("click", () => {
        if (!currentWorkbookData) return;

        currentWorkbookData.rows.forEach(row => {
            row.push("");
        });

        wordExcelRenderSpreadsheet();

        wordExcelEditorStatus.textContent =
            "New column added.";
    });

/* =========================================
   CUSTOM FONT UPLOAD
   ========================================= */

wordExcelCustomFont.addEventListener("change", async event => {
    const file = event.target.files[0];

    if (!file) return;

    try {
        const fontName = wordExcelSafeName(file.name);
        const fontUrl = URL.createObjectURL(file);

        const fontFace = new FontFace(
            fontName,
            `url("${fontUrl}")`
        );

        await fontFace.load();

        document.fonts.add(fontFace);

        if (!customFontNames.includes(fontName)) {
            customFontNames.push(fontName);

            const option = document.createElement("option");

            option.value = fontName;
            option.textContent = fontName;

            wordExcelFontFamily.appendChild(option);
        }

        wordExcelFontFamily.value = fontName;

        wordExcelApplyCellStyle({
            fontFamily: fontName
        });

        wordExcelEditorStatus.textContent =
            `Custom font "${fontName}" loaded.`;

    } catch (error) {
        console.error(error);

        wordExcelEditorStatus.textContent =
            "Unable to load this font.";
    }

    event.target.value = "";
});

/* =========================================
   RENAME OUTPUT
   ========================================= */

wordExcelOutputName.addEventListener("input", () => {
    if (!currentWorkbookData) return;

    currentWorkbookData.outputName =
        wordExcelSafeName(wordExcelOutputName.value);
});

/* =========================================
   CLOSE EDITOR
   ========================================= */

document.getElementById("wordExcelCloseEditor")
    .addEventListener("click", () => {
        wordExcelEditor.classList.remove("active");

        currentWorkbookData = null;
        selectedCell = null;
    });

/* =========================================
   PREVIEW SPREADSHEET
   ========================================= */

document.getElementById("wordExcelPreviewBtn")
    .addEventListener("click", () => {
        if (!currentWorkbookData) return;

        const clone = wordExcelTable.cloneNode(true);

        clone.removeAttribute("id");

        clone.querySelectorAll("[contenteditable]").forEach(cell => {
            cell.removeAttribute("contenteditable");
        });

        wordExcelPreviewContent.innerHTML = "";
        wordExcelPreviewContent.appendChild(clone);

        wordExcelPreview.classList.add("active");
    });

document.getElementById("wordExcelClosePreview")
    .addEventListener("click", () => {
        wordExcelPreview.classList.remove("active");
    });

wordExcelPreview.addEventListener("click", event => {
    if (event.target === wordExcelPreview) {
        wordExcelPreview.classList.remove("active");
    }
});

/* =========================================
   DOWNLOAD EDITED EXCEL
   ========================================= */

document.getElementById("wordExcelDownloadBtn")
    .addEventListener("click", async () => {
        if (!currentWorkbookData) return;

        try {
            const workbook = await wordExcelBuildWorkbook(
                currentWorkbookData
            );

            const worksheet = workbook.getWorksheet("Extracted Data");

            const rows = Array.from(
                wordExcelTableBody.querySelectorAll("tr")
            );

            rows.forEach((tr, rowIndex) => {
                const cells = Array.from(
                    tr.querySelectorAll("td")
                ).slice(1);

                cells.forEach((cell, columnIndex) => {
                    const excelCell = worksheet.getCell(
                        rowIndex + 2,
                        columnIndex + 1
                    );

                    excelCell.value = cell.textContent;

                    const computed = window.getComputedStyle(cell);

                    excelCell.font = {
                        name: computed.fontFamily
                            .split(",")[0]
                            .replace(/["']/g, ""),

                        size: parseFloat(computed.fontSize) || 12,

                        bold:
                            computed.fontWeight === "bold" ||
                            Number(computed.fontWeight) >= 600,

                        italic: computed.fontStyle === "italic",

                        underline:
                            computed.textDecorationLine.includes("underline")
                    };
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();

            const blob = new Blob(
                [buffer],
                {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                }
            );

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;

            link.download =
                wordExcelSafeName(wordExcelOutputName.value) + ".xlsx";

            document.body.appendChild(link);

            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(url), 1000);

            wordExcelEditorStatus.textContent =
                "Excel workbook downloaded successfully.";

        } catch (error) {
            console.error(error);

            wordExcelEditorStatus.textContent =
                "Unable to download the Excel workbook.";
        }
    });

/* =========================================
   INITIAL STATE
   ========================================= */

wordExcelUpdateButtons();
