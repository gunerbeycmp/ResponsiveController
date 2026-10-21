// FR-4.5: ekran görüntüsü dosya biçimi. Görüntü PNG olarak alınır, indirirken
// seçilen biçime dönüştürülür (JPEG / WebP kalite %92, Aşama 4 kararları)
export const FORMATS = {
    png: { type: "image/png", extension: "png" },
    jpeg: { type: "image/jpeg", extension: "jpg" },
    webp: { type: "image/webp", extension: "webp" },
};
export const FORMAT_STORAGE_KEY = "rc-shot-format";
export const QUALITY = 0.92;

export function readFormat(storage) {
    try {
        const stored = storage?.getItem(FORMAT_STORAGE_KEY);
        return Object.hasOwn(FORMATS, stored) ? stored : "png";
    } catch {
        return "png";
    }
}

export function writeFormat(storage, format) {
    try {
        storage?.setItem(FORMAT_STORAGE_KEY, format);
    } catch {
        // Depolama kapalıysa seçim yalnızca bu oturumda kalır
    }
}

// Dönüştürülemeyen biçimde (ör. Safari'de WebP) PNG'ye geri düşülür
export async function convert(blob, format) {
    if (format === "png") return { blob, format: "png" };
    const { type } = FORMATS[format];
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    // JPEG saydamlığı desteklemez; saydam alanlar beyaz olur
    if (format === "jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const result = await new Promise((resolve) =>
        canvas.toBlob(resolve, type, QUALITY),
    );
    if (!result || result.type !== type) return { blob, format: "png" };
    return { blob: result, format };
}
