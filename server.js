const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3069;

// Configurar carpetas base
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

dotenv.config();

// ── CONFIGURACIÓN DE MIDDLEWARES ─────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar sesiones para proteger el control.html
app.use(session({
  secret: 'secreto-del-streamer-12345', // Cambia esto por lo que quieras
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // Duración: 1 día
}));

// Inyectar Rutas y Sockets modulares pasando las dependencias necesarias
require('./routes/routes')(app, uploadsDir);
require('./sockets/sockets')(io, uploadsDir);

// Arrancar el Servidor
server.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Overlay OBS : http://localhost:${PORT}/overlay.html`);
  console.log(`Control     : http://localhost:${PORT}/control.html`);
  console.log(`=================================================\n`);
});