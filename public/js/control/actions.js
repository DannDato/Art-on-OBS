// Eventos de sockets
socket.on('connect', () => {
  document.getElementById('status').classList.remove('off');
});

socket.on('disconnect', () => {
  document.getElementById('status').classList.add('off');
});

socket.on('obj-add', (d) => {
  const payload = normalizeLayerPayload(d);

  if (d.tipo === 'imagen') {
    const img = new Image();
    img.src = payload.url;
    img.onload = () => {
      payload._img = img;
      objetos[payload.id] = payload;
      if (payload.hidden && selId === payload.id) selId = null;
      if (isDrawLayer(payload) && !activeDrawLayerId) activeDrawLayerId = payload.id;
      renderLayersPanel();
      redraw();
    };
  } else {
    objetos[payload.id] = payload;
    if (payload.hidden && selId === payload.id) selId = null;
    if (isDrawLayer(payload) && !activeDrawLayerId) activeDrawLayerId = payload.id;
    renderLayersPanel();
    redraw();
  }
});

socket.on('obj-move', ({ id, x, y }) => {
  if (objetos[id]) {
    objetos[id].x = x;
    objetos[id].y = y;
    renderLayersPanel();
    redraw();
  }
});

socket.on('obj-resize', ({ id, x, y, w, h }) => {
  if (objetos[id]) {
    Object.assign(objetos[id], { x, y, w, h });
    renderLayersPanel();
    redraw();
  }
});

socket.on('obj-remove', ({ id }) => {
  delete objetos[id];
  if (selId === id) selId = null;
  ensureDefaultDrawLayer();
  renderLayersPanel();
  redraw();
});

socket.on('limpiar-todo', () => {
  objetos = {};
  selId = null;
  ensureDefaultDrawLayer();
  renderLayersPanel();
  redraw();
});

