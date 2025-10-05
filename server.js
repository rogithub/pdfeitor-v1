const express = require('express');
const multer = require('multer');
const { jsPDF } = require('jspdf');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de multer
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/collage', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'collage.html'));
});

app.get('/repetidor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'repetidor.html'));
});

// Función para obtener dimensiones REALES de la imagen
function getImageDimensions(buffer) {
  return new Promise((resolve) => {
    // Para JPEG
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      let offset = 2;
      while (offset < buffer.length) {
        if (buffer[offset] === 0xFF && buffer[offset + 1] === 0xC0) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          resolve({ width, height });
          return;
        }
        offset++;
      }
    }
    // Para PNG
    else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      resolve({ width, height });
      return;
    }
    
    // Si no podemos determinar las dimensiones, usar valores por defecto
    resolve({ width: 800, height: 600 });
  });
}

// ALGORITMO SIMPLE Y EFECTIVO PARA MÚLTIPLES IMÁGENES (inspirado en main branch)
function calculateGridLayout(images, containerWidth, containerHeight, spacing) {
  const positions = [];
  const numImages = images.length;

  if (numImages === 0) return positions;

  // PARA UNA SOLA IMAGEN - COMPORTAMIENTO ACTUAL (NO CAMBIAR)
  if (numImages === 1) {
    const img = images[0];
    const imgRatio = img.width / img.height;
    const containerRatio = containerWidth / containerHeight;

    let width, height;
    
    if (imgRatio > containerRatio) {
      width = containerWidth;
      height = containerWidth / imgRatio;
    } else {
      height = containerHeight;
      width = containerHeight * imgRatio;
    }

    const x = (containerWidth - width) / 2;
    const y = (containerHeight - height) / 2;

    positions.push({
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.min(width, containerWidth),
      height: Math.min(height, containerHeight),
      image: img
    });
    
    return positions;
  }

  // PARA MÚLTIPLES IMÁGENES - APPROACH SIMPLE Y CONFIABLE
  console.log(`Organizando ${numImages} imágenes en grid`);

  // Calcular número óptimo de columnas y filas
  let cols, rows;
  
  if (numImages <= 4) {
    // Para pocas imágenes, usar grid cuadrado
    cols = Math.ceil(Math.sqrt(numImages));
    rows = Math.ceil(numImages / cols);
  } else {
    // Para más imágenes, optimizar para llenar espacio
    const containerRatio = containerWidth / containerHeight;
    cols = Math.ceil(Math.sqrt(numImages * containerRatio));
    rows = Math.ceil(numImages / cols);
    
    // Ajustar para minimizar celdas vacías
    while ((cols * rows) - numImages >= cols) {
      cols++;
      rows = Math.ceil(numImages / cols);
    }
  }

  // Calcular dimensiones de celda
  const cellWidth = (containerWidth - (cols - 1) * spacing) / cols;
  const cellHeight = (containerHeight - (rows - 1) * spacing) / rows;

  console.log(`Grid: ${cols} columnas x ${rows} filas, Celda: ${cellWidth.toFixed(1)}x${cellHeight.toFixed(1)}mm`);

  // Colocar cada imagen en su celda correspondiente
  for (let i = 0; i < numImages; i++) {
    const img = images[i];
    const row = Math.floor(i / cols);
    const col = i % cols;
    
    const imgRatio = img.width / img.height;
    const cellRatio = cellWidth / cellHeight;

    // Calcular dimensiones manteniendo relación de aspecto
    let width, height;
    
    if (imgRatio > cellRatio) {
      // Imagen más ancha que la celda - usar ancho completo
      width = cellWidth;
      height = cellWidth / imgRatio;
    } else {
      // Imagen más alta que la celda - usar alto completo
      height = cellHeight;
      width = cellHeight * imgRatio;
    }

    // Centrar la imagen en la celda
    const x = col * (cellWidth + spacing) + (cellWidth - width) / 2;
    const y = row * (cellHeight + spacing) + (cellHeight - height) / 2;

    positions.push({ 
      x: x, 
      y: y, 
      width: width, 
      height: height, 
      image: img
    });

    console.log(`Imagen ${i+1}: celda(${col},${row}), pos(${x.toFixed(1)},${y.toFixed(1)}), tamaño(${width.toFixed(1)}x${height.toFixed(1)})`);
  }

  return positions;
}

