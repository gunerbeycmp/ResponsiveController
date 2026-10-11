// Yüklenen dosyalardan önizlenebilir bir proje oluşturan saf fonksiyonlar (FR-1).

export const MAX_PROJECT_BYTES = 50 * 1024 * 1024; // FR-1.5
// ZIP açıldıktan sonraki boyut için güvenlik sınırı (aşırı sıkıştırılmış dosyalar)
export const MAX_EXTRACTED_BYTES = 4 * MAX_PROJECT_BYTES;

const HTML_PATTERN = /\.html?$/i;
// İşletim sistemlerinin ve araçların eklediği, projeye ait olmayan dosyalar
const JUNK_PATTERN =
    /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|desktop\.ini$)/i;

export class UploadError extends Error {
    constructor(reason) {
        super(reason);
        this.reason = reason;
    }
}

// Tek dosya seçildiyse türünü belirler (FR-1.1, FR-1.3)
export function classifyFile(name) {
    if (/\.zip$/i.test(name)) return "zip";
    if (HTML_PATTERN.test(name)) return "html";
    throw new UploadError("fileType");
}

export function isJunk(path) {
    return JUNK_PATTERN.test(path);
}

export function toProjectPath(path) {
    const clean = path.replace(/\\/g, "/").replace(/^\.?\/+/, "");
    return `/${clean}`;
}

export function assertSize(bytes, limit = MAX_PROJECT_BYTES) {
    if (bytes > limit) throw new UploadError("tooLarge");
}

// Başlangıç sayfasını bulur (Aşama 2 Tasarım Kararları, R-12):
// 1. kökte index.html varsa o
// 2. index.html tek bir klasörde varsa o klasör kök sayılır
// 3. hiç index.html yoksa veya birden fazla klasörde varsa kullanıcı seçer
// 4. hiç HTML yoksa hata
export function resolveProject(files) {
    const usable = files.filter((file) => !isJunk(file.path));
    const htmlPaths = usable
        .map((file) => file.path)
        .filter((path) => HTML_PATTERN.test(path))
        .sort();

    if (htmlPaths.length === 0) throw new UploadError("noHtml");

    if (htmlPaths.includes("/index.html")) {
        return { files: usable, entry: "/index.html" };
    }

    const indexFolders = htmlPaths
        .filter((path) => /\/index\.html?$/i.test(path))
        .map((path) => path.slice(0, path.lastIndexOf("/")));

    if (indexFolders.length === 1) {
        const folder = indexFolders[0];
        const indexName = htmlPaths.find((path) =>
            path.startsWith(`${folder}/index.`),
        );
        const rerooted = usable
            .filter((file) => file.path.startsWith(`${folder}/`))
            .map((file) => ({
                ...file,
                path: file.path.slice(folder.length),
            }));
        return {
            files: rerooted,
            entry: indexName.slice(folder.length),
        };
    }

    return { files: usable, entry: null, choices: htmlPaths };
}
