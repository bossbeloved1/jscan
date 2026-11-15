
document.addEventListener("DOMContentLoaded", async () => {
    const db = window.jscanDB;

    const historyList = document.getElementById("historyList");
    const historyStatus = document.getElementById("historyStatus");
    const clearHistoryBtn = document.getElementById("clearHistoryBtn");

    if (!db) {
        historyStatus.textContent =
            "Unable to connect to JScan. Please refresh the page.";
        return;
    }

    let currentUser = null;

    function showMessage(message) {
        historyStatus.textContent = message;
    }

    function formatDate(date) {
        return new Date(date).toLocaleString(undefined, {
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
        const name = tool.toLowerCase();

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
    }

    historyList.addEventListener("click", async event => {
        const button = event.target.closest(".delete-history-btn");

        if (!button) return;

        const id = button.dataset.id;

        if (!id) return;

        if (!confirm("Delete this activity from your history?")) {
            return;
        }

        button.disabled = true;
        button.textContent = "Deleting...";

        await deleteHistory(id);
    });

    clearHistoryBtn.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to clear your entire activity history?")) {
            return;
        }

        clearHistoryBtn.disabled = true;

        const { error } = await db
            .from("activity_history")
            .delete()
            .eq("user_id", currentUser.id);

        clearHistoryBtn.disabled = false;

        if (error) {
            console.error("Clear history error:", error);
            alert("Unable to clear your history.");
            return;
        }

        await loadHistory();
    });

    // Verify the user's login session.
    const { data, error } = await db.auth.getSession();

    if (error || !data.session?.user) {
        window.location.replace("login.html");
        return;
    }

    currentUser = data.session.user;

    // Keep the page protected if the user logs out.
    db.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT" || !session?.user) {
            window.location.replace("login.html");
        }
    });

    await loadHistory();
});
