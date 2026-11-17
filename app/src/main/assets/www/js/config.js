/* =========================================================
   CONFIGURACIÓN – personaliza aquí sin tocar la lógica
   ========================================================= */
window.CONFIG = {
  // Nombre que aparece en la barra de título de la ventana principal
  nombreTienda: 'ChrrysDump',

  // Título grande de la portada: parte A (blanco) + parte B (celeste)
  tituloA: 'Chrrys',
  tituloB: 'Dump',
  lema: 'Punto de venta',

  // Imágenes de artículos: tamaño máximo (px) y calidad JPEG (0 a 1).
  // Más pequeño = carga más rápido y ocupa menos espacio.
  imagenTamano: 320,
  imagenCalidad: 0.75,

  // Imagen de fondo propia: tamaño máximo (px) y calidad
  fondoTamano: 1280,
  fondoCalidad: 0.72,

  // Moneda (formato de precios)
  idioma: 'es-MX',
  simboloMoneda: '$',

  // Con esta existencia o menos, el artículo se marca "por agotarse"
  stockBajo: 5,

  // Formas de pago (la primera es la predeterminada).
  // "efectivo" es la única que pide "Pago con" y calcula el cambio.
  metodosPago: ['Efectivo', 'Tarjeta', 'Transferencia'],
  metodoEfectivo: 'Efectivo',

  // Botones rápidos de "Pago con" (además de "Exacto")
  billetes: [20, 50, 100, 200, 500],

  // Categoría que se usa si no escribes ninguna
  categoriaPorDefecto: 'General',

};
