// server.js - Versión Final y de Máxima Calidad

// 1. Importar librerías
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');

// 2. Constantes de Medida
const MM_TO_PT = 2.83465;
const PAGE_WIDTH_MM = 215.9; // Carta
const PAGE_HEIGHT_MM = 279.4; // Carta
const PAGE_WIDTH_PT = PAGE_WIDTH_MM * MM_TO_PT;
const PAGE_HEIGHT_PT = PAGE_HEIGHT_MM * MM_TO_PT;

// 3. Configuración Inicial
const app = express();
const port = 3000;
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024, files: 15 }, // Aumentado a 100MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos de imagen.'), false);
        }
    }
});

// 4. Servir archivos estáticos
app.use(express.static('public'));


// ----------------------------------------------------------------------
// FUNCIÓN DE PROCESAMIENTO DE IMAGEN DE ALTA CALIDAD (P2 Corregida)
// ----------------------------------------------------------------------
async function processAndPlaceImage(doc, imageBuffer, finalWidth, finalHeight, x_pos, y_pos) {
    let sharpPipeline = sharp(imageBuffer)
        .resize({ 
            width: Math.round(finalWidth), 
            height: Math.round(finalHeight), 
            fit: 'contain', 
            withoutEnlargement: false
        });
    
    // Esta lógica garantiza la MÁXIMA CALIDAD al achicar
    const metadata = await sharp(imageBuffer).metadata();
    
    if (metadata.hasAlpha || metadata.channels === 4 || metadata.format === 'png') {
        // PNG 100% de calidad para preservar detalles y transparencia.
        sharpPipeline = sharpPipeline.png({ quality: 100, compressionLevel: 9 });
    } else {
        // JPEG 99 de calidad (máximo detalle para fotos, superior a 95).
        sharpPipeline = sharpPipeline.jpeg({ quality: 99, progressive: true, chromaSubsampling: '4:4:4' });
    }

    const resizedImageBuffer = await sharpPipeline.toBuffer();

    doc.image(resizedImageBuffer, x_pos, y_pos, {
        width: finalWidth,
        height: finalHeight
    });
}
// ----------------------------------------------------------------------


// ----------------------------------------------------------------------
// RUTA 1: MODO COLLAGE (/generate-pdf/collage)
// ----------------------------------------------------------------------
app.post('/generate-pdf/collage', upload.array('images', 15), async (req, res) => {
    const images = req.files;
    const marginMM = parseFloat(req.body.margin) || 10;
    const pageOrientation = req.body.orientation || 'portrait';
    const N = images.length;

    if (N === 0) return res.status(400).send('No se subieron imágenes.');

    // A. Dimensiones y Márgenes
    const marginPT = marginMM * MM_TO_PT;
    let currentPageWidth, currentPageHeight;
    
    if (pageOrientation === 'landscape') {
        currentPageWidth = PAGE_HEIGHT_PT; 
        currentPageHeight = PAGE_WIDTH_PT; 
    } else { 
        currentPageWidth = PAGE_WIDTH_PT;
        currentPageHeight = PAGE_HEIGHT_PT;
    }
    
    const availableWidthPT = currentPageWidth - (marginPT * 2);
    const availableHeightPT = currentPageHeight - (marginPT * 2);

    // B. Lógica de Cuadrícula (Optimización original)
    let rows, cols;
    if (availableWidthPT > availableHeightPT) {
        cols = Math.ceil(Math.sqrt(N * availableWidthPT / availableHeightPT));
        rows = Math.ceil(N / cols);
    } else {
        rows = Math.ceil(Math.sqrt(N * availableHeightPT / availableWidthPT));
        cols = Math.ceil(N / rows);
    }
    while (rows * cols < N) {
        if (cols < rows) {
            cols++;
        } else {
            rows++;
        }
    }
    
    // C. Configuración de Celda
    const cellMarginPT = marginPT;
    const separationWidth = cellMarginPT * (cols - 1);
    const separationHeight = cellMarginPT * (rows - 1);

    const cellAvailableWidth = (availableWidthPT - separationWidth) / cols;
    const cellAvailableHeight = (availableHeightPT - separationHeight) / rows;

    // D. Configuración del PDF
    const doc = new PDFDocument({ size: 'LETTER', margin: 0, layout: pageOrientation });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="pdfeitor_collage.pdf"');
    doc.pipe(res);

    try {
        // E. Bucle de Procesamiento y Colocación
        for (let i = 0; i < N; i++) {
            const imageBuffer = images[i].buffer;
            
            const row = Math.floor(i / cols);
            const col = i % cols;
            
            const x_start = marginPT + col * (cellAvailableWidth + cellMarginPT);
            const y_start = marginPT + row * (cellAvailableHeight + cellMarginPT);

            const metadata = await sharp(imageBuffer).metadata();
            const originalWidth = metadata.width;
            
            // FIX P1: Se corrigió la lectura de la altura de la metadata
            const originalHeight = metadata.height; 
            
            const originalRatio = originalWidth / originalHeight; 

            // Redimensionamiento Inteligente
            const targetRatio = cellAvailableWidth / cellAvailableHeight;
            let finalWidth, finalHeight;
            
            if (originalRatio > targetRatio) {
                finalWidth = cellAvailableWidth;
                finalHeight = finalWidth / originalRatio;
            } else {
                finalHeight = cellAvailableHeight;
                finalWidth = finalHeight * originalRatio;
            }

            // Centrado
            const x_center_offset = (cellAvailableWidth - finalWidth) / 2;
            const y_center_offset = (cellAvailableHeight - finalHeight) / 2;
            
            const x_pos = x_start + x_center_offset;
            const y_pos = y_start + y_center_offset;

            // Procesar con máxima calidad
            await processAndPlaceImage(doc, imageBuffer, finalWidth, finalHeight, x_pos, y_pos);

            console.log(`Collage Imagen ${i+1}/${N} procesada.`);
        }

        doc.end();

    } catch (error) {
        console.error('Error en modo Collage:', error);
        if (!res.headersSent) {
            doc.end();
            res.status(500).send(`Error en el modo Collage: ${error.message}`);
        }
    }
});


