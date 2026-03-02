/*
Name of Code Artifact: background.js
Description: Adds the translation function to context menu and sends translation request to API, returns translation to content.js
Programmer's Name: Jenny Tsotezo, Skylar Franz, Sam Kelemen
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

    // Initialize default deck structure in Chrome storage if no decks exist
    chrome.storage.local.get({ decks: [] }, (data) => {
        // Check if the decks array is empty (first time installation)
        if (data.decks.length === 0) {
            // Create the default "All Cards" deck that contains all flashcards
            chrome.storage.local.set({ 
                decks: [{ 
                    id: 'default',              // Unique identifier for the default deck
                    name: 'All Cards',          // Display name shown to user
                    isDefault: true             // Flag to identify this as the default deck
                }] 
            });
        }
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

    // Handle language detection requests from content script
    if (request.action === "detectLanguage") {
        // Call the language detection function with the provided text
        detectLanguage(request.text)
            .then(language => {
                // Send detected language code back to requester
                sendResponse({ success: true, language: language });
            })
            .catch(error => {
                // Send error message back to requester if detection fails
                sendResponse({ success: false, error: error.message });
            });
        return true;  // Keep the message channel open for async response
    }
});

// Simple translation function
async function translateText(text, direction = 'en-es') {
    const [sourceLang, targetLang] = direction.split('-'); // Get source language and target language from direction
    
    // Log translation attempt for debugging purposes
    console.log(`Translating "${text}" from ${sourceLang} to ${targetLang}`);

    try {
        const langPair = `${sourceLang}|${targetLang}`; // Pair together sourceLang and targetLang
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`; // URL to translate text from

        // Log the API URL for debugging
        console.log('API URL:', url);
        
        const response = await fetch(url);  // See if translation API responds
        const data = await response.json(); // Get data from response

        // Log full API response for debugging
        console.log('API Response:', data);
        
        if (data.responseStatus === 200 && data.responseData) { // If response is successful (HTTP message 200) and there's data (translated text)
            // Extract the translated text from response
            const translation = data.responseData.translatedText;
            
            // Log successful translation
            console.log('Translation result:', translation);
            
            // Return the translated text
            return translation;
        }
        
        // Log warning if translation was unavailable
        console.warn('Translation unavailable, response:', data);
        
        // Return fallback message if API didn't provide translation
        return '[Translation unavailable]';
    } catch (error) {
        // Log any errors that occurred during translation
        console.error('Translation error:', error);
        
        // Return error message to user
        return '[Translation error]';
    }
}

// Detects whether the input text is in Spanish or English
async function detectLanguage(text) {
    try {
        // Convert text to lowercase for case-insensitive matching
        const lowerText = text.toLowerCase();
        
        // List of common Spanish words that are distinct from English
        const spanishWords = [
            'el', 'la', 'los', 'las',           // Articles
            'un', 'una',                         // Indefinite articles
            'de', 'del', 'al',                   // Prepositions
            'que', 'pero', 'porque',             // Conjunctions
            'es', 'son', 'somos',                // To be conjugations
            'muy', 'todo', 'como',               // Adverbs
            'donde', 'cuando',                   // Question words
            'hola', 'si', 'no'                   // Common words
        ];
        
        // Check if any Spanish words are present in the text
        for (let word of spanishWords) {
            // Use word boundary regex to match whole words only
            const regex = new RegExp('\\b' + word + '\\b', 'i');
            if (regex.test(text)) {
                // Spanish word found, classify as Spanish
                console.log('Detected Spanish:', text);
                return 'es';
            }
        }
        
        // No Spanish indicators found, default to English
        console.log('Detected English:', text);
        return 'en';
    } catch (error) {
        // Log any errors during language detection
        console.error('Language detection error:', error);
        
        // Default to English if detection fails
        return 'en';
    }
}