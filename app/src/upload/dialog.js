import { UploadError, resolveProject } from "./project.js";
import {
    fromDataTransfer,
    fromFileInput,
    readUpload,
    supportsFolderPicker,
} from "./read.js";

// Yükleme penceresini yönetir (FR-1, Aşama 2 Tasarım Kararları).
// Proje hazır olunca onProject({ name, files, entry }) çağrılır.
export function createUploadDialog({ elements, t, onProject }) {
    const {
        dialog,
        openButton,
        closeButton,
        dropzone,
        chooseFile,
        chooseFolder,
        folderUnsupported,
        fileInput,
        folderInput,
        status,
        entryChoice,
        entryList,
    } = elements;

    let busy = false;

    const folderSupported = supportsFolderPicker(folderInput);
    chooseFolder.hidden = !folderSupported;
    folderUnsupported.hidden = folderSupported;

    function setStatus(key, { error = false } = {}) {
        status.dataset.error = String(error);
        status.dataset.key = key ?? "";
        status.textContent = key ? t(key) : "";
    }

    function reset() {
        setStatus(null);
        entryChoice.hidden = true;
        entryList.replaceChildren();
        dropzone.dataset.active = "false";
    }

    function open() {
        reset();
        dialog.showModal();
    }

    function close() {
        dialog.close();
    }

    async function finish(name, project, entry) {
        try {
            await onProject({ name, files: project.files, entry });
            close();
        } catch {
            setStatus("upload.error.previewUnavailable", { error: true });
        } finally {
            busy = false;
        }
    }

    function askForEntry(name, project) {
        entryChoice.hidden = false;
        setStatus(null);
        entryList.replaceChildren(
            ...project.choices.map((path) => {
                const item = document.createElement("li");
                const button = document.createElement("button");
                button.type = "button";
                button.textContent = path;
                button.addEventListener("click", () => {
                    busy = true;
                    setStatus("upload.processing");
                    finish(name, project, path);
                });
                item.append(button);
                return item;
            }),
        );
        entryList.querySelector("button")?.focus();
        busy = false;
    }

    async function handle(items) {
        if (busy || items.length === 0) return;
        busy = true;
        reset();
        setStatus("upload.processing");
        const name =
            items.length === 1
                ? items[0].file.name
                : items[0].path.split("/")[0] || items[0].file.name;
        try {
            const files = await readUpload(items);
            const project = resolveProject(files);
            if (project.entry) {
                await finish(name, project, project.entry);
            } else {
                askForEntry(name, project);
            }
        } catch (error) {
            busy = false;
            const reason =
                error instanceof UploadError ? error.reason : "badZip";
            setStatus(`upload.error.${reason}`, { error: true });
        }
    }

    openButton.addEventListener("click", open);
    closeButton.addEventListener("click", close);
    // Kapanınca odak "Yükle" düğmesine döner (NFR-5.2)
    dialog.addEventListener("close", () => openButton.focus());

    chooseFile.addEventListener("click", () => fileInput.click());
    chooseFolder.addEventListener("click", () => folderInput.click());
    for (const input of [fileInput, folderInput]) {
        input.addEventListener("change", () => {
            handle(fromFileInput(input.files));
            input.value = "";
        });
    }

    dropzone.addEventListener("dragover", (event) => {
        event.preventDefault();
        dropzone.dataset.active = "true";
    });
    dropzone.addEventListener("dragleave", () => {
        dropzone.dataset.active = "false";
    });
    dropzone.addEventListener("drop", async (event) => {
        event.preventDefault();
        dropzone.dataset.active = "false";
        handle(await fromDataTransfer(event.dataTransfer));
    });

    return {
        open,
        close,
        // Dil değişince açık durum mesajı yeni dilde gösterilir
        retranslate: () => {
            if (status.dataset.key) {
                status.textContent = t(status.dataset.key);
            }
        },
    };
}
