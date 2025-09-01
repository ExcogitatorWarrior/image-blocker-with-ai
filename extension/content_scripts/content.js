let imagesList = [];  // List 1: Full list with duplicates
let uniqueImagesList = [];  // List 2: Unique images only
let debounceTimer = null;
let debounceTimerSecondary = null;
let imageListWatcherInterval;
let currentDelay = 200; // Initial delay time
let imageCounterIsWorkingFlag = false;

async function getPremoderationSetting() {
    const result = await browser.storage.local.get('premoderation');
    return result.premoderation ?? false; // default false
}

async function getActiveFilteringSetting() {
    const result = await browser.storage.local.get(['activeFiltering']);
    return result.activeFiltering || false; // Default to false if not set
}

// Loop through all images in imagesList and reset the status of "COMPLETE" images to "DONE"
function resetProcessedImages() {
    imagesList.forEach((img) => {
        if (img.status === 'COMPLETE') {
            img.status = 'DONE';  // Reset to "DONE" to allow reprocessing
        }
    });
}

function resetImages() {
    if (!imagesList || imagesList.length === 0) return;

    stopImageListWatcher()
    imagesList.forEach((img) => {
        const element = img.source;
        const isBackground = img.type === "background";

        if (element) {
            if (isBackground) {
                element.classList.remove('bg-ai-auto-filtered', 'bg-ai-opacity-filtered');
            } else {
                element.classList.remove('ai-auto-filtered', 'ai-opacity-filtered');
            }
        }
    });

    // Clear the imagesList after processing
    imagesList = [];
}

async function startImageListWatcher() {
    // Polling for changes in uniqueImagesList (or imagesList)
    const processImages = async () => {
        const doneImages = imagesList.filter(img => img.status === 'DONE');

        await Promise.all(doneImages.map(async img => {
            const isBackground = img.type === "background";
            await hideImage(img.source, img.value, img.name, isBackground);
            img.status = 'COMPLETE'; // updates the original imagesList because 'img' is a reference
        }));

        // After processing the images, update the delay
        currentDelay *= 2;

        // Restart the interval with the new delay
        clearInterval(imageListWatcherInterval);
        imageListWatcherInterval = setInterval(processImages, currentDelay);
    };

    // Start the first interval with the initial delay
    imageListWatcherInterval = setInterval(processImages, currentDelay);
}

function stopImageListWatcher() {
    // Stop the watcher when it's no longer needed
    clearInterval(imageListWatcherInterval);
}

function stopDebounce() {
    if (debounceTimer || debounceTimerSecondary) {
        clearTimeout(debounceTimer); // cancel any pending execution
        debounceTimer = null;
        clearTimeout(debounceTimerSecondary);
        debounceTimerSecondary = null;
    }
}

// Hide image immediately for premoderation
function premoderateImage(element, isBackground, imageName, filterMode) {
    // Set the appropriate class based on filterMode
    let elementClass;
    if (filterMode === 'hover' || filterMode === 'remove') {
        elementClass = isBackground ? 'bg-ai-auto-filtered' : 'ai-auto-filtered';
    } else if (filterMode === 'opacity') {
        elementClass = isBackground ? 'bg-ai-opacity-filtered' : 'ai-opacity-filtered';
    }
    // Add the filter class to the element
    if (!element.classList.contains(elementClass)) {
        element.classList.add(elementClass);
    }
}

async function hideImage(image_source, value, image_name, isBackground) {
    const result = await browser.storage.local.get(['activeFiltering', 'filterMode', 'enforcedSites']);
    const isActive = result.activeFiltering;
    const filterMode = result.filterMode || 'hover';  // Default to hover
    const enforcedSites = result.enforcedSites || [];
    const hostname = window.location.hostname;

    if (!isActive && !enforcedSites.includes(hostname)) {
        return;
    }

    const filter = await compareValues(value);
    const element = image_source;

    if (filter) {
        if (isBackground) {
            switch (filterMode) {
                case 'hover':
                    element.classList.add('bg-ai-auto-filtered');
                    break;
                case 'opacity':
                    element.classList.add('bg-ai-opacity-filtered');
                    break;
                case 'remove':
                    element.remove();
                    break;
            }
        } else {
            switch (filterMode) {
                case 'hover':
                    element.classList.add('ai-auto-filtered');
                    break;
                case 'opacity':
                    element.classList.add('ai-opacity-filtered');
                    break;
                case 'remove':
                    element.remove();
                    break;
            }
        }
    } else {
        // Remove applied filters if element is still present
        if (!element.parentNode) return; // Already removed
        if (isBackground) {
            element.classList.remove('bg-ai-auto-filtered', 'bg-ai-opacity-filtered');
        } else {
            element.classList.remove('ai-auto-filtered', 'ai-opacity-filtered');
        }
    }
}

