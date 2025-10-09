const { PDFDocument, degrees } = require('pdf-lib');
const sharp = require('sharp');
const { LETTER_WIDTH_PT, LETTER_HEIGHT_PT, LEGAL_WIDTH_PT, LEGAL_HEIGHT_PT, mmToPt } = require('./common');

async function generatePlantilla(req, res) {
    try {
        // La configuración vendrá en el cuerpo de la solicitud
        const config = JSON.parse(req.body.config);
        const { pageSettings, pages } = config;

        // Crear un mapa de imágenes para fácil acceso
        const imagesMap = req.files.reduce((map, file) => {
            // El 'originalname' será único, asignado desde el frontend
            map[file.originalname] = file.buffer;
            return map;
        }, {});

        const pdfDoc = await PDFDocument.create();

        // Iterar sobre cada definición de página recibida del frontend
        for (const pageData of pages) {
            const page = pdfDoc.addPage();

            // Configurar tamaño y orientación
            const pageSize = pageSettings.pageSize || 'letter';
            const pageDimensions = {
                letter: { width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT },
                legal: { width: LEGAL_WIDTH_PT, height: LEGAL_HEIGHT_PT }
            };
            const { width, height } = pageDimensions[pageSize];
            if (pageSettings.orientation === 'landscape') {
                page.setSize(height, width);
            } else {
                page.setSize(width, height);
            }

            const { width: pageWidth, height: pageHeight } = page.getSize();
            const marginPt = mmToPt(pageSettings.margin);
            const spacingPt = mmToPt(pageSettings.spacing);

            const drawableWidth = pageWidth - (marginPt * 2);
            const drawableHeight = pageHeight - (marginPt * 2);
            const startY = pageHeight - marginPt;

            // Calcular dimensiones de celda unitaria para esta página
            const totalSpacingX = (pageData.baseCols - 1) * spacingPt;
            const totalSpacingY = (pageData.baseRows - 1) * spacingPt;
            const cellWidth = (drawableWidth - totalSpacingX) / pageData.baseCols;
            const cellHeight = (drawableHeight - totalSpacingY) / pageData.baseRows;

            // Dibujar cada celda de la página
            for (const cell of pageData.cells) {
                if (!cell.image || !cell.image.name) continue;

                const imageBuffer = imagesMap[cell.image.name];
                if (!imageBuffer) continue;

                const cellX = marginPt + cell.col * (cellWidth + spacingPt);
                const cellY = startY - (cell.row * (cellHeight + spacingPt));
                const currentCellWidth = cell.colSpan * cellWidth + (cell.colSpan - 1) * spacingPt;
                const currentCellHeight = cell.rowSpan * cellHeight + (cell.rowSpan - 1) * spacingPt;

                let processedImageBuffer = imageBuffer;
                if (cell.rotation > 0) {
                    processedImageBuffer = await sharp(imageBuffer).rotate(cell.rotation).toBuffer();
                }
                
                const isPng = (await sharp(processedImageBuffer).metadata()).format === 'png';
                const image = isPng ? await pdfDoc.embedPng(processedImageBuffer) : await pdfDoc.embedJpg(processedImageBuffer);
                
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

                const imgX = cellX + (currentCellWidth - imgWidth) / 2;
                const imgY = (cellY - currentCellHeight) + (currentCellHeight - imgHeight) / 2;

                page.drawImage(image, { x: imgX, y: imgY, width: imgWidth, height: imgHeight });
            }
        }

        const pdfBytes = await pdfDoc.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=plantilla.pdf');
        res.send(Buffer.from(pdfBytes));

    } catch (error) {
        console.error('Error generando el PDF de plantilla:', error);
        res.status(500).send('Error al generar el PDF.');
    }
}

module.exports = {
    generatePlantilla
};
