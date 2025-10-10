const { PDFDocument, degrees } = require('pdf-lib');
const sharp = require('sharp');
const { mmToPt } = require('./common');

const PAPER_DIMENSIONS_PT = {
    letter: { width: 612, height: 792 },
    legal: { width: 612, height: 1008 }
};

async function generateAutoRepetidor(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó ninguna imagen.' });
        }

        const config = JSON.parse(req.body.config);
        const { pageSettings, image: imageConfig, grid } = config;

        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();

        // Configurar tamaño y orientación de la página
        const pageDims = PAPER_DIMENSIONS_PT[pageSettings.pageSize];
        const pageWidth = pageSettings.orientation === 'landscape' ? pageDims.height : pageDims.width;
        let pageHeight = pageSettings.orientation === 'landscape' ? pageDims.width : pageDims.height;
        page.setSize(pageWidth, pageHeight);

        // Rotar imagen si es necesario
        let imageBuffer = req.file.buffer;
        if (imageConfig.rotation > 0) {
            imageBuffer = await sharp(imageBuffer).rotate(imageConfig.rotation).toBuffer();
        }

        // Embeber la imagen
        const isPng = (await sharp(imageBuffer).metadata()).format === 'png';
        const image = isPng ? await pdfDoc.embedPng(imageBuffer) : await pdfDoc.embedJpg(imageBuffer);

        // Convertir todas las medidas a puntos
        const marginPt = mmToPt(pageSettings.margin);
        const spacingPt = mmToPt(grid.spacing);
        const imageWidthPt = mmToPt(imageConfig.widthMM);
        const imageHeightPt = mmToPt(imageConfig.heightMM);

        // Calcular el área de inicio para el dibujo
        const startX = marginPt;
        let startY = pageHeight - marginPt - imageHeightPt; // Y se dibuja desde la esquina inferior izquierda

        if (pageSettings.useHalfPage) {
            startY = pageHeight - marginPt - imageHeightPt;
        }
        
        // Dibujar la cuadrícula de imágenes
        for (let row = 0; row < grid.rows; row++) {
            for (let col = 0; col < grid.cols; col++) {
                const x = startX + col * (imageWidthPt + spacingPt);
                const y = startY - row * (imageHeightPt + spacingPt);
                
                page.drawImage(image, {
                    x: x,
                    y: y,
                    width: imageWidthPt,
                    height: imageHeightPt,
                });
            }
        }

        const pdfBytes = await pdfDoc.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=auto-repetidor.pdf');
        res.send(Buffer.from(pdfBytes));

    } catch (error) {
        console.error('Error generando el PDF auto-repetidor:', error);
        res.status(500).send('Error al generar el PDF.');
    }
}

module.exports = {
    generateAutoRepetidor
};
