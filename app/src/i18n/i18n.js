import en from "./en.json";
import tr from "./tr.json";

export const SUPPORTED_LANGUAGES = ["tr", "en"];
export const DEFAULT_LANGUAGE = "en";
export const STORAGE_KEY = "rc-language";

const MESSAGES = { tr, en };

// NFR-4.2: tarayıcının birincil dili Türkçe ise Türkçe, değilse İngilizce
export function detectLanguage(browserLanguages = []) {
    const primary = String(browserLanguages[0] ?? "").toLowerCase();
    return primary.startsWith("tr") ? "tr" : DEFAULT_LANGUAGE;
}

// Tarayıcı depolaması gizli pencerede veya kapalıyken hata verebilir
function readStoredLanguage(storage) {
    try {
        const stored = storage?.getItem(STORAGE_KEY);
        return SUPPORTED_LANGUAGES.includes(stored) ? stored : null;
    } catch {
        return null;
    }
}

function writeStoredLanguage(storage, language) {
    try {
        storage?.setItem(STORAGE_KEY, language);
    } catch {
        // Saklanamazsa dil yalnızca bu oturumda geçerli olur
    }
}

export function createI18n({
    storage,
    browserLanguages = [],
    root,
    messages = MESSAGES,
} = {}) {
    // NFR-4.3: kullanıcının daha önce seçtiği dil, tarayıcı dilinden önce gelir
    let language =
        readStoredLanguage(storage) ?? detectLanguage(browserLanguages);

    function applyLanguage() {
        // WCAG: ekran okuyucuların metni doğru dilde okuması için
        if (root) root.lang = language;
    }

    // {ad} biçimindeki yer tutucular params içindeki değerlerle doldurulur
    function t(key, params = {}) {
        const text =
            messages[language]?.[key] ??
            messages[DEFAULT_LANGUAGE]?.[key] ??
            key;
        return text.replace(/\{(\w+)\}/g, (match, name) =>
            name in params ? String(params[name]) : match,
        );
    }

    function setLanguage(next) {
        if (!SUPPORTED_LANGUAGES.includes(next)) return;
        language = next;
        writeStoredLanguage(storage, next);
        applyLanguage();
    }

    // data-i18n="anahtar" metni, data-i18n-placeholder ve data-i18n-label
    // ise placeholder ve aria-label özelliklerini günceller
    function translatePage(container) {
        container.querySelectorAll("[data-i18n]").forEach((element) => {
            element.textContent = t(element.dataset.i18n);
        });
        container
            .querySelectorAll("[data-i18n-placeholder]")
            .forEach((element) => {
                element.placeholder = t(element.dataset.i18nPlaceholder);
            });
        container.querySelectorAll("[data-i18n-label]").forEach((element) => {
            element.setAttribute("aria-label", t(element.dataset.i18nLabel));
        });
    }

    applyLanguage();

    return {
        t,
        setLanguage,
        translatePage,
        getLanguage: () => language,
    };
}
