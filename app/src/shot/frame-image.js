// FR-3.13, FR-4.1: "Çerçeveyle" ekran görüntüsü. Ekrandaki CSS çerçevesinin
// (app/styles/main.css, .device-shell) aynısı görsele çizilir; ölçüler
// cihaz pikselindedir, görselin piksel yoğunluğuyla çarpılır. Kasanın
// dışı saydamdır (JPEG'de beyaz olur).
import { outerSize } from "../devices/frames.js";

const BODY = "#17191e";
const EDGE = "#4a4e58";
const STRAP = "#2b2f37";
const CAMERA = "#33363d";
const HOME = "#3a3d45";

const toBlob = (canvas) =>
    new Promise((resolve, reject) =>
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("frame"))),
            "image/png",
        ),
    );

function shape(context, rect, radius, round) {
    context.beginPath();
    if (round)
        context.ellipse(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
            rect.width / 2,
            rect.height / 2,
            0,
            0,
            Math.PI * 2,
        );
    else context.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
}

// Kamera biçimi ekranın üstünde (döndürülmüşse solunda), ekrana göre
// konumlanır; ölçüler CSS'teki ::before kurallarıyla aynıdır
export function cutoutRect(spec, screen, r) {
    const rotated = spec.rotated;
    const across = (length) =>
        rotated
            ? screen.y + (screen.height - length * r) / 2
            : screen.x + (screen.width - length * r) / 2;
    const place = (offset, along, thickness, radius) =>
        rotated
            ? {
                  x: screen.x + offset * r,
                  y: across(along),
                  width: thickness * r,
                  height: along * r,
                  radius,
              }
            : {
                  x: across(along),
                  y: screen.y + offset * r,
                  width: along * r,
                  height: thickness * r,
                  radius,
              };
    switch (spec.cutout) {
        case "island":
            return place(11, 124, 36, [18 * r]);
        case "notch": {
            const laptop = spec.kind === "laptop";
            const radius = (laptop ? 10 : 18) * r;
            return place(
                0,
                laptop ? 190 : 160,
                laptop ? 30 : 32,
                rotated ? [0, radius, radius, 0] : [0, 0, radius, radius],
            );
        }
        case "hole":
            return place(12, 12, 12, [6 * r]);
        case "camera":
            return { ...place(-17, 6, 6, [3 * r]), fill: CAMERA };
        case "home": {
            const size = 52 * r;
            return rotated
                ? {
                      x: screen.x + screen.width + 9 * r,
                      y: screen.y + (screen.height - size) / 2,
                      width: size,
                      height: size,
                      ring: true,
                  }
                : {
                      x: screen.x + (screen.width - size) / 2,
                      y: screen.y + screen.height + 9 * r,
                      width: size,
                      height: size,
                      ring: true,
                  };
        }
        default:
            return null;
    }
}

function drawExtras(context, spec, shell, housing, r) {
    const { extra } = spec;
    if (spec.kind === "watch" && extra.top > 0) {
        const width = shell.width * 0.62;
        const x = (shell.width - width) / 2;
        context.fillStyle = STRAP;
        shape(context, { x, y: 0, width, height: extra.top * r }, [
            16 * r,
            16 * r,
            0,
            0,
        ]);
        context.fill();
        shape(
            context,
            {
                x,
                y: shell.height - extra.bottom * r,
                width,
                height: extra.bottom * r,
            },
            [0, 0, 16 * r, 16 * r],
        );
        context.fill();
    }
    if (spec.kind === "tv" && extra.bottom > 0) {
        const stand = shell.width * 0.36;
        const foot = 12 * r;
        const top = housing.y + housing.height;
        context.fillStyle = BODY;
        context.fillRect(
            (shell.width - stand * 0.12) / 2,
            top,
            stand * 0.12,
            shell.height - top - foot,
        );
        context.fillRect(
            (shell.width - stand) / 2,
            shell.height - foot,
            stand,
            foot,
        );
    }
    if (spec.kind === "laptop" && extra.bottom > 0) {
        const height = extra.bottom * r;
        const y = shell.height - height;
        const gradient = context.createLinearGradient(0, y, 0, shell.height);
        gradient.addColorStop(0, "#c9ccd4");
        gradient.addColorStop(1, "#9a9ea8");
        context.fillStyle = gradient;
        shape(context, { x: 0, y, width: shell.width, height }, [
            0,
            0,
            40 * r,
            40 * r,
        ]);
        context.fill();
    }
}

// blob: ekranın görüntüsü; size: cihazın CSS boyutu (konumuna göre);
// spec: frameSpec. Görselin yoğunluğu genişlikten hesaplanır.
export async function drawFramed(blob, spec, size) {
    const bitmap = await createImageBitmap(blob);
    const r = bitmap.width / size.width;
    const outer = outerSize(size, spec);
    const { top, right, bottom, left } = spec.bezel;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(outer.width * r);
    canvas.height = Math.round(outer.height * r);
    const context = canvas.getContext("2d");
    const shell = { width: canvas.width, height: canvas.height };
    const housing = {
        x: spec.extra.side * r,
        y: spec.extra.top * r,
        width: (size.width + left + right) * r,
        height: (size.height + top + bottom) * r,
    };
    const screen = {
        x: housing.x + left * r,
        y: housing.y + top * r,
        width: bitmap.width,
        height: bitmap.height,
    };
    const round = Boolean(spec.round);
    const bezel = Math.max(top, right, bottom, left);
    const outerRadius = (spec.outerRadius ?? spec.radius + bezel * 0.6) * r;

    drawExtras(context, spec, shell, housing, r);

    // Kasa ve ince kenar çizgisi
    context.fillStyle = BODY;
    shape(context, housing, outerRadius, round);
    context.fill();
    context.strokeStyle = EDGE;
    context.lineWidth = Math.max(1, r * 0.75);
    context.stroke();

    // Ekran köşeleri kasanın içinde yuvarlatılır
    context.save();
    shape(context, screen, spec.radius * r, round);
    context.clip();
    context.drawImage(bitmap, screen.x, screen.y);
    context.restore();
    bitmap.close?.();

    const cutout = cutoutRect(spec, screen, r);
    if (cutout?.ring) {
        context.strokeStyle = HOME;
        context.lineWidth = 2 * r;
        shape(
            context,
            {
                x: cutout.x + r,
                y: cutout.y + r,
                width: cutout.width - 2 * r,
                height: cutout.height - 2 * r,
            },
            0,
            true,
        );
        context.stroke();
    } else if (cutout) {
        context.fillStyle = cutout.fill ?? BODY;
        shape(context, cutout, cutout.radius, false);
        context.fill();
    }
    return toBlob(canvas);
}
