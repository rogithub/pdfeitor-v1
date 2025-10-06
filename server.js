const express = require('express');
const multer = require('multer');
const path = require('path');

// Importar rutas modulares
const collageRoutes = require('./routes/collage');
const repetidorRoutes = require('./routes/repetidor');
const simetricoRoutes = require('./routes/simetrico');
const common = require('./routes/common');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de multer
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/collage', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'collage.html'));
});

app.get('/repetidor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'repetidor.html'));
});

app.get('/simetrico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'simetrico.html'));
});

// Configurar rutas
app.post('/generate-collage', upload.array('images', 12), collageRoutes.generateCollage);
app.post('/generate-repetidor', upload.single('image'), repetidorRoutes.generateRepetidor);
app.post('/generate-simetrico', upload.array('images', 12), simetricoRoutes.generateSimetrico);

// Manejo de errores
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('Error Multer:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Archivo demasiado grande' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Campo de archivo inesperado' });
    }
  }
  console.error('Error general:', error);
  res.status(500).json({ error: error.message });
});

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});