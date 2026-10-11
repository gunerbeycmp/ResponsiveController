// FR-2.3: siteyi seçili cihaz boyutunda yeni pencerede açmak için pencere ayarları.
// noopener, açılan sitenin araca (window.opener) erişmesini engeller
export function popupFeatures({ width, height }) {
    return `popup,noopener,width=${Math.round(width)},height=${Math.round(height)}`;
}
