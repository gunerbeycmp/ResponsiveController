const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

// FR-2.4: yerel ağ adresleri v1'de desteklenmez
function isLocalNetwork(hostname) {
    const parts = hostname.split(".").map(Number);
    if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
    const [a, b] = parts;
    return (
        a === 10 ||
        (a === 192 && b === 168) ||
        (a === 172 && b >= 16 && b <= 31)
    );
}

// Kullanıcının yazdığı adresi önizlenebilir bir URL'ye çevirir (FR-2.1, FR-2.4)
export function normalizeUrl(input) {
    const value = String(input ?? "").trim();
    if (!value) return { ok: false, reason: "empty" };

    let candidate = value;
    if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
        const host = value.split(/[/:?#]/)[0].toLowerCase();
        const scheme = LOCAL_HOSTS.includes(host) ? "http" : "https";
        candidate = `${scheme}://${value}`;
    }

    let url;
    try {
        url = new URL(candidate);
    } catch {
        return { ok: false, reason: "invalid" };
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { ok: false, reason: "unsupportedProtocol" };
    }
    if (isLocalNetwork(url.hostname)) {
        return { ok: false, reason: "localNetwork" };
    }
    if (!LOCAL_HOSTS.includes(url.hostname) && !url.hostname.includes(".")) {
        return { ok: false, reason: "invalid" };
    }
    return { ok: true, url: url.href };
}
