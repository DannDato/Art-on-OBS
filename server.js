const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3069;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `img_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public')));

// Subir imagen — devuelve URL, el cliente crea el obj-add
app.post('/upload', upload.single('imagen'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió archivo' });
  res.json({ ok: true, url: `/uploads/${req.file.filename}` });
});

// Función para vaciar por completo la carpeta de subidas
const vaciarCarpetaUploads = () => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) return console.error("Error leyendo carpeta de uploads:", err);
    for (const file of files) {
      fs.unlink(path.join(uploadsDir, file), (err) => {
        if (err) console.error(`Error borrando archivo temporal ${file}:`, err);
      });
    }
    console.log("🧨 Carpeta /uploads vaciada por completo.");
  });
};


io.on('connection', (socket) => {
  console.log('Conectado:', socket.id);

    // Dibujo libre
  socket.on('trazo-en-vivo', (d) => socket.broadcast.emit('trazo-en-vivo', d));

  // Objetos posicionados (Trazos terminados, imágenes, textos, grupos)
  socket.on('obj-add',    (d) => io.emit('obj-add', d));
  socket.on('obj-move',   (d) => io.emit('obj-move', d));
  socket.on('obj-resize', (d) => io.emit('obj-resize', d));
  // Eliminar un objeto o un grupo, borrando sus imágenes del disco duro
  // Eliminar un objeto o un grupo, borrando sus imágenes del disco duro
  socket.on('obj-remove', (d) => {
    // Si nos pasan un objeto que es una imagen y trae una URL válida
    if (d && d.tipo === 'imagen' && d.url) {
      // Extraemos solo el nombre del archivo (ej: img_1234.png)
      const filename = path.basename(d.url);
      const filepath = path.join(uploadsDir, filename);

      // Borramos del disco si el archivo existe
      if (fs.existsSync(filepath)) {
        fs.unlink(filepath, (err) => {
          if (err) console.error(`❌ Error al borrar archivo ${filename}:`, err);
          else console.log(`🗑️ Archivo eliminado del disco: ${filename}`);
        });
      }
    }

    // Retransmitir a todas las pantallas (OBS y paneles) para que lo quiten visualmente
    io.emit('obj-remove', { id: d.id });
  });

  // Nuclear
  // Modifica tus listeners en io.on('connection') :
  socket.on('limpiar-todo', () => {
    vaciarCarpetaUploads();
    io.emit('limpiar-todo');
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado, limpiando lienzo global...');
    vaciarCarpetaUploads(); // <-- Limpieza automática al cerrar el panel
    io.emit('limpiar-todo');
  });
});

server.listen(PORT, () => {
  console.log(`✅ http://localhost:${PORT}`);
  console.log(`🎮 Overlay OBS : http://localhost:${PORT}/overlay.html`);
  console.log(`🎛️  Control     : http://localhost:${PORT}/control.html`);
});