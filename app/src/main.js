import "@fontsource-variable/inter/wght.css";
import {
    DEFAULT_DEVICE_ID,
    deviceName,
    deviceSize,
    findDevice,
    fitScale,
    renderSize,
} from "./devices/devices.js";
import Sortable from "sortablejs";
import { createFavorites } from "./devices/favorites.js";
import { createSidebar } from "./devices/sidebar.js";
import { createFpsMonitor } from "./grid/fps.js";
import { createGridStore } from "./grid/store.js";
import { createGridView } from "./grid/view.js";
import { createI18n } from "./i18n/i18n.js";
import { createAnnouncer } from "./ui/announce.js";
import { createSheet } from "./ui/sheet.js";
import { createPreviewBridge } from "./upload/bridge.js";
import { createUploadDialog } from "./upload/dialog.js";
import { createTheme } from "./ui/theme.js";
import { normalizeUrl } from "./url/normalize.js";
import { PREVIEW_ORIGIN } from "./config.js";
import { openSizedWindow } from "./url/popup.js";

const $ = (id) => document.getElementById(id);

const i18n = createI18n({
    storage: window.localStorage,
    browserLanguages: navigator.languages,
    root: document.documentElement,
});
const theme = createTheme({
    storage: window.localStorage,
    systemQuery: window.matchMedia("(prefers-color-scheme: dark)"),
    root: document.documentElement,
});

const state = {
    url: null,
    project: null,
    deviceId: DEFAULT_DEVICE_ID,
    browserBars: false,
};

const elements = {
    form: $("url-form"),
    input: $("url-input"),
    error: $("url-error"),
    languageToggle: $("language-toggle"),
    themeToggle: $("theme-toggle"),
    frameNote: $("frame-note"),
    sheetToggle: $("sheet-toggle"),
    sheetLabel: $("sheet-toggle-label"),
    emptyState: $("empty-state"),
    frame: $("device-frame"),
    frameName: $("frame-name"),
    frameSize: $("frame-size"),
    frameScale: $("frame-scale"),
    viewport: $("frame-viewport"),
    iframe: $("preview-iframe"),
    browserBarsOption: $("browser-bars-option"),
    browserBars: $("browser-bars"),
    browserBarsEstimated: $("browser-bars-estimated"),
    stage: $("stage"),
    help: $("frame-help"),
    helpToggle: $("help-toggle"),
    helpPanel: $("help-panel"),
    openWindow: $("open-window"),
    urlLabel: $("url-label"),
    projectChip: $("project-chip"),
    projectName: $("project-name"),
    projectClose: $("project-close"),
    warningsToggle: $("warnings-toggle"),
    warningsLabel: $("warnings-label"),
    warningsPanel: $("warnings-panel"),
    helpUpload: $("help-upload"),
    frameHeader: $("device-frame").querySelector(".frame-header"),
    toolbar: $("view-toolbar"),
    viewButtons: [...document.querySelectorAll("[data-view]")],
    sizeGroup: $("size-group"),
    sizeButtons: [...document.querySelectorAll("[data-size]")],
    slowWarning: $("slow-warning"),
    slowDismiss: $("slow-dismiss"),
    gridSection: $("grid-section"),
    gridEmpty: $("grid-empty"),
    gridList: $("device-grid"),
    gridDrop: $("grid-drop"),
};

const announce = createAnnouncer($("app-status"));
const gridStore = createGridStore({
    storage: window.localStorage,
    isKnown: (id) => findDevice(id).id === id,
});
const isGridActive = () => Boolean(state.url) && gridStore.getMode() === "grid";

const sheet = createSheet({
    toggle: elements.sheetToggle,
    panel: $("sidebar-panel"),
    onToggle: (open) => {
        elements.sheetLabel.textContent = i18n.t(
            open ? "sheet.hide" : "sheet.show",
        );
    },
});

// Cihazı önizleme alanına sığacak şekilde ölçekler (FR-3.9'un ilk hâli)
const MIN_FRAME_HEIGHT = 240;

