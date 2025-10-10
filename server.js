const express = require('express');
const multer = require('multer');
const path = require('path');

// Importar rutas modulares
const collageRoutes = require('./routes/collage');
const repetidorRoutes = require('./routes/repetidor');
const simetricoRoutes = require('./routes/simetrico');
const repetidorSimetricoRoutes = require('./routes/repetidor-simetrico'); // Nueva ruta
const layoutEditorRoutes = require('./routes/layout-editor'); // Ruta para el editor de layouts
const multiPaginaRoutes = require('./routes/multi-pagina'); // Ruta para el creador multi-página
const plantillaEditorRoutes = require('./routes/plantilla-editor'); // Ruta para el editor de plantillas
const autoRepetidorRoutes = require('./routes/auto-repetidor'); // Nueva ruta
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

app.get('/repetidor-simetrico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'repetidor-simetrico.html'));
});

app.get('/layout-editor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'layout-editor.html'));
});

app.get('/multi-pagina', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'multi-pagina.html'));
});

app.get('/plantilla-editor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'plantilla-editor.html'));
});

app.get('/auto-repetidor', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'auto-repetidor.html'));
});

// Configurar rutas
app.post('/generate-collage', upload.array('images', 12), collageRoutes.generateCollage);
app.post('/generate-repetidor', upload.single('image'), repetidorRoutes.generateRepetidor);
app.post('/generate-simetrico', upload.array('images', 12), simetricoRoutes.generateSimetrico);
app.post('/generate-repetidor-simetrico', upload.single('image'), repetidorSimetricoRoutes.generateRepetidorSimetrico);
app.post('/generate-multi-pagina', upload.array('images', 50), multiPaginaRoutes.generateMultiPagina);
app.post('/generate-plantilla', upload.array('images', 100), plantillaEditorRoutes.generatePlantilla); // Límite alto
app.post('/generate-auto-repetidor', upload.single('image'), autoRepetidorRoutes.generateAutoRepetidor);

// Usar el router para el editor de layouts
app.use('/', layoutEditorRoutes);

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