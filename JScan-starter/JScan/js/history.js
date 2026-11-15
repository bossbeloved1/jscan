
/* ==========================================
   JSCAN - ACTIVITY HISTORY
========================================== */

document.addEventListener("DOMContentLoaded", async () => {
    "use strict";

    const db = window.jscanDB;

    const historyList = document.getElementById("historyList");
    const historyStatus = document.getElementById("historyStatus");
    const clearHistoryBtn = document.getElementById("clearHistoryBtn");

    const qrPreviewModal = document.getElementById("qrPreviewModal");
    const qrPreviewImage = document.getElementById("qrPreviewImage");
    const qrPreviewLoading = document.getElementById("qrPreviewLoading");
    const qrPreviewTitle = document.getElementById("qrPreviewTitle");
    const qrPreviewDownload = document.getElementById("qrPreviewDownload");
    const closeQrPreview = document.getElementById("closeQrPreview");
    const closeQrPreviewBtn = document.getElementById("closeQrPreviewBtn");

    let currentUser = null;
    let isDeleting = false;
    let isClearing = false;
    let isLoading = false;

    let currentPreviewUrl = null;
    let currentPreviewFileName = "jscan-qr-code.png";
    let previousFocusElement = null;

    /* ==========================================
       PAGINATION SETTINGS
    ========================================== */

    const PAGE_SIZE = 10;

    let currentPage = 1;
    let totalRecords = 0;
    let totalPages = 0;

    /* ==========================================
       CHECK REQUIRED ELEMENTS
    ========================================== */

    if (!historyList || !historyStatus || !clearHistoryBtn) {
        console.error("JScan: Required history page elements are missing.");
        return;
    }

    if (
        !qrPreviewModal ||
        !qrPreviewImage ||
        !qrPreviewLoading ||
        !qrPreviewTitle ||
        !qrPreviewDownload ||
        !closeQrPreview ||
        !closeQrPreviewBtn
    ) {
        console.error("JScan: QR preview modal elements are missing.");
        return;
    }

    /* ==========================================
       CHECK SUPABASE CONNECTION
    ========================================== */

    if (!db) {
        historyStatus.textContent =
            "Unable to connect to JScan. Please refresh the page.";
        return;
    }

    /* ==========================================
       CREATE PAGINATION CONTAINER
    ========================================== */

    const paginationContainer = document.createElement("div");

    paginationContainer.id = "historyPagination";
    paginationContainer.className = "history-pagination";

    historyList.insertAdjacentElement(
        "afterend",
        paginationContainer
    );

    /* ==========================================
       PAGINATION STYLES
    ========================================== */

    const paginationStyles = document.createElement("style");

    paginationStyles.textContent = `
        .history-pagination {
            width: 100%;
            margin: 24px 0 35px;
        }

        .history-pagination-info {
            text-align: center;
            color: var(--text-secondary, #777);
            font-size: 13px;
            margin-bottom: 16px;
        }

        .history-pagination-controls {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-wrap: wrap;
            gap: 8px;
        }

        .history-page-btn {
            min-width: 38px;
            height: 38px;
            padding: 0 11px;
            border: 1px solid var(--border-color, #ddd);
            border-radius: 8px;
            background: var(--card-bg, transparent);
            color: var(--text-color, inherit);
            cursor: pointer;
            font-size: 14px;
            transition: 0.2s ease;
        }

        .history-page-btn:hover:not(:disabled) {
            border-color: var(--blue, #2563eb);
            color: var(--blue, #2563eb);
        }

        .history-page-btn.active {
            background: var(--blue, #2563eb);
            border-color: var(--blue, #2563eb);
            color: #fff;
        }

        .history-page-btn:disabled {
            opacity: 0.45;
            cursor: not-allowed;
        }

        .history-page-ellipsis {
            padding: 0 3px;
            color: var(--text-secondary, #777);
        }

        @media (max-width: 480px) {
            .history-pagination-controls {
                gap: 5px;
            }

            .history-page-btn {
                min-width: 34px;
                height: 36px;
                padding: 0 8px;
                font-size: 13px;
            }
        }
    `;

    document.head.appendChild(paginationStyles);

    /* ==========================================
       MESSAGE HELPER
    ========================================== */

    function showMessage(message) {
        historyStatus.textContent = message;
    }

    /* ==========================================
       DATE FORMATTER
    ========================================== */

    function formatDate(date) {
        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return "Date unavailable";
        }

        return parsedDate.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
        });
    }

    /* ==========================================
       HTML ESCAPE HELPER
    ========================================== */

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }

    /* ==========================================
       GET ACTIVITY DETAILS
    ========================================== */

    function getDetails(record) {
        let details = record.details;

        if (typeof details === "string") {
            try {
                details = JSON.parse(details);
            } catch (error) {
                console.error("Unable to parse activity details:", error);
                return {};
            }
        }

        return details && typeof details === "object"
            ? details
            : {};
    }

    /* ==========================================
       GET DISPLAY NAME
    ========================================== */

    function getDisplayName(record) {
        const toolName = String(record.tool_name || "").toLowerCase();
        const details = getDetails(record);

        if (toolName.includes("qr")) {
            return details.title || record.file_name || "";
        }

        return record.file_name || "";
    }

    /* ==========================================
       TOOL ICON HELPER
    ========================================== */

    function getToolIcon(tool) {
        const name = String(tool ?? "").toLowerCase();

        if (name.includes("qr")) return "▦";
        if (name.includes("barcode")) return "▥";
        if (name.includes("compress")) return "⇣";
        if (name.includes("merge")) return "⊕";
        if (name.includes("split")) return "✂";
        if (name.includes("image")) return "▧";
        if (name.includes("word")) return "W";
        if (name.includes("ocr")) return "T";

        return "▤";
    }

    /* ==========================================
       GET QR IMAGE PATH
    ========================================== */

    function getQrImagePath(record) {
        const toolName = String(record.tool_name || "").toLowerCase();

        if (!toolName.includes("qr")) {
            return null;
        }

        const details = getDetails(record);
        const imagePath = details.image_path;

        if (
            typeof imagePath !== "string" ||
            !imagePath.trim() ||
            imagePath.startsWith("/") ||
            imagePath.includes("..")
        ) {
            return null;
        }

        if (!imagePath.startsWith(`${currentUser.id}/`)) {
            return null;
        }

        return imagePath;
    }

    /* ==========================================
       CREATE QR IMAGE SIGNED URL
    ========================================== */

    async function getQrSignedUrl(imagePath) {
        const { data, error } = await db
            .storage
            .from("qr-codes")
            .createSignedUrl(imagePath, 300);

        if (error) {
            console.error("QR image URL error:", error);
            throw error;
        }

        if (!data?.signedUrl) {
            throw new Error("Unable to retrieve the QR code image.");
        }

        return data.signedUrl;
    }

    /* ==========================================
       CLOSE QR PREVIEW
    ========================================== */

    function closePreview() {
        qrPreviewModal.classList.remove("active");
        qrPreviewModal.setAttribute("aria-hidden", "true");

        qrPreviewImage.src = "";
        qrPreviewImage.hidden = true;

        qrPreviewLoading.hidden = false;
        qrPreviewLoading.textContent = "Loading QR code...";

        currentPreviewUrl = null;
        currentPreviewFileName = "jscan-qr-code.png";

        document.body.style.overflow = "";

        if (previousFocusElement) {
            previousFocusElement.focus();
            previousFocusElement = null;
        }
    }

    /* ==========================================
       OPEN QR PREVIEW INSIDE SAME PAGE
    ========================================== */

    async function viewQrCode(imagePath, button, fileName) {
        if (button.disabled) return;

        previousFocusElement = button;

        qrPreviewModal.classList.add("active");
        qrPreviewModal.setAttribute("aria-hidden", "false");

        qrPreviewImage.src = "";
        qrPreviewImage.hidden = true;

        qrPreviewLoading.hidden = false;
        qrPreviewLoading.textContent = "Loading QR code...";

        qrPreviewTitle.textContent = "QR Code Preview";

        currentPreviewUrl = null;
        currentPreviewFileName = fileName || "jscan-qr-code.png";

        qrPreviewDownload.disabled = true;
        qrPreviewDownload.textContent = "Download";

        document.body.style.overflow = "hidden";

        button.disabled = true;
        button.textContent = "Opening...";

        try {
            const signedUrl = await getQrSignedUrl(imagePath);

            currentPreviewUrl = signedUrl;

            qrPreviewImage.onload = () => {
                qrPreviewImage.hidden = false;
                qrPreviewLoading.hidden = true;
                qrPreviewDownload.disabled = false;
            };

            qrPreviewImage.onerror = () => {
                qrPreviewImage.hidden = true;
                qrPreviewLoading.hidden = false;
                qrPreviewLoading.textContent =
                    "Unable to display this QR code. Please try again.";

                qrPreviewDownload.disabled = true;
            };

            qrPreviewImage.src = signedUrl;

        } catch (error) {
            console.error("QR viewing error:", error);

            qrPreviewLoading.textContent =
                "Unable to load this QR code. Please try again.";

            qrPreviewDownload.disabled = true;

        } finally {
            button.disabled = false;
            button.textContent = "View";
        }
    }

    /* ==========================================
       DOWNLOAD FROM URL
    ========================================== */

    async function downloadFromUrl(url, fileName) {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Unable to download the QR image.");
        }

        const imageBlob = await response.blob();
        const objectUrl = URL.createObjectURL(imageBlob);

        const link = document.createElement("a");

        link.href = objectUrl;
        link.download = fileName || "jscan-qr-code.png";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
        }, 1500);
    }

    /* ==========================================
       DOWNLOAD QR CODE
    ========================================== */

    async function downloadQrCode(imagePath, button, fileName) {
        if (button.disabled) return;

        button.disabled = true;
        button.textContent = "Downloading...";

        try {
            const signedUrl = await getQrSignedUrl(imagePath);

            await downloadFromUrl(signedUrl, fileName);

        } catch (error) {
            console.error("QR download error:", error);

            alert("Unable to download this QR code. Please try again.");

        } finally {
            button.disabled = false;
            button.textContent = "Download";
        }
    }

    /* ==========================================
       PREVIEW DOWNLOAD BUTTON
    ========================================== */

    qrPreviewDownload.addEventListener("click", async () => {
        if (!currentPreviewUrl || qrPreviewDownload.disabled) return;

        qrPreviewDownload.disabled = true;
        qrPreviewDownload.textContent = "Downloading...";

        try {
            await downloadFromUrl(
                currentPreviewUrl,
                currentPreviewFileName
            );

        } catch (error) {
            console.error("Preview download error:", error);
            alert("Unable to download this QR code. Please try again.");

        } finally {
            qrPreviewDownload.disabled = false;
            qrPreviewDownload.textContent = "Download";
        }
    });

    /* ==========================================
       PREVIEW CLOSE BUTTONS
    ========================================== */

    closeQrPreview.addEventListener("click", closePreview);
    closeQrPreviewBtn.addEventListener("click", closePreview);

    qrPreviewModal.addEventListener("click", event => {
        if (event.target === qrPreviewModal) {
            closePreview();
        }
    });

    document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" &&
            qrPreviewModal.classList.contains("active")
        ) {
            closePreview();
        }
    });

    /* ==========================================
       PAGINATION PAGE NUMBERS
    ========================================== */

    function getPageNumbers() {
        const pages = new Set();

        pages.add(1);
        pages.add(totalPages);

        for (
            let page = Math.max(1, currentPage - 2);
            page <= Math.min(totalPages, currentPage + 2);
            page++
        ) {
            pages.add(page);
        }

        return [...pages].sort((a, b) => a - b);
    }

    /* ==========================================
       RENDER PAGINATION
    ========================================== */

    function renderPagination() {
        if (totalRecords === 0) {
            paginationContainer.innerHTML = "";
            paginationContainer.hidden = true;
            return;
        }

        paginationContainer.hidden = false;

        const firstRecord = ((currentPage - 1) * PAGE_SIZE) + 1;
        const lastRecord = Math.min(
            currentPage * PAGE_SIZE,
            totalRecords
        );

        let controlsHTML = "";

        if (totalPages > 1) {
            controlsHTML += `
                <button
                    type="button"
                    class="history-page-btn"
                    data-page="${currentPage - 1}"
                    ${currentPage === 1 ? "disabled" : ""}>
                    Previous
                </button>
            `;

            const pages = getPageNumbers();
            let previousPage = 0;

            pages.forEach(page => {
                if (previousPage && page - previousPage > 1) {
                    controlsHTML += `
                        <span class="history-page-ellipsis">...</span>
                    `;
                }

                controlsHTML += `
                    <button
                        type="button"
                        class="history-page-btn ${page === currentPage ? "active" : ""}"
                        data-page="${page}"
                        ${page === currentPage ? 'aria-current="page"' : ""}>
                        ${page}
                    </button>
                `;

                previousPage = page;
            });

            controlsHTML += `
                <button
                    type="button"
                    class="history-page-btn"
                    data-page="${currentPage + 1}"
                    ${currentPage === totalPages ? "disabled" : ""}>
                    Next
                </button>
            `;
        }

        paginationContainer.innerHTML = `
            <div class="history-pagination-info">
                Showing ${firstRecord}–${lastRecord} of
                ${totalRecords} activities
            </div>

            <div class="history-pagination-controls">
                ${controlsHTML}
            </div>
        `;
    }

    /* ==========================================
       PAGINATION BUTTON EVENTS
    ========================================== */

    paginationContainer.addEventListener("click", async event => {
        const button = event.target.closest("[data-page]");

        if (!button || button.disabled || isLoading || isDeleting || isClearing) {
            return;
        }

        const requestedPage = Number(button.dataset.page);

        if (
            !Number.isInteger(requestedPage) ||
            requestedPage < 1 ||
            requestedPage > totalPages ||
            requestedPage === currentPage
        ) {
            return;
        }

        currentPage = requestedPage;

        await loadHistory();
    });

    /* ==========================================
       RENDER HISTORY
    ========================================== */

    function renderHistory(records) {
        if (!records.length) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <div style="font-size:42px;color:var(--blue)">✦</div>
                    <h2>No activity yet</h2>
                    <p>Your completed JScan activities will appear here.</p>
                    <a class="btn btn-primary" href="tools.html">
                        Explore tools
                    </a>
                </div>
            `;

            clearHistoryBtn.hidden = true;
            return;
        }

        clearHistoryBtn.hidden = false;

        historyList.innerHTML = records.map(record => {
            const imagePath = getQrImagePath(record);
            const displayName = getDisplayName(record);

            const downloadFileName = displayName
                ? `${displayName.replace(/[\\/:*?"<>|]/g, "_")}.png`
                : "jscan-qr-code.png";

            return `
                <article class="panel history-item"
                    data-history-id="${escapeHTML(record.id)}">

                    <div class="history-item-icon">
                        ${escapeHTML(getToolIcon(record.tool_name))}
                    </div>

                    <div class="history-item-content">
                        <h3>${escapeHTML(record.tool_name)}</h3>

                        <p>${escapeHTML(record.action)}</p>

                        ${displayName ? `
                            <p class="history-file-name">
                                ${escapeHTML(displayName)}
                            </p>
                        ` : ""}

                        <small>
                            ${escapeHTML(formatDate(record.created_at))}
                        </small>
                    </div>

                    <div class="history-item-actions">

                        <span class="history-status">
                            ${escapeHTML(record.status || "")}
                        </span>

                        ${imagePath ? `
                            <button
                                type="button"
                                class="btn btn-ghost view-qr-btn"
                                data-image-path="${escapeHTML(imagePath)}"
                                data-file-name="${escapeHTML(downloadFileName)}">
                                View
                            </button>

                            <button
                                type="button"
                                class="btn btn-ghost download-qr-btn"
                                data-image-path="${escapeHTML(imagePath)}"
                                data-file-name="${escapeHTML(downloadFileName)}">
                                Download
                            </button>
                        ` : ""}

                        <button
                            type="button"
                            class="btn btn-ghost delete-history-btn"
                            data-id="${escapeHTML(record.id)}">
                            Delete
                        </button>

                    </div>
                </article>
            `;
        }).join("");
    }

    /* ==========================================
       LOAD USER HISTORY - SERVER PAGINATION
    ========================================== */

    async function loadHistory() {
        if (isLoading) return false;

        isLoading = true;
        showMessage("Loading your activity history...");

        try {
            const from = (currentPage - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            const { data, error, count } = await db
                .from("activity_history")
                .select("*", { count: "exact" })
                .eq("user_id", currentUser.id)
                .order("created_at", { ascending: false })
                .range(from, to);

            if (error) {
                console.error("History loading error:", error);

                showMessage(
                    "Unable to load your history. Please try again."
                );

                return false;
            }

            totalRecords = count || 0;
            totalPages = Math.ceil(totalRecords / PAGE_SIZE);

            /* Handle a page that no longer exists after deletion */

            if (totalPages > 0 && currentPage > totalPages) {
                currentPage = totalPages;

                isLoading = false;

                return await loadHistory();
            }

            if (totalPages === 0) {
                currentPage = 1;
            }

            renderHistory(data || []);
            renderPagination();

            showMessage("");

            return true;

        } catch (error) {
            console.error("Unexpected history loading error:", error);

            showMessage(
                "Something went wrong while loading your history."
            );

            return false;

        } finally {
            isLoading = false;
        }
    }

    /* ==========================================
       DELETE SINGLE HISTORY RECORD
    ========================================== */

    async function deleteHistory(id) {
        if (isDeleting) return;

        isDeleting = true;

        try {
            const { data, error } = await db
                .from("activity_history")
                .delete()
                .eq("id", id)
                .eq("user_id", currentUser.id)
                .select("id");

            if (error) {
                console.error("History deletion error:", error);

                alert("Unable to delete this activity. Please try again.");
                return;
            }

            if (!data || data.length === 0) {
                alert(
                    "The activity was not deleted from the database. Please check your database permissions."
                );

                await loadHistory();
                return;
            }

            await loadHistory();

        } catch (error) {
            console.error("Unexpected history deletion error:", error);
            alert("Something went wrong. Please try again.");

        } finally {
            isDeleting = false;
        }
    }

    /* ==========================================
       HISTORY ACTION BUTTONS
    ========================================== */

    historyList.addEventListener("click", async event => {

        const viewButton = event.target.closest(".view-qr-btn");
        const downloadButton = event.target.closest(".download-qr-btn");
        const deleteButton = event.target.closest(".delete-history-btn");

        if (viewButton) {
            if (isDeleting || isClearing || isLoading) return;

            const imagePath = viewButton.dataset.imagePath;
            const fileName = viewButton.dataset.fileName;

            if (imagePath) {
                await viewQrCode(imagePath, viewButton, fileName);
            }

            return;
        }

        if (downloadButton) {
            if (isDeleting || isClearing || isLoading) return;

            const imagePath = downloadButton.dataset.imagePath;
            const fileName = downloadButton.dataset.fileName;

            if (imagePath) {
                await downloadQrCode(
                    imagePath,
                    downloadButton,
                    fileName
                );
            }

            return;
        }

        if (!deleteButton || isDeleting || isClearing || isLoading) {
            return;
        }

        const id = deleteButton.dataset.id;

        if (!id) return;

        if (!confirm("Delete this activity from your history?")) {
            return;
        }

        deleteButton.disabled = true;
        deleteButton.textContent = "Deleting...";

        await deleteHistory(id);
    });

    /* ==========================================
       CLEAR ALL HISTORY
    ========================================== */

    clearHistoryBtn.addEventListener("click", async () => {
        if (isClearing || isDeleting || isLoading) return;

        if (!confirm(
            "Are you sure you want to clear your entire activity history?"
        )) {
            return;
        }

        isClearing = true;
        clearHistoryBtn.disabled = true;
        clearHistoryBtn.textContent = "Clearing...";

        try {
            const { data, error } = await db
                .from("activity_history")
                .delete()
                .eq("user_id", currentUser.id)
                .select("id");

            if (error) {
                console.error("Clear history error:", error);
                alert("Unable to clear your history.");
                return;
            }

            if (!data || data.length === 0) {
                alert(
                    "No activity records were deleted. Please check your database permissions."
                );
            }

            currentPage = 1;

            await loadHistory();

        } catch (error) {
            console.error("Unexpected clear history error:", error);
            alert("Something went wrong. Please try again.");

        } finally {
            isClearing = false;
            clearHistoryBtn.disabled = false;
            clearHistoryBtn.textContent = "Clear history";
        }
    });

    /* ==========================================
       VERIFY USER SESSION
    ========================================== */

    const { data, error } = await db.auth.getSession();

    if (error || !data.session?.user) {
        window.location.replace("/login.html");
        return;
    }

    currentUser = data.session.user;

    /* ==========================================
       PROTECT PAGE AFTER LOGOUT
    ========================================== */

    const { data: authListener } = db.auth.onAuthStateChange(
        event => {
            if (event === "SIGNED_OUT") {
                window.location.replace("/login.html");
            }
        }
    );

    /* ==========================================
       INITIAL HISTORY LOAD
    ========================================== */

    await loadHistory();

    /* ==========================================
       CLEAN UP AUTH LISTENER
    ========================================== */

    window.addEventListener("pagehide", () => {
        authListener.subscription.unsubscribe();
    }, { once: true });

});
