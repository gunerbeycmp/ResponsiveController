// Kutu içi yakınlaştırma (FR-3.9, Aşama 3 Tasarım Kararları)
export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2];
export const MAX_ZOOM = 2;

// "Sığdır" ölçeği en küçük adımdan da küçük olabilir (ör. 1920 px genişliğinde
// bir ekran küçük kutuda); uzaklaştırma o ölçeğe kadar iner
export const minZoom = (fit) => Math.min(fit, ZOOM_STEPS[0]);

const EPSILON = 0.001;

export function zoomIn(current) {
    return ZOOM_STEPS.find((step) => step > current + EPSILON) ?? MAX_ZOOM;
}

export function zoomOut(current, fit) {
    const lower = ZOOM_STEPS.filter((step) => step < current - EPSILON);
    return Math.max(lower.at(-1) ?? minZoom(fit), minZoom(fit));
}

// Tekerlek ve iki parmak hareketi için kesintisiz ölçek; sınırlar içinde kalır
export function clampZoom(value, fit) {
    return Math.min(MAX_ZOOM, Math.max(minZoom(fit), value));
}
