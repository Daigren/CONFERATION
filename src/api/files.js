// Файловое хранилище документов, прикреплённых к заявкам (IndexedDB)
import { uid, now } from './db';

const DB_NAME = 'conferation-files';
const STORE = 'files';

let dbPromise;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run(mode, action) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = action(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export async function saveFile(file) {
  const id = uid();
  await run('readwrite', (store) => store.put(file, id));
  return {
    id,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    uploadedAt: now(),
  };
}

export const deleteFile = (id) => run('readwrite', (store) => store.delete(id));

async function loadVerified(meta) {
  const blob = await run('readonly', (store) => store.get(meta.id));
  if (!blob) throw new Error('Файл не найден в хранилище');
  if (blob.size !== meta.size) throw new Error('Нарушена целостность файла: размер не совпадает');
  return blob;
}

export async function downloadFile(meta) {
  const blob = await loadVerified(meta);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = meta.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function openFile(meta) {
  // Окно открываем синхронно, иначе браузер заблокирует его как всплывающее
  const win = window.open('', '_blank');
  try {
    const blob = await loadVerified(meta);
    const url = URL.createObjectURL(blob);
    if (win) win.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    win?.close();
    throw err;
  }
}
