// --- Helper functions ---
let ResultFlag = true;
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const cache = {};
const usageOrder = []; // tracks order of usage for LRU
let MAX_CACHE_SIZE = 500;
let CurrentlyProcessingTabsFlag = [];

// Trim cache by removing oldest images (regardless of profile entries)
function trimCache(newMaxSize) {
    while (usageOrder.length > newMaxSize) {
        const oldest = usageOrder.shift();
        delete cache[oldest];
    }
}

// Clear only entries for a specific profile
function clearCacheForProfile(profileName) {
    for (const imageName in cache) {
        if (!Array.isArray(cache[imageName])) continue;
        // Remove only entries matching the profile
        cache[imageName] = cache[imageName].filter(e => e.profile !== profileName);
        // If no entries left, remove the image entirely and update usageOrder
        if (cache[imageName].length === 0) {
            delete cache[imageName];
            const index = usageOrder.indexOf(imageName);
            if (index !== -1) usageOrder.splice(index, 1);
        }
    }
}

// Listen for profile changes
browser.runtime.onMessage.addListener((message) => {
    if (message.type === 'ProfileChanged') {
        const { profileName } = message;
        clearCacheForProfile(profileName);
    }
});

// MAX_CACHE_SIZE handling remains mostly the same
(async () => {
    const result = await browser.storage.local.get("MAX_CACHE_SIZE");
    if (result.MAX_CACHE_SIZE) {
        MAX_CACHE_SIZE = result.MAX_CACHE_SIZE;
        trimCache(MAX_CACHE_SIZE);
    }
})();

browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.MAX_CACHE_SIZE) {
        MAX_CACHE_SIZE = changes.MAX_CACHE_SIZE.newValue || 500;
        trimCache(MAX_CACHE_SIZE);
    }
});

// Save image to cache
function saveToCache(imageName, status, score, profile) {
    if (status !== "DONE") return;

    const now = Date.now();

    if (!cache[imageName]) {
        cache[imageName] = [];
    }

    // Check if there’s already an entry for this profile
    const existing = cache[imageName].find(e => e.profile === profile);
    if (existing) {
        existing.score = score;
        existing.timestamp = now;
    } else {
        cache[imageName].push({ status, score, timestamp: now, profile });
    }

    // Refresh usage order (keep track of imageName, not per profile)
    const index = usageOrder.indexOf(imageName);
    if (index !== -1) usageOrder.splice(index, 1);
    usageOrder.push(imageName);

    // Evict oldest if over max size
    while (usageOrder.length > MAX_CACHE_SIZE) {
        const oldest = usageOrder.shift();
        delete cache[oldest];
    }
}

// Get from cache
function getFromCache(imageName, profile) {
    const entries = cache[imageName];
    if (!entries) return null;

    // Find entry for this profile
    const entry = entries.find(e => e.profile === profile);
    if (!entry) return null;

    // Expiration check
    if (Date.now() - entry.timestamp > CACHE_EXPIRATION_MS) {
        // Remove expired entry
        const index = usageOrder.indexOf(imageName);
        if (index !== -1) usageOrder.splice(index, 1);
        cache[imageName] = entries.filter(e => e.profile !== profile);
        if (cache[imageName].length === 0) delete cache[imageName];
        return null;
    }

    // Refresh usage for LRU
    const index = usageOrder.indexOf(imageName);
    if (index !== -1) {
        usageOrder.splice(index, 1);
        usageOrder.push(imageName);
    }

    return entry;
}

