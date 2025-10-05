/**
 * Servidor Node.js para la Creación de Collages PDF Optimizado.
 * - Utiliza Express para el servidor.
 * - Multer para la gestión de subida de archivos en memoria.
 * - Sharp para el redimensionamiento de alta calidad (mantiene el ratio).
 * - PDFKit para la generación del documento tamaño Carta (Letter).
 */

// 1. Importación de Librerías
const express = require('express');
const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');

// 2. Constantes de Medida
// Conversión: 1 mm = 2.83465 puntos (pt)
const MM_TO_PT = 2.83465;

// Dimensiones de la página Carta (Letter) en milímetros
const PAGE_WIDTH_MM = 215.9; // 8.5 in
const PAGE_HEIGHT_MM = 279.4; // 11 in

// Dimensiones de la página Carta en PUNTOS (pt)
const PAGE_WIDTH_PT = PAGE_WIDTH_MM * MM_TO_PT; // ~ 612 pts
const PAGE_HEIGHT_PT = PAGE_HEIGHT_MM * MM_TO_PT; // ~ 792 pts

// 3. Configuración Inicial
const app = express();
const port = 3000;

// Configuración de Multer: Almacenamiento en memoria para procesamiento rápido
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 100 * 1024 * 1024, // Limite de 100MB por archivo (más seguro)
        files: 15 // Máximo 15 archivos en una sola subida
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

