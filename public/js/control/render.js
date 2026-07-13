// Render y utilidades geométricas del canvas de control
function isDrawLayer(obj) {
  return obj && obj.tipo === 'trazo' && obj.compuesto;
}

function getOrderedObjectEntries() {
  return Object.entries(objetos).sort(([, a], [, b]) => {
    const za = typeof a.zIndex === 'number' ? a.zIndex : 0;
    const zb = typeof b.zIndex === 'number' ? b.zIndex : 0;
    return za - zb;
  });
}

function renderLineasCompuestas(lineas, offsetX = 0, offsetY = 0, scaleX = 1, scaleY = 1) {
  if (!lineas || lineas.length === 0) return;

  let currentMode = null;

  for (const seg of lineas) {
    const mode = seg.modo === 'borrar' ? 'destination-out' : 'source-over';

    if (mode !== currentMode) {
      ctx.globalCompositeOperation = mode;
      currentMode = mode;
    }

    ctx.strokeStyle = seg.color;
    ctx.lineWidth = seg.grosor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(offsetX + (seg.x1 * scaleX), offsetY + (seg.y1 * scaleY));
    ctx.lineTo(offsetX + (seg.x2 * scaleX), offsetY + (seg.y2 * scaleY));
    ctx.stroke();
  }

  ctx.globalCompositeOperation = 'source-over';
}

function getDrawLayerBounds(layer) {
  if (!layer || !layer.lineas || layer.lineas.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const seg of layer.lineas) {
    if (seg.modo === 'borrar') continue;
    const half = Math.max(2, (seg.grosor || 2) / 2);
    const x1 = layer.x + seg.x1;
    const y1 = layer.y + seg.y1;
    const x2 = layer.x + seg.x2;
    const y2 = layer.y + seg.y2;

    minX = Math.min(minX, x1 - half, x2 - half);
    minY = Math.min(minY, y1 - half, y2 - half);
    maxX = Math.max(maxX, x1 + half, x2 + half);
    maxY = Math.max(maxY, y1 + half, y2 + half);
  }

  if (!isFinite(minX)) return null;
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / ((dx * dx) + (dy * dy))));
  const projX = x1 + (t * dx);
  const projY = y1 + (t * dy);
  return Math.hypot(px - projX, py - projY);
}

function hitDrawLayer(x, y) {
  const ids = getOrderedObjectEntries().map(([id]) => id).reverse();

  for (const id of ids) {
    const layer = objetos[id];
    if (!isDrawLayer(layer) || layer.hidden || !layer.lineas || layer.lineas.length === 0) continue;

    for (let i = layer.lineas.length - 1; i >= 0; i--) {
      const seg = layer.lineas[i];
      if (seg.modo === 'borrar') continue;

      const x1 = layer.x + seg.x1;
      const y1 = layer.y + seg.y1;
      const x2 = layer.x + seg.x2;
      const y2 = layer.y + seg.y2;
      const tol = Math.max(6, (seg.grosor || 2) * 0.8);

      if (distancePointToSegment(x, y, x1, y1, x2, y2) <= tol) {
        return id;
      }
    }
  }

  return null;
}

function hitTest(x, y) {
  const ids = getOrderedObjectEntries().map(([id]) => id).reverse();
  for (const id of ids) {
    if (isDrawLayer(objetos[id])) continue;
    const o = objetos[id];
    if (o.hidden) continue;
    if (x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h) return id;
  }
  const drawHit = hitDrawLayer(x, y);
  if (drawHit) return drawHit;
  return null;
}

function redraw() {
  ctx.clearRect(0, 0, OVERLAY_W, OVERLAY_H);

  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < OVERLAY_W; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, OVERLAY_H);
    ctx.stroke();
  }
  for (let y = 0; y < OVERLAY_H; y += 96) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(OVERLAY_W, y);
    ctx.stroke();
  }

  for (const [id, obj] of getOrderedObjectEntries()) {
    if (obj.hidden) continue;

    if (obj.tipo === 'imagen' && obj._img) {
      ctx.drawImage(obj._img, obj.x, obj.y, obj.w, obj.h);
    } else if (obj.tipo === 'texto') {
      ctx.font = `900 ${obj.fontSize || 48}px 'Segoe UI', sans-serif`;
      ctx.fillStyle = obj.color || '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 0;
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#000';
      ctx.strokeText(obj.texto, obj.x, obj.y + (obj.fontSize || 48));
      ctx.fillText(obj.texto, obj.x, obj.y + (obj.fontSize || 48));
      ctx.shadowBlur = 0;
    } else if (obj.tipo === 'trazo' && obj.lineas && obj.lineas.length > 0) {
      if (isDrawLayer(obj)) {
        renderLineasCompuestas(obj.lineas, obj.x || 0, obj.y || 0);
      } else {
        ctx.save();
        ctx.translate(obj.x, obj.y);

        const origW = obj.lineas.reduce((max, l) => Math.max(max, l.x1, l.x2), 10);
        const origH = obj.lineas.reduce((max, l) => Math.max(max, l.y1, l.y2), 10);
        ctx.scale(obj.w / origW, obj.h / origH);

        const primerTrazo = obj.lineas[0];
        ctx.globalCompositeOperation = primerTrazo.modo === 'borrar' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = primerTrazo.color;
        ctx.lineWidth = primerTrazo.grosor;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(primerTrazo.x1, primerTrazo.y1);

        for (let i = 0; i < obj.lineas.length - 1; i++) {
          const curr = obj.lineas[i];
          const next = obj.lineas[i + 1];
          const midX = (curr.x2 + next.x1) / 2;
          const midY = (curr.y2 + next.y1) / 2;
          ctx.quadraticCurveTo(curr.x2, curr.y2, midX, midY);
        }

        const ultimo = obj.lineas[obj.lineas.length - 1];
        ctx.lineTo(ultimo.x2, ultimo.y2);
        ctx.stroke();

        ctx.restore();
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    if (id === selId) {
      const drawBounds = isDrawLayer(obj) ? getDrawLayerBounds(obj) : null;
      const boxX = drawBounds ? drawBounds.x : obj.x;
      const boxY = drawBounds ? drawBounds.y : obj.y;
      const boxW = drawBounds ? drawBounds.w : obj.w;
      const boxH = drawBounds ? drawBounds.h : obj.h;

      ctx.strokeStyle = '#7c6cfa';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(boxX - 2, boxY - 2, boxW + 4, boxH + 4);
      ctx.setLineDash([]);

      if (!isDrawLayer(obj)) {
        ctx.fillStyle = '#7c6cfa';
        ctx.fillRect(boxX + boxW - 6, boxY + boxH - 6, 12, 12);
      }
    }
  }

  if (selectingArea) {
    ctx.strokeStyle = 'rgba(124, 108, 250, 0.8)';
    ctx.fillStyle = 'rgba(124, 108, 250, 0.1)';
    ctx.lineWidth = 1;
    const widthArea = selAreaEnd.x - selAreaStart.x;
    const heightArea = selAreaEnd.y - selAreaStart.y;
    ctx.fillRect(selAreaStart.x, selAreaStart.y, widthArea, heightArea);
    ctx.strokeRect(selAreaStart.x, selAreaStart.y, widthArea, heightArea);
  }
}
