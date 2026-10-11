// FR-2.3: siteyi seçili cihaz boyutunda yeni pencerede açmak için pencere ayarları.
// "noopener" bilerek eklenmez: Chrome bu seçenek varken boyutları yok sayıp
// yeni sekme açabiliyor (C-35). Aynı koruma openSizedWindow içinde sağlanır.
export function popupFeatures({ width, height }) {
    return `popup,width=${Math.round(width)},height=${Math.round(height)}`;
}

// Pencereyi açar ve açılan sitenin araca (window.opener) erişimini hemen keser
export function openSizedWindow(url, size, target = window) {
    const opened = target.open(url, "_blank", popupFeatures(size));
    if (opened) opened.opener = null;
    return opened;
}
