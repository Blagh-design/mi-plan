// Guardado en el teléfono (IndexedDB). Funciona sin internet. Cada registro lleva `actualizado`
// (milisegundos) para que, al juntar con la copia de Claude, gane el más nuevo.
const NOMBRE = 'miplan'
const VER = 1
export const CLAVE = { kv: 'k', dias: 'fecha', pesos: 'fecha', recetas: 'id', menus: 'id', semanas: 'lunes', super: 'lunes' }
let db = null

export function abrir() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(NOMBRE, VER)
    r.onupgradeneeded = () => {
      const d = r.result
      for (const [s, k] of Object.entries(CLAVE)) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: k })
    }
    r.onsuccess = () => { db = r.result; ok(db) }
    r.onerror = () => mal(r.error)
    r.onblocked = () => mal(new Error('La base de datos está abierta en otra pestaña'))
  })
}

function todos(s) {
  return new Promise((ok, mal) => {
    const q = db.transaction(s).objectStore(s).getAll()
    q.onsuccess = () => ok(q.result)
    q.onerror = () => mal(q.error)
  })
}

export async function cargar() {
  const out = {}
  for (const s of Object.keys(CLAVE)) {
    out[s] = {}
    for (const r of await todos(s)) out[s][r[CLAVE[s]]] = r
  }
  return out
}

export function pon(s, obj) {
  return new Promise((ok, mal) => {
    const tx = db.transaction(s, 'readwrite')
    tx.objectStore(s).put(obj)
    tx.oncomplete = () => ok()
    tx.onerror = () => mal(tx.error)
    tx.onabort = () => mal(tx.error || new Error('Se canceló el guardado'))
  })
}

export function quita(s, k) {
  return new Promise((ok, mal) => {
    const tx = db.transaction(s, 'readwrite')
    tx.objectStore(s).delete(k)
    tx.oncomplete = () => ok()
    tx.onerror = () => mal(tx.error)
  })
}

export function borraTodo() {
  return new Promise((ok, mal) => {
    const tx = db.transaction(Object.keys(CLAVE), 'readwrite')
    for (const s of Object.keys(CLAVE)) tx.objectStore(s).clear()
    tx.oncomplete = () => ok()
    tx.onerror = () => mal(tx.error)
  })
}
