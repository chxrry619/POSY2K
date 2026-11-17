/* =========================================================
   ALMACENAMIENTO – dónde se guardan inventario, ventas,
   imágenes y ajustes
   ---------------------------------------------------------
   • App Android / navegador: TODO se guarda en el propio
     dispositivo (IndexedDB). Funciona sin internet.
   • Versión publicada en Claude: se guarda en tu cuenta.
   Todos ofrecen las mismas funciones:
     cargarInventario(), guardarInventario(productos),
     cargarDia(clave),   guardarDia(clave, ventas),
     cargarImagenes(),   guardarImagen(id, img), borrarImagen(id),
     cargarDato(clave),  guardarDato(clave, valor), borrarDato(clave)
   ========================================================= */


/* ---------- Base de datos del dispositivo (IndexedDB) ---------- */
/* Guarda pares clave → valor. Aguanta mucho más que localStorage,
   así que caben muchas imágenes. */
function abrirBaseLocal() {
  return new Promise((resolver, rechazar) => {
    if (!window.indexedDB) { rechazar(new Error('sin IndexedDB')); return; }
    const pet = indexedDB.open('chrrysdump', 1);
    pet.onupgradeneeded = () => pet.result.createObjectStore('kv');
    pet.onsuccess = () => {
      const db = pet.result;
      const tx = (modo, fn) => new Promise((ok, mal) => {
        const t = db.transaction('kv', modo);
        const r = fn(t.objectStore('kv'));
        t.oncomplete = () => ok(r && r.result);
        t.onerror = t.onabort = () => mal(t.error);
      });
      resolver({
        leer:   (k)    => tx('readonly',  (s) => s.get(k)),
        poner:  (k, v) => tx('readwrite', (s) => { s.put(v, k); }),
        quitar: (k)    => tx('readwrite', (s) => { s.delete(k); }),
        /** Todas las entradas cuya clave empieza con "prefijo" */
        conPrefijo: (prefijo) => new Promise((ok, mal) => {
          const res = {};
          const t = db.transaction('kv', 'readonly');
          const c = t.objectStore('kv').openCursor(IDBKeyRange.bound(prefijo, prefijo + '￿'));
          c.onsuccess = () => {
            const cur = c.result;
            if (cur) { res[cur.key.slice(prefijo.length)] = cur.value; cur.continue(); }
          };
          t.oncomplete = () => ok(res);
          t.onerror = () => mal(t.error);
        }),
      });
    };
    pet.onerror = () => rechazar(pet.error);
  });
}

/* Respaldo por si el dispositivo no tiene IndexedDB: localStorage */
const baseLocalStorage = {
  async leer(k)     { try { return JSON.parse(localStorage.getItem('pos:' + k)); } catch (e) { return null; } },
  async poner(k, v) { localStorage.setItem('pos:' + k, JSON.stringify(v)); },
  async quitar(k)   { try { localStorage.removeItem('pos:' + k); } catch (e) {} },
  async conPrefijo(p) {
    const res = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('pos:' + p)) res[k.slice(4 + p.length)] = await this.leer(k.slice(4));
      }
    } catch (e) {}
    return res;
  },
};

/** Pasa a IndexedDB los datos de versiones anteriores (localStorage)
    si aquí todavía no hay inventario */
async function migrarDesdeLocalStorage(base) {
  try {
    if (await base.leer('inv')) return;                        // ya hay datos nuevos
    if (!(await baseLocalStorage.leer('inv'))) return;          // no hay datos viejos
    const viejos = await baseLocalStorage.conPrefijo('');
    for (const k in viejos) if (viejos[k] != null) await base.poner(k, viejos[k]);
  } catch (e) { /* sin datos viejos */ }
}

