
document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("pdfImageFileInput");
    const status = document.getElementById("pdfImageStatus");
    const workspace = document.getElementById("pdfImageWorkspace");
    const fileInfo = document.getElementById("pdfImageFileInfo");
    const formatSelect = document.getElementById("pdfImageFormat");
    const zipFilenameInput = document.getElementById("pdfImageZipFilename");
    const convertBtn = document.getElementById("pdfImageConvertBtn");
    const resetBtn = document.getElementById("pdfImageResetBtn");
    const resultsArea = document.getElementById("pdfImageResults");
    const resultInfo = document.getElementById("pdfImageResultInfo");
    const imageGrid = document.getElementById("pdfImageGrid");
    const progress = document.getElementById("pdfImageProgress");
    const progressBar = document.getElementById("pdfImageProgressBar");

    const selectAllCheckbox = document.getElementById("pdfImageSelectAll");
    const selectedCount = document.getElementById("pdfImageSelectedCount");

    const downloadSelectedBtn = document.getElementById("pdfImageDownloadSelectedBtn");
    const downloadAllBtn = document.getElementById("pdfImageDownloadAllBtn");
    const downloadSingleZipBtn = document.getElementById("pdfImageDownloadSingleZipBtn");

    let selectedFile = null;
    let pdfDocument = null;
    let convertedImages = [];
    let isConverting = false;
    let isDownloading = false;

    const PDFJS_WORKER =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    if (typeof pdfjsLib !== "undefined") {
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    }

    function sanitizeFilename(value, fallback) {
        return (value || "")
            .trim()
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
            .replace(/\.+$/g, "")
            .trim() || fallback;
    }

    function updateStatus(message) {
        status.textContent = message;
    }

    function getFormat() {
        return formatSelect.value === "png" ? "png" : "jpeg";
    }

    function getMimeType() {
        return getFormat() === "png" ? "image/png" : "image/jpeg";
    }

    function getExtension() {
        return getFormat() === "png" ? "png" : "jpg";
    }

    function getSelectedImages() {
        return convertedImages.filter(image => image.selected);
    }

    function updateSelectionControls() {
        const selected = getSelectedImages();
        const total = convertedImages.length;

        selectedCount.textContent =
            `${selected.length} of ${total} image(s) selected`;

        selectAllCheckbox.checked = total > 0 && selected.length === total;
        selectAllCheckbox.indeterminate =
            selected.length > 0 && selected.length < total;

        downloadSelectedBtn.disabled =
            selected.length === 0 || isDownloading || isConverting;

        downloadAllBtn.disabled =
            total === 0 || isDownloading || isConverting;

        downloadSingleZipBtn.disabled =
            total !== 1 || isDownloading || isConverting;
    }

    function updateProgress(current, total) {
        const percentage = total > 0
            ? Math.round((current / total) * 100)
            : 0;

        progressBar.style.width = `${percentage}%`;

        resultInfo.textContent =
            `Converting page ${current} of ${total} (${percentage}%).`;
    }

    function clearConvertedImages() {
        convertedImages.forEach(image => {
            if (image.previewUrl) {
                URL.revokeObjectURL(image.previewUrl);
            }
        });

        convertedImages = [];
        imageGrid.innerHTML = "";

        updateSelectionControls();
    }

    // LOAD PDF
    fileInput.addEventListener("change", async () => {
        if (isConverting || isDownloading) return;

        const file = fileInput.files[0];

        if (!file) return;

        if (
            file.type !== "application/pdf" &&
            !file.name.toLowerCase().endsWith(".pdf")
        ) {
            updateStatus("Please select a valid PDF document.");
            fileInput.value = "";
            return;
        }

        if (typeof pdfjsLib === "undefined") {
            updateStatus(
                "PDF rendering library failed to load. Check your internet connection."
            );
            fileInput.value = "";
            return;
        }

        selectedFile = file;
        pdfDocument = null;

        clearConvertedImages();

        resultsArea.style.display = "none";
        workspace.style.display = "block";

        convertBtn.disabled = true;
        updateSelectionControls();

        updateStatus("Loading your PDF document...");
        fileInfo.textContent = "Reading PDF information...";

        zipFilenameInput.value =
            file.name.replace(/\.pdf$/i, "") || "JScan-PDF-Images";

        try {
            const arrayBuffer = await file.arrayBuffer();

            pdfDocument = await pdfjsLib.getDocument({
                data: new Uint8Array(arrayBuffer)
            }).promise;

            fileInfo.textContent =
                `File: ${file.name} | Pages: ${pdfDocument.numPages} | Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`;

            convertBtn.disabled = false;

            updateStatus(
                "PDF loaded successfully. Choose an image format and convert."
            );

            workspace.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        } catch (error) {
            console.error("PDF loading error:", error);

            selectedFile = null;
            pdfDocument = null;

            fileInfo.textContent = "Unable to read this PDF document.";

            updateStatus(
                "Unable to open this PDF. Please try another file."
            );

            convertBtn.disabled = true;
        }
    });

    // CONVERT PDF TO IMAGES
    convertBtn.addEventListener("click", async () => {
        if (!selectedFile || !pdfDocument || isConverting || isDownloading) {
            updateStatus("Please upload a valid PDF document first.");
            return;
        }

        if (typeof JSZip === "undefined") {
            updateStatus("ZIP library failed to load. Check your internet connection.");
            return;
        }

        isConverting = true;

        clearConvertedImages();

        resultsArea.style.display = "block";
        progress.style.display = "block";
        progressBar.style.width = "0%";

        convertBtn.disabled = true;
        resetBtn.disabled = true;
        fileInput.disabled = true;
        formatSelect.disabled = true;

        convertBtn.textContent = "Converting...";

        const extension = getExtension();
        const mimeType = getMimeType();
        const totalPages = pdfDocument.numPages;

        updateStatus("Preparing your PDF pages...");

        try {
            for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
                const page = await pdfDocument.getPage(pageNumber);

                const viewport = page.getViewport({ scale: 2 });

                const canvas = document.createElement("canvas");

                const context = canvas.getContext("2d", {
                    alpha: extension === "png"
                });

                if (!context) {
                    throw new Error("Unable to create an image canvas.");
                }

                canvas.width = Math.ceil(viewport.width);
                canvas.height = Math.ceil(viewport.height);

                if (extension === "jpg") {
                    context.fillStyle = "#ffffff";
                    context.fillRect(0, 0, canvas.width, canvas.height);
                }

                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

                const blob = await new Promise((resolve, reject) => {
                    canvas.toBlob(
                        result => {
                            if (result) {
                                resolve(result);
                            } else {
                                reject(
                                    new Error(`Could not create image for page ${pageNumber}.`)
                                );
                            }
                        },
                        mimeType,
                        extension === "jpg" ? 0.92 : undefined
                    );
                });

                const previewUrl = URL.createObjectURL(blob);

                convertedImages.push({
                    pageNumber,
                    blob,
                    previewUrl,
                    filename: `page-${pageNumber}.${extension}`,
                    selected: true
                });

                canvas.width = 0;
                canvas.height = 0;

                updateProgress(pageNumber, totalPages);

                await new Promise(resolve => setTimeout(resolve, 0));
            }

            renderImagePreviews();

            resultInfo.textContent =
                `Successfully converted all ${totalPages} PDF page(s).`;

            updateStatus(
                "Conversion successful! Select the images you want and rename them before downloading."
            );

            updateSelectionControls();

            resultsArea.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        } catch (error) {
            console.error("PDF-to-Image conversion error:", error);

            clearConvertedImages();

            resultsArea.style.display = "none";

            updateStatus(
                "Conversion failed: " + (error.message || "Please try again.")
            );

        } finally {
            isConverting = false;

            convertBtn.disabled = !pdfDocument;
            resetBtn.disabled = false;
            fileInput.disabled = false;
            formatSelect.disabled = false;

            convertBtn.textContent = "Convert to Images";

            updateSelectionControls();
        }
    });

    // DISPLAY IMAGE PREVIEWS
    function renderImagePreviews() {
        imageGrid.innerHTML = "";

        convertedImages.forEach((image, index) => {
            const card = document.createElement("div");
            card.className = "pdf-image-card";

            const header = document.createElement("div");
            header.className = "pdf-image-card-header";

            const title = document.createElement("h3");
            title.textContent = `Page ${image.pageNumber}`;

            const selectLabel = document.createElement("label");
            selectLabel.className = "pdf-image-card-select";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = image.selected;
            checkbox.setAttribute(
                "aria-label",
                `Select page ${image.pageNumber}`
            );

            checkbox.addEventListener("change", () => {
                convertedImages[index].selected = checkbox.checked;
                updateSelectionControls();
            });

            selectLabel.appendChild(checkbox);
            selectLabel.appendChild(document.createTextNode("Select"));

            header.appendChild(title);
            header.appendChild(selectLabel);

            const preview = document.createElement("div");
            preview.className = "pdf-image-preview";

            const img = document.createElement("img");
            img.src = image.previewUrl;
            img.alt = `Converted PDF page ${image.pageNumber}`;

            preview.appendChild(img);

            const body = document.createElement("div");
            body.className = "pdf-image-card-body";

            const label = document.createElement("label");
            label.textContent = "Image filename";

            const filenameInput = document.createElement("input");
            filenameInput.type = "text";
            filenameInput.className = "pdf-image-filename";
            filenameInput.value = image.filename.replace(/\.[^.]+$/, "");

            filenameInput.addEventListener("input", () => {
                convertedImages[index].filename =
                    sanitizeFilename(
                        filenameInput.value,
                        `page-${image.pageNumber}`
                    ) + `.${getExtension()}`;
            });

            const extensionText = document.createElement("div");
            extensionText.className = "pdf-image-extension";
            extensionText.textContent = `File extension: .${getExtension()}`;

            const actions = document.createElement("div");
            actions.className = "pdf-image-card-actions";

            const downloadBtn = document.createElement("button");
            downloadBtn.type = "button";
            downloadBtn.className = "btn btn-ghost";
            downloadBtn.textContent = "Download Image";

            downloadBtn.addEventListener("click", () => {
                if (isDownloading || isConverting) return;

                convertedImages[index].filename =
                    sanitizeFilename(
                        filenameInput.value,
                        `page-${image.pageNumber}`
                    ) + `.${getExtension()}`;

                downloadImage(convertedImages[index]);
            });

            actions.appendChild(downloadBtn);

            body.appendChild(label);
            body.appendChild(filenameInput);
            body.appendChild(extensionText);
            body.appendChild(actions);

            card.appendChild(header);
            card.appendChild(preview);
            card.appendChild(body);

            imageGrid.appendChild(card);
        });

        updateSelectionControls();
    }

    // SELECT OR DESELECT ALL
    selectAllCheckbox.addEventListener("change", () => {
        if (isConverting || isDownloading) return;

        convertedImages.forEach(image => {
            image.selected = selectAllCheckbox.checked;
        });

        imageGrid.querySelectorAll(".pdf-image-card-select input").forEach(
            checkbox => {
                checkbox.checked = selectAllCheckbox.checked;
            }
        );

        updateSelectionControls();
    });

    // DOWNLOAD ONE IMAGE
    function downloadImage(image) {
        const downloadUrl = URL.createObjectURL(image.blob);

        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = image.filename;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
    }

    // READ ALL EDITED FILENAMES
    function updateAllFilenames() {
        const filenameInputs = imageGrid.querySelectorAll(
            ".pdf-image-filename"
        );

        filenameInputs.forEach((input, index) => {
            const image = convertedImages[index];

            image.filename =
                sanitizeFilename(
                    input.value,
                    `page-${image.pageNumber}`
                ) + `.${getExtension()}`;
        });
    }

    // DOWNLOAD SELECTED IMAGES
    downloadSelectedBtn.addEventListener("click", async () => {
        if (isDownloading || isConverting) return;

        const selected = getSelectedImages();

        if (!selected.length) {
            updateStatus("Please select at least one image to download.");
            return;
        }

        await downloadImagesAsZip(selected);
    });

    // DOWNLOAD ALL IMAGES
    downloadAllBtn.addEventListener("click", async () => {
        if (isDownloading || isConverting || !convertedImages.length) return;

        await downloadImagesAsZip(convertedImages);
    });

    // SINGLE PAGE ZIP DOWNLOAD
    downloadSingleZipBtn.addEventListener("click", async () => {
        if (
            isDownloading ||
            isConverting ||
            convertedImages.length !== 1
        ) return;

        await downloadImagesAsZip(convertedImages);
    });

    // CREATE ZIP FILE
    async function downloadImagesAsZip(imagesToDownload) {
        if (typeof JSZip === "undefined") {
            updateStatus("ZIP library is unavailable.");
            return;
        }

        if (!imagesToDownload.length) return;

        isDownloading = true;

        updateAllFilenames();
        updateSelectionControls();

        try {
            const zip = new JSZip();

            imagesToDownload.forEach(image => {
                zip.file(image.filename, image.blob);
            });

            updateStatus(
                `Preparing ZIP file containing ${imagesToDownload.length} image(s)...`
            );

            const zipBlob = await zip.generateAsync({
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: {
                    level: 6
                }
            });

            const zipUrl = URL.createObjectURL(zipBlob);

            const safeZipName = sanitizeFilename(
                zipFilenameInput.value,
                "JScan-PDF-Images"
            );

            const link = document.createElement("a");
            link.href = zipUrl;
            link.download = `${safeZipName}.zip`;

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(zipUrl), 1500);

            updateStatus(
                `Success! ${imagesToDownload.length} image(s) downloaded in a ZIP file.`
            );

        } catch (error) {
            console.error("ZIP creation error:", error);

            updateStatus(
                "Unable to create ZIP file: " + error.message
            );

        } finally {
            isDownloading = false;
            updateSelectionControls();
        }
    }

    // CHANGE IMAGE FORMAT
    formatSelect.addEventListener("change", () => {
        if (isConverting || isDownloading) return;

        if (convertedImages.length) {
            clearConvertedImages();

            resultsArea.style.display = "none";

            updateStatus(
                "Image format changed. Convert your PDF again to apply the new format."
            );
        }
    });

    // REMOVE PDF
    resetBtn.addEventListener("click", () => {
        if (isConverting || isDownloading) return;

        clearConvertedImages();

        selectedFile = null;
        pdfDocument = null;

        fileInput.value = "";

        workspace.style.display = "none";
        resultsArea.style.display = "none";

        progress.style.display = "none";
        progressBar.style.width = "0%";

        fileInfo.textContent = "No PDF information available.";
        resultInfo.textContent = "No images converted yet.";

        zipFilenameInput.value = "JScan-PDF-Images";

        convertBtn.disabled = true;

        updateStatus("No document selected.");
        updateSelectionControls();
    });

    // INITIAL STATE
    convertBtn.disabled = true;
    downloadSelectedBtn.disabled = true;
    downloadAllBtn.disabled = true;
    downloadSingleZipBtn.disabled = true;

    workspace.style.display = "none";
    resultsArea.style.display = "none";
    progress.style.display = "none";
});
