// FR-5.3: Notlar paneli. Genel oturum notu en üstte, ardından açık cihazların
// ve daha önce not yazılmış cihazların notları. Notlar yazdıkça kaydedilir;
// temizleme onay sormaz, kısa süre "Geri al" sunar (Aşama 5 kararları).
const UNDO_TIME = 10000;

export function createNotesPanel({
    store,
    i18n,
    announce,
    elements,
    getDevices,
    describeDevice,
    onChange,
    shots,
}) {
    const {
        panel,
        open,
        close,
        session,
        list,
        clear,
        cleared,
        undo,
        general,
        generalShots,
    } = elements;
    // Rapordaki görüntülerin önizleme adresleri (görüntü kalkınca bırakılır)
    const shotUrls = new Map();
    let snapshot = null;
    let undoTimer = 0;
    let shownIds = "";

    // Yazılan değer, odaktaki alan dışındaki bütün kopyalarda güncellenir
    const setValue = (textarea, value) => {
        if (document.activeElement !== textarea && textarea.value !== value)
            textarea.value = value;
    };

    function deviceList() {
        const visible = getDevices();
        const known = new Set(visible.map((device) => device.id));
        const withShots = shots
            .list()
            .map((shot) => shot.deviceId)
            .filter(Boolean);
        const extra = [...new Set([...store.deviceIds(), ...withShots])]
            .filter((id) => !known.has(id))
            .map((id) => describeDevice(id))
            .filter(Boolean);
        return [...visible, ...extra];
    }

    function renderDevices() {
        const devices = deviceList();
        const ids = devices.map((device) => device.id).join("|");
        // Liste değişmediyse alanlar yeniden kurulmaz; odak ve imleç korunur
        if (ids !== shownIds) {
            shownIds = ids;
            list.replaceChildren(
                ...devices.map((device) => {
                    const field = document.createElement("div");
                    field.className = "notes-field";
                    const label = document.createElement("label");
                    label.htmlFor = `notes-device-${device.id}`;
                    const textarea = document.createElement("textarea");
                    textarea.id = `notes-device-${device.id}`;
                    textarea.rows = 3;
                    textarea.dataset.noteDevice = device.id;
                    const gallery = document.createElement("ul");
                    gallery.className = "notes-shots";
                    gallery.dataset.shotsFor = device.id;
                    field.append(label, textarea, gallery);
                    return field;
                }),
            );
        }
        for (const device of devices) {
            const textarea = list.querySelector(
                `[data-note-device="${CSS.escape(device.id)}"]`,
            );
            textarea.previousElementSibling.textContent = i18n.t(
                "notes.device",
                { device: device.name },
            );
            textarea.placeholder = i18n.t("notes.devicePlaceholder");
            setValue(textarea, store.getDevice(device.id));
            renderShots(
                textarea.nextElementSibling,
                shots.list().filter((shot) => shot.deviceId === device.id),
            );
        }
    }

    // FR-5.1: rapora eklenen görüntüler küçük görseller olarak listelenir
    function renderShots(gallery, items) {
        gallery.replaceChildren(
            ...items.map((shot) => {
                if (!shotUrls.has(shot.id))
                    shotUrls.set(shot.id, URL.createObjectURL(shot.blob));
                const img = document.createElement("img");
                img.src = shotUrls.get(shot.id);
                img.alt = shot.name
                    ? i18n.t("shot.imageAlt", {
                          device: shot.name,
                          width: shot.width,
                          height: shot.height,
                      })
                    : i18n.t("notes.generalShots");
                const remove = document.createElement("button");
                remove.type = "button";
                remove.textContent = "✕";
                remove.dataset.removeShot = shot.id;
                remove.setAttribute("aria-label", i18n.t("notes.removeShot"));
                const item = document.createElement("li");
                item.append(img, remove);
                return item;
            }),
        );
        gallery.hidden = items.length === 0;
    }

    function releaseUrls() {
        const ids = new Set(shots.list().map((shot) => shot.id));
        for (const [id, url] of shotUrls)
            if (!ids.has(id)) {
                URL.revokeObjectURL(url);
                shotUrls.delete(id);
            }
    }

    function sync() {
        open.setAttribute("aria-expanded", String(!panel.hidden));
        if (panel.hidden) return;
        setValue(session, store.getSession());
        const generalItems = shots.list().filter((shot) => !shot.deviceId);
        renderShots(generalShots, generalItems);
        general.hidden = generalItems.length === 0;
        renderDevices();
        releaseUrls();
    }

    function show() {
        panel.hidden = false;
        document.body.classList.add("notes-open");
        sync();
        session.focus();
        onChange?.();
    }

    function hide() {
        panel.hidden = true;
        document.body.classList.remove("notes-open");
        sync();
        open.focus();
        onChange?.();
    }

    function endUndo() {
        clearTimeout(undoTimer);
        snapshot = null;
        cleared.hidden = true;
        undo.hidden = true;
        clear.hidden = false;
    }

    open.addEventListener("click", () => (panel.hidden ? show() : hide()));
    close.addEventListener("click", hide);
    panel.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        hide();
    });

    session.addEventListener("input", () => {
        store.setSession(session.value);
        onChange?.();
    });
    list.addEventListener("input", (event) => {
        const id = event.target.dataset.noteDevice;
        if (!id) return;
        store.setDevice(id, event.target.value);
        onChange?.();
    });

    panel.addEventListener("click", async (event) => {
        const id =
            event.target.closest("[data-remove-shot]")?.dataset.removeShot;
        if (!id) return;
        await shots.remove(id);
        shownIds = "";
        onChange?.();
        session.focus();
    });

    clear.addEventListener("click", async () => {
        snapshot = { notes: store.clear(), shots: await shots.clear() };
        clear.hidden = true;
        cleared.hidden = false;
        undo.hidden = false;
        undo.focus();
        announce(i18n.t("notes.cleared"));
        shownIds = "";
        onChange?.();
        clearTimeout(undoTimer);
        undoTimer = setTimeout(() => {
            const focused = document.activeElement === undo;
            endUndo();
            if (focused) clear.focus();
        }, UNDO_TIME);
    });

    undo.addEventListener("click", async () => {
        if (snapshot) {
            store.restore(snapshot.notes);
            await shots.restore(snapshot.shots);
        }
        endUndo();
        shownIds = "";
        onChange?.();
        clear.focus();
    });

    return {
        sync,
        // Bağlam (adres / proje) değişince geri alma geçersiz olur
        resetUndo: endUndo,
        isOpen: () => !panel.hidden,
    };
}