function layoutFrame() {
    if (!state.url || isGridActive()) return;
    const device = findDevice(state.deviceId);
    const size = deviceSize(device, state.browserBars);
    const header = elements.frame.firstElementChild;
    const styles = getComputedStyle(elements.stage);
    const reserved =
        parseFloat(styles.paddingTop) +
        parseFloat(styles.paddingBottom) +
        header.offsetHeight +
        (elements.warningsPanel.hidden
            ? 0
            : elements.warningsPanel.offsetHeight) +
        // Görünüm araç çubuğu çerçevenin üstünde yer kaplar (v0.3.4)
        (elements.toolbar.hidden
            ? 0
            : elements.toolbar.offsetHeight +
              parseFloat(getComputedStyle(elements.toolbar).marginBottom)) +
        20;
    // Pencere yüksekliğinden hesaplanır: dar ekranda önizleme alanı içeriğe
    // göre uzadığı için kendi yüksekliği kullanılırsa çerçeve ile alan
    // birbirini büyüterek döngüye girer
    // offsetTop kullanılmaz: çalışma alanı konumlandırıldığı için (v0.3.4)
    // üst çubuğu hesaba katmaz
    const stageTop =
        elements.stage.getBoundingClientRect().top + window.scrollY;
    const height = window.innerHeight - stageTop - reserved;
    // Açık yardım paneli çerçeveye çok az yer bırakıyorsa (dar ekranlar) yalnızca
    // bağlantı hesaba katılır; panel altta kalır ve görünür alana kaydırılır
    const withHelp = height - elements.help.offsetHeight;
    const available = {
        width:
            elements.stage.clientWidth -
            parseFloat(styles.paddingLeft) -
            parseFloat(styles.paddingRight) -
            2,
        height:
            withHelp >= MIN_FRAME_HEIGHT
                ? withHelp
                : height - elements.helpToggle.offsetHeight,
    };
    const scale = fitScale(size, available);
    // Apple Watch: sayfa 320 px genişlikte çizilir, saat ekranına küçültülür
    const render = renderSize(device, state.browserBars);
    const deviceScale = size.width / render.width;

    elements.iframe.style.width = `${render.width}px`;
    elements.iframe.style.height = `${render.height}px`;
    elements.iframe.style.transform = `scale(${scale * deviceScale})`;
    elements.frameNote.hidden = !device.layout;
    elements.viewport.style.width = `${Math.round(size.width * scale) + 2}px`;
    elements.viewport.style.height = `${Math.round(size.height * scale) + 2}px`;

    const name = deviceName(device, i18n.getLanguage());
    elements.frameName.textContent = name;
    elements.frameSize.textContent = i18n.t("frame.size", size);
    elements.frameScale.textContent =
        scale < 1
            ? i18n.t("frame.scale", { scale: Math.round(scale * 100) })
            : "";
    elements.iframe.title = i18n.t("frame.title", {
        device: name,
    });

    // FR-3.14: "tarayıcı çubukları" yalnızca görünür alan değeri olan cihazlarda
    elements.browserBarsOption.hidden = !device.visibleArea;
    elements.browserBars.checked = state.browserBars;
    elements.browserBarsEstimated.hidden = !device.estimated;
    elements.browserBarsEstimated.textContent = i18n.t("device.estimated");
    elements.browserBarsEstimated.title = i18n.t("frame.browserBarsEstimated");
}

// Proje yüklüyken URL alanı proje içindeki sayfanın yolunu gösterir
function renderProject() {
    const { project } = state;
    elements.projectChip.hidden = !project;
    elements.urlLabel.dataset.i18n = project
        ? "project.pathLabel"
        : "header.urlLabel";
    elements.urlLabel.textContent = i18n.t(elements.urlLabel.dataset.i18n);
    elements.input.placeholder = project
        ? "/index.html"
        : i18n.t("header.urlPlaceholder");
    if (project) {
        elements.projectName.textContent = i18n.t("project.summary", {
            name: project.name,
            count: project.fileCount,
        });
        elements.projectChip.title = elements.projectName.textContent;
    }
}

// FR-1.7 - FR-1.10: proje açıldıktan sonra gösterilen uyarılar
function renderWarnings() {
    const warnings = state.project?.warnings ?? [];
    elements.warningsToggle.hidden = warnings.length === 0;
    if (warnings.length === 0) {
        elements.warningsPanel.hidden = true;
        elements.warningsToggle.setAttribute("aria-expanded", "false");
        return;
    }
    elements.warningsLabel.textContent =
        warnings.length === 1
            ? i18n.t("warnings.toggleOne")
            : i18n.t("warnings.toggle", { count: warnings.length });
    elements.warningsPanel.replaceChildren(
        ...warnings.map(({ key, params }) => {
            const item = document.createElement("li");
            item.textContent = i18n.t(key, params);
            return item;
        }),
    );
}

