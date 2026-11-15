
/* =========================================
   JSCAN — SPLIT PDF
   File: js/split-pdf.js
========================================= */

(() => {
    "use strict";

    const $ = id => document.getElementById(id);

    const el = {
        input: $("spInput"),
        dropArea: $("spDropArea"),
        fileList: $("spFileList"),
        clearBtn: $("spClearBtn"),
        optionsSection: $("spOptionsSection"),
        rangeWrap: $("spRangeWrap"),
        selectedWrap: $("spSelectedWrap"),
        pageRanges: $("spPageRanges"),
        preview: $("spPreview"),
        previewGrid: $("spPreviewGrid"),
        splitBtn: $("spSplitBtn"),
        status: $("spStatus"),
        results: $("spResults"),
        resultList: $("spResultList")
    };

    const state = {
        files: [],
        selectedFileId: null,
        results: [],
        selectedPages: new Set(),
        nextId: 1,
        isSplitting: false,
        previewTask: 0
    };

    if (window.pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }

    function getMode() {
        return document.querySelector('input[name="spMode"]:checked')?.value || "all";
    }

    function getSelectedFile() {
        return state.files.find(file => file.id === state.selectedFileId);
    }

    function setStatus(message, type = "info") {
        el.status.textContent = message;
        el.status.className = `split-status ${type}`;
    }

    function clearStatus() {
        el.status.textContent = "";
        el.status.className = "split-status";
    }

    function updateInterface() {
        const hasFiles = state.files.length > 0;

        el.clearBtn.disabled = !hasFiles;
        el.optionsSection.style.display = hasFiles ? "block" : "none";
        el.splitBtn.disabled = !hasFiles || state.isSplitting;

        el.rangeWrap.style.display =
            getMode() === "range" ? "block" : "none";

        el.selectedWrap.style.display =
            getMode() === "individual" ? "block" : "none";

        el.preview.classList.toggle("active", hasFiles);

        el.splitBtn.textContent = state.isSplitting
            ? "Splitting..."
            : "Split PDF";
    }

    function formatSize(bytes) {
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }

        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    function getBaseName(filename) {
        return filename.replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|]/g, "_");
    }

    function addFiles(fileList) {
        const incoming = Array.from(fileList || []);
        let added = 0;

        for (const file of incoming) {
            if (
                file.type !== "application/pdf" &&
                !file.name.toLowerCase().endsWith(".pdf")
            ) {
                continue;
            }

            const duplicate = state.files.some(
                item => item.file.name === file.name &&
                    item.file.size === file.size &&
                    item.file.lastModified === file.lastModified
            );

            if (duplicate) continue;

            state.files.push({
                id: state.nextId++,
                file,
                pdfDocument: null,
                pageCount: 0
            });

            added++;
        }

        if (!added && incoming.length) {
            setStatus(
                "No new PDF files were added. Check the file format or duplicates.",
                "error"
            );
        } else if (added) {
            clearStatus();

            if (!state.selectedFileId) {
                state.selectedFileId = state.files[0].id;
            }
        }

        renderFiles();
        updateInterface();

        if (state.selectedFileId) {
            previewFile(state.selectedFileId);
        }
    }

    function renderFiles() {
        el.fileList.innerHTML = "";

        state.files.forEach(item => {
            const container = document.createElement("div");
            container.className = "split-file";

            const info = document.createElement("div");
            info.className = "split-file-info";

            const name = document.createElement("div");
            name.className = "split-file-name";
            name.textContent = item.file.name;

            const meta = document.createElement("div");
            meta.className = "split-file-meta";
            meta.textContent = item.pageCount
                ? `${item.pageCount} pages • ${formatSize(item.file.size)}`
                : formatSize(item.file.size);

            info.append(name, meta);

            const actions = document.createElement("div");
            actions.className = "split-file-actions";

            const previewBtn = document.createElement("button");
            previewBtn.type = "button";
            previewBtn.className = "btn btn-ghost";
            previewBtn.textContent =
                item.id === state.selectedFileId ? "Selected" : "Preview";
            previewBtn.disabled = item.id === state.selectedFileId;

            previewBtn.addEventListener("click", () => {
                state.selectedFileId = item.id;
                state.selectedPages.clear();
                renderFiles();
                previewFile(item.id);
                clearStatus();
            });

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "btn btn-ghost";
            removeBtn.textContent = "Remove";

            removeBtn.addEventListener("click", () => {
                removeFile(item.id);
            });

            actions.append(previewBtn, removeBtn);
            container.append(info, actions);

            el.fileList.appendChild(container);
        });
    }

    function removeFile(id) {
        state.files = state.files.filter(item => item.id !== id);

        if (state.selectedFileId === id) {
            state.selectedFileId = state.files[0]?.id ?? null;
            state.selectedPages.clear();
        }

        renderFiles();
        updateInterface();

        if (state.selectedFileId) {
            previewFile(state.selectedFileId);
        } else {
            state.previewTask++;
            el.previewGrid.innerHTML = "";
        }

        clearStatus();
    }

    async function loadPdf(item) {
        if (item.pdfDocument) {
            return item.pdfDocument;
        }

        if (!window.pdfjsLib) {
            throw new Error(
                "PDF preview library could not be loaded. Refresh the page and try again."
            );
        }

        const data = await item.file.arrayBuffer();

        const pdf = await pdfjsLib.getDocument({
            data: new Uint8Array(data)
        }).promise;

        item.pdfDocument = pdf;
        item.pageCount = pdf.numPages;

        return pdf;
    }

    async function previewFile(id) {
        const item = state.files.find(file => file.id === id);
        if (!item) return;

        const task = ++state.previewTask;

        el.previewGrid.innerHTML = "";
        el.preview.classList.add("active");

        setStatus(`Loading ${item.file.name}...`, "info");

        try {
            const pdf = await loadPdf(item);

            if (task !== state.previewTask) return;

            renderFiles();

            for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
                if (task !== state.previewTask) return;

                const page = await pdf.getPage(pageNumber);
                const viewport = page.getViewport({ scale: 0.5 });

                const card = document.createElement("div");
                card.className = "split-page-card";

                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");

                canvas.width = viewport.width;
                canvas.height = viewport.height;

                const number = document.createElement("div");
                number.className = "split-page-number";
                number.textContent = `Page ${pageNumber}`;

                card.append(canvas);

                if (getMode() === "individual") {
                    const label = document.createElement("label");
                    label.style.display = "block";
                    label.style.marginTop = "7px";
                    label.style.fontSize = "12px";

                    const checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.checked = state.selectedPages.has(pageNumber);

                    checkbox.addEventListener("change", () => {
                        if (checkbox.checked) {
                            state.selectedPages.add(pageNumber);
                        } else {
                            state.selectedPages.delete(pageNumber);
                        }
                    });

                    label.append(
                        checkbox,
                        document.createTextNode(" Select page")
                    );

                    card.append(label);
                }

                card.append(number);
                el.previewGrid.appendChild(card);

                await page.render({
                    canvasContext: context,
                    viewport
                }).promise;
            }

            if (task === state.previewTask) {
                setStatus(
                    `${item.file.name} loaded successfully. ${pdf.numPages} pages available.`,
                    "success"
                );
            }

        } catch (error) {
            console.error("PDF preview error:", error);
            setStatus(
                error.message || "Could not preview this PDF file.",
                "error"
            );
        }
    }

    function refreshPageSelection() {
        const mode = getMode();

        el.rangeWrap.style.display = mode === "range" ? "block" : "none";
        el.selectedWrap.style.display = mode === "individual" ? "block" : "none";

        state.selectedPages.clear();

        const item = getSelectedFile();

        if (item && item.pdfDocument) {
            previewFile(item.id);
        }

        updateInterface();
    }

    function parseRanges(input, pageCount) {
        const parts = input.split(",")
            .map(part => part.trim())
            .filter(Boolean);

        if (!parts.length) {
            throw new Error("Enter at least one page number or range.");
        }

        const ranges = [];

        for (const part of parts) {
            const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);

            if (!match) {
                throw new Error(`Invalid page range: ${part}`);
            }

            const start = Number(match[1]);
            const end = match[2] ? Number(match[2]) : start;

            if (
                start < 1 ||
                end < 1 ||
                start > pageCount ||
                end > pageCount ||
                start > end
            ) {
                throw new Error(
                    `Invalid range "${part}". This PDF has ${pageCount} pages.`
                );
            }

            ranges.push({
                start,
                end,
                pages: Array.from(
                    { length: end - start + 1 },
                    (_, index) => start - 1 + index
                )
            });
        }

        return ranges;
    }

    async function createPdfFromPages(sourcePdf, pageIndexes) {
        const newPdf = await PDFLib.PDFDocument.create();

        const copiedPages = await newPdf.copyPages(
            sourcePdf,
            pageIndexes
        );

        copiedPages.forEach(page => newPdf.addPage(page));

        const bytes = await newPdf.save();

        return new Blob([bytes], {
            type: "application/pdf"
        });
    }

    function addResult(blob, filename, description) {
        const result = {
            blob,
            filename,
            description,
            url: URL.createObjectURL(blob)
        };

        state.results.push(result);
        renderResults();
    }

    // Render results with editable filenames
    function renderResults() {
        el.resultList.innerHTML = "";

        state.results.forEach((result, index) => {
            const row = document.createElement("div");
            row.className = "split-result-item";

            const info = document.createElement("div");
            info.style.flex = "1";
            info.style.minWidth = "200px";

            const label = document.createElement("label");
            label.textContent = "File name";
            label.style.display = "block";
            label.style.fontSize = "12px";
            label.style.marginBottom = "6px";

            const nameInput = document.createElement("input");
            nameInput.type = "text";
            nameInput.value = result.filename.replace(/\.pdf$/i, "");
            nameInput.placeholder = "Enter file name";
            nameInput.style.width = "100%";
            nameInput.style.maxWidth = "400px";
            nameInput.style.padding = "10px";
            nameInput.style.border = "1px solid var(--border)";
            nameInput.style.borderRadius = "8px";
            nameInput.style.background = "var(--background)";
            nameInput.style.color = "var(--text)";

            nameInput.addEventListener("input", () => {
                result.filename = nameInput.value.trim();
            });

            const meta = document.createElement("div");
            meta.className = "split-result-meta";
            meta.textContent =
                `${result.description} • ${formatSize(result.blob.size)}`;

            info.append(label, nameInput, meta);

            const downloadBtn = document.createElement("button");
            downloadBtn.type = "button";
            downloadBtn.className = "btn btn-primary";
            downloadBtn.textContent = "Download";

            downloadBtn.addEventListener("click", () => {
                result.filename = nameInput.value.trim();
                downloadResult(index);
            });

            row.append(info, downloadBtn);
            el.resultList.appendChild(row);
        });

        el.results.classList.toggle("active", state.results.length > 0);
    }

    // Download using the edited filename
    function downloadResult(index) {
        const result = state.results[index];
        if (!result) return;

        let filename = result.filename.trim();

        if (!filename) {
            setStatus(
                "Please enter a filename before downloading.",
                "error"
            );
            return;
        }

        filename = filename
            .replace(/\.pdf$/i, "")
            .replace(/[\\/:*?"<>|]/g, "_")
            .trim();

        if (!filename) {
            setStatus("Please enter a valid filename.", "error");
            return;
        }

        result.filename = filename + ".pdf";

        const link = document.createElement("a");
        link.href = result.url;
        link.download = result.filename;

        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    async function splitSelectedFile() {
        if (state.isSplitting) return;

        const item = getSelectedFile();

        if (!item) {
            setStatus("Upload and select a PDF file first.", "error");
            return;
        }

        if (!window.PDFLib) {
            setStatus(
                "PDF processing library could not be loaded. Refresh the page and try again.",
                "error"
            );
            return;
        }

        state.isSplitting = true;
        updateInterface();
        clearStatus();

        try {
            const pdfData = await item.file.arrayBuffer();

            const sourcePdf = await PDFLib.PDFDocument.load(pdfData);
            const pageCount = sourcePdf.getPageCount();

            const baseName = getBaseName(item.file.name);
            const mode = getMode();

            let created = 0;

            if (mode === "all") {
                for (let page = 0; page < pageCount; page++) {
                    setStatus(
                        `Extracting page ${page + 1} of ${pageCount}...`,
                        "info"
                    );

                    const blob = await createPdfFromPages(
                        sourcePdf,
                        [page]
                    );

                    addResult(
                        blob,
                        `${baseName}_page_${page + 1}.pdf`,
                        `Page ${page + 1}`
                    );

                    created++;
                }
            }

            else if (mode === "range") {
                const ranges = parseRanges(
                    el.pageRanges.value,
                    pageCount
                );

                for (let index = 0; index < ranges.length; index++) {
                    const range = ranges[index];

                    setStatus(
                        `Creating document ${index + 1} of ${ranges.length}...`,
                        "info"
                    );

                    const blob = await createPdfFromPages(
                        sourcePdf,
                        range.pages
                    );

                    const label = range.start === range.end
                        ? `Page ${range.start}`
                        : `Pages ${range.start}-${range.end}`;

                    addResult(
                        blob,
                        `${baseName}_${range.start}-${range.end}.pdf`,
                        label
                    );

                    created++;
                }
            }

            else if (mode === "individual") {
                const pages = Array.from(state.selectedPages)
                    .sort((a, b) => a - b);

                if (!pages.length) {
                    throw new Error(
                        "Select at least one page from the preview."
                    );
                }

                const pageIndexes = pages.map(page => page - 1);

                setStatus(
                    "Creating your selected-pages PDF...",
                    "info"
                );

                const blob = await createPdfFromPages(
                    sourcePdf,
                    pageIndexes
                );

                addResult(
                    blob,
                    `${baseName}_selected_pages.pdf`,
                    `${pages.length} selected page(s)`
                );

                created++;
            }

            setStatus(
                `Successfully created ${created} PDF file(s) from ${item.file.name}. You can now rename each file before downloading.`,
                "success"
            );

            el.results.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        } catch (error) {
            console.error("Split PDF error:", error);

            setStatus(
                error.message ||
                "Something went wrong while splitting the PDF.",
                "error"
            );

        } finally {
            state.isSplitting = false;
            updateInterface();
        }
    }

    function clearAll() {
        state.files = [];
        state.selectedFileId = null;
        state.selectedPages.clear();
        state.previewTask++;

        state.results.forEach(result => {
            URL.revokeObjectURL(result.url);
        });

        state.results = [];

        el.input.value = "";
        el.pageRanges.value = "";
        el.fileList.innerHTML = "";
        el.previewGrid.innerHTML = "";
        el.resultList.innerHTML = "";

        el.results.classList.remove("active");
        el.preview.classList.remove("active");

        clearStatus();
        updateInterface();
    }

    // File upload
    el.input.addEventListener("change", event => {
        addFiles(event.target.files);
        el.input.value = "";
    });

    // Drag and drop
    el.dropArea.addEventListener("dragover", event => {
        event.preventDefault();
        el.dropArea.classList.add("dragover");
    });

    el.dropArea.addEventListener("dragleave", () => {
        el.dropArea.classList.remove("dragover");
    });

    el.dropArea.addEventListener("drop", event => {
        event.preventDefault();
        el.dropArea.classList.remove("dragover");
        addFiles(event.dataTransfer.files);
    });

    // Split mode
    document.querySelectorAll('input[name="spMode"]').forEach(radio => {
        radio.addEventListener("change", refreshPageSelection);
    });

    // Buttons
    el.clearBtn.addEventListener("click", clearAll);
    el.splitBtn.addEventListener("click", splitSelectedFile);

    // Initial state
    updateInterface();

})();
