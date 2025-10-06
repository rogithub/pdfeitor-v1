const { jsPDF } = require('jspdf');

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

// Función para crear PDF con configuración básica
function createPDF(orientation) {
  return new jsPDF({
    orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'letter'
  });
}

// Obtener dimensiones de página
function getPageDimensions(orientation) {
  const pageWidth = orientation === 'landscape' ? 279.4 : 215.9;
  const pageHeight = orientation === 'landscape' ? 215.9 : 279.4;
  return { pageWidth, pageHeight };
}

// Procesar imágenes subidas
async function processUploadedImages(files) {
  const images = [];
  for (const file of files) {
    const dimensions = await getImageDimensions(file.buffer);
    images.push({
      buffer: file.buffer,
      width: dimensions.width,
      height: dimensions.height,
      dataUrl: 'data:' + file.mimetype + ';base64,' + file.buffer.toString('base64')
    });
  }
  return images;
}

module.exports = {
  getImageDimensions,
  createPDF,
  getPageDimensions,
  processUploadedImages
};