/*
Name of Code Artifact: homepage.js
Description: Displays all flashcards on homepage.html
Programmer's Name: Genea Dinnal, Sam Kelemen, Skylar Franz
Date Created: 02/16/2026
Date Revised: 04/12/2026
Preconditions (inputs): Clicks and flashcards
Postcondition (outputs): Displays flashcards as divs, Removes cards, Sorts decks, Edits cards
Errors: n/a
*/

const DEFAULT_TRANSCRIPTION_ENDPOINT = 'https://api.assemblyai.com';
const DEFAULT_TRANSCRIPTION_MODEL = 'universal-streaming-multilingual';

// Migration: ensure a default deck exists; assign orphan cards to it
function ensureDefaultDeck(data) {
    let decks = data.decks || [];
    let flashcards = data.flashcards || [];
    decks = decks.map(deck => ({
        ...deck,
        cardIds: deck.cardIds || []
    }));

    if (decks.length === 0) {
        const defaultDeck = { id: 'default', name: 'General', created: new Date().toISOString(), cardIds: flashcards.map(c =>c.id) };
        decks.push(defaultDeck);
        // flashcards.forEach(card => { if (!card.deckId) card.deckId = 'default'; });
        chrome.storage.local.set({ decks, flashcards });
    }

    return { decks, flashcards };
}

let allDecks = [];
let allFlashcards = [];
let activeDeckId = 'all';

// Load flashcards and decks from Chrome storage when page loads
chrome.storage.local.get({ decks: [], flashcards: [] }, (raw) => {
    const data = ensureDefaultDeck(raw);
    allDecks = data.decks;
    allFlashcards = data.flashcards;
    renderDecks(allDecks, allFlashcards, activeDeckId);
    renderFlashcards(allFlashcards);

    // Add event listener for search input
    document.getElementById('searchInput').addEventListener('input', handleSearch);
});

document.addEventListener('DOMContentLoaded', loadTranscriptionSettings);

function renderDecks(decks, flashcards, activeId) {
    const tabsContainer = document.getElementById('deck-tabs');
    tabsContainer.innerHTML = '';

    // "All" tab
    const allTab = createTab('All', 'all', activeId === 'all');
    tabsContainer.appendChild(allTab);

    // One tab per deck
    decks.forEach(deck => {
        const tab = createTab(deck.name, deck.id, activeId === deck.id);
        tabsContainer.appendChild(tab);
    });

    // "＋ New Deck" button
    const newDeckBtn = document.createElement('button');
    newDeckBtn.className = 'deck-tab new-deck-btn';
    newDeckBtn.textContent = '+ New Deck';
    newDeckBtn.addEventListener('click', () => showNewDeckForm(tabsContainer));
    tabsContainer.appendChild(newDeckBtn);
}

function createTab(label, deckId, isActive) {
    const btn = document.createElement('button');
    btn.className = 'deck-tab' + (isActive ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
        activeDeckId = deckId;
        renderDecks(allDecks, allFlashcards, activeDeckId);

        let filtered;
        if (deckId === 'all') {
            filtered = allFlashcards;
        } else {
            const deck = allDecks.find(d => d.id === deckId);
            const cardIds = deck.cardIds || [];
            filtered = allFlashcards.filter(c => cardIds.includes(c.id));
        }
        renderFlashcards(filtered);
    });
    return btn;
}

