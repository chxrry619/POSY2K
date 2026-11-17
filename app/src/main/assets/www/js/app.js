/* =========================================================
   APP – lógica principal del Punto de Venta
   Secciones:
     1. Estado
     2. Navegación
     3. Vender (artículos y carrito)
     4. Cobro
     5. Inventario
     6. Ventas del día
     7. Ajustes (fondo)
     8. Arranque
   ========================================================= */


/* ---------- 1. ESTADO ---------- */
let productos   = [];               // [{id, name, price, cost, stock, cat}]
let ventasPorDia = {};              // { '2026-11-17': [venta, ...] }
let carrito     = {};               // { idProducto: cantidad }
let categoria   = 'Todas';
let diaElegido  = claveDia(new Date());
let almacen     = null;             // se asigna al arrancar
let editando    = null;             // producto que se está editando
let imagenes    = {};               // { idProducto: imagen (texto JPEG) }
let imagenNueva = undefined;        // en el editor: undefined = sin cambio, null = quitar, texto = nueva

const buscarProducto = (id) => productos.find((p) => p.id === id);
const nivelStock = (n) => (n <= 0 ? 'none' : n <= CONFIG.stockBajo ? 'low' : '');


/* ---------- 2. NAVEGACIÓN ---------- */
$$('.tabs .tab').forEach((boton) => {
  boton.onclick = () => {
    const vista = boton.dataset.v;
    $$('.tabs .tab').forEach((b) => b.classList.toggle('on', b === boton));
    $$('.view').forEach((v) => v.classList.toggle('on', v.id === 'v-' + vista));
    $('#ruta').textContent = 'C:\\' + CONFIG.nombreTienda + '\\' + boton.textContent.trim();
    if (vista === 'ventas') pintarDia();
    if (vista === 'inv') pintarInventario();
    actualizarBarraCarrito();
    window.scrollTo(0, 0);
  };
});

$$('[data-close]').forEach((b) => (b.onclick = cerrarVentanas));
$$('.sheet').forEach((s) => s.addEventListener('click', (e) => { if (e.target === s) cerrarVentanas(); }));
$('#cfOk').onclick = () => { cerrarVentanas(); if (_confirmar) _confirmar(); };

// Botón "_" de las ventanas: minimiza / restaura
$$('[data-min]').forEach((b) => (b.onclick = () => b.closest('.win').classList.toggle('min')));


/* ---------- 3. VENDER ---------- */
function listaCategorias() {
  return [...new Set(productos.map((p) => p.cat || CONFIG.categoriaPorDefecto))].sort();
}

function pintarCategorias() {
  const cats = ['Todas', ...listaCategorias()];
  if (!cats.includes(categoria)) categoria = 'Todas';
  $('#cats').innerHTML = cats
    .map((c) => `<button class="chip ${c === categoria ? 'on' : ''}" data-c="${escapar(c)}">${escapar(c)}</button>`)
    .join('');
  $$('#cats .chip').forEach((b) => (b.onclick = () => { categoria = b.dataset.c; pintarCategorias(); pintarProductos(); }));
  $('#catList').innerHTML = listaCategorias().map((c) => `<option value="${escapar(c)}">`).join('');
}

function pintarProductos() {
  const q = $('#q').value.trim().toLowerCase();

  if (!productos.length) {
    $('#prods').innerHTML = `
      <div class="empty full">
        Aún no tienes artículos.<br><br>
        <button class="btn pri" id="goInv">Agregar artículos</button>
      </div>`;
    $('#goInv').onclick = () => $('.tabs .tab[data-v=inv]').click();
    return;
  }

  const lista = productos
    .filter((p) => (categoria === 'Todas' || (p.cat || CONFIG.categoriaPorDefecto) === categoria))
    .filter((p) => !q || p.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!lista.length) {
    $('#prods').innerHTML = '<div class="empty full">Sin resultados</div>';
    return;
  }

  $('#prods').innerHTML = lista.map((p) => {
    const enCarrito = carrito[p.id] || 0;
    const quedan = p.stock - enCarrito;
    return `
      <button class="prod" data-id="${p.id}" ${quedan <= 0 ? 'disabled' : ''}>
        ${enCarrito ? `<span class="badge">${enCarrito}</span>` : ''}
        ${miniatura(p.name, imagenes[p.id])}
        <span class="n">${escapar(p.name)}</span>
        <span class="p">${dinero(p.price)}</span>
        <span class="s ${nivelStock(p.stock)}">${p.stock <= 0 ? 'Agotado' : 'Disponibles: ' + p.stock}</span>
      </button>`;
  }).join('');

  $$('#prods .prod').forEach((b) => (b.onclick = () => agregarAlCarrito(b.dataset.id, 1)));
}
$('#q').oninput = pintarProductos;

