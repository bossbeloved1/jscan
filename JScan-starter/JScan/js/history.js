
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
    let currentPreviewUrl = null;
    let currentPreviewFileName = "jscan-qr-code.png";
    let previousFocusElement = null;

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
            };

            qrPreviewImage.onerror = () => {
                qrPreviewImage.hidden = true;
                qrPreviewLoading.hidden = false;
                qrPreviewLoading.textContent =
                    "Unable to display this QR code. Please try again.";

                qrPreviewDownload.disabled = true;
            };

            qrPreviewImage.src = signedUrl;

            qrPreviewDownload.disabled = false;

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
       LOAD USER HISTORY
    ========================================== */

    async function loadHistory() {
        showMessage("Loading your activity history...");

        const { data, error } = await db
            .from("activity_history")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("History loading error:", error);

            showMessage(
                "Unable to load your history. Please try again."
            );

            return false;
        }

        showMessage("");
        renderHistory(data || []);

        return true;
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
            if (isDeleting || isClearing) return;

            const imagePath = viewButton.dataset.imagePath;
            const fileName = viewButton.dataset.fileName;

            if (imagePath) {
                await viewQrCode(imagePath, viewButton, fileName);
            }

            return;
        }

        if (downloadButton) {
            if (isDeleting || isClearing) return;

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

        if (!deleteButton || isDeleting || isClearing) return;

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
        if (isClearing || isDeleting) return;

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
