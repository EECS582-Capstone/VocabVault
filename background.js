/*
Name of Code Artifact: background.js
Description: Adds the translation function to context menu and sends translation request to API, returns translation to content.js
Programmer's Name: Jenny Tsotezo, Skylar Franz
Date Created: 01/15/2026
Date Revised: 01/15/2026
Preconditions (inputs):
Postcondition (outputs):
Errors: n/a
*/

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "translate-text",
        title: "Translate \"%s\"",
        contexts: ["selection"]
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "translate-text") {
        const selectedText = info.selectionText;
        
        // Send to content script to show translation
        chrome.tabs.sendMessage(tab.id, {
            action: "translate",
            text: selectedText
        });
    }
});

// Handle translation requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "translateText") {
        translateText(request.text, request.direction)
            .then(translation => {
                sendResponse({ success: true, translation: translation });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
});

// Simple translation function
async function translateText(text, direction = 'en-es') {
    const [sourceLang, targetLang] = direction.split('-');
    
    try {
        const langPair = `${sourceLang}|${targetLang}`;
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.responseStatus === 200 && data.responseData) {
            return data.responseData.translatedText;
        }
        
        return '[Translation unavailable]';
    } catch (error) {
        return '[Translation error]';
    }
}