function agregarAlCarrito(id, cantidad) {
  const p = buscarProducto(id);
  if (!p) return;
  const actual = carrito[id] || 0;
  const nueva = Math.max(0, Math.min(p.stock, actual + cantidad));
  if (actual + cantidad > p.stock) aviso('Solo hay ' + p.stock + ' disponibles');
  if (nueva) carrito[id] = nueva; else delete carrito[id];

  pintarProductos();
  actualizarBarraCarrito();
  if ($('#cartSheet').classList.contains('on')) pintarCarrito();
}

function totalesCarrito() {
  let piezas = 0, total = 0;
  for (const id in carrito) {
    const p = buscarProducto(id);
    if (!p) continue;
    piezas += carrito[id];
    total += carrito[id] * p.price;
  }
  return { piezas, total: redondear(total) };
}

function actualizarBarraCarrito() {
  const { piezas, total } = totalesCarrito();
  $('#openCart').disabled = !piezas;
  $('#cbCount').textContent = piezas ? `Carrito (${piezas})` : 'Carrito vacío';
  $('#cbTotal').textContent = dinero(total);
}

$('#openCart').onclick = () => { pintarCarrito(); abrirVentana('#cartSheet'); };

function pintarCarrito() {
  const ids = Object.keys(carrito);
  if (!ids.length) { cerrarVentanas(); return; }

  $('#cartLines').innerHTML = ids.map((id) => {
    const p = buscarProducto(id);
    return `
      <div class="line">
        ${miniatura(p.name, imagenes[id], 'xs')}
        <div class="sp">
          <div class="bold">${escapar(p.name)}</div>
          <div class="muted">${dinero(p.price)} c/u · ${dinero(p.price * carrito[id])}</div>
        </div>
        <div class="qty">
          <button data-a="-" data-id="${id}">−</button>
          <input data-id="${id}" type="number" inputmode="numeric" value="${carrito[id]}">
          <button data-a="+" data-id="${id}">+</button>
        </div>
      </div>`;
  }).join('');

  $$('#cartLines button').forEach((b) => (b.onclick = () => agregarAlCarrito(b.dataset.id, b.dataset.a === '+' ? 1 : -1)));
  $$('#cartLines input').forEach((i) => (i.onchange = () => {
    const v = parseInt(i.value) || 0;
    agregarAlCarrito(i.dataset.id, v - (carrito[i.dataset.id] || 0));
  }));

  const { piezas, total } = totalesCarrito();
  $('#ctItems').textContent = piezas;
  $('#ctTotal').textContent = dinero(total);
  pintarBotonesRapidos(total);
  calcularCambio();
}


/* ---------- 4. COBRO ---------- */
$('#method').innerHTML = CONFIG.metodosPago.map((m) => `<option>${escapar(m)}</option>`).join('');
const esEfectivo = () => $('#method').value === CONFIG.metodoEfectivo;

function pintarBotonesRapidos(total) {
  const opciones = [...new Set([total, ...CONFIG.billetes.map((b) => Math.ceil(total / b) * b)])]
    .filter((v) => v >= total)
    .sort((a, b) => a - b)
    .slice(0, 5);
  $('#quick').innerHTML = opciones
    .map((v) => `<button data-v="${v}">${v === total ? 'Exacto' : dinero(v).replace('.00', '')}</button>`)
    .join('');
  $$('#quick button').forEach((b) => (b.onclick = () => { $('#pay').value = b.dataset.v; calcularCambio(); }));
}

function calcularCambio() {
  const { total } = totalesCarrito();
  const pago = parseFloat($('#pay').value);
  const el = $('#change');
  el.className = 'change';
  if (!esEfectivo() || isNaN(pago)) { el.textContent = '—'; return; }
  const cambio = redondear(pago - total);
  el.textContent = cambio < 0 ? 'Faltan ' + dinero(-cambio) : dinero(cambio);
  el.classList.add(cambio < 0 ? 'bad' : 'ok');
}

$('#pay').oninput = calcularCambio;
$('#method').onchange = () => {
  $('#cashBox').hidden = !esEfectivo();
  calcularCambio();
};