function showNewDeckForm(tabsContainer) {
    // Avoid duplicate forms
    if (document.getElementById('new-deck-form')) return;

    const form = document.createElement('div');
    form.id = 'new-deck-form';
    form.className = 'new-deck-form';
    form.innerHTML = `
        <input id="new-deck-name" type="text" placeholder="Deck name..." class="new-deck-input">
        <button id="new-deck-create" class="new-deck-create-btn">Create</button>
        <button id="new-deck-cancel" class="new-deck-cancel-btn">Cancel</button>
    `;

    tabsContainer.parentElement.insertBefore(form, tabsContainer.nextSibling);

    document.getElementById('new-deck-cancel').addEventListener('click', () => form.remove());

    document.getElementById('new-deck-create').addEventListener('click', () => {
        const name = document.getElementById('new-deck-name').value.trim();
        if (!name) { document.getElementById('new-deck-name').focus(); return; }
        const newDeck = { id: Date.now().toString(), name, created: new Date().toISOString(), cardIds: [] };
        allDecks.push(newDeck);
        chrome.storage.local.set({ decks: allDecks }, () => {
            form.remove();
            activeDeckId = newDeck.id;
            renderDecks(allDecks, allFlashcards, activeDeckId);
            renderFlashcards(allFlashcards.filter(c => c.deckId === newDeck.id));
        });
    });
}

// Renders flashcards in the flashcard container with flip and delete functionality
function renderFlashcards(flashcards) {
    // Get reference to the flashcard container element
    const container = document.getElementById("flashcard-container");
    
    // Clear any existing cards from the container
    container.innerHTML = "";

    // Check if there are no flashcards to display
    if (flashcards.length === 0) {
        // Show empty state message
        container.innerHTML = '<p style="text-align:center;color:#666;padding:40px;">No flashcards yet! Start creating some.</p>';
        return;
    }

    // Iterate through each flashcard and create its DOM element
    flashcards.forEach(card => {
        // Create a div element for the card
        const cardDiv = document.createElement("div");
        
        // Add CSS class for styling
        cardDiv.classList.add("card");
        
        // Store card ID as data attribute for delete functionality
        cardDiv.dataset.id = card.id;

        // Get all decks for edit select
        const deckOptions = allDecks.map(deck => 
            `<option value="${deck.id}" ${deck.id === card.deckId ? 'selected' : ''}>
                ${escapeHtml(deck.name)}
            </option>`
        ).join('');

        // Set inner HTML with card structure and delete button
        cardDiv.innerHTML = `
            <div class="card-inner">
                <button class="edit-button">E</button>
                <button class="delete-button">X</button>
                <div class="card-front">${escapeHtml(card.front)}</div>
                <div class="card-back">${escapeHtml(card.back)}</div>
            </div>
             <div class="edit-form">
                <input class="front-input" value="${escapeHtml(card.front)}">
                <input class="back-input" value="${escapeHtml(card.back)}">
                <select class="deck-select">${deckOptions}</select>
                <button class="save-button">Save</button>
            </div>
        `;  // Add the front and back words to card, alongside delete/edit buttons and form

        cardDiv.addEventListener("click", () => {   // Add event so that when card is clicked
            cardDiv.classList.toggle("flipped");    // It flips it
        });

        const deleteButton = cardDiv.querySelector(".delete-button");   // Selects delete button
        deleteButton.addEventListener("click", (e) => { // When delete button is clicked
            if (confirm('Delete card?')) {  // If user confirms to delete the card
                e.stopPropagation(); // (Stops event, a.k.a card from flipping)
                deleteCard(card.id, cardDiv); // And delete card
            }
        });

        const editButton = cardDiv.querySelector(".edit-button");
        const editForm = cardDiv.querySelector(".edit-form");
        const saveButton = cardDiv.querySelector(".save-button");

        editButton.addEventListener("click", (e) => { // When edit button is clicked
            e.stopPropagation(); // (Stops event, a.k.a card from flipping)
            editForm.style.display = editForm.style.display === 'none' ? 'flex' : 'none'; // If edit button is clicked, show edit form (flex), otherwise show nothing
        });

        editForm.addEventListener("click", (e) => { // Stop card from flipping when edit form is toggled
            e.stopPropagation();
         });

        // On save button click, update the card with the new values from edit form
        saveButton.addEventListener("click", (e) => {
            e.stopPropagation();

            const cardIndex = flashcards.findIndex(c => c.id === card.id);  // Find card in local storage based off ID
            const editCard = flashcards[cardIndex];

            editCard.front = cardDiv.querySelector(".front-input").value;  // Changes card's front value to the value from front-input in edit form
            editCard.back = cardDiv.querySelector(".back-input").value;

            cardDiv.querySelector(".card-front").textContent = editCard.front; // Change card front text on homepage.html to new text
            cardDiv.querySelector(".card-back").textContent = editCard.back;
            
            // Grab values to swap decks
            const oldDeckId = editCard.deckId;
            const newDeckId = cardDiv.querySelector(".deck-select").value;
            editCard.deckId = newDeckId;
            updateCardDeck(card.id, oldDeckId, newDeckId, allDecks);

            // Save cards
            chrome.storage.local.set({
                flashcards: allFlashcards, 
                decks: allDecks 
            }, () => {
                renderFlashcards(allFlashcards.filter(c => c.deckId === activeDeckId)) // Refresh card display to show edits
            });

            editForm.style.display = 'none'; // Remove edit form

        });

        container.appendChild(cardDiv); // Add card to HTML section
    });
}

