import { DEVICES, deviceName } from "./devices.js";
import { TABS, buildTab, searchDevices, tabOf } from "./menu.js";

// Sol menü: arama, kategori sekmeleri, gruplar (Aşama 3 Tasarım Kararları)
export function createSidebar({
    search,
    tabList,
    panel,
    i18n,
    getSelectedId,
    onSelect,
}) {
    let activeTab = tabOf(
        DEVICES.find((d) => d.id === getSelectedId()) ?? DEVICES[0],
    );
    let query = "";
    const expanded = new Set();

    const el = (tag, props = {}, ...children) => {
        const node = document.createElement(tag);
        Object.assign(node, props);
        node.append(...children.filter(Boolean));
        return node;
    };

    function badge(key) {
        return el("span", { className: "badge", textContent: i18n.t(key) });
    }

    function deviceButton(device, { showPopular = true } = {}) {
        const button = el("button", {
            type: "button",
            className: "device-button",
        });
        button.dataset.deviceId = device.id;
        button.setAttribute(
            "aria-pressed",
            String(device.id === getSelectedId()),
        );
        const title = el(
            "span",
            { className: "device-name" },
            deviceName(device, i18n.getLanguage()),
        );
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

    function list(items, options) {
        return el(
            "ul",
            { className: "device-list" },
            ...items.map((d) => el("li", {}, deviceButton(d, options))),
        );
    }

    function group(title, content) {
        return el(
            "section",
            { className: "device-group" },
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
                const line = el(
                    "div",
                    { className: "resolution-line" },
                    deviceButton(resolution),
                );
                item.append(line);
                if (devices.length > 0) {
                    const open = expanded.has(key);
                    const subId = `res-devices-${key}`;
                    const toggle = el("button", {
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
                        render({ keepFocus: `[aria-controls="${subId}"]` });
                    });
                    line.append(toggle);
                    const sub = list(devices);
                    sub.id = subId;
                    sub.classList.add("resolution-devices");
                    sub.hidden = !open;
                    item.append(sub);
                }
                return item;
            }),
        );
    }

    function renderTabs() {
        tabList.replaceChildren(
            ...TABS.map((tab) => {
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

    function renderPanel() {
        if (query.trim()) {
            const results = searchDevices(DEVICES, query);
            panel.replaceChildren(
                ...(results.length === 0
                    ? [
                          el("p", {
                              className: "search-empty",
                              textContent: i18n.t("sidebar.searchEmpty", {
                                  query: query.trim(),
                              }),
                          }),
                      ]
                    : results.map(({ category, items }) =>
                          group(
                              i18n.t(
                                  category === "generic"
                                      ? "group.generic"
                                      : `category.${category}`,
                              ),
                              list(items),
                          ),
                      )),
            );
            return;
        }
        panel.replaceChildren(
            ...buildTab(DEVICES, activeTab).map((g) => {
                if (g.type === "popular")
                    return group(
                        i18n.t("group.popular"),
                        list(g.items, { showPopular: false }),
                    );
                if (g.type === "generic")
                    return group(i18n.t("group.generic"), list(g.items));
                if (g.type === "resolutions") return resolutionList(g.rows);
                return group(g.brand, list(g.items));
            }),
        );
    }

    function render({ keepFocus } = {}) {
        renderTabs();
        renderPanel();
        if (keepFocus) panel.querySelector(keepFocus)?.focus();
    }

    function selectTab(tab, { focus = false } = {}) {
        activeTab = tab;
        render();
        if (focus) document.getElementById(`tab-${tab}`)?.focus();
    }

    tabList.addEventListener("click", (event) => {
        const tab = event.target.closest("[role=tab]")?.dataset.tab;
        if (tab) selectTab(tab);
    });

    // WAI-ARIA sekme kalıbı: ok tuşları, Home ve End (NFR-5.1)
    tabList.addEventListener("keydown", (event) => {
        const index = TABS.indexOf(activeTab);
        const next = {
            ArrowRight: (index + 1) % TABS.length,
            ArrowLeft: (index - 1 + TABS.length) % TABS.length,
            Home: 0,
            End: TABS.length - 1,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        selectTab(TABS[next], { focus: true });
    });

    search.addEventListener("input", () => {
        query = search.value;
        renderPanel();
    });

    panel.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-device-id]");
        if (button) onSelect(button.dataset.deviceId);
    });

    return { render };
}
