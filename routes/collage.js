const common = require('./common');

// ALGORITMO PARA MÚLTIPLES IMÁGENES EN COLLAGE
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
  console.log(`[COLLAGE] Organizando ${numImages} imágenes en grid`);

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

  console.log(`[COLLAGE] Grid: ${cols} columnas x ${rows} filas, Celda: ${cellWidth.toFixed(1)}x${cellHeight.toFixed(1)}mm`);

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

    console.log(`[COLLAGE] Imagen ${i+1}: celda(${col},${row}), pos(${x.toFixed(1)},${y.toFixed(1)}), tamaño(${width.toFixed(1)}x${height.toFixed(1)})`);
  }

  return positions;
}

// Endpoint para collage
async function generateCollage(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se seleccionaron imágenes' });
    }

    const { orientation, margin, spacing } = req.body;
    const marginNum = parseFloat(margin) || 5;
    const spacingNum = parseFloat(spacing) || 2;

    console.log('[COLLAGE] Generando con:', {
      numImages: req.files.length,
      orientation,
      margin: marginNum,
      spacing: spacingNum
    });

    // Procesar imágenes
    const images = await common.processUploadedImages(req.files);

    // Crear PDF
    const pdf = common.createPDF(orientation);

    // Obtener dimensiones de página
    const { pageWidth, pageHeight } = common.getPageDimensions(orientation);

    // Área utilizable
    const usableWidth = pageWidth - (2 * marginNum);
    const usableHeight = pageHeight - (2 * marginNum);

    console.log(`[COLLAGE] Área utilizable: ${usableWidth}x${usableHeight}mm`);

    // Calcular layout
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
    console.error('[COLLAGE] Error:', error);
    res.status(500).json({ error: 'Error generando PDF: ' + error.message });
  }
}

module.exports = {
  generateCollage
};