// Updates card deck (remove from old deck, add to new deck)
function updateCardDeck(cardId, oldDeckId, newDeckId, decks) {
    if (oldDeckId === newDeckId) return;

    // Remove card ID from the old deck
    const oldDeck = decks.find(d => d.id === oldDeckId);
    if (oldDeck && oldDeck.cardIds) {
        oldDeck.cardIds = oldDeck.cardIds.filter(id => id !== cardId);
    }

    // Add card ID to the new deck
    const newDeck = decks.find(d => d.id === newDeckId);
    if (newDeck) {
        newDeck.cardIds = newDeck.cardIds || [];
        if (!newDeck.cardIds.includes(cardId)) { // Prevent duplicate IDs
            newDeck.cardIds.push(cardId);
        }
    }
}

// Deletes one card from storage based on card ID
function deleteCard(id, cardDiv) {
    chrome.storage.local.get({ flashcards: [] }, (data) => {    // Get flashcards from local storage
        const oldFlashcards = data.flashcards;  // Old flashcards
        const newFlashcards = oldFlashcards.filter(card => card.id !== id); // Create new deck where that one card is removed
        chrome.storage.local.set({ flashcards: newFlashcards }); // Save the updated deck to local storage flashcards
        cardDiv.remove(); // Remove card element from homepage.html
    });
}

// Delete all flashcards
const deleteAllButton = document.getElementById("deleteAll");
deleteAllButton.addEventListener("click", () => {
    if (confirm('Are you sure you want to delete all flashcards?')) { // If user confirms they want to delete all flashcards
        chrome.storage.local.remove('flashcards'); // Remove flashcards from local storage
        location.reload(); // Refresh to show no cards
    }
});


// Grabs and assigns variables from homepage.html document elements
const modeSwitch = document.getElementById("modeSwitch");
const modeLabel = document.getElementById("modeLabel");

const learnSection = document.getElementById("learn-mode");
const practiceSection = document.getElementById("practice-mode");

// Changes mode (Practice/Switch) when switch is clicked
modeSwitch.addEventListener("change", () => {
  // Check if switch is in checked state
  if (modeSwitch.checked) {
    // Switch to practice mode
    learnSection.style.display = "none";          // Hide learn section
    practiceSection.style.display = "block";      // Show practice section
    modeLabel.textContent = "Practice Mode";      // Update label text
    loadPracticeMode(activeDeckId);                      // Load flashcards for practice mode
  } else {
    // Switch to learn mode
    practiceSection.style.display = "none";       // Hide practice section
    learnSection.style.display = "block";         // Show learn section
    modeLabel.textContent = "Learn Mode";         // Update label text
  }
});

// Get references to menu elements
const menuIcon = document.querySelector(".menu-icon");
const dropdownMenu = document.getElementById("dropdown-menu");

