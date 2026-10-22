import regularFont from "@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf?url";
import boldFont from "@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf?url";

// FR-5.2: PDF rapor. A4 dikey; kısa görseller metnin arasında akar, sayfadan
// uzun görseller birden çok sayfaya bölünür (Aşama 5 kararları). Türkçe
// karakterler için Inter gömülür (R-41); görsel kalitesi kullanıcının
// seçimidir: küçük dosya JPEG %85, yüksek kalite PNG (R-17).
export const QUALITIES = ["small", "high"];
export const QUALITY_STORAGE_KEY = "rc-report-quality";

export function readQuality(storage) {
    try {
        const value = storage?.getItem(QUALITY_STORAGE_KEY);
        return QUALITIES.includes(value) ? value : "small";
    } catch {
        return "small";
    }
}

export function writeQuality(storage, value) {
    try {
        storage?.setItem(QUALITY_STORAGE_KEY, value);
    } catch {
        // Depolama kapalıysa seçim yalnızca bu oturumda geçerlidir
    }
}

// A4, pt cinsinden
export const PAGE = { width: 595.28, height: 841.89, margin: 48 };
const CONTENT = PAGE.width - PAGE.margin * 2;
const BOTTOM = PAGE.height - PAGE.margin;
const JPEG_QUALITY = 0.85;
// Küçük dosyada görselin pt başına en çok piksel sayısı (yaklaşık 180 dpi)
const SMALL_DENSITY = 2.5;
// Sayfada bundan az yer kaldıysa bölünen görsel yeni sayfada başlar
const MIN_SLICE = 120;

const COLORS = {
    text: [26, 29, 41],
    muted: [91, 96, 112],
    line: [227, 229, 236],
};

// Görselin PDF'teki genişliği: yatay görseller (ızgara) tam genişlik, dikey
// görseller okunur kalacak kadar dar
export function displayWidth({ width, height }) {
    return Math.min(width, width > height ? CONTENT : CONTENT * 0.55);
}

// Görselin sayfalara bölünmesi. Görsel kalan yere sığarsa olduğu yere,
// tek sayfaya sığarsa yeni sayfaya konur; daha uzunsa dilimlere ayrılır.
// Dönen dilimler: { top, height (pt), newPage }
export function sliceImage(height, available, pageHeight) {
    if (height <= available) return [{ top: 0, height, newPage: false }];
    if (height <= pageHeight) return [{ top: 0, height, newPage: true }];
    const slices = [];
    let top = 0;
    let room = available;
    let newPage = false;
    if (room < MIN_SLICE) {
        room = pageHeight;
        newPage = true;
    }
    while (top < height) {
        const part = Math.min(room, height - top);
        slices.push({ top, height: part, newPage });
        top += part;
        room = pageHeight;
        newPage = true;
    }
    return slices;
}

async function fontData(url) {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return btoa(binary);
}

// Görselin bir dilimini istenen kalitede kodlar
async function encodeSlice(bitmap, { top, height }, scale, quality) {
    const sourceTop = Math.round(top / scale);
    const sourceHeight = Math.min(
        bitmap.height - sourceTop,
        Math.round(height / scale),
    );
    const widthPt = bitmap.width * scale;
    const density =
        quality === "small"
            ? Math.min(1, (widthPt * SMALL_DENSITY) / bitmap.width)
            : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * density));
    canvas.height = Math.max(1, Math.round(sourceHeight * density));
    const context = canvas.getContext("2d");
    // JPEG saydamlığı desteklemez; zemin beyaz
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
        bitmap,
        0,
        sourceTop,
        bitmap.width,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height,
    );
    const type = quality === "small" ? "image/jpeg" : "image/png";
    const blob = await new Promise((resolve, reject) =>
        canvas.toBlob(
            (result) => (result ? resolve(result) : reject(new Error("pdf"))),
            type,
            JPEG_QUALITY,
        ),
    );
    return {
        data: new Uint8Array(await blob.arrayBuffer()),
        format: quality === "small" ? "JPEG" : "PNG",
    };
}

