const path = require('path');
const fs = require('fs');

module.exports = function(io, uploadsDir) {
  const socketRoles = new Map();
  const canvasObjects = new Map();

  const parseSleepMs = () => {
    const raw = process.env.SLEEP_TIME;
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return 10 * 60 * 1000;
    return parsed;
  };

  const sleepTimeMs = parseSleepMs();
  let editorSleepTimer = null;

  const buildPresenceStats = () => {
    const roles = Array.from(socketRoles.values());
    const editors = roles.filter((r) => r === 'editor').length;
    const overlays = roles.filter((r) => r === 'overlay').length;
    return {
      total: socketRoles.size,
      editors,
      overlays,
      synced: editors > 0 && overlays > 0
    };
  };

  const emitPresenceStats = () => {
    io.emit('presence-stats', buildPresenceStats());
  };

  const getEditorsCount = () => {
    return Array.from(socketRoles.values()).filter((r) => r === 'editor').length;
  };

  const normalizeIncomingObject = (obj) => {
    if (!obj || typeof obj !== 'object' || !obj.id) return null;
    const normalized = { ...obj };
    delete normalized._img;
    return normalized;
  };

  const emitStateToSocket = (socket) => {
    socket.emit('sync-state', {
      objects: Array.from(canvasObjects.values())
    });
  };

  const clearCanvasState = ({ emit = true, clearUploads = true } = {}) => {
    canvasObjects.clear();
    if (clearUploads) vaciarCarpetaUploads();
    if (emit) io.emit('limpiar-todo');
  };

  const scheduleSleepIfNoEditors = () => {
    if (getEditorsCount() > 0) return;
    if (editorSleepTimer) return;

    editorSleepTimer = setTimeout(() => {
      editorSleepTimer = null;
      if (getEditorsCount() > 0) return;
      console.log(`💤 Sin clientes control por ${sleepTimeMs}ms. Reiniciando lienzo global...`);
      clearCanvasState({ emit: true, clearUploads: true });
    }, sleepTimeMs);
  };

  const cancelSleepTimer = () => {
    if (!editorSleepTimer) return;
    clearTimeout(editorSleepTimer);
    editorSleepTimer = null;
  };

  // Función utilitaria para limpiar por completo la carpeta uploads
  const vaciarCarpetaUploads = () => {
    fs.readdir(uploadsDir, (err, files) => {
      if (err) return console.error("❌ Error leyendo carpeta de uploads:", err);
      for (const file of files) {
        fs.unlink(path.join(uploadsDir, file), (err) => {
          if (err) console.error(`❌ Error borrando archivo temporal ${file}:`, err);
        });
      }
    });
  };

  // Listener principal de Socket.io
  io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`);
    socketRoles.set(socket.id, 'unknown');
    emitPresenceStats();
    emitStateToSocket(socket);

    socket.on('presence-register', (d) => {
      const prevRole = socketRoles.get(socket.id) || 'unknown';
      const role = d && (d.role === 'editor' || d.role === 'overlay') ? d.role : 'unknown';
      socketRoles.set(socket.id, role);

      if (prevRole !== 'editor' && role === 'editor') {
        cancelSleepTimer();
      }

      if (role === 'editor' || role === 'overlay') {
        emitStateToSocket(socket);
      }

      emitPresenceStats();
    });

    // Dibujo libre y streaming rápido en vivo (milisegundo a milisegundo)
    socket.on('trazo-en-vivo', (d) => socket.broadcast.emit('trazo-en-vivo', d));
    socket.on('limpiar-dibujo', () => io.emit('limpiar-dibujo'));

    // Objetos posicionados y maquetados
    socket.on('obj-add', (d) => {
      const normalized = normalizeIncomingObject(d);
      if (!normalized) return;
      canvasObjects.set(normalized.id, normalized);
      io.emit('obj-add', normalized);
    });

    socket.on('obj-move', (d) => {
      if (!d || !d.id) return;
      const existing = canvasObjects.get(d.id);
      if (existing) {
        if (typeof d.x === 'number') existing.x = d.x;
        if (typeof d.y === 'number') existing.y = d.y;
        canvasObjects.set(d.id, existing);
      }
      io.emit('obj-move', d);
    });

    socket.on('obj-resize', (d) => {
      if (!d || !d.id) return;
      const existing = canvasObjects.get(d.id);
      if (existing) {
        if (typeof d.x === 'number') existing.x = d.x;
        if (typeof d.y === 'number') existing.y = d.y;
        if (typeof d.w === 'number') existing.w = d.w;
        if (typeof d.h === 'number') existing.h = d.h;
        canvasObjects.set(d.id, existing);
      }
      io.emit('obj-resize', d);
    });

    // Remover objeto individual y purgar archivos de imagen físicos en el disco
    socket.on('obj-remove', (d) => {
      if (d && d.id) canvasObjects.delete(d.id);
      if (d && d.tipo === 'imagen' && d.url) {
        const filename = path.basename(d.url);
        const filepath = path.join(uploadsDir, filename);

        if (fs.existsSync(filepath)) {
          fs.unlink(filepath, (err) => {
            if (err) console.error(`❌ Error al borrar archivo ${filename}:`, err);
            else console.log(`🗑️ Archivo eliminado del disco: ${filename}`);
          });
        }
      }
      io.emit('obj-remove', { id: d.id });
    });

    // Control Nuclear (Limpiar todo el lienzo)
    socket.on('limpiar-todo', () => {
      clearCanvasState({ emit: true, clearUploads: true });
    });

    // Control de desconexión preventiva
    socket.on('disconnect', () => {
      const prevRole = socketRoles.get(socket.id) || 'unknown';
      socketRoles.delete(socket.id);
      emitPresenceStats();

      if (prevRole === 'editor') {
        scheduleSleepIfNoEditors();
      }

      console.log(`🔌 Cliente desconectado (${socket.id}). Estado actual preservado.`);
    });
  });
};