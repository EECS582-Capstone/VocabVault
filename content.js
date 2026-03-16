/*
Name of Code Artifact: content.js
Description: Recieves translation from background.js and creates a card based off of that
Programmer's Name: Jenny Tsotezo, Sam Kelemen, Skylar Franz
Date Created: 02/15/2026
Date Revised: 03/15/2026
Preconditions (inputs): User selected text
Postcondition (outputs): New flashcard with selected text and translation
Errors: n/a
*/

// Listen for popup requests from background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "showTranslationCard") { // If request action is to show translation flashcard
        showTranslation(request.text);              // Translate the text and display it on flashcard
    }
});

// Initiates the translation process by first detecting the language, then translating in the appropriate direction
function showTranslation(text) {
    // Send message to background script to detect the language of the text
    chrome.runtime.sendMessage({
        action: "detectLanguage",           // Request type for language detection
        text: text                          // Text to analyze
    }, (langResponse) => {
        // Default translation direction (English to Spanish)
        let direction = 'en-es';
        
        // Check if language detection was successful
        if (langResponse && langResponse.success) {
            // Determine translation direction based on detected language
            if (langResponse.language === 'es') {
                // If Spanish detected, translate to English
                direction = 'es-en';
            } else {
                // If English detected, translate to Spanish
                direction = 'en-es';
            }
        }
        
        // Send message to background script to translate the text
        chrome.runtime.sendMessage({
            action: "translateText",        // Request type for translation
            text: text,                     // Original text
            direction: direction            // Translation direction (es-en or en-es)
        }, (response) => {
            // Check if translation was successful
            if (response && response.success) {
                // Display popup with original text, translation, and direction
                displayPopup(text, response.translation, direction);
            }
        });
    });
}

