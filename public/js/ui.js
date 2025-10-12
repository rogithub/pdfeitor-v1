/**
 * Updates the size and padding of the design preview container based on page settings.
 * @param {object} options
 * @param {string} options.pageSize - 'letter' or 'legal'.
 * @param {string} options.orientation - 'portrait' or 'landscape'.
 * @param {boolean} options.useHalfPage - Whether to use only half the page height.
 * @param {number} options.margin - Page margin in mm.
 * @param {HTMLElement} options.containerElement - The design container element.
 * @param {HTMLElement} options.areaElement - The parent area element for size calculation.
 * @returns {number} The calculated pixels per mm for scaling.
 */
function updateDesignArea({ pageSize, orientation, useHalfPage, margin, containerElement, areaElement }) {
    const availableWidth = areaElement.clientWidth * 0.95;
    const availableHeight = areaElement.clientHeight * 0.95;

    const pageDims = PAPER_DIMENSIONS_MM[pageSize];
    const ratio = pageDims.width / pageDims.height;

    let containerWidth, containerHeight;

    if (orientation === 'portrait') {
        containerHeight = availableHeight;
        containerWidth = containerHeight * ratio;
        if (containerWidth > availableWidth) {
            containerWidth = availableWidth;
            containerHeight = containerWidth / ratio;
        }
    } else { // landscape
        containerWidth = availableWidth;
        containerHeight = containerWidth / ratio;
        if (containerHeight > availableHeight) {
            containerHeight = availableHeight;
            containerWidth = containerHeight * ratio;
        }
    }

    if (useHalfPage) {
        containerHeight /= 2;
    }

    containerElement.style.width = `${containerWidth}px`;
    containerElement.style.height = `${containerHeight}px`;

    const pageWidthMM = orientation === 'portrait' ? pageDims.width : pageDims.height;
    const px_per_mm = containerWidth / pageWidthMM;

    const margin_px = margin * px_per_mm;
    containerElement.style.padding = `${margin_px}px`;

    return px_per_mm;
}
