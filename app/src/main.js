import "@fontsource-variable/inter/wght.css";
import {
    DEFAULT_DEVICE_ID,
    deviceName,
    findDevice,
    fitScale,
    isLandscape,
    rotatedFor,
    viewRenderSize,
    viewSize,
} from "./devices/devices.js";
import Sortable from "sortablejs";
import { clampSize, createCustomSizes, isValidSize } from "./devices/custom.js";
import { createFavorites } from "./devices/favorites.js";
import { createSidebar } from "./devices/sidebar.js";
import { createFpsMonitor } from "./grid/fps.js";
import { createGridStore } from "./grid/store.js";
import { BOX_AREAS, createGridView } from "./grid/view.js";
import {
    MAX_ZOOM,
    ZOOM_STEPS,
    clampZoom,
    zoomIn,
    zoomOut,
} from "./grid/zoom.js";
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
    frameCanvas: $("frame-canvas"),
    frameRotate: $("frame-rotate"),
    scaleToolbar: $("scale-toolbar"),
    scaleOut: $("scale-out"),
    scaleIn: $("scale-in"),
    scaleSlider: $("scale-slider"),
    scaleValue: $("scale-value"),
    scaleFit: $("scale-fit"),
    rotateAll: $("rotate-all"),
    rotateReset: $("rotate-reset"),
    frameNameButton: $("frame-name-button"),
    frameNameInput: $("frame-name-input"),
    frameWidth: $("frame-width"),
    frameHeight: $("frame-height"),
    frameSizeError: $("frame-size-error"),
    frameResizable: $("frame-resizable"),
    resizeHandles: [...document.querySelectorAll("[data-resize]")],
};

const announce = createAnnouncer($("app-status"));
const gridStore = createGridStore({
    storage: window.localStorage,
    isKnown: (id) => findDevice(id).id === id,
});
// FR-3.11: özel boyutlar yalnızca bu oturumda tutulur (R-19)
const custom = createCustomSizes();
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

// Cihazı önizleme alanına sığdırır ya da genel ölçekte gösterir (FR-3.9)
const MIN_FRAME_HEIGHT = 240;
const MIN_SCALE = ZOOM_STEPS[0];
const EPSILON = 0.001;
let frameFit = 1;
let frameScale = 1;
let resizing = null;

const blockHeight = (element) =>
    element.hidden
        ? 0
        : element.offsetHeight +
          parseFloat(getComputedStyle(element).marginTop) +
          parseFloat(getComputedStyle(element).marginBottom);

// FR-3.6: döndürme tek cihaz ve ızgarada ortaktır; FR-3.14 seçeneği yalnızca
// döndürülmemiş cihazda uygulanır (R-62)
const viewOptions = (id) => ({
    rotated: gridStore.isRotated(id),
    browserBars: state.browserBars,
});

