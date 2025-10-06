const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const sharp = require('sharp');
const { LETTER_WIDTH_PT, LETTER_HEIGHT_PT, ptToMm, mmToPt } = require('./common');

const router = express.Router();
// Usamos multer en memoria para no escribir archivos temporales innecesariamente
const upload = multer({ storage: multer.memoryStorage() });

router.post('/generate-layout', upload.array('images'), async (req, res) => {
    try {
        const layoutConfig = JSON.parse(req.body.layout);
        const { pageSettings, cells } = layoutConfig;

        // Crear un mapa de imágenes por su nombre para fácil acceso
        const imagesMap = req.files.reduce((map, file) => {
            map[file.originalname] = file.buffer;
            return map;
        }, {});

        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();

        // Configurar tamaño y orientación de la página
        if (pageSettings.orientation === 'landscape') {
            page.setSize(LETTER_HEIGHT_PT, LETTER_WIDTH_PT);
        } else {
            page.setSize(LETTER_WIDTH_PT, LETTER_HEIGHT_PT);
        }

        const { width: pageWidth, height: pageHeight } = page.getSize();
        
        const marginPt = mmToPt(pageSettings.margin);
        const spacingPt = mmToPt(pageSettings.spacing);

        // Calcular área de dibujo
        let drawableWidth = pageWidth - (marginPt * 2);
        let drawableHeight = pageHeight - (marginPt * 2);
        let startY = pageHeight - marginPt;

        if (pageSettings.useHalfPage) {
            drawableHeight /= 2;
            startY = pageHeight - marginPt; // Sigue empezando desde arriba
        }

        // Calcular dimensiones de una celda unitaria
        const totalSpacingX = (pageSettings.baseCols - 1) * spacingPt;
        const totalSpacingY = (pageSettings.baseRows - 1) * spacingPt;
        const cellWidth = (drawableWidth - totalSpacingX) / pageSettings.baseCols;
        const cellHeight = (drawableHeight - totalSpacingY) / pageSettings.baseRows;

        for (const cell of cells) {
            if (!cell.imageName) continue;

            const imageBuffer = imagesMap[cell.imageName];
            if (!imageBuffer) continue;

            // Calcular posición y tamaño de la celda actual
            const cellX = marginPt + cell.col * (cellWidth + spacingPt);
            const cellY = startY - (cell.row * (cellHeight + spacingPt)); // Y va de arriba a abajo
            const currentCellWidth = cell.colSpan * cellWidth + (cell.colSpan - 1) * spacingPt;
            const currentCellHeight = cell.rowSpan * cellHeight + (cell.rowSpan - 1) * spacingPt;

            // Rotar imagen con Sharp si es necesario
            let processedImageBuffer = imageBuffer;
            if (cell.rotation > 0) {
                processedImageBuffer = await sharp(imageBuffer).rotate(cell.rotation).toBuffer();
            }
            
            // Embeber la imagen (detectar tipo)
            let image;
            const isPng = (await sharp(processedImageBuffer).metadata()).format === 'png';
            if (isPng) {
                image = await pdfDoc.embedPng(processedImageBuffer);
            } else {
                image = await pdfDoc.embedJpg(processedImageBuffer);
            }
            
            // Escalar imagen para que quepa en la celda manteniendo la proporción
            const cellAspectRatio = currentCellWidth / currentCellHeight;
            const imageAspectRatio = image.width / image.height;

            let imgWidth, imgHeight;
            if (imageAspectRatio > cellAspectRatio) {
                imgWidth = currentCellWidth;
                imgHeight = imgWidth / imageAspectRatio;
            } else {
                imgHeight = currentCellHeight;
                imgWidth = imgHeight * imageAspectRatio;
            }

            // Centrar la imagen en la celda
            const imgX = cellX + (currentCellWidth - imgWidth) / 2;
            const imgY = (cellY - currentCellHeight) + (currentCellHeight - imgHeight) / 2;

            page.drawImage(image, {
                x: imgX,
                y: imgY,
                width: imgWidth,
                height: imgHeight,
            });
        }

        const pdfBytes = await pdfDoc.save();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=layout.pdf');
        res.send(Buffer.from(pdfBytes));

    } catch (error) {
        console.error('Error generando el layout PDF:', error);
        res.status(500).send('Error al generar el PDF.');
    }
});

module.exports = router;
