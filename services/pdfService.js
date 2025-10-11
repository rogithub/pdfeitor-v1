const { PDFDocument, degrees } = require('pdf-lib');
const sharp = require('sharp');
const { mmToPt, LETTER_WIDTH_PT, LETTER_HEIGHT_PT, LEGAL_WIDTH_PT, LEGAL_HEIGHT_PT } = require('../routes/common');

const PAPER_DIMENSIONS_PT = {
    letter: { width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT },
    legal: { width: LEGAL_WIDTH_PT, height: LEGAL_HEIGHT_PT }
};

async function createAutoRepetidorPdf(file, config) {
    const { pageSettings, image: imageConfig, grid } = config;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();

    const pageDims = PAPER_DIMENSIONS_PT[pageSettings.pageSize];
    const pageWidth = pageSettings.orientation === 'landscape' ? pageDims.height : pageDims.width;
    const pageHeight = pageSettings.orientation === 'landscape' ? pageDims.width : pageDims.height;
    page.setSize(pageWidth, pageHeight);

    let imageBuffer = file.buffer;
    if (imageConfig.rotation > 0) {
        imageBuffer = await sharp(imageBuffer).rotate(imageConfig.rotation).toBuffer();
    }

    const isPng = (await sharp(imageBuffer).metadata()).format === 'png';
    const image = isPng ? await pdfDoc.embedPng(imageBuffer) : await pdfDoc.embedJpg(imageBuffer);

    const marginPt = mmToPt(pageSettings.margin);
    const spacingPt = mmToPt(grid.spacing);
    const imageWidthPt = mmToPt(imageConfig.widthMM);
    const imageHeightPt = mmToPt(imageConfig.heightMM);

    const startX = marginPt;
    let startY = pageHeight - marginPt - imageHeightPt;
    if (pageSettings.useHalfPage) {
        startY = pageHeight - marginPt - imageHeightPt;
    }

    for (let row = 0; row < grid.rows; row++) {
        for (let col = 0; col < grid.cols; col++) {
            const x = startX + col * (imageWidthPt + spacingPt);
            const y = startY - row * (imageHeightPt + spacingPt);
            page.drawImage(image, { x, y, width: imageWidthPt, height: imageHeightPt });
        }
    }

    return await pdfDoc.save();
}

async function createLayoutPdf(files, layoutConfig) {
    const { pageSettings, cells } = layoutConfig;
    const imagesMap = files.reduce((map, file) => {
        map[file.originalname] = file.buffer;
        return map;
    }, {});

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();

    const pageSize = pageSettings.pageSize || 'letter';
    const { width, height } = PAPER_DIMENSIONS_PT[pageSize];
    page.setSize(
        pageSettings.orientation === 'landscape' ? height : width,
        pageSettings.orientation === 'landscape' ? width : height
    );

    const { width: pageWidth, height: pageHeight } = page.getSize();
    const marginPt = mmToPt(pageSettings.margin);
    const spacingPt = mmToPt(pageSettings.spacing);

    let drawableWidth = pageWidth - (marginPt * 2);
    let drawableHeight = pageHeight - (marginPt * 2);
    let startY = pageHeight - marginPt;

    if (pageSettings.useHalfPage) {
        drawableHeight /= 2;
    }

    const totalSpacingX = (pageSettings.baseCols - 1) * spacingPt;
    const totalSpacingY = (pageSettings.baseRows - 1) * spacingPt;
    const cellWidth = (drawableWidth - totalSpacingX) / pageSettings.baseCols;
    const cellHeight = (drawableHeight - totalSpacingY) / pageSettings.baseRows;

    for (const cell of cells) {
        if (!cell.imageName) continue;
        const imageBuffer = imagesMap[cell.imageName];
        if (!imageBuffer) continue;

        const cellX = marginPt + cell.col * (cellWidth + spacingPt);
        const cellY = startY - (cell.row * (cellHeight + spacingPt));
        const currentCellWidth = cell.colSpan * cellWidth + (cell.colSpan - 1) * spacingPt;
        const currentCellHeight = cell.rowSpan * cellHeight + (cell.rowSpan - 1) * spacingPt;

        let processedImageBuffer = imageBuffer;
        if (cell.rotation > 0) {
            processedImageBuffer = await sharp(imageBuffer).rotate(cell.rotation).toBuffer();
        }

        const isPng = (await sharp(processedImageBuffer).metadata()).format === 'png';
        const image = isPng ? await pdfDoc.embedPng(processedImageBuffer) : await pdfDoc.embedJpg(processedImageBuffer);

        const cellAspectRatio = currentCellWidth / currentCellHeight;
        const imageAspectRatio = image.width / image.height;
        let imgWidth, imgHeight;
        if (imageAspectRatio > cellAspectRatio) {
            imgWidth = currentCellWidth;
            imgHeight = imgWidth / imageAspectRatio;
        } else {
            imgHeight = currentCellHeight;
            imgWidth = imgHeight * imageAspectRatio;
        }

        const imgX = cellX + (currentCellWidth - imgWidth) / 2;
        const imgY = (cellY - currentCellHeight) + (currentCellHeight - imgHeight) / 2;

        page.drawImage(image, { x: imgX, y: imgY, width: imgWidth, height: imgHeight });
    }

    return await pdfDoc.save();
}