function layoutFrame() {
    if (!state.url || isGridActive()) return;
    const device = findDevice(state.deviceId);
    const options = viewOptions(device.id);
    const size = viewSize(device, options);
    const header = elements.frame.firstElementChild;
    const styles = getComputedStyle(elements.stage);
    const reserved =
        parseFloat(styles.paddingTop) +
        parseFloat(styles.paddingBottom) +
        header.offsetHeight +
        (elements.warningsPanel.hidden
            ? 0
            : elements.warningsPanel.offsetHeight) +
        // Görünüm ve ölçek araç çubukları çerçevenin üstünde yer kaplar
        blockHeight(elements.toolbar) +
        blockHeight(elements.scaleToolbar) +
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
    frameFit = fitScale(size, available);
    // Sürüklerken ölçek sabit kalır; aksi hâlde Sığdır'da cihaz büyüdükçe
    // küçülür ve tutamaç imleçten kaçar
    const scale =
        resizing?.scale ??
        clampZoom(gridStore.getScale() ?? frameFit, frameFit);
    frameScale = scale;
    // Apple Watch: sayfa 320 px genişlikte çizilir, saat ekranına küçültülür
    const render = viewRenderSize(device, options);
    const deviceScale = size.width / render.width;
    const scaled = {
        width: Math.round(size.width * scale),
        height: Math.round(size.height * scale),
    };

    elements.iframe.style.width = `${render.width}px`;
    elements.iframe.style.height = `${render.height}px`;
    elements.iframe.style.transform = `scale(${scale * deviceScale})`;
    elements.frameNote.hidden = !device.layout;
    // Yakınlaştırılan cihaz alanı aşmaz, çerçevenin içinde kayar
    elements.frameCanvas.style.width = `${scaled.width}px`;
    elements.frameCanvas.style.height = `${scaled.height}px`;
    elements.viewport.style.width = `${Math.min(scaled.width, Math.floor(available.width)) + 2}px`;
    elements.viewport.style.height = `${Math.min(scaled.height, Math.floor(available.height)) + 2}px`;

    const name = deviceName(device, i18n.getLanguage());
    elements.frameName.textContent = name;
    // Özel boyutun adına tıklanınca ad düzenlenir
    const editingName = !elements.frameNameInput.hidden;
    elements.frameName.hidden = Boolean(device.custom) || editingName;
    elements.frameNameButton.hidden = !device.custom || editingName;
    elements.frameNameButton.textContent = name;
    elements.frameNameButton.setAttribute(
        "aria-label",
        i18n.t("custom.rename", { device: name }),
    );
    // Kullanıcı yazarken değer üzerine yazılmaz
    for (const [input, value] of [
        [elements.frameWidth, size.width],
        [elements.frameHeight, size.height],
    ]) {
        if (input.dataset.dirty !== "true") input.value = String(value);
    }
    elements.frameScale.textContent =
        Math.abs(scale - 1) > EPSILON
            ? i18n.t("frame.scale", { scale: Math.round(scale * 100) })
            : "";
    elements.frameRotate.setAttribute(
        "aria-label",
        i18n.t(isLandscape(size) ? "rotate.toPortrait" : "rotate.toLandscape", {
            device: name,
        }),
    );
    elements.iframe.title = i18n.t("frame.title", {
        device: name,
    });
    elements.viewport.setAttribute("aria-label", elements.iframe.title);

    // FR-3.14: "tarayıcı çubukları" yalnızca görünür alan değeri olan cihazlarda
    elements.browserBarsOption.hidden = !device.visibleArea || options.rotated;
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
        elements.frameResizable.before(warningsPanel);
        elements.frameResizable.after(help);
    }
}

// Genel ölçek Sığdır'dayken kaydırıcının gösterdiği değer: tek cihazda
// cihazın sığma ölçeği, ızgarada ilk kutununki
function referenceFit() {
    if (!isGridActive()) return frameFit;
    const [first] = gridStore.list();
    if (!first) return 1;
    return fitScale(
        viewSize(findDevice(first), { rotated: gridStore.isRotated(first) }),
        BOX_AREAS[gridStore.getSize()],
    );
}

// Izgaradaki cihazların hepsi yatay mı (kare ekranlar hesaba katılmaz)
function rotatableIds() {
    return gridStore.list().filter((id) => {
        const { width, height } = findDevice(id).screen;
        return width !== height;
    });
}

const allLandscape = () =>
    rotatableIds().every((id) =>
        isLandscape(viewSize(findDevice(id), viewOptions(id))),
    );

function renderScaleControls(isGrid) {
    const scale = gridStore.getScale();
    const reference = Math.min(
        MAX_ZOOM,
        Math.max(MIN_SCALE, scale ?? referenceFit()),
    );
    const text =
        scale === null
            ? i18n.t("zoom.fit")
            : i18n.t("frame.scale", { scale: Math.round(scale * 100) });
    elements.scaleSlider.value = String(Math.round(reference * 100));
    elements.scaleSlider.setAttribute("aria-valuetext", text);
    // Sığdır'dayken basılı Sığdır düğmesi durumu gösterir; değer tekrar
    // yazılmaz (ekran okuyucular kaydırıcının değerini okur)
    elements.scaleValue.textContent = scale === null ? "" : text;
    elements.scaleValue.hidden = scale === null;
    elements.scaleFit.setAttribute("aria-pressed", String(scale === null));
    elements.scaleOut.disabled = reference <= MIN_SCALE + EPSILON;
    elements.scaleIn.disabled = reference >= MAX_ZOOM - EPSILON;
    elements.rotateAll.hidden = !isGrid || rotatableIds().length === 0;
    elements.rotateAll.textContent = i18n.t(
        allLandscape() ? "rotate.allToPortrait" : "rotate.allToLandscape",
    );
    // Hiçbir kutu döndürülmemişken görünür ama pasif (Aşama 3 kararları)
    elements.rotateReset.hidden = elements.rotateAll.hidden;
    elements.rotateReset.disabled = !gridStore
        .list()
        .some((id) => gridStore.isRotated(id));
}

