// Aşama 6 revizyonu: Cihazlar ve Görünüm panelleri masaüstünde açılıp
// kapanır. Kapalı panel kenarda ince bir şerit olarak kalır (açma düğmesi ve
// dikey ad). Durum tarayıcıda kalıcı olarak hatırlanır. Telefonda paneller
// alttan açılan sayfalardır (sheet.js); bu durum orada uygulanmaz.
export const PANELS_STORAGE_KEY = "rc-panels";
export const PANEL_IDS = ["devices", "view"];

export function readPanels(storage) {
    const open = { devices: true, view: true };
    try {
        const stored = JSON.parse(storage?.getItem(PANELS_STORAGE_KEY));
        for (const id of PANEL_IDS)
            if (typeof stored?.[id] === "boolean") open[id] = stored[id];
    } catch {
        // Bozuk ya da okunamayan kayıtta paneller açık gelir
    }
    return open;
}

// panels: { devices: { root, collapse, expand }, view: { ... } }
// root: panel öğesi; collapse: başlıktaki düğme; expand: şeritteki düğme
export function createPanels({ storage, panels, t, onChange }) {
    const open = readPanels(storage);

    function save() {
        try {
            storage?.setItem(PANELS_STORAGE_KEY, JSON.stringify(open));
        } catch {
            // Depolama kapalıysa durum yalnızca bu oturumda kalır
        }
    }

    function apply(id) {
        const { root, collapse, expand } = panels[id];
        root.classList.toggle("is-collapsed", !open[id]);
        collapse.setAttribute("aria-expanded", String(open[id]));
        expand.setAttribute("aria-expanded", String(open[id]));
    }

    // Düğmelerin adı ipucu olarak da gösterilir
    function translate() {
        const keys = {
            devices: ["panel.collapseDevices", "panel.expandDevices"],
            view: ["panel.collapseView", "panel.expandView"],
        };
        for (const id of PANEL_IDS) {
            const [collapseKey, expandKey] = keys[id];
            const { collapse, expand } = panels[id];
            collapse.setAttribute("aria-label", t(collapseKey));
            collapse.title = t(collapseKey);
            expand.setAttribute("aria-label", t(expandKey));
            expand.title = t(expandKey);
        }
    }

    function setOpen(id, value) {
        open[id] = value;
        save();
        apply(id);
        // Odak kaybolmasın: kapanınca şeride, açılınca başlığa geçer
        (value ? panels[id].collapse : panels[id].expand).focus();
        onChange?.(id, value);
    }

    for (const id of PANEL_IDS) {
        panels[id].collapse.addEventListener("click", () => setOpen(id, false));
        panels[id].expand.addEventListener("click", () => setOpen(id, true));
        apply(id);
    }
    translate();

    return {
        isOpen: (id) => open[id],
        translate,
    };
}
