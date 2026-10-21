// FR-4.1: ekran görüntüsü önizleme penceresi (İndir, Kopyala).
// Aşama 5'teki işaretleme (FR-5.3) bu pencerenin üzerine kurulacak.
export function createShotDialog({ t, announce, elements }) {
    const { dialog, close, status, image, actions, download, copy, message } =
        elements;
    let current = null;
    let objectUrl = null;
    let returnFocus = null;

    function reset() {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = null;
        current = null;
        image.hidden = true;
        image.removeAttribute("src");
        actions.hidden = true;
        message.textContent = "";
    }

    function setStatus(key) {
        status.textContent = key ? t(key) : "";
        status.hidden = !key;
    }

    // Pencere hemen açılır; görüntü hazır olunca gösterilir
    async function open(task, { name, size, fileName, opener }) {
        reset();
        returnFocus = opener ?? document.activeElement;
        setStatus("shot.taking");
        announce(t("shot.taking"));
        if (!dialog.open) dialog.showModal();
        try {
            const result = await task();
            current = { ...result, fileName };
            objectUrl = URL.createObjectURL(result.blob);
            image.src = objectUrl;
            image.alt = t("shot.imageAlt", {
                device: name,
                width: size.width,
                height: size.height,
            });
            image.hidden = false;
            actions.hidden = false;
            setStatus(null);
            download.focus();
        } catch {
            setStatus("shot.error");
        }
    }

    download.addEventListener("click", () => {
        if (!current) return;
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = current.fileName;
        link.click();
    });

    copy.addEventListener("click", async () => {
        if (!current) return;
        try {
            await navigator.clipboard.write([
                new ClipboardItem({ [current.blob.type]: current.blob }),
            ]);
            message.textContent = t("shot.copied");
        } catch {
            // Bazı tarayıcılar panoya görsel kopyalamaya izin vermez (NFR-1.3)
            message.textContent = t("shot.copyFailed");
        }
    });

    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
        reset();
        returnFocus?.focus();
    });

    return { open };
}