// ----------------------------------------------------------------------
// RUTA 2: MODO PATRÓN (/generate-pdf/pattern)
// ----------------------------------------------------------------------
app.post('/generate-pdf/pattern', upload.array('images', 1), async (req, res) => {
    const images = req.files;
    const patternWidthMM = parseFloat(req.body.patternWidthMM) || 40;
    const marginMM = parseFloat(req.body.margin) || 10;
    const pageOrientation = req.body.orientation || 'portrait';

    if (images.length !== 1) {
        return res.status(400).send('El modo Repetidor solo acepta exactamente una imagen.');
    }
    
    const imageBuffer = images[0].buffer;

    // A. Dimensiones y Márgenes
    const marginPT = marginMM * MM_TO_PT;
    let currentPageWidth, currentPageHeight;
    
    if (pageOrientation === 'landscape') {
        currentPageWidth = PAGE_HEIGHT_PT; 
        currentPageHeight = PAGE_WIDTH_PT; 
    } else { 
        currentPageWidth = PAGE_WIDTH_PT;
        currentPageHeight = PAGE_HEIGHT_PT;
    }
    
    const availableWidthPT = currentPageWidth - (marginPT * 2);
    const availableHeightPT = currentPageHeight - (marginPT * 2);

    // B. Lógica del Repetidor
    try {
        const metadata = await sharp(imageBuffer).metadata();
        const originalRatio = metadata.width / metadata.height;
        
        const fixedWidthPT = patternWidthMM * MM_TO_PT;
        const fixedHeightPT = fixedWidthPT / originalRatio;

        const spacePerImageWidth = fixedWidthPT + marginPT;
        const spacePerImageHeight = fixedHeightPT + marginPT;
        
        const cols = Math.floor(availableWidthPT / spacePerImageWidth);
        const rows = Math.floor(availableHeightPT / spacePerImageHeight);
        
        if (rows * cols === 0) {
             return res.status(400).send('La etiqueta es demasiado grande para caber en la página con los márgenes seleccionados.');
        }

        // 3. Desplazamiento (para centrar toda la cuadrícula)
        const totalPatternWidth = (fixedWidthPT * cols) + (marginPT * (cols - 1));
        const totalPatternHeight = (fixedHeightPT * rows) + (marginPT * (rows - 1));
        
        const offsetX = (availableWidthPT - totalPatternWidth) / 2;
        const offsetY = (availableHeightPT - totalPatternHeight) / 2;
        
        // C. Configuración del PDF
        const doc = new PDFDocument({ size: 'LETTER', margin: 0, layout: pageOrientation });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="pdfeitor_repetidor.pdf"');
        doc.pipe(res);

        // D. Bucle de Colocación
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x_pos = marginPT + offsetX + c * (fixedWidthPT + marginPT);
                const y_pos = marginPT + offsetY + r * (fixedHeightPT + marginPT);

                // Procesar con máxima calidad
                await processAndPlaceImage(doc, imageBuffer, fixedWidthPT, fixedHeightPT, x_pos, y_pos);
            }
        }
        
        doc.end();

    } catch (error) {
        console.error('Error en modo Repetidor:', error);
        if (!res.headersSent) {
            doc.end();
            res.status(500).send(`Error en el modo Repetidor: ${error.message}`);
        }
    }
});


// 5. RUTA RAÍZ
app.get('/', (req, res) => {
    // Redirecciona al menú principal
    res.redirect('/index.html');
});

// 6. Iniciar el servidor
app.listen(port, () => {
    console.log(`🚀 Servidor Node.js escuchando en http://localhost:${port}`);
});