// Endpoint para collage - VERSIÓN CONFIABLE
app.post('/generate-collage', upload.array('images', 12), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se seleccionaron imágenes' });
    }

    const { orientation, margin, spacing } = req.body;
    const marginNum = parseFloat(margin) || 5;
    const spacingNum = parseFloat(spacing) || 2;

    console.log('Generando collage con:', {
      numImages: req.files.length,
      orientation,
      margin: marginNum,
      spacing: spacingNum
    });

    // Procesar imágenes con dimensiones REALES
    const images = [];
    for (const file of req.files) {
      const dimensions = await getImageDimensions(file.buffer);
      images.push({
        buffer: file.buffer,
        width: dimensions.width,
        height: dimensions.height,
        dataUrl: 'data:' + file.mimetype + ';base64,' + file.buffer.toString('base64')
      });
    }

    // Crear PDF
    const pdf = new jsPDF({
      orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    // Dimensiones página carta en mm
    const pageWidth = orientation === 'landscape' ? 279.4 : 215.9;
    const pageHeight = orientation === 'landscape' ? 215.9 : 279.4;

    // Área utilizable
    const usableWidth = pageWidth - (2 * marginNum);
    const usableHeight = pageHeight - (2 * marginNum);

    console.log(`Área utilizable: ${usableWidth}x${usableHeight}mm`);

    // Calcular layout (grid simple y confiable)
    const layout = calculateGridLayout(images, usableWidth, usableHeight, spacingNum);

    // Agregar imágenes al PDF
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

    // Enviar PDF
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="collage.pdf"');
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error en collage:', error);
    res.status(500).json({ error: 'Error generando PDF: ' + error.message });
  }
});

// Endpoint para repetidor - MANTENER EXACTAMENTE IGUAL (FUNCIONALIDAD MARAVILLOSA)
app.post('/generate-repetidor', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se seleccionó imagen' });
    }

    const { orientation, margin, spacing, imageWidth } = req.body;
    const marginNum = parseFloat(margin) || 5;
    const spacingNum = parseFloat(spacing) || 2;
    const imageWidthNum = parseFloat(imageWidth) || 50;

    // Procesar imagen con dimensiones REALES
    const dimensions = await getImageDimensions(req.file.buffer);
    const imgRatio = dimensions.width / dimensions.height;
    const imageHeightNum = imageWidthNum / imgRatio;
    
    const dataUrl = 'data:' + req.file.mimetype + ';base64,' + req.file.buffer.toString('base64');

    // Crear PDF
    const pdf = new jsPDF({
      orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    // Dimensiones página
    const pageWidth = orientation === 'landscape' ? 279.4 : 215.9;
    const pageHeight = orientation === 'landscape' ? 215.9 : 279.4;

    // Área utilizable
    const usableWidth = pageWidth - (2 * marginNum);
    const usableHeight = pageHeight - (2 * marginNum);

    // Calcular cuántas caben
    const cols = Math.floor((usableWidth + spacingNum) / (imageWidthNum + spacingNum));
    const rows = Math.floor((usableHeight + spacingNum) / (imageHeightNum + spacingNum));

    console.log(`Repetidor: ${cols}x${rows} imágenes de ${imageWidthNum}x${imageHeightNum}mm`);

    // Agregar imágenes repetidas
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = marginNum + col * (imageWidthNum + spacingNum);
        const y = marginNum + row * (imageHeightNum + spacingNum);
        
        pdf.addImage(dataUrl, 'JPEG', x, y, imageWidthNum, imageHeightNum);
      }
    }

    // Enviar PDF
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="repetidor.pdf"');
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error en repetidor:', error);
    res.status(500).json({ error: 'Error generando PDF: ' + error.message });
  }
});

// Manejo de errores
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('Error Multer:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Archivo demasiado grande' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Campo de archivo inesperado' });
    }
  }
  console.error('Error general:', error);
  res.status(500).json({ error: error.message });
});

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});