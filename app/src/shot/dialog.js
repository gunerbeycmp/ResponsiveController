import { zipSync } from "fflate";
import { partFileName, shotFileName } from "./capture.js";

// FR-4.1: ekran görüntüsü önizleme penceresi. Görünen alan / Tam sayfa
// seçimi, İndir ve Kopyala; çok uzun sayfada yoğunluğu düşürülmüş tek görsel
// ya da tam yoğunlukta parçalar (R-64). Aşama 5'teki işaretleme (FR-5.3)
// bu pencerenin üzerine kurulacak.
export function createShotDialog({ t, announce, getLanguage, elements }) {
    const {
        dialog,
        close,
        modes,
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
    } = elements;
    let request = null;
    let mode = "visible";
    let current = null;
    let urls = [];
    let returnFocus = null;
    let run = 0;

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
        message.textContent = "";
    }

    function setStatus(key) {
        status.textContent = key ? t(key) : "";
        status.hidden = !key;
    }

    function renderModes() {
        const selected = mode === "parts" ? "full" : mode;
        for (const button of modes)
            button.setAttribute(
                "aria-pressed",
                String(button.dataset.shotMode === selected),
            );
    }

    // Seçilen türde görüntü alınır; pencere bu sırada açık kalır
    async function capture(next) {
        mode = next;
        renderModes();
        clear();
        const token = ++run;
        setStatus("shot.taking");
        announce(t("shot.taking"));
        try {
            const result = await request.capture(mode);
            if (token !== run) return;
            show(result);
        } catch {
            if (token === run) setStatus("shot.error");
        }
    }

    function show(result) {
        const { name } = request;
        urls = result.blobs.map((blob) => URL.createObjectURL(blob));
        current = result;
        setStatus(null);
        if (result.blobs.length === 1) {
            image.src = urls[0];
            image.alt = t("shot.imageAlt", {
                device: name,
                width: result.width,
                height: result.height,
            });
            image.hidden = false;
            copy.disabled = false;
            if (result.reduced) {
                noteText.textContent = t("shot.reducedNote", {
                    scale: result.scale.toLocaleString(getLanguage()),
                });
                split.hidden = false;
                note.hidden = false;
            }
        } else {
            parts.replaceChildren(
                ...urls.map((url, index) => {
                    const img = document.createElement("img");
                    img.src = url;
                    img.alt = t("shot.partAlt", {
                        device: name,
                        number: index + 1,
                        count: urls.length,
                    });
                    const item = document.createElement("li");
                    item.append(img);
                    return item;
                }),
            );
            parts.hidden = false;
            noteText.textContent = t("shot.partsNote", { count: urls.length });
            split.hidden = true;
            note.hidden = false;
            // Panoya tek görsel kopyalanabilir
            copy.disabled = true;
        }
        actions.hidden = false;
    }

    function fileName(extension) {
        return shotFileName(request.name, request.size, {
            suffix: mode === "visible" ? "" : t("shot.fullPageFile"),
            extension,
        });
    }

    // Pencere hemen açılır, varsayılan tür görünen alandır
    function open(options) {
        request = options;
        returnFocus = options.opener ?? document.activeElement;
        if (!dialog.open) dialog.showModal();
        capture("visible").then(() => {
            if (current) download.focus();
        });
    }

    for (const button of modes)
        button.addEventListener("click", () => {
            if (button.getAttribute("aria-pressed") === "true") return;
            capture(button.dataset.shotMode);
        });

    split.addEventListener("click", async () => {
        await capture("parts");
        download.focus();
    });

    download.addEventListener("click", async () => {
        if (!current) return;
        const link = document.createElement("a");
        if (current.blobs.length === 1) {
            link.href = urls[0];
            link.download = fileName("png");
        } else {
            // Parçalar numaralı dosyalar hâlinde tek ZIP (R-64)
            const files = {};
            for (const [index, blob] of current.blobs.entries())
                files[partFileName(t("shot.partFile"), index)] = new Uint8Array(
                    await blob.arrayBuffer(),
                );
            const zip = new Blob([zipSync(files, { level: 0 })], {
                type: "application/zip",
            });
            link.href = URL.createObjectURL(zip);
            urls.push(link.href);
            link.download = fileName("zip");
        }
        link.click();
    });

    copy.addEventListener("click", async () => {
        if (!current || current.blobs.length !== 1) return;
        const [blob] = current.blobs;
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
        returnFocus?.focus();
    });

    return { open };
}
