export const THEME_STORAGE_KEY = "rc-theme";
const THEMES = ["light", "dark"];

function readStoredTheme(storage) {
    try {
        const stored = storage?.getItem(THEME_STORAGE_KEY);
        return THEMES.includes(stored) ? stored : null;
    } catch {
        return null;
    }
}

// NFR-6.1 / NFR-6.2: varsayılan tema cihaz ayarından gelir,
// kullanıcı elle seçerse seçim saklanır ve cihaz ayarının önüne geçer
export function createTheme({ storage, systemQuery, root } = {}) {
    let manual = readStoredTheme(storage);
    const listeners = new Set();

    const systemTheme = () => (systemQuery?.matches ? "dark" : "light");
    const getTheme = () => manual ?? systemTheme();

    function apply() {
        if (root) root.dataset.theme = getTheme();
        listeners.forEach((listener) => listener(getTheme()));
    }

    function setTheme(next) {
        if (!THEMES.includes(next)) return;
        manual = next;
        try {
            storage?.setItem(THEME_STORAGE_KEY, next);
        } catch {
            // Saklanamazsa seçim yalnızca bu oturumda geçerli olur
        }
        apply();
    }

    systemQuery?.addEventListener?.("change", () => {
        if (!manual) apply();
    });

    apply();

    return {
        getTheme,
        setTheme,
        toggle: () => setTheme(getTheme() === "dark" ? "light" : "dark"),
        onChange: (listener) => listeners.add(listener),
    };
}
