const common = require('./common');

// Endpoint para repetidor
async function generateRepetidor(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se seleccionó imagen' });
    }

    const { orientation, margin, spacing, imageWidth } = req.body;
    const marginNum = parseFloat(margin) || 5;
    const spacingNum = parseFloat(spacing) || 2;
    const imageWidthNum = parseFloat(imageWidth) || 50;

    console.log('[REPETIDOR] Generando con:', {
      orientation,
      margin: marginNum,
      spacing: spacingNum,
      imageWidth: imageWidthNum
    });

    // Procesar imagen
    const dimensions = await common.getImageDimensions(req.file.buffer);
    const imgRatio = dimensions.width / dimensions.height;
    const imageHeightNum = imageWidthNum / imgRatio;
    
    const dataUrl = 'data:' + req.file.mimetype + ';base64,' + req.file.buffer.toString('base64');

    // Crear PDF
    const pdf = common.createPDF(orientation);

    // Obtener dimensiones de página
    const { pageWidth, pageHeight } = common.getPageDimensions(orientation);

    // Área utilizable
    const usableWidth = pageWidth - (2 * marginNum);
    const usableHeight = pageHeight - (2 * marginNum);

    // Calcular cuántas caben
    const cols = Math.floor((usableWidth + spacingNum) / (imageWidthNum + spacingNum));
    const rows = Math.floor((usableHeight + spacingNum) / (imageHeightNum + spacingNum));

    console.log(`[REPETIDOR] ${cols}x${rows} imágenes de ${imageWidthNum}x${imageHeightNum}mm`);

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
    console.error('[REPETIDOR] Error:', error);
    res.status(500).json({ error: 'Error generando PDF: ' + error.message });
  }
}

module.exports = {
  generateRepetidor
};