async function createMultiPaginaPdf(files, pageSettings) {
    const marginPt = mmToPt(pageSettings.margin || 10);
    const pdfDoc = await PDFDocument.create();

    for (const file of files) {
        const imageBuffer = file.buffer;
        const imageMetadata = await sharp(imageBuffer).metadata();
        const imageIsLandscape = imageMetadata.width > imageMetadata.height;

        const { width: pageWidthPt, height: pageHeightPt } = PAPER_DIMENSIONS_PT[pageSettings.pageSize || 'letter'];
        const page = pdfDoc.addPage();
        page.setSize(
            imageIsLandscape ? pageHeightPt : pageWidthPt,
            imageIsLandscape ? pageWidthPt : pageHeightPt
        );

        const { width: currentPageWidth, height: currentPageHeight } = page.getSize();
        const drawableWidth = currentPageWidth - (marginPt * 2);
        const drawableHeight = currentPageHeight - (marginPt * 2);

        const image = imageMetadata.format === 'png' ? await pdfDoc.embedPng(imageBuffer) : await pdfDoc.embedJpg(imageBuffer);

        const cellAspectRatio = drawableWidth / drawableHeight;
        const imageAspectRatio = image.width / image.height;
        let imgWidth, imgHeight, rotation = 0;

        const imageOrientation = image.width > image.height ? 'landscape' : 'portrait';
        const cellOrientation = drawableWidth > drawableHeight ? 'landscape' : 'portrait';

        if (imageOrientation !== cellOrientation) {
            rotation = 90;
            const rotatedImageAspectRatio = image.height / image.width;
            if (rotatedImageAspectRatio > cellAspectRatio) {
                imgWidth = drawableWidth;
                imgHeight = imgWidth / rotatedImageAspectRatio;
            } else {
                imgHeight = drawableHeight;
                imgWidth = imgHeight * rotatedImageAspectRatio;
            }
        } else {
            if (imageAspectRatio > cellAspectRatio) {
                imgWidth = drawableWidth;
                imgHeight = imgWidth / imageAspectRatio;
            } else {
                imgHeight = drawableHeight;
                imgWidth = imgHeight * imageAspectRatio;
            }
        }

        const imgX = marginPt + (drawableWidth - imgWidth) / 2;
        const imgY = marginPt + (drawableHeight - imgHeight) / 2;

        page.drawImage(image, { x: imgX, y: imgY, width: imgWidth, height: imgHeight, rotate: degrees(rotation) });
    }

    return await pdfDoc.save();
}

async function createPlantillaPdf(files, config) {
    const { pageSettings, pages } = config;
    const imagesMap = files.reduce((map, file) => {
        map[file.originalname] = file.buffer;
        return map;
    }, {});

    const pdfDoc = await PDFDocument.create();

    for (const pageData of pages) {
        const hasImagesOnPage = pageData.cells.some(cell => cell.image && cell.image.name && imagesMap[cell.image.name]);
        if (!hasImagesOnPage) continue;

        const page = pdfDoc.addPage();
        const { width, height } = PAPER_DIMENSIONS_PT[pageSettings.pageSize || 'letter'];
        page.setSize(
            pageSettings.orientation === 'landscape' ? height : width,
            pageSettings.orientation === 'landscape' ? width : height
        );

        const { width: pageWidth, height: pageHeight } = page.getSize();
        const marginPt = mmToPt(pageSettings.margin);
        const spacingPt = mmToPt(pageSettings.spacing);
        const drawableWidth = pageWidth - (marginPt * 2);
        const drawableHeight = pageHeight - (marginPt * 2);
        const startY = pageHeight - marginPt;

        const totalSpacingX = (pageData.baseCols - 1) * spacingPt;
        const totalSpacingY = (pageData.baseRows - 1) * spacingPt;
        const cellWidth = (drawableWidth - totalSpacingX) / pageData.baseCols;
        const cellHeight = (drawableHeight - totalSpacingY) / pageData.baseRows;

        for (const cell of pageData.cells) {
            if (!cell.image || !cell.image.name) continue;
            const imageBuffer = imagesMap[cell.image.name];
            if (!imageBuffer) continue;

            const cellX = marginPt + cell.col * (cellWidth + spacingPt);
            const cellY = startY - (cell.row * (cellHeight + spacingPt));
            const currentCellWidth = cell.colSpan * cellWidth + (cell.colSpan - 1) * spacingPt;
            const currentCellHeight = cell.rowSpan * cellHeight + (cell.rowSpan - 1) * spacingPt;

            let processedImageBuffer = imageBuffer;
            if (cell.image && cell.image.rotation > 0) {
                processedImageBuffer = await sharp(imageBuffer).rotate(cell.image.rotation).toBuffer();
            }

            const isPng = (await sharp(processedImageBuffer).metadata()).format === 'png';
            const image = isPng ? await pdfDoc.embedPng(processedImageBuffer) : await pdfDoc.embedJpg(processedImageBuffer);

            const cellAspectRatio = currentCellWidth / currentCellHeight;
            const imageAspectRatio = image.width / image.height;
            let imgWidth, imgHeight;
            if (imageAspectRatio > cellAspectRatio) {
                imgWidth = currentCellWidth;
                imgHeight = imgWidth / imageAspectRatio;
            } else {
                imgHeight = currentCellHeight;
                imgWidth = imgHeight * imageAspectRatio;
            }

            const imgX = cellX + (currentCellWidth - imgWidth) / 2;
            const imgY = (cellY - currentCellHeight) + (currentCellHeight - imgHeight) / 2;

            page.drawImage(image, { x: imgX, y: imgY, width: imgWidth, height: imgHeight });
        }
    }

    return await pdfDoc.save();
}

module.exports = {
    createAutoRepetidorPdf,
    createLayoutPdf,
    createMultiPaginaPdf,
    createPlantillaPdf,
};
