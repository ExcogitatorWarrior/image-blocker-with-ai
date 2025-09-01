
// Save active filtering setting to local storage
function saveActiveFilteringSetting() {
    const isActive = document.getElementById('activeFiltering').checked;

    // Save to browser.storage.local
    browser.storage.local.set({
        activeFiltering: isActive
    });
}

// Save server settings.
function saveServerSettings() {
    const serverIp = document.getElementById('server-ip').value.trim();
    const serverPort = document.getElementById('server-port').value.trim();
    const status = document.getElementById('connection-status'); // The status div for feedback

    // Validate inputs before saving
    if (!serverIp || !serverPort) {
        status.textContent = 'Please enter both Server IP and Port';
        status.style.color = 'red'; // Red for error
        return; // Return if data is missing
    }

    // Save to browser.storage.local
    browser.storage.local.set({
        UserServerIp: serverIp,
        UserServerPort: serverPort
    }, () => {
        status.textContent = `Settings Saved: ${serverIp}:${serverPort}`;
        status.style.color = 'green'; // Green for success
    });
}



// Load the active filtering setting from local storage
function loadActiveFilteringSetting() {
    browser.storage.local.get('activeFiltering', (result) => {
        const isActive = result.activeFiltering || false; // Default to false if not set
        document.getElementById('activeFiltering').checked = isActive;
    });
}

// Load the server settings from local storage or use default values
function loadServerSettings() {
    browser.storage.local.get(['UserServerIp', 'UserServerPort'], (result) => {
        // Default to localhost (127.0.0.1) and port 9095 if no settings are found
        const ip = result.UserServerIp || '127.0.0.1';
        const port = result.UserServerPort || '9095';

        document.getElementById('server-ip').value = ip;
        document.getElementById('server-port').value = port;
    });
}

// Add event listener to checkbox to save when changed
document.getElementById('activeFiltering').addEventListener('change', saveActiveFilteringSetting);

// Load the setting when the popup is opened
document.addEventListener('DOMContentLoaded', () => {
    loadActiveFilteringSetting();
});

document.addEventListener('DOMContentLoaded', function() {
    // Define the elements for the tabs and menu items
    const homeBtn = document.getElementById('homeBtn');
    const listBtn = document.getElementById('listBtn');
    const controlPanelBtn = document.getElementById('controlPanelBtn');
    const filteringBtn = document.getElementById('filteringBtn');

    // Show Home Section
    function showHomeSection() {
        document.getElementById('homeSection').style.display = 'block';
        document.getElementById('imageList').style.display = 'none';
        document.getElementById('controlPanel').style.display = 'none';
        document.getElementById('filteringTab').style.display = 'none';
    }

    // Show Image List
    function showImageList() {
        document.getElementById('homeSection').style.display = 'none';
        document.getElementById('imageList').style.display = 'block';
        document.getElementById('controlPanel').style.display = 'none';
        document.getElementById('filteringTab').style.display = 'none';
        updateImageList();  // Assuming you have this function to update the image list
    }

    // Show Control Panel
    function showControlPanel() {
        document.getElementById('homeSection').style.display = 'none';
        document.getElementById('imageList').style.display = 'none';
        document.getElementById('controlPanel').style.display = 'block';
        document.getElementById('filteringTab').style.display = 'none';
    }

    // Show Filtering Tab
    function showFilteringTab() {
        document.getElementById('homeSection').style.display = 'none';
        document.getElementById('imageList').style.display = 'none';
        document.getElementById('controlPanel').style.display = 'none';
        document.getElementById('filteringTab').style.display = 'block';
    }

    // Event Listeners for Buttons
    homeBtn.addEventListener('click', function() {
        showHomeSection();
    });

    listBtn.addEventListener('click', function() {
        showImageList();
    });

    controlPanelBtn.addEventListener('click', function() {
        showControlPanel();
    });

    filteringBtn.addEventListener('click', function() {
        showFilteringTab();
    });

    // Initially show the Home section
    showHomeSection();  // Set Home as the default view
});
// Define the function to calculate the sensitive value
function calculateSensitiveValue(sliderValue) {
    return `1.0e-${sliderValue}`;
}