async function crearAlmacenLocal() {
  let base;
  try {
    base = await abrirBaseLocal();
    await migrarDesdeLocalStorage(base);
  } catch (e) {
    base = baseLocalStorage;
  }

  // Pide al sistema que no borre los datos aunque falte espacio
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

  const seguro = async (fn) => {
    try { await fn(); } catch (e) { aviso('No hay espacio para guardar'); }
  };

  return {
    modo: 'Guardado en este dispositivo',
    async cargarInventario()        { return (await base.leer('inv')) || []; },
    async guardarInventario(prods)  { await seguro(() => base.poner('inv', copiar(prods))); },
    async cargarDia(clave)          { return (await base.leer('d:' + clave)) || []; },
    async guardarDia(clave, ventas) { await seguro(() => base.poner('d:' + clave, copiar(ventas))); },
    async cargarImagenes()          { return base.conPrefijo('img:'); },
    async guardarImagen(id, img)    { await seguro(() => base.poner('img:' + id, img)); },
    async borrarImagen(id)          { await base.quitar('img:' + id); },
    async cargarDato(clave)         { return base.leer('cfg:' + clave); },
    async guardarDato(clave, valor) { await seguro(() => base.poner('cfg:' + clave, valor)); },
    async borrarDato(clave)         { await base.quitar('cfg:' + clave); },
  };
}


/* ---------- Guardado en la nube (solo en la versión publicada en Claude) ---------- */
async function crearAlmacenNube() {
  if (!window.claude || !claude.use) return null;

  const db = await claude.use('db');
  if (!db) return null;
  const usuario = await claude.use('user');
  const id = usuario && await usuario.id();
  if (!id) return null;

  const base = 'data/users/' + id + '/';                       // carpeta privada del usuario
  const rutaImagenes = base + 'imagenes/items';                // una imagen por documento
  const conLimite = (promesa) => Promise.race([
    promesa,
    new Promise((_, rechazar) => setTimeout(() => rechazar({ code: 'timeout' }), 10000)),
  ]);

  // Cola: una escritura a la vez. cuerpo = null significa "borrar".
  const cola = [];
  let ocupado = false;
  async function escribir(ruta, cuerpo) {
    cola.push([ruta, cuerpo]);
    if (ocupado) return;
    ocupado = true;
    while (cola.length) {
      const [r, c] = cola.shift();
      if (cola.some((x) => x[0] === r)) continue;    // hay una versión más nueva en la cola
      const accion = () => (c === null ? db.doc(r).delete() : db.doc(r).set(c));
      try {
        await accion();
      } catch (e) {
        if (e && e.code === 'unavailable') {
          await new Promise((ok) => setTimeout(ok, 800 + Math.random() * 800));
          try { await accion(); } catch (e2) { fallo(e2); }
        } else fallo(e);
      }
    }
    ocupado = false;
  }
  function fallo(e) {
    aviso(e && e.code === 'quota_exceeded' ? 'Sin espacio para guardar' : 'No se pudo guardar en la nube');
  }
  async function leer(ruta) {
    const s = await conLimite(db.doc(ruta).get());
    return s.exists ? s.data() : null;
  }

  const inv = await conLimite(db.doc(base + 'inventario').get());

  return {
    modo: 'Guardado en tu cuenta',
    async cargarInventario() {
      const d = inv.exists ? inv.data() : null;
      return d && Array.isArray(d.productos) ? copiar(d.productos) : [];
    },
    async guardarInventario(prods) { escribir(base + 'inventario', { productos: prods }); },
    async cargarDia(clave) {
      const d = await leer(base + 'v-' + clave);
      return d && Array.isArray(d.ventas) ? copiar(d.ventas) : [];
    },
    async guardarDia(clave, ventas) { escribir(base + 'v-' + clave, { ventas }); },

    async cargarImagenes() {
      const imgs = {};
      const s = await conLimite(db.collection(rutaImagenes).get());
      s.docs.forEach((d) => { const x = d.data(); if (x && x.src) imgs[d.id] = x.src; });
      return imgs;
    },
    async guardarImagen(pid, img) { escribir(rutaImagenes + '/' + pid, { src: img }); },
    async borrarImagen(pid)       { escribir(rutaImagenes + '/' + pid, null); },

    async cargarDato(clave)         { const d = await leer(base + 'cfg-' + clave); return d ? d.v : null; },
    async guardarDato(clave, valor) { escribir(base + 'cfg-' + clave, { v: valor }); },
    async borrarDato(clave)         { escribir(base + 'cfg-' + clave, null); },
  };
}


/** Elige automáticamente: nube solo dentro de Claude; en cualquier otro lugar, el dispositivo */
async function iniciarAlmacenamiento() {
  try {
    const nube = await crearAlmacenNube();
    if (nube) return nube;
  } catch (e) { /* sin nube: usar el dispositivo */ }
  return crearAlmacenLocal();
}
