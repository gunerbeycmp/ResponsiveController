// FR-5.3: ekran görüntüsü üzerine işaretleme (ok, daire, kısa yazı).
// İşaretler görselin kendi piksel koordinatlarında tutulur; ekranda bir
// katmanda gösterilir, indirme ve raporda görsele çizilir (Aşama 5 kararları).
export const COLORS = {
    red: "#e11d48",
    yellow: "#facc15",
    blue: "#2563eb",
    black: "#111111",
};

// Çizgi kalınlığı ve yazı boyutu görselin genişliğine göre
export function markStyle(width) {
    const line = Math.max(3, Math.round(width / 150));
    return {
        line,
        outline: line + Math.max(2, Math.round(line * 0.8)),
        font: Math.max(16, Math.round(width / 22)),
    };
}

function arrowHead(context, shape, size) {
    const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
    context.beginPath();
    context.moveTo(shape.x2, shape.y2);
    context.lineTo(
        shape.x2 - size * Math.cos(angle - Math.PI / 7),
        shape.y2 - size * Math.sin(angle - Math.PI / 7),
    );
    context.moveTo(shape.x2, shape.y2);
    context.lineTo(
        shape.x2 - size * Math.cos(angle + Math.PI / 7),
        shape.y2 - size * Math.sin(angle + Math.PI / 7),
    );
}

function tracePath(context, shape, style) {
    context.beginPath();
    if (shape.type === "arrow") {
        context.moveTo(shape.x1, shape.y1);
        context.lineTo(shape.x2, shape.y2);
        context.stroke();
        arrowHead(context, shape, style.line * 5);
    } else if (shape.type === "circle") {
        context.ellipse(
            (shape.x1 + shape.x2) / 2,
            (shape.y1 + shape.y2) / 2,
            Math.abs(shape.x2 - shape.x1) / 2,
            Math.abs(shape.y2 - shape.y1) / 2,
            0,
            0,
            Math.PI * 2,
        );
    }
    context.stroke();
}

// Her işaret önce beyaz dış çizgiyle, sonra kendi rengiyle çizilir; her
// zeminde görünür kalır
export function drawShapes(context, shapes, width) {
    const style = markStyle(width);
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const shape of shapes) {
        if (shape.type === "text") {
            context.font = `700 ${style.font}px "Inter Variable", system-ui, sans-serif`;
            context.textBaseline = "top";
            context.lineWidth = Math.max(3, Math.round(style.font / 6));
            context.strokeStyle = "#ffffff";
            context.strokeText(shape.text, shape.x, shape.y);
            context.fillStyle = COLORS[shape.color];
            context.fillText(shape.text, shape.x, shape.y);
            continue;
        }
        context.strokeStyle = "#ffffff";
        context.lineWidth = style.outline;
        tracePath(context, shape, style);
        context.strokeStyle = COLORS[shape.color];
        context.lineWidth = style.line;
        tracePath(context, shape, style);
    }
}

// İşaretli görsel (PNG); işaret yoksa görselin kendisi
export async function renderMarked(blob, shapes) {
    if (shapes.length === 0) return blob;
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0);
    drawShapes(context, shapes, bitmap.width);
    bitmap.close?.();
    return new Promise((resolve, reject) =>
        canvas.toBlob(
            (result) => (result ? resolve(result) : reject(new Error("mark"))),
            "image/png",
        ),
    );
}

