const express = require('express');
const path = require('path');
const upload = require('../config/multer');
const verificarAutenticacion = require('../middlewares/authenticate'); // <── ¡Importamos tu nuevo middleware!

// CONTRASEÑA GLOBAL DEL PANEL
const PASSWORD_PANEL = "STRC_Art";

module.exports = function(app, uploadsDir) {

  // LOGIN
  app.get('/login', (req, res) => {res.redirect('/login.html');});
  // ── RUTAS PÚBLICAS ─────────────────────────────────────────────────────────
  app.use('/uploads', express.static(uploadsDir));
  // El overlay de OBS siempre debe ser público
  app.get('/overlay.html', (req, res) => {res.sendFile(path.join(__dirname, '../public', 'overlay.html'));});

  // Procesar formulario de inicio de sesión
  app.post('/api/login', express.json(), (req, res) => {
    const { password } = req.body;
    if (password === PASSWORD_PANEL) {
      req.session.autenticado = true;
      return res.json({ ok: true, mensaje: "Acceso concedido" });
    }
    res.status(401).json({ error: "Contraseña incorrecta" });
  });

  // Ruta para cerrar sesión
  app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login.html');
  });

  // ── RUTAS PROTEGIDAS (Inyectando el middleware importado) ──────────────────
  app.get('/control.html', verificarAutenticacion, (req, res) => {res.sendFile(path.join(__dirname, '../public', 'control.html'));});

  // Subir imagen (Protegido por el middleware de autenticación y procesado por Multer)
  app.post('/upload', verificarAutenticacion, upload.single('imagen'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió archivo' });
    res.json({ ok: true, url: `/uploads/${req.file.filename}` });
  });

  // El resto de la carpeta pública al final
  app.use(express.static(path.join(__dirname, '../public')));
};