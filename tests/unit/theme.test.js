import { describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY, createTheme } from "../../app/src/ui/theme.js";

function fakeStorage(initial = {}) {
    const data = { ...initial };
    return {
        getItem: (key) => data[key] ?? null,
        setItem: (key, value) => {
            data[key] = value;
        },
        data,
    };
}

function fakeQuery(matches) {
    const listeners = [];
    return {
        matches,
        addEventListener: (_, listener) => listeners.push(listener),
        change(next) {
            this.matches = next;
            listeners.forEach((listener) => listener());
        },
    };
}

describe("createTheme (NFR-6.1, NFR-6.2)", () => {
    it("varsayılan olarak cihaz ayarını izler", () => {
        const root = { dataset: {} };
        const query = fakeQuery(true);
        const theme = createTheme({ systemQuery: query, root });
        expect(theme.getTheme()).toBe("dark");
        expect(root.dataset.theme).toBe("dark");

        query.change(false);
        expect(root.dataset.theme).toBe("light");
    });

    it("elle seçilen tema saklanır ve cihaz ayarının önüne geçer", () => {
        const storage = fakeStorage();
        const query = fakeQuery(true);
        const root = { dataset: {} };
        const theme = createTheme({ storage, systemQuery: query, root });

        theme.toggle();
        expect(root.dataset.theme).toBe("light");
        expect(storage.data[THEME_STORAGE_KEY]).toBe("light");

        query.change(true);
        expect(root.dataset.theme).toBe("light");
    });

    it("saklanan tema sonraki açılışta uygulanır", () => {
        const theme = createTheme({
            storage: fakeStorage({ [THEME_STORAGE_KEY]: "dark" }),
            systemQuery: fakeQuery(false),
        });
        expect(theme.getTheme()).toBe("dark");
    });

    it("depolama hata verse de çalışır", () => {
        const broken = {
            getItem: () => {
                throw new Error();
            },
            setItem: () => {
                throw new Error();
            },
        };
        const theme = createTheme({
            storage: broken,
            systemQuery: fakeQuery(false),
        });
        expect(() => theme.toggle()).not.toThrow();
        expect(theme.getTheme()).toBe("dark");
    });
});
