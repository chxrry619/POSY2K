/* =========================================================
   UTILIDADES – funciones pequeñas que usa toda la app
   ========================================================= */

/** Selecciona un elemento:  $('#id')  */
const $ = (sel) => document.querySelector(sel);

/** Selecciona varios elementos como arreglo:  $$('.clase')  */
const $$ = (sel) => [...document.querySelectorAll(sel)];

/** Redondea a 2 decimales */
const redondear = (n) => Math.round((+n || 0) * 100) / 100;

/** Formatea un número como dinero:  dinero(18) → "$18.00" */
function dinero(n) {
  return CONFIG.simboloMoneda + redondear(n).toLocaleString(CONFIG.idioma, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Evita que un texto escrito por el usuario rompa el HTML */
function escapar(texto) {
  const mapa = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(texto ?? '').replace(/[&<>"']/g, (c) => mapa[c]);
}

/** Pone un cero adelante:  dos(5) → "05" */
const dos = (n) => String(n).padStart(2, '0');

/** Clave de un día:  2026-11-17 */
const claveDia = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

/** Hora corta:  14:05 */
const horaCorta = (d) => `${dos(d.getHours())}:${dos(d.getMinutes())}`;

/** Genera un id único */
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Copia profunda de datos simples (JSON) */
const copiar = (x) => JSON.parse(JSON.stringify(x));


/* ---------- Avisos y ventanas ---------- */

let _toastTimer;
/** Muestra un aviso flotante unos segundos */
function aviso(mensaje) {
  const t = $('#toast');
  t.textContent = mensaje;
  t.classList.add('on');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('on'), 1800);
}

/** Abre una ventana inferior por su id:  abrirVentana('#cartSheet') */
const abrirVentana = (id) => $(id).classList.add('on');

/** Cierra todas las ventanas inferiores */
const cerrarVentanas = () => $$('.sheet').forEach((s) => s.classList.remove('on'));

let _confirmar = null;
/** Pide confirmación antes de una acción */
function confirmar(titulo, mensaje, alAceptar, textoBoton = 'Sí') {
  $('#cfTitle').textContent = titulo;
  $('#cfMsg').textContent = mensaje;
  $('#cfOk').textContent = textoBoton;
  _confirmar = alAceptar;
  abrirVentana('#confSheet');
}


/* ---------- Imágenes ---------- */

/**
 * Reduce una foto elegida por el usuario (máximo "max" px por lado)
 * y la devuelve como texto JPEG.
 */
function reducirImagen(archivo, max = CONFIG.imagenTamano, calidad = CONFIG.imagenCalidad) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';                       // fondo blanco para PNG transparentes
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolver(c.toDataURL('image/jpeg', calidad));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('Imagen no válida')); };
    img.src = url;
  });
}

/**
 * HTML de la miniatura de un artículo: su imagen, o la inicial
 * de su nombre si no tiene.  tamano: '' | 'xs' | 'lg'
 */
function miniatura(nombre, src, tamano = '') {
  const contenido = src
    ? `<img src="${escapar(src)}" alt="">`
    : escapar((nombre || '?').trim().charAt(0).toUpperCase());
  return `<span class="thumb ${tamano}">${contenido}</span>`;
}


/* ---------- Integración con la app Android ---------- */

/** Copia texto al portapapeles (en la app Android usa el portapapeles del sistema) */
async function copiarTexto(texto) {
  if (window.AndroidApp && AndroidApp.copiar) { AndroidApp.copiar(texto); return; }
  await navigator.clipboard.writeText(texto);
}

/**
 * Botón "atrás" de Android: cierra la ventana abierta.
 * Devuelve true si cerró algo; false para que la app se minimice.
 */
window.alPresionarAtras = function () {
  const abierta = $$('.sheet.on');
  if (abierta.length) { cerrarVentanas(); return true; }
  return false;
};
