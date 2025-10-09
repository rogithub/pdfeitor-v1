const { PDFDocument, degrees } = require('pdf-lib');
const sharp = require('sharp');
const { LETTER_WIDTH_PT, LETTER_HEIGHT_PT, LEGAL_WIDTH_PT, LEGAL_HEIGHT_PT, mmToPt } = require('./common');

async function generateMultiPagina(req, res) {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No se enviaron imágenes.' });
        }

        const pageSettings = JSON.parse(req.body.pageSettings);
        const marginPt = mmToPt(pageSettings.margin || 10);

        const pdfDoc = await PDFDocument.create();

        for (const file of req.files) {
            const imageBuffer = file.buffer;
            const imageMetadata = await sharp(imageBuffer).metadata();

            // Determinar la orientación de la página basada en la imagen
            const imageIsLandscape = imageMetadata.width > imageMetadata.height;
            
            const pageDimensions = {
                letter: { width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT },
                legal: { width: LEGAL_WIDTH_PT, height: LEGAL_HEIGHT_PT }
            };
            const { width: pageWidthPt, height: pageHeightPt } = pageDimensions[pageSettings.pageSize || 'letter'];

            const page = pdfDoc.addPage();
            if (imageIsLandscape) {
                page.setSize(pageHeightPt, pageWidthPt);
            } else {
                page.setSize(pageWidthPt, pageHeightPt);
            }
            
            const { width: currentPageWidth, height: currentPageHeight } = page.getSize();

            // Área de dibujo
            const drawableWidth = currentPageWidth - (marginPt * 2);
            const drawableHeight = currentPageHeight - (marginPt * 2);

            // Embeber la imagen
            let image;
            if (imageMetadata.format === 'png') {
                image = await pdfDoc.embedPng(imageBuffer);
            } else {
                image = await pdfDoc.embedJpg(imageBuffer);
            }

            // Lógica de auto-rotación y escalado
            const cellAspectRatio = drawableWidth / drawableHeight;
            const imageAspectRatio = image.width / image.height;

            let imgWidth, imgHeight;
            let rotation = 0;

            // Comprobar si la orientación de la imagen coincide con la del contenedor
            const imageOrientation = image.width > image.height ? 'landscape' : 'portrait';
            const cellOrientation = drawableWidth > drawableHeight ? 'landscape' : 'portrait';

            if (imageOrientation !== cellOrientation) {
                // Si no coinciden, rotamos la imagen 90 grados
                rotation = 90;
                const rotatedImageAspectRatio = image.height / image.width; // Invertir aspect ratio
                 if (rotatedImageAspectRatio > cellAspectRatio) {
                    imgWidth = drawableWidth;
                    imgHeight = imgWidth / rotatedImageAspectRatio;
                } else {
                    imgHeight = drawableHeight;
                    imgWidth = imgHeight * rotatedImageAspectRatio;
                }
            } else {
                // Si coinciden, procedemos como antes
                if (imageAspectRatio > cellAspectRatio) {
                    imgWidth = drawableWidth;
                    imgHeight = imgWidth / imageAspectRatio;
                } else {
                    imgHeight = drawableHeight;
                    imgWidth = imgHeight * imageAspectRatio;
                }
            }

            // Centrar la imagen
            const imgX = marginPt + (drawableWidth - imgWidth) / 2;
            const imgY = marginPt + (drawableHeight - imgHeight) / 2;

            page.drawImage(image, {
                x: imgX,
                y: imgY,
                width: imgWidth,
                height: imgHeight,
                rotate: degrees(rotation),
            });
        }

        const pdfBytes = await pdfDoc.save();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=multi-pagina.pdf');
        res.send(Buffer.from(pdfBytes));

    } catch (error) {
        console.error('Error generando el PDF multi-página:', error);
        res.status(500).send('Error al generar el PDF.');
    }
}

module.exports = {
    generateMultiPagina
};