export async function toPdf(model, info, { quality = "small" } = {}) {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
    const [regular, bold] = await Promise.all([
        fontData(regularFont),
        fontData(boldFont),
    ]);
    doc.addFileToVFS("Inter-Regular.ttf", regular);
    doc.addFont("Inter-Regular.ttf", "Inter", "normal");
    doc.addFileToVFS("Inter-Bold.ttf", bold);
    doc.addFont("Inter-Bold.ttf", "Inter", "bold");
    doc.setProperties({ title: info.title, creator: "ResponsiveController" });
    try {
        doc.setLanguage(info.language);
    } catch {
        // Dil kodu desteklenmezse PDF dilsiz kalır
    }
    const { labels } = info;
    let y = PAGE.margin;

    const newPage = () => {
        doc.addPage();
        y = PAGE.margin;
    };
    const ensure = (height) => {
        if (y + height > BOTTOM) newPage();
    };
    const style = (size, weight = "normal", color = COLORS.text) => {
        doc.setFont("Inter", weight);
        doc.setFontSize(size);
        doc.setTextColor(...color);
    };
    const lineHeight = (size) => size * 1.45;

    // Satırlara bölünmüş metin; sayfa sonunda yeni sayfaya geçer
    function paragraph(text, size = 10.5, weight = "normal", color) {
        style(size, weight, color);
        for (const line of doc.splitTextToSize(text, CONTENT)) {
            ensure(lineHeight(size));
            doc.text(line, PAGE.margin, y, { baseline: "top" });
            y += lineHeight(size);
        }
    }

    function heading(text, level) {
        const size = { 1: 22, 2: 15, 3: 12 }[level];
        const space = { 1: 0, 2: 22, 3: 14 }[level];
        // Başlık sayfanın dibinde yalnız kalmasın
        ensure(space + lineHeight(size) + MIN_SLICE);
        y += y === PAGE.margin ? 0 : space;
        paragraph(text, size, "bold");
        if (level === 2) {
            doc.setDrawColor(...COLORS.line);
            doc.line(PAGE.margin, y + 2, PAGE.margin + CONTENT, y + 2);
            y += 10;
        } else {
            y += 4;
        }
    }

    function note(text) {
        for (const block of text.split(/\n{2,}/).filter(Boolean)) {
            paragraph(block);
            y += 6;
        }
    }

    function table() {
        const widths = [0.4, 0.2, 0.22, 0.18].map((part) => part * CONTENT);
        const row = (cells, weight, color) => {
            style(9.5, weight, color);
            const lines = cells.map((cell, index) =>
                doc.splitTextToSize(cell, widths[index] - 8),
            );
            const height =
                Math.max(...lines.map((item) => item.length)) *
                    lineHeight(9.5) +
                10;
            ensure(height);
            let x = PAGE.margin;
            for (const [index, cellLines] of lines.entries()) {
                doc.text(cellLines, x, y + 5, {
                    baseline: "top",
                    lineHeightFactor: 1.45,
                });
                x += widths[index];
            }
            y += height;
            doc.setDrawColor(...COLORS.line);
            doc.line(PAGE.margin, y, PAGE.margin + CONTENT, y);
        };
        row(
            [labels.device, labels.size, labels.dpr, labels.orientation],
            "bold",
            COLORS.muted,
        );
        for (const device of model.devices)
            row(
                [
                    device.name,
                    device.sizeText,
                    device.dprText,
                    device.orientationText,
                ],
                "normal",
            );
    }

    async function images(items) {
        for (const shot of items) {
            const bitmap = await createImageBitmap(shot.blob);
            const width = displayWidth(bitmap);
            const scale = width / bitmap.width;
            const height = bitmap.height * scale;
            y += 8;
            const slices = sliceImage(height, BOTTOM - y, BOTTOM - PAGE.margin);
            for (const slice of slices) {
                if (slice.newPage) newPage();
                const { data, format } = await encodeSlice(
                    bitmap,
                    slice,
                    scale,
                    quality,
                );
                doc.addImage(
                    data,
                    format,
                    PAGE.margin,
                    y,
                    width,
                    slice.height,
                    undefined,
                    "FAST",
                );
                doc.setDrawColor(201, 204, 214);
                doc.rect(PAGE.margin, y, width, slice.height);
                y += slice.height;
            }
            bitmap.close?.();
            y += 8;
        }
    }

    heading(info.title, 1);
    for (const [label, value] of info.rows) {
        style(10.5, "bold", COLORS.muted);
        const prefix = `${label}: `;
        const prefixWidth = doc.getTextWidth(prefix);
        ensure(lineHeight(10.5));
        doc.text(prefix, PAGE.margin, y, { baseline: "top" });
        style(10.5, "normal", COLORS.muted);
        // Uzun adresler etiketin hizasından alt satıra geçer
        for (const line of doc.splitTextToSize(value, CONTENT - prefixWidth)) {
            ensure(lineHeight(10.5));
            doc.text(line, PAGE.margin + prefixWidth, y, { baseline: "top" });
            y += lineHeight(10.5);
        }
    }

    heading(labels.devices, 2);
    table();

    if (model.general.note || model.general.shots.length > 0) {
        heading(labels.generalNote, 2);
        note(model.general.note);
        if (model.general.shots.length > 0) {
            heading(labels.generalShots, 3);
            await images(model.general.shots);
        }
    }
    if (model.details.length > 0) {
        heading(labels.details, 2);
        for (const item of model.details) {
            heading(`${item.device.name} · ${item.device.sizeText}`, 3);
            note(item.note);
            await images(item.shots);
        }
    }

    // Son sayfanın alt boşluğunda; içerik oraya inmez, yeni sayfa açılmaz
    style(9, "normal", COLORS.muted);
    doc.text(info.footer, PAGE.margin, PAGE.height - PAGE.margin / 2, {
        baseline: "bottom",
    });
    return doc.output("blob");
}
