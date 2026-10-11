// Dar ekranlarda cihaz listesini alttan açılan panel olarak yönetir.
// Panel butonla ve klavyeyle açılıp kapanır, Esc ile kapanır (NFR-5.2, R-51)
export function createSheet({ toggle, panel, onToggle }) {
    let open = false;

    function setOpen(next, { restoreFocus = false } = {}) {
        open = next;
        toggle.setAttribute("aria-expanded", String(open));
        panel.dataset.open = String(open);
        onToggle?.(open);
        if (open) {
            panel.querySelector("button, [href], input")?.focus();
        } else if (restoreFocus) {
            toggle.focus();
        }
    }

    toggle.addEventListener("click", () => setOpen(!open));
    panel.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && open) {
            setOpen(false, { restoreFocus: true });
        }
    });

    setOpen(false);

    return {
        close: (options) => setOpen(false, options),
        isOpen: () => open,
    };
}
