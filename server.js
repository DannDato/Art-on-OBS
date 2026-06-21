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

io.on('connection', (socket) => {
  console.log('Conectado:', socket.id);

  // Dibujo libre
  socket.on('trazo',        (d) => io.emit('trazo', d));
  socket.on('limpiar-dibujo', () => io.emit('limpiar-dibujo'));

  // Objetos posicionados
  socket.on('obj-add',    (d) => io.emit('obj-add', d));
  socket.on('obj-move',   (d) => io.emit('obj-move', d));
  socket.on('obj-resize', (d) => io.emit('obj-resize', d));
  socket.on('obj-remove', (d) => io.emit('obj-remove', d));

  // Nuclear
  socket.on('limpiar-todo', () => io.emit('limpiar-todo'));

  socket.on('disconnect', () => console.log('Desconectado:', socket.id));
});

server.listen(PORT, () => {
  console.log(`✅ http://localhost:${PORT}`);
  console.log(`🎮 Overlay OBS : http://localhost:${PORT}/overlay.html`);
  console.log(`🎛️  Control     : http://localhost:${PORT}/control.html`);
});