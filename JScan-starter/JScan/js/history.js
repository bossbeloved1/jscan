
/* ==========================================
   JSCAN - ACTIVITY HISTORY
========================================== */

document.addEventListener("DOMContentLoaded", async () => {
    "use strict";

    const db = window.jscanDB;

    const historyList = document.getElementById("historyList");
    const historyStatus = document.getElementById("historyStatus");
    const clearHistoryBtn = document.getElementById("clearHistoryBtn");

    let currentUser = null;
    let isDeleting = false;
    let isClearing = false;

    /* ==========================================
       CHECK REQUIRED ELEMENTS
    ========================================== */

    if (!historyList || !historyStatus || !clearHistoryBtn) {
        console.error("JScan: Required history page elements are missing.");
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
       TOOL ICON HELPER
    ========================================== */

    function getToolIcon(tool) {
        const name = String(tool ?? "").toLowerCase();

        if (name.includes("qr")) return "▦";
        if (name.includes("compress")) return "⇣";
        if (name.includes("merge")) return "⊕";
        if (name.includes("split")) return "✂";
        if (name.includes("image")) return "▧";
        if (name.includes("word")) return "W";
        if (name.includes("ocr")) return "T";

        return "▤";
    }

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

        historyList.innerHTML = records.map(record => `
            <article class="panel history-item"
                data-history-id="${escapeHTML(record.id)}">

                <div class="history-item-icon">
                    ${escapeHTML(getToolIcon(record.tool_name))}
                </div>

                <div class="history-item-content">
                    <h3>${escapeHTML(record.tool_name)}</h3>

                    <p>${escapeHTML(record.action)}</p>

                    ${record.file_name ? `
                        <p class="history-file-name">
                            ${escapeHTML(record.file_name)}
                        </p>
                    ` : ""}

                    <small>${escapeHTML(formatDate(record.created_at))}</small>
                </div>

                <div class="history-item-actions">
                    <span class="history-status">
                        ${escapeHTML(record.status)}
                    </span>

                    <button
                        type="button"
                        class="btn btn-ghost delete-history-btn"
                        data-id="${escapeHTML(record.id)}">
                        Delete
                    </button>
                </div>
            </article>
        `).join("");
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
            const { error } = await db
                .from("activity_history")
                .delete()
                .eq("id", id)
                .eq("user_id", currentUser.id);

            if (error) {
                console.error("History deletion error:", error);

                alert("Unable to delete this activity.");
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
       DELETE BUTTON EVENT
    ========================================== */

    historyList.addEventListener("click", async event => {
        const button = event.target.closest(".delete-history-btn");

        if (!button || isDeleting || isClearing) return;

        const id = button.dataset.id;

        if (!id) return;

        if (!confirm("Delete this activity from your history?")) {
            return;
        }

        button.disabled = true;
        button.textContent = "Deleting...";

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
            const { error } = await db
                .from("activity_history")
                .delete()
                .eq("user_id", currentUser.id);

            if (error) {
                console.error("Clear history error:", error);

                alert("Unable to clear your history.");
                return;
            }

            await loadHistory();

        } catch (error) {
            console.error("Unexpected clear history error:", error);
            alert("Something went wrong. Please try again.");

        } finally {
            isClearing = false;
            clearHistoryBtn.disabled = false;
            clearHistoryBtn.textContent = "Clear History";
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
        (event) => {
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
