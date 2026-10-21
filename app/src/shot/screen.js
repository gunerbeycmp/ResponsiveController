// FR-4.2: URL ile açılan siteler ayrı bir siteden geldiği için içerikleri
// okunamaz (R-04); ekran görüntüsü tarayıcının ekran paylaşımıyla alınır.
// Her seferinde izin istenir, tek kare alınır ve paylaşım hemen kapatılır.

export const canShareScreen = () =>
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getDisplayMedia);

// Hata türü pencerede gösterilecek metnin anahtarıdır
export class ShareError extends Error {
    constructor(messageKey) {
        super(messageKey);
        this.messageKey = messageKey;
    }
}

const nextFrame = () =>
    new Promise((resolve) => requestAnimationFrame(() => resolve()));

// Paylaşılan kare bu sekmeye ait mi: oranı pencereyle aynı olmalı
export function matchesWindow(frame, view, tolerance = 0.03) {
    const frameRatio = frame.width / frame.height;
    const viewRatio = view.width / view.height;
    return Math.abs(frameRatio - viewRatio) / viewRatio <= tolerance;
}

// Sekmenin o anki görüntüsünü tek kare olarak alır
export async function grabTab() {
    if (!canShareScreen()) throw new ShareError("shot.shareUnsupported");
    let stream;
    try {
        stream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: "browser" },
            audio: false,
            preferCurrentTab: true,
            selfBrowserSurface: "include",
            surfaceSwitching: "exclude",
        });
    } catch (error) {
        // İzin verilmedi / tarayıcı bu ortamda desteklemiyor
        const keys = {
            NotAllowedError: "shot.shareDenied",
            NotSupportedError: "shot.shareUnsupported",
        };
        throw new ShareError(keys[error?.name] ?? "shot.error");
    }
    try {
        const [track] = stream.getVideoTracks();
        const surface = track.getSettings().displaySurface;
        if (surface && surface !== "browser")
            throw new ShareError("shot.wrongSurface");
        // Paylaşım çubuğu sekmenin yüksekliğini değiştirebilir; yerleşimin
        // oturması beklenir
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        await video.play();
        await new Promise((resolve) => setTimeout(resolve, 300));
        await nextFrame();
        await nextFrame();
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);
        video.srcObject = null;
        const view = { width: window.innerWidth, height: window.innerHeight };
        if (!matchesWindow(canvas, view))
            throw new ShareError("shot.wrongSurface");
        return { canvas, ratio: canvas.width / view.width };
    } finally {
        for (const track of stream.getTracks()) track.stop();
    }
}

// Ekranda görünen kısım: kırpılacak dikdörtgen pencere içinde kalmalı
export function visibleRect(rect, view) {
    const left = Math.max(rect.left, 0);
    const top = Math.max(rect.top, 0);
    const right = Math.min(rect.right, view.width);
    const bottom = Math.min(rect.bottom, view.height);
    if (right <= left || bottom <= top) return null;
    return { left, top, width: right - left, height: bottom - top };
}

// Karenin bir bölümünü PNG olarak keser (CSS piksel dikdörtgen)
export function crop({ canvas, ratio }, rect) {
    const out = document.createElement("canvas");
    out.width = Math.round(rect.width * ratio);
    out.height = Math.round(rect.height * ratio);
    out.getContext("2d").drawImage(
        canvas,
        Math.round(rect.left * ratio),
        Math.round(rect.top * ratio),
        out.width,
        out.height,
        0,
        0,
        out.width,
        out.height,
    );
    return new Promise((resolve, reject) =>
        out.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("crop"))),
            "image/png",
        ),
    );
}
