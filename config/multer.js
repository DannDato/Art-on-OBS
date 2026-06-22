const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Asegurar que la carpeta uploads exista relativamente al servidor
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Configuración del motor de almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `img_${Date.now()}${ext}`);
  }
});

// Instancia de Multer configurada (Límite: 20MB)
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }
});

module.exports = upload;