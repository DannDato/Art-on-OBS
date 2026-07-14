const express = require('express');
const path = require('path');
const fs = require('fs');
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

  app.get('/api/image-search', verificarAutenticacion, async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (!query) return res.status(400).json({ ok: false, error: 'Consulta vacia' });

    // Proveedor unico: Wikimedia Commons
    try {
      const endpoint = new URL('https://commons.wikimedia.org/w/api.php');
      endpoint.searchParams.set('action', 'query');
      endpoint.searchParams.set('generator', 'search');
      endpoint.searchParams.set('gsrsearch', query);
      endpoint.searchParams.set('gsrnamespace', '6'); // File namespace
      endpoint.searchParams.set('gsrlimit', '12');
      endpoint.searchParams.set('prop', 'imageinfo');
      endpoint.searchParams.set('iiprop', 'url');
      endpoint.searchParams.set('iiurlwidth', '320');
      endpoint.searchParams.set('format', 'json');
      endpoint.searchParams.set('origin', '*');

      const response = await fetch(endpoint.toString());
      if (!response.ok) {
        return res.status(502).json({ ok: false, error: 'Wikimedia API no disponible' });
      }

      const data = await response.json();
      const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
      const results = pages
        .map((page) => {
          const info = Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
          if (!info || !info.url) return null;
          return {
            title: String(page.title || 'Imagen').replace(/^File:/i, ''),
            imageUrl: info.url,
            thumbnailUrl: info.thumburl || info.url,
            source: 'commons.wikimedia.org'
          };
        })
        .filter(Boolean);

      return res.json({ ok: true, provider: 'wikimedia', results });
    } catch (_) {
      return res.status(500).json({ ok: false, error: 'No se pudo consultar buscador alternativo' });
    }
  });

  app.post('/api/import-image-url', verificarAutenticacion, express.json(), async (req, res) => {
    const rawUrl = String(req.body?.url || '').trim();
    if (!rawUrl) return res.status(400).json({ ok: false, error: 'URL requerida' });

    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch (_) {
      return res.status(400).json({ ok: false, error: 'URL invalida' });
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      return res.status(400).json({ ok: false, error: 'Solo se permiten URLs http/https' });
    }

    try {
      const response = await fetch(parsed.toString(), {
        headers: { 'User-Agent': 'DrawCast/1.0 (+image-import)' }
      });
      if (!response.ok) {
        return res.status(502).json({ ok: false, error: 'No se pudo descargar la imagen remota' });
      }

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith('image/')) {
        return res.status(415).json({ ok: false, error: 'El recurso no es una imagen' });
      }

      const extMap = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/bmp': 'bmp',
        'image/svg+xml': 'svg'
      };
      const baseType = contentType.split(';')[0].trim();
      const ext = extMap[baseType] || 'png';

      const bytes = Buffer.from(await response.arrayBuffer());
      const filename = `img_remote_${Date.now()}_${Math.round(Math.random() * 1e6)}.${ext}`;
      const outPath = path.join(uploadsDir, filename);
      fs.writeFileSync(outPath, bytes);

      return res.json({ ok: true, url: `/uploads/${filename}` });
    } catch (_) {
      return res.status(500).json({ ok: false, error: 'Error al importar imagen remota' });
    }
  });

  // ── AJUSTE CRÍTICO DE SEGURIDAD ────────────────────────────────────────────
  // Servimos los estilos y scripts, pero EVITAMOS que sirva los .html sueltos directamente
  app.use(express.static(path.join(__dirname, '../public'), { extensions: [] }));

  // Si alguien escribe una ruta que no existe, lo mandamos al login por seguridad
  app.use((req, res) => {
    res.redirect('/login');
  });
};