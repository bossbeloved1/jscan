
/* ==========================================
   JSCAN - ACTIVITY HISTORY
========================================== */

document.addEventListener("DOMContentLoaded", async () => {
    const db = window.jscanDB;

    const historyList = document.getElementById("historyList");
    const historyStatus = document.getElementById("historyStatus");
    const clearHistoryBtn = document.getElementById("clearHistoryBtn");

    let currentUser = null;
    let isDeleting = false;
    let isClearing = false;
    let authSubscription = null;

    function showMessage(message) {
        if (historyStatus) {
            historyStatus.textContent = message;
        }
    }

    if (!db) {
        showMessage("Unable to connect to JScan. Please refresh the page.");
        return;
    }

    if (!historyList || !clearHistoryBtn) {
        console.error("JScan: Required history page elements are missing.");
        showMessage("Unable to load the history page. Please refresh.");
        return;
    }

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

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }

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

    async function loadHistory() {
        showMessage("Loading your activity history...");

        const { data, error } = await db
            .from("activity_history")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("History loading error:", error);
            showMessage("Unable to load your history. Please try again.");
            return;
        }

        showMessage("");
        renderHistory(data || []);
    }

    async function deleteHistory(id) {
        if (isDeleting || isClearing) return;

        isDeleting = true;

        const buttons = historyList.querySelectorAll(".delete-history-btn");

        buttons.forEach(button => {
            button.disabled = true;
        });

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
            console.error("Unexpected deletion error:", error);
            alert("Something went wrong. Please try again.");

        } finally {
            isDeleting = false;
        }
    }

    historyList.addEventListener("click", async event => {
        const button = event.target.closest(".delete-history-btn");

        if (!button || isDeleting || isClearing) return;

        const id = button.dataset.id;

        if (!id) return;

        if (!confirm("Delete this activity from your history?")) {
            return;
        }

        button.textContent = "Deleting...";
        await deleteHistory(id);
    });

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

    // Verify the user's login session.
    try {
        const { data, error } = await db.auth.getSession();

        if (error || !data.session?.user) {
            window.location.replace("/login.html");
            return;
        }

        currentUser = data.session.user;

    } catch (error) {
        console.error("Session verification error:", error);
        window.location.replace("/login.html");
        return;
    }

    // Keep the page protected when the user signs out.
    const { data: authData } = db.auth.onAuthStateChange(event => {
        if (event === "SIGNED_OUT") {
            window.location.replace("/login.html");
        }
    });

    authSubscription = authData?.subscription;

    // Clean up the authentication listener when leaving the page.
    window.addEventListener("pagehide", () => {
        authSubscription?.unsubscribe();
    }, { once: true });

    await loadHistory();
});