async function compareValues(imageValue) {
    // Get slider values from browser storage
    const { bigSliderValue, sensitiveSliderValue } = await browser.storage.local.get(['bigSliderValue', 'sensitiveSliderValue']);

    // Convert sensitiveSliderValue to an exponential form
    const sensitiveValue = parseFloat(`1.0e-${sensitiveSliderValue}`);
    //console.log(`Sensitive Slider value in exponential form: 1.0e-${sensitiveSliderValue} -> ${sensitiveValue}`);

    // Check if imageValue is valid
    if (isNaN(imageValue)) {
        return false;
    }

    // Check if the value is greater than 0.01 and doesn't contain 'e'
    if (imageValue > 0.01 && !imageValue.toString().includes("e")) {
        // Perform the comparison with bigSliderValue
        if (imageValue > bigSliderValue) {
            return true;
        } else {
            return false;
        }
    } else {

        // Final comparison
        if (imageValue > sensitiveValue && imageValue > bigSliderValue) {
            return true;
        } else {
            return false;
        }
    }
}

// Debounce wrapper
function debounce(fn, delay) {
    return function (...args) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => fn.apply(this, args), delay);
    };
}
// Secondary Debouncer
function debounceSecondary(fn, delay) {
    return function (...args) {
        clearTimeout(debounceTimerSecondary);
        debounceTimerSecondary = setTimeout(() => fn.apply(this, args), delay);
    };
}

function isInvalidImageFormat(url) {
    const InvalidFormats = ['.svg'];
    // Check if the image is a base64-encoded image (e.g., data:image/gif;base64)
    if (url.startsWith('data:image')) {
        return true; // This means it is an invalid image (e.g., base64 images)
    }
    return InvalidFormats.some(format => url.toLowerCase().endsWith(format));
}