// Uyarılar ve yardım iki modda da kullanılır; bulundukları mod alanına taşınır
function placeShared(isGrid) {
    const { warningsToggle, warningsPanel, help } = elements;
    if (isGrid) {
        if (warningsToggle.parentElement !== elements.toolbar) {
            elements.toolbar.append(warningsToggle);
            elements.gridSection.prepend(warningsPanel);
            elements.gridSection.append(help);
        }
    } else if (warningsToggle.parentElement !== elements.frameHeader) {
        elements.frameHeader.append(warningsToggle);
        elements.viewport.before(warningsPanel);
        elements.viewport.after(help);
    }
}

function renderToolbar(isGrid) {
    for (const button of elements.viewButtons)
        button.setAttribute(
            "aria-pressed",
            String(button.dataset.view === gridStore.getMode()),
        );
    elements.sizeGroup.hidden = !isGrid;
    for (const button of elements.sizeButtons)
        button.setAttribute(
            "aria-pressed",
            String(button.dataset.size === gridStore.getSize()),
        );
}

function render() {
    renderProject();
    renderWarnings();
    const hasUrl = Boolean(state.url);
    const isGrid = isGridActive();
    elements.emptyState.hidden = hasUrl;
    elements.toolbar.hidden = !hasUrl;
    elements.frame.hidden = !hasUrl || isGrid;
    elements.gridSection.hidden = !isGrid;
    renderToolbar(isGrid);
    placeShared(isGrid);
    sidebar.render();
    if (isGrid) {
        elements.gridEmpty.hidden = gridStore.list().length > 0;
        gridView.render();
    } else {
        gridView.clear();
        elements.slowWarning.hidden = true;
    }
    layoutFrame();
    updateMonitor();
}

// FR-3.6: ızgaraya ekleme. Tek cihaz modunda ızgaraya geçilir; o an açık
// cihaz ile eklenen cihaz yan yana görünür (Aşama 3 Tasarım Kararları)
function addToGrid(id) {
    if (!isGridActive()) {
        if (!gridStore.has(state.deviceId)) gridStore.add(state.deviceId);
        gridStore.setMode("grid");
    }
    if (!gridStore.has(id)) {
        gridStore.add(id);
        announce(
            i18n.t("grid.added", {
                device: deviceName(findDevice(id), i18n.getLanguage()),
            }),
        );
        // Yeni cihazla yavaşlama tekrar olursa uyarı yeniden gösterilir
        monitor.reset();
    }
    render();
}

function removeFromGrid(id) {
    gridStore.remove(id);
    announce(
        i18n.t("grid.removed", {
            device: deviceName(findDevice(id), i18n.getLanguage()),
        }),
    );
    render();
}

function setView(mode) {
    // Boş ızgaraya geçilince açık cihaz ızgaraya eklenir
    if (mode === "grid" && gridStore.list().length === 0)
        gridStore.add(state.deviceId);
    gridStore.setMode(mode);
    render();
}

// Büyütülen kutu önizleme alanının tamamını kaplar
function expandedArea() {
    const styles = getComputedStyle(elements.stage);
    const header =
        elements.gridList.querySelector(".is-expanded .box-header")
            ?.offsetHeight ?? 72;
    const top =
        elements.gridList.getBoundingClientRect().top +
        elements.stage.scrollTop +
        window.scrollY;
    return {
        width:
            elements.stage.clientWidth -
            parseFloat(styles.paddingLeft) -
            parseFloat(styles.paddingRight) -
            2,
        height: Math.max(
            MIN_FRAME_HEIGHT,
            window.innerHeight -
                top -
                header -
                parseFloat(styles.paddingBottom) -
                elements.helpToggle.offsetHeight -
                24,
        ),
    };
}

