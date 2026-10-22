// FR-5.1, FR-5.3: rapora eklenen ekran görüntüleri. Görseller büyük olduğu
// için tarayıcının büyük deposunda (IndexedDB) notlar gibi bağlama (adres /
// proje) göre saklanır; depolama kullanılamıyorsa yalnızca bu oturumda
// bellekte tutulur (Aşama 5 kararları, LocalData).
export const SHOTS_DB = "rc-report";
export const SHOTS_STORE = "shots";

const request = (operation) =>
    new Promise((resolve, reject) => {
        operation.onsuccess = () => resolve(operation.result);
        operation.onerror = () => reject(operation.error);
    });

function memoryBackend() {
    let records = [];
    return {
        async add(record) {
            records.push(record);
        },
        async list(context) {
            return records.filter((record) => record.context === context);
        },
        async remove(id) {
            records = records.filter((record) => record.id !== id);
        },
    };
}

async function indexedBackend(factory) {
    const open = factory.open(SHOTS_DB, 1);
    open.onupgradeneeded = () => {
        const store = open.result.createObjectStore(SHOTS_STORE, {
            keyPath: "id",
        });
        store.createIndex("context", "context");
    };
    const db = await request(open);
    const store = (mode) =>
        db.transaction(SHOTS_STORE, mode).objectStore(SHOTS_STORE);
    return {
        add: (record) => request(store("readwrite").put(record)),
        list: (context) =>
            request(store("readonly").index("context").getAll(context)),
        remove: (id) => request(store("readwrite").delete(id)),
    };
}

export async function createShotStore({ factory = globalThis.indexedDB } = {}) {
    let backend;
    try {
        backend = factory ? await indexedBackend(factory) : memoryBackend();
    } catch {
        backend = memoryBackend();
    }
    let counter = 0;
    const newId = () =>
        globalThis.crypto?.randomUUID?.() ?? `shot-${Date.now()}-${counter++}`;

    return {
        // record: { context, deviceId (genel görüntüde null), name, blob,
        // width, height }
        async add(record) {
            const saved = { ...record, id: newId(), createdAt: Date.now() };
            await backend.add(saved);
            return saved;
        },
        async list(context) {
            if (!context) return [];
            const records = await backend.list(context);
            return records.sort((a, b) => a.createdAt - b.createdAt);
        },
        remove: (id) => backend.remove(id),
        // Notlar temizlenince görüntüler de silinir; geri almak için döner
        async clear(context) {
            const records = await this.list(context);
            for (const record of records) await backend.remove(record.id);
            return records;
        },
        async restore(records) {
            for (const record of records) await backend.add(record);
        },
    };
}
