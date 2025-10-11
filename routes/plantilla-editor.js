const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfService = require('../services/pdfService');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/generate-plantilla', upload.array('images', 100), async (req, res) => {
    try {
        const config = JSON.parse(req.body.config);

        const pdfBytes = await pdfService.createPlantillaPdf(req.files, config);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=plantilla.pdf');
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error('Error en la ruta /generate-plantilla:', error);
        res.status(500).send('Error al generar el PDF.');
    }
});

module.exports = router;