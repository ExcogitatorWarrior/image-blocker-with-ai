document.getElementById('importBtn').addEventListener('click', () => {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
        document.getElementById('statusMessage').textContent = "Please select a file to import.";
        return;
    }

    if (file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const importedData = JSON.parse(reader.result);

                // Import profiles
                if (importedData.profiles) {
                    localStorage.setItem('profiles', JSON.stringify(importedData.profiles));
                }

                // Import global default profile
                if (importedData.globalDefaultProfile) {
                    localStorage.setItem('globalDefaultProfile', importedData.globalDefaultProfile);
                }

                // Clear existing siteDefaults before importing new ones
                const existingSiteDefaults = (await browser.storage.local.get('siteDefaults')).siteDefaults || {};

                // Import site-specific defaults (using base URL as key)
                if (importedData.siteDefaults) {
                    for (const [fullUrl, profile] of Object.entries(importedData.siteDefaults)) {
                        // Extract the base URL (protocol + host) from the full URL
                        const tabUrl = new URL(fullUrl);
                        const baseUrl = `${tabUrl.protocol}//${tabUrl.host}`; // Extract base URL

                        // Merge the new site default with the existing ones
                        existingSiteDefaults[baseUrl] = profile;
                    }
                }

                // Save the merged siteDefaults back to storage
                await browser.storage.local.set({ siteDefaults: existingSiteDefaults });

                // Import labels for each profile
                if (importedData.labels) {
                    for (const [profile, labels] of Object.entries(importedData.labels)) {
                        await browser.storage.local.set({ [profile]: labels });
                    }
                }

                // Success message
                document.getElementById('statusMessage').textContent = 'Profiles, labels, and defaults imported successfully!';
                document.getElementById('statusMessage').style.color = 'green';
            } catch (error) {
                document.getElementById('statusMessage').textContent = 'Failed to import profiles. Invalid file format.';
                document.getElementById('statusMessage').style.color = 'red';
                console.error(error);
            }
        };
        reader.readAsText(file);
    } else {
        document.getElementById('statusMessage').textContent = 'Please select a valid JSON file.';
        document.getElementById('statusMessage').style.color = 'red';
    }
});