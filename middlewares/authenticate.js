/**
 * Middleware para proteger rutas del panel de control
 * Verifica si el usuario ha iniciado sesión. Si no, lo rebota a login.html
 */
const verificarAutenticacion = (req, res, next) => {
  if (req.session && req.session.autenticado) {
    return next();
  }
  res.redirect('/login');
};

module.exports = verificarAutenticacion;