function pause(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function MessageFlagForResult() {
    ResultFlag = false;
    await pause(1000);
    ResultFlag = true;
}

async function getServerUrl() {
    const result = await browser.storage.local.get(['UserServerIp', 'UserServerPort']);
    const ip = result.UserServerIp || '127.0.0.1';  // Default to '127.0.0.1' if no IP is found
    const port = result.UserServerPort || '9095';  // Default to '9095' if no port is found
    return `http://${ip}:${port}`;
}

async function retryGetResultFromServer(tabId, jobId, image_name, labels = [], profile) {
    let attempts = 0;
    const maxAttempts = 50;
    const delayTime = 100; // 100ms
    while (attempts < maxAttempts) {
        try {
            const response = await getResultFromServer(jobId);
            if (response && response.result) {
                // Some servers return [[scores]]; flatten if needed
                let scores = response.result;
                if (Array.isArray(scores[0])) scores = scores[0];
                let filterMax = 0;
                for (let i = 0; i < scores.length; i++) {
                    if (labels[i]?.status === "filter") {
                        if (scores[i] > filterMax) {
                            filterMax = scores[i];
                        }
                    }
                }
                // await updateImageStatus(tabId, jobId, image_name, "DONE", `response: ${JSON.stringify(response)}`);
                saveToCache(image_name, "DONE", filterMax, profile)
                await updateImageStatus(tabId, jobId, image_name, "DONE", `${filterMax}`);
                if (ResultFlag === true){
                    updateLoopStatus(tabId, "DONE")
                    MessageFlagForResult();
                }
                return response; // If result is received, return it
            }
        } catch (error) {
            console.error(`Attempt ${attempts + 1} failed for job ${jobId}:`, error);
        }

        // Wait for the specified delay before retrying
        await delay(delayTime);
        attempts++;
    }
    await updateImageStatus(tabId, jobId, image_name, "ERROR", `response: ${JSON.stringify(response)}`);
    throw new Error(`Failed to retrieve result for job ${jobId} after ${maxAttempts} attempts`);
}

async function getResultFromServer(job_id) {
    const serverUrl = await getServerUrl(); // Your server URL
    try {
        const response = await fetch(`${serverUrl}/result/${job_id}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        // Check if the response is okay
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }

        // Parse the JSON response
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching job result:", error);
        return null; // Or handle error as needed
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestImageList(tabId) {
    try {
        return await browser.tabs.sendMessage(tabId, { action: "getImageList" });
    } catch (err) {
        return { count: 0, images: [] };
    }
}

async function updateLoopStatus(tabId, status) {
    try {
        return await browser.tabs.sendMessage(tabId, {
            action: "result-achieved",
            status: status
        });
    } catch (err) {
        console.warn(`Could not update image in tab ${tabId}:`, err);
    }
}

async function updateImageStatus(tabId, id, imageName, status, value = "unknown") {
    try {
        return await browser.tabs.sendMessage(tabId, {
            action: "updateImageStatus",
            id: id,
            imageName: imageName,
            status: status,
            value: value
        });
    } catch (err) {
        console.warn(`Could not update image in tab ${tabId}:`, err);
    }
}

function imageToBase64FromUrl(url, maxRetries = 5, delayMs = 100) {
    // Already base64
    if (url.startsWith("data:")) {
        // Remove the "data:*/*;base64," prefix
        return Promise.resolve(url.split(",")[1]);
    }

    // Retry function
    const tryFetch = (attempt = 1) => {
        return fetch(url)
            .then(res => {
                if (!res.ok) {
                    // Log failure and retry if necessary
                    console.error(`Fetch failed for ${url}: ${res.status} ${res.statusText}`);
                    if (attempt < maxRetries) {
                        return new Promise(resolve => setTimeout(resolve, delayMs)) // Delay between retries
                            .then(() => tryFetch(attempt + 1));
                    } else {
                        throw new Error(`Fetch failed after ${maxRetries} attempts`);
                    }
                }
                return res.blob();
            })
            .then(blob => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(",")[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            })
            .catch(error => {
                console.error(`Error fetching image ${url}:`, error);
                throw new Error(`Failed to process image: ${url}`);
            });
    };

    return tryFetch();
}

async function sendImageToServer(imageBase64, labels = []) {
    const serverUrl = await getServerUrl(); // Dynamically get the server URL
    const payload = { image_data: imageBase64 };

    // If labels exist, add them to the payload
    if (labels.length > 0) {
        payload.TEXT_LABELS = labels;
    }

    const response = await fetch(`${serverUrl}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    return response.json(); // Expected: { job_id: "...", result: "..." }
}
//================================ Profile related section =====================================
async function getProfileForTab(tabId) {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const tabUrl = new URL(tab.url);
    const baseUrl = `${tabUrl.protocol}//${tabUrl.host}`; // Extract base URL

    // Retrieve 'siteDefaults' from browser storage
    const storage = await browser.storage.local.get('siteDefaults');
    const siteDefaults = storage.siteDefaults || {};

    // Check if there's a profile for the tab's base URL
    const profileForTab = siteDefaults[baseUrl] || null;

    // Fallback to global default profile if no site-specific profile
    const globalDefaultProfile = await browser.storage.local.get('globalDefaultProfile');
    const defaultProfile = profileForTab || globalDefaultProfile.globalDefaultProfile || 'default';

    return defaultProfile;
}

async function getLabelsForProfile(profile) {
    const storage = await browser.storage.local.get(profile);
    return storage[profile] || [];
}


// --- Main processor ---
async function processImagesInTab(tabId) {
    if (CurrentlyProcessingTabsFlag.includes(tabId)) return; // skip if this tab is already being processed
    CurrentlyProcessingTabsFlag.push(tabId); // mark tab as processing
    try {
        const {images} = await requestImageList(tabId);
        const profile = await getProfileForTab(tabId);  // Get profile for the current tab

        // Retrieve labels for the determined profile
        const labels = await getLabelsForProfile(profile);

        // Extract only 'text' from each label (we can still keep 'status' for later use)
        const formattedLabels = labels.map(label => label.text);

        for (let img of images) {
            if (img.status === "FOUND") {
                try {

                    // Mark as PROCESSING to prevent duplicates
                    await updateImageStatus(tabId, img.id, img.name, "PROCESSING", "unknown");

                    // Check cache first
                    const cached = getFromCache(img.name, profile);
                    if (cached) {
                        await updateImageStatus(tabId, img.id, img.name, cached.status, cached.score);
                        if (ResultFlag === true) {
                            updateLoopStatus(tabId, "DONE")
                            MessageFlagForResult();
                        }
                        continue; // Skip server processing
                    }

                    // Convert image to base64 and send to server
                    const base64Data = await imageToBase64FromUrl(img.name);
                    const response = await sendImageToServer(base64Data, formattedLabels);
                    const jobId = response.job_id;

                    // Update status to PENDING
                    await updateImageStatus(tabId, jobId, img.name, "PENDING", `response: ${JSON.stringify(response)}`);


                    // Retry loop for getting result
                    retryGetResultFromServer(tabId, jobId, img.name, labels, profile);

                } catch (err) {
                    console.error(`Failed to process ${img.name}`, err);
                    await updateImageStatus(tabId, img.id, img.name, "ERROR", err.message);
                }
            }
        }
    } finally {
        // remove tab from processing array
        CurrentlyProcessingTabsFlag = CurrentlyProcessingTabsFlag.filter(id => id !== tabId);
    }
}


// --- Auto poll every 5s ---
setInterval(async () => {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
        await processImagesInTab(tabs[0].id);
    }
}, 500);