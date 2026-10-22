import { MAX_ZOOM, ZOOM_STEPS } from "./zoom.js";

export const GRID_STORAGE_KEY = "rc-grid";
export const MODES = ["single", "grid"];
export const BOX_SIZES = ["small", "medium", "large"];

const MIN_SCALE = ZOOM_STEPS[0];

const validScale = (value) =>
    typeof value === "number" && value >= MIN_SCALE && value <= MAX_ZOOM
        ? value
        : null;

const knownIds = (list, isKnown) =>
    Array.isArray(list)
        ? [
              ...new Set(
                  list.filter((id) => typeof id === "string" && isKnown(id)),
              ),
          ]
        : [];

function readStored(storage, isKnown) {
    try {
        const stored = JSON.parse(storage?.getItem(GRID_STORAGE_KEY));
        return {
            ids: knownIds(stored?.ids, isKnown),
            mode: MODES.includes(stored?.mode) ? stored.mode : "single",
            size: BOX_SIZES.includes(stored?.size) ? stored.size : "medium",
            rotated: knownIds(stored?.rotated, isKnown),
            framed: knownIds(stored?.framed, isKnown),
            scale: validScale(stored?.scale),
        };
    } catch {
        return {
            ids: [],
            mode: "single",
            size: "medium",
            rotated: [],
            framed: [],
            scale: null,
        };
    }
}

// FR-3.7: ızgaradaki cihazlar, sıraları, kutu büyüklüğü ve son mod tarayıcıda
// saklanır. FR-3.6 / FR-3.9: döndürülen cihazlar ve genel ölçek de saklanır
// (null = Sığdır). FR-3.13: gerçekçi çerçevesi açık cihazlar da saklanır;
// döndürme gibi cihaza bağlıdır, tek görünümde ve ızgarada aynıdır.
// Kutu içi yakınlaştırma ve büyütülmüş kutu geçicidir.
export function createGridStore({ storage, isKnown = () => true } = {}) {
    let { ids, mode, size, rotated, framed, scale } = readStored(
        storage,
        isKnown,
    );

    function save() {
        try {
            storage?.setItem(
                GRID_STORAGE_KEY,
                JSON.stringify({ ids, mode, size, rotated, framed, scale }),
            );
        } catch {
            // Depolama kapalıysa ayarlar yalnızca bu oturumda kalır
        }
    }

    const clamp = (index, length) =>
        Math.max(0, Math.min(index ?? length, length));

    return {
        list: () => [...ids],
        has: (id) => ids.includes(id),
        getMode: () => mode,
        getSize: () => size,
        getScale: () => scale,
        isRotated: (id) => rotated.includes(id),
        isFramed: (id) => framed.includes(id),
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
        // Sınır dışı değerler sınıra çekilir; null "Sığdır" demektir
        setScale(next) {
            scale =
                next === null
                    ? null
                    : Math.min(MAX_ZOOM, Math.max(MIN_SCALE, next));
            save();
        },
        // Döndürülmüş cihazın genişliği ve yüksekliği yer değiştirir
        setRotated(id, value) {
            rotated = value
                ? [...new Set([...rotated, id])]
                : rotated.filter((x) => x !== id);
            save();
        },
        setFramed(id, value) {
            framed = value
                ? [...new Set([...framed, id])]
                : framed.filter((x) => x !== id);
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
