// FR-4.1, R-64: tam sayfa ekran görüntüsünün tarayıcının çizim sınırına
// sığması için plan. Yardımcı betik bu modülü yalnızca istenince yükler.

// Chrome / Firefox: kenar 16384 px, alan ~268 milyon px.
// Safari: alan ~16,7 milyon px (iPhone / iPad'de de aynı).
export function canvasLimits(userAgent = "") {
    const safari = /^((?!chrome|android|crios|fxios).)*safari/i.test(userAgent);
    return { side: 16384, area: safari ? 16777216 : 268435456 };
}

// Tek görsel: gerekirse yoğunluk sığacak kadar düşürülür (0,1 adımlarla)
export function fitScale({ width, height, scale, limits }) {
    const max = Math.min(
        scale,
        limits.side / width,
        limits.side / height,
        Math.sqrt(limits.area / (width * height)),
    );
    if (max >= scale) return { scale, reduced: false };
    return { scale: Math.max(0.1, Math.floor(max * 10) / 10), reduced: true };
}

// Parçalar: her parça tam yoğunlukta, sınıra sığan en yüksek dilim
export function partPlan({ width, height, scale, limits }) {
    const partHeight = Math.max(
        1,
        Math.floor(
            Math.min(
                limits.side / scale,
                limits.area / (width * scale * scale),
            ),
        ),
    );
    const parts = [];
    for (let top = 0; top < height; top += partHeight)
        parts.push({ top, height: Math.min(partHeight, height - top) });
    return parts;
}
