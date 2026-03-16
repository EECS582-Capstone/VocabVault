/*
Name of Code Artifact: homepage.js
Description: Displays all flashcards on homepage.html
Programmer's Name: Genea Dinnal, Sam Kelemen, Skylar Franz, Sam Kelemen
Date Created: 02/16/2026
Date Revised: 03/01/2026
Preconditions (inputs): Clicks and flashcards
Postcondition (outputs): Displays flashcards as divs, Removes cards, Sorts decks
Errors: n/a
*/

// Load flashcards and decks from Chrome storage when page loads
chrome.storage.local.get({ flashcards: [], decks: [] }, (data) => {
    // Render all flashcards in the container
    renderFlashcards(data.flashcards);
});

// Migration: ensure a default deck exists; assign orphan cards to it
function ensureDefaultDeck(data) {
    const decks = data.decks || [];
    const flashcards = data.flashcards || [];

    if (decks.length === 0) {
        const defaultDeck = { id: 'default', name: 'General', created: new Date().toISOString() };
        decks.push(defaultDeck);
        flashcards.forEach(card => { if (!card.deckId) card.deckId = 'default'; });
        chrome.storage.local.set({ decks, flashcards });
    }

    return { decks, flashcards };
}

let allDecks = [];
let allFlashcards = [];
let activeDeckId = 'all';

chrome.storage.local.get({ decks: [], flashcards: [] }, (raw) => {
    const data = ensureDefaultDeck(raw);
    allDecks = data.decks;
    allFlashcards = data.flashcards;
    renderDecks(allDecks, allFlashcards, activeDeckId);
    renderFlashcards(allFlashcards);

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
    btn.dataset.deckId = deckId;
    btn.addEventListener('click', () => {
        activeDeckId = deckId;
        renderDecks(allDecks, allFlashcards, activeDeckId);
        const filtered = deckId === 'all'
            ? allFlashcards
            : allFlashcards.filter(c => c.deckId === deckId);
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
        const newDeck = { id: Date.now().toString(), name, created: new Date().toISOString() };
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

        // Set inner HTML with card structure and delete button
        cardDiv.innerHTML = `
            <div class="edit-form">
                <input class="front-input" value="${escapeHtml(card.front)}">
                <input class="back-input" value="${escapeHtml(card.back)}">
                <button class="save-button">Save</button>
            </div>
            <div class="card-inner">
                <button class="edit-button">E</button>
                <button class="delete-button">X</button>
                <div class="card-front">${escapeHtml(card.front)}</div>
                <div class="card-back">${escapeHtml(card.back)}</div>
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

        saveButton.addEventListener("click", (e) => {
            e.stopPropagation();
            const cardIndex = flashcards.findIndex(c => c.id === card.id);
            flashcards[cardIndex].front = cardDiv.querySelector(".front-input").value;
            flashcards[cardIndex].back = cardDiv.querySelector(".back-input").value;
            cardDiv.querySelector(".card-front").textContent = flashcards[cardIndex].front;
            cardDiv.querySelector(".card-back").textContent = flashcards[cardIndex].back;
            chrome.storage.local.set({ flashcards: flashcards });
            editForm.style.display = 'none';
        });

        container.appendChild(cardDiv); // Add card to HTML section
    });
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

// Edits one card
function editCard(id, cardDiv) {
    chrome.storage.local.get({ flashcards: [] }, (data) => {    // Get flashcards from local storage
        chrome.storage.local.set({ flashcards: newFlashcards }); // Save the updated deck to local storage flashcards
    });
}

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

// Add click event listener to hamburger menu icon
menuIcon.addEventListener("click", (e) => {
    // Toggle dropdown menu visibility
    // If currently visible, hide it; if hidden, show it
    dropdownMenu.style.display =
        dropdownMenu.style.display === "block" ? "none" : "block"; // If dropdown menu is already shown, hide it. Elsewise, show dropdown.
});

// Add click event listener to entire document to close menu when clicking outside
// When clicked outside dropdown menu icon, close dropdown meny
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