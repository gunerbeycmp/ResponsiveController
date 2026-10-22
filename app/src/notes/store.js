export const NOTES_STORAGE_KEY = "rc-notes";

// FR-5.3: notlar test edilen adrese ya da proje adına göre tarayıcıda
// saklanır (Aşama 5 kararları); sunucuya gönderilmez (NFR-3.1)
export function contextKey({ url, project }) {
    if (project) return `project:${project}`;
    if (!url) return null;
    try {
        const { origin, pathname } = new URL(url);
        return `url:${origin}${pathname}`;
    } catch {
        return `url:${url}`;
    }
}

function readAll(storage) {
    try {
        const stored = JSON.parse(storage?.getItem(NOTES_STORAGE_KEY));
        return stored && typeof stored === "object" ? stored : {};
    } catch {
        return {};
    }
}

const empty = () => ({ session: "", devices: {} });

export function createNotesStore({ storage } = {}) {
    let all = readAll(storage);
    let key = null;

    const current = () => (key ? (all[key] ?? empty()) : empty());

    function save(next) {
        if (!key) return;
        const devices = Object.fromEntries(
            Object.entries(next.devices).filter(([, text]) => text.trim()),
        );
        if (!next.session.trim() && Object.keys(devices).length === 0)
            delete all[key];
        else all[key] = { session: next.session, devices };
        try {
            storage?.setItem(NOTES_STORAGE_KEY, JSON.stringify(all));
        } catch {
            // Depolama kapalıysa notlar yalnızca bu oturumda kalır
        }
    }

    return {
        setContext(next) {
            key = next;
        },
        getSession: () => current().session,
        setSession(text) {
            save({ ...current(), session: text });
        },
        getDevice: (id) => current().devices[id] ?? "",
        setDevice(id, text) {
            const now = current();
            save({ ...now, devices: { ...now.devices, [id]: text } });
        },
        // Notu olan cihazlar, yazılma sırasıyla
        deviceIds: () => Object.keys(current().devices),
        // Temizler ve geri almak için eski notları döndürür
        clear() {
            const snapshot = structuredClone(current());
            save(empty());
            return snapshot;
        },
        restore(snapshot) {
            save(snapshot);
        },
    };
}
