// FR-3.13: gerçekçi cihaz çerçevesi. Kasa, cihaz türüne ve modeline göre
// CSS ile çizilir (Aşama 6 kararları); ayrıntılı model çizimleri v2'de
// (D-11). Bütün ölçüler cihazın CSS pikselindedir, ekranda ölçekle çarpılır.
// Kamera biçimleri temsilidir: modelin gerçek ölçüsü değil, türüdür.

// Dynamic Island'lı iPhone'lar: 14 Pro ve sonrası, 15 ve sonrası (e
// modelleri hariç), Air
const HAS_ISLAND = /^iPhone (14 Pro|1[5-9](?! ?e\b)|Air)/i;
// Ekranın üstünde çentiği olan MacBook'lar
const MACBOOK_NOTCH = new Set([
    "macbook-air-13-m2-m4",
    "macbook-air-15-m2-m4",
    "macbook-pro-14",
    "macbook-pro-16",
]);

const insets = (top, right = top, bottom = top, left = right) => ({
    top,
    right,
    bottom,
    left,
});

// Cihazın dik (doğal) konumdaki kasası; çerçevesi olmayanlarda null
function baseSpec(device) {
    if (device.custom || device.generated) return null;
    if (device.category === "generic") return null;
    if (device.category === "computer" && device.kind !== "device") return null;
    const name = device.name ?? device.names?.en ?? "";

    if (device.category === "phone") {
        if (device.id === "iphone-se-3rd-gen")
            // Ana ekran tuşlu eski tasarım: kalın üst ve alt kasa
            return {
                kind: "phone",
                bezel: insets(72, 14),
                radius: 0,
                outerRadius: 56,
                cutout: "home",
            };
        if (device.brand === "Apple")
            return {
                kind: "phone",
                bezel: insets(12),
                radius: HAS_ISLAND.test(name) ? 55 : 47,
                cutout: HAS_ISLAND.test(name) ? "island" : "notch",
            };
        // Katlanabilirlerin açık hâli geniş, köşeleri daha az yuvarlak
        const open = device.foldable?.state === "open";
        return {
            kind: "phone",
            bezel: insets(open ? 10 : 11),
            radius: open ? 20 : 36,
            cutout: "hole",
        };
    }
    if (device.category === "tablet")
        return {
            kind: "tablet",
            bezel: insets(device.brand === "Apple" ? 20 : 18),
            radius: 18,
            cutout: null,
        };
    if (device.category === "watch") {
        // Galaxy Watch ve Huawei Watch GT'nin ekranı yuvarlak
        const round = device.screen.width === device.screen.height;
        return {
            kind: "watch",
            bezel: insets(round ? 14 : 12),
            radius: round ? "50%" : 40,
            cutout: null,
            round,
            // Kayışlar ekranın altında ve üstünde
            extra: { top: 70, bottom: 70, side: 0 },
        };
    }
    if (device.category === "tv")
        return {
            kind: "tv",
            bezel: insets(12),
            radius: 4,
            cutout: null,
            extra: { top: 0, bottom: 64, side: 0 },
        };
    if (device.category === "computer") {
        // Surface Pro bir tablet bilgisayardır, klavye tabanı çizilmez
        if (device.id === "surface-pro")
            return {
                kind: "tablet",
                bezel: insets(24),
                radius: 12,
                cutout: null,
            };
        return {
            kind: "laptop",
            bezel: insets(28, 18, 30),
            radius: 10,
            cutout: MACBOOK_NOTCH.has(device.id) ? "notch" : "camera",
            // Klavye tabanı ekrandan biraz geniş
            extra: { top: 0, bottom: 26, side: 90 },
        };
    }
    return null;
}

export const hasFrame = (device) => baseSpec(device) !== null;

// Döndürülmüş cihazda kasa saat yönünde döner: dik konumun üstü yatayda
// sol olur. Saat kayışı, TV ayağı ve klavye tabanı yalnızca doğal konumda.
export function frameSpec(device, { rotated = false } = {}) {
    const spec = baseSpec(device);
    if (!spec) return null;
    const { top, right, bottom, left } = spec.bezel;
    const extra = rotated
        ? { top: 0, bottom: 0, side: 0 }
        : (spec.extra ?? { top: 0, bottom: 0, side: 0 });
    return {
        ...spec,
        rotated,
        bezel: rotated
            ? { top: left, right: top, bottom: right, left: bottom }
            : spec.bezel,
        extra,
    };
}

// Kasa ve ekler dahil cihazın dış boyutu (cihaz pikseli)
export function outerSize(size, spec) {
    if (!spec) return size;
    const { top, right, bottom, left } = spec.bezel;
    return {
        width: size.width + left + right + spec.extra.side * 2,
        height: size.height + top + bottom + spec.extra.top + spec.extra.bottom,
    };
}

// Ekranın köşe yarıçapı ve kasanın dış yarıçapı (CSS değeri)
export function radii(spec, scale) {
    if (spec.round) return { screen: "50%", outer: "50%" };
    const bezel = Math.max(...Object.values(spec.bezel));
    const outer = spec.outerRadius ?? spec.radius + bezel * 0.6;
    return {
        screen: `${Math.round(spec.radius * scale)}px`,
        outer: `${Math.round(outer * scale)}px`,
    };
}
