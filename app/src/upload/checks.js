// Yüklenen proje için kontroller (FR-1.7 - FR-1.10, Aşama 2 Tasarım Kararları).

const SERVER_EXTENSIONS = /\.(php\d?|py|asp|aspx|jsp|rb|cgi|pl|cfm)$/i;
const MAX_LISTED = 5;

// FR-1.9: package.json ve src/ varsa derlenmemiş kaynak kod yüklenmiş olabilir
export function isSourceProject(paths) {
    return (
        paths.includes("/package.json") &&
        paths.some((path) => path.startsWith("/src/"))
    );
}

// FR-1.7: <meta name="viewport"> var mı (öznitelik sırası ve tırnaklar fark etmez)
export function hasViewportMeta(html) {
    return /<meta\b[^>]*\bname\s*=\s*["']?viewport["'\s>]/i.test(html);
}

// FR-1.8: tarayıcıda çalışmayan sunucu dosyaları
export function findServerFiles(paths) {
    return paths.filter((path) => SERVER_EXTENSIONS.test(path)).sort();
}

const ATTRIBUTE = (name) =>
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");

function attribute(tag, name) {
    const match = ATTRIBUTE(name).exec(tag);
    return match ? (match[1] ?? match[2] ?? match[3]) : null;
}

// Başlangıç sayfasının istediği dosya adreslerini bulur (CSS, JS, görsel, medya)
export function findReferences(html) {
    const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
    const references = [];
    for (const [tag] of withoutComments.matchAll(
        /<(?:script|img|source|audio|video|track|embed)\b[^>]*>/gi,
    )) {
        const src = attribute(tag, "src");
        if (src) references.push(src);
    }
    for (const [tag] of withoutComments.matchAll(/<link\b[^>]*>/gi)) {
        const rel = (attribute(tag, "rel") ?? "").toLowerCase();
        const href = attribute(tag, "href");
        if (
            href &&
            /stylesheet|icon|manifest|preload|modulepreload/.test(rel)
        ) {
            references.push(href);
        }
    }
    return references;
}

// Göreli adresi projedeki yola çevirir; harici adresler için null döner
export function resolveReference(reference, fromPath) {
    const value = reference.trim();
    if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return null;
    const url = new URL(value, `https://proje.invalid${fromPath}`);
    try {
        return decodeURIComponent(url.pathname);
    } catch {
        return url.pathname;
    }
}

// FR-1.10: projede bulunmayan dosyalar
export function findMissingFiles(html, entry, paths) {
    const existing = new Set(paths);
    const missing = new Set();
    for (const reference of findReferences(html)) {
        const path = resolveReference(reference, entry);
        if (!path) continue;
        const found =
            existing.has(path) ||
            existing.has(`${path.replace(/\/$/, "")}/index.html`);
        if (!found) missing.add(path);
    }
    return [...missing].sort();
}

function listFiles(paths) {
    const shown = paths.slice(0, MAX_LISTED).join(", ");
    const rest = paths.length - MAX_LISTED;
    return rest > 0 ? `${shown} (+${rest})` : shown;
}

// Proje açıldıktan sonra çerçeve üstünde gösterilecek uyarılar
export function projectWarnings({ files, entry }) {
    const paths = files.map((file) => file.path);
    const entryFile = files.find((file) => file.path === entry);
    const html = entryFile ? new TextDecoder().decode(entryFile.data) : "";
    const warnings = [];

    if (!hasViewportMeta(html)) warnings.push({ key: "warnings.viewport" });

    const serverFiles = findServerFiles(paths);
    if (serverFiles.length > 0) {
        warnings.push({
            key: "warnings.serverFiles",
            params: { files: listFiles(serverFiles) },
        });
    }

    const missing = findMissingFiles(html, entry, paths);
    if (missing.length > 0) {
        warnings.push({
            key: "warnings.missingFiles",
            params: { files: listFiles(missing) },
        });
    }
    return warnings;
}
