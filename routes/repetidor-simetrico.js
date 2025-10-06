const common = require('./common');
const sharp = require('sharp');

// Algoritmo de layout para repetir una sola imagen en una cuadrícula
function calculateRepetidorLayout(image, containerWidth, containerHeight, cols, rows, spacing) {
    const positions = [];
    
    const cellWidth = (containerWidth - (cols - 1) * spacing) / cols;
    const cellHeight = (containerHeight - (rows - 1) * spacing) / rows;
    console.log(`[REPETIDOR-SIMETRICO] Cuadrícula: ${cols}x${rows}, Celda: ${cellWidth.toFixed(1)}x${cellHeight.toFixed(1)}mm`);

    const imgRatio = image.width / image.height;
    const cellRatio = cellWidth / cellHeight;

    let finalWidth, finalHeight;
    if (imgRatio > cellRatio) {
        finalWidth = cellWidth;
        finalHeight = cellWidth / imgRatio;
    } else {
        finalHeight = cellHeight;
        finalWidth = cellHeight * imgRatio;
    }

    // Llenar todas las celdas de la cuadrícula con la misma imagen
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = col * (cellWidth + spacing) + (cellWidth - finalWidth) / 2;
            const y = row * (cellHeight + spacing) + (cellHeight - finalHeight) / 2;
            positions.push({ x, y, width: finalWidth, height: finalHeight });
        }
    }
    return positions;
}

// Endpoint principal para el repetidor simétrico
async function generateRepetidorSimetrico(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se seleccionó ninguna imagen' });
        }

        const { orientation, margin, spacing, imagesPerRow, rowsPerPage, useHalfPage } = req.body;
        const marginNum = parseFloat(margin) || 10;
        const spacingNum = parseFloat(spacing) || 5;
        const imagesPerRowNum = parseInt(imagesPerRow, 10) || 3;
        const rowsPerRowNum = parseInt(rowsPerPage, 10) || 4;

        // 1. Procesar la única imagen subida
        const metadata = await sharp(req.file.buffer).metadata();
        const image = {
            buffer: req.file.buffer,
            width: metadata.width,
            height: metadata.height,
            dataUrl: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
        };

        // 2. Crear PDF y calcular dimensiones
        const pdf = common.createPDF(orientation);
        const { pageWidth, pageHeight } = common.getPageDimensions(orientation);
        
        const usableWidth = pageWidth - (2 * marginNum);
        let usableHeight = pageHeight - (2 * marginNum);

        if (useHalfPage) {
            console.log('[REPETIDOR-SIMETRICO] Opción de media página activada.');
            usableHeight = (pageHeight / 2) - marginNum;
        }

        // 3. Calcular el layout para la repetición
        const layout = calculateRepetidorLayout(image, usableWidth, usableHeight, imagesPerRowNum, rowsPerRowNum, spacingNum);

        // 4. Agregar la imagen repetidamente al PDF
        for (const item of layout) {
            pdf.addImage(
                image.dataUrl,
                'JPEG',
                marginNum + item.x,
                marginNum + item.y,
                item.width,
                item.height
            );
        }

        const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="repetidor-simetrico.pdf"');
        res.send(pdfBuffer);

    } catch (error) {
        console.error('[REPETIDOR-SIMETRICO] Error:', error);
        res.status(500).json({ error: 'Error generando PDF: ' + error.message });
    }
}

module.exports = {
    generateRepetidorSimetrico
};
