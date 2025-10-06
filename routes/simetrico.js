const common = require('./common');
const sharp = require('sharp');

// Nueva función para procesar y rotar imágenes con Sharp
async function processAndRotateImages(files, forceOrientation) {
    const images = [];
    
    // Primero, obtenemos las dimensiones de todas las imágenes
    for (const file of files) {
        const metadata = await sharp(file.buffer).metadata();
        images.push({
            buffer: file.buffer,
            width: metadata.width,
            height: metadata.height,
            mimetype: file.mimetype
        });
    }

    // Determinamos la orientación objetivo (si es automática)
    let targetOrientation;
    if (forceOrientation === 'portrait' || forceOrientation === 'landscape') {
        targetOrientation = forceOrientation;
    } else {
        const verticals = images.filter(img => img.height > img.width);
        targetOrientation = verticals.length > images.length / 2 ? 'portrait' : 'landscape';
    }
    console.log(`[SIMETRICO-SHARP] Orientación objetivo final: ${targetOrientation}.`);

    // Rotamos las imágenes que lo necesiten
    const processedImages = [];
    for (const img of images) {
        const isVertical = img.height > img.width;
        const needsRotation = (targetOrientation === 'portrait' && !isVertical) || (targetOrientation === 'landscape' && isVertical);

        if (needsRotation) {
            console.log('[SIMETRICO-SHARP] Rotando una imagen...');
            const rotatedBuffer = await sharp(img.buffer).rotate(90).toBuffer();
            processedImages.push({
                buffer: rotatedBuffer,
                width: img.height, // Dimensiones intercambiadas post-rotación
                height: img.width,
                dataUrl: `data:${img.mimetype};base64,${rotatedBuffer.toString('base64')}`
            });
        } else {
            processedImages.push({
                ...img,
                dataUrl: `data:${img.mimetype};base64,${img.buffer.toString('base64')}`
            });
        }
    }
    return processedImages;
}


// Algoritmo de layout actualizado para usar una cuadrícula fija
function calculateSymmetricLayout(images, containerWidth, containerHeight, imagesPerRow, rowsPerPage, spacing) {
    const numImages = images.length;
    if (numImages === 0) return [];

    // La cuadrícula ahora es fija, definida por el usuario
    const cols = parseInt(imagesPerRow, 10);
    const rows = parseInt(rowsPerPage, 10);
    
    const cellWidth = (containerWidth - (cols - 1) * spacing) / cols;
    const cellHeight = (containerHeight - (rows - 1) * spacing) / rows;
    console.log(`[SIMETRICO-LAYOUT] Cuadrícula Fija: ${cols}x${rows}, Celda: ${cellWidth.toFixed(1)}x${cellHeight.toFixed(1)}mm`);

    const positions = [];
    // El bucle solo itera sobre las imágenes disponibles, llenando la cuadrícula desde el inicio
    for (let i = 0; i < numImages; i++) {
        const img = images[i];
        const row = Math.floor(i / cols);
        const col = i % cols;

        // Si se suben más imágenes de las que caben en la cuadrícula, se ignoran las sobrantes.
        if (row >= rows) {
            console.log(`[SIMETRICO-LAYOUT] Advertencia: La imagen ${i+1} está fuera de la cuadrícula definida (${cols}x${rows}) y será ignorada.`);
            continue;
        }

        const imgRatio = img.width / img.height;
        const cellRatio = cellWidth / cellHeight;

        let finalWidth, finalHeight;
        if (imgRatio > cellRatio) {
            finalWidth = cellWidth;
            finalHeight = cellWidth / imgRatio;
        } else {
            finalHeight = cellHeight;
            finalWidth = cellHeight * imgRatio;
        }

        const x = col * (cellWidth + spacing) + (cellWidth - finalWidth) / 2;
        const y = row * (cellHeight + spacing) + (cellHeight - finalHeight) / 2;

        positions.push({ x, y, width: finalWidth, height: finalHeight, image: img });
    }
    return positions;
}


// Endpoint principal actualizado con la nueva lógica de cuadrícula fija
async function generateSimetrico(req, res) {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No se seleccionaron imágenes' });
        }

        const { orientation, margin, spacing, imagesPerRow, forceOrientation, rowsPerPage } = req.body;
        const marginNum = parseFloat(margin) || 10;
        const spacingNum = parseFloat(spacing) || 5;
        const imagesPerRowNum = parseInt(imagesPerRow, 10) || 2;
        // Si no se especifica rowsPerPage, se calcula dinámicamente como antes para no romper la funcionalidad original.
        const rowsPerRowNum = parseInt(rowsPerPage, 10) || Math.ceil(req.files.length / imagesPerRowNum);


        // 1. Procesar y rotar imágenes primero con Sharp
        const images = await processAndRotateImages(req.files, forceOrientation);

        // 2. Crear PDF y calcular layout en una sola página
        const pdf = common.createPDF(orientation);
        const { pageWidth, pageHeight } = common.getPageDimensions(orientation);
        const usableWidth = pageWidth - (2 * marginNum);
        const usableHeight = pageHeight - (2 * marginNum);

        // Se pasa rowsPerRowNum a la función de layout
        const layout = calculateSymmetricLayout(images, usableWidth, usableHeight, imagesPerRowNum, rowsPerRowNum, spacingNum);

        // 3. Agregar imágenes al PDF
        for (const item of layout) {
            pdf.addImage(
                item.image.dataUrl,
                'JPEG',
                marginNum + item.x,
                marginNum + item.y,
                item.width,
                item.height
            );
        }

        const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="simetrico.pdf"');
        res.send(pdfBuffer);

    } catch (error) {
        console.error('[SIMETRICO] Error:', error);
        res.status(500).json({ error: 'Error generando PDF: ' + error.message });
    }
}

module.exports = {
    generateSimetrico
};