// Görselin üzerindeki çizim katmanı ve araç satırı
export function createMarkup({ t, elements, onChange }) {
    const {
        stage,
        image,
        layer,
        tools,
        toolButtons,
        colorButtons,
        undo,
        clear,
        textInput,
    } = elements;
    let shapes = [];
    let tool = "arrow";
    let color = "red";
    let draft = null;
    let pendingText = null;

    const natural = () => ({
        width: image.naturalWidth,
        height: image.naturalHeight,
    });

    // Ekran koordinatı → görselin piksel koordinatı
    function toImage(event) {
        const rect = layer.getBoundingClientRect();
        const { width, height } = natural();
        return {
            x: ((event.clientX - rect.left) / rect.width) * width,
            y: ((event.clientY - rect.top) / rect.height) * height,
        };
    }

    function draw() {
        const rect = image.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        layer.width = Math.max(1, Math.round(rect.width * ratio));
        layer.height = Math.max(1, Math.round(rect.height * ratio));
        layer.style.width = `${rect.width}px`;
        layer.style.height = `${rect.height}px`;
        const context = layer.getContext("2d");
        context.clearRect(0, 0, layer.width, layer.height);
        const { width } = natural();
        if (!width) return;
        const scale = layer.width / width;
        context.save();
        context.scale(scale, scale);
        drawShapes(context, draft ? [...shapes, draft] : shapes, width);
        context.restore();
        undo.disabled = shapes.length === 0;
        clear.disabled = shapes.length === 0;
    }

    function renderTools() {
        for (const button of toolButtons)
            button.setAttribute(
                "aria-pressed",
                String(button.dataset.markTool === tool),
            );
        for (const button of colorButtons)
            button.setAttribute(
                "aria-pressed",
                String(button.dataset.markColor === color),
            );
    }

    function commit(shape) {
        shapes.push(shape);
        draw();
        onChange?.();
    }

    function finishText({ save }) {
        if (!pendingText) return;
        const text = textInput.value.trim();
        const at = pendingText;
        pendingText = null;
        textInput.hidden = true;
        textInput.value = "";
        if (save && text)
            commit({ type: "text", x: at.x, y: at.y, text, color });
    }

    layer.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        const point = toImage(event);
        if (tool === "text") {
            // Odak tuvale kaymasın, yazı alanı hemen odak alsın
            event.preventDefault();
            finishText({ save: true });
            const rect = layer.getBoundingClientRect();
            const stageRect = stage.getBoundingClientRect();
            pendingText = point;
            textInput.hidden = false;
            textInput.style.left = `${event.clientX - stageRect.left}px`;
            textInput.style.top = `${event.clientY - stageRect.top}px`;
            textInput.style.maxWidth = `${rect.right - event.clientX}px`;
            textInput.focus();
            return;
        }
        event.preventDefault();
        layer.setPointerCapture(event.pointerId);
        draft = {
            type: tool,
            x1: point.x,
            y1: point.y,
            x2: point.x,
            y2: point.y,
            color,
        };
        draw();
    });

    layer.addEventListener("pointermove", (event) => {
        if (!draft) return;
        const point = toImage(event);
        draft.x2 = point.x;
        draft.y2 = point.y;
        draw();
    });

    const endDraft = () => {
        if (!draft) return;
        const shape = draft;
        draft = null;
        const { width } = natural();
        const length = Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1);
        // Çok kısa sürüklemeler (tıklama) işaret sayılmaz
        if (length > width / 100) commit(shape);
        else draw();
    };
    layer.addEventListener("pointerup", endDraft);
    layer.addEventListener("pointercancel", endDraft);

    textInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            finishText({ save: true });
        } else if (event.key === "Escape") {
            // Pencerenin kapanmasını engeller, yalnızca yazıdan vazgeçilir
            event.preventDefault();
            event.stopPropagation();
            finishText({ save: false });
        }
    });
    textInput.addEventListener("blur", () => finishText({ save: true }));

    for (const button of toolButtons)
        button.addEventListener("click", () => {
            tool = button.dataset.markTool;
            renderTools();
        });
    for (const button of colorButtons)
        button.addEventListener("click", () => {
            color = button.dataset.markColor;
            renderTools();
        });
    undo.addEventListener("click", () => {
        shapes.pop();
        draw();
        onChange?.();
    });
    clear.addEventListener("click", () => {
        shapes = [];
        draw();
        onChange?.();
    });

    new ResizeObserver(() => {
        if (!tools.hidden) draw();
    }).observe(image);
    image.addEventListener("load", draw);
    renderTools();

    return {
        // Yeni görüntüde işaretler sıfırlanır
        reset(enabled) {
            shapes = [];
            draft = null;
            finishText({ save: false });
            tools.hidden = !enabled;
            layer.hidden = !enabled;
            draw();
        },
        shapes: () => [...shapes],
        textLabel: () => t("mark.textLabel"),
    };
}
