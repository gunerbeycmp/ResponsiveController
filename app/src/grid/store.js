export const GRID_STORAGE_KEY = "rc-grid";
export const MODES = ["single", "grid"];
export const BOX_SIZES = ["small", "medium", "large"];

function readStored(storage, isKnown) {
    try {
        const stored = JSON.parse(storage?.getItem(GRID_STORAGE_KEY));
        const ids = Array.isArray(stored?.ids)
            ? [
                  ...new Set(
                      stored.ids.filter(
                          (id) => typeof id === "string" && isKnown(id),
                      ),
                  ),
              ]
            : [];
        return {
            ids,
            mode: MODES.includes(stored?.mode) ? stored.mode : "single",
            size: BOX_SIZES.includes(stored?.size) ? stored.size : "medium",
        };
    } catch {
        return { ids: [], mode: "single", size: "medium" };
    }
}

// FR-3.6: ızgaradaki cihazlar, sıraları, kutu büyüklüğü ve son mod tarayıcıda
// saklanır. Kutu içi yakınlaştırma ve büyütülmüş kutu geçicidir, saklanmaz.
export function createGridStore({ storage, isKnown = () => true } = {}) {
    let { ids, mode, size } = readStored(storage, isKnown);

    function save() {
        try {
            storage?.setItem(
                GRID_STORAGE_KEY,
                JSON.stringify({ ids, mode, size }),
            );
        } catch {
            // Depolama kapalıysa ızgara yalnızca bu oturumda kalır
        }
    }

    const clamp = (index, length) =>
        Math.max(0, Math.min(index ?? length, length));

    return {
        list: () => [...ids],
        has: (id) => ids.includes(id),
        getMode: () => mode,
        getSize: () => size,
        setMode(next) {
            if (!MODES.includes(next)) return;
            mode = next;
            save();
        },
        setSize(next) {
            if (!BOX_SIZES.includes(next)) return;
            size = next;
            save();
        },
        // Ekler ya da zaten varsa verilen sıraya taşır
        add(id, index) {
            const rest = ids.filter((x) => x !== id);
            const at = clamp(index, rest.length);
            ids = [...rest.slice(0, at), id, ...rest.slice(at)];
            save();
        },
        remove(id) {
            ids = ids.filter((x) => x !== id);
            save();
        },
    };
}
