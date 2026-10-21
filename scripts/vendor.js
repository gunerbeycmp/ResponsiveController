// Önizleme sitesi derlenmeden sunulur (preview/public). Önizlemeye eklenen
// yardımcı betiğin kullandığı kütüphaneler buraya kopyalanır (Aşama 4).
import { copyFileSync, mkdirSync } from "node:fs";

const FILES = [
    [
        "node_modules/modern-screenshot/dist/index.mjs",
        "preview/public/__rc/vendor/modern-screenshot.js",
    ],
];

mkdirSync("preview/public/__rc/vendor", { recursive: true });
for (const [from, to] of FILES) copyFileSync(from, to);
