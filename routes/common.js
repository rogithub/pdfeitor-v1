

// Constantes de tamaño de página en puntos (72 dpi)
const LETTER_WIDTH_PT = 612;
const LETTER_HEIGHT_PT = 792;
const LEGAL_WIDTH_PT = 612;
const LEGAL_HEIGHT_PT = 1008;

// Funciones de conversión de unidades
const ptToMm = (pt) => pt * 0.352778;
const mmToPt = (mm) => mm / 0.352778;



module.exports = {
  LETTER_WIDTH_PT,
  LETTER_HEIGHT_PT,
  LEGAL_WIDTH_PT,
  LEGAL_HEIGHT_PT,
  ptToMm,
  mmToPt
};