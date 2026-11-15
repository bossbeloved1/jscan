
document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("imagesInput");
    const imageList = document.getElementById("imageList");
    const summary = document.getElementById("imageSummary");
    const convertBtn = document.getElementById("convertImagesBtn");
    const clearBtn = document.getElementById("clearImagesBtn");
    const status = document.getElementById("imageStatus");
    const filenameInput = document.getElementById("pdfFilename");
    const pageSizeSelect = document.getElementById("pageSize");
    const uploadArea = document.querySelector(".upload-area");

    let images = [];
    let isConverting = false;

    const MAX_IMAGES = 100;
    const ALLOWED_TYPES = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    function formatSize(bytes) {
        if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(1) + " KB";
        }

        return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    }

    function updateInterface() {
        summary.textContent = `${images.length} of ${MAX_IMAGES} images selected`;

        convertBtn.disabled = images.length === 0 || isConverting;
        clearBtn.disabled = images.length === 0 || isConverting;

        if (images.length === 0) {
            imageList.innerHTML = `
                <div class="empty-images">
                    Your uploaded images will appear here.
                </div>
            `;
            summary.textContent = "No images selected.";
            return;
        }

        imageList.innerHTML = "";

        images.forEach((item, index) => {
            const card = document.createElement("div");
            card.className = "image-card";

            const image = document.createElement("img");
            image.src = item.url;
            image.alt = item.file.name;

            const info = document.createElement("div");
            info.className = "image-card-info";

            const name = document.createElement("div");
            name.className = "image-name";
            name.textContent = `${index + 1}. ${item.file.name}`;

            const meta = document.createElement("div");
            meta.className = "image-meta";
            meta.textContent = `${item.width} × ${item.height} · ${formatSize(item.file.size)}`;

            const actions = document.createElement("div");
            actions.className = "image-actions";

            const upBtn = document.createElement("button");
            upBtn.type = "button";
            upBtn.textContent = "↑";
            upBtn.title = "Move up";
            upBtn.disabled = index === 0;
            upBtn.addEventListener("click", () => moveImage(index, -1));

            const downBtn = document.createElement("button");
            downBtn.type = "button";
            downBtn.textContent = "↓";
            downBtn.title = "Move down";
            downBtn.disabled = index === images.length - 1;
            downBtn.addEventListener("click", () => moveImage(index, 1));

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.textContent = "Remove";
            removeBtn.className = "remove-image";
            removeBtn.addEventListener("click", () => removeImage(index));

            actions.append(upBtn, downBtn, removeBtn);
            info.append(name, meta, actions);
            card.append(image, info);

            imageList.appendChild(card);
        });
    }

    function moveImage(index, direction) {
        const newIndex = index + direction;

        if (newIndex < 0 || newIndex >= images.length) return;

        [images[index], images[newIndex]] = [
            images[newIndex],
            images[index]
        ];

        updateInterface();
    }

    function removeImage(index) {
        URL.revokeObjectURL(images[index].url);
        images.splice(index, 1);
        status.textContent = "Image removed.";
        updateInterface();
    }

    function clearImages() {
        images.forEach(item => URL.revokeObjectURL(item.url));

        images = [];
        input.value = "";
        status.textContent = "All images cleared.";

        updateInterface();
    }

    async function loadImage(file) {
        if (!ALLOWED_TYPES.includes(file.type)) {
            throw new Error(`${file.name}: Unsupported image format.`);
        }

        const url = URL.createObjectURL(file);

        try {
            const dimensions = await new Promise((resolve, reject) => {
                const img = new Image();

                img.onload = () => resolve({
                    width: img.naturalWidth,
                    height: img.naturalHeight
                });

                img.onerror = () => reject(
                    new Error(`${file.name}: Could not read image.`)
                );

                img.src = url;
            });

            return {
                file,
                url,
                width: dimensions.width,
                height: dimensions.height
            };
        } catch (error) {
            URL.revokeObjectURL(url);
            throw error;
        }
    }

    async function addFiles(fileList) {
        if (isConverting) return;

        const selectedFiles = Array.from(fileList);

        if (!selectedFiles.length) return;

        const availableSlots = MAX_IMAGES - images.length;

        if (availableSlots <= 0) {
            status.textContent = "You can upload a maximum of 100 images.";
            return;
        }

        const filesToAdd = selectedFiles.slice(0, availableSlots);

        if (selectedFiles.length > availableSlots) {
            status.textContent =
                `Only ${availableSlots} additional images can be added.`;
        } else {
            status.textContent = "Loading images...";
        }

        for (const file of filesToAdd) {
            try {
                const image = await loadImage(file);
                images.push(image);
            } catch (error) {
                status.textContent = error.message;
            }
        }

        if (selectedFiles.length > availableSlots) {
            status.textContent += " Remaining images were not added.";
        } else {
            status.textContent = `${images.length} images ready.`;
        }

        updateInterface();
    }

    function getPageDimensions(image, pageSize) {
        const portrait = image.height >= image.width;

        if (pageSize === "a4") {
            return portrait
                ? [595.28, 841.89]
                : [841.89, 595.28];
        }

        if (pageSize === "letter") {
            return portrait
                ? [612, 792]
                : [792, 612];
        }

        const pointsPerPixel = 72 / 96;

        return [
            image.width * pointsPerPixel,
            image.height * pointsPerPixel
        ];
    }

    async function convertImagesToPDF() {
        if (!images.length || isConverting) return;

        if (!window.PDFLib) {
            status.textContent =
                "PDF library could not load. Refresh the page and try again.";
            return;
        }

        isConverting = true;
        convertBtn.disabled = true;
        clearBtn.disabled = true;
        convertBtn.textContent = "Creating PDF...";
        status.textContent = "Preparing your PDF...";

        try {
            const { PDFDocument } = PDFLib;
            const pdfDoc = await PDFDocument.create();

            const pageSize = pageSizeSelect.value;

            for (let i = 0; i < images.length; i++) {
                status.textContent =
                    `Processing image ${i + 1} of ${images.length}...`;

                const item = images[i];

                const arrayBuffer = await item.file.arrayBuffer();

                let embeddedImage;

                if (item.file.type === "image/jpeg") {
                    embeddedImage = await pdfDoc.embedJpg(arrayBuffer);
                } else {
                    const bitmap = await createImageBitmap(item.file);

                    const canvas = document.createElement("canvas");
                    canvas.width = bitmap.width;
                    canvas.height = bitmap.height;

                    const context = canvas.getContext("2d", {
                        alpha: false
                    });

                    context.fillStyle = "#ffffff";
                    context.fillRect(0, 0, canvas.width, canvas.height);
                    context.drawImage(bitmap, 0, 0);

                    bitmap.close();

                    const pngBlob = await new Promise(resolve => {
                        canvas.toBlob(resolve, "image/png");
                    });

                    if (!pngBlob) {
                        throw new Error(
                            `Could not process ${item.file.name}.`
                        );
                    }

                    const pngBytes = await pngBlob.arrayBuffer();
                    embeddedImage = await pdfDoc.embedPng(pngBytes);

                    canvas.width = 0;
                    canvas.height = 0;
                }

                const [pageWidth, pageHeight] =
                    getPageDimensions(item, pageSize);

                const page = pdfDoc.addPage([
                    pageWidth,
                    pageHeight
                ]);

                const margin = pageSize === "original" ? 0 : 24;

                const availableWidth = pageWidth - margin * 2;
                const availableHeight = pageHeight - margin * 2;

                const scale = Math.min(
                    availableWidth / embeddedImage.width,
                    availableHeight / embeddedImage.height
                );

                const drawWidth = embeddedImage.width * scale;
                const drawHeight = embeddedImage.height * scale;

                page.drawImage(embeddedImage, {
                    x: (pageWidth - drawWidth) / 2,
                    y: (pageHeight - drawHeight) / 2,
                    width: drawWidth,
                    height: drawHeight
                });
            }

            status.textContent = "Generating your PDF file...";

            const pdfBytes = await pdfDoc.save({
                useObjectStreams: true
            });

            const blob = new Blob([pdfBytes], {
                type: "application/pdf"
            });

            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");

            let filename = filenameInput.value.trim() || "JScan-Images";

            filename = filename
                .replace(/\.pdf$/i, "")
                .replace(/[\\/:*?"<>|]/g, "-");

            link.href = downloadUrl;
            link.download = `${filename}.pdf`;

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

            status.textContent =
                `Success! Your PDF has ${images.length} pages and is ${formatSize(blob.size)}.`;

        } catch (error) {
            console.error("Images to PDF error:", error);

            status.textContent =
                error.message || "Something went wrong while creating the PDF.";
        } finally {
            isConverting = false;
            convertBtn.disabled = images.length === 0;
            clearBtn.disabled = images.length === 0;
            convertBtn.textContent = "Convert to PDF";
        }
    }

    input.addEventListener("change", async event => {
        await addFiles(event.target.files);
        input.value = "";
    });

    convertBtn.addEventListener("click", convertImagesToPDF);
    clearBtn.addEventListener("click", clearImages);

    uploadArea.addEventListener("dragover", event => {
        event.preventDefault();
        uploadArea.style.borderColor = "#2563eb";
    });

    uploadArea.addEventListener("dragleave", () => {
        uploadArea.style.borderColor = "";
    });

    uploadArea.addEventListener("drop", async event => {
        event.preventDefault();
        uploadArea.style.borderColor = "";

        await addFiles(event.dataTransfer.files);
    });

    updateInterface();
});
