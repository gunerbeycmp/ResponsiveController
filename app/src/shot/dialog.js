import { zipSync } from "fflate";
import {
    batchFileName,
    entryFileName,
    partFileName,
    shotFileName,
} from "./capture.js";
import { FORMATS, convert, readFormat, writeFormat } from "./format.js";
import { drawFramed } from "./frame-image.js";
import { createMarkup, renderMarked } from "./markup.js";

// FR-4.1, FR-4.4: ekran görüntüsü önizleme penceresi.
// Tek cihaz: Görünen alan / Tam sayfa; çok uzun sayfada yoğunluğu düşürülmüş
// tek görsel ya da tam yoğunlukta parçalar (R-64).
// Toplu (ızgara): Her cihaz ayrı (ZIP) / Tek görsel (ızgara).
// Aşama 5'teki işaretleme (FR-5.3) bu pencerenin üzerine kurulacak.
export function createShotDialog({
    t,
    announce,
    getLanguage,
    storage,
    elements,
}) {
    const {
        dialog,
        close,
        modeGroup,
        modes,
        frameOption,
        frameInput,
        batchGroup,
        batches,
        note,
        noteText,
        split,
        status,
        image,
        parts,
        actions,
        download,
        copy,
        message,
        formats,
        add,
        markup: markupElements,
    } = elements;
    // FR-5.3: tek görselde işaretleme; işaret değişince yeniden eklenebilir
    const markup = createMarkup({
        t,
        elements: markupElements,
        onChange: () => {
            add.disabled = false;
        },
    });
    // FR-4.5: son seçilen biçim hatırlanır, ilk kullanımda PNG
    let format = readFormat(storage);
    let request = null;
    let mode = "visible";
    let batch = "separate";
    // FR-3.13: "Çerçeveyle"; saklanmaz, cihazın ekrandaki çerçevesinden gelir
    let withFrame = false;
    let current = null;
    let urls = [];
    let returnFocus = null;
    let run = 0;

    const isBatch = () => request?.kind === "batch";

    function clear() {
        for (const url of urls) URL.revokeObjectURL(url);
        urls = [];
        current = null;
        image.hidden = true;
        image.removeAttribute("src");
        parts.hidden = true;
        parts.replaceChildren();
        actions.hidden = true;
        note.hidden = true;
        split.hidden = true;
        message.textContent = "";
        markup.reset(false);
        add.disabled = false;
    }

    function setStatus(text) {
        status.textContent = text ?? "";
        status.hidden = !text;
    }

    function setPressed(buttons, key, value) {
        for (const button of buttons)
            button.setAttribute(
                "aria-pressed",
                String(button.dataset[key] === value),
            );
    }

    function renderOptions() {
        setPressed(formats, "shotFormat", format);
        setPressed(modes, "shotMode", mode === "parts" ? "full" : mode);
        setPressed(batches, "shotBatch", batch);
        batchGroup.hidden = !isBatch();
        // Tek görsel her zaman görünen alanla alınır (Aşama 4 kararları);
        // ekran paylaşımı yalnızca görünen alanı yakalar (FR-4.2)
        modeGroup.hidden =
            Boolean(request?.screen) || (isBatch() && batch === "combined");
        frameOption.hidden = !frameAvailable();
        frameInput.checked = withFrame;
    }

    // Çerçeve yalnızca görünen alana çizilir. Ekran paylaşımında ızgaranın
    // tek görseli ekranın kendisidir; ekrandaki çerçeveler olduğu gibi girer
    function frameAvailable() {
        if (!request) return false;
        if (!isBatch()) return mode === "visible" && Boolean(request.frame);
        const visible =
            batch === "combined" ? !request.screen : mode === "visible";
        return visible && request.devices.some((device) => device.frame);
    }

    async function framed(blob, target) {
        if (!withFrame || !frameAvailable() || !target.frame) return blob;
        return drawFramed(blob, target.frame, target.size);
    }

    function showNote(text, { canSplit = false } = {}) {
        noteText.textContent = text;
        split.hidden = !canSplit;
        note.hidden = !text;
    }

    function thumbnails(items) {
        parts.replaceChildren(
            ...items.map(({ url, alt }) => {
                const img = document.createElement("img");
                img.src = url;
                img.alt = alt;
                const item = document.createElement("li");
                item.append(img);
                return item;
            }),
        );
        parts.hidden = false;
    }

    // Ekran paylaşımında görüntü ekrandaki boyutta alınır (R-05)
    function screenScaleNote() {
        const scale = request?.screenScale;
        return request?.screen && scale < 0.995
            ? t("shot.screenScaleNote", { scale: Math.round(scale * 100) })
            : "";
    }

    function showImage(url, alt) {
        image.src = url;
        image.alt = alt;
        image.hidden = false;
    }

    // Tek cihaz: seçilen türde görüntü
    async function captureSingle(token) {
        setStatus(t("shot.taking"));
        announce(t("shot.taking"));
        const result = await request.capture(mode);
        if (token !== run) return;
        if (result.blobs.length === 1)
            result.blobs = [await framed(result.blobs[0], request)];
        if (token !== run) return;
        urls = result.blobs.map((blob) => URL.createObjectURL(blob));
        current = { blobs: result.blobs, kind: "single" };
        setStatus(null);
        if (result.blobs.length === 1) {
            showImage(
                urls[0],
                t("shot.imageAlt", {
                    device: request.name,
                    width: result.width,
                    height: result.height,
                }),
            );
            copy.disabled = false;
            markup.reset(true);
            showNote(screenScaleNote());
            if (result.reduced)
                showNote(
                    t("shot.reducedNote", {
                        scale: result.scale.toLocaleString(getLanguage()),
                    }),
                    { canSplit: true },
                );
        } else {
            thumbnails(
                urls.map((url, index) => ({
                    url,
                    alt: t("shot.partAlt", {
                        device: request.name,
                        number: index + 1,
                        count: urls.length,
                    }),
                })),
            );
            showNote(t("shot.partsNote", { count: urls.length }));
            // Panoya tek görsel kopyalanabilir
            copy.disabled = true;
        }
    }

    // Toplu: cihazlar sırayla alınır, ilerleme gösterilir (FR-4.4)
    async function captureBatch(token) {
        const { devices } = request;
        const shotMode = batch === "combined" ? "visible" : mode;
        const results = [];
        for (const [index, device] of devices.entries()) {
            const progress = t("shot.takingAll", {
                done: index,
                count: devices.length,
            });
            setStatus(progress);
            if (index === 0) announce(progress);
            try {
                results.push({
                    device,
                    result: await device.capture(shotMode),
                });
            } catch (cause) {
                results.push({ device, error: true, cause });
            }
            if (token !== run) return;
        }
        const done = [];
        for (const item of results.filter((entry) => entry.result)) {
            const blob = await framed(item.result.blobs[0], item.device);
            done.push({ ...item, result: { ...item.result, blobs: [blob] } });
        }
        if (token !== run) return;
        const failed = results.filter((item) => item.error);
        if (done.length === 0) throw failed[0]?.cause ?? new Error("failed");
        const failedText =
            failed.length > 0
                ? t("shot.failedSome", {
                      devices: failed
                          .map((item) => item.device.name)
                          .join(", "),
                  })
                : "";

        if (batch === "combined") {
            const composed = await request.compose(done);
            if (token !== run) return;
            urls = [URL.createObjectURL(composed)];
            current = { blobs: [composed], kind: "combined" };
            setStatus(null);
            showImage(urls[0], t("shot.combinedAlt", { count: done.length }));
            copy.disabled = false;
            markup.reset(true);
            showNote([failedText, screenScaleNote()].filter(Boolean).join(" "));
            return;
        }

        const blobs = done.map(({ result }) => result.blobs[0]);
        urls = blobs.map((blob) => URL.createObjectURL(blob));
        current = {
            blobs,
            kind: "separate",
            devices: done.map(({ device }) => device),
        };
        setStatus(null);
        thumbnails(
            done.map(({ device, result }, index) => ({
                url: urls[index],
                alt: t("shot.imageAlt", {
                    device: device.name,
                    width: result.width,
                    height: result.height,
                }),
            })),
        );
        copy.disabled = true;
        const reduced = done.some(({ result }) => result.reduced);
        showNote(
            [
                t("shot.separateNote", { count: done.length }),
                reduced ? t("shot.reducedSome") : "",
                failedText,
                screenScaleNote(),
            ]
                .filter(Boolean)
                .join(" "),
        );
    }

    async function capture() {
        renderOptions();
        clear();
        const token = ++run;
        try {
            if (isBatch()) await captureBatch(token);
            else await captureSingle(token);
            if (token === run && current) actions.hidden = false;
        } catch (error) {
            // Ekran paylaşımı hataları kendi açıklamasını taşır (FR-4.2)
            if (token === run) setStatus(t(error?.messageKey ?? "shot.error"));
        }
    }

    function fileName(extension) {
        const suffix = mode === "visible" ? "" : t("shot.fullPageFile");
        if (!isBatch())
            return shotFileName(request.name, request.size, {
                suffix,
                extension,
            });
        return batchFileName(t("shot.gridFile"), {
            suffix: batch === "combined" ? "" : suffix,
            extension,
        });
    }

    // Pencere hemen açılır, varsayılan tür görünen alandır
    function open(options) {
        request = options;
        mode = "visible";
        batch = "separate";
        withFrame =
            options.kind === "batch"
                ? options.devices.some((device) => device.framed)
                : Boolean(options.framed);
        returnFocus = options.opener ?? document.activeElement;
        if (!dialog.open) dialog.showModal();
        capture().then(() => {
            if (current) download.focus();
        });
    }

    for (const button of modes)
        button.addEventListener("click", () => {
            if (button.getAttribute("aria-pressed") === "true") return;
            mode = button.dataset.shotMode;
            capture();
        });

    for (const button of batches)
        button.addEventListener("click", () => {
            if (button.getAttribute("aria-pressed") === "true") return;
            batch = button.dataset.shotBatch;
            capture();
        });

    frameInput.addEventListener("change", () => {
        withFrame = frameInput.checked;
        capture();
    });

    split.addEventListener("click", async () => {
        mode = "parts";
        await capture();
        download.focus();
    });

    for (const button of formats)
        button.addEventListener("click", () => {
            format = button.dataset.shotFormat;
            writeFormat(storage, format);
            renderOptions();
        });

    // Tek görselde işaretler görsele çizilir (indirme, kopyalama, rapor)
    const isSingleImage = () =>
        current && current.blobs.length === 1 && current.kind !== "separate";
    async function finalBlobs() {
        if (!isSingleImage()) return current.blobs;
        return [await renderMarked(current.blobs[0], markup.shapes())];
    }

    // FR-5.1: rapora ekleme. Parçalar ve "Her cihaz ayrı" hepsi birden
    // eklenir; ızgara tek görseli genel görüntüdür (Aşama 5 kararları)
    add.addEventListener("click", async () => {
        if (!current) return;
        const blobs = await finalBlobs();
        const items = blobs.map((blob, index) => {
            if (current.kind === "separate") {
                const device = current.devices[index];
                return { deviceId: device.id, name: device.name, blob };
            }
            if (current.kind === "combined")
                return { deviceId: null, name: null, blob };
            return { deviceId: request.id, name: request.name, blob };
        });
        await request.onAdd?.(items);
        add.disabled = true;
        message.textContent = t("shot.addedToReport");
        announce(t("shot.addedToReport"));
    });

    download.addEventListener("click", async () => {
        if (!current) return;
        message.textContent = "";
        const converted = await Promise.all(
            (await finalBlobs()).map((blob) => convert(blob, format)),
        );
        const used = converted[0].format;
        const { extension } = FORMATS[used];
        const link = document.createElement("a");
        if (converted.length === 1 && current.kind !== "separate") {
            link.href = URL.createObjectURL(converted[0].blob);
            link.download = fileName(extension);
        } else {
            // Parçalar ya da cihazlar numaralı / adlı dosyalar hâlinde tek ZIP
            const files = {};
            for (const [index, item] of converted.entries()) {
                const name =
                    current.kind === "separate"
                        ? entryFileName(
                              current.devices[index].name,
                              current.devices[index].size,
                              extension,
                              files,
                          )
                        : partFileName(t("shot.partFile"), index, extension);
                files[name] = new Uint8Array(await item.blob.arrayBuffer());
            }
            const zip = new Blob([zipSync(files, { level: 0 })], {
                type: "application/zip",
            });
            link.href = URL.createObjectURL(zip);
            link.download = fileName("zip");
        }
        urls.push(link.href);
        link.click();
        // Tarayıcı WebP oluşturamazsa PNG indirildi (NFR-1.3)
        if (used !== format) message.textContent = t("shot.webpUnsupported");
    });

    copy.addEventListener("click", async () => {
        if (!current || current.blobs.length !== 1) return;
        const [blob] = await finalBlobs();
        try {
            await navigator.clipboard.write([
                new ClipboardItem({ [blob.type]: blob }),
            ]);
            message.textContent = t("shot.copied");
        } catch {
            // Bazı tarayıcılar panoya görsel kopyalamaya izin vermez (NFR-1.3)
            message.textContent = t("shot.copyFailed");
        }
    });

    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
        run += 1;
        clear();
        setStatus(null);
        returnFocus?.focus();
    });

    renderOptions();
    return { open };
}
