import { defineConfig } from "vitest/config";

// Birim testleri tests/unit altında tutulur (Teknik Tasarım 9)
export default defineConfig({
    test: {
        include: ["tests/unit/**/*.test.js"],
    },
});