$('#clearCart').onclick = () => confirmar('Vaciar carrito', 'Se quitarán todos los artículos del carrito.', () => {
  carrito = {};
  $('#pay').value = '';
  pintarProductos();
  actualizarBarraCarrito();
}, 'Vaciar');

$('#checkout').onclick = async () => {
  const { piezas, total } = totalesCarrito();
  if (!piezas) return;

  const metodo = $('#method').value;
  const pago = parseFloat($('#pay').value);
  if (esEfectivo() && !isNaN(pago) && pago < total) { aviso('El pago no cubre el total'); return; }

  const ahora = new Date();
  const dia = claveDia(ahora);
  const venta = {
    id: nuevoId(),
    t: ahora.toISOString(),
    method: metodo,
    total,
    pago: esEfectivo() && !isNaN(pago) ? pago : total,
    items: Object.keys(carrito).map((id) => {
      const p = buscarProducto(id);
      return { id, name: p.name, price: p.price, cost: p.cost || 0, qty: carrito[id] };
    }),
  };

  // Descontar del inventario
  venta.items.forEach((it) => {
    const p = buscarProducto(it.id);
    p.stock = Math.max(0, p.stock - it.qty);
  });

  // Registrar la venta en su día
  if (!ventasPorDia[dia]) ventasPorDia[dia] = await almacen.cargarDia(dia).catch(() => []);
  ventasPorDia[dia].push(venta);
  almacen.guardarInventario(productos);
  almacen.guardarDia(dia, ventasPorDia[dia]);

  const cambio = venta.pago - total;
  carrito = {};
  $('#pay').value = '';
  cerrarVentanas();
  pintarProductos();
  actualizarBarraCarrito();
  aviso('Venta registrada: ' + dinero(total) + (esEfectivo() && cambio > 0 ? ' · Cambio ' + dinero(cambio) : ''));
};


/* ---------- 5. INVENTARIO ---------- */
function pintarInventario() {
  const q = $('#qi').value.trim().toLowerCase();
  const lista = productos
    .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.cat || '').toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  const unidades = productos.reduce((s, p) => s + p.stock, 0);
  const valor = productos.reduce((s, p) => s + p.stock * p.price, 0);
  const bajos = productos.filter((p) => p.stock <= CONFIG.stockBajo).length;

  $('#invStats').innerHTML = `
    <div class="stat"><div class="v">${productos.length}</div><div class="l">Artículos</div></div>
    <div class="stat"><div class="v">${unidades}</div><div class="l">Unidades</div></div>
    <div class="stat"><div class="v ${bajos ? 'low' : ''}">${bajos}</div><div class="l">Por agotarse (≤${CONFIG.stockBajo})</div></div>`;

  if (!lista.length) {
    $('#invList').innerHTML = `<div class="empty">${productos.length ? 'Sin resultados' : 'Agrega tu primer artículo con “+ Nuevo”.'}</div>`;
    return;
  }

  $('#invList').innerHTML = lista.map((p) => `
    <div class="invrow">
      ${miniatura(p.name, imagenes[p.id], 'xs')}
      <div class="sp">
        <div class="bold">${escapar(p.name)}</div>
        <div class="muted">${escapar(p.cat || CONFIG.categoriaPorDefecto)} · ${dinero(p.price)}</div>
      </div>
      <div class="right">
        <div class="stock ${nivelStock(p.stock)}">${p.stock}</div>
        <div class="muted">exist.</div>
      </div>
      <button class="btn ghost" data-edit="${p.id}">Editar</button>
    </div>`).join('')
    + `<p class="muted note">Valor del inventario a precio de venta: <b>${dinero(valor)}</b></p>`;

  $$('[data-edit]').forEach((b) => (b.onclick = () => abrirEditor(b.dataset.edit)));
}
$('#qi').oninput = pintarInventario;

function abrirEditor(id) {
  editando = id ? buscarProducto(id) : null;
  $('#psTitle').textContent = editando ? 'Editar artículo' : 'Nuevo artículo';
  $('#pName').value  = editando ? editando.name : '';
  $('#pPrice').value = editando ? editando.price : '';
  $('#pCost').value  = editando && editando.cost ? editando.cost : '';
  $('#pStock').value = editando ? editando.stock : '';
  $('#pCat').value   = editando ? (editando.cat || '') : (categoria !== 'Todas' ? categoria : '');
  $('#pDel').hidden  = !editando;
  imagenNueva = undefined;
  $('#pImgFile').value = '';
  pintarImagenEditor();
  abrirVentana('#prodSheet');
  setTimeout(() => $('#pName').focus(), 50);
}
$('#addProd').onclick = () => abrirEditor(null);

