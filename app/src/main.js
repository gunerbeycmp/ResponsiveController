import "@fontsource-variable/inter/wght.css";
import {
    DEFAULT_DEVICE_ID,
    DEVICES,
    deviceName,
    deviceSize,
    findDevice,
    fitScale,
} from "./devices/devices.js";
import { createI18n } from "./i18n/i18n.js";
import { createSheet } from "./ui/sheet.js";
import { createPreviewBridge } from "./upload/bridge.js";
import { createUploadDialog } from "./upload/dialog.js";
import { createTheme } from "./ui/theme.js";
import { normalizeUrl } from "./url/normalize.js";
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
    deviceList: $("device-list"),
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
};

const sheet = createSheet({
    toggle: elements.sheetToggle,
    panel: $("sidebar-panel"),
    onToggle: (open) => {
        elements.sheetLabel.textContent = i18n.t(
            open ? "sheet.hide" : "sheet.show",
        );
    },
});

function renderDeviceList() {
    elements.deviceList.replaceChildren(
        ...DEVICES.map((device) => {
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.deviceId = device.id;
            button.setAttribute(
                "aria-pressed",
                String(device.id === state.deviceId),
            );

            const name = document.createElement("span");
            name.textContent = deviceName(device, i18n.t);
            const size = document.createElement("span");
            size.className = "device-size";
            size.textContent = i18n.t("frame.size", device.screen);

            button.append(name, size);
            item.append(button);
            return item;
        }),
    );
}

// Cihazı önizleme alanına sığacak şekilde ölçekler (FR-3.9'un ilk hâli)
function layoutFrame() {
    if (!state.url) return;
    const device = findDevice(state.deviceId);
    const size = deviceSize(device, state.browserBars);
    const header = elements.frame.firstElementChild;
    const styles = getComputedStyle(elements.stage);
    const available = {
        width:
            elements.stage.clientWidth -
            parseFloat(styles.paddingLeft) -
            parseFloat(styles.paddingRight) -
            2,
        height:
            elements.stage.clientHeight -
            parseFloat(styles.paddingTop) -
            parseFloat(styles.paddingBottom) -
            header.offsetHeight -
            elements.help.offsetHeight -
            20,
    };
    const scale = fitScale(size, available);

    elements.iframe.style.width = `${size.width}px`;
    elements.iframe.style.height = `${size.height}px`;
    elements.iframe.style.transform = `scale(${scale})`;
    elements.viewport.style.width = `${Math.round(size.width * scale) + 2}px`;
    elements.viewport.style.height = `${Math.round(size.height * scale) + 2}px`;

    elements.frameName.textContent = deviceName(device, i18n.t);
    elements.frameSize.textContent = i18n.t("frame.size", size);
    elements.frameScale.textContent =
        scale < 1
            ? i18n.t("frame.scale", { scale: Math.round(scale * 100) })
            : "";
    elements.iframe.title = i18n.t("frame.title", {
        device: deviceName(device, i18n.t),
    });

    // FR-3.14: "tarayıcı çubukları" yalnızca görünür alan değeri olan cihazlarda
    elements.browserBarsOption.hidden = !device.visibleArea;
    elements.browserBars.checked = state.browserBars;
    elements.browserBarsEstimated.hidden = !device.estimated;
    elements.browserBarsEstimated.textContent = i18n.t("device.estimated");
    elements.browserBarsEstimated.title = i18n.t("frame.browserBarsEstimated");
}

function render() {
    const hasUrl = Boolean(state.url);
    elements.emptyState.hidden = hasUrl;
    elements.frame.hidden = !hasUrl;
    renderDeviceList();
    layoutFrame();
}

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
    },
    onProject: async ({ name, files, entry }) => {
        await bridge.loadProject(files, entry);
        state.project = { name, entry, fileCount: files.length };
        state.url = bridge.previewUrl(entry);
        elements.input.value = state.url;
        showError(null);
        // Aynı adres yeniden yüklense de iframe tazelenir
        elements.iframe.src = "about:blank";
        elements.iframe.src = state.url;
        render();
    },
});

elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
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

elements.deviceList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-device-id]");
    if (!button) return;
    state.deviceId = button.dataset.deviceId;
    render();
    if (sheet.isOpen()) sheet.close();
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
    // Dar ekranda panel önizlemenin altında, görünür alanın dışında kalabilir
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

new ResizeObserver(layoutFrame).observe(elements.stage);

renderChrome();
