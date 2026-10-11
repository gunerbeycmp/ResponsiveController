import { describe, expect, it } from "vitest";
import appConfig from "../../vite.app.config.js";
import previewConfig from "../../vite.preview.config.js";

// Araç ve önizleme farklı portlarda çalışmalı, aksi hâlde izolasyon bozulur (R-37)
describe("geliştirme sunucusu portları", () => {
    it("araç 5173 portunda sabit", () => {
        expect(appConfig.server.port).toBe(5173);
        expect(appConfig.server.strictPort).toBe(true);
    });

    it("önizleme 5174 portunda sabit", () => {
        expect(previewConfig.server.port).toBe(5174);
        expect(previewConfig.server.strictPort).toBe(true);
    });
});
