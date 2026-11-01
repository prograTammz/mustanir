// A tiny IndexedDB key-value store: "days" (date → the server's copy of that day) and "meta" (cursor, outbox, settings).
// Every call degrades to a no-op when IndexedDB is unavailable (private mode, blocked storage): the app then runs in memory.
let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      if (!("indexedDB" in globalThis)) return reject(new Error("no IndexedDB"));
      const req = indexedDB.open("mustanir", 1);
      req.onupgradeneeded = () => { const d = req.result; d.createObjectStore("days"); d.createObjectStore("meta"); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("IndexedDB blocked"));
    });
    dbp.catch(() => {});
  }
  return dbp;
}
function run(store, mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(store, mode), s = t.objectStore(store), out = fn(s);
    t.oncomplete = () => resolve(out && "result" in out ? out.result : out);
    t.onerror = t.onabort = () => reject(t.error);
  }));
}

export const idb = {
  /** Every [key, value] in a store. */
  entries: (store) => db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(store), s = t.objectStore(store), keys = s.getAllKeys(), vals = s.getAll();
    t.oncomplete = () => resolve(keys.result.map((k, i) => [k, vals.result[i]]));
    t.onerror = () => reject(t.error);
  })).catch(() => []),
  get: (store, key) => run(store, "readonly", (s) => s.get(key)).catch(() => undefined),
  /** Write many [key, value] pairs in one transaction. */
  put: (store, pairs) => (pairs.length ? run(store, "readwrite", (s) => { for (const [k, v] of pairs) s.put(v, k); }).catch(() => {}) : Promise.resolve()),
  set: (store, key, value) => run(store, "readwrite", (s) => s.put(value, key)).catch(() => {}),
  clear: () => Promise.all(["days", "meta"].map((n) => run(n, "readwrite", (s) => s.clear()))).catch(() => {}),
};
