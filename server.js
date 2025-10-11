const express = require('express');
const path = require('path');
const multer = require('multer'); // Keep for error handling
const apiRoutes = require('./routes'); // Import the main router

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTML Page Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

// API Routes
app.use('/', apiRoutes);

// Centralized Error Handling
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('Multer Error:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo es demasiado grande.' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Campo de archivo inesperado.' });
    }
  }
  console.error('Unhandled Error:', error);
  res.status(500).json({ error: 'Ocurrió un error en el servidor.' });
});

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