const gridView = createGridView({
    list: elements.gridList,
    i18n,
    store: gridStore,
    announce,
    getUrl: () => state.url,
    getExpandedArea: expandedArea,
    onEmpty: (_empty, next) => {
        render();
        const target = next
            ? gridView.boxFor(next)?.remove
            : elements.viewButtons.find((b) => b.dataset.view === "grid");
        target?.focus();
    },
});

// FR-3.8: ızgarada yavaşlama uyarısı (Teknik Tasarım 7.2)
const monitor = createFpsMonitor({
    onSlow: () => {
        if (!isGridActive()) return;
        elements.slowWarning.hidden = false;
        announce(i18n.t("slow.warning"));
        layoutFrame();
    },
});

function updateMonitor() {
    if (isGridActive() && gridStore.list().length > 0) monitor.start();
    else monitor.stop();
}

const sidebar = createSidebar({
    search: $("device-search"),
    tabList: $("device-tabs"),
    panel: $("device-list"),
    announce: createAnnouncer($("sidebar-status")),
    i18n,
    grid: {
        isActive: isGridActive,
        has: (id) => gridStore.has(id),
        onToggle: (id) => {
            if (isGridActive() && gridStore.has(id)) removeFromGrid(id);
            else addToGrid(id);
        },
    },
    onDeviceDrag: (active) => {
        document.body.classList.toggle("is-dragging", active);
        document.body.classList.toggle("is-dragging-device", active);
    },
    favorites: createFavorites({
        storage: window.localStorage,
        isKnown: (id) => findDevice(id).id === id,
    }),
    getSelectedId: () => state.deviceId,
    onSelect: (id) => {
        state.deviceId = id;
        render();
        if (sheet.isOpen()) sheet.close();
    },
});

function renderChrome() {
    i18n.translatePage(document);
    document.title = i18n.t("app.title");
    elements.languageToggle.textContent =
        i18n.getLanguage() === "tr" ? "EN" : "TR";
    elements.themeToggle.setAttribute(
        "aria-label",
        i18n.t(
            theme.getTheme() === "dark"
                ? "header.themeToLight"
                : "header.themeToDark",
        ),
    );
    elements.sheetLabel.textContent = i18n.t(
        sheet.isOpen() ? "sheet.hide" : "sheet.show",
    );
    showError(elements.error.dataset.reason);
    upload?.retranslate();
    render();
}

function showError(reason) {
    elements.error.dataset.reason = reason ?? "";
    elements.error.textContent = reason ? i18n.t(`url.error.${reason}`) : "";
    elements.input.setAttribute("aria-invalid", String(Boolean(reason)));
}

// Proje yükleme (FR-1). Köprü uygulama açılırken kurulur; böylece önceki
// oturumdan kalan proje her açılışta silinir (NFR-3.2, R-20)
const bridge = createPreviewBridge();
const upload = createUploadDialog({
    t: i18n.t,
    elements: {
        dialog: $("upload-dialog"),
        openButton: $("upload-button"),
        closeButton: $("upload-close"),
        dropzone: $("dropzone"),
        chooseFile: $("choose-file"),
        chooseFolder: $("choose-folder"),
        folderUnsupported: $("folder-unsupported"),
        fileInput: $("file-input"),
        folderInput: $("folder-input"),
        status: $("upload-status"),
        entryChoice: $("entry-choice"),
        entryList: $("entry-list"),
        sourceWarning: $("source-warning"),
        sourceCancel: $("source-cancel"),
        sourceOpen: $("source-open"),
    },
    onProject: async ({ name, files, entry, warnings }) => {
        const fileCount = files.length;
        await bridge.loadProject(files, entry);
        state.project = { name, entry, fileCount, warnings };
        state.url = bridge.previewUrl(entry);
        elements.input.value = entry;
        showError(null);
        // Aynı adres yeniden yüklense de iframe tazelenir
        elements.iframe.src = "about:blank";
        elements.iframe.src = state.url;
        gridView.clear();
        render();
    },
});

function openProjectPath(value) {
    const path = `/${value.trim().replace(/^\/+/, "")}`;
    elements.input.value = path;
    state.url = bridge.previewUrl(path);
    elements.iframe.src = state.url;
    render();
}

function closeProject() {
    state.project = null;
    state.url = null;
    elements.input.value = "";
    elements.iframe.src = "about:blank";
    bridge.clearProject();
    render();
    elements.input.focus();
}

