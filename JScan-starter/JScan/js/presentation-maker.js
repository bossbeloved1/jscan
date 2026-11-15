
document.addEventListener("DOMContentLoaded", () => {
    if (typeof fabric === "undefined") {
        alert("The presentation editor could not load. Check your internet connection and refresh the page.");
        return;
    }

    const $ = id => document.getElementById(id);

    const required = [
        "pmCanvas", "pmSlideList", "pmSlideCount", "pmBackground",
        "pmAddSlide", "pmPrevSlide", "pmNextSlide", "pmUndo",
        "pmRedo", "pmAddText", "pmAddRect", "pmAddCircle",
        "pmAddImage", "pmImageInput", "pmDuplicate", "pmDelete",
        "pmExportProject", "pmTextValue", "pmFontFamily",
        "pmFontSize", "pmObjectColor", "pmBold", "pmItalic",
        "pmUnderline", "pmSelectionInfo", "pmObjectControls",
        "pmTextControls", "pmFontControls", "pmSizeControls",
        "pmColorControls", "pmTextStyleControls"
    ];

    const missing = required.filter(id => !$(id));
    if (missing.length) {
        console.error("Presentation Maker: Missing HTML elements:", missing);
        alert("Some Presentation Maker HTML elements are missing. Check the browser console.");
        return;
    }

    const canvas = new fabric.Canvas("pmCanvas", {
        width: 960,
        height: 540,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
        selection: true,
        uniformScaling: true
    });

    const slideList = $("pmSlideList");
    const slideCount = $("pmSlideCount");
    const backgroundInput = $("pmBackground");
    const selectionInfo = $("pmSelectionInfo");
    const objectControls = $("pmObjectControls");
    const textControls = $("pmTextControls");
    const fontControls = $("pmFontControls");
    const sizeControls = $("pmSizeControls");
    const colorControls = $("pmColorControls");
    const textStyleControls = $("pmTextStyleControls");

    let slides = [];
    let activeSlideIndex = 0;
    let isLoadingSlide = false;
    let historyTimer = null;
    let smartGuidesEnabled = true;
    let snapEnabled = true;
    let activeGuides = [];
    let shapeMenu = null;

    const GUIDE_TOLERANCE = 7;

    const createSlide = name => ({
        id: "slide-" + Date.now() + "-" + Math.random().toString(16).slice(2),
        name,
        background: "#ffffff",
        json: null,
        preview: "",
        notes: "",
        history: [],
        historyIndex: -1
    });

    function getSlide() {
        return slides[activeSlideIndex];
    }

    function isTextObject(object) {
        return object && ["i-text", "textbox", "text"].includes(object.type);
    }

    function toHexColor(color) {
        if (typeof color !== "string") return null;
        if (/^#[0-9a-f]{6}$/i.test(color)) return color;

        const match = color.match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/i);
        if (!match) return null;

        return "#" + match.slice(1).map(value =>
            Number(value).toString(16).padStart(2, "0")
        ).join("");
    }

    function updateSlideCounter() {
        slideCount.textContent = `Slide ${activeSlideIndex + 1} of ${slides.length}`;

        $("pmPrevSlide").disabled = activeSlideIndex === 0;
        $("pmNextSlide").disabled = activeSlideIndex === slides.length - 1;
    }

    function saveCurrentSlide() {
        const slide = getSlide();
        if (!slide || isLoadingSlide) return;

        slide.json = canvas.toJSON();
        slide.background = canvas.backgroundColor || slide.background;

        if ($("pmSpeakerNotes")) {
            slide.notes = $("pmSpeakerNotes").value;
        }

        try {
            slide.preview = canvas.toDataURL({
                format: "png",
                multiplier: 0.22
            });
        } catch (error) {
            console.warn("Could not update slide preview:", error);
        }
    }

    function renderSlideList() {
        slideList.innerHTML = "";

        slides.forEach((slide, index) => {
            const item = document.createElement("div");
            item.className = "pm-slide-item";

            const button = document.createElement("button");
            button.type = "button";
            button.className = "pm-slide-thumb" +
                (index === activeSlideIndex ? " active" : "");
            button.title = `Open slide ${index + 1}`;

            if (slide.preview) {
                button.style.backgroundImage = `url("${slide.preview}")`;
                button.style.backgroundSize = "cover";
                button.style.backgroundPosition = "center";
            } else {
                button.style.backgroundColor = slide.background || "#ffffff";
            }

            button.addEventListener("click", () => switchSlide(index));

            const number = document.createElement("span");
            number.className = "pm-slide-number";
            number.textContent = `Slide ${index + 1}`;

            item.append(button, number);
            slideList.appendChild(item);
        });

        updateSlideCounter();
    }

    function updateHistoryButtons() {
        const slide = getSlide();

        $("pmUndo").disabled = !slide || slide.historyIndex <= 0;
        $("pmRedo").disabled = !slide ||
            slide.historyIndex >= slide.history.length - 1;
    }

    function pushHistory() {
        if (isLoadingSlide) return;

        const slide = getSlide();
        if (!slide) return;

        clearTimeout(historyTimer);

        historyTimer = setTimeout(() => {
            if (slide !== getSlide() || isLoadingSlide) return;

            const snapshot = JSON.stringify(canvas.toJSON());

            if (slide.history[slide.historyIndex] === snapshot) return;

            slide.history = slide.history.slice(0, slide.historyIndex + 1);
            slide.history.push(snapshot);

            if (slide.history.length > 60) {
                slide.history.shift();
            }

            slide.historyIndex = slide.history.length - 1;
            saveCurrentSlide();
            updateHistoryButtons();
            renderSlideList();
        }, 220);
    }

    function initialiseSlideHistory(slide) {
        slide.history = [JSON.stringify(canvas.toJSON())];
        slide.historyIndex = 0;
        slide.json = canvas.toJSON();
        updateHistoryButtons();
    }

    function restoreSnapshot(snapshot) {
        if (!snapshot) return;

        clearTimeout(historyTimer);
        isLoadingSlide = true;
        canvas.discardActiveObject();

        canvas.loadFromJSON(snapshot, () => {
            canvas.renderAll();
            isLoadingSlide = false;
            updateSelectionPanel();
            updateHistoryButtons();
            saveCurrentSlide();
            renderSlideList();
        });
    }

    function undo() {
        const slide = getSlide();
        if (!slide || slide.historyIndex <= 0) return;

        slide.historyIndex--;
        restoreSnapshot(slide.history[slide.historyIndex]);
    }

    function redo() {
        const slide = getSlide();
        if (!slide || slide.historyIndex >= slide.history.length - 1) return;

        slide.historyIndex++;
        restoreSnapshot(slide.history[slide.historyIndex]);
    }

    function addDefaultContent() {
        const title = new fabric.IText("Your Presentation Title", {
            left: 90,
            top: 150,
            width: 780,
            fontFamily: "Arial",
            fontSize: 48,
            fontWeight: "bold",
            fill: "#172554",
            textAlign: "center",
            originX: "left",
            originY: "top"
        });

        const subtitle = new fabric.IText("Click here to add your subtitle", {
            left: 150,
            top: 235,
            width: 660,
            fontFamily: "Arial",
            fontSize: 25,
            fill: "#64748b",
            textAlign: "center"
        });

        canvas.add(title, subtitle);
        canvas.setActiveObject(title);
        canvas.renderAll();
        updateSelectionPanel();
    }

    function switchSlide(index) {
        if (index < 0 || index >= slides.length || index === activeSlideIndex) return;

        clearTimeout(historyTimer);
        saveCurrentSlide();

        activeSlideIndex = index;
        const slide = getSlide();

        isLoadingSlide = true;
        canvas.discardActiveObject();
        canvas.clear();

        canvas.setBackgroundColor(slide.background || "#ffffff", () => {
            const finishLoading = () => {
                canvas.renderAll();
                isLoadingSlide = false;
                backgroundInput.value = slide.background || "#ffffff";

                if ($("pmSpeakerNotes")) {
                    $("pmSpeakerNotes").value = slide.notes || "";
                }

                clearGuides();
                updateSelectionPanel();
                renderSlideList();
                updateHistoryButtons();
            };

            if (slide.json) {
                canvas.loadFromJSON(slide.json, finishLoading);
            } else {
                finishLoading();
            }
        });
    }

    function addSlide() {
        clearTimeout(historyTimer);
        saveCurrentSlide();

        const slide = createSlide(`Slide ${slides.length + 1}`);
        slides.push(slide);
        activeSlideIndex = slides.length - 1;

        isLoadingSlide = true;
        canvas.clear();

        canvas.setBackgroundColor("#ffffff", () => {
            canvas.renderAll();
            isLoadingSlide = false;

            backgroundInput.value = "#ffffff";

            if ($("pmSpeakerNotes")) {
                $("pmSpeakerNotes").value = "";
            }

            initialiseSlideHistory(slide);
            updateSelectionPanel();
            renderSlideList();
        });
    }

    // --------------------------------------------------
    // OBJECT CREATION
    // --------------------------------------------------

    function addText(text = "Double-click to edit text", options = {}) {
        const object = new fabric.IText(text, {
            left: 300,
            top: 220,
            fontFamily: "Arial",
            fontSize: 36,
            fill: "#222222",
            editable: true,
            padding: 5,
            ...options
        });

        canvas.add(object);
        canvas.setActiveObject(object);
        canvas.renderAll();
        updateSelectionPanel();
        pushHistory();
    }

    function addRectangle() {
        addShape("rectangle");
    }

    function addCircle() {
        addShape("circle");
    }

    function addShape(type) {
        let shape;
        const common = {
            left: 355,
            top: 190,
            fill: "#2563eb",
            stroke: null,
            objectCaching: false,
            lockUniScaling: true,
            cornerStyle: "circle",
            transparentCorners: false
        };

        switch (type) {
            case "rectangle":
                shape = new fabric.Rect({
                    ...common,
                    width: 240,
                    height: 145,
                    rx: 0,
                    ry: 0
                });
                break;

            case "rounded-rectangle":
                shape = new fabric.Rect({
                    ...common,
                    width: 240,
                    height: 145,
                    rx: 18,
                    ry: 18
                });
                break;

            case "square":
                shape = new fabric.Rect({
                    ...common,
                    width: 150,
                    height: 150
                });
                break;

            case "circle":
                shape = new fabric.Circle({
                    ...common,
                    radius: 75
                });
                break;

            case "half-circle":
                shape = new fabric.Path(
                    "M 0 100 A 100 100 0 0 1 200 100 L 0 100 Z",
                    {
                        ...common,
                        left: 380,
                        top: 190,
                        scaleX: 0.75,
                        scaleY: 0.75
                    }
                );
                break;

            case "triangle":
                shape = new fabric.Triangle({
                    ...common,
                    width: 160,
                    height: 150
                });
                break;

            case "trapezium":
                shape = new fabric.Polygon([
                    { x: 35, y: 0 },
                    { x: 165, y: 0 },
                    { x: 200, y: 110 },
                    { x: 0, y: 110 }
                ], common);
                break;

            case "parallelogram":
                shape = new fabric.Polygon([
                    { x: 45, y: 0 },
                    { x: 200, y: 0 },
                    { x: 155, y: 110 },
                    { x: 0, y: 110 }
                ], common);
                break;

            case "diamond":
                shape = new fabric.Polygon([
                    { x: 100, y: 0 },
                    { x: 200, y: 75 },
                    { x: 100, y: 150 },
                    { x: 0, y: 75 }
                ], common);
                break;

            case "pentagon":
                shape = new fabric.Polygon([
                    { x: 100, y: 0 },
                    { x: 195, y: 70 },
                    { x: 160, y: 180 },
                    { x: 40, y: 180 },
                    { x: 5, y: 70 }
                ], common);
                break;

            case "hexagon":
                shape = new fabric.Polygon([
                    { x: 50, y: 0 },
                    { x: 150, y: 0 },
                    { x: 200, y: 75 },
                    { x: 150, y: 150 },
                    { x: 50, y: 150 },
                    { x: 0, y: 75 }
                ], common);
                break;

            case "star":
                shape = new fabric.Polygon([
                    { x: 100, y: 0 },
                    { x: 123, y: 70 },
                    { x: 195, y: 72 },
                    { x: 138, y: 116 },
                    { x: 160, y: 190 },
                    { x: 100, y: 145 },
                    { x: 40, y: 190 },
                    { x: 62, y: 116 },
                    { x: 5, y: 72 },
                    { x: 77, y: 70 }
                ], common);
                break;

            case "arrow":
                shape = new fabric.Polygon([
                    { x: 0, y: 45 },
                    { x: 120, y: 45 },
                    { x: 120, y: 0 },
                    { x: 200, y: 75 },
                    { x: 120, y: 150 },
                    { x: 120, y: 105 },
                    { x: 0, y: 105 }
                ], common);
                break;

            case "line":
                shape = new fabric.Line([0, 0, 220, 0], {
                    left: 350,
                    top: 260,
                    stroke: "#2563eb",
                    strokeWidth: 6,
                    lockUniScaling: false
                });
                break;

            default:
                return;
        }

        if (!shape) return;

        shape.set({
            cornerStyle: "circle",
            transparentCorners: false,
            borderColor: "#2563eb",
            cornerColor: "#ffffff",
            cornerStrokeColor: "#2563eb",
            padding: 2
        });

        canvas.add(shape);
        canvas.setActiveObject(shape);
        canvas.requestRenderAll();
        updateSelectionPanel();
        pushHistory();
    }

    function addImage(file) {
        if (!file || !file.type.startsWith("image/")) return;

        const reader = new FileReader();

        reader.onload = event => {
            fabric.Image.fromURL(event.target.result, image => {
                if (!image) return;

                const maxWidth = 650;
                const maxHeight = 420;
                const scale = Math.min(
                    maxWidth / image.width,
                    maxHeight / image.height,
                    1
                );

                image.set({
                    left: 150,
                    top: 60,
                    scaleX: scale,
                    scaleY: scale,
                    lockUniScaling: true,
                    cornerStyle: "circle",
                    transparentCorners: false
                });

                canvas.add(image);
                canvas.setActiveObject(image);
                canvas.renderAll();
                updateSelectionPanel();
                pushHistory();
            });
        };

        reader.readAsDataURL(file);
    }

    // --------------------------------------------------
    // SHAPE LIBRARY MENU
    // --------------------------------------------------

    function injectStyles() {
        if ($("pmEnhancedStyles")) return;

        const style = document.createElement("style");
        style.id = "pmEnhancedStyles";
        style.textContent = `
            .pm-enhanced-panel {
                background: var(--surface, #fff);
                border: 1px solid var(--border, #ddd);
                border-radius: 12px;
                padding: 12px;
                margin: 10px 0;
                color: var(--text, #222);
            }
            .pm-enhanced-panel h4 {
                margin: 0 0 10px;
                font-size: 13px;
            }
            .pm-control-grid {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 7px;
            }
            .pm-enhanced-panel button,
            .pm-shape-menu button {
                border: 1px solid var(--border, #ddd);
                background: var(--background, #fff);
                color: var(--text, #222);
                border-radius: 8px;
                padding: 9px 7px;
                cursor: pointer;
                font-size: 12px;
                transition: .15s ease;
            }
            .pm-enhanced-panel button:hover,
            .pm-shape-menu button:hover {
                border-color: var(--blue, #2563eb);
                background: rgba(37,99,235,.08);
            }
            .pm-enhanced-panel button:disabled {
                opacity: .4;
                cursor: not-allowed;
            }
            .pm-shape-menu {
                position: absolute;
                z-index: 1000;
                width: 260px;
                max-height: 330px;
                overflow-y: auto;
                padding: 12px;
                border: 1px solid var(--border, #ddd);
                border-radius: 12px;
                background: var(--surface, #fff);
                box-shadow: 0 12px 35px rgba(0,0,0,.16);
                display: none;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
            }
            .pm-shape-menu.open { display: grid; }
            .pm-shape-menu button {
                min-height: 65px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 5px;
            }
            .pm-shape-icon {
                font-size: 24px;
                line-height: 1;
            }
            .pm-guide-toggle {
                display: flex;
                gap: 12px;
                align-items: center;
                flex-wrap: wrap;
                margin-top: 10px;
                font-size: 12px;
            }
            .pm-guide-toggle label,
            .pm-lock-toggle {
                display: flex;
                gap: 6px;
                align-items: center;
                cursor: pointer;
            }
            .pm-align-grid {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 6px;
            }
            .pm-align-grid button {
                min-height: 36px;
            }
            .pm-proportion-row {
                margin-top: 10px;
                font-size: 12px;
            }
        `;
        document.head.appendChild(style);
    }

    function createShapeMenu() {
        injectStyles();

        const oldButton = $("pmAddRect");
        const parent = oldButton.parentElement;

        const button = document.createElement("button");
        button.type = "button";
        button.id = "pmShapeLibraryButton";
        button.textContent = "Shapes ▾";
        button.className = oldButton.className || "";
        button.title = "Open shape library";

        oldButton.insertAdjacentElement("afterend", button);

        // Keep existing circle and rectangle controls available to older HTML
        // but use the new unified shape library as the main entry point.
        oldButton.style.display = "none";
        if ($("pmAddCircle")) $("pmAddCircle").style.display = "none";

        shapeMenu = document.createElement("div");
        shapeMenu.className = "pm-shape-menu";

        const shapes = [
            ["rectangle", "▭", "Rectangle"],
            ["square", "□", "Square"],
            ["rounded-rectangle", "▢", "Rounded"],
            ["circle", "●", "Circle"],
            ["half-circle", "◐", "Half circle"],
            ["triangle", "▲", "Triangle"],
            ["trapezium", "⏢", "Trapezium"],
            ["parallelogram", "▱", "Parallelogram"],
            ["diamond", "◆", "Diamond"],
            ["pentagon", "⬠", "Pentagon"],
            ["hexagon", "⬡", "Hexagon"],
            ["star", "★", "Star"],
            ["arrow", "➜", "Arrow"],
            ["line", "━", "Line"]
        ];

        shapes.forEach(([type, icon, label]) => {
            const item = document.createElement("button");
            item.type = "button";
            item.innerHTML =
                `<span class="pm-shape-icon">${icon}</span><span>${label}</span>`;

            item.addEventListener("click", () => {
                addShape(type);
                shapeMenu.classList.remove("open");
            });

            shapeMenu.appendChild(item);
        });

        parent.style.position = "relative";
        parent.appendChild(shapeMenu);

        button.addEventListener("click", event => {
            event.stopPropagation();
            shapeMenu.classList.toggle("open");
        });

        document.addEventListener("click", event => {
            if (!shapeMenu.contains(event.target) &&
                event.target !== button) {
                shapeMenu.classList.remove("open");
            }
        });
    }

    // --------------------------------------------------
    // ALIGNMENT TOOLBAR
    // --------------------------------------------------

    function createAlignmentPanel() {
        injectStyles();

        const panel = document.createElement("div");
        panel.id = "pmAlignmentPanel";
        panel.className = "pm-enhanced-panel";

        panel.innerHTML = `
            <h4>Object alignment</h4>
            <div class="pm-align-grid">
                <button type="button" data-align="left">Align left</button>
                <button type="button" data-align="center">Centre</button>
                <button type="button" data-align="right">Align right</button>
                <button type="button" data-align="top">Align top</button>
                <button type="button" data-align="middle">Middle</button>
                <button type="button" data-align="bottom">Align bottom</button>
            </div>
            <div class="pm-guide-toggle">
                <label><input type="checkbox" id="pmSmartGuides" checked> Smart guides</label>
                <label><input type="checkbox" id="pmSnapObjects" checked> Snap objects</label>
            </div>
            <div class="pm-proportion-row">
                <label class="pm-lock-toggle">
                    <input type="checkbox" id="pmUnlockProportions">
                    Allow free stretching
                </label>
            </div>
        `;

        objectControls.insertAdjacentElement("afterend", panel);

        panel.querySelectorAll("[data-align]").forEach(button => {
            button.addEventListener("click", () => {
                alignSelected(button.dataset.align);
            });
        });

        $("pmSmartGuides").addEventListener("change", event => {
            smartGuidesEnabled = event.target.checked;
            if (!smartGuidesEnabled) clearGuides();
        });

        $("pmSnapObjects").addEventListener("change", event => {
            snapEnabled = event.target.checked;
        });

        $("pmUnlockProportions").addEventListener("change", event => {
            const active = canvas.getActiveObject();
            if (!active) return;

            active.set("lockUniScaling", !event.target.checked);
            active.setCoords();
            canvas.requestRenderAll();
            pushHistory();
        });
    }

    function createTextAlignmentControls() {
        const panel = document.createElement("div");
        panel.className = "pm-enhanced-panel";
        panel.id = "pmTextAlignmentPanel";
        panel.innerHTML = `
            <h4>Text alignment</h4>
            <div class="pm-control-grid">
                <button type="button" data-text-align="left">Left</button>
                <button type="button" data-text-align="center">Centre</button>
                <button type="button" data-text-align="right">Right</button>
                <button type="button" data-text-align="justify">Justify</button>
            </div>
        `;

        textControls.appendChild(panel);

        panel.querySelectorAll("[data-text-align]").forEach(button => {
            button.addEventListener("click", () => {
                updateActiveText("textAlign", button.dataset.textAlign);
            });
        });
    }

    function alignSelected(direction) {
        const active = canvas.getActiveObject();
        if (!active) return;

        const bounds = active.getBoundingRect(true, true);
        const width = bounds.width;
        const height = bounds.height;

        let dx = 0;
        let dy = 0;

        switch (direction) {
            case "left":
                dx = -bounds.left;
                break;
            case "center":
                dx = (canvas.getWidth() - width) / 2 - bounds.left;
                break;
            case "right":
                dx = canvas.getWidth() - width - bounds.left;
                break;
            case "top":
                dy = -bounds.top;
                break;
            case "middle":
                dy = (canvas.getHeight() - height) / 2 - bounds.top;
                break;
            case "bottom":
                dy = canvas.getHeight() - height - bounds.top;
                break;
        }

        if (active.type === "activeSelection") {
            active.left += dx;
            active.top += dy;
        } else {
            active.left += dx;
            active.top += dy;
        }

        active.setCoords();
        canvas.requestRenderAll();
        pushHistory();
    }

    // --------------------------------------------------
    // SMART GUIDES AND SNAP ALIGNMENT
    // --------------------------------------------------

    function clearGuides() {
        activeGuides = [];
        if (canvas.contextTop) {
            canvas.clearContext(canvas.contextTop);
            canvas.renderTop();
        }
    }

    function drawGuides() {
        if (!smartGuidesEnabled || !canvas.contextTop) return;

        const ctx = canvas.contextTop;
        canvas.clearContext(ctx);

        ctx.save();
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);

        activeGuides.forEach(guide => {
            ctx.beginPath();

            if (guide.type === "vertical") {
                ctx.moveTo(guide.position, 0);
                ctx.lineTo(guide.position, canvas.getHeight());
            } else {
                ctx.moveTo(0, guide.position);
                ctx.lineTo(canvas.getWidth(), guide.position);
            }

            ctx.stroke();
        });

        ctx.restore();
    }

    function movingObject(event) {
        const target = event.target;
        if (!target || target.type === "activeSelection") return;

        activeGuides = [];

        const bounds = target.getBoundingRect(true, true);
        const targetPoints = {
            left: bounds.left,
            centerX: bounds.left + bounds.width / 2,
            right: bounds.left + bounds.width,
            top: bounds.top,
            centerY: bounds.top + bounds.height / 2,
            bottom: bounds.top + bounds.height
        };

        const canvasPoints = {
            left: 0,
            centerX: canvas.getWidth() / 2,
            right: canvas.getWidth(),
            top: 0,
            centerY: canvas.getHeight() / 2,
            bottom: canvas.getHeight()
        };

        const candidates = [];

        Object.entries(canvasPoints).forEach(([key, value]) => {
            candidates.push({
                axis: key.endsWith("X") || ["left", "centerX", "right"].includes(key)
                    ? "x" : "y",
                value,
                guideType: key.endsWith("X") || ["left", "centerX", "right"].includes(key)
                    ? "vertical" : "horizontal"
            });
        });

        canvas.getObjects().forEach(object => {
            if (object === target || !object.visible) return;

            const other = object.getBoundingRect(true, true);

            candidates.push(
                { axis: "x", value: other.left, guideType: "vertical" },
                { axis: "x", value: other.left + other.width / 2, guideType: "vertical" },
                { axis: "x", value: other.left + other.width, guideType: "vertical" },
                { axis: "y", value: other.top, guideType: "horizontal" },
                { axis: "y", value: other.top + other.height / 2, guideType: "horizontal" },
                { axis: "y", value: other.top + other.height, guideType: "horizontal" }
            );
        });

        let bestX = null;
        let bestY = null;

        candidates.forEach(candidate => {
            const values = candidate.axis === "x"
                ? [targetPoints.left, targetPoints.centerX, targetPoints.right]
                : [targetPoints.top, targetPoints.centerY, targetPoints.bottom];

            values.forEach(value => {
                const distance = Math.abs(candidate.value - value);
                if (distance > GUIDE_TOLERANCE) return;

                const current = candidate.axis === "x" ? bestX : bestY;

                if (!current || distance < current.distance) {
                    const match = {
                        axis: candidate.axis,
                        value: candidate.value,
                        guideType: candidate.guideType,
                        distance
                    };

                    if (candidate.axis === "x") bestX = match;
                    else bestY = match;
                }
            });
        });

        if (bestX) {
            const xDiff = bestX.value -
                (bestX.value === targetPoints.left ? targetPoints.left :
                    bestX.value === targetPoints.right ? targetPoints.right :
                        targetPoints.centerX);

            // Find the closest target edge/centre to the guide.
            const xTargets = [
                { value: targetPoints.left, offset: 0 },
                { value: targetPoints.centerX, offset: bounds.width / 2 },
                { value: targetPoints.right, offset: bounds.width }
            ];

            const nearestX = xTargets.reduce((a, b) =>
                Math.abs(bestX.value - b.value) < Math.abs(bestX.value - a.value) ? b : a
            );

            if (snapEnabled) target.left += bestX.value - nearestX.value;
            activeGuides.push({
                type: "vertical",
                position: bestX.value
            });
        }

        if (bestY) {
            const yTargets = [
                { value: targetPoints.top },
                { value: targetPoints.centerY },
                { value: targetPoints.bottom }
            ];

            const nearestY = yTargets.reduce((a, b) =>
                Math.abs(bestY.value - b.value) < Math.abs(bestY.value - a.value) ? b : a
            );

            if (snapEnabled) target.top += bestY.value - nearestY.value;
            activeGuides.push({
                type: "horizontal",
                position: bestY.value
            });
        }

        target.setCoords();
        drawGuides();
    }

    // --------------------------------------------------
    // DUPLICATE, DELETE AND SELECTION
    // --------------------------------------------------

    function duplicateSelected() {
        const active = canvas.getActiveObject();
        if (!active) return;

        active.clone(cloned => {
            cloned.set({
                left: (active.left || 0) + 25,
                top: (active.top || 0) + 25,
                evented: true
            });

            if (cloned.type === "activeSelection") {
                cloned.canvas = canvas;
                cloned.forEachObject(object => canvas.add(object));
                cloned.setCoords();
            } else {
                canvas.add(cloned);
            }

            canvas.setActiveObject(cloned);
            canvas.requestRenderAll();
            updateSelectionPanel();
            pushHistory();
        });
    }

    function deleteSelected() {
        const active = canvas.getActiveObject();
        if (!active) return;

        if (active.type === "activeSelection") {
            active.forEachObject(object => canvas.remove(object));
        } else {
            canvas.remove(active);
        }

        canvas.discardActiveObject();
        canvas.requestRenderAll();
        updateSelectionPanel();
        pushHistory();
    }

    function updateSelectionPanel() {
        const active = canvas.getActiveObject();

        if (!active) {
            selectionInfo.textContent =
                "Select an object on the slide to edit its properties.";
            objectControls.classList.add("pm-hidden");
            $("pmAlignmentPanel")?.classList.add("pm-hidden");
            return;
        }

        objectControls.classList.remove("pm-hidden");
        $("pmAlignmentPanel")?.classList.remove("pm-hidden");

        const isText = isTextObject(active);
        const isMultiple = active.type === "activeSelection";

        textControls.classList.toggle("pm-hidden", !isText);
        fontControls.classList.toggle("pm-hidden", !isText);
        sizeControls.classList.toggle("pm-hidden", !isText);
        textStyleControls.classList.toggle("pm-hidden", !isText);
        colorControls.classList.toggle("pm-hidden", isMultiple);

        selectionInfo.textContent = isText
            ? "Text object selected"
            : isMultiple
                ? "Multiple objects selected"
                : `${active.type.charAt(0).toUpperCase() + active.type.slice(1)} selected`;

        if (isText) {
            $("pmTextValue").value = active.text || "";
            $("pmFontFamily").value = active.fontFamily || "Arial";
            $("pmFontSize").value = active.fontSize || 36;
            $("pmObjectColor").value = toHexColor(active.fill) || "#222222";
        } else if (!isMultiple) {
            $("pmObjectColor").value = toHexColor(active.fill) || "#2563eb";
        }

        if ($("pmUnlockProportions")) {
            $("pmUnlockProportions").checked = !active.lockUniScaling;
        }
    }

    function updateActiveText(property, value) {
        const active = canvas.getActiveObject();
        if (!isTextObject(active)) return;

        active.set(property, value);
        active.setCoords();
        canvas.requestRenderAll();
        pushHistory();
    }

    // --------------------------------------------------
    // FABRIC EVENTS
    // --------------------------------------------------

    canvas.on("object:added", () => pushHistory());

    canvas.on("object:modified", () => {
        clearGuides();
        updateSelectionPanel();
        pushHistory();
    });

    canvas.on("object:removed", () => pushHistory());

    canvas.on("object:moving", movingObject);

    canvas.on("mouse:up", () => {
        clearGuides();
    });

    canvas.on("selection:created", updateSelectionPanel);
    canvas.on("selection:updated", updateSelectionPanel);
    canvas.on("selection:cleared", updateSelectionPanel);

    // --------------------------------------------------
    // TOOLBAR ACTIONS
    // --------------------------------------------------

    $("pmAddText").addEventListener("click", () => addText());

    $("pmAddRect").addEventListener("click", addRectangle);
    $("pmAddCircle").addEventListener("click", addCircle);

    $("pmAddImage").addEventListener("click", () => $("pmImageInput").click());

    $("pmImageInput").addEventListener("change", event => {
        const file = event.target.files && event.target.files[0];
        addImage(file);
        event.target.value = "";
    });

    $("pmUndo").addEventListener("click", undo);
    $("pmRedo").addEventListener("click", redo);
    $("pmDuplicate").addEventListener("click", duplicateSelected);
    $("pmDelete").addEventListener("click", deleteSelected);

    $("pmAddSlide").addEventListener("click", addSlide);

    $("pmPrevSlide").addEventListener("click", () => {
        switchSlide(activeSlideIndex - 1);
    });

    $("pmNextSlide").addEventListener("click", () => {
        switchSlide(activeSlideIndex + 1);
    });

    // Sidebar controls from the current HTML
    $("pmElementRectangle")?.addEventListener("click", () => addShape("rectangle"));
    $("pmElementCircle")?.addEventListener("click", () => addShape("circle"));
    $("pmTextHeading")?.addEventListener("click", () => {
        addText("Add a heading", { fontSize: 48, fontWeight: "bold", fill: "#172554" });
    });
    $("pmTextSubheading")?.addEventListener("click", () => {
        addText("Add a subheading", { fontSize: 30, fontWeight: "bold" });
    });
    $("pmTextBody")?.addEventListener("click", () => {
        addText("Add body text", { fontSize: 20 });
    });
    $("pmUploadImage")?.addEventListener("click", () => $("pmImageInput").click());

    // --------------------------------------------------
    // BACKGROUND
    // --------------------------------------------------

    backgroundInput.addEventListener("input", event => {
        const color = event.target.value;
        const slide = getSlide();
        if (!slide) return;

        slide.background = color;

        canvas.setBackgroundColor(color, () => {
            canvas.requestRenderAll();
            pushHistory();
        });
    });

    // --------------------------------------------------
    // TEXT AND OBJECT FORMATTING
    // --------------------------------------------------

    $("pmTextValue").addEventListener("input", event => {
        updateActiveText("text", event.target.value);
    });

    $("pmFontFamily").addEventListener("change", event => {
        updateActiveText("fontFamily", event.target.value);
    });

    $("pmFontSize").addEventListener("change", event => {
        const size = Math.max(8, Math.min(180, Number(event.target.value) || 36));
        event.target.value = size;
        updateActiveText("fontSize", size);
    });

    $("pmObjectColor").addEventListener("input", event => {
        const active = canvas.getActiveObject();
        if (!active) return;

        active.set("fill", event.target.value);
        canvas.requestRenderAll();
        pushHistory();
    });

    $("pmBold").addEventListener("click", () => {
        const active = canvas.getActiveObject();
        if (!isTextObject(active)) return;

        updateActiveText(
            "fontWeight",
            active.fontWeight === "bold" ? "normal" : "bold"
        );
    });

    $("pmItalic").addEventListener("click", () => {
        const active = canvas.getActiveObject();
        if (!isTextObject(active)) return;

        updateActiveText(
            "fontStyle",
            active.fontStyle === "italic" ? "normal" : "italic"
        );
    });

    $("pmUnderline").addEventListener("click", () => {
        const active = canvas.getActiveObject();
        if (!isTextObject(active)) return;

        updateActiveText("underline", !active.underline);
    });

    // --------------------------------------------------
    // SPEAKER NOTES
    // --------------------------------------------------

    $("pmSpeakerNotes")?.addEventListener("input", event => {
        const slide = getSlide();
        if (slide) slide.notes = event.target.value;
    });

    // --------------------------------------------------
    // KEYBOARD SHORTCUTS
    // --------------------------------------------------

    document.addEventListener("keydown", event => {
        const target = event.target;
        const isTyping = target && (
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable
        );

        if (isTyping) return;

        const key = event.key.toLowerCase();

        if ((event.ctrlKey || event.metaKey) && key === "z") {
            event.preventDefault();
            if (event.shiftKey) redo();
            else undo();
            return;
        }

        if ((event.ctrlKey || event.metaKey) && key === "y") {
            event.preventDefault();
            redo();
            return;
        }

        if ((event.ctrlKey || event.metaKey) && key === "d") {
            event.preventDefault();
            duplicateSelected();
            return;
        }

        if (key === "delete" || key === "backspace") {
            const active = canvas.getActiveObject();
            if (active && !active.isEditing) {
                event.preventDefault();
                deleteSelected();
            }
        }

        if (key === "escape" && shapeMenu) {
            shapeMenu.classList.remove("open");
        }
    });

    // --------------------------------------------------
    // PROJECT EXPORT
    // --------------------------------------------------

    $("pmExportProject").addEventListener("click", () => {
        clearTimeout(historyTimer);
        saveCurrentSlide();

        const project = {
            app: "JScan Presentation Maker",
            version: 2,
            savedAt: new Date().toISOString(),
            slides: slides.map(slide => ({
                name: slide.name,
                background: slide.background,
                notes: slide.notes || "",
                json: slide.json || {}
            }))
        };

        const blob = new Blob(
            [JSON.stringify(project, null, 2)],
            { type: "application/json" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "jscan-presentation-project.json";
        link.click();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    // --------------------------------------------------
    // INITIALISE WORKSPACE
    // --------------------------------------------------

    createShapeMenu();
    createAlignmentPanel();
    createTextAlignmentControls();

    const firstSlide = createSlide("Slide 1");
    slides.push(firstSlide);

    isLoadingSlide = true;

    canvas.setBackgroundColor("#ffffff", () => {
        addDefaultContent();
        isLoadingSlide = false;

        saveCurrentSlide();
        initialiseSlideHistory(firstSlide);
        renderSlideList();
        updateSelectionPanel();
    });
});