function displayPopup(original, translation, direction) {
    // Remove any existing translation popup to avoid duplicates
    const existing = document.getElementById('vv-popup');
    if (existing) existing.remove();

    // Retrieve available decks from Chrome storage
    chrome.storage.local.get({ decks: [] }, (data) => {
        // Get the decks array from storage
        const decks = data.decks;
        
        // Build HTML options for deck selector dropdown
        let deckOptionsHTML = '';
        decks.forEach(deck => {
            // Create an option element for each deck
            deckOptionsHTML += `<option value="${deck.id}">${deck.name}</option>`;
        });

        // Create a new div element for the popup
        const popup = document.createElement('div');
        popup.id = 'vv-popup';                  // Set unique ID for the popup
        
        // Set the inner HTML of popup with inline styles and content
        popup.innerHTML = `
            <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483647;background:white;padding:24px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4);min-width:350px;max-width:500px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
                <button onclick="this.parentElement.parentElement.remove()" style="position:absolute;top:-8px;right:-8px;background:#ff5252;color:white;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:20px;line-height:1;box-shadow:0 2px 8px rgba(0,0,0,0.2);">×</button>
                <div style="margin-bottom:16px;">
                    <strong style="display:block;margin-bottom:8px;color:#333;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Original:</strong>
                    <input id="vv-original-text" style="padding:12px;background:#f5f5f5;border-radius:6px;color:#222;font-size:16px;line-height:1.5;" value="${escapeHtml(original)}">
                </div>
                <div style="margin-bottom:16px;">
                    <label style="display:block;margin-bottom:8px;color:#333;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Translation Direction:</label>
                    <select id="vv-direction-select" style="width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:6px;font-size:14px;cursor:pointer;">
                        <option value="en-es" ${direction === 'en-es' ? 'selected' : ''}>English → Spanish</option>
                        <option value="es-en" ${direction === 'es-en' ? 'selected' : ''}>Spanish → English</option>
                    </select>
                </div>
                <div style="margin-bottom:16px;">
                    <strong style="display:block;margin-bottom:8px;color:#333;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Translation:</strong>
                    <input id="vv-translation-text" style="padding:12px;background:#e3f2fd;border-radius:6px;color:#222;font-size:16px;line-height:1.5;font-weight:500;" value="${escapeHtml(translation)}">
                </div>
                ${decks.length > 0 ? `
                <div style="margin-bottom:16px;">
                    <label style="display:block;margin-bottom:8px;color:#333;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Add to Deck:</label>
                    <select id="vv-deck-select" style="width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:6px;font-size:14px;cursor:pointer;">
                        ${deckOptionsHTML}
                    </select>
                </div>
                ` : ''}
                <button id="vv-add-btn" style="width:100%;padding:12px;background:#2196F3;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;transition:background 0.2s;" onmouseover="this.style.background='#1976D2'" onmouseout="this.style.background='#2196F3'">Add to Flashcards</button>
            </div>
        `;
        
        // Append the popup to the webpage's body
        document.body.appendChild(popup);
        
        // Store current direction and translation
        let currentDirection = direction;
        let currentTranslation = translation;
        
        // Add event listener to direction selector
        document.getElementById('vv-direction-select').addEventListener('change', (e) => {
            const newDirection = e.target.value;
            currentDirection = newDirection;
            
            // Show loading state
            const translationDiv = document.getElementById('vv-translation-text');
            translationDiv.textContent = 'Translating...';
            translationDiv.style.opacity = '0.5';
            
            // Request new translation with selected direction
            chrome.runtime.sendMessage({
                action: "translateText",
                text: original,
                direction: newDirection
            }, (response) => {
                translationDiv.style.opacity = '1';
                if (response && response.success) {
                    currentTranslation = response.translation;
                    translationDiv.textContent = response.translation;
                } else {
                    translationDiv.textContent = '[Translation failed]';
                }
            });
        });
        
        // Add event listener to the "Add to Flashcards" button
        document.getElementById('vv-add-btn').addEventListener('click', () => {
            // Get the selected deck ID from dropdown, or use 'default' if no dropdown exists
            const selectedDeck = document.getElementById('vv-deck-select')?.value || 'default';
            
            // Create flashcard with current translation and direction (editable by user)
            const inputOriginal = document.getElementById('vv-original-text').value;
            const inputTranslation = document.getElementById('vv-translation-text').value;
            addFlashcard(inputOriginal, inputTranslation, currentDirection, selectedDeck);
            
            // Remove the popup from the page
            popup.remove();
            
            // Show success notification to user
            showNotification('Flashcard added!');
        });
    });
}

// Add flashcard to chrome local storage
function addFlashcard(front, back, direction, deckId = 'default') {
    chrome.storage.local.get({ flashcards: [] }, (data) => {    // Get flashcards from chrome local storage
        const flashcards = data.flashcards; // Assign variable/list to flashcards data
        let frontLang, backLang;
        if (direction === 'es-en') {
            frontLang = 'es';
            backLang = 'en';
        } else {
            frontLang = 'en';
            backLang = 'es';
        }
        flashcards.push({
            id: Date.now(),
            front: front,
            back: back,
            frontLang: frontLang,  // Track language of front
            backLang: backLang,    // Track language of back
            deckId: deckId,        // Track which deck this belongs to
            created: new Date().toISOString()
        });
        chrome.storage.local.set({ flashcards: flashcards });   // Save new flashcards to local storage
    });
}

// Show notification
function showNotification(message) {
    const note = document.createElement('div'); // Create new div
    note.textContent = message;                 // Display message
    note.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483647;background:#4CAF50;color:white;padding:14px 24px;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.2);font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:500;';
    document.body.appendChild(note);            // Add notification to webpage/document
    setTimeout(() => note.remove(), 2500);      // Remove after 2.5 seconds
}

// Escapes HTML special characters to prevent XSS attacks
function escapeHtml(text) {
    // Create a temporary div element
    const div = document.createElement('div');
    
    // Set text content (automatically escapes HTML)
    div.textContent = text;
    
    // Return the escaped HTML string
    return div.innerHTML;
}