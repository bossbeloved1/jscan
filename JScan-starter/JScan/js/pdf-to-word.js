
const API_URL = "http://localhost:8000/pdf-to-word";

const pdfInput = document.getElementById("pdfWordInput");
const dropArea = document.getElementById("pdfWordDropArea");
const fileList = document.getElementById("pdfWordFileList");
const convertBtn = document.getElementById("pdfWordConvertBtn");
const clearBtn = document.getElementById("pdfWordClearBtn");
const statusBox = document.getElementById("pdfWordStatus");
const resultsBox = document.getElementById("pdfWordResults");

const editor = document.getElementById("pdfWordEditor");
const documentArea = document.getElementById("pdfWordDocument");
const outputName = document.getElementById("pdfWordOutputName");
const fontFamily = document.getElementById("pdfWordFontFamily");
const fontSize = document.getElementById("pdfWordFontSize");
const customFontInput = document.getElementById("pdfWordCustomFont");
const editorStatus = document.getElementById("pdfWordEditorStatus");

const viewer = document.getElementById("pdfWordViewer");
const viewerTitle = document.getElementById("pdfWordViewerTitle");
const viewerContent = document.getElementById("pdfWordViewerContent");

let selectedFiles = [];
let isConverting = false;
let currentDocument = null;
let savedSelection = null;
let customFonts = [];
let previewUrls = [];

if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

/* ------------------------------
   GENERAL HELPERS
------------------------------ */

function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileNameWithoutExtension(filename) {
    return filename.replace(/\.pdf$/i, "");
}

function showStatus(message, type = "info") {
    statusBox.textContent = message;
    statusBox.className = `pdf-word-status ${type}`;
    statusBox.style.display = "block";
}

function clearStatus() {
    statusBox.textContent = "";
    statusBox.style.display = "none";
}

function updateButtons() {
    convertBtn.disabled = selectedFiles.length === 0 || isConverting;
    clearBtn.disabled = selectedFiles.length === 0 || isConverting;
}

function revokePreviewUrls() {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    previewUrls = [];
}

/* ------------------------------
   PDF THUMBNAILS
------------------------------ */

async function createThumbnail(file, canvas) {
    if (!window.pdfjsLib) {
        throw new Error("PDF preview library could not be loaded.");
    }

    const data = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.35 });

    const context = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
        canvasContext: context,
        viewport
    }).promise;

    await pdf.destroy();
}

/* ------------------------------
   FILE LIST
------------------------------ */

function renderFileList() {
    fileList.replaceChildren();

    selectedFiles.forEach((item, index) => {
        const card = document.createElement("div");
        card.className = "pdf-word-file";

        const thumbnail = document.createElement("div");
        thumbnail.className = "pdf-word-thumbnail";
        thumbnail.title = "Click to preview PDF";

        const canvas = document.createElement("canvas");
        const placeholder = document.createElement("span");

        placeholder.className = "pdf-word-thumbnail-placeholder";
        placeholder.textContent = "Loading preview...";

        thumbnail.append(placeholder, canvas);

        createThumbnail(item.file, canvas)
            .then(() => placeholder.remove())
            .catch(error => {
                console.error(error);
                canvas.remove();
                placeholder.textContent = "Preview unavailable";
            });

        thumbnail.addEventListener("click", () => {
            openPDFViewer(item.file);
        });

        const information = document.createElement("div");
        information.className = "pdf-word-file-info";

        const name = document.createElement("strong");
        name.textContent = item.file.name;

        const size = document.createElement("small");
        size.textContent = formatFileSize(item.file.size);

        information.append(name, size);

        const actions = document.createElement("div");
        actions.className = "pdf-word-file-actions";

        const viewBtn = document.createElement("button");
        viewBtn.type = "button";
        viewBtn.textContent = "View PDF";
        viewBtn.addEventListener("click", () => {
            openPDFViewer(item.file);
        });

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "remove";
        removeBtn.textContent = "Remove";
        removeBtn.disabled = isConverting;

        removeBtn.addEventListener("click", () => {
            if (isConverting) return;

            selectedFiles.splice(index, 1);
            renderFileList();
            updateButtons();
            clearStatus();
        });

        actions.append(viewBtn, removeBtn);

        card.append(thumbnail, information, actions);
        fileList.appendChild(card);
    });

    updateButtons();
}

/* ------------------------------
   ADD FILES
------------------------------ */