// Loads practice mode interface and flashcards based on selected deck
function loadPracticeMode(deckId) {
    activeDeckId = deckId;
    const practiceSection = document.getElementById("practice-mode");
    practiceSection.style.display = "block";
    let cards;
    if (deckId === 'all') {
        cards = allFlashcards;
    } else {
        const deck = allDecks.find(d => d.id === deckId);
        if (!deck) {
            practiceSection.innerHTML = "<p>Error: Deck not found.</p>";
            return;
        }
        cards = allFlashcards.filter(c => deck.cardIds.includes(c.id));
    }
    practiceSection.innerHTML = `
        <h2>Practice</h2>
        <div id="test-container">
            <h3>Test Mode</h3>
            <div>
                <label><input type="radio" name="test-mode" value="easy" checked> Easy</label>
                <label><input type="radio" name="test-mode" value="hard"> Hard</label>
            </div>
            <button id="begin-test">Begin Test</button>
            <div id="test-setup"></div>
            <div id="test-list"></div>
        </div>
    `;
    attachBeginTestHandler();
}

// Attaches event handler to "Begin Test" button to generate test based on selected mode and active deck
function attachBeginTestHandler() {
    document.getElementById("begin-test").addEventListener("click", () => { 
        const mode = document.querySelector('input[name="test-mode"]:checked').value;
        let cards;
        if (activeDeckId === 'all') {
            cards = allFlashcards;
        } else {
            const deck = allDecks.find(d => d.id === activeDeckId);
            if (!deck) {
                console.error("Active deck not found");
                return;
            }
            cards = allFlashcards.filter(c => deck.cardIds.includes(c.id));
        }
        const count = cards.length;
        if (mode === "easy") {
            generateEasyTest(count, cards);
        }       
        if (mode === "hard") {
            generateHardTest(count, cards);
        }
    });
}

// easy test mode generator
function generateEasyTest(count, cards) {
    document.getElementById("test-setup").innerHTML = `<p>Answer the following questions by selecting the correct answer from the dropdown menu. Good luck!</p>`;
    const testList = document.getElementById("test-list");
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);
    const allBackWords = cards.map(c => c.back);
    let html = "<h3>Easy Test</h3>";
    // For each selected card, create a dropdown with all possible back words as options
    selected.forEach((card, index) => {
        const options = allBackWords.map(word => `<option value="${escapeHtml(word)}">${escapeHtml(word)}</option>`).join("");
        html += `
            <div class = "test-item">
                <div class="test-item-header">
                    <strong>${index + 1}.</strong> 
                    <span>${escapeHtml(card.front)}</span>
                </div>
                <select class ="easy-answer" data-card-id="${card.id}">
                    <option value="">Select answer...</option>
                    ${options}
                </select>
            </div>
        `;
    });
    testList.innerHTML = html;
    testList.innerHTML += `
        <button id="submit-test">Submit Test</button>
        <div id="test-results"></div>
    `;
    document.getElementById("submit-test").addEventListener("click", () => {
    gradeTest(selected);
    });
}       

