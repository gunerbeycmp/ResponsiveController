export const FAVORITES_STORAGE_KEY = "rc-favorites";

const unique = (ids) => [...new Set(ids)];

function readStored(storage, isKnown) {
    try {
        const stored = JSON.parse(storage?.getItem(FAVORITES_STORAGE_KEY));
        const valid = (list) =>
            Array.isArray(list)
                ? unique(list.filter((id) => typeof id === "string"))
                : [];
        const ids = valid(stored?.ids).filter(isKnown);
        const frequent = valid(stored?.frequent).filter((id) =>
            ids.includes(id),
        );
        return { ids, frequent };
    } catch {
        return { ids: [], frequent: [] };
    }
}

// FR-3.2: favoriler tarayıcıda saklanır (R-18). ids ekleme sırasını,
// frequent "Sık kullanılan favoriler" grubunun elle belirlenen sırasını tutar
export function createFavorites({ storage, isKnown = () => true } = {}) {
    let { ids, frequent } = readStored(storage, isKnown);

    function save() {
        try {
            storage?.setItem(
                FAVORITES_STORAGE_KEY,
                JSON.stringify({ ids, frequent }),
            );
        } catch {
            // Depolama kapalıysa favoriler yalnızca bu oturumda kalır
        }
    }

    const clamp = (index, length) =>
        Math.max(0, Math.min(index ?? length, length));

    return {
        list: () => [...ids],
        frequent: () => [...frequent],
        has: (id) => ids.includes(id),
        isFrequent: (id) => frequent.includes(id),
        // Eklendiyse true, çıkarıldıysa false döner
        toggle(id) {
            if (ids.includes(id)) {
                ids = ids.filter((x) => x !== id);
                frequent = frequent.filter((x) => x !== id);
                save();
                return false;
            }
            ids = [...ids, id];
            save();
            return true;
        },
        // Sık kullanılanlara ekler veya grup içinde yerini değiştirir
        moveToFrequent(id, index) {
            if (!ids.includes(id)) return;
            const rest = frequent.filter((x) => x !== id);
            const at = clamp(index, rest.length);
            frequent = [...rest.slice(0, at), id, ...rest.slice(at)];
            save();
        },
        removeFromFrequent(id) {
            frequent = frequent.filter((x) => x !== id);
            save();
        },
    };
}
