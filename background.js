/*
Name of Code Artifact: background.js
Description: Adds the translation function to context menu and sends translation request to API, returns translation to content.js
Programmer's Name: Jenny Tsotezo, Skylar Franz
Date Created: 02/15/2026
Date Revised: 03/01/2026
Preconditions (inputs): User-selected text
Postcondition (outputs): Translation to content.js
Errors: n/a
*/

// Adds option on right-click contextMenu to translate and add card
chrome.runtime.onInstalled.addListener(() => {  // On extension installation
    chrome.contextMenus.create({    // Create option on context memu
        id: "translate-text",       // ID to reference option
        title: "Translate \"%s\"",  // Displays text selected with %s
        contexts: ["selection"]     // When does option occur (when text is selected and right-clicked)
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "translate-text") {     // When translate-text option is clicked
        const selectedText = info.selectionText;    // Assign user-selected text to variable
        
        // Send message to content script (content.js) to show translation
        chrome.tabs.sendMessage(tab.id, {
            action: "showTranslationCard",  // Request action name
            text: selectedText              // The selected text
        });
    }
});

// Handle translation requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {   // Listens to messages from content.js
    if (request.action === "translateText") {           // If message action is translate text
        translateText(request.text, request.direction)  // Translate text to direction (either English->Spanish or vice versa)
            .then(translation => {  // If translation is a success
                sendResponse({ success: true, translation: translation });  // Return translation to content.js
            })
            .catch(error => {   // If translation fails
                sendResponse({ success: false, error: error.message }); // Sends error message
            });
        return true;
    }
});

// Simple translation function
async function translateText(text, direction = 'en-es') {
    const [sourceLang, targetLang] = direction.split('-'); // Get source language and target language from direction
    
    try {
        const langPair = `${sourceLang}|${targetLang}`; // Pair together sourceLang and targetLang
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`; // URL to translate text from
        
        const response = await fetch(url);  // See if translation API responds
        const data = await response.json(); // Get data from response
        
        if (data.responseStatus === 200 && data.responseData) { // If response is successful (HTTP message 200) and there's data (translated text)
            return data.responseData.translatedText;    // Return translation
        }
        
        return '[Translation unavailable]'; // If no response, return "Translation unavailable"
    } catch (error) {
        return '[Translation error]';   // If there's an error, return error message
    }
}