// hard test mode generator
function generateHardTest(count, cards) {
    document.getElementById("test-setup").innerHTML = `<p>Answer the following questions by typing the correct answer in the text box. Good luck!</p>`;
    const testList = document.getElementById("test-list");
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);
    let html = "<h3>Hard Test</h3>";
    // For each selected card, create a text input for the user to type their answer
    selected.forEach((card, index) => {
        html += `
            <div class = "test-item">
                <div class="test-item-header">
                    <strong>${index + 1}.</strong> 
                    <span>${escapeHtml(card.front)}</span>
                </div>
                <input type="text" class="hard-answer" data-card-id="${card.id}" placeholder="Type your answer...">
            </div>
        `;
    });
    testList.innerHTML = html;
    testList.innerHTML += `
        <button id="submit-test">Submit Test</button>
        <div id="test-results"></div>
    `;  
    document.getElementById("submit-test").addEventListener("click", () => {
    gradeTest(selected);
    });
}
// Grades test answers and displays results
function gradeTest(cards) {
    const resultsDiv = document.getElementById("test-results");

    let correct = 0;
    let total = cards.length;

    // Build a lookup table for answers
    const answerKey = {};
    cards.forEach(c => answerKey[c.id] = c.back.trim().toLowerCase());

    // EASY MODE grading
    document.querySelectorAll(".easy-answer").forEach(select => {
        const cardId = select.dataset.cardId;
        const userAnswer = normalize(select.value);
        const correctAnswer = normalize(answerKey[cardId]);

        if (userAnswer === correctAnswer) {
            correct++;
            select.style.border = "2px solid green";
            const correctSpan = document.createElement("span");
            correctSpan.className = "correct-answer";
            correctSpan.textContent = `${answerKey[cardId]}`;
            select.insertAdjacentElement('afterend', correctSpan);
        } else {
            select.style.border = "2px solid red";
            const correctSpan = document.createElement("span");
            correctSpan.className = "wrong-answer";
            correctSpan.textContent = `${answerKey[cardId]}`;
            select.insertAdjacentElement('afterend', correctSpan);
        }
    });

    // HARD MODE grading
    document.querySelectorAll(".hard-answer").forEach(input => {
        const cardId = input.dataset.cardId;
        const userAnswer = normalize(input.value);
        const correctAnswer = normalize(answerKey[cardId]);

        if (userAnswer === correctAnswer) {
            correct++;
            input.style.border = "2px solid green";
            const correctSpan = document.createElement("span");
            correctSpan.className = "correct-answer";
            correctSpan.textContent = `${answerKey[cardId]}`;
            input.insertAdjacentElement('afterend', correctSpan);
        } else {
            input.style.border = "2px solid red";
            const correctSpan = document.createElement("span");
            correctSpan.className = "wrong-answer";
            correctSpan.textContent = `${answerKey[cardId]}`;
            input.insertAdjacentElement('afterend', correctSpan);
        }
    });

    // Display score
    resultsDiv.innerHTML = `
        <h3>Results</h3>
        <p>You scored <strong>${correct}</strong> out of <strong>${total}</strong>.</p>
    `;
}

function normalize(str) {
    return str
        .trim()
        .toLowerCase()
};
// Add click event listener to hamburger menu icon
menuIcon.addEventListener("click", (e) => {
    // Toggle dropdown menu visibility
    // If currently visible, hide it; if hidden, show it
    dropdownMenu.style.display =
        dropdownMenu.style.display === "block" ? "none" : "block"; // If dropdown menu is already shown, hide it. Elsewise, show dropdown.
});

// Add click event listener to entire document to close menu when clicking outside
// When clicked outside dropdown menu icon, close dropdown menu
document.addEventListener("click", (e) => {
    if (!menuIcon.contains(e.target) && !dropdownMenu.contains(e.target)) { // If menu icon is not the one clicked
        dropdownMenu.style.display = "none"; // Hide dropdown
    }
});

// Escapes HTML special characters to prevent XSS attacks
function escapeHtml(text) {
    // Create a temporary div element
    const div = document.createElement('div');
    
    // Set text content (automatically escapes HTML)
    div.textContent = text;
    
    // Return the escaped HTML string
    return div.innerHTML;
}

function loadTranscriptionSettings() {
    chrome.storage.local.get({
        transcriptionApiKey: '',
        transcriptionEndpoint: DEFAULT_TRANSCRIPTION_ENDPOINT,
        transcriptionModel: DEFAULT_TRANSCRIPTION_MODEL
    }, (data) => {
        document.getElementById('transcriptionApiKey').value = data.transcriptionApiKey || '';
        document.getElementById('transcriptionEndpoint').value = data.transcriptionEndpoint || DEFAULT_TRANSCRIPTION_ENDPOINT;
        document.getElementById('transcriptionModel').value = data.transcriptionModel || DEFAULT_TRANSCRIPTION_MODEL;
    });

    document.getElementById('saveTranscriptionSettings').addEventListener('click', saveTranscriptionSettings);
}