// Save the current slider values to storage
function saveSliderSettings() {
    const bigSliderValue = document.getElementById('bigSlider').value;
    const sensitiveSliderValue = document.getElementById('sensitiveSlider').value;

    // Save to storage
    browser.storage.local.set({
        bigSliderValue: bigSliderValue,
        sensitiveSliderValue: sensitiveSliderValue
    });
}

// Load saved slider settings from storage
function loadSliderSettings() {
    browser.storage.local.get(['bigSliderValue', 'sensitiveSliderValue'], (result) => {
        if (result.bigSliderValue !== undefined) {
            document.getElementById('bigSlider').value = result.bigSliderValue;
            document.getElementById('bigSliderValue').textContent = result.bigSliderValue;
        }

        if (result.sensitiveSliderValue !== undefined) {
            document.getElementById('sensitiveSlider').value = result.sensitiveSliderValue;
            // Calculate and update the sensitive value using the new function
            const calculatedSensitiveValue = calculateSensitiveValue(result.sensitiveSliderValue);
            document.getElementById('sensitiveSliderValue').textContent = calculatedSensitiveValue;
        }
    });
}


// Event listener for Save Server Settings button
document.getElementById('save-server-settings').addEventListener('click', () => {
    // Save server settings and sliders
    saveServerSettings();
});


// Add event listeners to sliders to save changes when user interacts
document.getElementById('bigSlider').addEventListener('input', function() {
    document.getElementById('bigSliderValue').textContent = this.value;
    saveSliderSettings(); // Save on every change
});

document.getElementById('sensitiveSlider').addEventListener('input', function() {
    // Calculate and update the sensitive value using the new function
    const calculatedSensitiveValue = calculateSensitiveValue(this.value);
    document.getElementById('sensitiveSliderValue').textContent = calculatedSensitiveValue;

    saveSliderSettings(); // Save on every change
});

function updateImageList() {
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];

        browser.tabs.sendMessage(tab.id, { action: "getImageList" }, (response) => {
            if (!response) {
                document.getElementById('imageCount').textContent = "Error: No response from content script.";
                return;
            }

            // Update the image count
            document.getElementById('imageCount').textContent = `Images Loaded: ${response.count}`;

            // Render the table
            const tableBody = document.getElementById('imageTableBody');
            tableBody.innerHTML = "";

            response.images.forEach((img) => {
                const row = document.createElement('tr');

                // Number
                const numberCell = document.createElement('td');
                numberCell.textContent = img.number;
                row.appendChild(numberCell);

                // ID
                const idCell = document.createElement('td');
                idCell.textContent = img.id;  // Display the ID
                row.appendChild(idCell);

                // Name
                const nameCell = document.createElement('td');
                nameCell.textContent = img.name;
                row.appendChild(nameCell);

                // Status
                const statusCell = document.createElement('td');
                statusCell.textContent = img.status;
                row.appendChild(statusCell);

                // Value
                const valueCell = document.createElement('td');
                valueCell.textContent = img.value;
                row.appendChild(valueCell);

                tableBody.appendChild(row);
            });
        });
    });
}


// Load slider settings when the popup is opened
document.addEventListener('DOMContentLoaded', () => {
    loadServerSettings();
    loadSliderSettings();
});