function nextLayerOrdinal(prefix) {
  const regex = new RegExp(`^${prefix}\\s+(\\d+)$`);
  let max = 0;
  Object.values(objetos).forEach((obj) => {
    if (!obj.layerName) return;
    const m = obj.layerName.match(regex);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return max + 1;
}

function getMaxLayerZIndex() {
  const values = Object.values(objetos).map((o) => (typeof o.zIndex === 'number' ? o.zIndex : -1));
  return values.length ? Math.max(...values) : -1;
}

function normalizeLayerPayload(payload) {
  const normalized = { ...payload };
  if (typeof normalized.hidden !== 'boolean') normalized.hidden = false;
  if (typeof normalized.zIndex !== 'number') normalized.zIndex = getMaxLayerZIndex() + 1;
  return normalized;
}

function getFileLayerName(file) {
  if (!file || typeof file.name !== 'string') return '';
  return file.name.trim();
}

function getTextLayerName(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/\s+/g, ' ').trim();
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildDrawLayer(id = `draw_layer_${Date.now()}`) {
  return {
    id,
    tipo: 'trazo',
    x: 0,
    y: 0,
    w: OVERLAY_W,
    h: OVERLAY_H,
    lineas: [],
    compuesto: true,
    hidden: false,
    zIndex: getMaxLayerZIndex() + 1,
    layerName: `DIBUJO ${nextLayerOrdinal('DIBUJO')}`
  };
}

function ensureDefaultDrawLayer() {
  const drawLayers = Object.values(objetos).filter((obj) => isDrawLayer(obj));
  if (drawLayers.length > 0) {
    if (!objetos[activeDrawLayerId] || !isDrawLayer(objetos[activeDrawLayerId])) {
      activeDrawLayerId = drawLayers[0].id;
    }
    return;
  }

  const defaultLayer = buildDrawLayer(DRAW_LAYER_ID);
  defaultLayer.layerName = 'DIBUJO 1';
  activeDrawLayerId = defaultLayer.id;
  objetos[defaultLayer.id] = defaultLayer;
  socket.emit('obj-add', defaultLayer);
}

function getLayerItems() {
  return Object.entries(objetos)
    .filter(([, obj]) => obj.tipo === 'imagen' || obj.tipo === 'texto' || isDrawLayer(obj))
    .map(([id, obj], idx) => {
      const fallbackName = obj.tipo === 'imagen'
        ? (obj.fileName || `IMAGEN ${idx + 1}`)
        : obj.tipo === 'texto'
          ? (getTextLayerName(obj.texto) || `TEXTO ${idx + 1}`)
          : `DIBUJO ${idx + 1}`;

      return {
        id,
        tipo: obj.tipo,
        zIndex: typeof obj.zIndex === 'number' ? obj.zIndex : 0,
        hidden: !!obj.hidden,
        name: obj.layerName || fallbackName,
        isDraw: isDrawLayer(obj)
      };
    })
    .sort((a, b) => b.zIndex - a.zIndex);
}

function renderLayersPanel() {
  const root = document.getElementById('layers-list');
  if (!root) return;

  const items = getLayerItems();
  if (items.length === 0) {
    root.innerHTML = '<div class="layers-empty">Sin capas</div>';
    return;
  }

  root.innerHTML = items.map((layer, index) => {
    const layerType = layer.isDraw ? 'DRAWING' : layer.tipo.toUpperCase();
    const layerIcon = layer.isDraw ? '✎' : layer.tipo === 'texto' ? 'T' : '▦';
    const layerIndex = String(items.length - index).padStart(2, '0');

    return `
      <div class="layer-item ${selId === layer.id ? 'is-selected' : ''} ${layer.hidden ? 'is-hidden' : ''}" data-layer-id="${layer.id}" draggable="true">
        <div class="layer-grip" title="Arrastrar para reordenar">⋮⋮</div>
        <div class="layer-type-icon ${layer.isDraw ? 'is-draw' : layer.tipo === 'texto' ? 'is-text' : 'is-image'}" aria-hidden="true">${layerIcon}</div>
        <div class="layer-meta">
          <div class="layer-topline">
            <span class="layer-index">LAYER ${layerIndex}</span>
            <span class="layer-type">${layerType}</span>
          </div>
          <div class="layer-name" title="${escapeHtml(layer.name)}">${escapeHtml(layer.name)}</div>
        </div>
        <div class="layer-actions">
          <button class="layer-btn" data-action="toggle" data-layer-id="${layer.id}" title="Mostrar/Ocultar">${layer.hidden ? '◌' : '◉'}</button>
          <button class="layer-btn danger" data-action="delete" data-layer-id="${layer.id}" title="Eliminar">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

function selectLayer(layerId) {
  if (!objetos[layerId]) return;
  selId = layerId;
  if (herramienta !== 'select') setTool('select');
  if (isDrawLayer(objetos[layerId])) {
    activeDrawLayerId = layerId;
  }
  document.getElementById('props-select').style.display = '';
  renderLayersPanel();
  redraw();
}

function toggleLayer(layerId) {
  const obj = objetos[layerId];
  if (!obj) return;
  const { _img, ...payload } = obj;
  socket.emit('obj-add', { ...payload, hidden: !obj.hidden });
}

function confirmarAccion({
  title = 'Confirmar accion',
  message = 'Seguro que deseas continuar?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar'
} = {}) {
  return new Promise((resolve) => {
    const backdrop = document.getElementById('confirm-backdrop');
    const titleEl = document.getElementById('confirm-title');
    const messageEl = document.getElementById('confirm-message');
    const cancelBtn = document.getElementById('confirm-cancel');
    const acceptBtn = document.getElementById('confirm-accept');

    if (!backdrop || !titleEl || !messageEl || !cancelBtn || !acceptBtn) {
      resolve(true);
      return;
    }

    const prevActive = document.activeElement;
    titleEl.textContent = title;
    messageEl.textContent = message;
    cancelBtn.textContent = cancelText;
    acceptBtn.textContent = confirmText;
    backdrop.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('show');

    const cleanup = (value) => {
      backdrop.classList.remove('show');
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.removeEventListener('click', onBackdropClick);
      document.removeEventListener('keydown', onKeyDown);
      cancelBtn.removeEventListener('click', onCancel);
      acceptBtn.removeEventListener('click', onAccept);
      if (prevActive && typeof prevActive.focus === 'function') prevActive.focus();
      resolve(value);
    };

    const onCancel = () => cleanup(false);
    const onAccept = () => cleanup(true);
    const onBackdropClick = (e) => {
      if (e.target === backdrop) cleanup(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') cleanup(false);
      if (e.key === 'Enter') cleanup(true);
    };

    cancelBtn.addEventListener('click', onCancel);
    acceptBtn.addEventListener('click', onAccept);
    backdrop.addEventListener('click', onBackdropClick);
    document.addEventListener('keydown', onKeyDown);
    setTimeout(() => acceptBtn.focus(), 0);
  });
}

async function deleteLayer(layerId) {
  const obj = objetos[layerId];
  if (!obj) return 'cancelled';

  if (isDrawLayer(obj)) {
    const drawLayers = Object.values(objetos).filter((o) => isDrawLayer(o));
    if (drawLayers.length <= 1) {
      const { _img, ...payload } = obj;
      socket.emit('obj-add', { ...payload, lineas: [], hidden: false });
      return 'cleared';
    }
  }

  const confirmed = await confirmarAccion({
    title: 'Eliminar capa',
    message: 'Seguro que quieres eliminar esto? Esta accion no se puede deshacer.',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar'
  });
  if (!confirmed) return 'cancelled';

  socket.emit('obj-remove', { id: layerId, url: obj.url, tipo: obj.tipo });
  if (activeDrawLayerId === layerId) {
    const nextDraw = Object.values(objetos).find((o) => isDrawLayer(o) && o.id !== layerId);
    if (nextDraw) activeDrawLayerId = nextDraw.id;
  }
  return 'deleted';
}

function crearNuevaCapaDibujo() {
  const layer = buildDrawLayer();
  activeDrawLayerId = layer.id;
  objetos[layer.id] = layer;
  selId = layer.id;
  socket.emit('obj-add', layer);
  toast('🧩 Nueva capa de dibujo creada');
  renderLayersPanel();
  redraw();
}

let draggingLayerId = null;

function reorderLayers(draggedId, targetId) {
  if (!draggedId || !targetId || draggedId === targetId) return;

  const orderedTop = getLayerItems().map((l) => l.id);
  const from = orderedTop.indexOf(draggedId);
  const to = orderedTop.indexOf(targetId);
  if (from < 0 || to < 0) return;

  orderedTop.splice(from, 1);
  orderedTop.splice(to, 0, draggedId);

  const total = orderedTop.length;
  orderedTop.forEach((id, index) => {
    const obj = objetos[id];
    if (!obj) return;
    const nextZ = total - index;
    if (obj.zIndex === nextZ) return;
    const { _img, ...payload } = obj;
    socket.emit('obj-add', { ...payload, zIndex: nextZ });
  });
}

function subirCapaSeleccionadaUnNivel() {
  if (!selId || !objetos[selId]) return;

  const orderedTop = getLayerItems().map((l) => l.id);
  const from = orderedTop.indexOf(selId);
  if (from <= 0) return;

  const targetId = orderedTop[from - 1];
  reorderLayers(selId, targetId);
  toast('⬆️ Capa subida');
}

function setTool(t) {
  herramienta = t;
  document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('activo'));
  const btn = document.getElementById('tool-' + t);
  if (btn) btn.classList.add('activo');
  canvas.className = 'tool-' + t;

  document.getElementById('props-draw').style.display = (t === 'draw' || t === 'eraser') ? '' : 'none';
  document.getElementById('props-text').style.display = t === 'text' ? '' : 'none';
  document.getElementById('props-select').style.display = (t === 'select' && selId) ? '' : 'none';

  if (t !== 'select') deseleccionar();
  cerrarTextInput();
  renderLayersPanel();
}

function guardarEstadoHistorial() {
  const copiaEstado = JSON.parse(JSON.stringify(objetos));
  historialUndo.push(copiaEstado);
  if (historialUndo.length > MAX_PASOS_HISTORIAL) {
    historialUndo.shift();
  }
}

function deshacerUltimaAccion() {
  if (historialUndo.length === 0) {
    toast('⚠️ Nada que deshacer');
    return;
  }

  const estadoAnterior = historialUndo.pop();
  socket.emit('limpiar-todo');
  objetos = {};

  for (const [, obj] of Object.entries(estadoAnterior)) {
    socket.emit('obj-add', obj);
  }

  deseleccionar();
  toast('↩️ Deshecho');
  redraw();
}

function abrirTextInput(ox, oy, cx, cy) {
  const r = canvas.getBoundingClientRect();
  const s = canvasScale();
  textPos = { x: ox, y: oy };

  textEl.style.display = 'block';
  textEl.style.left = (cx - r.left) + 'px';
  textEl.style.top = (cy - r.top) + 'px';
  textEl.style.fontSize = (parseInt(document.getElementById('text-size').value, 10) * s) + 'px';
  textEl.style.color = document.getElementById('text-color').value;
  textEl.value = '';

  setTimeout(() => {
    textEl.focus();
  }, 50);
}

function cerrarTextInput() {
  textEl.style.display = 'none';
  textEl.value = '';
  textPos = null;
}

function seleccionarTodo() {
  const listaObjetos = Object.values(objetos);
  if (listaObjetos.length === 0) return;

  const capturados = listaObjetos.filter((obj) => obj.tipo !== 'grupo' && !isDrawLayer(obj));

  if (capturados.length === 1) {
    selId = capturados[0].id;
    document.getElementById('props-select').style.display = '';
    toast('✨ Objeto seleccionado');
  } else if (capturados.length > 1) {
    const gMinX = Math.min(...capturados.map((o) => o.x));
    const gMaxX = Math.max(...capturados.map((o) => o.x + o.w));
    const gMinY = Math.min(...capturados.map((o) => o.y));
    const gMaxY = Math.max(...capturados.map((o) => o.y + o.h));

    const grupoId = 'group_' + Date.now();
    socket.emit('obj-add', {
      id: grupoId,
      tipo: 'grupo',
      x: gMinX,
      y: gMinY,
      w: gMaxX - gMinX,
      h: gMaxY - gMinY,
      hijos: capturados
    });

    selId = grupoId;
    document.getElementById('props-select').style.display = '';
    toast(`✨ ${capturados.length} objetos agrupados y seleccionados`);
  }

  renderLayersPanel();
  redraw();
}

function deseleccionar() {
  selId = null;
  document.getElementById('props-select').style.display = 'none';
  renderLayersPanel();
  redraw();
}

async function eliminarSeleccionado() {
  if (!selId) return;
  guardarEstadoHistorial();

  const obj = objetos[selId];
  if (obj.tipo === 'grupo' && obj.hijos) {
    obj.hijos.forEach((hijo) => {
      socket.emit('obj-remove', { id: hijo.id, url: hijo.url, tipo: hijo.tipo });
    });
  }

  const result = await deleteLayer(selId);
  if (result === 'deleted') toast('🗑️ Capa eliminada');
  if (result === 'cleared') toast('🧹 Ultima capa de dibujo vaciada');
}

function limpiarDibujo() {
  guardarEstadoHistorial();
  for (const id in objetos) {
    if (objetos[id].tipo === 'trazo') {
      socket.emit('obj-remove', { id });
    }
  }
  toast('🧹 Trazos limpiados');
}

async function limpiarTodo() {
  const confirmed = await confirmarAccion({
    title: 'Limpiar overlay',
    message: 'Seguro que quieres limpiar TODO el overlay? Esta accion no se puede deshacer.',
    confirmText: 'Limpiar',
    cancelText: 'Cancelar'
  });
  if (!confirmed) return;
  socket.emit('limpiar-todo');
  toast('🧨 Overlay limpiado');
}

function cambiarGuia(nombreArchivo) {
  const guideEl = document.getElementById('canvas-overlay');
  document.querySelectorAll('.guide-btn').forEach((b) => b.classList.remove('activo'));

  if (nombreArchivo === 'none') {
    guideEl.style.display = 'none';
    guideEl.src = '';
    document.getElementById('guide-none').classList.add('activo');
  } else {
    guideEl.src = 'img/' + nombreArchivo;
    guideEl.style.display = 'block';

    if (nombreArchivo === 'canva-guide.png') document.getElementById('guide-1').classList.add('activo');
    if (nombreArchivo === 'canva-guide2.png') document.getElementById('guide-2').classList.add('activo');
    if (nombreArchivo === 'canva-guide3.png') document.getElementById('guide-3').classList.add('activo');
  }

  fitCanvas();
}

function triggerUpload() {
  document.getElementById('file-input').click();
}

async function subirImagen(file) {
  const form = new FormData();
  form.append('imagen', file);

  const res = await fetch('/upload', { method: 'POST', body: form });
  const data = await res.json();
  if (!data.ok) return;

  const id = 'img_' + Date.now();
  const url = data.url;
  const fileLayerName = getFileLayerName(file);
  socket.emit('obj-add', {
    id,
    tipo: 'imagen',
    url,
    fileName: fileLayerName,
    x: 200,
    y: 200,
    w: 400,
    h: 300,
    zIndex: getMaxLayerZIndex() + 1,
    hidden: false,
    layerName: fileLayerName || `IMAGEN ${nextLayerOrdinal('IMAGEN')}`
  });
  toast('🖼️ Imagen enviada');
  setTool('select');
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function onDown(e) {
  const pos = toOverlay(e.clientX, e.clientY);

  if (herramienta === 'draw' || herramienta === 'eraser') {
    pintando = true;
    lastX = pos.x;
    lastY = pos.y;
    trazoActualLineas = [];
    trazoMinX = pos.x;
    trazoMaxX = pos.x;
    trazoMinY = pos.y;
    trazoMaxY = pos.y;
    return;
  }

  if (herramienta === 'select') {
    if (selId && objetos[selId] && !isDrawLayer(objetos[selId])) {
      const obj = objetos[selId];
      if (
        pos.x >= obj.x + obj.w - 10 && pos.x <= obj.x + obj.w + 10 &&
        pos.y >= obj.y + obj.h - 10 && pos.y <= obj.y + obj.h + 10
      ) {
        guardarEstadoHistorial();
        resizing = true;
        resizeStartX = pos.x;
        resizeStartY = pos.y;
        resizeStartW = obj.w;
        resizeStartH = obj.h;
        resizeStartOX = obj.x;
        resizeStartOY = obj.y;
        return;
      }
    }

    const hit = hitTest(pos.x, pos.y);
    if (hit) {
      guardarEstadoHistorial();
      selId = hit;
      if (isDrawLayer(objetos[hit])) activeDrawLayerId = hit;
      dragging = true;
      dragOffX = pos.x - objetos[hit].x;
      dragOffY = pos.y - objetos[hit].y;
      document.getElementById('props-select').style.display = '';
      renderLayersPanel();
    } else {
      deseleccionar();
      selectingArea = true;
      selAreaStart = { x: pos.x, y: pos.y };
      selAreaEnd = { x: pos.x, y: pos.y };
    }
    redraw();
    return;
  }

  if (herramienta === 'text') {
    abrirTextInput(pos.x, pos.y, e.clientX, e.clientY);
  }
}

function onMove(e) {
  const pos = toOverlay(e.clientX, e.clientY);

  if (pintando) {
    const color = herramienta === 'eraser' ? '#000' : document.getElementById('draw-color').value;
    const grosor = parseInt(document.getElementById('draw-size').value, 10);
    const modo = herramienta === 'eraser' ? 'borrar' : 'pintar';

    trazoActualLineas.push({ x1: lastX, y1: lastY, x2: pos.x, y2: pos.y, color, grosor, modo });
    socket.emit('trazo-en-vivo', { x1: lastX, y1: lastY, x2: pos.x, y2: pos.y, color, grosor, modo });
    redraw();

    if (trazoActualLineas.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = modo === 'borrar' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = grosor;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(trazoActualLineas[0].x1, trazoActualLineas[0].y1);
      for (let i = 0; i < trazoActualLineas.length - 1; i++) {
        const curr = trazoActualLineas[i];
        const next = trazoActualLineas[i + 1];
        const midX = (curr.x2 + next.x1) / 2;
        const midY = (curr.y2 + next.y1) / 2;
        ctx.quadraticCurveTo(curr.x2, curr.y2, midX, midY);
      }
      const ultimo = trazoActualLineas[trazoActualLineas.length - 1];
      ctx.lineTo(ultimo.x2, ultimo.y2);
      ctx.stroke();
      ctx.restore();
    }

    lastX = pos.x;
    lastY = pos.y;
    return;
  }

  if (selectingArea) {
    selAreaEnd = { x: pos.x, y: pos.y };
    redraw();
    return;
  }

  if (dragging && selId && objetos[selId]) {
    const nx = pos.x - dragOffX;
    const ny = pos.y - dragOffY;

    if (objetos[selId].tipo === 'grupo' && objetos[selId].hijos) {
      const dx = nx - objetos[selId].x;
      const dy = ny - objetos[selId].y;
      objetos[selId].hijos.forEach((hijo) => {
        hijo.x += dx;
        hijo.y += dy;
        socket.emit('obj-move', { id: hijo.id, x: hijo.x, y: hijo.y });
      });
    }

    objetos[selId].x = nx;
    objetos[selId].y = ny;
    socket.emit('obj-move', { id: selId, x: nx, y: ny });
    redraw();
    return;
  }

  if (resizing && selId && objetos[selId]) {
    const dx = pos.x - resizeStartX;
    const dy = pos.y - resizeStartY;
    const nw = Math.max(40, resizeStartW + dx);
    const nh = Math.max(40, resizeStartH + dy);

    if (objetos[selId].tipo === 'grupo' && objetos[selId].hijos) {
      const scaleX = nw / resizeStartW;
      const scaleY = nh / resizeStartH;
      objetos[selId].hijos.forEach((hijo) => {
        const relX = hijo.x - resizeStartOX;
        const relY = hijo.y - resizeStartOY;
        hijo.x = resizeStartOX + (relX * scaleX);
        hijo.y = resizeStartOY + (relY * scaleY);
        hijo.w = hijo.w * scaleX;
        hijo.h = hijo.h * scaleY;
        socket.emit('obj-resize', { id: hijo.id, x: hijo.x, y: hijo.y, w: hijo.w, h: hijo.h });
      });
    }

    objetos[selId].w = nw;
    objetos[selId].h = nh;
    socket.emit('obj-resize', { id: selId, x: resizeStartOX, y: resizeStartOY, w: nw, h: nh });
    redraw();
  }
}

function onUp() {
  if (pintando && trazoActualLineas.length > 0) {
    guardarEstadoHistorial();

    let capaDibujo = objetos[activeDrawLayerId];
    if (!capaDibujo || !isDrawLayer(capaDibujo)) {
      capaDibujo = buildDrawLayer(activeDrawLayerId || DRAW_LAYER_ID);
      activeDrawLayerId = capaDibujo.id;
    }

    const lineasNuevas = trazoActualLineas.map((l) => ({
      x1: l.x1 - (capaDibujo.x || 0),
      y1: l.y1 - (capaDibujo.y || 0),
      x2: l.x2 - (capaDibujo.x || 0),
      y2: l.y2 - (capaDibujo.y || 0),
      color: l.color,
      grosor: l.grosor,
      modo: l.modo
    }));

    socket.emit('obj-add', {
      ...capaDibujo,
      lineas: [...(capaDibujo.lineas || []), ...lineasNuevas],
      compuesto: true
    });
  }

  if (selectingArea) {
    selectingArea = false;
    const xMin = Math.min(selAreaStart.x, selAreaEnd.x);
    const xMax = Math.max(selAreaStart.x, selAreaEnd.x);
    const yMin = Math.min(selAreaStart.y, selAreaEnd.y);
    const yMax = Math.max(selAreaStart.y, selAreaEnd.y);

    const capturados = [];
    for (const [, obj] of Object.entries(objetos)) {
      if (obj.tipo === 'grupo' || isDrawLayer(obj) || obj.hidden) continue;
      const centerXX = obj.x + (obj.w / 2);
      const centerYY = obj.y + (obj.h / 2);
      if (centerXX >= xMin && centerXX <= xMax && centerYY >= yMin && centerYY <= yMax) {
        capturados.push(obj);
      }
    }

    if (capturados.length > 1) {
      const gMinX = Math.min(...capturados.map((o) => o.x));
      const gMaxX = Math.max(...capturados.map((o) => o.x + o.w));
      const gMinY = Math.min(...capturados.map((o) => o.y));
      const gMaxY = Math.max(...capturados.map((o) => o.y + o.h));

      const grupoId = 'group_' + Date.now();
      socket.emit('obj-add', {
        id: grupoId,
        tipo: 'grupo',
        x: gMinX,
        y: gMinY,
        w: gMaxX - gMinX,
        h: gMaxY - gMinY,
        hijos: capturados
      });

      selId = grupoId;
      document.getElementById('props-select').style.display = '';
    }
  }

  pintando = false;
  dragging = false;
  resizing = false;
  renderLayersPanel();
  redraw();
}

canvas.addEventListener('mousedown', onDown);
canvas.addEventListener('mousemove', onMove);
canvas.addEventListener('mouseup', onUp);
canvas.addEventListener('mouseleave', onUp);

textEl.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    cerrarTextInput();
    return;
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const texto = textEl.value.trim();

    if (texto && textPos) {
      const fontSize = parseInt(document.getElementById('text-size').value, 10);
      const color = document.getElementById('text-color').value;
      const id = 'txt_' + Date.now();
      const textLayerName = getTextLayerName(texto);
      const w = Math.max(200, texto.length * fontSize * 0.6);
      const h = fontSize * 1.5;

      socket.emit('obj-add', {
        id,
        tipo: 'texto',
        texto,
        x: textPos.x,
        y: textPos.y,
        w,
        h,
        color,
        fontSize,
        zIndex: getMaxLayerZIndex() + 1,
        hidden: false,
        layerName: textLayerName || `TEXTO ${nextLayerOrdinal('TEXTO')}`
      });
      toast('💬 Texto agregado');
    }

    cerrarTextInput();
    setTool('select');
  }
});

textEl.addEventListener('input', () => {
  textEl.style.height = 'auto';
  textEl.style.height = textEl.scrollHeight + 'px';
});

document.getElementById('file-input').addEventListener('change', function() {
  if (this.files[0]) subirImagen(this.files[0]);
});

const layersListEl = document.getElementById('layers-list');
if (layersListEl) {
  layersListEl.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.layer-item');
    if (!row) return;
    draggingLayerId = row.dataset.layerId || null;
    if (!draggingLayerId) return;
    row.classList.add('is-dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggingLayerId);
    }
  });

  layersListEl.addEventListener('dragend', (e) => {
    const row = e.target.closest('.layer-item');
    if (row) row.classList.remove('is-dragging');
    draggingLayerId = null;
  });

  layersListEl.addEventListener('dragover', (e) => {
    const row = e.target.closest('.layer-item');
    if (!row) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  });

  layersListEl.addEventListener('drop', (e) => {
    const row = e.target.closest('.layer-item');
    if (!row) return;
    e.preventDefault();
    const targetId = row.dataset.layerId;
    const sourceId = draggingLayerId || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : '');
    reorderLayers(sourceId, targetId);
  });

  layersListEl.addEventListener('click', async (e) => {
    const actionBtn = e.target.closest('.layer-btn');
    if (actionBtn) {
      const layerId = actionBtn.dataset.layerId;
      const action = actionBtn.dataset.action;
      if (!layerId || !action) return;

      if (action === 'toggle') {
        toggleLayer(layerId);
      } else if (action === 'delete') {
        const result = await deleteLayer(layerId);
        if (result === 'deleted') toast('🗑️ Capa eliminada');
        if (result === 'cleared') toast('🧹 Ultima capa de dibujo vaciada');
      }
      return;
    }

    const layerRow = e.target.closest('.layer-item');
    if (!layerRow) return;
    const layerId = layerRow.dataset.layerId;
    if (layerId) selectLayer(layerId);
  });
}

const createLayerBtn = document.getElementById('create-draw-layer-btn');
if (createLayerBtn) {
  createLayerBtn.addEventListener('click', crearNuevaCapaDibujo);
}

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropOverlay.style.display = 'flex';
});

dropZone.addEventListener('dragleave', () => {
  dropOverlay.style.display = 'none';
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropOverlay.style.display = 'none';
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) subirImagen(file);
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  const key = e.key.toLowerCase();

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    subirCapaSeleccionadaUnNivel();
    return;
  }

  if (e.ctrlKey && (e.key === 'Delete' || e.key === 'Supr')) {
    e.preventDefault();
    limpiarTodo();
    return;
  }

  if (e.key === 'Delete' || e.key === 'Supr' || e.key === 'Backspace') {
    e.preventDefault();
    eliminarSeleccionado();
    return;
  }

  switch (key) {
    case 'v':
      setTool('select');
      break;
    case 'p':
    case 'c':
    case 'l':
      setTool('draw');
      break;
    case 'b':
    case 'e':
      setTool('eraser');
      break;
    case 'i':
    case 'f':
      triggerUpload();
      break;
    case 't':
      setTool('text');
      break;
  }
});

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
    if (document.activeElement && (document.activeElement.id === 'text-input-el' || document.activeElement.tagName === 'INPUT')) {
      return;
    }

    e.preventDefault();
    seleccionarTodo();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
    if (document.activeElement && (document.activeElement.id === 'text-input-el' || document.activeElement.tagName === 'INPUT')) {
      return;
    }

    e.preventDefault();
    deshacerUltimaAccion();
    return;
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    eliminarSeleccionado();
  }
});

document.getElementById('draw-size').addEventListener('input', function() {
  document.getElementById('draw-size-val').textContent = this.value;
});

window.addEventListener('resize', fitCanvas);
fitCanvas();
ensureDefaultDrawLayer();
renderLayersPanel();
setTool('select');
