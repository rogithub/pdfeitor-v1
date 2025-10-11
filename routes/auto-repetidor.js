const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfService = require('../services/pdfService');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/generate-auto-repetidor', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó ninguna imagen.' });
        }
        const config = JSON.parse(req.body.config);
        
        const pdfBytes = await pdfService.createAutoRepetidorPdf(req.file, config);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=auto-repetidor.pdf');
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error('Error en la ruta /generate-auto-repetidor:', error);
        res.status(500).send('Error al generar el PDF.');
    }
});

module.exports = router;