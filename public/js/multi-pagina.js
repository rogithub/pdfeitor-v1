document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const pageSizeSelect = document.getElementById('pageSize');
    const marginInput = document.getElementById('margin');
    const generatePdfBtn = document.getElementById('generate-pdf-btn');
    const imageInput = document.getElementById('image-input');
    const imageDropZone = document.getElementById('image-drop-zone');
    const clearImagesBtn = document.getElementById('clear-images-btn');
    const cropBtn = document.getElementById('crop-image-btn');
    
    const designContainer = document.getElementById('design-container');
    const mainPreview = document.getElementById('main-preview');
    const pageThumbnailsContainer = document.getElementById('page-thumbnails');

    const cropModal = document.getElementById('crop-modal');
    const imageToCrop = document.getElementById('image-to-crop');
    const confirmCropBtn = document.getElementById('confirm-crop-btn');
    const cancelCropBtn = document.getElementById('cancel-crop-btn');

    let imageFiles = []; // Almacenará objetos {file, url}
    let selectedPageIndex = -1;
    let cropper = null;

    // --- LÓGICA DE GENERACIÓN DE PDF ---
    async function generatePdf() {
        if (imageFiles.length === 0) {
            alert('Por favor, selecciona al menos una imagen.');
            return;
        }
        generatePdfBtn.disabled = true;
        generatePdfBtn.textContent = 'Generando...';

        const formData = new FormData();
        imageFiles.forEach((imgData, index) => {
            formData.append('images', imgData.file, `page_${index}${imgData.file.name}`);
        });

        const pageSettings = {
            pageSize: pageSizeSelect.value,
            margin: parseFloat(marginInput.value)
        };
        formData.append('pageSettings', JSON.stringify(pageSettings));

        try {
            const response = await fetch('/generate-multi-pagina', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error(`Error del servidor: ${response.statusText}`);
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'documento_multi-pagina.pdf';
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

    // --- LÓGICA DE UI Y MANEJO DE IMÁGENES ---
    async function handleFiles(files) {
        const processedFiles = await processFiles(files);

        const newFiles = processedFiles
            .map(file => ({ file, url: URL.createObjectURL(file) }));

        if (newFiles.length > 0) {
            imageFiles.push(...newFiles);
            renderThumbnails();
            selectPage(imageFiles.length - 1);
        }
        updateGenerateButtonState();
    }

    function renderThumbnails() {
        pageThumbnailsContainer.innerHTML = '';
        imageFiles.forEach((imgData, index) => {
            const thumb = document.createElement('div');
            thumb.classList.add('thumbnail');
            if (index === selectedPageIndex) {
                thumb.classList.add('selected');
            }
            thumb.dataset.index = index;

            const img = document.createElement('img');
            img.src = imgData.url;
            
            const pageNum = document.createElement('span');
            pageNum.classList.add('thumb-page-number');
            pageNum.textContent = index + 1;

            thumb.appendChild(img);
            thumb.appendChild(pageNum);
            pageThumbnailsContainer.appendChild(thumb);
        });
    }

    function selectPage(index) {
        if (index >= 0 && index < imageFiles.length) {
            selectedPageIndex = index;
            const imgData = imageFiles[index];
            
            const img = new Image();
            img.onload = () => {
                const imageIsLandscape = img.naturalWidth > img.naturalHeight;
                updateDesignArea();
                mainPreview.style.backgroundImage = `url(${imgData.url})`;

                if (imageIsLandscape) {
                    const containerWidth = designContainer.clientWidth;
                    const containerHeight = designContainer.clientHeight;
                    const scale = containerWidth / containerHeight;
                    mainPreview.style.transform = `rotate(90deg) scale(${scale})`;
                } else {
                    mainPreview.style.transform = 'rotate(0deg) scale(1)';
                }
            };
            img.src = imgData.url;

            renderThumbnails();
            cropBtn.disabled = false;
        } else if (imageFiles.length === 0) {
            selectedPageIndex = -1;
            mainPreview.style.backgroundImage = 'none';
            mainPreview.style.transform = 'rotate(0deg)';
            updateDesignArea();
            renderThumbnails();
            cropBtn.disabled = true;
        }
    }

    function cropImage() {
        if (selectedPageIndex < 0) return;
        const imgData = imageFiles[selectedPageIndex];
        imageToCrop.src = imgData.url;
        cropModal.style.display = 'flex';

        if (cropper) cropper.destroy();
        cropper = new Cropper(imageToCrop, { viewMode: 1, background: false });
    }

    function confirmCrop() {
        if (!cropper || selectedPageIndex < 0) return;
        const originalFile = imageFiles[selectedPageIndex].file;
        const canvas = cropper.getCroppedCanvas();
        canvas.toBlob((blob) => {
            const newFile = new File([blob], originalFile.name, { type: blob.type });
            const newUrl = URL.createObjectURL(newFile);
            
            // Revoke old URL to free memory
            URL.revokeObjectURL(imageFiles[selectedPageIndex].url);

            imageFiles[selectedPageIndex] = { file: newFile, url: newUrl };
            
            selectPage(selectedPageIndex); // Re-render preview and thumbnails
            cancelCrop();
        }, originalFile.type);
    }

    function cancelCrop() {
        if (cropper) cropper.destroy();
        cropper = null;
        cropModal.style.display = 'none';
    }

    function updateDesignArea() {
        const pageSize = pageSizeSelect.value;
        const previewArea = document.getElementById('preview-area');
        
        const availableWidth = previewArea.clientWidth * 0.9;
        const availableHeight = previewArea.clientHeight * 0.9;

        let containerWidth, containerHeight;
        const pageRatio = PAPER_RATIOS[pageSize];
        
        containerHeight = availableHeight;
        containerWidth = containerHeight * pageRatio;
        if (containerWidth > availableWidth) {
            containerWidth = availableWidth;
            containerHeight = containerWidth / pageRatio;
        }

        designContainer.style.width = `${containerWidth}px`;
        designContainer.style.height = `${containerHeight}px`;
    }
    
    function updateGenerateButtonState() {
        generatePdfBtn.disabled = imageFiles.length === 0;
    }

    // --- EVENT LISTENERS ---
    pageSizeSelect.addEventListener('change', () => selectPage(selectedPageIndex));
    marginInput.addEventListener('input', () => selectPage(selectedPageIndex));
    window.addEventListener('resize', () => selectPage(selectedPageIndex));
    generatePdfBtn.addEventListener('click', generatePdf);
    cropBtn.addEventListener('click', cropImage);
    confirmCropBtn.addEventListener('click', confirmCrop);
    cancelCropBtn.addEventListener('click', cancelCrop);

    imageDropZone.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', (e) => handleFiles(e.target.files));
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        imageDropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        imageDropZone.addEventListener(eventName, () => imageDropZone.style.backgroundColor = '#d0e8ff');
    });
    ['dragleave', 'drop'].forEach(eventName => {
        imageDropZone.addEventListener(eventName, () => imageDropZone.style.backgroundColor = '#f0f8ff');
    });
    imageDropZone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));

    pageThumbnailsContainer.addEventListener('click', (e) => {
        const thumb = e.target.closest('.thumbnail');
        if (thumb) {
            selectPage(parseInt(thumb.dataset.index, 10));
        }
    });

    clearImagesBtn.addEventListener('click', () => {
        imageFiles.forEach(imgData => URL.revokeObjectURL(imgData.url));
        imageFiles = [];
        selectPage(-1);
        updateGenerateButtonState();
    });

    // --- INICIALIZACIÓN ---
    updateDesignArea(false);
});