// 5. RUTA PRINCIPAL: Procesamiento de Imágenes y Generación de PDF
app.post('/generate-pdf', upload.array('images', 15), async (req, res) => {
    const images = req.files;
    const marginMM = parseFloat(req.body.margin) || 10;
    const pageOrientation = req.body.orientation || 'portrait';
    const N = images.length;

    if (N === 0) {
        return res.status(400).send('No se subieron imágenes para procesar.');
    }

    // A. Dimensiones y Márgenes
    const marginPT = marginMM * MM_TO_PT;
    let currentPageWidth, currentPageHeight;
    
    // Configura el ancho y alto según la orientación elegida por el usuario
    if (pageOrientation === 'landscape') {
        currentPageWidth = PAGE_HEIGHT_PT; 
        currentPageHeight = PAGE_WIDTH_PT; 
    } else { 
        currentPageWidth = PAGE_WIDTH_PT;
        currentPageHeight = PAGE_HEIGHT_PT;
    }
    
    // Espacio total disponible para las imágenes (quitando márgenes de página)
    const availableWidthPT = currentPageWidth - (marginPT * 2);
    const availableHeightPT = currentPageHeight - (marginPT * 2);

    // B. Optimización de la Cuadrícula (Rows x Cols)
    let rows, cols;
    
    if (N === 1) {
        // Caso simple: 1 imagen usa la celda completa.
        rows = 1;
        cols = 1;
    } else {
        // Caso Collage: Algoritmo para optimizar el uso del espacio total.
        // Se calcula la cuadrícula más eficiente considerando la proporción del espacio disponible.
        const pageRatio = availableWidthPT / availableHeightPT;
        
        // Calcular la dimensión base (la raíz cuadrada de N, ajustada por el ratio de la página)
        cols = Math.round(Math.sqrt(N * pageRatio));
        rows = Math.ceil(N / cols);
        
        // Ajuste fino para evitar filas/columnas vacías o excesivas
        if (rows * cols < N) {
            rows = Math.ceil(N / cols);
        }
        
        // Si hay una fila casi vacía (e.g., 6 imgs en 3x3), intentar 2x3 o 3x2.
        if (rows * cols > N + 1 && cols > 1) {
            // Reajustar a la combinación más cercana y eficiente.
            let c1 = Math.ceil(Math.sqrt(N));
            let r1 = Math.ceil(N / c1);
            
            if (r1 * c1 <= N + 1) { // Si la cuadrícula cuadrada es mejor
                rows = r1;
                cols = c1;
            }
        }
        
        // Último chequeo para asegurar que N quepa
        while (rows * cols < N) {
            // Prioriza añadir columnas si la página es ancha, o filas si es alta
            if (availableWidthPT > availableHeightPT) {
                cols++;
            } else {
                rows++;
            }
        }
    }
    
    // C. Dimensiones de la Celda (Espacio que tiene cada imagen para expandirse)
    let cellAvailableWidth, cellAvailableHeight;

    if (N === 1) {
        // Para 1 imagen, la celda es el espacio disponible completo (máximo uso)
        cellAvailableWidth = availableWidthPT;
        cellAvailableHeight = availableHeightPT;
    } else {
        // Para varias, descontar el margen ENTRE las imágenes (N-1 separaciones)
        const separationWidth = marginPT * (cols - 1);
        const separationHeight = marginPT * (rows - 1);
        
        cellAvailableWidth = (availableWidthPT - separationWidth) / cols;
        cellAvailableHeight = (availableHeightPT - separationHeight) / rows;
    }

    // D. Configuración del PDF y Respuesta
    const doc = new PDFDocument({ 
        size: 'LETTER', 
        margin: 0,
        layout: pageOrientation 
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="collage.pdf"');
    doc.pipe(res);

    try {
        // E. Bucle de Procesamiento y Colocación
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
            const originalHeight = metadata.height; // <--- CORRECCIÓN CLAVE
            
            if (!originalWidth || !originalHeight) {
                console.warn(`Imagen ${i+1}: No se pudo leer el ancho/alto.`);
                continue;
            }
            
            const originalRatio = originalWidth / originalHeight;

            // 3. Redimensionamiento Inteligente (Mantener Ratio)
            let finalWidth, finalHeight;
            const cellRatio = cellAvailableWidth / cellAvailableHeight;

            if (originalRatio > cellRatio) {
                // Imagen más ancha que la celda -> Ajustar por ancho
                finalWidth = cellAvailableWidth;
                finalHeight = finalWidth / originalRatio;
            } else {
                // Imagen más alta que la celda -> Ajustar por alto
                finalHeight = cellAvailableHeight;
                finalWidth = finalHeight * originalRatio;
            }

            // 4. Centrado y Posición Final
            const x_center_offset = (cellAvailableWidth - finalWidth) / 2;
            const y_center_offset = (cellAvailableHeight - finalHeight) / 2;
            
            const x_pos = x_start + x_center_offset;
            const y_pos = y_start + y_center_offset;

            // 5. Sharp: Redimensionar con Alta Calidad
            let sharpPipeline = sharp(imageBuffer)
                .resize({ 
                    width: Math.round(finalWidth), 
                    height: Math.round(finalHeight), 
                    fit: 'contain', 
                    withoutEnlargement: false // Permitir ampliación si es necesario (para N=1)
                });
                
            // Forzar alta calidad: PNG para transparencia, JPEG para fotos (evita pérdida de calidad)
            if (metadata.hasAlpha || metadata.channels === 4 || metadata.format === 'png') {
                sharpPipeline = sharpPipeline.png({ quality: 100, compressionLevel: 9 });
            } else {
                sharpPipeline = sharpPipeline.jpeg({ quality: 95, progressive: true, chromaSubsampling: '4:4:4' });
            }

            const resizedImageBuffer = await sharpPipeline.toBuffer();

            // 6. PDFKit: Colocar la imagen
            doc.image(resizedImageBuffer, x_pos, y_pos, {
                width: finalWidth,
                height: finalHeight
            });

            console.log(`Imagen ${i+1}/${N} procesada. Celda: ${rows}x${cols}.`);
        }

        // F. Finalizar el documento
        doc.end();

    } catch (error) {
        console.error('Error interno del servidor:', error);
        if (!res.headersSent) {
            res.status(500).send(`Error al procesar las imágenes: ${error.message}`);
        }
    }
});


// 6. RUTA RAÍZ e Inicio del Servidor
app.get('/', (req, res) => {
    // Redirecciona automáticamente al formulario para facilitar el acceso
    res.redirect('/index.html');
});

app.listen(port, () => {
    console.log(`🚀 Servidor Node.js escuchando en http://localhost:${port}`);
    console.log('Presiona CTRL+C para detener el servidor.');
});