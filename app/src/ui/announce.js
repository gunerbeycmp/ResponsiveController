// Ekran okuyuculara kısa duyuru (role="status"); aynı metin art arda da
// okunsun diye önce temizlenir
export function createAnnouncer(element) {
    return (message) => {
        element.textContent = "";
        setTimeout(() => {
            element.textContent = message;
        }, 50);
    };
}
