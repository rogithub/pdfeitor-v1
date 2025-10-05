const express = require('express');
const multer = require('multer');
const { jsPDF } = require('jspdf');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de multer - CORREGIDO
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

// Algoritmo mejorado para layout
function calculateImageLayout(images, containerWidth, containerHeight, spacing) {
  const positions = [];
  const numImages = images.length;

  if (numImages === 0) return positions;

  // Para una sola imagen - OCUPAR TODO EL ESPACIO MANTENIENDO RATIO
  if (numImages === 1) {
    const img = images[0];
    const imgRatio = img.width / img.height;
    const containerRatio = containerWidth / containerHeight;

    let width, height;
    
    if (imgRatio > containerRatio) {
      // Imagen más ancha que el contenedor
      width = containerWidth;
      height = containerWidth / imgRatio;
    } else {
      // Imagen más alta que el contenedor
      height = containerHeight;
      width = containerHeight * imgRatio;
    }

    // Centrar la imagen
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

  // Para múltiples imágenes
  let cols = Math.ceil(Math.sqrt(numImages));
  let rows = Math.ceil(numImages / cols);
  
  // Ajustar grid para mejor uso del espacio
  const areaRatio = containerWidth / containerHeight;
  if (areaRatio > 1.2 && numImages > 2) {
    cols = Math.min(Math.ceil(Math.sqrt(numImages * areaRatio)), numImages);
    rows = Math.ceil(numImages / cols);
  }

  // Calcular tamaño de celda
  const cellWidth = (containerWidth - (cols - 1) * spacing) / cols;
  const cellHeight = (containerHeight - (rows - 1) * spacing) / rows;

  // Distribuir imágenes
  for (let i = 0; i < numImages; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const img = images[i];
    const imgRatio = img.width / img.height;
    const cellRatio = cellWidth / cellHeight;

    // Calcular tamaño manteniendo relación de aspecto
    let width, height;
    if (imgRatio > cellRatio) {
      // Imagen más ancha que la celda
      width = cellWidth;
      height = cellWidth / imgRatio;
    } else {
      // Imagen más alta que la celda
      height = cellHeight;
      width = cellHeight * imgRatio;
    }

    // Centrar en celda
    const x = col * (cellWidth + spacing) + (cellWidth - width) / 2;
    const y = row * (cellHeight + spacing) + (cellHeight - height) / 2;

    positions.push({ 
      x: Math.max(0, x), 
      y: Math.max(0, y), 
      width: Math.min(width, cellWidth), 
      height: Math.min(height, cellHeight), 
      image: img 
    });
  }

  return positions;
}

// Endpoint para collage - CORREGIDO
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

    console.log('Área utilizable:', { usableWidth, usableHeight });

    // Calcular layout
    const layout = calculateImageLayout(images, usableWidth, usableHeight, spacingNum);

    // Agregar imágenes al PDF
    for (const item of layout) {
      console.log('Agregando imagen:', { 
        x: marginNum + item.x, 
        y: marginNum + item.y, 
        width: item.width, 
        height: item.height 
      });
      
      pdf.addImage(
        item.image.dataUrl,
        'JPEG', // Usar JPEG para mejor compatibilidad
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

// Endpoint para repetidor - CORREGIDO (usando .single y field names correctos)
app.post('/generate-repetidor', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se seleccionó imagen' });
    }

    // Los nombres de campos deben coincidir con tu HTML
    const { orientation, margin, spacing, imageWidth } = req.body;
    const marginNum = parseFloat(margin) || 5;
    const spacingNum = parseFloat(spacing) || 2;
    const imageWidthNum = parseFloat(imageWidth) || 50;

    console.log('Generando repetidor con:', {
      orientation,
      margin: marginNum,
      spacing: spacingNum,
      imageWidth: imageWidthNum
    });

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

    console.log('Grid repetidor:', { cols, rows, imageWidth: imageWidthNum, imageHeight: imageHeightNum });

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
      return res.status(400).json({ error: 'Campo de archivo inesperado. Verifica el nombre del campo en el formulario.' });
    }
  }
  console.error('Error general:', error);
  res.status(500).json({ error: error.message });
});

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});