elements.projectClose.addEventListener("click", closeProject);

for (const button of elements.viewButtons)
    button.addEventListener("click", () => setView(button.dataset.view));

for (const button of elements.sizeButtons)
    button.addEventListener("click", () => {
        gridStore.setSize(button.dataset.size);
        render();
    });

elements.slowDismiss.addEventListener("click", () => {
    elements.slowWarning.hidden = true;
});

// Menüden önizleme alanına bırakılan cihaz ızgaraya eklenir (FR-3.7)
Sortable.create(elements.gridDrop, {
    group: { name: "grid-drop", put: ["menu", "favorites"] },
    onAdd: ({ item }) => {
        const id = item.querySelector(".device-row [data-device-id]")?.dataset
            .deviceId;
        item.remove();
        // Menü yeniden çizilince kaynak listenin sürükleme bitişi gelmeyebilir;
        // sürükleme durumu burada da kapatılır ve ekleme Sortable işini
        // bitirdikten sonra yapılır
        document.body.classList.remove("is-dragging", "is-dragging-device");
        if (id) setTimeout(() => addToGrid(id));
    },
});

elements.warningsToggle.addEventListener("click", () => {
    const open =
        elements.warningsToggle.getAttribute("aria-expanded") !== "true";
    elements.warningsToggle.setAttribute("aria-expanded", String(open));
    elements.warningsPanel.hidden = !open;
    layoutFrame();
});

// FR-2.3: "Site açılmıyor" yardımından proje yükleme
elements.helpUpload.addEventListener("click", () => upload.open());

// Önizlemede sayfa değişince yardımcı betik yeni yolu bildirir (R-40)
window.addEventListener("message", (event) => {
    if (
        !state.project ||
        event.origin !== PREVIEW_ORIGIN ||
        event.source !== elements.iframe.contentWindow ||
        event.data?.type !== "rc:navigate"
    ) {
        return;
    }
    if (document.activeElement !== elements.input) {
        elements.input.value = event.data.path;
    }
});

elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.project) {
        openProjectPath(elements.input.value);
        return;
    }
    const result = normalizeUrl(elements.input.value);
    if (!result.ok) {
        showError(result.reason);
        return;
    }
    showError(null);
    state.url = result.url;
    elements.input.value = result.url;
    elements.iframe.src = result.url;
    render();
});

elements.browserBars.addEventListener("change", () => {
    state.browserBars = elements.browserBars.checked;
    layoutFrame();
});

// FR-2.2: engel otomatik algılanamadığı için yardım her zaman erişilebilir
elements.helpToggle.addEventListener("click", () => {
    const open = elements.helpToggle.getAttribute("aria-expanded") !== "true";
    elements.helpToggle.setAttribute("aria-expanded", String(open));
    elements.helpPanel.hidden = !open;
    layoutFrame();
    // Kısa pencerelerde panel önizlemenin altında, görünür alanın dışında
    // kalabilir; sayfa (dar ekran) veya önizleme alanı (geniş ekran) kaydırılır
    if (open) {
        const reduceMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        elements.helpPanel.scrollIntoView({
            block: "nearest",
            behavior: reduceMotion ? "auto" : "smooth",
        });
    }
});

// FR-2.3: siteyi seçili cihaz boyutunda yeni pencerede açar
elements.openWindow.addEventListener("click", () => {
    const size = deviceSize(findDevice(state.deviceId), state.browserBars);
    openSizedWindow(state.url, size);
});

elements.languageToggle.addEventListener("click", () => {
    i18n.setLanguage(i18n.getLanguage() === "tr" ? "en" : "tr");
    renderChrome();
});

elements.themeToggle.addEventListener("click", () => theme.toggle());
theme.onChange(renderChrome);

// Boyutlandırma bir sonraki çizim karesine ertelenir; aksi hâlde çerçevenin
// boyutu değişince gözlemci kendini yeniden tetikler (ResizeObserver loop)
let layoutRequest = 0;
new ResizeObserver(() => {
    cancelAnimationFrame(layoutRequest);
    layoutRequest = requestAnimationFrame(() => {
        layoutFrame();
        if (isGridActive()) gridView.render();
    });
}).observe(elements.stage);

renderChrome();