/* Imagen del artículo (opcional) */
function imagenEnEditor() {
  if (imagenNueva !== undefined) return imagenNueva;
  return editando ? imagenes[editando.id] || null : null;
}
function pintarImagenEditor() {
  const src = imagenEnEditor();
  $('#pImgPrev').outerHTML = miniatura($('#pName').value || '?', src, 'lg').replace('<span class="thumb', '<span id="pImgPrev" class="thumb');
  $('#pImgDel').hidden = !src;
}
$('#pImgFile').onchange = async () => {
  const archivo = $('#pImgFile').files[0];
  if (!archivo) return;
  try {
    imagenNueva = await reducirImagen(archivo);
    pintarImagenEditor();
  } catch (e) {
    aviso('No se pudo leer la imagen');
  }
};
$('#pImgDel').onclick = () => { imagenNueva = null; $('#pImgFile').value = ''; pintarImagenEditor(); };
$('#pName').addEventListener('input', () => { if (!imagenEnEditor()) pintarImagenEditor(); });

$('#pSave').onclick = () => {
  const name  = $('#pName').value.trim();
  const price = parseFloat($('#pPrice').value);
  const stock = parseInt($('#pStock').value);
  const cost  = parseFloat($('#pCost').value);
  if (!name) { aviso('Escribe el nombre'); return; }
  if (isNaN(price) || price < 0) { aviso('Precio inválido'); return; }

  const datos = {
    name,
    price: redondear(price),
    stock: isNaN(stock) ? 0 : Math.max(0, stock),
    cost: isNaN(cost) ? 0 : cost,
    cat: $('#pCat').value.trim() || CONFIG.categoriaPorDefecto,
  };
  let producto = editando;
  if (producto) Object.assign(producto, datos);
  else { producto = { id: nuevoId(), ...datos }; productos.push(producto); }

  // Guardar o quitar la imagen solo si cambió
  if (typeof imagenNueva === 'string') {
    imagenes[producto.id] = imagenNueva;
    almacen.guardarImagen(producto.id, imagenNueva);
  } else if (imagenNueva === null && imagenes[producto.id]) {
    delete imagenes[producto.id];
    almacen.borrarImagen(producto.id);
  }

  almacen.guardarInventario(productos);
  cerrarVentanas();
  refrescarTodo();
  aviso('Guardado');
};

$('#pDel').onclick = () => {
  const p = editando;
  confirmar('Eliminar artículo', `¿Eliminar “${p.name}”? Las ventas ya registradas se conservan.`, () => {
    productos = productos.filter((x) => x !== p);
    delete carrito[p.id];
    if (imagenes[p.id]) { delete imagenes[p.id]; almacen.borrarImagen(p.id); }
    almacen.guardarInventario(productos);
    refrescarTodo();
    aviso('Eliminado');
  }, 'Eliminar');
};



/* ---------- 6. VENTAS DEL DÍA ---------- */
function resumirArticulos(ventas) {
  const resumen = {};
  ventas.forEach((v) => v.items.forEach((i) => {
    const r = resumen[i.name] || (resumen[i.name] = { q: 0, t: 0 });
    r.q += i.qty;
    r.t += i.qty * i.price;
  }));
  return Object.entries(resumen).sort((a, b) => b[1].t - a[1].t);
}

function totalPorMetodo(ventas) {
  const r = {};
  ventas.forEach((v) => (r[v.method] = (r[v.method] || 0) + v.total));
  return r;
}