// Run immediately and then every second
document.addEventListener('DOMContentLoaded', () => {
    updateImageList();
    setInterval(updateImageList, 1000);
});
//=================================== Site Enforce Toggle section =========================================
document.addEventListener("DOMContentLoaded", async () => {
    const enforceToggle = document.getElementById("enforceSiteToggle");

    // 1. Get current tab's base URL
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const tabUrl = new URL(tab.url);
    const baseUrl = tabUrl.host;

    // 2. Load saved enforced sites
    const stored = await browser.storage.local.get("enforcedSites");
    let enforcedSites = stored.enforcedSites || [];

    // 3. Set toggle state if site is already enforced
    enforceToggle.checked = enforcedSites.includes(baseUrl);

    // 4. Listen for changes to the toggle
    enforceToggle.addEventListener("change", async () => {
        if (enforceToggle.checked) {
            // Add site if not already in list
            if (!enforcedSites.includes(baseUrl)) {
                enforcedSites.push(baseUrl);
            }
        } else {
            // Remove site if unchecked
            enforcedSites = enforcedSites.filter(site => site !== baseUrl);
        }

        // Save updated list
        await browser.storage.local.set({ enforcedSites });
        console.log("Updated enforcedSites:", enforcedSites);
    });
});
//=================================== BlACKLIST SECTION ===================================================
async function updateBlacklistStatus() {
    const currentDomain = await getCurrentDomain();

    // Get the current blacklist from storage
    await browser.storage.local.get('blacklist', (result) => {
        let blacklist = result.blacklist || [];

        const toggleSpan = document.getElementById('toggleBlacklist');

        // Check if the current domain is in the blacklist
        if (blacklist.includes(currentDomain)) {
            toggleSpan.textContent = "Remove from Blacklist";
            toggleSpan.style.color = "red";  // Show it as already blacklisted (red for remove)
        } else {
            toggleSpan.textContent = "Add to Blacklist";
            toggleSpan.style.color = "green";  // Show it as not blacklisted (green for add)
        }
    });
}

// Function to get the current domain of the page
async function getCurrentDomain() {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    return new Promise((resolve, reject) => {
        browser.tabs.sendMessage(tab.id, { action: "getDomain" }, (response) => {
            if (response && response.domain) {
                resolve(response.domain);  // Return the domain when available
            } else {
                reject("Domain not found or error in response");
            }
        });
    });
}

// Function to toggle the current domain in the blacklist
async function toggleBlacklist() {
    try {
        const currentDomain = await getCurrentDomain();  // Wait for domain to be fetched
        const toggleSpan = document.getElementById('toggleBlacklist');

        // Get the current blacklist from storage
        const result = await browser.storage.local.get('blacklist');
        let blacklist = result.blacklist || [];

        // Check if the domain is already in the blacklist
        if (blacklist.includes(currentDomain)) {
            // If the domain is blacklisted, remove it
            blacklist = blacklist.filter(domain => domain !== currentDomain);
            toggleSpan.textContent = "Add to Blacklist";
            toggleSpan.style.color = "green";  // Show it as not blacklisted (green for add)
        } else {
            // If the domain is not blacklisted, add it
            blacklist.push(currentDomain);
            toggleSpan.textContent = "Remove from Blacklist";
            toggleSpan.style.color = "red";  // Show it as already blacklisted (red for remove)
        }

        // Save the updated blacklist to storage
        await browser.storage.local.set({ blacklist: blacklist });
    } catch (error) {
        console.error("Error fetching domain:", error);
    }
}
document.getElementById('toggleBlacklist').addEventListener('click', toggleBlacklist);

document.addEventListener('DOMContentLoaded', () => {
    updateBlacklistStatus();
});

//=================================== END OF BlACKLIST SECTION ===================================================
// Cash size regulation
document.addEventListener("DOMContentLoaded", async () => {
    const input = document.getElementById("cacheSizeInput");
    const saveBtn = document.getElementById("saveCacheSize");
    const status = document.getElementById("cacheStatus");

    // Load saved cache size
    try {
        const result = await browser.storage.local.get("MAX_CACHE_SIZE");
        if (result.MAX_CACHE_SIZE) {
            input.value = result.MAX_CACHE_SIZE || '500';
        }
    } catch (err) {
        console.error("Error loading cache size:", err);
        input.value = '500';
    }

    // Save new cache size
    saveBtn.addEventListener("click", async () => {
        const newSize = parseInt(input.value, 10);

        if (isNaN(newSize) || newSize <= 0) {
            status.textContent = "Please enter a valid positive number.";
            return;
        }

        try {
            await browser.storage.local.set({ MAX_CACHE_SIZE: newSize });
            status.textContent = `Saved: ${newSize}`;
        } catch (err) {
            console.error("Error saving cache size:", err);
            status.textContent = "Error saving cache size.";
        }
    });
});
//============================== Premoderation

