const PAPER_DIMENSIONS_MM = {
    letter: { width: 215.9, height: 279.4 },
    legal: { width: 215.9, height: 355.6 }
};

const PAPER_RATIOS = {
    letter: PAPER_DIMENSIONS_MM.letter.width / PAPER_DIMENSIONS_MM.letter.height,
    legal: PAPER_DIMENSIONS_MM.legal.width / PAPER_DIMENSIONS_MM.legal.height
};
