
document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);

  const STORAGE_KEY = "jscan_project_writer_documents_v2";

  const categories = {
    academic: {
      name: "Academic Projects",
      description: "Tell us about your school project or research work.",
      fields: [
        { name: "topic", label: "What is your project topic?", placeholder: "Enter your project topic", type: "textarea", required: true },
        { name: "course", label: "Course or department", placeholder: "e.g. Biochemistry", required: true },
        { name: "school", label: "School or institution", placeholder: "Enter your institution" },
        { name: "chapters", label: "How many chapters do you want?", type: "select", options: ["3 Chapters", "4 Chapters", "5 Chapters", "6 Chapters"], required: true },
        { name: "references", label: "Preferred referencing style", type: "select", options: ["APA", "MLA", "Harvard", "Chicago", "IEEE", "No preference"] },
        { name: "instructions", label: "Additional instructions", placeholder: "Any specific instructions or guidelines?", type: "textarea" }
      ]
    },
    business: {
      name: "Business Writing",
      description: "Tell us about the business document you want to prepare.",
      fields: [
        { name: "documentType", label: "What do you want to write?", type: "select", options: ["Business plan", "Business proposal", "Feasibility study", "Business report", "Marketing plan", "Other"], required: true },
        { name: "business", label: "What kind of business do you want to plan?", placeholder: "e.g. A fashion store, restaurant or technology company", type: "textarea", required: true },
        { name: "location", label: "Where will the business operate?", placeholder: "Enter the city or country" },
        { name: "budget", label: "Estimated startup budget", placeholder: "e.g. ₦2,000,000" },
        { name: "customers", label: "Who are your target customers?", placeholder: "Describe your intended customers", type: "textarea" },
        { name: "instructions", label: "Additional information", placeholder: "Other details you want included", type: "textarea" }
      ]
    },
    script: {
      name: "Script Writing",
      description: "Give us the basic idea behind your script or story.",
      fields: [
        { name: "title", label: "What is the title of your script?", placeholder: "Enter your script title", required: true },
        { name: "scriptType", label: "What type of script do you want?", type: "select", options: ["Movie script", "Short film", "Stage play", "YouTube script", "TV series", "Documentary", "Other"], required: true },
        { name: "genre", label: "What is the genre?", type: "select", options: ["Drama", "Comedy", "Romance", "Action", "Thriller", "Horror", "Documentary", "Other"] },
        { name: "story", label: "What is the story about?", placeholder: "Give us a short description of your story", type: "textarea", required: true },
        { name: "characters", label: "Main characters", placeholder: "Describe the main characters", type: "textarea" },
        { name: "instructions", label: "Additional ideas or instructions", placeholder: "Any scenes, messages or details you want included?", type: "textarea" }
      ]
    },
    other: {
      name: "Other Documents",
      description: "Tell us what kind of document you need.",
      fields: [
        { name: "documentType", label: "What do you want to write?", type: "select", options: ["Report", "Article", "Speech", "Formal letter", "Proposal", "Essay", "Other"], required: true },
        { name: "title", label: "Document title or topic", placeholder: "Enter the title or topic", required: true },
        { name: "audience", label: "Who is this document for?", placeholder: "Describe your intended audience" },
        { name: "purpose", label: "What is the purpose?", placeholder: "What should this document achieve?", type: "textarea" },
        { name: "instructions", label: "Additional instructions", placeholder: "Anything else we should know?", type: "textarea" }
      ]
    }
  };

  const screens = [
    "pwCategoryScreen",
    "pwMethodScreen",
    "pwAiScreen",
    "pwManualScreen",
    "pwLibraryScreen",
    "pwAiReviewScreen"
  ];

  let selectedCategory = "";
  let currentDocumentId = null;
  let autosaveTimer = null;
  let lastAiAnswers = {};

  function showScreen(screenId) {
    screens.forEach(id => {
      $(id).hidden = id !== screenId;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getDocuments() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch (error) {
      console.error("Could not read saved documents:", error);
      return [];
    }
  }

  function storeDocuments(documents) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
      return true;
    } catch (error) {
      console.error("Could not save documents:", error);
      $("pwSaveStatus").textContent = "Could not save. Browser storage may be full.";
      return false;
    }
  }

  function makeId() {
    return "pw_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
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

  function openCategory(category) {
    if (!categories[category]) return;

    selectedCategory = category;
    $("pwSelectedCategory").textContent = categories[category].name;
    showScreen("pwMethodScreen");
  }

  // CATEGORY SELECTION
  document.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", () => {
      openCategory(button.dataset.category);
    });
  });

  $("pwBackCategories").addEventListener("click", () => {
    showScreen("pwCategoryScreen");
  });

  // AI FORM CREATION
  function buildAiForm() {
    const category = categories[selectedCategory];
    if (!category) return;

    $("pwAiDescription").textContent = category.description;

    $("pwAiFields").innerHTML = category.fields.map(field => {
      const id = "pw_ai_" + field.name;
      const required = field.required ? "required" : "";
      let control = "";

      if (field.type === "select") {
        control = `
          <select id="${id}" name="${field.name}" ${required}>
            <option value="">Choose an option</option>
            ${field.options.map(option =>
              `<option value="${escapeHTML(option)}">${escapeHTML(option)}</option>`
            ).join("")}
          </select>`;
      } else if (field.type === "textarea") {
        control = `
          <textarea id="${id}" name="${field.name}"
            placeholder="${escapeHTML(field.placeholder || "")}"
            ${required}></textarea>`;
      } else {
        control = `
          <input id="${id}" name="${field.name}"
            type="text"
            placeholder="${escapeHTML(field.placeholder || "")}"
            ${required}>`;
      }

      return `
        <div class="pw-field">
          <label for="${id}">${escapeHTML(field.label)}${field.required ? " *" : ""}</label>
          ${control}
        </div>`;
    }).join("");

    showScreen("pwAiScreen");
  }

  $("pwChooseAI").addEventListener("click", buildAiForm);

  $("pwBackMethods").addEventListener("click", () => {
    showScreen("pwMethodScreen");
  });

  // COLLECT AI BRIEF
  $("pwAiForm").addEventListener("submit", event => {
    event.preventDefault();

    const category = categories[selectedCategory];
    if (!category) return;

    const answers = {};

    category.fields.forEach(field => {
      const input = $("pw_ai_" + field.name);
      answers[field.name] = input ? input.value.trim() : "";
    });

    lastAiAnswers = answers;

    const summary = [
      `<p><strong>Category:</strong> ${escapeHTML(category.name)}</p>`,
      ...category.fields
        .filter(field => answers[field.name])
        .map(field => `
          <div style="margin-bottom:14px">
            <strong>${escapeHTML(field.label)}</strong>
            <p>${escapeHTML(answers[field.name]).replace(/\n/g, "<br>")}</p>
          </div>
        `)
    ];

    $("pwAiSummary").innerHTML = summary.join("");
    showScreen("pwAiReviewScreen");
  });

  $("pwBackAiForm").addEventListener("click", () => {
    buildAiForm();

    Object.entries(lastAiAnswers).forEach(([name, value]) => {
      const input = $("pw_ai_" + name);
      if (input) input.value = value;
    });
  });

  // MANUAL WRITING
  function newManualDocument() {
    currentDocumentId = makeId();

    $("pwTitle").value = "";
    $("pwEditor").innerHTML = "";
    $("pwWordCount").textContent = "0 words";
    $("pwSaveStatus").textContent = "New document";

    $("pwTitle").focus();
    showScreen("pwManualScreen");
  }

  $("pwChooseManual").addEventListener("click", newManualDocument);

  $("pwBackMethodsFromEditor").addEventListener("click", () => {
    showScreen("pwMethodScreen");
  });

  $("pwNewDocument").addEventListener("click", () => {
    if (($("pwEditor").innerText.trim() || $("pwTitle").value.trim()) &&
        !confirm("Start a new document? Save your current work first if you want to keep it.")) {
      return;
    }
    newManualDocument();
  });

  // WORD COUNT
  function updateWordCount() {
    const text = $("pwEditor").innerText.trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    $("pwWordCount").textContent = words + (words === 1 ? " word" : " words");
  }

  $("pwEditor").addEventListener("input", () => {
    updateWordCount();
    $("pwSaveStatus").textContent = "Unsaved changes";

    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveDocument, 900);
  });

  $("pwTitle").addEventListener("input", () => {
    $("pwSaveStatus").textContent = "Unsaved changes";

    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveDocument, 900);
  });

  // FORMATTING TOOLBAR
  document.querySelectorAll("[data-command]").forEach(button => {
    button.addEventListener("mousedown", event => event.preventDefault());

    button.addEventListener("click", () => {
      const command = button.dataset.command;
      const value = button.dataset.value || null;

      $("pwEditor").focus();

      try {
        document.execCommand(command, false, value);
        updateWordCount();
      } catch (error) {
        console.error("Formatting command failed:", error);
      }
    });
  });

  // SAVE DOCUMENT
  function saveDocument() {
    const title = $("pwTitle").value.trim() || "Untitled document";
    const content = $("pwEditor").innerHTML;

    if (!content.trim() && !title.trim()) return;

    const documents = getDocuments();
    const now = new Date().toISOString();

    let document = documents.find(item => item.id === currentDocumentId);

    if (!document) {
      document = {
        id: currentDocumentId || makeId(),
        title,
        content,
        category: selectedCategory,
        createdAt: now,
        updatedAt: now
      };

      currentDocumentId = document.id;
      documents.unshift(document);
    } else {
      document.title = title;
      document.content = content;
      document.category = selectedCategory;
      document.updatedAt = now;
    }

    if (storeDocuments(documents)) {
      $("pwSaveStatus").textContent = "Saved just now";
    }
  }

  $("pwSave").addEventListener("click", saveDocument);

  // DOCUMENT LIBRARY
  function renderLibrary() {
    const search = $("pwLibrarySearch").value.toLowerCase().trim();

    const documents = getDocuments().filter(document =>
      (document.title || "").toLowerCase().includes(search)
    );

    if (!documents.length) {
      $("pwDocumentList").innerHTML = `
        <div class="pw-empty">
          No saved documents found.
        </div>`;
      return;
    }

    $("pwDocumentList").innerHTML = documents.map(document => `
      <div class="pw-document">
        <div>
          <strong>${escapeHTML(document.title)}</strong>
          <small>${escapeHTML(categories[document.category]?.name || "Document")} ·
            ${document.updatedAt ? new Date(document.updatedAt).toLocaleDateString() : ""}
          </small>
        </div>
        <button type="button" data-open-document="${escapeHTML(document.id)}">Open</button>
      </div>
    `).join("");
  }

  $("pwMyDocuments").addEventListener("click", () => {
    $("pwLibrarySearch").value = "";
    renderLibrary();
    showScreen("pwLibraryScreen");
  });

  $("pwLibrarySearch").addEventListener("input", renderLibrary);

  $("pwDocumentList").addEventListener("click", event => {
    const button = event.target.closest("[data-open-document]");
    if (!button) return;

    const document = getDocuments().find(item => item.id === button.dataset.openDocument);
    if (!document) return;

    currentDocumentId = document.id;
    selectedCategory = categories[document.category] ? document.category : "other";

    $("pwTitle").value = document.title || "";
    $("pwEditor").innerHTML = document.content || "";
    $("pwSaveStatus").textContent = "Saved document opened";

    updateWordCount();
    showScreen("pwManualScreen");
  });

  $("pwBackFromLibrary").addEventListener("click", () => {
    showScreen("pwManualScreen");
  });

  // RENAME
  $("pwRename").addEventListener("click", () => {
    const oldTitle = $("pwTitle").value.trim();
    const newTitle = prompt("Enter a new document title:", oldTitle);

    if (newTitle === null) return;

    if (!newTitle.trim()) {
      alert("Please enter a document title.");
      return;
    }

    $("pwTitle").value = newTitle.trim();
    saveDocument();
  });

  // DELETE
  $("pwDelete").addEventListener("click", () => {
    if (!currentDocumentId) {
      alert("There is no saved document selected.");
      return;
    }

    if (!confirm("Are you sure you want to delete this document?")) return;

    const documents = getDocuments().filter(item => item.id !== currentDocumentId);

    if (storeDocuments(documents)) {
      currentDocumentId = makeId();
      $("pwTitle").value = "";
      $("pwEditor").innerHTML = "";
      $("pwWordCount").textContent = "0 words";
      $("pwSaveStatus").textContent = "Document deleted";
    }
  });

  // EXPORT WORD
  $("pwWord").addEventListener("click", () => {
    const title = $("pwTitle").value.trim() || "JScan Document";
    const content = $("pwEditor").innerHTML;

    if (!content.trim()) {
      alert("Write something before exporting.");
      return;
    }

    const wordDocument = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${escapeHTML(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.7; padding: 35px; }
          h1, h2, h3 { margin-top: 24px; }
        </style>
      </head>
      <body>
        <h1>${escapeHTML(title)}</h1>
        ${content}
      </body>
      </html>`;

    const blob = new Blob(["\ufeff", wordDocument], {
      type: "application/msword"
    });

    downloadBlob(blob, safeFilename(title) + ".doc");
  });

  // EXPORT PDF
  $("pwPdf").addEventListener("click", () => {
    const title = $("pwTitle").value.trim() || "JScan Document";
    const content = $("pwEditor").innerHTML;

    if (!content.trim()) {
      alert("Write something before exporting.");
      return;
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      alert("Your browser blocked the print window. Allow pop-ups for this site and try again.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${escapeHTML(title)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            font-size: 12pt;
            line-height: 1.7;
            color: #111;
            max-width: 800px;
            margin: 35px auto;
            padding: 0 25px;
          }
          h1, h2, h3 { page-break-after: avoid; }
          @page { size: A4; margin: 20mm; }
        </style>
      </head>
      <body>
        <h1>${escapeHTML(title)}</h1>
        ${content}
        <script>
          window.onload = function() {
            window.print();
          };
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  });

  function safeFilename(name) {
    return name.replace(/[\\/:*?"<>|]/g, "-").trim() || "JScan-Document";
  }

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

  // START ON CATEGORY SELECTION
  showScreen("pwCategoryScreen");
});