function addFiles(files) {
    let added = 0;
    let rejected = 0;

    Array.from(files).forEach(file => {
        const isPDF =
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf");

        if (!isPDF || !file.name.toLowerCase().endsWith(".pdf")) {
            rejected++;
            return;
        }

        if (file.size === 0) {
            rejected++;
            return;
        }

        const duplicate = selectedFiles.some(item =>
            item.file.name === file.name &&
            item.file.size === file.size &&
            item.file.lastModified === file.lastModified
        );

        if (!duplicate) {
            selectedFiles.push({ file });
            added++;
        }
    });

    renderFileList();

    if (rejected > 0) {
        showStatus(
            `${rejected} file(s) were skipped. Select valid PDF files.`,
            "error"
        );
    } else if (added > 0) {
        showStatus(`${added} PDF file(s) added successfully.`, "success");
    } else {
        showStatus("No new PDF files were added.", "info");
    }

    pdfInput.value = "";
}

pdfInput.addEventListener("change", event => {
    addFiles(event.target.files);
});

dropArea.addEventListener("dragover", event => {
    event.preventDefault();
    dropArea.classList.add("drag-over");
});

dropArea.addEventListener("dragleave", event => {
    if (!dropArea.contains(event.relatedTarget)) {
        dropArea.classList.remove("drag-over");
    }
});

dropArea.addEventListener("drop", event => {
    event.preventDefault();
    dropArea.classList.remove("drag-over");

    if (!isConverting) {
        addFiles(event.dataTransfer.files);
    }
});

/* ------------------------------
   CLEAR ALL
------------------------------ */

clearBtn.addEventListener("click", () => {
    if (isConverting) return;

    selectedFiles = [];

    renderFileList();
    clearStatus();

    resultsBox.style.display = "none";
    resultsBox.replaceChildren();

    closeEditor();
    closeViewer();
    revokePreviewUrls();

    showStatus("All selected files have been cleared.", "info");
});

/* ------------------------------
   PDF VIEWER
------------------------------ */

async function openPDFViewer(file) {
    if (!window.pdfjsLib) {
        showStatus("PDF preview library is unavailable.", "error");
        return;
    }

    viewerTitle.textContent = file.name;
    viewerContent.replaceChildren();

    const loading = document.createElement("p");
    loading.textContent = "Loading PDF preview...";
    viewerContent.appendChild(loading);

    viewer.classList.add("active");

    try {
        const data = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data }).promise;

        viewerContent.replaceChildren();

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 1.2 });

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context,
                viewport
            }).promise;

            viewerContent.appendChild(canvas);
        }

        await pdf.destroy();

    } catch (error) {
        console.error(error);
        viewerContent.textContent = "Unable to preview this PDF.";
    }
}

function closeViewer() {
    viewer.classList.remove("active");
    viewerContent.replaceChildren();
}

document.getElementById("pdfWordCloseViewer")
    .addEventListener("click", closeViewer);

viewer.addEventListener("click", event => {
    if (event.target === viewer) {
        closeViewer();
    }
});


/* ------------------------------
   CONVERSION RESULTS
------------------------------ */

function createResultRow(file, blob, error = null) {
    const row = document.createElement("div");
    row.className = "pdf-word-result";

    const details = document.createElement("div");
    details.className = "pdf-word-result-details";

    const name = document.createElement("strong");
    name.textContent = `${getFileNameWithoutExtension(file.name)}.docx`;

    const message = document.createElement("small");
    message.textContent = error
        ? `Conversion failed: ${error}`
        : "Conversion completed successfully.";

    details.append(name, message);
    row.appendChild(details);

    if (blob) {
        // Direct download button
        const downloadBtn = document.createElement("button");
        downloadBtn.type = "button";
        downloadBtn.className = "btn btn-primary";
        downloadBtn.textContent = "Download DOCX";

        downloadBtn.addEventListener("click", () => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download = `${getFileNameWithoutExtension(file.name)}.docx`;

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });

        // Edit button
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "btn btn-secondary";
        editBtn.textContent = "Edit document";

        editBtn.addEventListener("click", () => {
            openEditor(blob, file.name);
        });

        const actions = document.createElement("div");
        actions.className = "pdf-word-result-actions";
actions.style.display = "flex";
actions.style.gap = "12px";
actions.style.flexWrap = "wrap";

        actions.append(downloadBtn, editBtn);
        row.appendChild(actions);
    }

    resultsBox.appendChild(row);
}


/* ------------------------------
   PDF TO WORD CONVERSION
------------------------------ */

