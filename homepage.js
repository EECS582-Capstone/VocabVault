/*
Name of Code Artifact: homepage.js
Description: Displays all flashcards on homepage.html
Programmer's Name: Genea Dinnal, Sam Kelemen, Skylar Franz
Date Created: 02/16/2026
Date Revised: 03/01/2026
Preconditions (inputs): Clicks and flashcards
Postcondition (outputs): Displays flashcards as divs, Removes cards
Errors: n/a
*/

// Load flashcards and decks from Chrome storage when page loads
chrome.storage.local.get({ flashcards: [], decks: [] }, (data) => {
    // Render all flashcards in the container
    renderFlashcards(data.flashcards);
    
    // Create and populate the deck filter dropdown
    loadDeckFilter(data.decks);
});

// Creates and populates a deck filter dropdown in the page
function loadDeckFilter(decks) {
    // Get reference to the deck filter container element
    const filterContainer = document.getElementById('deck-filter-container');
    
    // Exit if container doesn't exist on this page
    if (!filterContainer) return;
    
    // Create a select dropdown element
    const select = document.createElement('select');
    select.id = 'deck-filter';                  // Set ID for later reference
    
    // Apply inline CSS styles for appearance
    select.style.cssText = 'padding:8px 12px;border:2px solid #6eb8ce;border-radius:6px;font-size:14px;cursor:pointer;margin:10px;';
    
    // Create and add the "All Decks" option
    const allOption = document.createElement('option');
    allOption.value = 'all';                    // Value to indicate no filtering
    allOption.textContent = 'All Decks';        // Display text
    select.appendChild(allOption);
    
    // Iterate through each deck and create an option
    decks.forEach(deck => {
        // Create option element for this deck
        const option = document.createElement('option');
        option.value = deck.id;                 // Set value to deck ID
        option.textContent = deck.name;         // Set display text to deck name
        select.appendChild(option);             // Add option to select
    });
    
    // Add event listener for when user changes deck selection
    select.addEventListener('change', (e) => {
        // Filter flashcards based on selected deck
        filterFlashcardsByDeck(e.target.value);
    });
    
    // Append the complete dropdown to the container
    filterContainer.appendChild(select);
}

// Filters and displays flashcards based on selected deck
function filterFlashcardsByDeck(deckId) {
    // Retrieve flashcards from Chrome storage
    chrome.storage.local.get({ flashcards: [] }, (data) => {
        // Start with all flashcards
        let filtered = data.flashcards;
        
        // If a specific deck is selected (not 'all')
        if (deckId !== 'all') {
            // Filter to only cards belonging to the selected deck
            filtered = data.flashcards.filter(card => card.deckId === deckId);
        }
        
        // Re-render the flashcards with filtered results
        renderFlashcards(filtered);
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
            <button class="delete-button">X</button>
            <div class="card-inner">
                <div class="card-front">${escapeHtml(card.front)}</div>
                <div class="card-back">${escapeHtml(card.back)}</div>
            </div>
        `;  // Add the front and back words to card, alongside delete button

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

menuIcon.addEventListener("click", (e) => {
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

const deleteAllButton = document.getElementById("deleteAll");

// Delete all flashcards
deleteAllButton.addEventListener("click", () => {
    if (confirm('Are you sure you want to delete all flashcards?')) { // If user confirms they want to delete all flashcards
        chrome.storage.local.remove('flashcards'); // Remove flashcards from local storage
        location.reload(); // Refresh to show no cards
    }
}); 