async function cleanUpImagesList() {
    imagesList = imagesList.filter(img => {
        if (img.type === "img") {
            // Check if <img> with same src still exists
            const imgElements = document.querySelectorAll('img');
            return Array.from(imgElements).some(el => el.src === img.source.src);
        } else if (img.type === "background") {
            // Check if element still exists AND still has same background image
            if (!document.body.contains(img.source)) return false;

            const style = window.getComputedStyle(img.source);
            const bgImage = style.backgroundImage;
            const match = bgImage.match(/url\(["']?(.*?)["']?\)/);
            const currentUrl = match ? match[1] : null;

            return currentUrl === img.name;
        }
        return false;
    });

    // Sync uniqueImagesList as well
    uniqueImagesList = uniqueImagesList.filter(img => {
        if (img.type === "img") {
            const imgElements = document.querySelectorAll('img');
            return Array.from(imgElements).some(el => el.src === img.source.src);
        } else if (img.type === "background") {
            if (!document.body.contains(img.source)) return false;

            const style = window.getComputedStyle(img.source);
            const bgImage = style.backgroundImage;
            const match = bgImage.match(/url\(["']?(.*?)["']?\)/);
            const currentUrl = match ? match[1] : null;

            return currentUrl === img.name;
        }
        return false;
    });
}

// Function to count images and populate both lists
async function countImages() {
    if (imageCounterIsWorkingFlag) return;
    imageCounterIsWorkingFlag = true;
    try {
        await cleanUpImagesList();
        // Get the filter mode from storage
        const result = await browser.storage.local.get(['filterMode']);
        const filterMode = result.filterMode || 'hover';  // Default to 'hover' if not set

        const premoderationActive = await getPremoderationSetting();

        // Handle <img> elements
        const imgElements = document.querySelectorAll('img');
        let index = 0;
        for (const img of imgElements) {
            if (img.src && img.src.trim() !== "") {
                await addImageToLists(img.src, img, ++index, false, premoderationActive, filterMode);
            }
        }

        // Handle background-image elements
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
            const style = window.getComputedStyle(el);
            const bgImage = style.backgroundImage;
            if (bgImage && bgImage !== "none") {
                // Improved regex to correctly parse URLs with quotes, query strings, commas, etc.
                const match = bgImage.match(/url\((['"]?)(.*?)\1\)/);
                if (match && match[2]) {
                    const url = match[2].trim();
                    if (url) {
                        await addImageToLists(url, el, ++index, true, premoderationActive, filterMode);
                    }
                }
            }
        }
    } finally {
        imageCounterIsWorkingFlag = false;
    }
}

// Helper to avoid duplication in both loops
async function addImageToLists(src, element, index, isBackground = false, premoderation = false, filterMode) {
    // Skip unsupported formats
    if (isInvalidImageFormat(src)) return;

    // Skip duplicates by element reference
    const existingImage = imagesList.find(img => img.source === element);
    if (existingImage) return;

    const image = {
        id: `image-${index}`,
        number: index,
        name: src,
        source: element,
        status: 'FOUND',
        value: 'unknown',
        type: isBackground ? 'background' : 'img'
    };

    // Add to lists
    imagesList.push(image);
    if (!uniqueImagesList.some(img => img.name === src)) uniqueImagesList.push(image);

    // Apply premoderation immediately
    if (premoderation) {
        premoderateImage(element, isBackground, src, filterMode);
    }
}

function getImageCountFromList() {
    if (imagesList.length === 0) return 0;
    return Math.max(...imagesList.map(img => img.number));
}

const debouncedCountImages = debounce(countImages, 400);

const debouncedCountImagesSecondary = debounceSecondary(countImages, 1500);

// Watch DOM for changes and triggering debounce.
let observer = new MutationObserver(() => {
    browser.storage.local.get(['blacklist'], (result) => {
        let blacklist = result.blacklist || [];
        if (!blacklist.includes(window.location.hostname)) {
            browser.storage.local.get(['activeFiltering'], (result) => {
                const isActive = result.activeFiltering || false;
                if (isActive) {
                    debouncedCountImages();
                    debouncedCountImagesSecondary();
                }
            });
        }
    });
});
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Start if pass blacklist and global turnoff. With modification keep attention to change debounce function as well.
browser.storage.local.get(['blacklist'], (result) => {
    let blacklist = result.blacklist || [];
    if (!blacklist.includes(window.location.hostname)) {
        browser.storage.local.get(['activeFiltering'], (result) => {
            const isActive = result.activeFiltering || false;
            if (isActive) {
                // Start the watcher when the extension initializes or when needed
                startImageListWatcher();
                // Initial scan
                countImages();
                // Debounce rush
                debouncedCountImages();
                debouncedCountImagesSecondary();
            }
        });
    }
});

// return state of images to "DONE" on changes in sliders
browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.bigSliderValue) {
        resetProcessedImages();
        stopImageListWatcher();
        currentDelay = 200;
        startImageListWatcher()
    }
    if (area === "local" && changes.sensitiveSliderValue) {
        resetProcessedImages();
        stopImageListWatcher();
        currentDelay = 200;
        startImageListWatcher()
    }
});

// Handle messages from popup.js or processor.js
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.action === "getDomain") {
        const currentDomain = window.location.hostname;  // Get the current domain
        sendResponse({ domain: currentDomain });
    }

    if (message.action === "result-achieved") {
        stopImageListWatcher();
        currentDelay = 200;
        startImageListWatcher()
    }

    if (message.action === "getImageList") {
        sendResponse({
            count: getImageCountFromList(),
            images: JSON.parse(JSON.stringify(imagesList)),
        });
    }

    if (message.action === "updateImageStatus") {
        // Find all images with the same name and status not COMPLETE
        const imagesToUpdate = imagesList.filter(
            img => img.name === message.imageName && img.status !== 'COMPLETE'
        );

        if (imagesToUpdate.length > 0) {
            // Update all matching images
            imagesToUpdate.forEach(img => {
                img.id = message.id;
                img.status = message.status;
                img.value = message.value;
            });

            sendResponse({ status: 'Images updated', updatedImages: imagesToUpdate });
        } else {
            sendResponse({ status: 'Image not found or already complete' });
        }
    }

    return true; // allow async sendResponse
});

// Inject the external CSS file into the page
browser.runtime.sendMessage({ action: 'injectCSS' });

//===================================== ENFORCE FOR CURRENT SITE SECTION ============================================
browser.storage.local.get(['blacklist', 'activeFiltering', 'enforcedSites'], (result) => {
    let blacklist = result.blacklist || [];
    let isActive = result.activeFiltering || false;
    let enforcedSites = result.enforcedSites || [];

    const hostname = window.location.hostname;

    const shouldFilter =
        (blacklist.includes(hostname) || !isActive) && (enforcedSites.includes(hostname));

    if (shouldFilter) {
        // Start the watcher when the extension initializes or when needed
        startImageListWatcher();
        // Initial scan
        countImages();

        const debouncedCountImages = debounce(countImages, 400);

        const debouncedCountImagesSecondary = debounceSecondary(countImages, 1500);

        const observer = new MutationObserver(() => {
            debouncedCountImages();
            debouncedCountImagesSecondary();
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
});

browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enforcedSites) {
        const enforcedSites = changes.enforcedSites.newValue || [];
        const hostname = window.location.hostname;

        browser.storage.local.get(['blacklist', 'activeFiltering'], (result) => {
            const blacklist = result.blacklist || [];
            const isActive = result.activeFiltering || false;

            const shouldFilter = (blacklist.includes(hostname) || !isActive) && enforcedSites.includes(hostname);

            if (shouldFilter) {
                // Start the watcher
                startImageListWatcher();
                countImages();

                const debouncedCountImages = debounce(countImages, 400);

                const debouncedCountImagesSecondary = debounceSecondary(countImages, 1500);

                if (observer) observer.disconnect();
                observer = new MutationObserver(() => {
                    debouncedCountImages();
                    debouncedCountImagesSecondary();
                });
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            } else if ((blacklist.includes(hostname) || !isActive) && !enforcedSites.includes(hostname)) {
                if (observer) {
                    observer.disconnect();
                    observer = null; // clear reference
                }
                stopDebounce();
                resetImages();
            }
        });
    }
});