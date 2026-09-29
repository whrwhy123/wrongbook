/* ===== 数据层：IndexedDB 封装（本地存储，数据不会丢失） ===== */
const DB = {
  name: 'wrongbook_db',
  version: 1,
  _db: null,

  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.name, this.version);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('questions')) {
          db.createObjectStore('questions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('subjects')) {
          db.createObjectStore('subjects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('tags')) {
          db.createObjectStore('tags', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => { this._db = req.result; resolve(this._db); };
      req.onerror = () => reject(req.error);
    });
  },

  _tx(store, mode) {
    return this._db.transaction(store, mode).objectStore(store);
  },

  getAll(store) {
    return new Promise((resolve, reject) => {
      const r = this._tx(store).getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
  },

  get(store, key) {
    return new Promise((resolve, reject) => {
      const r = this._tx(store).get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  },

  put(store, val) {
    return new Promise((resolve, reject) => {
      const r = this._tx(store, 'readwrite').put(val);
      r.onsuccess = () => resolve(val);
      r.onerror = () => reject(r.error);
    });
  },

  add(store, val) {
    return new Promise((resolve, reject) => {
      const r = this._tx(store, 'readwrite').add(val);
      r.onsuccess = () => resolve(val);
      r.onerror = () => reject(r.error);
    });
  },

  del(store, key) {
    return new Promise((resolve, reject) => {
      const r = this._tx(store, 'readwrite').delete(key);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  },

  /* 事务内批量写入 */
  bulkPut(store, vals) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      vals.forEach(v => os.put(v));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};
