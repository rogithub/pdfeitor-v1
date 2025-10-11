const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfService = require('../services/pdfService');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/generate-multi-pagina', upload.array('images', 50), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No se enviaron imágenes.' });
        }
        const pageSettings = JSON.parse(req.body.pageSettings);

        const pdfBytes = await pdfService.createMultiPaginaPdf(req.files, pageSettings);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=multi-pagina.pdf');
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error('Error en la ruta /generate-multi-pagina:', error);
        res.status(500).send('Error al generar el PDF.');
    }
});

module.exports = router;