// Ölçek ve döndürme değişince yalnızca önizleme yeniden çizilir; menü
// yeniden kurulmaz (NFR-2.3: 100 ms içinde tepki)
function renderView() {
    const isGrid = isGridActive();
    if (isGrid) gridView.render();
    layoutFrame();
    renderScaleControls(isGrid);
}

function setGlobalScale(value) {
    gridStore.setScale(value);
    // Genel ölçek değişince kutuların kendi ayarları sıfırlanır (FR-3.9)
    gridView.resetZooms();
    renderView();
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
    elements.scaleToolbar.hidden = !hasUrl;
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
    renderScaleControls(isGrid);
    updateMonitor();
}

// FR-3.7: ızgaraya ekleme. Tek cihaz modunda ızgaraya geçilir; o an açık
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
    onRotate: () => renderScaleControls(isGridActive()),
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

function announceCustom(key, device) {
    announce(i18n.t(key, { device: deviceName(device, i18n.getLanguage()) }));
}

// Silinen özel boyut ızgaradan da kalkar; seçiliyse türetildiği cihaza
// (yoksa varsayılan cihaza) dönülür
function deleteCustom(id) {
    const device = custom.remove(id);
    if (!device) return;
    gridStore.remove(id);
    gridStore.setRotated(id, false);
    if (state.deviceId === id)
        state.deviceId = device.sourceId ?? DEFAULT_DEVICE_ID;
    announceCustom("custom.deleted", device);
    render();
}

// FR-3.10 / FR-3.11: seçili cihazı boyutlandırır. Hazır cihaz değişmez,
// ondan türetilen yeni bir özel boyut oluşturulup seçilir; özel boyut ise
// doğrudan değişir. Boyut ekranda görünen (döndürülmüş) hâliyle verilir.
function resizeCurrent(size, { live = false } = {}) {
    const device = findDevice(state.deviceId);
    const rotated = gridStore.isRotated(device.id);
    const screen = rotated ? { width: size.height, height: size.width } : size;
    if (device.custom) {
        custom.resize(device.id, screen);
        if (live) layoutFrame();
        else render();
        return;
    }
    const created = custom.create(size, device);
    state.deviceId = created.id;
    announceCustom("custom.created", created);
    render();
}

function showSizeError(show) {
    elements.frameSizeError.textContent = show
        ? i18n.t("custom.error.range")
        : "";
    for (const input of [elements.frameWidth, elements.frameHeight]) {
        input.setAttribute("aria-invalid", String(show));
        if (show) input.setAttribute("aria-describedby", "frame-size-error");
        else input.removeAttribute("aria-describedby");
    }
}

function applyHeaderSize() {
    const size = {
        width: Number(elements.frameWidth.value),
        height: Number(elements.frameHeight.value),
    };
    if (!isValidSize(size)) {
        showSizeError(true);
        return;
    }
    showSizeError(false);
    elements.frameWidth.dataset.dirty = "false";
    elements.frameHeight.dataset.dirty = "false";
    const device = findDevice(state.deviceId);
    const current = viewSize(device, viewOptions(device.id));
    if (current.width === size.width && current.height === size.height) return;
    resizeCurrent(size);
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
    custom: {
        list: () => custom.list(),
        isValid: isValidSize,
        onCreate: (size) => {
            const device = custom.create(size);
            state.deviceId = device.id;
            if (isGridActive()) gridStore.add(device.id);
            announceCustom("custom.created", device);
            render();
        },
        onRename: (id, name) => {
            custom.rename(id, name);
            render();
        },
        onDelete: deleteCustom,
    },
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

elements.scaleSlider.addEventListener("input", () =>
    setGlobalScale(Number(elements.scaleSlider.value) / 100),
);
elements.scaleOut.addEventListener("click", () =>
    setGlobalScale(
        zoomOut(Number(elements.scaleSlider.value) / 100, MIN_SCALE),
    ),
);
elements.scaleIn.addEventListener("click", () =>
    setGlobalScale(zoomIn(Number(elements.scaleSlider.value) / 100)),
);
elements.scaleFit.addEventListener("click", () => setGlobalScale(null));

// FR-3.6: tek cihazı döndürme
elements.frameRotate.addEventListener("click", () => {
    const device = findDevice(state.deviceId);
    gridStore.setRotated(device.id, !gridStore.isRotated(device.id));
    renderView();
    announce(
        i18n.t(
            isLandscape(viewSize(device, viewOptions(device.id)))
                ? "rotate.landscape"
                : "rotate.portrait",
            { device: deviceName(device, i18n.getLanguage()) },
        ),
    );
});

// FR-3.6: toplu döndürme; en az biri dikeyse hepsi yataya, hepsi yataysa
// hepsi dikeye geçer (Aşama 3 Tasarım Kararları)
elements.rotateAll.addEventListener("click", () => {
    const landscape = !allLandscape();
    for (const id of rotatableIds())
        gridStore.setRotated(id, rotatedFor(findDevice(id), landscape));
    renderView();
    announce(i18n.t(landscape ? "rotate.allLandscape" : "rotate.allPortrait"));
});

// FR-3.11, NFR-5.2: başlıktaki boyut alanları; Enter'da ya da alandan
// çıkınca uygulanır. Ok tuşları 1, Shift + ok 10 px değiştirir ve hemen uygulanır.
for (const input of [elements.frameWidth, elements.frameHeight]) {
    input.addEventListener("input", () => {
        input.dataset.dirty = "true";
    });
    input.addEventListener("change", applyHeaderSize);
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            applyHeaderSize();
            return;
        }
        const direction = { ArrowUp: 1, ArrowDown: -1 }[event.key];
        if (!direction) return;
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const current = Number(input.value) || 0;
        input.value = String(
            clampSize({
                width: current + direction * step,
                height: current + direction * step,
            }).width,
        );
        applyHeaderSize();
    });
}

