document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let state = {
        pageSettings: {
            pageSize: 'letter',
            orientation: 'portrait',
            margin: 10,
            useHalfPage: false
        },
        image: {
            file: null,
            originalUrl: null,
            widthMM: 50, // Default width
            heightMM: 0, // Calculated
            rotation: 0,
            aspectRatio: 1
        },
        grid: {
            spacing: 1,
            cols: 0,
            rows: 0
        }
    };
    let cropper = null;

    // --- DOM ELEMENTS ---
    const pageSizeSelect = document.getElementById('pageSize');
    const orientationSelect = document.getElementById('orientation');
    const marginInput = document.getElementById('margin');
    const useHalfPageCheckbox = document.getElementById('useHalfPage');
    const imageInput = document.getElementById('image-input');
    const rotateBtn = document.getElementById('rotate-image-btn');
    const cropBtn = document.getElementById('crop-image-btn');
    const imageWidthInput = document.getElementById('image-width');
    const imageHeightInput = document.getElementById('image-height');
    const unlockRatioCheckbox = document.getElementById('unlock-ratio');
    const spacingInput = document.getElementById('spacing');
    const generatePdfBtn = document.getElementById('generate-pdf-btn');
    const designContainer = document.getElementById('design-container');
    const gridContainer = document.getElementById('grid-container');
    const mainContent = document.getElementById('main-content');
    // Modal elements
    const cropModal = document.getElementById('crop-modal');
    const imageToCrop = document.getElementById('image-to-crop');
    const confirmCropBtn = document.getElementById('confirm-crop-btn');
    const cancelCropBtn = document.getElementById('cancel-crop-btn');

    let px_per_mm = 1;

    // --- CORE LOGIC ---

    function handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        state.image.file = file;
        state.image.originalUrl = URL.createObjectURL(file);

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                state.image.aspectRatio = img.naturalWidth / img.naturalHeight;
                state.image.heightMM = state.image.widthMM / state.image.aspectRatio;
                imageWidthInput.value = state.image.widthMM.toFixed(2);
                imageHeightInput.value = state.image.heightMM.toFixed(2);
                generatePdfBtn.disabled = false;
                cropBtn.disabled = false;
                updateAndRender();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function updateImageDimensions(source) {
        if (!state.image.file) return;
        const width = parseFloat(imageWidthInput.value);
        const height = parseFloat(imageHeightInput.value);

        if (unlockRatioCheckbox.checked) {
            state.image.widthMM = width;
            state.image.heightMM = height;
        } else {
            if (source === 'width' && width > 0) {
                state.image.widthMM = width;
                state.image.heightMM = width / state.image.aspectRatio;
                imageHeightInput.value = state.image.heightMM.toFixed(2);
            } else if (source === 'height' && height > 0) {
                state.image.heightMM = height;
                state.image.widthMM = height * state.image.aspectRatio;
                imageWidthInput.value = state.image.widthMM.toFixed(2);
            }
        }
        updateAndRender();
    }
    
    function rotateImage() {
        if (!state.image.file) return;
        state.image.rotation = (state.image.rotation + 90) % 360;

        if (unlockRatioCheckbox.checked) {
            const oldWidth = state.image.widthMM;
            state.image.widthMM = state.image.heightMM;
            state.image.heightMM = oldWidth;
            imageWidthInput.value = state.image.widthMM.toFixed(2);
            imageHeightInput.value = state.image.heightMM.toFixed(2);
        } else {
            state.image.aspectRatio = 1 / state.image.aspectRatio;
            state.image.heightMM = state.image.widthMM / state.image.aspectRatio;
            imageHeightInput.value = state.image.heightMM.toFixed(2);
        }
        
        updateAndRender();
    }

    function cropImage() {
        if (!state.image.originalUrl) return;
        imageToCrop.src = state.image.originalUrl;
        cropModal.style.display = 'flex';

        if (cropper) {
            cropper.destroy();
        }
        cropper = new Cropper(imageToCrop, {
            viewMode: 1,
            background: false,
        });
    }

    function confirmCrop() {
        if (!cropper) return;
        const canvas = cropper.getCroppedCanvas();
        canvas.toBlob((blob) => {
            const newFile = new File([blob], state.image.file.name, { type: blob.type });
            state.image.file = newFile;
            state.image.originalUrl = URL.createObjectURL(newFile); // Update URL to cropped version
            
            // Recalculate aspect ratio and dimensions
            const img = new Image();
            img.onload = () => {
                state.image.aspectRatio = img.naturalWidth / img.naturalHeight;
                state.image.heightMM = state.image.widthMM / state.image.aspectRatio;
                imageHeightInput.value = state.image.heightMM.toFixed(2);
                updateAndRender();
            };
            img.src = state.image.originalUrl;

            cropper.destroy();
            cropper = null;
            cropModal.style.display = 'none';
        }, state.image.file.type);
    }

    function updateAndRender() {
        updatePageSettings();
        updateGridCalculations();
        render();
    }

    function updatePageSettings() {
        state.pageSettings.pageSize = pageSizeSelect.value;
        state.pageSettings.orientation = orientationSelect.value;
        state.pageSettings.margin = parseFloat(marginInput.value) || 0;
        state.pageSettings.useHalfPage = useHalfPageCheckbox.checked;
        state.grid.spacing = parseFloat(spacingInput.value) || 0;
    }

    function updateGridCalculations() {
        if (!state.image.file) return;

        const { pageSize, orientation, margin, useHalfPage } = state.pageSettings;
        const pageDims = PAPER_DIMENSIONS_MM[pageSize];
        const pageWidth = orientation === 'landscape' ? pageDims.height : pageDims.width;
        let pageHeight = orientation === 'landscape' ? pageDims.width : pageDims.height;

        const drawableWidth = pageWidth - (2 * margin);
        let drawableHeight = pageHeight - (2 * margin);

        if (useHalfPage) {
            drawableHeight /= 2;
        }

        const imgWidthWithSpacing = state.image.widthMM + state.grid.spacing;
        const imgHeightWithSpacing = state.image.heightMM + state.grid.spacing;

        state.grid.cols = Math.floor((drawableWidth + state.grid.spacing) / imgWidthWithSpacing);
        state.grid.rows = Math.floor((drawableHeight + state.grid.spacing) / imgHeightWithSpacing);
    }

    // --- RENDER LOGIC ---

    function render() {
        px_per_mm = updateDesignArea({
            ...state.pageSettings,
            containerElement: designContainer,
            areaElement: mainContent
        });
        renderGrid();
    }

    function renderGrid() {
        gridContainer.innerHTML = '';
        if (!state.image.file || state.grid.cols === 0 || state.grid.rows === 0) {
            return;
        }

        const spacing_px = state.grid.spacing * px_per_mm;
        gridContainer.style.gridTemplateColumns = `repeat(${state.grid.cols}, 1fr)`;
        gridContainer.style.gridTemplateRows = `repeat(${state.grid.rows}, 1fr)`;
        gridContainer.style.gap = `${spacing_px}px`;

        const imageUrl = URL.createObjectURL(state.image.file);
        const totalCells = state.grid.cols * state.grid.rows;

        for (let i = 0; i < totalCells; i++) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            cell.style.backgroundImage = `url(${imageUrl})`;
            cell.style.transform = `rotate(${state.image.rotation}deg)`;
            gridContainer.appendChild(cell);
        }
    }

    // --- PDF GENERATION ---
    async function generatePdf() {
        if (!state.image.file) {
            alert('Por favor, selecciona una imagen.');
            return;
        }
        generatePdfBtn.disabled = true;
        generatePdfBtn.textContent = 'Generando...';

        const formData = new FormData();
        formData.append('image', state.image.file);
        
        const config = {
            pageSettings: state.pageSettings,
            image: {
                widthMM: state.image.widthMM,
                heightMM: state.image.heightMM,
                rotation: state.image.rotation
            },
            grid: state.grid
        };
        formData.append('config', JSON.stringify(config));

        try {
            const response = await fetch('/generate-auto-repetidor', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error(`Error del servidor: ${response.statusText}`);
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'auto-repetidor.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (error) {
            console.error('Error al generar el PDF:', error);
            alert('Hubo un error al generar el PDF.');
        } finally {
            generatePdfBtn.disabled = false;
            generatePdfBtn.textContent = 'Generar PDF';
        }
    }

    // --- EVENT LISTENERS ---
    pageSizeSelect.addEventListener('change', updateAndRender);
    orientationSelect.addEventListener('change', updateAndRender);
    marginInput.addEventListener('input', updateAndRender);
    useHalfPageCheckbox.addEventListener('change', updateAndRender);
    spacingInput.addEventListener('input', updateAndRender);
    imageInput.addEventListener('change', handleImageUpload);
    rotateBtn.addEventListener('click', rotateImage);
    cropBtn.addEventListener('click', cropImage);
    confirmCropBtn.addEventListener('click', confirmCrop);
    cancelCropBtn.addEventListener('click', () => {
        if (cropper) cropper.destroy();
        cropper = null;
        cropModal.style.display = 'none';
    });
    imageWidthInput.addEventListener('change', () => updateImageDimensions('width'));
    imageHeightInput.addEventListener('change', () => updateImageDimensions('height'));
    unlockRatioCheckbox.addEventListener('change', () => updateImageDimensions('width')); // Recalculate on lock/unlock
    generatePdfBtn.addEventListener('click', generatePdf);
    window.addEventListener('resize', render);

    // --- INITIALIZATION ---
    render();
});