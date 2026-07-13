const express = require('express');
const path = require('path');
const upload = require('../config/multer');
const verificarAutenticacion = require('../middlewares/authenticate');

// CONTRASEÑA GLOBAL DEL PANEL
const PASSWORD_PANEL = process.env.DC_MS_PASSWORD

module.exports = function(app, uploadsDir) {

  // Redirección amigable si alguien entra a /login a secas
  app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'login.html'));
  });

  // ── RUTAS PÚBLICAS LIMPIAS ─────────────────────────────────────────────────
  app.use('/uploads', express.static(uploadsDir));

  // El overlay de OBS ahora se accede desde http://localhost:3069/overlay
  app.get('/overlay', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'overlay.html'));
  });

  // Procesar formulario de inicio de sesión
  app.post('/api/login', express.json(), (req, res) => {
    const { password } = req.body;
    if (password === PASSWORD_PANEL) {
      req.session.autenticado = true;
      return res.json({ ok: true, mensaje: "Acceso concedido" });
    }
    res.status(401).json({ error: "Contraseña incorrecta" });
  });

  // Ruta para cerrar sesión (redirige a la nueva ruta limpia /login)
  app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
  });

  // ── RUTAS PROTEGIDAS LIMPIAS ───────────────────────────────────────────────
  // El panel de control ahora se accede desde http://localhost:3069/control
  app.get('/control', verificarAutenticacion, (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'control.html'));
  });

  // Subir imagen
  app.post('/upload', verificarAutenticacion, upload.single('imagen'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió archivo' });
    res.json({ ok: true, url: `/uploads/${req.file.filename}` });
  });

  // ── AJUSTE CRÍTICO DE SEGURIDAD ────────────────────────────────────────────
  // Servimos los estilos y scripts, pero EVITAMOS que sirva los .html sueltos directamente
  app.use(express.static(path.join(__dirname, '../public'), { extensions: [] }));

  // Si alguien escribe una ruta que no existe, lo mandamos al login por seguridad
  app.use((req, res) => {
    res.redirect('/login');
  });
};