// Load the active premoderation setting from local storage
function loadActivePremoderationSetting() {
    const toggle = document.getElementById('premoderationToggle');
    browser.storage.local.get('premoderation', (result) => {
        const premoderationActive = result.premoderation ?? false; // default false
        toggle.checked = premoderationActive;
    });

    // Add event listener to checkbox to save when changed
    toggle.addEventListener("change", async () => {
        await browser.storage.local.set({ premoderation: toggle.checked });
        console.log("Premoderation set to:", toggle.checked);
    });
}

// Load the setting when the popup is opened
document.addEventListener('DOMContentLoaded', () => {
    loadActivePremoderationSetting();
});

//============================== Filtering Mode Options

// Load the selected mode when the popup is opened
document.addEventListener('DOMContentLoaded', async () => {
    const filterOptions = document.getElementById('filterOptions');

    // Get the saved mode from storage
    const { filterMode } = await browser.storage.local.get('filterMode');

    // Set the selected mode to the stored value, or default to 'hover'
    filterOptions.value = filterMode || 'hover'; // Default to 'hover' if no mode is saved
});

// Save the selected mode when the user picks an option
document.getElementById('filterOptions').addEventListener('change', async (event) => {
    const selectedMode = event.target.value;

    // Save the selected mode to storage
    await browser.storage.local.set({ filterMode: selectedMode });
});

