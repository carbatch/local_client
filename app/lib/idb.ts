/**
 * IndexedDB 이미지 저장소
 *
 * DB: carbatch_db  v1
 * Store: images
 *   keyPath : key  (`${promptId}_${index}`)
 *   indexes : pageId, promptId
 */

const DB_NAME = 'carbatch_db';
const DB_VERSION = 1;
const STORE = 'images';

export interface ImageRecord {
  key: string;      // `${promptId}_${index}`
  pageId: string;
  promptId: string;
  index: number;
  dataUri: string;  // "data:image/png;base64,..."
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('pageId', 'pageId', { unique: false });
        store.createIndex('promptId', 'promptId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 이미지 배열을 IDB에 저장 */
export async function saveImages(
  pageId: string,
  promptId: string,
  images: string[],
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    images.forEach((dataUri, index) => {
      store.put({ key: `${promptId}_${index}`, pageId, promptId, index, dataUri });
    });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** promptId에 속한 이미지 배열 로드 (인덱스 순 정렬) */
export async function loadImages(promptId: string): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).index('promptId').getAll(promptId);
    req.onsuccess = () => {
      db.close();
      const sorted = (req.result as ImageRecord[]).sort((a, b) => a.index - b.index);
      resolve(sorted.map(r => r.dataUri));
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/** 특정 페이지의 이미지 전체 삭제 */
export async function deletePageImages(pageId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.index('pageId').getAll(pageId);
    req.onsuccess = () => {
      (req.result as ImageRecord[]).forEach(r => store.delete(r.key));
      tx.oncomplete = () => { db.close(); resolve(); };
    };
    req.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** 모든 이미지 삭제 */
export async function deleteAllImages(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export interface PageImageStat {
  pageId: string;
  count: number;
  estimatedBytes: number;
}

/** 전체 통계 + 페이지별 통계 반환 */
export async function getStorageStats(): Promise<{
  total: { count: number; estimatedBytes: number };
  perPage: Map<string, { count: number; estimatedBytes: number }>;
}> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => {
      db.close();
      const records = req.result as ImageRecord[];
      const perPage = new Map<string, { count: number; estimatedBytes: number }>();
      let totalCount = 0;
      let totalBytes = 0;
      for (const r of records) {
        const bytes = Math.round(r.dataUri.length * 0.75);
        totalCount++;
        totalBytes += bytes;
        const cur = perPage.get(r.pageId) ?? { count: 0, estimatedBytes: 0 };
        perPage.set(r.pageId, { count: cur.count + 1, estimatedBytes: cur.estimatedBytes + bytes });
      }
      resolve({ total: { count: totalCount, estimatedBytes: totalBytes }, perPage });
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
