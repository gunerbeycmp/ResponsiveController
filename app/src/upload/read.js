import { unzip } from "fflate";
import {
    MAX_EXTRACTED_BYTES,
    UploadError,
    assertSize,
    classifyFile,
    isJunk,
    toProjectPath,
} from "./project.js";

function unzipAsync(data, options) {
    return new Promise((resolve, reject) => {
        unzip(data, options, (error, result) =>
            error ? reject(error) : resolve(result),
        );
    });
}

// ZIP dosyasını açar (FR-1.1). Açılmış boyut da sınırlanır.
export async function readZip(file) {
    assertSize(file.size);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let extractedBytes = 0;
    let entries;
    try {
        entries = await unzipAsync(bytes, {
            filter: (entry) => {
                if (entry.name.endsWith("/") || isJunk(entry.name)) {
                    return false;
                }
                extractedBytes += entry.originalSize;
                return true;
            },
        });
    } catch {
        throw new UploadError("badZip");
    }
    assertSize(extractedBytes, MAX_EXTRACTED_BYTES);
    return Object.entries(entries).map(([name, data]) => ({
        path: toProjectPath(name),
        data: data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ),
    }));
}

// Seçilen dosyaları (klasör seçimi veya sürükle-bırak) proje dosyalarına çevirir
export async function readFileList(items) {
    const total = items.reduce((sum, { file }) => sum + file.size, 0);
    assertSize(total);
    return Promise.all(
        items.map(async ({ file, path }) => ({
            path: toProjectPath(path),
            data: await file.arrayBuffer(),
        })),
    );
}

// Tek dosya ya da klasör girişini okur
export async function readUpload(items) {
    if (items.length === 1 && !items[0].path.includes("/")) {
        const { file } = items[0];
        const kind = classifyFile(file.name);
        if (kind === "zip") return readZip(file);
        assertSize(file.size);
        return [{ path: "/index.html", data: await file.arrayBuffer() }];
    }
    return readFileList(items);
}

// <input type="file"> listesini { file, path } biçimine çevirir
export function fromFileInput(fileList) {
    return Array.from(fileList, (file) => ({
        file,
        path: file.webkitRelativePath || file.name,
    }));
}

// Sürükle-bırakta klasörleri de içine girerek okur
export async function fromDataTransfer(dataTransfer) {
    const entries = Array.from(dataTransfer.items ?? [])
        .map((item) => item.webkitGetAsEntry?.())
        .filter(Boolean);
    if (entries.length === 0) return fromFileInput(dataTransfer.files);

    const results = [];
    async function walk(entry, prefix) {
        if (entry.isFile) {
            const file = await new Promise((resolve, reject) =>
                entry.file(resolve, reject),
            );
            results.push({ file, path: `${prefix}${entry.name}` });
            return;
        }
        const reader = entry.createReader();
        let batch;
        do {
            batch = await new Promise((resolve, reject) =>
                reader.readEntries(resolve, reject),
            );
            for (const child of batch) {
                await walk(child, `${prefix}${entry.name}/`);
            }
        } while (batch.length > 0);
    }
    for (const entry of entries) await walk(entry, "");
    return results;
}

// Klasör seçme desteği (R-06, NFR-1.3). Mobil tarayıcılar özelliği tanısa da
// genellikle çalıştırmaz, bu yüzden dokunmatik mobil cihazlar hariç tutulur.
export function supportsFolderPicker(
    input = document.createElement("input"),
    nav = navigator,
) {
    const mobile =
        /Android|iPhone|iPad|iPod/i.test(nav.userAgent) ||
        (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
    return "webkitdirectory" in input && !mobile;
}