// ========================== Profile Creation ==========================
// Get modal and close button elements for creating profile
const profileModal = document.getElementById('profileModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const saveProfileBtn = document.getElementById('saveProfileBtn');

// Show the modal when "+" button is clicked
document.getElementById('addProfileBtn').addEventListener('click', () => {
    profileModal.style.display = 'block';
});

// Close the modal when the close button is clicked
closeModalBtn.addEventListener('click', () => {
    profileModal.style.display = 'none';
});

// Close the modal if the user clicks outside of it
window.addEventListener('click', (event) => {
    if (event.target === profileModal) {
        profileModal.style.display = 'none';
    }
});

// Save the new profile when the "Save Profile" button is clicked
saveProfileBtn.addEventListener('click', () => {
    const newProfileName = document.getElementById('newProfileName').value.trim();
    if (newProfileName) {
        const profiles = JSON.parse(localStorage.getItem('profiles')) || ['default'];

        // Avoid duplicates
        if (!profiles.includes(newProfileName)) {
            profiles.push(newProfileName);
            localStorage.setItem('profiles', JSON.stringify(profiles));
            loadProfiles(); // Refresh the profile dropdown
            profileModal.style.display = 'none'; // Hide modal
        } else {
            showModalMessage('This profile already exists!');
        }
    } else {
        showModalMessage('Please enter a profile name.');
    }
});

// ========================== Profile Deletion with Confirmation ==========================
const deleteProfileModal = document.getElementById('deleteProfileModal');
const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
const deleteProfileConfirmBtn = document.getElementById('deleteProfileConfirmBtn');
const deleteProfileCancelBtn = document.getElementById('deleteProfileCancelBtn');

// Show confirmation modal when "-" button is clicked
document.getElementById('deleteProfileBtn').addEventListener('click', () => {
    deleteProfileModal.style.display = 'block';
});

// Close the modal if the user clicks outside of it
window.addEventListener('click', (event) => {
    if (event.target === deleteProfileModal) {
        deleteProfileModal.style.display = 'none';
    }
});

// Close the modal when the close button is clicked
closeDeleteModalBtn.addEventListener('click', () => {
    deleteProfileModal.style.display = 'none';
});

// Cancel button in the modal
deleteProfileCancelBtn.addEventListener('click', () => {
    deleteProfileModal.style.display = 'none';
});

// Confirm button in the modal
deleteProfileConfirmBtn.addEventListener('click', () => {
    const currentProfile = document.getElementById('profileList').value; // Get the current selected profile

    if (currentProfile && currentProfile !== 'default') {
        let profiles = JSON.parse(localStorage.getItem('profiles')) || ['default'];

        // Remove profile from the list
        profiles = profiles.filter(profile => profile !== currentProfile);
        localStorage.setItem('profiles', JSON.stringify(profiles));

        // Refresh profile dropdown and hide modal
        loadProfiles();
        deleteProfileModal.style.display = 'none';
    } else {
        showModalMessage('You cannot delete the default profile.');
    }
});

// Get the status message element
const statusMessage = document.getElementById('statusMessage');

// ============================== Profile Export Function =============================
document.getElementById('exportBtn').addEventListener('click', async () => {
    const profiles = JSON.parse(localStorage.getItem('profiles')) || ['default'];
    const globalDefaultProfile = localStorage.getItem('globalDefaultProfile') || 'default';

    // Retrieve the siteDefaults from storage
    const storage = await browser.storage.local.get('siteDefaults');
    const siteDefaults = storage.siteDefaults || {};  // Get the siteDefaults object

    // Prepare to export labels (each profile's labels)
    const labels = {};
    const storageData = await browser.storage.local.get();
    for (let profile of profiles) {
        const profileLabels = storageData[profile] || [];
        labels[profile] = profileLabels;
    }

    // Prepare full export data including labels and defaults
    const exportData = {
        profiles,
        globalDefaultProfile,
        siteDefaults,
        labels
    };

    // Create Blob with export data and trigger download
    const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'profiles_and_labels_with_defaults.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show success message
    const statusMessage = document.getElementById('statusMessage'); // Make sure to have a status element in HTML
    statusMessage.textContent = 'Profiles, labels, and defaults exported successfully!';
    statusMessage.style.color = 'green';
});
// ============================== Profile Import Function =============================
document.getElementById('importBtn').addEventListener('click', () => {
    // Open the import.html page in a new tab
    browser.tabs.create({ url: 'import.html' });
});
// ========================== Utility Functions ==========================

// Utility function to show messages in the modal
function showModalMessage(message) {
    const modalMessage = document.createElement('div');
    modalMessage.classList.add('modal-message');
    modalMessage.textContent = message;
    document.body.appendChild(modalMessage);
    setTimeout(() => {
        modalMessage.remove();
    }, 3000);
}

// Function to load profiles into the dropdown
function loadProfiles() {
    const profileList = document.getElementById('profileList');
    const profiles = JSON.parse(localStorage.getItem('profiles')) || ['default'];
    profileList.innerHTML = ''; // Clear the existing list

    // Add profiles to dropdown
    profiles.forEach(profile => {
        const option = document.createElement('option');
        option.value = profile;
        option.textContent = profile;
        profileList.appendChild(option);
    });
}

// Initially load profiles from local storage
loadProfiles();

const profileListglobal = document.getElementById('profileList');
profileListglobal.addEventListener('change', () => {
    currentProfile = profileList.value;
    localStorage.setItem('currentProfile', currentProfile);
    updateDefaultButtonStates();
});

const globalDefaultBtn = document.getElementById('globalDefaultBtn');
const pageDefaultBtn = document.getElementById('pageDefaultBtn');

async function updateDefaultButtonStates() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const tabUrl = new URL(tab.url);
    const baseUrl = `${tabUrl.protocol}//${tabUrl.host}`; // Extract base URL

    const storage = await browser.storage.local.get(['globalDefaultProfile', 'siteDefaults']);

    // Global button
    if (storage.globalDefaultProfile === currentProfile) {
        globalDefaultBtn.textContent = 'Make profile default for all pages (active)';
        globalDefaultBtn.style.backgroundColor = 'green';
        globalDefaultBtn.style.color = 'white';
    } else {
        globalDefaultBtn.textContent = 'Make profile default for all pages';
        globalDefaultBtn.style.backgroundColor = 'red';
        globalDefaultBtn.style.color = 'white';
    }

    // Page button
    if (storage.siteDefaults && storage.siteDefaults[baseUrl] === currentProfile) {
        pageDefaultBtn.textContent = 'Assign profile to this page as default (active)';
        pageDefaultBtn.style.backgroundColor = 'green';
        pageDefaultBtn.style.color = 'white';
    } else {
        pageDefaultBtn.textContent = 'Assign profile to this page as default';
        pageDefaultBtn.style.backgroundColor = 'red';
        pageDefaultBtn.style.color = 'white';
    }
}

