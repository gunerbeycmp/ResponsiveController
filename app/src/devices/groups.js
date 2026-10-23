// Aşama 6 revizyonu: cihazlar menüsünde marka gruplarının açık / kapalı
// durumu. Kullanıcının dokunmadığı grupta varsayılan geçerlidir (seçili
// cihazın markası açık); açıp kapattığı gruplar tarayıcıda kalıcı olarak
// hatırlanır. Anahtar sekme ve markadır (ör. "phone:Apple").
export const GROUPS_STORAGE_KEY = "rc-menu-groups";

export const groupKey = (tab, brand) => `${tab}:${brand}`;

function readStored(storage) {
    try {
        const stored = JSON.parse(storage?.getItem(GROUPS_STORAGE_KEY));
        if (!stored || typeof stored !== "object" || Array.isArray(stored))
            return {};
        return Object.fromEntries(
            Object.entries(stored).filter(
                ([key, value]) =>
                    typeof value === "boolean" && key.includes(":"),
            ),
        );
    } catch {
        return {};
    }
}

export function createGroupState({ storage } = {}) {
    const state = readStored(storage);

    function save() {
        try {
            storage?.setItem(GROUPS_STORAGE_KEY, JSON.stringify(state));
        } catch {
            // Depolama kapalıysa seçim yalnızca bu oturumda kalır
        }
    }

    return {
        isOpen: (key, fallback) => state[key] ?? fallback,
        setOpen(key, open) {
            state[key] = open;
            save();
        },
    };
}
