const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfService = require('../services/pdfService');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/generate-layout', upload.array('images'), async (req, res) => {
    try {
        const layoutConfig = JSON.parse(req.body.layout);
        
        const pdfBytes = await pdfService.createLayoutPdf(req.files, layoutConfig);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=layout.pdf');
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error('Error en la ruta /generate-layout:', error);
        res.status(500).send('Error al generar el PDF.');
    }
});

// Export the router itself, not an object containing it
module.exports = router;