import Sortable from "sortablejs";
import {
    baseName,
    deviceName,
    foldSibling,
    findDevice,
    fitScale,
    isLandscape,
    viewRenderSize,
    viewSize,
} from "../devices/devices.js";
import { MAX_ZOOM, clampZoom, minZoom, zoomIn, zoomOut } from "./zoom.js";

// Eşit büyüklükteki kutuların cihaz alanı (Aşama 3 Tasarım Kararları)
export const BOX_AREAS = {
    small: { width: 220, height: 280 },
    medium: { width: 300, height: 380 },
    large: { width: 420, height: 520 },
};

const EPSILON = 0.001;

const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children.filter(Boolean));
    return node;
};

const iconButton = (className, text) =>
    el("button", { type: "button", className, textContent: text });

// Çoklu cihaz ızgarası (FR-3.6 döndürme, FR-3.7 ızgara, FR-3.9 ölçek). Kutular kimliğe göre
// tutulur ve yeniden kullanılır; böylece yakınlaştırma gibi değişikliklerde
// iframe'ler yeniden yüklenmez.
export function createGridView({
    list,
    i18n,
    store,
    announce,
    getUrl,
    getExpandedArea,
    onEmpty,
    onRotate,
    onFold,
    onShot,
    canShoot = () => false,
    notes,
}) {
    const boxes = new Map();
    const noteOpen = new Set();

    // Not düğmesi, alanı ve değeri; odaktaki alanın değeri üzerine yazılmaz
    function updateNote(id) {
        const p = boxes.get(id);
        if (!p || !notes) return;
        const name = nameOf(id);
        const text = notes.get(id);
        p.note.setAttribute(
            "aria-label",
            i18n.t("notes.device", { device: name }),
        );
        p.note.setAttribute("aria-expanded", String(noteOpen.has(id)));
        p.note.classList.toggle("has-note", Boolean(text.trim()));
        p.noteArea.hidden = !noteOpen.has(id);
        p.noteLabel.textContent = i18n.t("notes.device", { device: name });
        p.noteText.placeholder = i18n.t("notes.devicePlaceholder");
        if (document.activeElement !== p.noteText && p.noteText.value !== text)
            p.noteText.value = text;
    }
    const zooms = new Map();
    let expanded = null;
    let openMenu = null;

    const nameOf = (id) => deviceName(findDevice(id), i18n.getLanguage());

    // Kutunun ölçeği: kutuya özel ayar ("fit" ya da sayı), yoksa genel ölçek
    // (FR-3.9), o da yoksa Sığdır
    function geometry(id) {
        const device = findDevice(id);
        const rotated = store.isRotated(id);
        const size = viewSize(device, { rotated });
        const render = viewRenderSize(device, { rotated });
        const area =
            expanded === id ? getExpandedArea() : BOX_AREAS[store.getSize()];
        const fit = fitScale(size, area);
        const own = zooms.get(id);
        const zoom =
            own === "fit"
                ? fit
                : clampZoom(own ?? store.getScale() ?? fit, fit);
        return { device, size, render, area, fit, zoom };
    }

    function setZoom(id, value) {
        const { fit } = geometry(id);
        zooms.set(id, clampZoom(value, fit));
        update(id);
    }

    function createBox(id) {
        const parts = {
            li: el("li", { className: "grid-box" }),
            handle: iconButton("box-handle", "⋮⋮"),
            name: el("strong", { className: "box-name" }),
            size: el("span", { className: "box-size" }),
            remove: iconButton("box-remove", "✕"),
            out: iconButton("box-zoom-out", "−"),
            scale: el("span", { className: "box-scale" }),
            in: iconButton("box-zoom-in", "+"),
            fit: iconButton("box-fit", ""),
            shot: iconButton("box-shot", "📷"),
            note: iconButton("box-shot note-toggle", "📝"),
            noteArea: el("div", { className: "box-note", hidden: true }),
            noteLabel: el("label"),
            noteText: el("textarea", { rows: 3 }),
            rotate: iconButton("box-rotate", "⟳"),
            fold: iconButton("box-fold", ""),
            expand: iconButton("box-expand", ""),
            menuSlot: el("div"),
            iframe: el("iframe"),
            canvas: el("div", { className: "box-canvas" }),
            viewport: el("div", { className: "box-viewport" }),
        };
        const p = parts;
        p.li.dataset.gridId = id;
        // Yakınlaştırılmış cihaz klavyeyle de kaydırılabilsin (WCAG 2.1.1)
        p.viewport.tabIndex = 0;
        p.viewport.setAttribute("role", "region");
        p.handle.dataset.boxHandle = id;
        p.handle.setAttribute("aria-haspopup", "menu");
        p.canvas.append(p.iframe);
        p.viewport.append(p.canvas);
        p.li.append(
            el(
                "div",
                { className: "box-header" },
                el(
                    "div",
                    { className: "box-title" },
                    p.handle,
                    el("p", { className: "box-info" }, p.name, p.size),
                    p.remove,
                ),
                el(
                    "div",
                    { className: "box-controls" },
                    p.out,
                    p.scale,
                    p.in,
                    p.fit,
                    p.shot,
                    p.note,
                    p.rotate,
                    p.fold,
                    p.expand,
                ),
            ),
            p.menuSlot,
            p.noteArea,
            el(
                "div",
                { className: "box-stage" },
                p.viewport,
                // Ctrl basılıyken sitenin üzerine konan görünmez katman;
                // tekerlek hareketini araçta yakalar (R-61)
                el("div", { className: "box-overlay" }),
            ),
        );

        p.remove.addEventListener("click", () => removeBox(id));
        p.out.addEventListener("click", () =>
            setZoom(id, zoomOut(geometry(id).zoom, geometry(id).fit)),
        );
        p.in.addEventListener("click", () =>
            setZoom(id, zoomIn(geometry(id).zoom)),
        );
        p.fit.addEventListener("click", () => {
            zooms.set(id, "fit");
            update(id);
        });
        p.rotate.addEventListener("click", () => {
            store.setRotated(id, !store.isRotated(id));
            update(id);
            // Araç çubuğundaki toplu döndürme ve orijinal konum düğmeleri
            // de güncellenir
            onRotate?.();
            announce(
                i18n.t(
                    isLandscape(geometry(id).size)
                        ? "rotate.landscape"
                        : "rotate.portrait",
                    { device: nameOf(id) },
                ),
            );
        });
        // FR-3.5: kutu aynı yerde kalır, içindeki hâl değişir
        p.fold.addEventListener("click", () => onFold?.(id));
        // FR-4.4: kutu başına ekran görüntüsü
        p.shot.addEventListener("click", () => onShot?.(id));

        // FR-5.3: kutunun not alanı başlığın altında açılır
        p.noteText.id = `box-note-${id}`;
        p.noteLabel.htmlFor = p.noteText.id;
        p.noteArea.id = `box-note-area-${id}`;
        p.noteArea.append(p.noteLabel, p.noteText);
        p.note.setAttribute("aria-controls", p.noteArea.id);
        p.note.addEventListener("click", () => {
            if (noteOpen.has(id)) noteOpen.delete(id);
            else noteOpen.add(id);
            updateNote(id);
            if (noteOpen.has(id)) p.noteText.focus();
        });
        p.noteText.addEventListener("input", () =>
            notes?.set(id, p.noteText.value),
        );
        p.expand.addEventListener("click", () => {
            expanded = expanded === id ? null : id;
            render();
            boxes.get(id)?.expand.focus();
        });
        p.handle.addEventListener("click", () => {
            openMenu = openMenu === id ? null : id;
            render();
            const target = openMenu
                ? boxes.get(id).menuSlot.querySelector("[role=menuitem]")
                : boxes.get(id).handle;
            target?.focus();
        });

        // Ctrl + tekerlek (dokunmatik yüzeyde iki parmakla yakınlaştırma da
        // tarayıcıya Ctrl + tekerlek olarak gelir)
        p.li.addEventListener(
            "wheel",
            (event) => {
                if (!event.ctrlKey) return;
                event.preventDefault();
                setZoom(id, geometry(id).zoom * Math.exp(-event.deltaY * 0.01));
            },
            { passive: false },
        );

        // Dokunmatik ekranda iki parmakla yakınlaştırma (kutu başlığı ve
        // kenarlarında; site üzerindeki hareketler siteye gider, R-61)
        let pinch = null;
        const distance = (touches) =>
            Math.hypot(
                touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY,
            );
        p.li.addEventListener("touchstart", (event) => {
            if (event.touches.length === 2)
                pinch = {
                    distance: distance(event.touches),
                    zoom: geometry(id).zoom,
                };
        });
        p.li.addEventListener("touchmove", (event) => {
            if (!pinch || event.touches.length !== 2) return;
            setZoom(
                id,
                (pinch.zoom * distance(event.touches)) / pinch.distance,
            );
        });
        p.li.addEventListener("touchend", () => {
            pinch = null;
        });
        return parts;
    }

    function moveMenu(id, index, count) {
        const actions = [
            index > 0 ? "moveLeft" : null,
            index < count - 1 ? "moveRight" : null,
        ].filter(Boolean);
        const menu = el(
            "ul",
            { className: "favorite-menu box-menu", id: "box-menu" },
            ...actions.map((action) => {
                const item = el("button", {
                    type: "button",
                    textContent: i18n.t(`grid.${action}`),
                    tabIndex: -1,
                });
                item.setAttribute("role", "menuitem");
                item.addEventListener("click", () =>
                    moveBox(id, action === "moveLeft" ? index - 1 : index + 1),
                );
                const li = el("li", {}, item);
                li.setAttribute("role", "none");
                return li;
            }),
        );
        menu.setAttribute("role", "menu");
        menu.setAttribute(
            "aria-label",
            i18n.t("grid.handle", { device: nameOf(id) }),
        );
        return menu;
    }

    function update(id) {
        const p = boxes.get(id);
        if (!p) return;
        const { size, render, area, fit, zoom } = geometry(id);
        const name = nameOf(id);
        const ids = store.list();
        const index = ids.indexOf(id);

        p.li.hidden = expanded !== null && expanded !== id;
        p.li.classList.toggle("is-expanded", expanded === id);
        p.viewport.style.width = `${area.width}px`;
        p.viewport.style.height = `${area.height}px`;
        p.canvas.style.width = `${Math.round(size.width * zoom)}px`;
        p.canvas.style.height = `${Math.round(size.height * zoom)}px`;
        p.iframe.style.width = `${render.width}px`;
        p.iframe.style.height = `${render.height}px`;
        p.iframe.style.transform = `scale(${(zoom * size.width) / render.width})`;
        p.iframe.title = i18n.t("frame.title", { device: name });
        p.viewport.setAttribute("aria-label", p.iframe.title);
        const url = getUrl();
        if (url && p.iframe.dataset.src !== url) {
            p.iframe.dataset.src = url;
            p.iframe.src = url;
        }

        p.name.textContent = name;
        p.size.textContent = i18n.t("frame.size", size);
        p.scale.textContent = i18n.t("frame.scale", {
            scale: Math.round(zoom * 100),
        });
        p.handle.setAttribute(
            "aria-label",
            i18n.t("grid.handle", { device: name }),
        );
        p.handle.setAttribute("aria-expanded", String(openMenu === id));
        p.handle.toggleAttribute("hidden", ids.length < 2);
        if (openMenu === id) p.handle.setAttribute("aria-controls", "box-menu");
        else p.handle.removeAttribute("aria-controls");
        p.remove.setAttribute(
            "aria-label",
            i18n.t("grid.remove", { device: name }),
        );
        p.out.setAttribute("aria-label", i18n.t("zoom.out"));
        p.in.setAttribute("aria-label", i18n.t("zoom.in"));
        p.out.disabled = zoom <= minZoom(fit) + EPSILON;
        p.in.disabled = zoom >= MAX_ZOOM - EPSILON;
        p.fit.textContent = i18n.t("zoom.fit");
        p.fit.disabled = Math.abs(zoom - fit) < EPSILON;
        p.rotate.setAttribute(
            "aria-label",
            i18n.t(
                isLandscape(size) ? "rotate.toPortrait" : "rotate.toLandscape",
                { device: name },
            ),
        );
        const isExpanded = expanded === id;
        p.expand.textContent = isExpanded ? "⤡" : "⤢";
        p.expand.setAttribute(
            "aria-label",
            i18n.t(isExpanded ? "grid.collapse" : "grid.expand", {
                device: name,
            }),
        );
        const device = findDevice(id);
        p.shot.hidden = !canShoot();
        updateNote(id);
        p.shot.setAttribute(
            "aria-label",
            i18n.t("shot.take", { device: name }),
        );
        p.fold.hidden = !foldSibling(device);
        if (device.foldable) {
            const folded = device.foldable.state === "folded";
            p.fold.textContent = i18n.t(folded ? "fold.unfold" : "fold.fold");
            p.fold.setAttribute(
                "aria-label",
                i18n.t(folded ? "fold.unfoldLabel" : "fold.foldLabel", {
                    device: baseName(device, i18n.getLanguage()),
                }),
            );
        }
        p.menuSlot.replaceChildren(
            openMenu === id ? moveMenu(id, index, ids.length) : "",
        );
    }

    function render() {
        const ids = store.list();
        if (!ids.includes(expanded)) expanded = null;
        if (!ids.includes(openMenu)) openMenu = null;
        for (const [id, parts] of boxes) {
            if (ids.includes(id)) continue;
            parts.li.remove();
            boxes.delete(id);
            zooms.delete(id);
        }
        ids.forEach((id, index) => {
            if (!boxes.has(id)) boxes.set(id, createBox(id));
            const { li } = boxes.get(id);
            const current = list.children[index] ?? null;
            if (current === li) return;
            // moveBefore iframe'i yeniden yüklemeden taşır (destekleyen
            // tarayıcılarda); yeni kutular normal şekilde eklenir
            if (li.isConnected && list.moveBefore) list.moveBefore(li, current);
            else list.insertBefore(li, current);
        });
        list.classList.toggle("has-expanded", expanded !== null);
        for (const id of ids) update(id);
    }

    function removeBox(id) {
        const ids = store.list();
        const next = ids[ids.indexOf(id) + 1] ?? ids[ids.indexOf(id) - 1];
        store.remove(id);
        announce(i18n.t("grid.removed", { device: nameOf(id) }));
        onEmpty?.(store.list().length === 0, next);
    }

    function moveBox(id, index) {
        store.add(id, index);
        openMenu = null;
        render();
        announce(
            i18n.t("grid.moved", {
                device: nameOf(id),
                position: store.list().indexOf(id) + 1,
            }),
        );
        boxes.get(id)?.handle.focus();
    }

    // WAI-ARIA menü kalıbı: ok tuşları, Home, End, Esc ve Tab (NFR-5.1)
    list.addEventListener("keydown", (event) => {
        const menu = event.target.closest(".box-menu");
        if (!menu) return;
        const items = [...menu.querySelectorAll("[role=menuitem]")];
        const index = items.indexOf(event.target);
        if (event.key === "Escape" || event.key === "Tab") {
            if (event.key === "Escape") event.preventDefault();
            const id = openMenu;
            openMenu = null;
            render();
            boxes.get(id)?.handle.focus();
            return;
        }
        const next = {
            ArrowDown: (index + 1) % items.length,
            ArrowUp: (index - 1 + items.length) % items.length,
            Home: 0,
            End: items.length - 1,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        items[next].focus();
    });

    document.addEventListener("pointerdown", (event) => {
        if (!openMenu) return;
        if (event.target.closest(".box-menu, .box-handle")) return;
        openMenu = null;
        render();
    });

    // Ctrl basılıyken kutulardaki sitelerin üzerine katman konur (R-61)
    const setCapture = (on) => list.classList.toggle("zoom-capture", on);
    window.addEventListener("keydown", (event) => {
        if (event.key === "Control") setCapture(true);
    });
    window.addEventListener("keyup", (event) => {
        if (event.key === "Control") setCapture(false);
    });
    window.addEventListener("blur", () => setCapture(false));

    // FR-3.7: kutular tutamaçtan sürüklenerek sıralanır
    Sortable.create(list, {
        group: "grid",
        handle: ".box-handle",
        forceFallback: true,
        fallbackTolerance: 4,
        animation: 150,
        onStart: () => {
            openMenu = null;
            document.body.classList.add("is-dragging");
        },
        onEnd: ({ item, oldIndex, newIndex }) => {
            document.body.classList.remove("is-dragging");
            if (oldIndex === newIndex) return;
            const id = item.dataset.gridId;
            setTimeout(() => moveBox(id, newIndex));
        },
    });

    return {
        render,
        // Kutunun o anki ölçeği (ekran paylaşımı notu için)
        zoomOf: (id) => geometry(id).zoom,
        // Not değişince yalnızca not parçaları güncellenir
        syncNotes() {
            for (const id of boxes.keys()) updateNote(id);
        },
        // Genel ölçek değişince kutuların kendi ayarları sıfırlanır (FR-3.9)
        resetZooms() {
            zooms.clear();
            render();
        },
        // Tek cihaz moduna geçince ya da proje yeniden yüklenince kutular
        // (ve iframe'leri) kaldırılır; ızgaraya dönünce yeniden yüklenir
        clear() {
            for (const parts of boxes.values()) parts.li.remove();
            boxes.clear();
            zooms.clear();
            expanded = null;
            openMenu = null;
        },
        collapse() {
            expanded = null;
            render();
        },
        boxFor: (id) => boxes.get(id),
    };
}
