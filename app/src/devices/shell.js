import { radii } from "./frames.js";

// FR-3.13: çerçevenin ekrana uygulanması. Yapı: kabuk (kayış, ayak, klavye
// tabanı için boşluk) > kasa (kenarlık olarak çizilir, kamera biçimi
// ::before ile) > ekran (sayfanın çizildiği alan). Tek cihaz görünümü ve
// ızgara kutuları aynı yapıyı kullanır.
export function applyShell({ shell, housing, screen, viewport }, spec, scale) {
    shell.classList.toggle("is-framed", Boolean(spec));
    viewport?.classList.toggle("is-framed", Boolean(spec));
    if (!spec) {
        delete shell.dataset.frame;
        delete housing.dataset.cutout;
        shell.classList.remove("is-rotated", "is-round");
        shell.style.padding = "";
        housing.style.borderWidth = "";
        housing.style.borderRadius = "";
        screen.style.borderRadius = "";
        return;
    }
    const px = (value) => `${Math.round(value * scale)}px`;
    const { top, right, bottom, left } = spec.bezel;
    const { screen: screenRadius, outer } = radii(spec, scale);
    shell.dataset.frame = spec.kind;
    shell.classList.toggle("is-rotated", spec.rotated);
    shell.classList.toggle("is-round", Boolean(spec.round));
    shell.style.setProperty("--z", String(scale));
    shell.style.padding = `${px(spec.extra.top)} ${px(spec.extra.side)} ${px(
        spec.extra.bottom,
    )}`;
    if (spec.cutout) housing.dataset.cutout = spec.cutout;
    else delete housing.dataset.cutout;
    housing.style.borderWidth = `${px(top)} ${px(right)} ${px(bottom)} ${px(
        left,
    )}`;
    housing.style.borderRadius = outer;
    screen.style.borderRadius = screenRadius;
}

// Kabuğun ekrandaki boyutu; kasa ve ekler applyShell ile aynı yuvarlanır,
// böylece kabuğu taşıyan alan bir piksel bile taşmaz
export function shellSize(size, spec, scale) {
    const px = (value) => Math.round(value * scale);
    const screen = {
        width: px(size.width),
        height: px(size.height),
    };
    if (!spec) return screen;
    const { top, right, bottom, left } = spec.bezel;
    return {
        width: screen.width + px(left) + px(right) + px(spec.extra.side) * 2,
        height:
            screen.height +
            px(top) +
            px(bottom) +
            px(spec.extra.top) +
            px(spec.extra.bottom),
    };
}

// Çerçeve yapısının öğeleri; ekran öğesi kasaya, kasa kabuğa yerleştirilir
export function buildShell(screen) {
    const shell = document.createElement("div");
    shell.className = "device-shell";
    const housing = document.createElement("div");
    housing.className = "device-housing";
    housing.append(screen);
    shell.append(housing);
    return { shell, housing };
}
