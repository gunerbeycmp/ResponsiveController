import { describe, expect, it } from "vitest";
import { normalizeUrl } from "../../app/src/url/normalize.js";

describe("normalizeUrl (FR-2.1, FR-2.4)", () => {
    it("protokolsüz adrese https ekler", () => {
        expect(normalizeUrl("ornek.com")).toEqual({
            ok: true,
            url: "https://ornek.com/",
        });
    });

    it("localhost adreslerine http ekler", () => {
        expect(normalizeUrl("localhost:3000").url).toBe(
            "http://localhost:3000/",
        );
        expect(normalizeUrl("127.0.0.1:8080/sayfa").url).toBe(
            "http://127.0.0.1:8080/sayfa",
        );
    });

    it("yazılan protokolü korur", () => {
        expect(normalizeUrl("http://ornek.com").url).toBe("http://ornek.com/");
        expect(normalizeUrl("  https://ornek.com/a?b=1  ").url).toBe(
            "https://ornek.com/a?b=1",
        );
    });

    it("boş ve geçersiz adresleri reddeder", () => {
        expect(normalizeUrl("").reason).toBe("empty");
        expect(normalizeUrl("   ").reason).toBe("empty");
        expect(normalizeUrl("merhaba").reason).toBe("invalid");
        expect(normalizeUrl("https://").reason).toBe("invalid");
    });

    it("http ve https dışındaki protokolleri reddeder", () => {
        expect(normalizeUrl("ftp://ornek.com").reason).toBe(
            "unsupportedProtocol",
        );
        expect(normalizeUrl("file:///Users/x/index.html").reason).toBe(
            "unsupportedProtocol",
        );
    });

    it("yerel ağ adreslerini reddeder", () => {
        for (const address of [
            "192.168.1.20:8080",
            "10.0.0.5",
            "172.16.0.1",
            "http://172.31.255.1",
        ]) {
            expect(normalizeUrl(address).reason).toBe("localNetwork");
        }
        expect(normalizeUrl("172.32.0.1").ok).toBe(true);
    });
});
