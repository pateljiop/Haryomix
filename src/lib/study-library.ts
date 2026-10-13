export type StudyResourceKind = "note" | "resource" | "link";

export interface StudyResource {
  id: string;
  title: string;
  kind: StudyResourceKind;
  content: string;
  tags: string[];
  sourceUrl: string;
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = "haryomix-study-library";
const DB_VERSION = 1;
const STORE_NAME = "resources";
let databasePromise: Promise<IDBDatabase> | null = null;

function validHttpUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function isStudyResource(value: unknown): value is StudyResource {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || item.id.length < 1 || item.id.length > 100) return false;
  if (typeof item.title !== "string" || item.title.trim().length < 3 || item.title.length > 160) return false;
  if (item.kind !== "note" && item.kind !== "resource" && item.kind !== "link") return false;
  if (typeof item.content !== "string" || item.content.length > 100000) return false;
  if (item.kind !== "link" && item.content.trim().length < 1) return false;
  if (item.kind === "link" && (typeof item.sourceUrl !== "string" || !validHttpUrl(item.sourceUrl) || !item.sourceUrl)) return false;
  if (!Array.isArray(item.tags) || item.tags.length > 12 || !item.tags.every(tag => typeof tag === "string" && tag.trim().length > 0 && tag.length <= 32)) return false;
  if (new Set((item.tags as string[]).map(tag => tag.trim().toLowerCase())).size !== item.tags.length) return false;
  if (typeof item.sourceUrl !== "string" || item.sourceUrl.length > 2048 || !validHttpUrl(item.sourceUrl)) return false;
  if (typeof item.createdAt !== "number" || !Number.isFinite(item.createdAt) || item.createdAt <= 0) return false;
  if (typeof item.updatedAt !== "number" || !Number.isFinite(item.updatedAt) || item.updatedAt < item.createdAt) return false;
  return true;
}

export function parseStudyLibraryBackup(raw: string): StudyResource[] {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Study library backup is not valid JSON."); }
  if (!Array.isArray(parsed)) throw new Error("Study library backup must contain a resource list.");
  if (parsed.length > 500) throw new Error("Study library supports up to 500 items.");
  if (!parsed.every(isStudyResource)) throw new Error("Study library backup contains an invalid note or resource.");
  const ids = new Set<string>();
  for (const item of parsed) {
    if (ids.has(item.id)) throw new Error("Study library backup contains duplicate item IDs.");
    ids.add(item.id);
  }
  return parsed;
}

export function sortStudyResources(items: readonly StudyResource[]): StudyResource[] {
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title));
}

export function filterStudyResources(items: readonly StudyResource[], query: string, kind: "all" | StudyResourceKind = "all"): StudyResource[] {
  const normalized = query.trim().toLowerCase();
  return sortStudyResources(items.filter(item => {
    if (kind !== "all" && item.kind !== kind) return false;
    if (!normalized) return true;
    return [item.title, item.content, item.sourceUrl, ...item.tags].some(value => value.toLowerCase().includes(normalized));
  }));
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is unavailable in this browser."));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); databasePromise = null; };
        resolve(db);
      };
      request.onerror = () => reject(request.error ?? new Error("Could not open the study library."));
      request.onblocked = () => reject(new Error("Study library is blocked by another browser tab. Close older Haryomix tabs and retry."));
    });
  }
  return databasePromise;
}

function withRequest<T>(mode: IDBTransactionMode, createRequest: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    void openDatabase().then(db => {
      let result: T;
      const transaction = db.transaction(STORE_NAME, mode);
      const request = createRequest(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error ?? new Error("Study library request failed."));
      transaction.oncomplete = () => resolve(result!);
      transaction.onerror = () => reject(transaction.error ?? new Error("Study library transaction failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Study library transaction was cancelled."));
    }).catch(reject);
  });
}

export async function readStudyResources(): Promise<StudyResource[]> {
  const items = await withRequest<StudyResource[]>("readonly", store => store.getAll());
  if (!items.every(isStudyResource)) throw new Error("Stored study library data is invalid. Export may be unavailable until it is repaired.");
  return sortStudyResources(items);
}

export async function saveStudyResource(item: StudyResource): Promise<void> {
  if (!isStudyResource(item)) throw new Error("Study item is invalid.");
  await withRequest<IDBValidKey>("readwrite", store => store.put(item));
}

export async function deleteStudyResource(id: string): Promise<void> {
  await withRequest<undefined>("readwrite", store => store.delete(id));
}

export function replaceStudyResources(items: readonly StudyResource[]): Promise<void> {
  const validated = parseStudyLibraryBackup(JSON.stringify(items));
  return new Promise((resolve, reject) => {
    void openDatabase().then(db => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
      validated.forEach(item => store.put(item));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not replace study library."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Study library replacement was cancelled."));
    }).catch(reject);
  });
}

export function clearStudyResources(): Promise<void> {
  return withRequest<undefined>("readwrite", store => store.clear());
}
