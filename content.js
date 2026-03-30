/*
Name of Code Artifact: content.js
Description: Injects translation popups, receives translations from background.js, and creates flashcards based on selected text or transcript clicks.
Programmer's Name: Jenny Tsotezo, Sam Kelemen, Skylar Franz
Date Created: 02/15/2026
Date Revised: 03/29/2026
Preconditions (inputs): User-selected text or transcript word clicks
Postcondition (outputs): New flashcard with selected text and translation
Errors: n/a
*/

chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'showTranslationCard') {
        showTranslation(request.text);
    }
});

function showTranslation(text, options = {}) {
    chrome.runtime.sendMessage({
        action: 'detectLanguage',
        text
    }, (langResponse) => {
        let direction = 'en-es';

        if (langResponse && langResponse.success && langResponse.language === 'es') {
            direction = 'es-en';
        }

        chrome.runtime.sendMessage({
            action: 'translateText',
            text,
            direction
        }, (response) => {
            if (response && response.success) {
                displayPopup(text, response.translation, direction, options);
            } else {
                options.onError?.(response?.error || 'Unable to translate that word.');
                showNotification('Translation failed.');
            }
        });
    });
}

function displayPopup(original, translation, direction, options = {}) {
    const existing = document.getElementById('vv-popup');
    if (existing) {
        existing.remove();
    }

    chrome.storage.local.get({ decks: [] }, (data) => {
        const decks = data.decks;
        const popup = document.createElement('div');
        popup.id = 'vv-popup';
        popup.innerHTML = `
            <div class="vv-modal-backdrop"></div>
            <div class="vv-modal-card">
                <button type="button" class="vv-modal-close" aria-label="Close">×</button>

                <div class="vv-modal-group">
                    <strong class="vv-label">Original</strong>
                    <input id="vv-original-text" class="vv-original" value="${escapeHtml(original)}">
                    <select id="original-synonyms">
                    </select>
                </div>

                <div class="vv-modal-group">
                    <label class="vv-label" for="vv-direction-select">Translation Direction</label>
                    <select id="vv-direction-select" class="vv-select">
                        <option value="en-es" ${direction === 'en-es' ? 'selected' : ''}>English → Spanish</option>
                        <option value="es-en" ${direction === 'es-en' ? 'selected' : ''}>Spanish → English</option>
                    </select>
                </div>

                <div class="vv-modal-group">
                    <strong class="vv-label">Translation</strong>
                    <input id="vv-translation-text" class="vv-translation" value="${escapeHtml(translation)}">
                    <select id="translation-synonyms">
                    </select>
                </div>

                ${decks.length > 0 ? `
                <div class="vv-modal-group">
                    <label class="vv-label" for="vv-deck-select">Add to Deck</label>
                    <select id="vv-deck-select" class="vv-select">
                        ${decks.map((deck) => `<option value="${escapeHtml(deck.id)}">${escapeHtml(deck.name)}</option>`).join('')}
                    </select>
                </div>` : ''}

                <button id="vv-add-btn" class="vv-primary-btn">Add to Flashcards</button>
            </div>`;

        document.body.appendChild(popup);
        options.onOpen?.();

        addSynonyms(original, 'original-synonyms');
        addSynonyms(translation, 'translation-synonyms');

        let currentDirection = direction;
        let currentTranslation = translation;
        let closed = false;

        const closePopup = () => {
            if (closed) {
                return;
            }

            closed = true;
            popup.remove();
            options.onClose?.();
        };

        popup.querySelector('.vv-modal-backdrop').addEventListener('click', closePopup);
        popup.querySelector('.vv-modal-close').addEventListener('click', closePopup);

        document.getElementById('vv-direction-select').addEventListener('change', (event) => {
            currentDirection = event.target.value;
            const translationDiv = document.getElementById('vv-translation-text');
            translationDiv.textContent = 'Translating...';
            translationDiv.style.opacity = '0.5';

            chrome.runtime.sendMessage({
                action: 'translateText',
                text: original,
                direction: currentDirection
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

        // Create flashcard with current translation and direction (editable by user)
        document.getElementById('vv-add-btn').addEventListener('click', () => {
            const selectedDeck = document.getElementById('vv-deck-select')?.value || 'default';
            
            // Create flashcard with current translation and direction (editable by user)
            const inputOriginal = document.getElementById('vv-original-text').value;
            const inputTranslation = document.getElementById('vv-translation-text').value;
            addFlashcard(inputOriginal, inputTranslation, currentDirection, selectedDeck);
            
            // Show success notification to user
            showNotification('Flashcard added!');
            options.onAdd?.({
                original,
                translation: currentTranslation,
                direction: currentDirection,
                deckId: selectedDeck
            });
            closePopup();
        });

        const originalSelect = document.getElementById('original-synonyms');
        const originalInput = document.getElementById('vv-original-text');
        const translationSelect = document.getElementById('translation-synonyms');
        const translationInput = document.getElementById('vv-translation-text');

        originalSelect.addEventListener('change', (event) => {
            originalInput.value = event.target.value;
        });

        translationSelect.addEventListener('change', (event) => {
            translationInput.value = event.target.value;
        });

    });
}

function addFlashcard(front, back, direction, deckId = 'default') {
    chrome.storage.local.get({ flashcards: [], decks: [] }, (data) => {
        const flashcards = data.flashcards;
        const decks = data.decks;

        const frontLang = direction === 'es-en' ? 'es' : 'en';
        const backLang = direction === 'es-en' ? 'en' : 'es';

        const newCard = {
            id: Date.now(),
            front,
            back,
            frontLang,
            backLang,
            deckId,
            created: new Date().toISOString()
        };

        flashcards.push(newCard);

        // Update the deck's cardIds list
        const deck = decks.find(d => d.id === deckId);
        if (deck) {
            deck.cardIds = deck.cardIds || [];
            deck.cardIds.push(newCard.id);
        }

        chrome.storage.local.set({ flashcards, decks });
    });
}

function showNotification(message) {
    const note = document.createElement('div');
    note.className = 'vv-note';
    note.textContent = message;
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 2500);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

if (window.VocabVaultTranscript?.init) {
    window.VocabVaultTranscript.init({
        showTranslation,
        showNotification,
        escapeHtml
    });
}

function addSynonyms(text, selectId) {
    const select = document.getElementById(selectId);

    chrome.runtime.sendMessage({
        action: 'getSynonyms',
        text: text
    }, (response) => {
        if (response.synonyms && response.synonyms.length > 0) {
            response.synonyms.forEach(item => {
                console.log(item);
                const option = document.createElement('option');
                option.value = item.word;
                option.textContent = item.word;
                select.appendChild(option);
            });
        }
        else {
            console.log('none found');
            const nothing = document.createElement('option');
            nothing.value = text;
            nothing.textContent = "None found";
            select.appendChild(nothing);
        }
    });
}