async function convertSinglePDF(file, index, total) {
    showStatus(
        `Converting ${index + 1} of ${total}: ${file.name}`,
        "info"
    );

    const formData = new FormData();
    formData.append("file", file, file.name);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            let message = "Conversion failed.";

            try {
                const errorData = await response.json();
                message = errorData.detail || message;
            } catch {
                // Keep default message.
            }

            throw new Error(message);
        }

        const blob = await response.blob();

        if (!blob.size) {
            throw new Error("The conversion returned an empty file.");
        }

        if (
            blob.type &&
            blob.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
            blob.type !== "application/octet-stream"
        ) {
            throw new Error("The server did not return a valid DOCX file.");
        }

        createResultRow(file, blob);

        return { success: true };

    } catch (error) {
        console.error(`PDF-to-Word error (${file.name}):`, error);

        createResultRow(file, null, error.message);

        return { success: false };
    }
}

convertBtn.addEventListener("click", async () => {
    if (isConverting || selectedFiles.length === 0) return;

    isConverting = true;

    const filesToConvert = selectedFiles.map(item => item.file);
    const total = filesToConvert.length;

    resultsBox.replaceChildren();

    const heading = document.createElement("h3");
    heading.textContent = "Conversion results";

    resultsBox.appendChild(heading);
    resultsBox.style.display = "grid";

    renderFileList();

    let successful = 0;
    let failed = 0;

    for (let index = 0; index < total; index++) {
        const result = await convertSinglePDF(
            filesToConvert[index],
            index,
            total
        );

        if (result.success) {
            successful++;
        } else {
            failed++;
        }
    }

    isConverting = false;

    renderFileList();

    if (failed === 0) {
        showStatus(
            `All ${successful} PDF file(s) converted successfully. You can now edit each document.`,
            "success"
        );
    } else {
        showStatus(
            `Conversion finished: ${successful} successful, ${failed} failed.`,
            "error"
        );
    }
});

/* ------------------------------
   DOCUMENT EDITOR
------------------------------ */

async function openEditor(blob, originalFilename) {
    if (!window.mammoth) {
        showStatus("Document preview library could not be loaded.", "error");
        return;
    }

    showStatus("Preparing your editable document...", "info");

    try {
        const arrayBuffer = await blob.arrayBuffer();

        const result = await mammoth.convertToHtml(
            { arrayBuffer },
            {
                styleMap: [
                    "p[style-name='Title'] => h1:fresh",
                    "p[style-name='Heading 1'] => h1:fresh",
                    "p[style-name='Heading 2'] => h2:fresh"
                ]
            }
        );

        documentArea.innerHTML = sanitizeDocumentHTML(result.value);

        if (!documentArea.innerHTML.trim()) {
            documentArea.innerHTML = "<p>Start editing your document here.</p>";
        }

        currentDocument = {
            blob,
            originalFilename
        };

        outputName.value = getFileNameWithoutExtension(originalFilename);

        editor.classList.add("active");

        editorStatus.textContent = "Document ready to edit.";

        editor.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        showStatus("Document opened successfully.", "success");

    } catch (error) {
        console.error(error);
        showStatus("Unable to open the converted document.", "error");
    }
}

/* Remove unsafe elements and attributes from imported document HTML. */
function sanitizeDocumentHTML(html) {
    const parsed = new DOMParser().parseFromString(html, "text/html");

    parsed.querySelectorAll(
        "script, iframe, object, embed, form, input, button"
    ).forEach(element => element.remove());

    parsed.body.querySelectorAll("*").forEach(element => {
        Array.from(element.attributes).forEach(attribute => {
            const name = attribute.name.toLowerCase();
            const value = attribute.value.trim().toLowerCase();

            if (name.startsWith("on")) {
                element.removeAttribute(attribute.name);
            }

            if (
                (name === "href" || name === "src") &&
                value.startsWith("javascript:")
            ) {
                element.removeAttribute(attribute.name);
            }
        });
    });

    return parsed.body.innerHTML;
}

function closeEditor() {
    editor.classList.remove("active");
    currentDocument = null;
}

document.getElementById("pdfWordCloseEditor")
    .addEventListener("click", closeEditor);

/* ------------------------------
   EDITING TOOLBAR
------------------------------ */

function saveSelection() {
    const selection = window.getSelection();

    if (
        selection &&
        selection.rangeCount &&
        documentArea.contains(selection.anchorNode)
    ) {
        savedSelection = selection.getRangeAt(0).cloneRange();
    }
}

function restoreSelection() {
    if (!savedSelection) return;

    const selection = window.getSelection();

    selection.removeAllRanges();
    selection.addRange(savedSelection);
}

documentArea.addEventListener("mouseup", saveSelection);
documentArea.addEventListener("keyup", saveSelection);

document.getElementById("pdfWordToolbar")
    .addEventListener("mousedown", event => {
        if (event.target.closest("button")) {
            event.preventDefault();
            saveSelection();
        }
    });

