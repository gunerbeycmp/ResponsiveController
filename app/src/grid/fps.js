// FR-3.8, Teknik Tasarım 7.2: saniyedeki kare sayısı (FPS) ölçülür; belirli
// bir süre boyunca eşiğin altında kalırsa onSlow bir kez çağrılır
export function createFpsMonitor({
    onSlow,
    threshold = 30,
    duration = 3000,
    now = () => performance.now(),
    requestFrame = (callback) => requestAnimationFrame(callback),
    cancelFrame = (id) => cancelAnimationFrame(id),
} = {}) {
    let frameId = 0;
    let running = false;
    let windowStart = 0;
    let frames = 0;
    let slowSince = null;
    let reported = false;

    function tick() {
        if (!running) return;
        frames += 1;
        const time = now();
        const elapsed = time - windowStart;
        if (elapsed >= 1000) {
            const fps = (frames * 1000) / elapsed;
            if (fps < threshold) {
                slowSince ??= windowStart;
                if (!reported && time - slowSince >= duration) {
                    reported = true;
                    onSlow?.(fps);
                }
            } else {
                slowSince = null;
            }
            windowStart = time;
            frames = 0;
        }
        frameId = requestFrame(tick);
    }

    return {
        start() {
            if (running) return;
            running = true;
            windowStart = now();
            frames = 0;
            slowSince = null;
            frameId = requestFrame(tick);
        },
        stop() {
            running = false;
            cancelFrame(frameId);
        },
        // Yeni cihaz eklenince uyarı yeniden gösterilebilir
        reset() {
            reported = false;
            slowSince = null;
        },
        isRunning: () => running,
    };
}
