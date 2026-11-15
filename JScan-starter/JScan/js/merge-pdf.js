
document.addEventListener("DOMContentLoaded", () => {

    const pdfInput = document.getElementById("pdfInput");
    const fileList = document.getElementById("fileList");
    const fileCount = document.getElementById("fileCount");
    const mergeBtn = document.getElementById("mergeBtn");
    const clearFilesBtn = document.getElementById("clearFilesBtn");
    const mergeStatus = document.getElementById("mergeStatus");

    let selectedFiles = [];


    // DISPLAY STATUS MESSAGES
    function showStatus(message, type = "") {

        mergeStatus.textContent = message;
        mergeStatus.className = "merge-status show";

        if (type) {
            mergeStatus.classList.add(type);
        }

    }


    // FORMAT FILE SIZE
    function formatFileSize(bytes) {

        if (bytes < 1024) {
            return bytes + " B";
        }

        if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(1) + " KB";
        }

        return (bytes / (1024 * 1024)).toFixed(2) + " MB";

    }


    // DISPLAY SELECTED FILES
    function renderFiles() {

        fileList.innerHTML = "";

        fileCount.textContent = selectedFiles.length === 0
            ? "No files selected"
            : selectedFiles.length + (
                selectedFiles.length === 1
                    ? " PDF file selected"
                    : " PDF files selected"
            );

        mergeBtn.disabled = selectedFiles.length < 2;
        clearFilesBtn.disabled = selectedFiles.length === 0;


        if (selectedFiles.length === 0) {

            fileList.innerHTML = `
                <div class="empty-state">
                    <div style="font-size:35px;color:var(--blue)">▤</div>

                    <h3>No PDF files added yet</h3>

                    <p>Your selected PDF files will appear here.</p>
                </div>
            `;

            return;

        }


        selectedFiles.forEach((file, index) => {

            const item = document.createElement("div");
            item.className = "file-item";


            // FILE ICON
            const icon = document.createElement("div");
            icon.className = "file-icon";
            icon.textContent = "PDF";


            // FILE DETAILS
            const details = document.createElement("div");
            details.className = "file-details";

            const name = document.createElement("strong");
            name.textContent = file.name;

            const size = document.createElement("span");
            size.textContent = formatFileSize(file.size);

            details.appendChild(name);
            details.appendChild(size);


            // FILE ACTIONS
            const actions = document.createElement("div");
            actions.className = "file-actions";


            // MOVE UP BUTTON
            const upButton = document.createElement("button");

            upButton.type = "button";
            upButton.className = "file-action";
            upButton.textContent = "↑";
            upButton.title = "Move up";
            upButton.setAttribute(
                "aria-label",
                "Move " + file.name + " up"
            );

            upButton.disabled = index === 0;

            upButton.addEventListener("click", () => {
                moveFile(index, -1);
            });


            // MOVE DOWN BUTTON
            const downButton = document.createElement("button");

            downButton.type = "button";
            downButton.className = "file-action";
            downButton.textContent = "↓";
            downButton.title = "Move down";
            downButton.setAttribute(
                "aria-label",
                "Move " + file.name + " down"
            );

            downButton.disabled = index === selectedFiles.length - 1;

            downButton.addEventListener("click", () => {
                moveFile(index, 1);
            });


            // REMOVE BUTTON
            const removeButton = document.createElement("button");

            removeButton.type = "button";
            removeButton.className = "file-action remove-button";
            removeButton.textContent = "×";
            removeButton.title = "Remove file";
            removeButton.setAttribute(
                "aria-label",
                "Remove " + file.name
            );

            removeButton.addEventListener("click", () => {
                removeFile(index);
            });


            actions.appendChild(upButton);
            actions.appendChild(downButton);
            actions.appendChild(removeButton);

            item.appendChild(icon);
            item.appendChild(details);
            item.appendChild(actions);

            fileList.appendChild(item);

        });

    }


    // CHANGE FILE ORDER
    function moveFile(index, direction) {

        const newIndex = index + direction;

        if (newIndex < 0 || newIndex >= selectedFiles.length) {
            return;
        }

        const temporary = selectedFiles[index];

        selectedFiles[index] = selectedFiles[newIndex];
        selectedFiles[newIndex] = temporary;

        renderFiles();

    }


    // REMOVE A FILE
    function removeFile(index) {

        selectedFiles.splice(index, 1);

        renderFiles();

        showStatus("File removed from the list.");

    }


    // SELECT PDF FILES
    pdfInput.addEventListener("change", () => {

        const files = Array.from(pdfInput.files);

        let addedCount = 0;

        files.forEach(file => {

            const isPdf =
                file.type === "application/pdf" ||
                file.name.toLowerCase().endsWith(".pdf");

            if (!isPdf) {
                return;
            }


            // PREVENT DUPLICATE FILES
            const alreadyAdded = selectedFiles.some(existing =>
                existing.name === file.name &&
                existing.size === file.size &&
                existing.lastModified === file.lastModified
            );


            if (!alreadyAdded) {

                selectedFiles.push(file);

                addedCount++;

            }

        });


        if (addedCount > 0) {

            renderFiles();

            showStatus(
                addedCount + (
                    addedCount === 1
                        ? " PDF file added successfully."
                        : " PDF files added successfully."
                ),
                "success"
            );

        } else if (files.length > 0) {

            showStatus(
                "No new PDF files were added. Check the selected files.",
                "error"
            );

        }


        // ALLOW SELECTING THE SAME FILE AGAIN AFTER REMOVAL
        pdfInput.value = "";

    });


    // CLEAR ALL FILES
    clearFilesBtn.addEventListener("click", () => {

        selectedFiles = [];

        renderFiles();

        mergeStatus.className = "merge-status";
        mergeStatus.textContent = "";

    });


    // MERGE PDF FILES
    mergeBtn.addEventListener("click", async () => {

        if (selectedFiles.length < 2) {

            showStatus(
                "Please select at least two PDF files.",
                "error"
            );

            return;

        }


        // CHECK PDF LIBRARY
        if (!window.PDFLib) {

            showStatus(
                "The PDF library could not load. Check your internet connection and refresh the page.",
                "error"
            );

            return;

        }


        mergeBtn.disabled = true;
        mergeBtn.textContent = "Merging PDFs...";

        showStatus(
            "Please wait while your PDF files are being merged."
        );


        try {

            // CREATE A NEW PDF DOCUMENT
            const mergedPdf = await PDFLib.PDFDocument.create();


            // PROCESS EACH SELECTED PDF
            for (const file of selectedFiles) {

                const arrayBuffer = await file.arrayBuffer();

                const pdf = await PDFLib.PDFDocument.load(arrayBuffer);

                const copiedPages = await mergedPdf.copyPages(
                    pdf,
                    pdf.getPageIndices()
                );


                // ADD COPIED PAGES IN SELECTED ORDER
                copiedPages.forEach(page => {

                    mergedPdf.addPage(page);

                });

            }


            // SAVE MERGED PDF
            const mergedBytes = await mergedPdf.save();

            const blob = new Blob(
                [mergedBytes],
                { type: "application/pdf" }
            );


            // DOWNLOAD MERGED FILE
            const downloadUrl = URL.createObjectURL(blob);

            const downloadLink = document.createElement("a");

            downloadLink.href = downloadUrl;

            downloadLink.download = "JScan-Merged-Document.pdf";

            document.body.appendChild(downloadLink);

            downloadLink.click();

            downloadLink.remove();


            // RELEASE TEMPORARY DOWNLOAD URL
            setTimeout(() => {

                URL.revokeObjectURL(downloadUrl);

            }, 1000);


            showStatus(
                "Success! Your PDF files have been merged and downloaded.",
                "success"
            );


        } catch (error) {

            console.error("JScan PDF merge error:", error);

            showStatus(
                "Unable to merge the selected PDFs. One or more files may be damaged, encrypted or unsupported. Please check the files and try again.",
                "error"
            );

        } finally {

            mergeBtn.disabled = selectedFiles.length < 2;

            mergeBtn.textContent = "Merge PDF files →";

        }

    });


    // INITIAL DISPLAY
    renderFiles();

});
