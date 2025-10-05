/**
 * Servidor Node.js para la Creación de Collages y Patrones PDF Optimizado.
 * - Rutas separadas para Collage y Patrón.
 * - Sharp optimizado para preservar la calidad.
 */

// 1. Importación de Librerías
const express = require('express');
const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');

// 2. Constantes de Medida
const MM_TO_PT = 2.83465;
const PAGE_WIDTH_MM = 215.9; // 8.5 in
const PAGE_HEIGHT_MM = 279.4; // 11 in
const PAGE_WIDTH_PT = PAGE_WIDTH_MM * MM_TO_PT;
const PAGE_HEIGHT_PT = PAGE_HEIGHT_MM * MM_TO_PT;

// 3. Configuración Inicial
const app = express();
const port = 3000;

// Configuración de Multer
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 100 * 1024 * 1024,
        files: 15
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos de imagen.'), false);
        }
    }
});

// 4. Servir archivos estáticos (el formulario HTML)
app.use(express.static('public'));

// ----------------------------------------------------------------------
// FUNCIÓN COMÚN PARA PROCESAR IMAGEN Y COLOCARLA (Optimización de calidad)
// ----------------------------------------------------------------------
async function processAndPlaceImage(doc, imageBuffer, finalWidth, finalHeight, x_pos, y_pos) {
    let sharpPipeline = sharp(imageBuffer)
        .resize({ 
            width: Math.round(finalWidth), 
            height: Math.round(finalHeight), 
            fit: 'contain', 
            withoutEnlargement: false
        });
    
    // Mejorar la calidad y formato según el tipo de imagen
    const metadata = await sharp(imageBuffer).metadata();
    
    if (metadata.hasAlpha || metadata.channels === 4 || metadata.format === 'png') {
        // Usar PNG para imágenes con transparencia o muchos colores para evitar compresión
        sharpPipeline = sharpPipeline.png({ quality: 100, compressionLevel: 9 });
    } else {
        // Usar JPEG de alta calidad para fotos
        sharpPipeline = sharpPipeline.jpeg({ quality: 98, progressive: true, chromaSubsampling: '4:4:4' });
    }

    const resizedImageBuffer = await sharpPipeline.toBuffer();

    // Colocar la imagen en el PDF
    doc.image(resizedImageBuffer, x_pos, y_pos, {
        width: finalWidth,
        height: finalHeight
    });
}
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// RUTA 1: MODO COLLAGE (Lógica original)
// ----------------------------------------------------------------------
app.post('/generate-pdf/collage', upload.array('images', 15), async (req, res) => {
    const images = req.files;
    const N = images.length;
    
    // Parámetros de la interfaz
    const marginMM = parseFloat(req.body.margin) || 10;
    const pageOrientation = req.body.orientation || 'portrait';
    
    if (N === 0) return res.status(400).send('No se subieron imágenes para el modo Collage.');

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

    // B. Lógica de Cuadrícula (COPIADO DEL FUNCIONAL ORIGINAL)
    let rows, cols;
    
    if (N === 1) {
        rows = 1;
        cols = 1;
    } else {
        const pageRatio = availableWidthPT / availableHeightPT;
        cols = Math.round(Math.sqrt(N * pageRatio));
        rows = Math.ceil(N / cols);
    }
    
    const separationWidth = marginPT * (cols - 1);
    const separationHeight = marginPT * (rows - 1);
    
    const cellAvailableWidth = (availableWidthPT - separationWidth) / cols;
    const cellAvailableHeight = (availableHeightPT - separationHeight) / rows;
    
    // C. Configuración del PDF
    const doc = new PDFDocument({ 
        size: 'LETTER', 
        margin: 0,
        layout: pageOrientation 
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="pdfeitor_collage.pdf"');
    doc.pipe(res);

    try {
        // D. Bucle de Procesamiento y Colocación
        for (let i = 0; i < N; i++) {
            const imageBuffer = images[i].buffer;
            
            // 1. Posicionamiento en la cuadrícula
            const row = Math.floor(i / cols);
            const col = i % cols;
            const x_start = marginPT + col * (cellAvailableWidth + marginPT);
            const y_start = marginPT + row * (cellAvailableHeight + marginPT);

            // 2. Metadata y Ratio
            const metadata = await sharp(imageBuffer).metadata();
            const originalWidth = metadata.width;
            const originalHeight = metadata.height; 
            const originalRatio = originalWidth / originalHeight;

            // 3. Redimensionamiento Inteligente
            const cellRatio = cellAvailableWidth / cellAvailableHeight;

            let finalWidth, finalHeight;
            if (originalRatio > cellRatio) {
                finalWidth = cellAvailableWidth;
                finalHeight = finalWidth / originalRatio;
            } else {
                finalHeight = cellAvailableHeight;
                finalWidth = finalHeight * originalRatio;
            }

            // 4. Centrado y Posición Final
            const x_center_offset = (cellAvailableWidth - finalWidth) / 2;
            const y_center_offset = (cellAvailableHeight - finalHeight) / 2;
            
            const x_pos = x_start + x_center_offset;
            const y_pos = y_start + y_center_offset;

            // 5. Procesa y Coloca la imagen
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
// RUTA 2: MODO PATRÓN (Repetidor de etiquetas)
// ----------------------------------------------------------------------
app.post('/generate-pdf/pattern', upload.array('images', 1), async (req, res) => {
    const images = req.files;
    
    const patternWidthMM = parseFloat(req.body.patternWidthMM) || 50;
    const marginMM = parseFloat(req.body.margin) || 10;
    const pageOrientation = req.body.orientation || 'portrait';

    if (images.length !== 1) {
        return res.status(400).send('El modo Repetidor solo acepta exactamente una imagen.');
    }
    
    const imageBuffer = images[0].buffer;

    // A. Dimensiones y Márgenes (Igual que en Collage)
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
        
        // 1. Dimensiones Fijas
        const fixedWidthPT = patternWidthMM * MM_TO_PT;
        const fixedHeightPT = fixedWidthPT / originalRatio; // Mantiene el ratio!

        // 2. Cálculo de Cuadrícula
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
        const doc = new PDFDocument({ 
            size: 'LETTER', 
            margin: 0,
            layout: pageOrientation 
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="pdfeitor_repetidor.pdf"');
        doc.pipe(res);

        // D. Bucle de Colocación
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x_pos = marginPT + offsetX + c * (fixedWidthPT + marginPT);
                const y_pos = marginPT + offsetY + r * (fixedHeightPT + marginPT);

                // Procesa y Coloca la imagen
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


// 5. RUTA RAÍZ e Inicio del Servidor
app.get('/', (req, res) => {
    // Redirecciona automáticamente al menú principal
    res.redirect('/index.html');
});

app.listen(port, () => {
    console.log(`🚀 Servidor Node.js escuchando en http://localhost:${port}`);
});