async function pintarDia() {
  $('#dSel').value = diaElegido;
  if (!ventasPorDia[diaElegido]) {
    $('#dayStats').innerHTML = '<div class="muted">Cargando…</div>';
    try { ventasPorDia[diaElegido] = await almacen.cargarDia(diaElegido); }
    catch (e) { ventasPorDia[diaElegido] = []; aviso('No se pudieron leer las ventas'); }
  }
  const ventas = ventasPorDia[diaElegido] || [];
  const total = ventas.reduce((a, v) => a + v.total, 0);
  const piezas = ventas.reduce((a, v) => a + v.items.reduce((b, i) => b + i.qty, 0), 0);
  const porMetodo = totalPorMetodo(ventas);

  $('#dayStats').innerHTML = `
    <div class="stat"><div class="v">${dinero(total)}</div><div class="l">Total vendido</div></div>
    <div class="stat"><div class="v">${ventas.length}</div><div class="l">Ventas</div></div>
    <div class="stat"><div class="v">${piezas}</div><div class="l">Unidades</div></div>`
    + (Object.keys(porMetodo).length
      ? `<div class="muted full">${Object.entries(porMetodo).map(([m, v]) => `${escapar(m)}: <b>${dinero(v)}</b>`).join(' · ')}</div>`
      : '');

  const filas = resumirArticulos(ventas);
  $('#dayItems').innerHTML = filas.length
    ? filas.map(([n, r]) => `
        <div class="line">
          <span class="sp">${escapar(n)}</span>
          <span class="muted">×${r.q}</span>
          <span class="amount">${dinero(r.t)}</span>
        </div>`).join('')
    : '<div class="muted">Sin ventas este día.</div>';

  $('#dayTickets').innerHTML = ventas.length
    ? ventas.slice().reverse().map((v, i) => `
        <div class="ticket">
          <div class="row">
            <b class="sp">#${ventas.length - i} · ${horaCorta(new Date(v.t))}</b>
            <span class="muted">${escapar(v.method)}</span>
            <b>${dinero(v.total)}</b>
          </div>
          <div class="muted">${v.items.map((it) => escapar(it.name) + ' ×' + it.qty).join(', ')}</div>
          <div class="row mt">
            <span class="sp"></span>
            <button class="btn bad sm" data-cancel="${v.id}">Cancelar venta</button>
          </div>
        </div>`).join('')
    : '<div class="muted">Aún no hay tickets.</div>';

  $$('[data-cancel]').forEach((b) => (b.onclick = () => cancelarVenta(b.dataset.cancel)));
}

function cancelarVenta(id) {
  const ventas = ventasPorDia[diaElegido];
  const v = ventas.find((x) => x.id === id);
  if (!v) return;
  confirmar('Cancelar venta', `Se eliminará la venta de ${dinero(v.total)} y las piezas regresarán al inventario.`, () => {
    v.items.forEach((i) => { const p = buscarProducto(i.id); if (p) p.stock += i.qty; });
    ventasPorDia[diaElegido] = ventas.filter((x) => x !== v);
    almacen.guardarDia(diaElegido, ventasPorDia[diaElegido]);
    almacen.guardarInventario(productos);
    refrescarTodo();
    pintarDia();
    aviso('Venta cancelada');
  }, 'Cancelar venta');
}

function moverDia(n) {
  const d = new Date(diaElegido + 'T12:00:00');
  d.setDate(d.getDate() + n);
  diaElegido = claveDia(d);
  pintarDia();
}
$('#dPrev').onclick = () => moverDia(-1);
$('#dNext').onclick = () => moverDia(1);
$('#dSel').onchange = () => { if ($('#dSel').value) { diaElegido = $('#dSel').value; pintarDia(); } };

$('#copyRep').onclick = async () => {
  const ventas = ventasPorDia[diaElegido] || [];
  const total = ventas.reduce((a, v) => a + v.total, 0);
  const texto =
    `CORTE DEL DÍA ${diaElegido}\n` +
    `Ventas: ${ventas.length}\n` +
    `Total: ${dinero(total)}\n` +
    Object.entries(totalPorMetodo(ventas)).map(([m, v]) => `  ${m}: ${dinero(v)}`).join('\n') +
    `\n\nArtículos:\n` +
    resumirArticulos(ventas).map(([n, r]) => `  ${n} x${r.q} = ${dinero(r.t)}`).join('\n');
  try { await copiarTexto(texto); aviso('Corte copiado'); }
  catch (e) { aviso('No se pudo copiar'); }
};


/* ---------- 7. AJUSTES (FONDO) ---------- */
/* ajustes = { fondo: 'retro' | 'imagen', oscuro: 0-90, deco: true/false } */
let ajustes = { fondo: 'retro', oscuro: 60, deco: true };
let imagenFondo = null;          // imagen propia (texto JPEG) o null

function aplicarFondo() {
  const usarImagen = ajustes.fondo === 'imagen' && imagenFondo;
  const cuerpo = document.body;
  cuerpo.classList.toggle('fondo-retro', !usarImagen);
  cuerpo.classList.toggle('fondo-imagen', !!usarImagen);
  cuerpo.classList.toggle('sin-deco', !ajustes.deco);
  cuerpo.style.setProperty('--fondo-img', imagenFondo ? `url("${imagenFondo}")` : 'none');
  cuerpo.style.setProperty('--fondo-oscuro', ajustes.oscuro / 100);
}