// Özel boyutun adı başlıkta düzenlenir (Enter kaydeder, Esc vazgeçer)
function finishNameEdit({ save }) {
    const input = elements.frameNameInput;
    if (input.hidden) return;
    input.hidden = true;
    if (save) custom.rename(state.deviceId, input.value);
    render();
    elements.frameNameButton.focus();
}

elements.frameNameButton.addEventListener("click", () => {
    const device = findDevice(state.deviceId);
    elements.frameNameInput.value = deviceName(device, i18n.getLanguage());
    elements.frameNameInput.hidden = false;
    layoutFrame();
    elements.frameNameInput.focus();
    elements.frameNameInput.select();
});
elements.frameNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        finishNameEdit({ save: true });
    } else if (event.key === "Escape") {
        event.preventDefault();
        finishNameEdit({ save: false });
    }
});
elements.frameNameInput.addEventListener("blur", () =>
    finishNameEdit({ save: true }),
);

// FR-3.10: çerçeveyi sağ kenarından, alt kenarından veya köşesinden sürükleme
for (const handle of elements.resizeHandles) {
    handle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        handle.setPointerCapture(event.pointerId);
        const device = findDevice(state.deviceId);
        resizing = {
            axis: handle.dataset.resize,
            x: event.clientX,
            y: event.clientY,
            start: viewSize(device, viewOptions(device.id)),
            scale: frameScale,
        };
        document.body.classList.add("is-dragging", "is-resizing");
    });
    handle.addEventListener("pointermove", (event) => {
        if (!resizing) return;
        const { axis, start, scale } = resizing;
        const size = clampSize({
            width: axis.includes("x")
                ? start.width + (event.clientX - resizing.x) / scale
                : start.width,
            height: axis.includes("y")
                ? start.height + (event.clientY - resizing.y) / scale
                : start.height,
        });
        const device = findDevice(state.deviceId);
        const current = viewSize(device, viewOptions(device.id));
        if (current.width === size.width && current.height === size.height)
            return;
        resizeCurrent(size, { live: true });
    });
    const finish = () => {
        if (!resizing) return;
        resizing = null;
        document.body.classList.remove("is-dragging", "is-resizing");
        // Menüdeki özel boyut listesi de güncellenir
        render();
    };
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
}

// Izgaradaki bütün cihazlar varsayılan konumlarına döner
elements.rotateReset.addEventListener("click", () => {
    for (const id of gridStore.list()) gridStore.setRotated(id, false);
    renderView();
    announce(i18n.t("rotate.resetDone"));
    // Düğme pasifleştiği için odak toplu döndürme düğmesine geçer
    elements.rotateAll.focus();
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
    const device = findDevice(state.deviceId);
    const size = viewSize(device, viewOptions(device.id));
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