function saveTranscriptionSettings() {
    const apiKey = document.getElementById('transcriptionApiKey').value.trim();
    const endpoint = document.getElementById('transcriptionEndpoint').value.trim() || DEFAULT_TRANSCRIPTION_ENDPOINT;
    const model = document.getElementById('transcriptionModel').value.trim() || DEFAULT_TRANSCRIPTION_MODEL;
    const status = document.getElementById('transcriptionSettingsStatus');

    chrome.storage.local.set({
        transcriptionApiKey: apiKey,
        transcriptionEndpoint: endpoint,
        transcriptionModel: model
    }, () => {
        status.textContent = 'Transcription settings saved.';
        setTimeout(() => {
            status.textContent = '';
        }, 2500);
    });
}

// Handles search input and filters flashcards in real-time
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    
    // If search is empty, show all cards for active deck
    if (searchTerm === '') {
        const filtered = activeDeckId === 'all'
            ? allFlashcards
            : allFlashcards.filter(c => c.deckId === activeDeckId);
        renderFlashcards(filtered);
        return;
    }
    
    // Otherwise, filter by search term
    filterFlashcardsBySearch(searchTerm);
}

// Filters and displays flashcards based on search term
function filterFlashcardsBySearch(searchTerm) {
    // Start with deck-filtered cards
    let flashcards = activeDeckId === 'all'
        ? allFlashcards
        : allFlashcards.filter(c => c.deckId === activeDeckId);
    
    // Then filter by search term (search both front and back)
    flashcards = flashcards.filter(card => 
        card.front.toLowerCase().includes(searchTerm) || 
        card.back.toLowerCase().includes(searchTerm)
    );
    
    // Render the filtered results
    renderFlashcards(flashcards);
}
// Opens the new card creation modal
function openNewCardModal() {
    const modal = document.getElementById('newCardModal');
    const deckSelect = document.getElementById('newCardDeck');
    
    // Populate deck options
    deckSelect.innerHTML = '';
    allDecks.forEach(deck => {
        const option = document.createElement('option');
        option.value = deck.id;
        option.textContent = deck.name;
        // Pre-select the active deck if not "all"
        if (activeDeckId !== 'all' && deck.id === activeDeckId) {
            option.selected = true;
        }
        deckSelect.appendChild(option);
    });
    
    // Clear input fields
    document.getElementById('newCardFront').value = '';
    document.getElementById('newCardBack').value = '';
    
    // Show modal
    modal.style.display = 'flex';
    
    // Focus on front input
    document.getElementById('newCardFront').focus();
}

// Closes the new card creation modal
function closeNewCardModal() {
    document.getElementById('newCardModal').style.display = 'none';
}

// Creates and saves a new flashcard
function createManualFlashcard() {
    const front = document.getElementById('newCardFront').value.trim();
    const back = document.getElementById('newCardBack').value.trim();
    const deckId = document.getElementById('newCardDeck').value;
    
    // Validate inputs
    if (!front || !back) {
        alert('Please fill in both front and back text!');
        return;
    }
    
    // Check for duplicates
    const frontLower = front.toLowerCase();
    const backLower = back.toLowerCase();
    
    const isDuplicate = allFlashcards.some(card => 
        card.front.toLowerCase() === frontLower && 
        card.back.toLowerCase() === backLower
    );
    
    if (isDuplicate) {
        alert('This flashcard already exists! Please create a different one.');
        return;
    }
    
    // Create new flashcard object
    const newCard = {
        id: Date.now(),
        front: front,
        back: back,
        frontLang: 'unknown',  // Manual cards don't have auto-detected language
        backLang: 'unknown',
        deckId: deckId,
        created: new Date().toISOString()
    };
    
    // Add to allFlashcards array
    allFlashcards.push(newCard);

    // Update the specific deck's cardIds list
    const targetDeck = allDecks.find(d => d.id === deckId);
    if (targetDeck) {
        targetDeck.cardIds = targetDeck.cardIds || [];
        targetDeck.cardIds.push(newCard.id);
    }
    
    // Save to Chrome storage
    chrome.storage.local.set({ 
        flashcards: allFlashcards, 
        decks: allDecks 
    }, () => {
        // Close modal
        closeNewCardModal();
        
        // Refresh display
        if (activeDeckId === 'all' || activeDeckId === deckId) {
            const filtered = activeDeckId === 'all'
                ? allFlashcards
                : allFlashcards.filter(c => c.deckId === activeDeckId);
            renderFlashcards(filtered);
        }
        
        // Show success message
        showSuccessNotification('Flashcard created!');
    });
}