function pintarAjustes() {
  $$('.opcion').forEach((b) => b.classList.toggle('on', b.dataset.fondo === (ajustes.fondo === 'imagen' && imagenFondo ? 'imagen' : 'retro')));
  const prev = $('#fondoPrev');
  prev.style.backgroundImage = imagenFondo ? `url("${imagenFondo}")` : '';
  prev.innerHTML = imagenFondo ? '' : '<span class="muted">Sin imagen</span>';
  $('#fondoDel').hidden = !imagenFondo;
  $('#oscurecerBox').hidden = !imagenFondo;
  $('#fondoOscuro').value = ajustes.oscuro;
  $('#fondoOscuroVal').textContent = ajustes.oscuro + '%';
  $('#fondoDeco').checked = ajustes.deco;
}

function guardarAjustes() {
  almacen.guardarDato('ajustes', { ...ajustes });
  aplicarFondo();
  pintarAjustes();
}

$$('.opcion').forEach((b) => (b.onclick = () => {
  if (b.dataset.fondo === 'imagen' && !imagenFondo) { $('#fondoFile').click(); return; }
  ajustes.fondo = b.dataset.fondo;
  guardarAjustes();
}));

$('#fondoFile').onchange = async () => {
  const archivo = $('#fondoFile').files[0];
  $('#fondoFile').value = '';
  if (!archivo) return;
  try {
    // Se reduce hasta que pese menos de ~230 KB
    let calidad = CONFIG.fondoCalidad, img = await reducirImagen(archivo, CONFIG.fondoTamano, calidad);
    while (img.length > 230000 && calidad > 0.35) {
      calidad -= 0.1;
      img = await reducirImagen(archivo, CONFIG.fondoTamano, calidad);
    }
    imagenFondo = img;
    almacen.guardarDato('fondo', img);
    ajustes.fondo = 'imagen';
    guardarAjustes();
    aviso('Fondo actualizado');
  } catch (e) {
    aviso('No se pudo leer la imagen');
  }
};

$('#fondoDel').onclick = () => confirmar('Quitar imagen de fondo', 'Se volverá a usar el fondo retro.', () => {
  imagenFondo = null;
  almacen.borrarDato('fondo');
  ajustes.fondo = 'retro';
  guardarAjustes();
}, 'Quitar');

$('#fondoOscuro').oninput = () => {
  ajustes.oscuro = +$('#fondoOscuro').value;
  $('#fondoOscuroVal').textContent = ajustes.oscuro + '%';
  aplicarFondo();
};
$('#fondoOscuro').onchange = guardarAjustes;     // se guarda al soltar
$('#fondoDeco').onchange = () => { ajustes.deco = $('#fondoDeco').checked; guardarAjustes(); };


/* ---------- 8. ARRANQUE ---------- */
function refrescarTodo() {
  pintarCategorias();
  pintarProductos();
  pintarInventario();
  actualizarBarraCarrito();
}

// Reloj de la barra de tareas
function actualizarReloj() { $('#clock').textContent = horaCorta(new Date()); }
actualizarReloj();
setInterval(actualizarReloj, 15000);

(async () => {
  $('#appTitle').textContent = CONFIG.nombreTienda;
  $('#heroA').textContent = CONFIG.tituloA;
  $('#heroB').textContent = CONFIG.tituloB;
  $('#heroSub').textContent = CONFIG.lema;
  $('#ruta').textContent = 'C:\\' + CONFIG.nombreTienda + '\\Vender';
  $('#prods').innerHTML = '<div class="empty full">Cargando…</div>';
  actualizarBarraCarrito();

  almacen = await iniciarAlmacenamiento();
  try { productos = await almacen.cargarInventario(); } catch (e) { productos = []; }
  $('#sync').textContent = almacen.modo;
  refrescarTodo();

  // Ajustes y fondo
  try { ajustes = { ...ajustes, ...((await almacen.cargarDato('ajustes')) || {}) }; } catch (e) {}
  try { imagenFondo = (await almacen.cargarDato('fondo')) || null; } catch (e) {}
  aplicarFondo();
  pintarAjustes();

  // Las imágenes llegan después, para no retrasar el inicio
  try { imagenes = await almacen.cargarImagenes(); } catch (e) { imagenes = {}; }
  refrescarTodo();
})();
