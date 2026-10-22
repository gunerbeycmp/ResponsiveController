import { strToU8, zipSync } from "fflate";
import { batchFileName, entryFileName } from "../shot/capture.js";
import { buildReport, toHtml, toMarkdown } from "./build.js";
import { readQuality, toPdf, writeQuality } from "./pdf.js";

// FR-5.1, FR-5.2: rapor penceresi. Önizleme, biçim seçimi (PDF / HTML /
// Markdown) ve İndir. PDF varsayılandır, görsel kalitesi seçilir; HTML
// görselleri gömülü tek dosyadır; Markdown rapor dosyası ve görseller
// klasörüyle ZIP olarak iner (Aşama 5 kararları).
export const REPORT_FORMATS = ["pdf", "html", "markdown"];

const toDataUrl = (blob) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });

const extensionOf = (blob) =>
    ({ "image/jpeg": "jpg", "image/webp": "webp" })[blob.type] ?? "png";

export function createReportDialog({
    t,
    getLanguage,
    storage,
    elements,
    getData,
}) {
    const {
        dialog,
        close,
        preview,
        download,
        formats,
        qualityGroup,
        qualities,
    } = elements;
    let format = "pdf";
    let quality = readQuality(storage);
    let model = null;
    let info = null;
    let returnFocus = null;
    let urls = [];

    const releaseUrls = () => {
        for (const url of urls) URL.revokeObjectURL(url);
        urls = [];
    };

    // Raporun dile bağlı metinleri; rapor aracın o anki dilindedir
    function describe(data) {
        const language = getLanguage();
        const rows = data.project
            ? [[t("report.project"), data.project]]
            : [[t("report.address"), data.url]];
        rows.push([
            t("report.date"),
            data.date.toLocaleString(language, {
                dateStyle: "long",
                timeStyle: "short",
            }),
        ]);
        return {
            language,
            title: t("report.title"),
            rows,
            footer: t("report.footer"),
            labels: {
                devices: t("report.devices"),
                device: t("report.device"),
                size: t("report.size"),
                dpr: t("report.dpr"),
                orientation: t("report.orientation"),
                details: t("report.details"),
                generalNote: t("notes.session"),
                generalShots: t("notes.generalShots"),
            },
        };
    }

    function prepare(data) {
        const devices = data.devices.map((device) => ({
            ...device,
            sizeText: `${device.size.width} × ${device.size.height}`,
            dprText: `${device.dpr}×`,
            orientationText: t(
                device.landscape ? "report.landscape" : "report.portrait",
            ),
        }));
        const shots = data.shots.map((shot) => ({
            ...shot,
            alt: shot.name
                ? t("shot.imageAlt", {
                      device: shot.name,
                      width: shot.width,
                      height: shot.height,
                  })
                : t("notes.generalShots"),
        }));
        return buildReport({ devices, notes: data.notes, shots });
    }

    function renderFormats() {
        for (const button of formats)
            button.setAttribute(
                "aria-pressed",
                String(button.dataset.reportFormat === format),
            );
        for (const button of qualities)
            button.setAttribute(
                "aria-pressed",
                String(button.dataset.reportQuality === quality),
            );
        // Kalite yalnızca PDF'te seçilir
        qualityGroup.hidden = format !== "pdf";
    }

    function open({ opener } = {}) {
        releaseUrls();
        const data = getData();
        info = describe(data);
        model = prepare(data);
        returnFocus = opener ?? document.activeElement;
        // Önizlemede görseller geçici adreslerle gösterilir
        const src = new Map();
        const imageSrc = (shot) => {
            if (!src.has(shot.id)) {
                const url = URL.createObjectURL(shot.blob);
                urls.push(url);
                src.set(shot.id, url);
            }
            return src.get(shot.id);
        };
        preview.srcdoc = toHtml(model, info, imageSrc);
        renderFormats();
        if (!dialog.open) dialog.showModal();
        download.focus();
    }

    // Raporun görselleri: [{ shot, path }]; dosya adları cihaz ve boyuttan
    function imageFiles(folder) {
        const taken = {};
        const paths = new Map();
        const shots = [
            ...model.general.shots,
            ...model.details.flatMap((item) => item.shots),
        ];
        for (const shot of shots) {
            const name = entryFileName(
                shot.name ?? t("notes.generalShots"),
                { width: shot.width, height: shot.height },
                extensionOf(shot.blob),
                taken,
            );
            taken[name] = true;
            paths.set(shot.id, { shot, path: `${folder}/${name}` });
        }
        return paths;
    }

    async function build() {
        if (format === "pdf") {
            return {
                blob: await toPdf(model, info, { quality }),
                name: batchFileName(t("report.file"), { extension: "pdf" }),
            };
        }
        if (format === "html") {
            const sources = new Map();
            for (const { shot } of imageFiles("img").values())
                sources.set(shot.id, await toDataUrl(shot.blob));
            const html = toHtml(model, info, (shot) => sources.get(shot.id));
            return {
                blob: new Blob([html], { type: "text/html" }),
                name: batchFileName(t("report.file"), { extension: "html" }),
            };
        }
        const files = imageFiles(t("report.imagesFolder"));
        const markdown = toMarkdown(
            model,
            info,
            (shot) => files.get(shot.id).path,
        );
        const entries = { [`${t("report.file")}.md`]: strToU8(markdown) };
        for (const { shot, path } of files.values())
            entries[path] = new Uint8Array(await shot.blob.arrayBuffer());
        return {
            blob: new Blob([zipSync(entries, { level: 0 })], {
                type: "application/zip",
            }),
            name: batchFileName(t("report.file"), { extension: "zip" }),
        };
    }

    for (const button of formats)
        button.addEventListener("click", () => {
            format = button.dataset.reportFormat;
            renderFormats();
        });
    for (const button of qualities)
        button.addEventListener("click", () => {
            quality = button.dataset.reportQuality;
            writeQuality(storage, quality);
            renderFormats();
        });

    download.addEventListener("click", async () => {
        if (!model || download.getAttribute("aria-disabled") === "true") return;
        // PDF birkaç saniye sürebilir; ikinci tıklama yeni dosya başlatmaz.
        // Odak düğmede kalsın diye disabled yerine aria-disabled
        download.setAttribute("aria-disabled", "true");
        dialog.setAttribute("aria-busy", "true");
        let result;
        try {
            result = await build();
        } finally {
            download.removeAttribute("aria-disabled");
            dialog.removeAttribute("aria-busy");
        }
        if (!dialog.open) return;
        const { blob, name } = result;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = name;
        urls.push(link.href);
        link.click();
    });

    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
        preview.srcdoc = "";
        // İndirme başlamış olabilir; adresler biraz sonra bırakılır
        const pending = urls;
        urls = [];
        setTimeout(() => {
            for (const url of pending) URL.revokeObjectURL(url);
        }, 1000);
        model = null;
        returnFocus?.focus();
    });

    return { open, isOpen: () => dialog.open };
}