document.querySelectorAll("[data-editor-command]")
    .forEach(button => {
        button.addEventListener("click", () => {
            documentArea.focus();
            restoreSelection();

            document.execCommand(
                button.dataset.editorCommand,
                false,
                null
            );

            saveSelection();
            editorStatus.textContent = "Document formatting updated.";
        });
    });

fontFamily.addEventListener("change", () => {
    documentArea.focus();
    restoreSelection();

    document.execCommand("fontName", false, fontFamily.value);

    saveSelection();
});

fontSize.addEventListener("change", () => {
    documentArea.focus();
    restoreSelection();

    const selection = window.getSelection();

    if (!selection || selection.isCollapsed) {
        editorStatus.textContent = "Select some text before changing its size.";
        return;
    }

    const range = selection.getRangeAt(0);

    const span = document.createElement("span");
    span.style.fontSize = `${fontSize.value}pt`;

    try {
        span.appendChild(range.extractContents());
        range.insertNode(span);

        selection.removeAllRanges();

        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        selection.addRange(newRange);

        saveSelection();
        editorStatus.textContent = "Font size updated.";

    } catch (error) {
        console.error(error);
    }
});

/* ------------------------------
   CUSTOM FONT UPLOAD
------------------------------ */

customFontInput.addEventListener("change", async event => {
    const file = event.target.files[0];

    if (!file) return;

    const extension = file.name.split(".").pop().toLowerCase();

    if (!["ttf", "otf", "woff", "woff2"].includes(extension)) {
        showStatus("Please select a supported font file.", "error");
        customFontInput.value = "";
        return;
    }

    const fontName = file.name.replace(/\.[^.]+$/, "");

    try {
        const fontUrl = URL.createObjectURL(file);

        const fontFace = new FontFace(
            fontName,
            `url("${fontUrl}")`
        );

        await fontFace.load();

        document.fonts.add(fontFace);

        customFonts.push({
            name: fontName,
            url: fontUrl
        });

        const option = document.createElement("option");
        option.value = fontName;
        option.textContent = `${fontName} (Custom)`;

        fontFamily.appendChild(option);
        fontFamily.value = fontName;

        documentArea.focus();
        restoreSelection();

        document.execCommand("fontName", false, fontName);

        saveSelection();

        showStatus(
            `${fontName} font loaded successfully for this editing session.`,
            "success"
        );

    } catch (error) {
        console.error(error);
        showStatus("Unable to load this font file.", "error");
    }

    customFontInput.value = "";
});

/* ------------------------------
   DOCUMENT PREVIEW
------------------------------ */

document.getElementById("pdfWordPreviewBtn")
    .addEventListener("click", () => {
        viewerTitle.textContent = "Document preview";

        const preview = documentArea.cloneNode(true);
        preview.removeAttribute("contenteditable");
        preview.removeAttribute("id");

        preview.style.margin = "0 auto";
        preview.style.maxWidth = "794px";
        preview.style.minHeight = "auto";
        preview.style.width = "100%";
        preview.style.padding = "40px";
        preview.style.background = "white";
        preview.style.color = "#222";

        viewerContent.replaceChildren(preview);
        viewer.classList.add("active");
    });

/* ------------------------------
   DOWNLOAD DOCX
------------------------------ */

document.getElementById("pdfWordDownloadBtn")
    .addEventListener("click", () => {
        if (!currentDocument) {
            showStatus("Open a converted document first.", "error");
            return;
        }

        if (!window.htmlDocx) {
            showStatus(
                "DOCX export library is not loaded. Please check the HTML script imports.",
                "error"
            );
            return;
        }

        const name = outputName.value.trim();

        if (!name) {
            showStatus("Please enter a document name.", "error");
            outputName.focus();
            return;
        }

        try {
            const content = documentArea.innerHTML;

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            font-size: 12pt;
                            line-height: 1.6;
                        }

                        p { margin: 0 0 10pt; }

                        table {
                            border-collapse: collapse;
                            width: 100%;
                        }

                        td, th {
                            border: 1px solid #999;
                            padding: 6px;
                        }
                    </style>
                </head>
                <body>${content}</body>
                </html>
            `;

            const docxBlob = window.htmlDocx.asBlob(html);

            const url = URL.createObjectURL(docxBlob);
            const link = document.createElement("a");

            link.href = url;
            link.download = `${name.replace(/\.docx$/i, "")}.docx`;

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(url), 1000);

            editorStatus.textContent = "DOCX download started.";

        } catch (error) {
            console.error(error);
            showStatus("Unable to create the edited Word document.", "error");
        }
    });
