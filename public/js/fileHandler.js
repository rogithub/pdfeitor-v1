// fileHandler.js

/**
 * Maps file extensions to their corresponding MIME types.
 * @param {string} fileName - The name of the file.
 * @returns {string|undefined} The MIME type or undefined if not found.
 */
function getMimeType(fileName) {
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
        return 'image/jpeg';
    }
    if (lowerName.endsWith('.png')) {
        return 'image/png';
    }
    if (lowerName.endsWith('.webp')) {
        return 'image/webp';
    }
    // Add other image types if needed
    return undefined;
}

/**
 * Processes a list of user-provided files. If a ZIP file is found, it extracts
 * the image files from it. It returns a flattened list of all image files.
 * @param {FileList} files - The list of files from a file input or drop event.
 * @returns {Promise<File[]>} A promise that resolves to an array of File objects.
 */
async function processFiles(files) {
    const fileList = Array.from(files);
    const outputFiles = [];
    const zipFiles = fileList.filter(file => file.type === 'application/zip' || file.name.toLowerCase().endsWith('.zip'));
    const imageFiles = fileList.filter(file => file.type.startsWith('image/'));

    outputFiles.push(...imageFiles);

    if (zipFiles.length > 0 && typeof JSZip === 'undefined') {
        alert('La librería para procesar archivos ZIP no está disponible.');
        return outputFiles; // Return whatever images we found
    }

    for (const zipFile of zipFiles) {
        try {
            const zip = await JSZip.loadAsync(zipFile);
            const imagePromises = [];

            zip.forEach((relativePath, zipEntry) => {
                // Ignore directories and non-image files
                const mimeType = getMimeType(zipEntry.name);
                if (!zipEntry.dir && mimeType) {
                    const promise = zipEntry.async('blob').then(blob => {
                        // Create a new File object with the correct name and type
                        return new File([blob], zipEntry.name, { type: mimeType });
                    });
                    imagePromises.push(promise);
                }
            });

            const extractedImages = await Promise.all(imagePromises);
            outputFiles.push(...extractedImages);
        } catch (error) {
            console.error('Error al procesar el archivo ZIP:', error);
            alert(`Hubo un problema al leer el archivo ${zipFile.name}. Asegúrate de que no esté corrupto.`);
        }
    }

    return outputFiles;
}
