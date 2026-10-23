import { describe, expect, it } from "vitest";
import {
    GROUPS_STORAGE_KEY,
    createGroupState,
    groupKey,
} from "../../app/src/devices/groups.js";

const memory = () => {
    const values = new Map();
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
    };
};

describe("marka gruplarının durumu", () => {
    it("dokunulmamış grupta varsayılan, seçim kalıcı", () => {
        const storage = memory();
        const groups = createGroupState({ storage });
        const key = groupKey("phone", "Apple");
        expect(key).toBe("phone:Apple");
        expect(groups.isOpen(key, true)).toBe(true);
        expect(groups.isOpen(key, false)).toBe(false);
        groups.setOpen(key, false);
        expect(groups.isOpen(key, true)).toBe(false);
        expect(JSON.parse(storage.getItem(GROUPS_STORAGE_KEY))).toEqual({
            "phone:Apple": false,
        });
        expect(createGroupState({ storage }).isOpen(key, true)).toBe(false);
    });

    it("sekmeler birbirinden bağımsız", () => {
        const groups = createGroupState({ storage: memory() });
        groups.setOpen(groupKey("phone", "Apple"), true);
        expect(groups.isOpen(groupKey("tablet", "Apple"), false)).toBe(false);
    });

    it("bozuk kayıt ve kapalı depolama varsayılana döner", () => {
        const storage = memory();
        storage.setItem(
            GROUPS_STORAGE_KEY,
            JSON.stringify({ "phone:Apple": "evet", bozuk: true }),
        );
        expect(createGroupState({ storage }).isOpen("phone:Apple", true)).toBe(
            true,
        );
        storage.setItem(GROUPS_STORAGE_KEY, "{");
        expect(createGroupState({ storage }).isOpen("phone:Apple", false)).toBe(
            false,
        );
        const broken = {
            getItem() {
                throw new Error("kapalı");
            },
            setItem() {
                throw new Error("kapalı");
            },
        };
        const groups = createGroupState({ storage: broken });
        expect(() => groups.setOpen("phone:Apple", true)).not.toThrow();
        expect(groups.isOpen("phone:Apple", false)).toBe(true);
    });
});
