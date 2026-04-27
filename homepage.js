/*
Name of Code Artifact: homepage.js
Description: Displays all flashcards on homepage.html
Programmer's Name: Genea Dinnall, Sam Kelemen, Skylar Franz, Meg Taggart
Date Created: 02/16/2026
Date Revised: 04/12/2026
Preconditions (inputs): Clicks and flashcards
Postcondition (outputs): Displays flashcards as divs, Removes cards, Sorts decks, Edits cards
Errors: n/a
*/

const DEFAULT_TRANSCRIPTION_ENDPOINT = 'https://api.assemblyai.com';
const DEFAULT_TRANSCRIPTION_MODEL = 'universal-streaming-multilingual';
const DEFAULT_CARD_COLORS = {
    frontColor: '#f6efd5',
    backColor: '#A5BFCC',
    textColor: '#000000'
};

let currentCardColors = { ...DEFAULT_CARD_COLORS };
let savedCardColors = { ...DEFAULT_CARD_COLORS };

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
    loadCardColors(() => renderFlashcards(allFlashcards));

    // Add event listener for search input
    document.getElementById('searchInput').addEventListener('input', handleSearch);
});


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
                <div class="card-front" style="background: ${currentCardColors.frontColor}; color: ${currentCardColors.textColor};">
                    ${escapeHtml(card.front)}
                    <button class="speaker-btn front-speaker">🔊</button>
                </div>
                <div class="card-back" style="background: ${currentCardColors.backColor}; color: ${currentCardColors.textColor};">
                    ${escapeHtml(card.back)}
                    <button class="speaker-btn back-speaker">🔊</button>
                </div>
            </div>
        `;  // Add the front and back words to card, alongside delete/edit buttons

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

        editButton.addEventListener("click", (e) => { // When edit button is clicked
            e.stopPropagation(); // (Stops event, a.k.a card from flipping)
            editCardModal(card);

        });
        
        // --- TTS speaker buttons ---
        const frontSpeaker = cardDiv.querySelector(".front-speaker");
        const backSpeaker = cardDiv.querySelector(".back-speaker");

        frontSpeaker.addEventListener("click", (e) => {
            e.stopPropagation(); // prevent card flip
            const text = cardDiv.querySelector(".card-front").childNodes[0].textContent.trim();
            chrome.tts.speak(text, { lang: 'es-ES', rate: 0.9 });
        });

        backSpeaker.addEventListener("click", (e) => {
            e.stopPropagation(); // prevent card flip
            const text = cardDiv.querySelector(".card-back").childNodes[0].textContent.trim();
            chrome.tts.speak(text, { lang: 'en-US', voiceName: 'Google US English', rate: 0.9 });
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
activeDeckId = null;
const modeSwitch = document.getElementById("modeSwitch");
const modeLabel = document.getElementById("modeLabel");
const modeTitle = document.getElementById("mode-title");

const learnSection = document.getElementById("learn-mode");
const practiceSection = document.getElementById("practice-mode");

const testSetup = document.getElementById("test-setup");
const testList = document.getElementById("test-list");

// Changes mode (Practice/Switch) when switch is clicked
modeSwitch.addEventListener("change", () => {
  // Check if switch is in checked state
  if (modeSwitch.checked) {
    // Switch to practice mode
    learnSection.style.display = "none";          // Hide learn section
    practiceSection.style.display = "block";      // Show practice section
    modeLabel.textContent = "Practice Mode";      // Update label text
    testSetup.innerHTML = "";                     // Clear any existing test setup instructions
    testList.innerHTML = "";                     // Clear any existing test list
    renderQuizHistory();
  } else {
    // Switch to learn mode
    practiceSection.style.display = "none";       // Hide practice section
    learnSection.style.display = "block";         // Show learn section
    modeLabel.textContent = "Learn Mode";         // Update label text
    modeTitle.textContent = "Learn";              // Update title text
  }
});

// Get references to menu elements
const menuIcon = document.querySelector(".menu-icon");
const dropdownMenu = document.getElementById("dropdown-menu");

// Attaches event handler to "Begin Test" button to generate test based on selected mode and active deck
function initBeginTestHandler() {
  const beginBtn = document.getElementById("begin-test");
  if (!beginBtn) return;

  // Ensure single listener by replacing node
  const newBtn = beginBtn.cloneNode(true);
  beginBtn.parentNode.replaceChild(newBtn, beginBtn);

  newBtn.addEventListener("click", () => {
    const modeInput = document.querySelector('input[name="test-mode"]:checked');
    const mode = modeInput ? modeInput.value : "easy";

    // Load cards now
    let cards = [];
    if (activeDeckId === 'all' || activeDeckId === null) {
      cards = allFlashcards || [];
    } else {
      const deck = allDecks.find(d => d.id === activeDeckId);
      if (!deck) {
        testSetup.innerHTML = "<p>Please select a deck before starting the test.</p>";
        testList.innerHTML = "";
        return;
      }
      cards = allFlashcards.filter(c => deck.cardIds.includes(c.id));
    }

    if (cards.length === 0) {
      testSetup.innerHTML = "<p>No cards available for this deck.</p>";
      testList.innerHTML = "";
      return;
    }
    // hide begin test while test in progress
    newBtn.style.display = "none";
    
    if (mode === "easy") generateEasyTest(cards);
    else generateHardTest(cards);
  });
}

// easy test mode generator
function generateEasyTest(cards) {
    document.getElementById("test-setup").innerHTML = `<p>Answer the following questions by selecting the correct answer from the dropdown menu. Good luck!</p>`;
    const testList = document.getElementById("test-list");
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    const selected = shuffled;
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
function generateHardTest(cards) {
    document.getElementById("test-setup").innerHTML = `<p>Answer the following questions by typing the correct answer in the text box. Good luck!</p>`;
    const testList = document.getElementById("test-list");
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    const selected = shuffled;
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
initBeginTestHandler();

// Grades test answers and displays results
function gradeTest(cards) {
    const resultsDiv = document.getElementById("test-results");
    let correct = 0;
    let total = cards.length;
    const missedWords = [];

    // Build a lookup table for answers
    const answerKey = {};
    cards.forEach(c => answerKey[c.id] = c.back.trim().toLowerCase());

    // EASY MODE grading
    document.querySelectorAll(".easy-answer").forEach(select => {
        const cardId = select.dataset.cardId;
        const card = cards.find(c => String(c.id) === String(cardId));
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
            if (card) missedWords.push(card.front);
        }
    });

    // HARD MODE grading
    document.querySelectorAll(".hard-answer").forEach(input => {
        const cardId = input.dataset.cardId;
        const card = cards.find(c => String(c.id) === String(cardId));
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
            if (card) missedWords.push(card.front);
        }
    });

    // Display score
    resultsDiv.innerHTML = `
        <h3>Results</h3>
        <p>You scored <strong>${correct}</strong> out of <strong>${total}</strong>.</p>
    `;

    saveQuizResult(correct, total, missedWords, cards);
    const beginBtn = document.getElementById("begin-test");
    if (beginBtn) beginBtn.style.display = "";
    renderQuizHistory();
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

// Like newCardModal, but with editing cards
function editCardModal(card) {
    
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

    const modal = document.getElementById('editCardModal');
    const front = document.getElementById('editCardFront');
    const back = document.getElementById('editCardBack');
    const deckSelect = document.getElementById('editCardDeck');
    const saveButton = document.getElementById('saveEditButton');
    const cancelButton = document.getElementById('cancelEditButton');

    front.value = card.front;
    back.value = card.back;
    
    // Get all decks for edit select
    deckSelect.innerHTML = allDecks.map(deck => 
        `<option value="${deck.id}" ${deck.id === card.deckId ? 'selected' : ''}>
            ${escapeHtml(deck.name)}
        </option>`
    ).join('');

    // Show  modal
    modal.style.display = 'flex';

    addSynonyms(front.value, 'frontSynonyms');
    addSynonyms(back.value, 'backSynonyms');

    cancelButton.onclick = () => {
        modal.style.display = 'none';
    };

    saveButton.onclick = () => {
        // Find the card in global array
        const cardIndex = allFlashcards.findIndex(c => c.id === card.id);
        if (cardIndex === -1) return;

        const editCard = allFlashcards[cardIndex];

        // Grab values to swap decks
        const oldDeckId = editCard.deckId;
        const newDeckId = deckSelect.value;

        // Update values
        editCard.front = front.value;
        editCard.back = back.value;
        editCard.deckId = newDeckId;
        updateCardDeck(card.id, oldDeckId, newDeckId, allDecks);

        // Save cards to storage
        chrome.storage.local.set({
            flashcards: allFlashcards,
            decks: allDecks
        }, () => {
            modal.style.display = 'none'; // Close modal after saving
            renderFlashcards(allFlashcards.filter(c => c.deckId === activeDeckId)); // Refresh card display to show edits
        });
    };
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

// Holds the raw text contents of the CSV file selected in the import modal.
// We store it at module scope so that toggling the delimiter or re-rendering
// the preview does not require re-reading the file from disk each time.
let importFileContent = '';

// Parses a single CSV line into an array of field strings using the supplied
// delimiter. The parser respects fields that are surrounded by matching
// single (') or double (") quotation marks, allowing the delimiter character
// to appear inside the field without splitting it. Inside a quoted field a
// doubled quote (e.g. "" or '') is interpreted as a literal quote, mirroring
// the standard CSV escape convention. If a quote is never closed we treat the
// rest of the line as the value to avoid losing data.
function parseCsvLine(line, delimiter) {
    const fields = []; // Accumulated fields for this line
    const n = line.length;
    let i = 0;         // Current scan index into the line

    // Iterate field-by-field until the entire line has been consumed.
    while (i <= n) {
        // Tolerate leading spaces before a field (e.g. ", "comma" — the space
        // after the comma is cosmetic). We only skip ASCII spaces, never the
        // delimiter itself, so a tab-delimited file behaves correctly.
        while (i < n && line[i] === ' ' && delimiter !== ' ') i++;

        // If we have hit the end of the line right after a delimiter, push an
        // empty trailing field and exit the loop.
        if (i >= n) {
            fields.push('');
            break;
        }

        // Detect a quoted field by checking for an opening single or double
        // quote at the current position.
        const ch = line[i];
        if (ch === '"' || ch === "'") {
            const quote = ch;     // Remember which quote style opened this field
            let value = '';       // Accumulator for the field contents
            let j = i + 1;        // Skip past the opening quote
            let closed = false;   // Tracks whether we found the matching close

            // Read characters until the matching closing quote is reached.
            while (j < n) {
                if (line[j] === quote) {
                    // A doubled quote inside a quoted field represents a
                    // literal quote character — append one quote and skip
                    // both characters.
                    if (j + 1 < n && line[j + 1] === quote) {
                        value += quote;
                        j += 2;
                        continue;
                    }
                    // Otherwise this is the terminating quote; advance past
                    // it and stop reading.
                    closed = true;
                    j++;
                    break;
                }
                // Ordinary character — copy verbatim into the field value.
                value += line[j];
                j++;
            }

            // If the user forgot to close their quote, salvage what we have
            // and treat the whole remainder as the field's value.
            if (!closed) {
                fields.push(value);
                break;
            }

            // After the closing quote we may have trailing spaces before the
            // next delimiter; skip them so " "foo" ," parses cleanly.
            while (j < n && line[j] === ' ' && delimiter !== ' ') j++;

            // If there is stray text between the closing quote and the next
            // delimiter, fold it onto the end of the value rather than
            // dropping it (lenient handling of malformed input).
            if (j < n && line[j] !== delimiter) {
                let extra = '';
                while (j < n && line[j] !== delimiter) {
                    extra += line[j];
                    j++;
                }
                value += extra;
            }

            fields.push(value);

            // Either we are at a delimiter (advance past it to the next field)
            // or at end of line (we are done).
            if (j < n && line[j] === delimiter) {
                i = j + 1;
            } else {
                i = n + 1;
                break;
            }
        } else {
            // Unquoted field — read everything up to the next delimiter.
            let j = i;
            while (j < n && line[j] !== delimiter) j++;
            fields.push(line.substring(i, j));
            if (j >= n) break;     // End of line — we are finished.
            i = j + 1;             // Step over the delimiter to the next field.
        }
    }

    return fields;
}

// Splits the entire CSV text into rows of [front, back] pairs using the
// supplied delimiter. Each non-empty line becomes one card. If a line does
// not contain the delimiter (i.e. it parses to a single field) the whole
// line becomes the front of the card and the back is left empty. Lines
// with two or more fields use the first field as the front and the second
// as the back; any extra fields beyond the second are ignored to match
// the simple front<delim>back schema written by the exporter.
function parseCsvText(text, delimiter) {
    // Normalize CRLF and CR line endings to LF before splitting so that
    // files saved on Windows or classic Mac platforms parse the same way.
    const normalized = String(text || '').replace(/\r\n?/g, '\n');
    const lines = normalized.split('\n');
    const rows = [];

    lines.forEach(line => {
        // Skip wholly empty lines so trailing newlines do not generate
        // phantom blank cards.
        if (line.length === 0) return;

        const fields = parseCsvLine(line, delimiter);

        // Determine front/back from the parsed fields. A single field with
        // an empty value (e.g. a line of just whitespace) is also skipped.
        let front, back;
        if (fields.length <= 1) {
            front = (fields[0] || '').trim();
            back = '';
        } else {
            front = (fields[0] || '').trim();
            back = (fields[1] || '').trim();
        }

        if (front === '' && back === '') return; // Nothing useful on this line
        rows.push({ front, back });
    });

    return rows;
}

// Opens the import modal: populates the deck selector with the user's decks,
// resets all of the modal's transient state (file input, preview pane,
// stored file contents, allow-duplicates checkbox), and reveals the modal.
function openImportModal() {
    const select = document.getElementById('importDeck');

    // Rebuild the deck options from scratch each time we open so newly
    // created decks appear and previously deleted decks disappear.
    select.innerHTML = '';
    allDecks.forEach(deck => {
        const opt = document.createElement('option');
        opt.value = deck.id;
        opt.textContent = deck.name;
        // Pre-select the active deck when one is in focus so the most likely
        // destination is one click away.
        if (activeDeckId !== 'all' && deck.id === activeDeckId) opt.selected = true;
        select.appendChild(opt);
    });

    // Wipe any leftover state from a previous open.
    document.getElementById('importFile').value = '';
    document.getElementById('importAllowDuplicates').checked = false;
    importFileContent = '';
    renderImportPreview(); // Reset the preview pane to its empty state

    // Show the modal and dismiss the hamburger menu beneath it.
    document.getElementById('importModal').style.display = 'flex';
    dropdownMenu.style.display = 'none';
}

// Hides the import modal and releases the in-memory copy of the CSV.
function closeImportModal() {
    document.getElementById('importModal').style.display = 'none';
    importFileContent = ''; // Free the file contents so we don't hold them needlessly
}

// Reads the file selected in the import modal asynchronously into
// importFileContent and refreshes the preview when the read completes.
function handleImportFileChange(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
        // The user cleared the selection; reset state and the preview.
        importFileContent = '';
        renderImportPreview();
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        // Stash the text contents so delimiter changes can re-parse without
        // re-reading the file from disk.
        importFileContent = e.target.result || '';
        renderImportPreview();
    };
    reader.onerror = () => {
        // On read failure surface the problem to the user and clear state.
        alert('Could not read the selected file.');
        importFileContent = '';
        renderImportPreview();
    };
    reader.readAsText(file);
}

// Re-parses the currently loaded file content with the currently selected
// delimiter and renders a small table of the resulting cards. Called every
// time the file changes or the delimiter changes so the user can see
// exactly how each row will be split before committing to the import.
function renderImportPreview() {
    const previewEl = document.getElementById('importPreview');
    const delimiter = document.getElementById('importDelimiter').value;

    // No file loaded yet — show a hint and stop.
    if (!importFileContent) {
        previewEl.innerHTML = '<em style="color:#888;">Choose a file to see a preview.</em>';
        return;
    }

    const rows = parseCsvText(importFileContent, delimiter);

    // The file parsed to zero usable rows (empty file, only blank lines, etc.).
    if (rows.length === 0) {
        previewEl.innerHTML = '<em style="color:#888;">No cards detected in this file.</em>';
        return;
    }

    // Cap the number of preview rows so very large imports do not freeze the
    // browser while building the DOM. The user can still import every row;
    // only the visual preview is truncated.
    const MAX_PREVIEW_ROWS = 50;
    const visibleRows = rows.slice(0, MAX_PREVIEW_ROWS);

    // Build the preview as a small two-column table (front | back). We escape
    // each cell via textContent assignment to avoid injecting raw HTML from
    // the user's CSV file into the page.
    const table = document.createElement('table');
    table.style.cssText = 'width:100%; border-collapse:collapse; font-size:13px;';

    // Header row labelling the two columns.
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Front', 'Back'].forEach(label => {
        const th = document.createElement('th');
        th.textContent = label;
        th.style.cssText = 'text-align:left; padding:6px 8px; border-bottom:1px solid #ccc; color:#34596e;';
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // One data row per parsed card up to the preview cap.
    const tbody = document.createElement('tbody');
    visibleRows.forEach(row => {
        const tr = document.createElement('tr');
        [row.front, row.back].forEach(value => {
            const td = document.createElement('td');
            // Use textContent (not innerHTML) so any HTML-looking text in the
            // imported file is rendered literally and cannot run scripts.
            td.textContent = value;
            td.style.cssText = 'padding:6px 8px; border-bottom:1px solid #eee; vertical-align:top; word-break:break-word;';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    // Replace the preview pane contents with the freshly built table.
    previewEl.innerHTML = '';
    previewEl.appendChild(table);

    // Append a summary line — total parsed rows and a notice if we truncated.
    const summary = document.createElement('div');
    summary.style.cssText = 'margin-top:8px; color:#555; font-size:12px;';
    if (rows.length > MAX_PREVIEW_ROWS) {
        summary.textContent = `Showing first ${MAX_PREVIEW_ROWS} of ${rows.length} cards.`;
    } else {
        summary.textContent = `${rows.length} card${rows.length === 1 ? '' : 's'} detected.`;
    }
    previewEl.appendChild(summary);
}

// Performs the actual import: parses the file, filters duplicates if the
// user did not opt in to them, creates flashcard records, attaches them to
// the chosen deck, and persists everything to chrome.storage.local.
function importFlashcards() {
    const deckId = document.getElementById('importDeck').value;
    const delimiter = document.getElementById('importDelimiter').value;
    const allowDuplicates = document.getElementById('importAllowDuplicates').checked;

    // Validate that the user actually chose a file before pressing Import.
    if (!importFileContent) {
        alert('Please choose a CSV file to import.');
        return;
    }

    // Validate that the destination deck still exists (the user could
    // theoretically have deleted it from another tab).
    const targetDeck = allDecks.find(d => d.id === deckId);
    if (!targetDeck) {
        alert('Please choose a valid deck to import into.');
        return;
    }
    targetDeck.cardIds = targetDeck.cardIds || [];

    // Parse the file with the currently selected delimiter — same logic the
    // preview uses, so what the user sees is what they get.
    const parsedRows = parseCsvText(importFileContent, delimiter);
    if (parsedRows.length === 0) {
        alert('No cards were detected in this file.');
        return;
    }

    // Build a lookup of cards already present in the destination deck so we
    // can detect collisions in O(1) per row. Comparison is case-insensitive
    // to mirror the duplicate check used by createManualFlashcard.
    const existingKeys = new Set();
    if (!allowDuplicates) {
        targetDeck.cardIds.forEach(cardId => {
            const card = allFlashcards.find(c => c.id === cardId);
            if (!card) return;
            existingKeys.add(`${(card.front || '').toLowerCase()}|||${(card.back || '').toLowerCase()}`);
        });
    }

    // Walk the parsed rows, optionally skipping duplicates, and produce the
    // new flashcard records. We assign monotonically increasing ids based
    // on Date.now() plus the index so that every imported card has a unique
    // id even when the loop runs faster than the millisecond clock ticks.
    const baseId = Date.now();
    const newCards = [];
    let skipped = 0;

    parsedRows.forEach((row, index) => {
        // A card with no front text would be unusable, so always drop it.
        if (!row.front) {
            skipped++;
            return;
        }

        // Compute the de-duplication key once so we can both check and add it.
        const key = `${row.front.toLowerCase()}|||${row.back.toLowerCase()}`;

        if (!allowDuplicates) {
            // Reject rows that match an existing deck card OR an earlier row
            // already accepted from this same import. This satisfies both
            // halves of the duplicate rule the user asked for.
            if (existingKeys.has(key)) {
                skipped++;
                return;
            }
            existingKeys.add(key);
        }

        // Construct the flashcard object using the same shape used elsewhere
        // in the codebase (see createManualFlashcard). frontLang/backLang are
        // unknown because we have no auto-detection during import.
        newCards.push({
            id: baseId + index,
            front: row.front,
            back: row.back,
            frontLang: 'unknown',
            backLang: 'unknown',
            deckId: deckId,
            created: new Date().toISOString()
        });
    });

    // Nothing survived the duplicate filter — tell the user and bail out.
    if (newCards.length === 0) {
        alert(`No cards were imported. ${skipped} row${skipped === 1 ? '' : 's'} were skipped (duplicates or empty fronts).`);
        return;
    }

    // Append the new cards to the global list and to the target deck's
    // cardIds index, then persist both arrays in a single storage write.
    newCards.forEach(card => {
        allFlashcards.push(card);
        targetDeck.cardIds.push(card.id);
    });

    chrome.storage.local.set({ flashcards: allFlashcards, decks: allDecks }, () => {
        closeImportModal();

        // Refresh the visible card list if the user is currently looking at
        // either the destination deck or the "All" view.
        if (activeDeckId === 'all' || activeDeckId === deckId) {
            const filtered = activeDeckId === 'all'
                ? allFlashcards
                : allFlashcards.filter(c => c.deckId === activeDeckId);
            renderFlashcards(filtered);
        }

        // Surface the result with a tally of imported and skipped rows so
        // the user knows whether duplicates were filtered out.
        const importedMsg = `Imported ${newCards.length} card${newCards.length === 1 ? '' : 's'}`;
        const skippedMsg = skipped > 0 ? ` (${skipped} skipped)` : '';
        showSuccessNotification(importedMsg + skippedMsg + '.');
    });
}

// Add event listeners for new card modal
document.addEventListener('DOMContentLoaded', () => {

        loadCardColors(() => {
        const filtered = activeDeckId === 'all'
            ? allFlashcards
            : allFlashcards.filter(c => c.deckId === activeDeckId);

        renderFlashcards(filtered);
    });

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

    // Import modal event listeners. The hamburger button opens the modal,
    // the cancel/X buttons close it, and the file/delimiter inputs both
    // refresh the live preview so the user can see how the file will be
    // parsed before pressing Import.
    document.getElementById('importCardsBtn').addEventListener('click', openImportModal);
    document.getElementById('cancelImport').addEventListener('click', closeImportModal);
    document.getElementById('confirmImport').addEventListener('click', importFlashcards);
    document.getElementById('importFile').addEventListener('change', handleImportFileChange);
    document.getElementById('importDelimiter').addEventListener('change', renderImportPreview);
    // Click-outside-to-close behaviour, mirroring the export modal.
    document.getElementById('importModal').addEventListener('click', (e) => {
        if (e.target.id === 'importModal') closeImportModal();
    });
});


const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
}

function saveQuizResult(correct, total, missedWords, cards) {
    const deckId = (activeDeckId === null || activeDeckId === 'all') ? 'all' : activeDeckId;
    const deckName = deckId === 'all' ? 'All Decks' : (allDecks.find(d => d.id === deckId)?.name || deckId);
    const result = {
        date: new Date().toISOString(),
        correct,
        total,
        deckId,
        deckName,
        missedWords
    };
 
    chrome.storage.local.get({ quizHistory: [], wordMisses: {}, deckStats: {} }, (data) => {
        // Append new result
        const history = [result, ...data.quizHistory].slice(0, 50); // keep last 50
 
        // Update per-word miss counts
        const wordMisses = data.wordMisses || {};
        missedWords.forEach(word => {
            wordMisses[word] = (wordMisses[word] || 0) + 1;
        });
 
        // Update per-deck stats (total questions and correct)
        const deckStats = data.deckStats || {};
        if (!deckStats[deckId]) deckStats[deckId] = { name: deckName, correct: 0, total: 0 };
        deckStats[deckId].correct += correct;
        deckStats[deckId].total += total;
        deckStats[deckId].name = deckName; // keep name fresh
 
        // Update total cards added stat (just keep current count)
        chrome.storage.local.set({ quizHistory: history, wordMisses, deckStats });
    });
}

// Renders previous quiz results beneath the Begin Test button
function renderQuizHistory() {
    let historyDiv = document.getElementById("quiz-history");
    if (!historyDiv) {
        historyDiv = document.createElement("div");
        historyDiv.id = "quiz-history";
        historyDiv.style.cssText = "width:100%;max-width:600px;margin:20px auto 0;";
        document.getElementById("test-container").appendChild(historyDiv);
    }
 
    chrome.storage.local.get({ quizHistory: [] }, (data) => {
        const history = data.quizHistory;
        if (history.length === 0) {
            historyDiv.innerHTML = "";
            return;
        }
        let html = `<h3 style="text-align:center;margin-bottom:10px;color:var(--test-font);">Previous Quiz Results</h3>
            <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
                <thead>
                    <tr style="background:var(--border-light);">
                        <th style="padding:8px;text-align:left;color:var(--test-font);">Date</th>
                        <th style="padding:8px;text-align:left;color:var(--test-font);">Deck</th>
                        <th style="padding:8px;text-align:center;color:var(--test-font);">Score</th>
                        <th style="padding:8px;text-align:center;color:var(--test-font);">%</th>
                    </tr>
                </thead>
                <tbody>`;
        history.forEach(r => {
            const pct = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0;
            const dateStr = new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            html += `<tr style="border-bottom:1px solid var(--border-light);">
                <td style="padding:7px 8px;color:var(--test-font);">${dateStr}</td>
                <td style="padding:7px 8px;color:var(--test-font);">${escapeHtml(r.deckName)}</td>
                <td style="padding:7px 8px;text-align:center;color:var(--test-font);">${r.correct}/${r.total}</td>
                <td style="padding:7px 8px;text-align:center;font-weight:700;color:var(--test-font);">${pct}%</td>
            </tr>`;
        });
        html += `</tbody></table>`;
        historyDiv.innerHTML = html;
    });
}

// Loads saved card colors from Chrome storage into currentCardColors
function loadCardColors(callback) {
    chrome.storage.local.get(DEFAULT_CARD_COLORS, (data) => {
        currentCardColors = {
            frontColor: data.frontColor || DEFAULT_CARD_COLORS.frontColor,
            backColor:  data.backColor  || DEFAULT_CARD_COLORS.backColor,
            textColor:  data.textColor  || DEFAULT_CARD_COLORS.textColor
        };
        savedCardColors = { ...currentCardColors };
        if (callback) callback();
    });
}

// Re-renders cards instantly when colors are saved from settings.html
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (['frontColor', 'backColor', 'textColor'].some(k => k in changes)) {
        loadCardColors(() => { /* re-render filtered cards */ });
    }
});