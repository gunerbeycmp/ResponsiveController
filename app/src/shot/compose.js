// FR-4.4: ızgaranın tek görseli. Kutulardaki siteler ayrı bir siteden
// geldiği için ekrandan doğrudan alınamaz (R-37, R-40); her cihazın görüntüsü
// ekrandaki kutu düzeninde birleştirilir. Görsel 2x yoğunlukta, açık renkli.
const SCALE = 2;
const PADDING = 16;
const COLORS = {
    background: "#ffffff",
    box: "#f5f6fa",
    border: "#c9ccd6",
    text: "#1a1d29",
    secondary: "#5b6070",
};
const FONT = '"Inter Variable", system-ui, sans-serif';

// items: [{ name, sizeText, blob, box: rect, viewport: rect }]; rect'ler
// ızgara listesine göre CSS piksel
export async function composeGrid(items) {
    const right = Math.max(...items.map(({ box }) => box.x + box.width));
    const bottom = Math.max(...items.map(({ box }) => box.y + box.height));
    const left = Math.min(...items.map(({ box }) => box.x));
    const top = Math.min(...items.map(({ box }) => box.y));
    const width = right - left + PADDING * 2;
    const height = bottom - top + PADDING * 2;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * SCALE);
    canvas.height = Math.round(height * SCALE);
    const context = canvas.getContext("2d");
    context.scale(SCALE, SCALE);
    context.fillStyle = COLORS.background;
    context.fillRect(0, 0, width, height);
    const shift = (rect) => ({
        x: rect.x - left + PADDING,
        y: rect.y - top + PADDING,
        width: rect.width,
        height: rect.height,
    });

    for (const item of items) {
        const box = shift(item.box);
        const viewport = shift(item.viewport);
        context.fillStyle = COLORS.box;
        context.strokeStyle = COLORS.border;
        context.lineWidth = 1;
        context.beginPath();
        context.roundRect(
            box.x + 0.5,
            box.y + 0.5,
            box.width - 1,
            box.height - 1,
            8,
        );
        context.fill();
        context.stroke();

        // Ad ve boyut kutunun başlığında
        const labelY = box.y + 22;
        context.font = `600 13px ${FONT}`;
        context.fillStyle = COLORS.text;
        context.textBaseline = "alphabetic";
        const name = item.name;
        context.fillText(name, box.x + 10, labelY, box.width - 20);
        const nameWidth = Math.min(
            context.measureText(name).width,
            box.width - 20,
        );
        context.font = `400 13px ${FONT}`;
        context.fillStyle = COLORS.secondary;
        context.fillText(
            item.sizeText,
            box.x + 16 + nameWidth,
            labelY,
            Math.max(0, box.width - 26 - nameWidth),
        );

        // Cihaz görüntüsü kutunun cihaz alanına sığdırılır, ortalanır
        context.fillStyle = COLORS.background;
        context.fillRect(
            viewport.x,
            viewport.y,
            viewport.width,
            viewport.height,
        );
        context.strokeRect(
            viewport.x + 0.5,
            viewport.y + 0.5,
            viewport.width - 1,
            viewport.height - 1,
        );
        const bitmap = await createImageBitmap(item.blob);
        const fit = Math.min(
            (viewport.width - 2) / bitmap.width,
            (viewport.height - 2) / bitmap.height,
        );
        const drawWidth = bitmap.width * fit;
        const drawHeight = bitmap.height * fit;
        context.drawImage(
            bitmap,
            viewport.x + (viewport.width - drawWidth) / 2,
            viewport.y + (viewport.height - drawHeight) / 2,
            drawWidth,
            drawHeight,
        );
        bitmap.close?.();
    }

    return new Promise((resolve, reject) =>
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("compose"))),
            "image/png",
        ),
    );
}