// Click events
globalDefaultBtn.addEventListener('click', async () => {
    await browser.storage.local.set({ globalDefaultProfile: currentProfile });
    updateDefaultButtonStates();
});

pageDefaultBtn.addEventListener('click', async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const tabUrl = new URL(tab.url);
    const baseUrl = `${tabUrl.protocol}//${tabUrl.host}`; // Extract base URL

    const storage = await browser.storage.local.get('siteDefaults') || {};
    const siteDefaults = storage.siteDefaults || {};

    // Update the siteDefaults for this base URL (host)
    siteDefaults[baseUrl] = currentProfile;

    // Save the updated siteDefaults in local storage
    await browser.storage.local.set({ siteDefaults });

    updateDefaultButtonStates();
});
// Call on popup load or profile change
updateDefaultButtonStates();

// ========================== Label Management ==========================

const profileList = document.getElementById('profileList');
const addLabelBtn = document.getElementById('addLabelBtn');
const newLabelInput = document.getElementById('newLabelInput');
const labelList = document.getElementById('labelList');

let currentProfile = profileList.value;

// Load labels for the current profile
async function loadLabels(profile) {
    const data = await browser.storage.local.get(profile);
    const labels = data[profile] || [];
    renderLabels(labels);
}

// Render label list
function renderLabels(labels) {
    labelList.innerHTML = '';
    labels.forEach((label, index) => {
        const li = document.createElement('li');
        li.className = 'label-item';

        const span = document.createElement('span');
        span.className = 'label-text';
        span.textContent = label.text;
        li.appendChild(span);

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'toggleBtn';
        toggleBtn.textContent = label.status === 'filter' ? 'to filter' : 'to keep';
        toggleBtn.addEventListener('click', () => toggleLabel(index));
        li.appendChild(toggleBtn);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'removeBtn';
        removeBtn.textContent = '-';
        removeBtn.addEventListener('click', () => removeLabel(index));
        li.appendChild(removeBtn);

        labelList.appendChild(li);
    });
}

// Add new label
addLabelBtn.addEventListener('click', async () => {
    const text = newLabelInput.value.trim();
    if (!text) return;

    const data = await browser.storage.local.get(currentProfile);
    const labels = data[currentProfile] || [];
    labels.push({ text, status: 'filter' }); // default status
    await browser.storage.local.set({ [currentProfile]: labels });
    newLabelInput.value = '';
    renderLabels(labels);
    // Send ProfileChanged message
    browser.runtime.sendMessage({ type: 'ProfileChanged', profileName: currentProfile });
});

// Toggle label status
async function toggleLabel(index) {
    const data = await browser.storage.local.get(currentProfile);
    const labels = data[currentProfile] || [];
    labels[index].status = labels[index].status === 'filter' ? 'keep' : 'filter';
    await browser.storage.local.set({ [currentProfile]: labels });
    renderLabels(labels);
    // Send ProfileChanged message
    browser.runtime.sendMessage({ type: 'ProfileChanged', profileName: currentProfile });
}

// Remove label
async function removeLabel(index) {
    const data = await browser.storage.local.get(currentProfile);
    const labels = data[currentProfile] || [];
    labels.splice(index, 1);
    await browser.storage.local.set({ [currentProfile]: labels });
    renderLabels(labels);
    // Send ProfileChanged message
    browser.runtime.sendMessage({ type: 'ProfileChanged', profileName: currentProfile });
}

// Switch profile
profileList.addEventListener('change', () => {
    currentProfile = profileList.value;
    loadLabels(currentProfile);
});

// Initial load
loadLabels(currentProfile);