
document.addEventListener("DOMContentLoaded", () => {
    const imageInput = document.getElementById("ocrImageInput");
    const fileInfo = document.getElementById("ocrFileInfo");
    const gallery = document.getElementById("ocrImageGallery");

    const extractBtn = document.getElementById("extractTextBtn");
    const clearBtn = document.getElementById("clearOcrBtn");

    const status = document.getElementById("ocrStatus");
    const progress = document.getElementById("ocrProgress");
    const progressBar = document.getElementById("ocrProgressBar");

    const previewArea = document.getElementById("ocrPreviewArea");
    const pageTitle = document.getElementById("ocrPageTitle");
    const pageText = document.getElementById("ocrPageText");
    const pageCount = document.getElementById("ocrPageCount");
    const pageNumber = document.getElementById("ocrPageNumber");

    const previousBtn = document.getElementById("previousPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");

    const downloadDocxBtn = document.getElementById("downloadDocxBtn");
    const downloadPdfBtn = document.getElementById("downloadPdfBtn");

    const fileNameInput = document.getElementById("ocrFileName");
    const fontFamilySelect = document.getElementById("ocrFontFamily");
    const fontSizeSelect = document.getElementById("ocrFontSize");
    const customFontInput = document.getElementById("ocrCustomFontInput");
    const fontStatus = document.getElementById("ocrFontStatus");

    const toolbarButtons = document.querySelectorAll("[data-editor-command]");

    // Image preview elements
    const lightbox = document.getElementById("ocrLightbox");
    const lightboxImage = document.getElementById("ocrLightboxImage");
    const lightboxCaption = document.getElementById("ocrLightboxCaption");
    const lightboxCounter = document.getElementById("ocrLightboxCounter");
    const lightboxClose = document.getElementById("ocrLightboxClose");
    const lightboxPrevious = document.getElementById("ocrLightboxPrevious");
    const lightboxNext = document.getElementById("ocrLightboxNext");

    let selectedFiles = [];
    let extractedPages = [];
    let currentPage = 0;
    let isProcessing = false;

    let imageUrls = [];
    let lightboxIndex = 0;

    let customFonts = [];

    // Release image preview URLs
    function releaseImageUrls() {
        imageUrls.forEach(url => URL.revokeObjectURL(url));
        imageUrls = [];
    }

    // Make a safe filename
    function getSafeFilename() {
        let name = fileNameInput.value.trim();

        if (!name) {
            name = "JScan-Extracted-Text";
        }

        name = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-");
        name = name.replace(/[. ]+$/g, "");

        return name || "JScan-Extracted-Text";
    }

    // Update selected image information
    function updateFileInfo() {
        fileInfo.textContent = selectedFiles.length
            ? `${selectedFiles.length} image(s) selected.`
            : "No images selected.";

        extractBtn.disabled = selectedFiles.length === 0 || isProcessing;
    }

    // Open image preview
    function openLightbox(index) {
        if (!selectedFiles.length || !imageUrls[index]) return;

        lightboxIndex = index;
        updateLightbox();

        lightbox.hidden = false;
        document.body.style.overflow = "hidden";
    }

    // Update image preview content
    function updateLightbox() {
        if (!selectedFiles.length) {
            closeLightbox();
            return;
        }

        const file = selectedFiles[lightboxIndex];

        lightboxImage.src = imageUrls[lightboxIndex];
        lightboxImage.alt = file.name;
        lightboxCaption.textContent = file.name;

        lightboxCounter.textContent =
            `${lightboxIndex + 1} of ${selectedFiles.length}`;

        lightboxPrevious.disabled = lightboxIndex === 0;
        lightboxNext.disabled = lightboxIndex === selectedFiles.length - 1;
    }

    // Close image preview
    function closeLightbox() {
        lightbox.hidden = true;
        lightboxImage.removeAttribute("src");
        document.body.style.overflow = "";
    }

    lightboxClose.addEventListener("click", closeLightbox);

    lightboxPrevious.addEventListener("click", () => {
        if (lightboxIndex > 0) {
            lightboxIndex--;
            updateLightbox();
        }
    });

    lightboxNext.addEventListener("click", () => {
        if (lightboxIndex < selectedFiles.length - 1) {
            lightboxIndex++;
            updateLightbox();
        }
    });

    lightbox.addEventListener("click", event => {
        if (event.target === lightbox) {
            closeLightbox();
        }
    });

    // Keyboard controls for image preview
    document.addEventListener("keydown", event => {
        if (lightbox.hidden) return;

        if (event.key === "Escape") {
            closeLightbox();
        }

        if (event.key === "ArrowLeft" && lightboxIndex > 0) {
            lightboxIndex--;
            updateLightbox();
        }

        if (
            event.key === "ArrowRight" &&
            lightboxIndex < selectedFiles.length - 1
        ) {
            lightboxIndex++;
            updateLightbox();
        }
    });

    // Display selected image thumbnails
    function renderGallery() {
        releaseImageUrls();
        gallery.innerHTML = "";

        selectedFiles.forEach((file, index) => {
            const card = document.createElement("div");
            card.className = "ocr-image-card";

            const previewButton = document.createElement("button");
            previewButton.type = "button";
            previewButton.className = "ocr-image-preview-button";
            previewButton.title = "Click to preview image";
            previewButton.setAttribute(
                "aria-label",
                `Preview ${file.name}`
            );

            const image = document.createElement("img");
            const imageUrl = URL.createObjectURL(file);

            imageUrls.push(imageUrl);

            image.src = imageUrl;
            image.alt = `Selected image ${index + 1}`;

            previewButton.appendChild(image);

            previewButton.addEventListener("click", () => {
                openLightbox(index);
            });

            const name = document.createElement("span");
            name.className = "ocr-image-name";
            name.textContent = `${index + 1}. ${file.name}`;

            const removeButton = document.createElement("button");
            removeButton.className = "ocr-remove-image";
            removeButton.type = "button";
            removeButton.textContent = "×";
            removeButton.title = "Remove image";
            removeButton.disabled = isProcessing;

            removeButton.addEventListener("click", () => {
                if (isProcessing) return;

                closeLightbox();

                selectedFiles.splice(index, 1);

                extractedPages = [];
                currentPage = 0;

                previewArea.hidden = true;
                downloadDocxBtn.disabled = true;
                downloadPdfBtn.disabled = true;

                status.textContent =
                    "Image removed. Select Extract Text to process the remaining images.";

                renderGallery();
                updateFileInfo();
            });

            card.appendChild(previewButton);
            card.appendChild(name);
            card.appendChild(removeButton);

            gallery.appendChild(card);
        });
    }

    // Select images
    imageInput.addEventListener("change", () => {
        if (isProcessing) return;

        const files = Array.from(imageInput.files || []);

        if (files.length > 100) {
            imageInput.value = "";
            status.textContent =
                "You can select a maximum of 100 images at once.";
            return;
        }

        const validFiles = files.filter(file =>
            ["image/jpeg", "image/png", "image/webp"].includes(file.type)
        );

        if (validFiles.length !== files.length) {
            status.textContent =
                "Some files were not supported. Please use JPG, PNG or WebP images.";
        } else {
            status.textContent = "";
        }

        closeLightbox();

        selectedFiles = validFiles;
        extractedPages = [];
        currentPage = 0;

        previewArea.hidden = true;
        downloadDocxBtn.disabled = true;
        downloadPdfBtn.disabled = true;

        progress.style.display = "none";
        progressBar.style.width = "0%";

        renderGallery();
        updateFileInfo();
    });

    // Save the current editable page
    function saveCurrentPage() {
        if (!extractedPages.length) return;

        const page = extractedPages[currentPage];

        page.html = pageText.innerHTML;
        page.text = pageText.innerText;
        page.fontFamily = fontFamilySelect.value;
        page.fontSize = Number(fontSizeSelect.value);
    }

    // Display current editable page
    function renderPage() {
        if (!extractedPages.length) return;

        const page = extractedPages[currentPage];

        pageTitle.textContent =
            `Page ${currentPage + 1} — ${page.title}`;

        if (page.html) {
            pageText.innerHTML = page.html;
        } else {
            pageText.textContent = page.text;
        }

        page.fontFamily = page.fontFamily || "Arial";
        page.fontSize = page.fontSize || 15;

        fontFamilySelect.value = page.fontFamily;
        fontSizeSelect.value = String(page.fontSize);

        pageText.style.fontFamily = `"${page.fontFamily}", sans-serif`;
        pageText.style.fontSize = `${page.fontSize}px`;

        pageCount.textContent =
            `${extractedPages.length} document page(s).`;

        pageNumber.textContent =
            `Page ${currentPage + 1} of ${extractedPages.length}`;

        previousBtn.disabled = currentPage === 0;
        nextBtn.disabled = currentPage === extractedPages.length - 1;
    }

    // Extract text from all selected images
    extractBtn.addEventListener("click", async () => {
        if (!selectedFiles.length || isProcessing) return;

        if (typeof Tesseract === "undefined") {
            status.textContent =
                "OCR service could not load. Check your internet connection and refresh.";
            return;
        }

        isProcessing = true;
        extractedPages = [];
        currentPage = 0;

        extractBtn.disabled = true;
        clearBtn.disabled = true;
        imageInput.disabled = true;

        downloadDocxBtn.disabled = true;
        downloadPdfBtn.disabled = true;

        renderGallery();

        previewArea.hidden = true;
        progress.style.display = "block";
        progressBar.style.width = "0%";

        let worker = null;

        try {
            status.textContent = "Preparing OCR engine...";

            worker = await Tesseract.createWorker("eng", 1, {
                logger: message => {
                    if (message.status === "recognizing text") {
                        const percentage = Math.round(message.progress * 100);

                        status.textContent =
                            `Reading image ${extractedPages.length + 1} of ${selectedFiles.length}... ${percentage}%`;
                    }
                }
            });

            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];

                status.textContent =
                    `Processing image ${i + 1} of ${selectedFiles.length}...`;

                try {
                    const result = await worker.recognize(file);

                    extractedPages.push({
                        title: file.name,
                        text: result.data.text.trim() ||
                            "No readable text was found in this image.",
                        html: "",
                        fontFamily: fontFamilySelect.value,
                        fontSize: Number(fontSizeSelect.value)
                    });

                } catch (imageError) {
                    console.error("Image OCR error:", file.name, imageError);

                    extractedPages.push({
                        title: file.name,
                        text: "Text extraction failed for this image.",
                        html: "",
                        fontFamily: fontFamilySelect.value,
                        fontSize: Number(fontSizeSelect.value)
                    });
                }

                const completed = Math.round(
                    ((i + 1) / selectedFiles.length) * 100
                );

                progressBar.style.width = completed + "%";
            }

            renderPage();

            previewArea.hidden = false;

            downloadDocxBtn.disabled = false;
            downloadPdfBtn.disabled = false;

            status.textContent =
                `Extraction complete. ${extractedPages.length} image(s) processed. You can now edit your document.`;

        } catch (error) {
            console.error("OCR processing error:", error);
            status.textContent =
                "OCR could not complete. Please try again.";

        } finally {
            if (worker) {
                await worker.terminate();
            }

            isProcessing = false;

            extractBtn.disabled = selectedFiles.length === 0;
            clearBtn.disabled = false;
            imageInput.disabled = false;

            renderGallery();
        }
    });

    // Save edits whenever the user types
    pageText.addEventListener("input", saveCurrentPage);

    // Previous document page
    previousBtn.addEventListener("click", () => {
        if (currentPage > 0) {
            saveCurrentPage();
            currentPage--;
            renderPage();
        }
    });

    // Next document page
    nextBtn.addEventListener("click", () => {
        if (currentPage < extractedPages.length - 1) {
            saveCurrentPage();
            currentPage++;
            renderPage();
        }
    });

    // Basic editing toolbar
    toolbarButtons.forEach(button => {
        button.addEventListener("mousedown", event => {
            event.preventDefault();
        });

        button.addEventListener("click", () => {
            const command = button.dataset.editorCommand;

            pageText.focus();
            document.execCommand(command, false, null);

            saveCurrentPage();
        });
    });

    // Change current page font family
    fontFamilySelect.addEventListener("change", () => {
        if (!extractedPages.length) return;

        pageText.style.fontFamily =
            `"${fontFamilySelect.value}", sans-serif`;

        saveCurrentPage();
    });

    // Change current page font size
    fontSizeSelect.addEventListener("change", () => {
        if (!extractedPages.length) return;

        pageText.style.fontSize = `${fontSizeSelect.value}px`;

        saveCurrentPage();
    });

    // Convert a font file to base64 for PDF embedding
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                const result = reader.result;
                const base64 = String(result).split(",")[1];
                resolve(base64);
            };

            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Upload a custom TTF font
    customFontInput.addEventListener("change", async () => {
        const file = customFontInput.files[0];

        if (!file) return;

        if (!file.name.toLowerCase().endsWith(".ttf")) {
            fontStatus.textContent =
                "Please upload a TrueType font file (.ttf).";
            customFontInput.value = "";
            return;
        }

        try {
            fontStatus.textContent = "Loading your font...";

            const fontName = file.name
                .replace(/\.ttf$/i, "")
                .replace(/[^a-zA-Z0-9_-]/g, "");

            const uniqueName =
                `${fontName || "CustomFont"}_${Date.now()}`;

            const fontUrl = URL.createObjectURL(file);

            const fontFace = new FontFace(
                uniqueName,
                `url("${fontUrl}")`
            );

            await fontFace.load();
            document.fonts.add(fontFace);

            const base64 = await fileToBase64(file);

            customFonts.push({
                name: uniqueName,
                fileName: file.name,
                url: fontUrl,
                base64
            });

            const option = document.createElement("option");
            option.value = uniqueName;
            option.textContent = `${fontName || "Custom Font"} (Uploaded)`;

            fontFamilySelect.appendChild(option);
            fontFamilySelect.value = uniqueName;

            if (extractedPages.length) {
                pageText.style.fontFamily = `"${uniqueName}", sans-serif`;
                saveCurrentPage();
            }

            fontStatus.textContent =
                `${file.name} uploaded and ready to use.`;

        } catch (error) {
            console.error("Font upload error:", error);

            fontStatus.textContent =
                "Could not load this font. Please try another TTF file.";
        }

        customFontInput.value = "";
    });

    // Get edited text from every page
    function getDocumentPages() {
        saveCurrentPage();

        return extractedPages.map(page => {
            const temporary = document.createElement("div");
            temporary.innerHTML = page.html || "";

            return {
                title: page.title,
                text: temporary.innerText || page.text || "",
                fontFamily: page.fontFamily || "Arial",
                fontSize: page.fontSize || 15
            };
        });
    }

    // Download helper
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // Find an uploaded font
    function findCustomFont(fontName) {
        return customFonts.find(font => font.name === fontName);
    }

    // Download Word document
    downloadDocxBtn.addEventListener("click", async () => {
        if (!extractedPages.length) return;

        if (typeof docx === "undefined") {
            status.textContent =
                "Word export library could not load. Check your internet connection.";
            return;
        }

        downloadDocxBtn.disabled = true;
        status.textContent = "Preparing Word document...";

        try {
            const pages = getDocumentPages();
            const children = [];

            pages.forEach((page, index) => {
                if (index > 0) {
                    children.push(
                        new docx.Paragraph({
                            children: [new docx.PageBreak()]
                        })
                    );
                }

                children.push(
                    new docx.Paragraph({
                        children: [
                            new docx.TextRun({
                                text: `Page ${index + 1}: ${page.title}`,
                                bold: true,
                                size: 26,
                                font: "Arial"
                            })
                        ],
                        heading: docx.HeadingLevel.HEADING_1
                    })
                );

                const lines = page.text.split(/\r?\n/);

                lines.forEach(line => {
                    children.push(
                        new docx.Paragraph({
                            children: [
                                new docx.TextRun({
                                    text: line || " ",
                                    font: page.fontFamily,
                                    size: Math.round(page.fontSize * 1.5)
                                })
                            ]
                        })
                    );
                });
            });

            const documentFile = new docx.Document({
                sections: [{
                    properties: {},
                    children
                }]
            });

            const blob = await docx.Packer.toBlob(documentFile);

            downloadBlob(
                blob,
                `${getSafeFilename()}.docx`
            );

            status.textContent =
                "Word document downloaded successfully.";

        } catch (error) {
            console.error("Word export error:", error);
            status.textContent =
                "Could not create the Word document.";

        } finally {
            downloadDocxBtn.disabled = false;
        }
    });

    // Download PDF document
    downloadPdfBtn.addEventListener("click", async () => {
        if (!extractedPages.length) return;

        if (!window.jspdf || !window.jspdf.jsPDF) {
            status.textContent =
                "PDF export library could not load. Check your internet connection.";
            return;
        }

        downloadPdfBtn.disabled = true;
        status.textContent = "Preparing PDF document...";

        try {
            const pages = getDocumentPages();
            const { jsPDF } = window.jspdf;

            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4"
            });

            // Register uploaded TTF fonts with PDF
            const registeredFonts = new Set();

            for (const font of customFonts) {
                try {
                    const internalName =
                        `JScanFont${registeredFonts.size + 1}`;

                    pdf.addFileToVFS(
                        `${internalName}.ttf`,
                        font.base64
                    );

                    pdf.addFont(
                        `${internalName}.ttf`,
                        internalName,
                        "normal"
                    );

                    font.pdfName = internalName;
                    registeredFonts.add(font.name);

                } catch (fontError) {
                    console.warn(
                        "Could not embed custom font:",
                        font.name,
                        fontError
                    );
                }
            }

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            const margin = 15;
            const usableWidth = pageWidth - margin * 2;
            const bottomLimit = pageHeight - margin;

            let y = 20;

            pages.forEach((page, index) => {
                if (index > 0) {
                    pdf.addPage();
                    y = 20;
                }

                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(13);

                const heading = `Page ${index + 1}: ${page.title}`;
                const headingLines = pdf.splitTextToSize(
                    heading,
                    usableWidth
                );

                headingLines.forEach(line => {
                    if (y > bottomLimit) {
                        pdf.addPage();
                        y = 20;
                    }

                    pdf.text(line, margin, y);
                    y += 8;
                });

                y += 4;

                const uploadedFont = findCustomFont(page.fontFamily);

                if (uploadedFont && uploadedFont.pdfName) {
                    pdf.setFont(uploadedFont.pdfName, "normal");
                } else {
                    const standardFonts = {
                        "Arial": "helvetica",
                        "Calibri": "helvetica",
                        "Times New Roman": "times",
                        "Georgia": "times",
                        "Courier New": "courier"
                    };

                    pdf.setFont(
                        standardFonts[page.fontFamily] || "helvetica",
                        "normal"
                    );
                }

                pdf.setFontSize(
                    Math.max(8, Math.min(30, page.fontSize * 0.75))
                );

                const textLines = pdf.splitTextToSize(
                    page.text,
                    usableWidth
                );

                textLines.forEach(line => {
                    if (y > bottomLimit) {
                        pdf.addPage();
                        y = 20;
                    }

                    pdf.text(line, margin, y);
                    y += Math.max(5, page.fontSize * 0.35);
                });
            });

            pdf.save(`${getSafeFilename()}.pdf`);

            status.textContent =
                "PDF document downloaded successfully.";

        } catch (error) {
            console.error("PDF export error:", error);

            status.textContent =
                "Could not create the PDF document. Check the uploaded font and try again.";

        } finally {
            downloadPdfBtn.disabled = false;
        }
    });

    // Clear everything
    clearBtn.addEventListener("click", () => {
        if (isProcessing) return;

        closeLightbox();
        imageInput.value = "";

        releaseImageUrls();

        selectedFiles = [];
        extractedPages = [];
        currentPage = 0;

        gallery.innerHTML = "";
        fileInfo.textContent = "No images selected.";
        status.textContent = "";

        progress.style.display = "none";
        progressBar.style.width = "0%";

        previewArea.hidden = true;

        pageText.innerHTML = "";

        extractBtn.disabled = true;
        downloadDocxBtn.disabled = true;
        downloadPdfBtn.disabled = true;

        previousBtn.disabled = true;
        nextBtn.disabled = true;

        fileNameInput.value = "JScan-Extracted-Text";
        fontFamilySelect.value = "Arial";
        fontSizeSelect.value = "15";

        fontStatus.textContent =
            "Choose a font or upload a TTF font from your device.";
    });
});
