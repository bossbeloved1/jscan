
document.addEventListener("DOMContentLoaded", () => {

    // Local Docker API
    const API_URL = "http://localhost:8000/compress";

    const fileInput = document.getElementById("pdfFileInput");
    const fileInfo = document.getElementById("pdfFileInfo");
    const fileName = document.getElementById("pdfFileName");
    const originalSize = document.getElementById("pdfOriginalSize");
    const removeBtn = document.getElementById("removePdfBtn");

    const settings = document.getElementById("compressSettings");
    const qualitySelect = document.getElementById("compressionQuality");

    const compressBtn = document.getElementById("compressPdfBtn");
    const resetBtn = document.getElementById("resetCompressorBtn");

    const status = document.getElementById("compressStatus");
    const result = document.getElementById("compressResult");

    const resultOriginal = document.getElementById("resultOriginalSize");
    const resultCompressed = document.getElementById("resultCompressedSize");
    const percentage = document.getElementById("compressionPercentage");

    const downloadBtn = document.getElementById("downloadCompressedBtn");

    // Frontend quality names mapped to Ghostscript profiles.
    const QUALITY_MAP = {
        high: "printer",
        balanced: "ebook",
        maximum: "screen"
    };

    let selectedFile = null;
    let compressedBlobUrl = null;
    let isCompressing = false;

    const originalCompressText = compressBtn.textContent;

    function formatSize(bytes) {
        if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(2) + " KB";
        }

        return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    }

    function clearDownload() {
        if (compressedBlobUrl) {
            URL.revokeObjectURL(compressedBlobUrl);
            compressedBlobUrl = null;
        }

        downloadBtn.disabled = true;
    }

    function clearResult() {
        result.classList.remove("show");

        resultOriginal.textContent = "—";
        resultCompressed.textContent = "—";
        percentage.textContent = "";

        clearDownload();
    }

    function updateCompressButton() {
        compressBtn.disabled = !selectedFile || isCompressing;
    }

    function handleFile(file) {
        if (!file) return;

        if (
            file.type !== "application/pdf" &&
            !file.name.toLowerCase().endsWith(".pdf")
        ) {
            status.textContent = "Please select a valid PDF file.";
            fileInput.value = "";
            return;
        }

        if (file.size === 0) {
            status.textContent = "This PDF file is empty.";
            fileInput.value = "";
            return;
        }

        clearResult();

        selectedFile = file;

        fileName.textContent = file.name;

        originalSize.textContent =
            `Original size: ${formatSize(file.size)}`;

        fileInfo.classList.add("show");
        settings.classList.add("show");

        status.textContent = "PDF loaded successfully.";

        updateCompressButton();
    }

    function resetCompressor() {
        selectedFile = null;
        isCompressing = false;

        clearDownload();

        fileInput.value = "";

        fileInfo.classList.remove("show");
        settings.classList.remove("show");

        qualitySelect.value = "balanced";

        clearResult();

        compressBtn.textContent = originalCompressText;

        status.textContent = "Select a PDF file to get started.";

        updateCompressButton();
    }

    async function compressPDF() {
        if (!selectedFile || isCompressing) return;

        const quality = QUALITY_MAP[qualitySelect.value];

        if (!quality) {
            status.textContent =
                "Please select a valid compression quality.";
            return;
        }

        clearResult();

        isCompressing = true;
        updateCompressButton();

        compressBtn.textContent = "Compressing...";

        status.textContent =
            "Uploading your PDF and compressing it. Please wait...";

        try {
            const formData = new FormData();

            formData.append("file", selectedFile);

            const response = await fetch(
                `${API_URL}?quality=${encodeURIComponent(quality)}`,
                {
                    method: "POST",
                    body: formData
                }
            );

            if (!response.ok) {
    const errorText = await response.text();

    let errorMessage = "PDF compression failed.";

    try {
        const errorData = JSON.parse(errorText);

        if (typeof errorData.detail === "string") {
            errorMessage = errorData.detail;
        } else if (errorData.detail) {
            errorMessage = JSON.stringify(errorData.detail);
        } else {
            errorMessage = JSON.stringify(errorData);
        }

    } catch (_) {
        errorMessage = errorText || errorMessage;
    }

    throw new Error(errorMessage);
}

            const contentType =
                response.headers.get("content-type") || "";

            if (!contentType.includes("application/pdf")) {
                throw new Error(
                    "The compression server did not return a valid PDF."
                );
            }

            const compressedBlob = await response.blob();

            if (compressedBlob.size === 0) {
                throw new Error(
                    "The server returned an empty compressed PDF."
                );
            }

            const originalBytes = selectedFile.size;
            const compressedBytes = compressedBlob.size;

            const reduction =
                ((originalBytes - compressedBytes) / originalBytes) * 100;

            resultOriginal.textContent = formatSize(originalBytes);

            resultCompressed.textContent = formatSize(compressedBytes);

            if (reduction > 0) {
                percentage.textContent =
                    `${reduction.toFixed(2)}% smaller`;
            } else if (reduction < 0) {
                percentage.textContent =
                    `${Math.abs(reduction).toFixed(2)}% larger`;
            } else {
                percentage.textContent = "No size change";
            }

            compressedBlobUrl = URL.createObjectURL(compressedBlob);

            downloadBtn.disabled = false;

            result.classList.add("show");

            if (reduction > 0) {
                status.textContent =
                    `Compression successful! Your PDF is now ${formatSize(compressedBytes)}.`;
            } else if (reduction < 0) {
                status.textContent =
                    "Compression completed, but the resulting PDF is larger than the original.";
            } else {
                status.textContent =
                    "Compression completed. The file size remained unchanged.";
            }

        } catch (error) {
            console.error("JScan compression error:", error);

            status.textContent =
                error.message ||
                "Something went wrong while compressing your PDF.";

        } finally {
            isCompressing = false;

            compressBtn.textContent = originalCompressText;

            updateCompressButton();
        }
    }

    // File selection
    fileInput.addEventListener("change", event => {
        handleFile(event.target.files[0]);
    });

    // Drag and drop
    const uploadArea = document.querySelector(".pdf-upload-area");

    if (uploadArea) {

        uploadArea.addEventListener("dragover", event => {
            event.preventDefault();
            uploadArea.style.borderColor = "#2563eb";
        });

        uploadArea.addEventListener("dragleave", () => {
            uploadArea.style.borderColor = "";
        });

        uploadArea.addEventListener("drop", event => {
            event.preventDefault();
            uploadArea.style.borderColor = "";

            const file = event.dataTransfer.files[0];

            if (file) {
                handleFile(file);
            }
        });

    }

    // Clear old result when quality changes
    qualitySelect.addEventListener("change", clearResult);

    removeBtn.addEventListener("click", resetCompressor);

    resetBtn.addEventListener("click", resetCompressor);

    compressBtn.addEventListener("click", compressPDF);

    // Download compressed PDF
    downloadBtn.addEventListener("click", () => {

        if (!compressedBlobUrl) return;

        const link = document.createElement("a");

        link.href = compressedBlobUrl;
        link.download = "JScan-Compressed.pdf";

        document.body.appendChild(link);

        link.click();

        link.remove();

    });

    updateCompressButton();

});
