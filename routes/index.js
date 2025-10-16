const express = require('express');
const router = express.Router();

// Importar los módulos de rutas refactorizados
const autoRepetidorRoutes = require('./auto-repetidor');
const multiPaginaRoutes = require('./multi-pagina');
const plantillaEditorRoutes = require('./plantilla-editor');

// Usar los routers importados
router.use(autoRepetidorRoutes);
router.use(multiPaginaRoutes);
router.use(plantillaEditorRoutes);

module.exports = router;
