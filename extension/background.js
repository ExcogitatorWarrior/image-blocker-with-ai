// Listen for the toggle action and log it
browser.runtime.onMessage.addListener((message, sender) => {
    if (message.action === 'injectCSS') {
        // Inject CSS into the tab
        browser.tabs.insertCSS(sender.tab.id, {
            file: 'styles.css'
        }).then(() => {
            console.log('CSS injected successfully.');
        }).catch((error) => {
            console.error('Error injecting CSS:', error);
        });
    }
});

