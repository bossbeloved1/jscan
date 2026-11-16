
document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("wordFileInput");
    const status = document.getElementById("wordStatus");
    const previewArea = document.getElementById("wordPreviewArea");
    const documentPreview = document.getElementById("wordDocumentPreview");
    const filenameInput = document.getElementById("wordPdfFilename");
    const downloadBtn = document.getElementById("wordDownloadBtn");
    const resetBtn = document.getElementById("wordResetBtn");

    // JScan live Railway FastAPI endpoint
    const API_URL = "https://jscan-production.up.railway.app/word-to-pdf";

    let selectedFile = null;
    let isRendering = false;
    let isConverting = false;

    // LOAD WORD DOCUMENT
    fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];

        if (!file) return;

        if (!file.name.toLowerCase().endsWith(".docx")) {
            status.textContent = "Please select a valid .docx document.";
            fileInput.value = "";
            return;
        }

        if (typeof docx === "undefined" || !docx.renderAsync) {
            status.textContent =
                "Word preview library failed to load. Check your internet connection.";
            return;
        }

        selectedFile = file;
        isRendering = true;

        previewArea.style.display = "block";
        documentPreview.innerHTML = "";

        downloadBtn.disabled = true;
        status.textContent = "Loading your Word document...";

        filenameInput.value =
            file.name.replace(/\.docx$/i, "") || "JScan-Document";

        try {
            const arrayBuffer = await file.arrayBuffer();

            await docx.renderAsync(
                arrayBuffer,
                documentPreview,
                documentPreview,
                {
                    className: "docx",
                    inWrapper: true,
                    ignoreWidth: false,
                    ignoreHeight: false,
                    ignoreFonts: false,
                    breakPages: true,
                    ignoreLastRenderedPageBreak: false,
                    experimental: false,
                    useBase64URL: true,
                    renderHeaders: true,
                    renderFooters: true,
                    renderFootnotes: true
                }
            );

            status.textContent =
                "Document loaded successfully. Review it before converting.";

            previewArea.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        } catch (error) {
            console.error("Word preview error:", error);

            selectedFile = null;
            documentPreview.innerHTML = "";

            status.textContent =
                "Unable to preview this document. Please try another .docx file.";

        } finally {
            isRendering = false;
            downloadBtn.disabled = !selectedFile;
        }
    });

    // CONVERT WORD TO PDF THROUGH LIVE FASTAPI BACKEND
    downloadBtn.addEventListener("click", async () => {
        if (!selectedFile || isRendering || isConverting) {
            status.textContent = "Please upload a Word document first.";
            return;
        }

        const safeName = (filenameInput.value || "JScan-Document")
            .trim()
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
            .replace(/\.+$/g, "")
            .trim() || "JScan-Document";

        const formData = new FormData();

        // FastAPI expects the field name "file"
        formData.append("file", selectedFile, selectedFile.name);

        isConverting = true;
        downloadBtn.disabled = true;
        downloadBtn.textContent = "Converting...";
        status.textContent =
            "Converting your Word document to PDF. Please wait...";

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(
                    errorText || `Conversion failed (${response.status}).`
                );
            }

            const contentType = response.headers.get("content-type") || "";

            if (!contentType.includes("application/pdf")) {
                throw new Error("The conversion service did not return a PDF.");
            }

            const pdfBlob = await response.blob();
            const downloadUrl = URL.createObjectURL(pdfBlob);

            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = `${safeName}.pdf`;

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

            status.textContent =
                "Conversion successful! Your PDF has been downloaded.";

        } catch (error) {
            console.error("Word-to-PDF conversion error:", error);

            status.textContent =
                "Conversion failed: " + error.message;

        } finally {
            isConverting = false;
            downloadBtn.disabled = !selectedFile;
            downloadBtn.textContent = "Download PDF";
        }
    });

    // REMOVE DOCUMENT
    resetBtn.addEventListener("click", () => {
        if (isConverting) return;

        selectedFile = null;

        fileInput.value = "";
        documentPreview.innerHTML = "";
        previewArea.style.display = "none";

        filenameInput.value = "JScan-Converted-Document";

        downloadBtn.disabled = true;
        status.textContent = "No document selected.";
    });
});
