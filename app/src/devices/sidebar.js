import Sortable from "sortablejs";
import { DEVICES, deviceName } from "./devices.js";
import { createGroupState, groupKey } from "./groups.js";
import {
    TABS,
    buildFavorites,
    buildTab,
    searchDevices,
    tabOf,
} from "./menu.js";

const ALL_TABS = ["favorites", ...TABS, "custom"];

// Sol menü: arama, kategori sekmeleri, gruplar ve favoriler
// (Aşama 3 Tasarım Kararları, FR-3.2)
export function createSidebar({
    search,
    tabList,
    panel,
    announce,
    i18n,
    favorites,
    grid,
    custom,
    getSelectedId,
    onSelect,
    onDeviceDrag,
    storage,
}) {
    // Marka gruplarının açık / kapalı durumu (Aşama 6 revizyonu)
    const groupState = createGroupState({ storage });
    const selected = DEVICES.find((d) => d.id === getSelectedId());
    let activeTab =
        favorites.list().length > 0
            ? "favorites"
            : tabOf(selected ?? DEVICES[0]);
    let query = "";
    let openMenu = null;
    let sortables = [];
    const expanded = new Set();
    // Özel sekmesi: formdaki yazılı değerler yeniden çizimde kaybolmasın
    const draft = { width: "", height: "", error: false };
    let editing = null;

    const el = (tag, props = {}, ...children) => {
        const node = document.createElement(tag);
        Object.assign(node, props);
        node.append(...children.filter(Boolean));
        return node;
    };

    const nameOf = (device) => deviceName(device, i18n.getLanguage());
    const findById = (id) => DEVICES.find((d) => d.id === id);

    function badge(key) {
        return el("span", { className: "badge", textContent: i18n.t(key) });
    }

    function deviceButton(device, { showPopular = true } = {}) {
        const button = el("button", {
            type: "button",
            className: "device-button",
        });
        button.dataset.deviceId = device.id;
        // Izgara modunda satır cihazı ızgaraya ekler / çıkarır (FR-3.7)
        button.setAttribute(
            "aria-pressed",
            String(
                grid.isActive()
                    ? grid.has(device.id)
                    : device.id === getSelectedId(),
            ),
        );
        const title = el("span", { className: "device-name" }, nameOf(device));
        const meta = el(
            "span",
            { className: "device-meta" },
            el("span", {
                className: "device-size",
                textContent: i18n.t("frame.size", device.screen),
            }),
            showPopular && device.popular ? badge("badge.popular") : null,
            device.foldable ? badge("badge.foldable") : null,
        );
        button.append(title, meta);
        return button;
    }

    // Yıldız fareyle üzerine gelince veya klavyeyle satıra gelince görünür;
    // dokunmatik ekranlarda ve favorilerde her zaman görünür (R-59)
    function favoriteToggle(device) {
        const on = favorites.has(device.id);
        const button = el("button", {
            type: "button",
            className: on ? "favorite-toggle is-favorite" : "favorite-toggle",
            textContent: on ? "★" : "☆",
        });
        button.dataset.favoriteId = device.id;
        button.setAttribute(
            "aria-label",
            i18n.t(on ? "favorites.remove" : "favorites.add", {
                device: nameOf(device),
            }),
        );
        return button;
    }

    // "+" düğmesi yıldızla aynı kuralla görünür; ızgara modunda ızgaradaki
    // cihazlarda ✓ olur ve cihazı ızgaradan çıkarır
    function gridToggle(device) {
        const inGrid = grid.isActive() && grid.has(device.id);
        const button = el("button", {
            type: "button",
            className: inGrid ? "grid-toggle is-in-grid" : "grid-toggle",
            textContent: inGrid ? "✓" : "+",
        });
        button.dataset.gridToggle = device.id;
        button.setAttribute(
            "aria-label",
            i18n.t(inGrid ? "grid.remove" : "grid.add", {
                device: nameOf(device),
            }),
        );
        return button;
    }

    // Özel boyutlarda yıldız yerine ad düzenleme ve silme düğmeleri gelir;
    // kaydedilmedikleri için favorilere eklenemezler (R-19)
    function customActions(device) {
        const rename = el("button", {
            type: "button",
            className: "custom-rename",
            textContent: "✎",
        });
        rename.dataset.renameId = device.id;
        rename.setAttribute(
            "aria-label",
            i18n.t("custom.rename", { device: nameOf(device) }),
        );
        const remove = el("button", {
            type: "button",
            className: "custom-delete",
            textContent: "✕",
        });
        remove.dataset.deleteId = device.id;
        remove.setAttribute(
            "aria-label",
            i18n.t("custom.delete", { device: nameOf(device) }),
        );
        return [rename, remove];
    }

    function nameEditor(device) {
        const input = el("input", {
            className: "custom-name-input",
            type: "text",
            value: nameOf(device),
        });
        input.dataset.editId = device.id;
        input.setAttribute("aria-label", i18n.t("custom.nameLabel"));
        return el("div", { className: "device-row is-editing" }, input);
    }

    function row(device, options = {}, ...extra) {
        if (device.custom && editing === device.id) return nameEditor(device);
        return el(
            "div",
            { className: "device-row" },
            options.handle ?? null,
            deviceButton(device, options),
            ...extra,
            gridToggle(device),
            ...(device.custom
                ? customActions(device)
                : [favoriteToggle(device)]),
        );
    }

    function list(items, options) {
        return el(
            "ul",
            { className: "device-list" },
            ...items.map((d) => el("li", {}, row(d, options))),
        );
    }

    function group(title, content, className = "device-group") {
        return el(
            "section",
            { className },
            el("h3", { className: "group-title", textContent: title }),
            content,
        );
    }

    function resolutionList(rows) {
        return el(
            "ul",
            { className: "device-list" },
            ...rows.map(({ resolution, devices }) => {
                const key = resolution.id;
                const item = el("li", { className: "resolution-row" });
                let toggle = null;
                if (devices.length > 0) {
                    const open = expanded.has(key);
                    const subId = `res-devices-${key}`;
                    toggle = el("button", {
                        type: "button",
                        className: "resolution-toggle",
                        textContent:
                            devices.length === 1
                                ? i18n.t("resolution.devicesOne")
                                : i18n.t("resolution.devices", {
                                      count: devices.length,
                                  }),
                    });
                    toggle.setAttribute("aria-expanded", String(open));
                    toggle.setAttribute("aria-controls", subId);
                    toggle.addEventListener("click", () => {
                        if (expanded.has(key)) expanded.delete(key);
                        else expanded.add(key);
                        render({ focus: `[aria-controls="${subId}"]` });
                    });
                }
                item.append(row(resolution, {}, toggle));
                if (toggle) {
                    const sub = list(devices);
                    sub.id = toggle.getAttribute("aria-controls");
                    sub.classList.add("resolution-devices");
                    sub.hidden =
                        toggle.getAttribute("aria-expanded") !== "true";
                    item.append(sub);
                }
                return item;
            }),
        );
    }

    // Tutamaç hem sürüklenir hem de tıklanınca taşıma menüsünü açar;
    // menü sürüklemenin klavye karşılığıdır (NFR-5.2)
    function handle(device) {
        const open = openMenu === device.id;
        const button = el("button", {
            type: "button",
            className: "drag-handle",
            textContent: "⋮⋮",
        });
        button.dataset.handleId = device.id;
        button.setAttribute(
            "aria-label",
            i18n.t("favorites.handle", { device: nameOf(device) }),
        );
        button.setAttribute("aria-haspopup", "menu");
        button.setAttribute("aria-expanded", String(open));
        if (open) button.setAttribute("aria-controls", `favorite-menu`);
        return button;
    }

    function moveMenu(device, inFrequent, index, count) {
        const actions = inFrequent
            ? [
                  "removeFromFrequent",
                  index > 0 ? "moveUp" : null,
                  index < count - 1 ? "moveDown" : null,
              ]
            : ["moveToFrequent"];
        const menu = el(
            "ul",
            { className: "favorite-menu", id: "favorite-menu" },
            ...actions.filter(Boolean).map((action) => {
                const item = el("button", {
                    type: "button",
                    textContent: i18n.t(`favorites.${action}`),
                    tabIndex: -1,
                });
                item.setAttribute("role", "menuitem");
                item.dataset.action = action;
                item.dataset.menuFor = device.id;
                const li = el("li", {}, item);
                li.setAttribute("role", "none");
                return li;
            }),
        );
        menu.setAttribute("role", "menu");
        menu.setAttribute(
            "aria-label",
            i18n.t("favorites.handle", { device: nameOf(device) }),
        );
        return menu;
    }

    function favoriteList(items, zone) {
        const ul = el(
            "ul",
            { className: "device-list" },
            ...items.map((device, index) => {
                const li = el(
                    "li",
                    {},
                    row(device, { handle: handle(device) }),
                    openMenu === device.id
                        ? moveMenu(
                              device,
                              zone === "frequent",
                              index,
                              items.length,
                          )
                        : null,
                );
                li.dataset.favoriteItem = device.id;
                return li;
            }),
        );
        ul.dataset.zone = zone;
        return ul;
    }

    function favoritesPanel() {
        const groups = buildFavorites(
            DEVICES,
            favorites.list(),
            favorites.frequent(),
        );
        if (groups.length === 0)
            return [
                el("p", {
                    className: "search-empty",
                    textContent: i18n.t("favorites.empty"),
                }),
            ];
        const frequent = groups[0].type === "frequent" ? groups.shift() : null;
        // Favoriler sekmesindeki gruplar başta her zaman açıktır
        const top = frequent
            ? collapsible({
                  tab: "favorites",
                  id: "#frequent",
                  title: i18n.t("group.frequent"),
                  items: frequent.items,
                  content: favoriteList(frequent.items, "frequent"),
                  open: true,
              })
            : // Grup yokken bırakma alanı yalnızca sürükleme sırasında görünür
              el(
                  "section",
                  { className: "frequent-drop" },
                  el("p", {
                      className: "drop-hint",
                      textContent: i18n.t("favorites.dropHint"),
                  }),
                  favoriteList([], "frequent"),
              );
        return [
            top,
            ...groups.map((g) =>
                collapsible({
                    tab: "favorites",
                    id: `#${g.category}`,
                    title: i18n.t(
                        g.category === "generic"
                            ? "group.generic"
                            : `category.${g.category}`,
                    ),
                    items: g.items,
                    content: favoriteList(g.items, "category"),
                    // Favoriler kısa ve kullanıcının seçtiği listedir; bir
                    // cihaz çıkarılınca grup kendiliğinden kapanmasın
                    open: true,
                }),
            ),
        ];
    }

    function renderTabs() {
        tabList.replaceChildren(
            ...ALL_TABS.map((tab) => {
                const selected = tab === activeTab;
                const button = el("button", {
                    type: "button",
                    id: `tab-${tab}`,
                    className: "tab",
                    textContent: i18n.t(`category.${tab}`),
                    tabIndex: selected ? 0 : -1,
                });
                button.setAttribute("role", "tab");
                button.setAttribute("aria-selected", String(selected));
                button.setAttribute("aria-controls", panel.id);
                button.dataset.tab = tab;
                return button;
            }),
        );
        panel.setAttribute("aria-labelledby", `tab-${activeTab}`);
    }

    function searchPanel() {
        const results = searchDevices(DEVICES, query);
        if (results.length === 0)
            return [
                el("p", {
                    className: "search-empty",
                    textContent: i18n.t("sidebar.searchEmpty", {
                        query: query.trim(),
                    }),
                }),
            ];
        return results.map(({ category, items }) =>
            group(
                i18n.t(
                    category === "generic"
                        ? "group.generic"
                        : `category.${category}`,
                ),
                list(items),
            ),
        );
    }

    function tabPanel() {
        const tab = activeTab;
        return buildTab(DEVICES, tab).map((g) => {
            if (g.type === "popular")
                return collapsible({
                    tab,
                    id: "#popular",
                    title: i18n.t("group.popular"),
                    items: g.items,
                    content: list(g.items, { showPopular: false }),
                });
            if (g.type === "generic")
                return collapsible({
                    tab,
                    id: "#generic",
                    title: i18n.t("group.generic"),
                    items: g.items,
                    content: list(g.items),
                });
            if (g.type === "resolutions") return resolutionList(g.rows);
            // Markası olmayan cihazlar (ör. TV) başlıksız tek grup
            if (!g.brand) return group(g.brand, list(g.items));
            return collapsible({
                tab,
                id: g.brand,
                title: g.brand,
                items: g.items,
                content: list(g.items),
            });
        });
    }

    // Açılır-kapanır grup (Aşama 6 revizyonu); başlıkta ok, ad ve cihaz
    // sayısı. Kullanıcının dokunmadığı grupta seçili cihazı içeren grup
    // açıktır. Durum değişince yalnızca bu grup güncellenir, odak düğmede kalır
    function collapsible({ tab, id, title, items, content, open }) {
        const key = groupKey(tab, id);
        const fallback = open ?? items.some((d) => d.id === getSelectedId());
        content.id = `group-${tab}-${id
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+/, "")}`;
        const chevron = el("span", { className: "group-chevron" });
        chevron.setAttribute("aria-hidden", "true");
        const toggle = el(
            "button",
            { type: "button", className: "group-toggle" },
            chevron,
            el("span", { className: "group-name", textContent: title }),
            el("span", {
                className: "group-count",
                textContent: String(items.length),
            }),
        );
        toggle.setAttribute("aria-controls", content.id);
        const apply = (value) => {
            toggle.setAttribute("aria-expanded", String(value));
            content.hidden = !value;
        };
        apply(groupState.isOpen(key, fallback));
        toggle.addEventListener("click", () => {
            const value = toggle.getAttribute("aria-expanded") !== "true";
            groupState.setOpen(key, value);
            apply(value);
        });
        return el(
            "section",
            { className: "device-group collapsible-group" },
            el("h3", { className: "group-title" }, toggle),
            content,
        );
    }

    // FR-3.11: Özel sekmesi; form, kaydedilmediği notu ve oturumdaki boyutlar
    function customPanel() {
        const field = (key, id, value) => {
            const input = el("input", {
                id,
                type: "number",
                min: "100",
                max: "3840",
                step: "1",
                inputMode: "numeric",
                value,
            });
            input.dataset.draft = key;
            if (draft.error) {
                input.setAttribute("aria-invalid", "true");
                input.setAttribute("aria-describedby", "custom-error");
            }
            return el(
                "label",
                { className: "custom-field" },
                el("span", {
                    textContent: i18n.t(
                        key === "width"
                            ? "custom.widthLabel"
                            : "custom.heightLabel",
                    ),
                }),
                input,
            );
        };
        const form = el(
            "form",
            { className: "custom-form", noValidate: true },
            el(
                "div",
                { className: "custom-fields" },
                field("width", "custom-width", draft.width),
                field("height", "custom-height", draft.height),
                el("button", {
                    type: "submit",
                    className: "button-primary custom-create",
                    textContent: i18n.t("custom.create"),
                }),
            ),
            el("p", {
                className: "custom-error",
                id: "custom-error",
                textContent: draft.error ? i18n.t("custom.error.range") : "",
            }),
            el("p", {
                className: "custom-note",
                textContent: i18n.t("custom.note"),
            }),
        );
        const items = custom.list();
        return [
            form,
            items.length > 0
                ? list(items)
                : el("p", {
                      className: "search-empty",
                      textContent: i18n.t("custom.empty"),
                  }),
        ];
    }

    function renderPanel() {
        for (const sortable of sortables) sortable.destroy();
        sortables = [];
        if (query.trim()) {
            panel.replaceChildren(...searchPanel());
        } else if (activeTab === "custom") {
            panel.replaceChildren(...customPanel());
        } else if (activeTab === "favorites") {
            panel.replaceChildren(...favoritesPanel());
            setupDrag();
        } else {
            panel.replaceChildren(...tabPanel());
        }
        setupDeviceDrag();
    }

    // Menüden önizleme alanına sürükleyerek ızgaraya ekleme (FR-3.7).
    // Dokunmatik ve dar ekranlarda kapalıdır (R-60)
    const canDragToGrid = () =>
        window.matchMedia(
            "(hover: hover) and (pointer: fine) and (min-width: 768px)",
        ).matches;

    const dragEvents = {
        onStart: () => onDeviceDrag?.(true),
        onEnd: () => {
            onDeviceDrag?.(false);
            setTimeout(() => renderPanel());
        },
    };

    function setupDeviceDrag() {
        if (!canDragToGrid()) return;
        for (const ul of panel.querySelectorAll("ul.device-list")) {
            if (ul.dataset.zone) continue;
            sortables.push(
                Sortable.create(ul, {
                    group: { name: "menu", pull: "clone", put: false },
                    sort: false,
                    forceFallback: true,
                    fallbackTolerance: 4,
                    filter: ".grid-toggle, .favorite-toggle, .resolution-toggle",
                    preventOnFilter: false,
                    ...dragEvents,
                }),
            );
        }
    }

    // Sık kullanılanlara sürükleme (FR-3.2). Kategori grupları kendi içinde
    // sıralanmaz, yalnızca sık kullanılanlardan geri bırakılan cihazı kabul eder
    function setupDrag() {
        for (const ul of panel.querySelectorAll("ul[data-zone]")) {
            const frequent = ul.dataset.zone === "frequent";
            sortables.push(
                Sortable.create(ul, {
                    group: {
                        name: "favorites",
                        // Önizleme alanına bırakılan favori ızgaraya eklenir
                        pull: (to) =>
                            to.el.id === "grid-drop" ? "clone" : true,
                        put: frequent
                            ? true
                            : (_to, from) =>
                                  from.el.dataset.zone === "frequent",
                    },
                    sort: frequent,
                    handle: ".drag-handle",
                    forceFallback: true,
                    animation: 150,
                    emptyInsertThreshold: 24,
                    onStart: () => {
                        openMenu = null;
                        panel.querySelector(".favorite-menu")?.remove();
                        panel.classList.add("is-dragging");
                        if (canDragToGrid()) onDeviceDrag?.(true);
                    },
                    onEnd: (event) => {
                        panel.classList.remove("is-dragging");
                        onDeviceDrag?.(false);
                        if (event.to.id === "grid-drop") return;
                        // Sortable işini bitirdikten sonra liste yeniden çizilir
                        setTimeout(() => onDrop(event));
                    },
                }),
            );
        }
    }

    function onDrop({ item, from, to, oldIndex, newIndex }) {
        const id = item.dataset.favoriteItem;
        const toFrequent = to.dataset.zone === "frequent";
        if (toFrequent && (from !== to || oldIndex !== newIndex)) {
            favorites.moveToFrequent(id, newIndex);
            // Bırakılan cihaz görünsün: grup açık kalır
            groupState.setOpen(groupKey("favorites", "#frequent"), true);
            announceMoved(id);
        } else if (!toFrequent && from.dataset.zone === "frequent") {
            favorites.removeFromFrequent(id);
        }
        render();
    }

    function announceMoved(id) {
        announce(
            i18n.t("favorites.moved", {
                device: nameOf(findById(id)),
                position: favorites.frequent().indexOf(id) + 1,
            }),
        );
    }

    function runAction(action, id) {
        const index = favorites.frequent().indexOf(id);
        if (action === "moveToFrequent") favorites.moveToFrequent(id);
        if (action === "removeFromFrequent") favorites.removeFromFrequent(id);
        if (action === "moveUp") favorites.moveToFrequent(id, index - 1);
        if (action === "moveDown") favorites.moveToFrequent(id, index + 1);
        if (action !== "removeFromFrequent") announceMoved(id);
        openMenu = null;
        render({ focus: `[data-handle-id="${id}"]` });
    }

    function render({ focus } = {}) {
        renderTabs();
        renderPanel();
        if (!focus) return;
        const target =
            typeof focus === "string" ? panel.querySelector(focus) : focus();
        (target ?? panel).focus();
    }

    function selectTab(tab, { focus = false } = {}) {
        activeTab = tab;
        openMenu = null;
        render();
        if (focus) document.getElementById(`tab-${tab}`)?.focus();
    }

    function toggleFavorite(star) {
        const id = star.dataset.favoriteId;
        const stars = [...panel.querySelectorAll(".favorite-toggle")];
        const position = stars.indexOf(star);
        const sameId = stars.filter((s) => s.dataset.favoriteId === id);
        const occurrence = sameId.indexOf(star);
        const added = favorites.toggle(id);
        announce(
            i18n.t(added ? "favorites.added" : "favorites.removed", {
                device: nameOf(findById(id)),
            }),
        );
        // Odak aynı yıldızda kalır; satır kaybolduysa (Favoriler sekmesinden
        // çıkarıldıysa) aynı sıradaki yıldıza geçer
        render({
            focus: () => {
                const after = [...panel.querySelectorAll(".favorite-toggle")];
                const same = after.filter((s) => s.dataset.favoriteId === id);
                return (
                    same[occurrence] ??
                    after[Math.min(position, after.length - 1)]
                );
            },
        });
    }

    // Izgara düğmesi ve ızgara modunda satır; odak aynı öğede kalır
    function toggleGrid(target, selector, key) {
        const id = target.dataset[key];
        const all = [...panel.querySelectorAll(selector)];
        const same = all.filter((node) => node.dataset[key] === id);
        const occurrence = same.indexOf(target);
        grid.onToggle(id);
        const after = [...panel.querySelectorAll(selector)].filter(
            (node) => node.dataset[key] === id,
        );
        (after[occurrence] ?? panel).focus();
    }

    tabList.addEventListener("click", (event) => {
        const tab = event.target.closest("[role=tab]")?.dataset.tab;
        if (tab) selectTab(tab);
    });

    // WAI-ARIA sekme kalıbı: ok tuşları, Home ve End (NFR-5.1)
    tabList.addEventListener("keydown", (event) => {
        const index = ALL_TABS.indexOf(activeTab);
        const next = {
            ArrowRight: (index + 1) % ALL_TABS.length,
            ArrowLeft: (index - 1 + ALL_TABS.length) % ALL_TABS.length,
            Home: 0,
            End: ALL_TABS.length - 1,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        selectTab(ALL_TABS[next], { focus: true });
    });

    search.addEventListener("input", () => {
        query = search.value;
        openMenu = null;
        renderPanel();
    });

    panel.addEventListener("input", (event) => {
        const key = event.target.dataset.draft;
        if (key) draft[key] = event.target.value;
    });

    panel.addEventListener("submit", (event) => {
        event.preventDefault();
        const size = {
            width: Number(draft.width),
            height: Number(draft.height),
        };
        draft.error = !custom.isValid(size);
        if (draft.error) {
            render({ focus: "#custom-width" });
            return;
        }
        draft.width = "";
        draft.height = "";
        custom.onCreate(size);
    });

    function saveName(input, { cancel = false } = {}) {
        const id = input.dataset.editId;
        editing = null;
        if (!cancel) custom.onRename(id, input.value);
        render({ focus: `[data-rename-id="${id}"]` });
    }

    panel.addEventListener("keydown", (event) => {
        const input = event.target.closest(".custom-name-input");
        if (!input) return;
        if (event.key === "Enter") {
            event.preventDefault();
            saveName(input);
        } else if (event.key === "Escape") {
            event.preventDefault();
            saveName(input, { cancel: true });
        }
    });

    panel.addEventListener("focusout", (event) => {
        const input = event.target.closest?.(".custom-name-input");
        if (input && editing === input.dataset.editId) saveName(input);
    });

    panel.addEventListener("click", (event) => {
        const rename = event.target.closest(".custom-rename");
        if (rename) {
            editing = rename.dataset.renameId;
            render({ focus: ".custom-name-input" });
            panel.querySelector(".custom-name-input")?.select();
            return;
        }
        const remove = event.target.closest(".custom-delete");
        if (remove) {
            const buttons = [...panel.querySelectorAll(".custom-delete")];
            const position = buttons.indexOf(remove);
            custom.onDelete(remove.dataset.deleteId);
            const after = [...panel.querySelectorAll(".custom-delete")];
            (
                after[Math.min(position, after.length - 1)] ??
                panel.querySelector("#custom-width") ??
                panel
            ).focus();
            return;
        }
        const star = event.target.closest(".favorite-toggle");
        if (star) return toggleFavorite(star);
        const plus = event.target.closest(".grid-toggle");
        if (plus) return toggleGrid(plus, ".grid-toggle", "gridToggle");
        const handleButton = event.target.closest(".drag-handle");
        if (handleButton) {
            const id = handleButton.dataset.handleId;
            openMenu = openMenu === id ? null : id;
            render({
                focus: openMenu
                    ? ".favorite-menu [role=menuitem]"
                    : `[data-handle-id="${id}"]`,
            });
            return;
        }
        const action = event.target.closest("[role=menuitem]");
        if (action)
            return runAction(action.dataset.action, action.dataset.menuFor);
        const button = event.target.closest("button[data-device-id]");
        if (!button) return;
        if (grid.isActive())
            toggleGrid(button, "button[data-device-id]", "deviceId");
        else onSelect(button.dataset.deviceId);
    });

    // WAI-ARIA menü kalıbı: ok tuşları, Home, End, Esc ve Tab (NFR-5.1)
    panel.addEventListener("keydown", (event) => {
        const menu = event.target.closest(".favorite-menu");
        if (!menu) return;
        const items = [...menu.querySelectorAll("[role=menuitem]")];
        const index = items.indexOf(event.target);
        const closeMenu = () => {
            const id = openMenu;
            openMenu = null;
            render({ focus: `[data-handle-id="${id}"]` });
        };
        if (event.key === "Escape") {
            event.preventDefault();
            closeMenu();
            return;
        }
        if (event.key === "Tab") {
            closeMenu();
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

    // Menü dışına tıklanınca menü kapanır
    document.addEventListener("pointerdown", (event) => {
        if (!openMenu) return;
        if (event.target.closest(".favorite-menu, .drag-handle")) return;
        openMenu = null;
        renderPanel();
    });

    return { render };
}