// Shows a success notification
function showSuccessNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 14px 24px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); font-size: 14px; font-weight: 600; z-index: 2000;';
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2500);
}

// Opens the export modal and populates the deck selector
function openExportModal() {
    const select = document.getElementById('exportDeck');

    // Reset options and add "All Cards" as the first option
    select.innerHTML = '<option value="all">All Cards</option>';

    // Add one option per deck, pre-selecting the currently active deck
    allDecks.forEach(deck => {
        const opt = document.createElement('option');
        opt.value = deck.id;
        opt.textContent = deck.name;
        if (deck.id === activeDeckId) opt.selected = true; // Pre-select active deck
        select.appendChild(opt);
    });

    // Show modal and close the hamburger dropdown
    document.getElementById('exportModal').style.display = 'flex';
    dropdownMenu.style.display = 'none';
}

// Closes the export modal
function closeExportModal() {
    document.getElementById('exportModal').style.display = 'none';
}

// Builds and downloads a CSV file for the selected deck using the chosen delimiter
function exportFlashcards() {
    // Get selected deck ID and delimiter from the modal
    const deckId = document.getElementById('exportDeck').value;
    const delimiter = document.getElementById('exportDelimiter').value;

    // Determine which cards to export and what to name the file
    let cards, filename;
    if (deckId === 'all') {
        // Export every card across all decks
        cards = allFlashcards;
        filename = 'all_flashcards';
    } else {
        // Export only cards belonging to the selected deck
        const deck = allDecks.find(d => d.id === deckId);
        const cardIds = deck ? (deck.cardIds || []) : [];
        cards = allFlashcards.filter(c => cardIds.includes(c.id));
        // Sanitize deck name for use as a filename
        filename = deck ? deck.name.replace(/[^a-z0-9_\-]/gi, '_') : 'flashcards';
    }

    // Build CSV content: one line per card in the form front<delimiter>back
    const csvContent = cards.map(c => `${c.front}${delimiter}${c.back}`).join('\n');

    // Create a downloadable blob and trigger the browser download
    const blob = new Blob([csvContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`; // Save as .csv for compatibility with Anki and other apps
    document.body.appendChild(a);
    a.click(); // Programmatically click the link to start the download
    document.body.removeChild(a);
    URL.revokeObjectURL(url); // Release the object URL to free memory

    closeExportModal();
}

// Add event listeners for new card modal
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('newCardBtn').addEventListener('click', openNewCardModal);
    document.getElementById('cancelNewCard').addEventListener('click', closeNewCardModal);
    document.getElementById('saveNewCard').addEventListener('click', createManualFlashcard);

    // Allow Enter key to submit in modal
    document.getElementById('newCardBack').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            createManualFlashcard();
        }
    });

    // Close modal when clicking outside
    document.getElementById('newCardModal').addEventListener('click', (e) => {
        if (e.target.id === 'newCardModal') {
            closeNewCardModal();
        }
    });

    // Export modal event listeners
    document.getElementById('exportCardsBtn').addEventListener('click', openExportModal);
    document.getElementById('cancelExport').addEventListener('click', closeExportModal);
    document.getElementById('confirmExport').addEventListener('click', exportFlashcards);
    document.getElementById('exportModal').addEventListener('click', (e) => {
        if (e.target.id === 'exportModal') closeExportModal();
    });
});
