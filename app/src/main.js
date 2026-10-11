import { createI18n } from "./i18n/i18n.js";

const i18n = createI18n({
    storage: window.localStorage,
    browserLanguages: navigator.languages,
    root: document.documentElement,
});

i18n.translatePage(document);
