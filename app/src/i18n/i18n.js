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

    function t(key) {
        return (
            messages[language]?.[key] ??
            messages[DEFAULT_LANGUAGE]?.[key] ??
            key
        );
    }

    function setLanguage(next) {
        if (!SUPPORTED_LANGUAGES.includes(next)) return;
        language = next;
        writeStoredLanguage(storage, next);
        applyLanguage();
    }

    // data-i18n="anahtar" özelliği taşıyan öğelerin metnini günceller
    function translatePage(container) {
        container.querySelectorAll("[data-i18n]").forEach((element) => {
            element.textContent = t(element.dataset.i18n);
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
