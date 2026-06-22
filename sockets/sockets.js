const path = require('path');
const fs = require('fs');

module.exports = function(io, uploadsDir) {

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

    // Dibujo libre y streaming rápido en vivo (milisegundo a milisegundo)
    socket.on('trazo-en-vivo', (d) => socket.broadcast.emit('trazo-en-vivo', d));
    socket.on('limpiar-dibujo', () => io.emit('limpiar-dibujo'));

    // Objetos posicionados y maquetados
    socket.on('obj-add',    (d) => io.emit('obj-add', d));
    socket.on('obj-move',   (d) => io.emit('obj-move', d));
    socket.on('obj-resize', (d) => io.emit('obj-resize', d));

    // Remover objeto individual y purgar archivos de imagen físicos en el disco
    socket.on('obj-remove', (d) => {
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
      vaciarCarpetaUploads();
      io.emit('limpiar-todo');
    });

    // Control de desconexión preventiva
    socket.on('disconnect', () => {
      console.log(`🔌 Cliente desconectado (${socket.id}). Vaciando lienzo global...`);
      vaciarCarpetaUploads();
      io.emit('limpiar-todo');
    });
  });
};