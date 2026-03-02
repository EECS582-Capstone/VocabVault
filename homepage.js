/*
Name of Code Artifact: homepage.js
Description:
Programmer's Name: Genea Dinnal
Date Created: 02/16/2026
Date Revised: 02/16/2026
Preconditions (inputs):
Postcondition (outputs):
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
            <div class="card-inner">
                <div class="card-front">${escapeHtml(card.front)}</div>
                <div class="card-back">${escapeHtml(card.back)}</div>
            </div>
            <button class="card-delete" title="Delete card">×</button>
        `;

        // Add click event listener to flip the card
        cardDiv.addEventListener("click", (e) => {
            // Only flip if user didn't click the delete button
            if (!e.target.classList.contains('card-delete')) {
                // Toggle 'flipped' class to trigger CSS 3D flip animation
                cardDiv.classList.toggle("flipped");
            }
        });
        
        // Add click event listener to the delete button
        cardDiv.querySelector('.card-delete').addEventListener('click', (e) => {
            // Prevent click from bubbling up to card (which would flip it)
            e.stopPropagation();
            
            // Call delete function with this card's ID
            deleteCard(card.id);
        });

        // Append the completed card to the container
        container.appendChild(cardDiv);
    });
}

// Deletes a flashcard from Chrome storage after user confirmation
function deleteCard(cardId) {
    // Show confirmation dialog to prevent accidental deletion
    if (!confirm('Delete this flashcard?')) return;
    
    // Retrieve flashcards from Chrome storage
    chrome.storage.local.get({ flashcards: [] }, (data) => {
        // Filter out the card with matching ID
        const flashcards = data.flashcards.filter(card => card.id !== cardId);
        
        // Save updated flashcards array back to storage
        chrome.storage.local.set({ flashcards: flashcards }, () => {
            // Get reference to the deck filter dropdown
            const filterSelect = document.getElementById('deck-filter');
            
            // Check if deck filter exists
            if (filterSelect) {
                // Reload with current filter to maintain user's view
                filterFlashcardsByDeck(filterSelect.value);
            } else {
                // No filter active, just re-render all remaining cards
                renderFlashcards(flashcards);
            }
        });
    });
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

// Get references to mode switching elements
const modeSwitch = document.getElementById("modeSwitch");
const modeLabel = document.getElementById("modeLabel");

const learnSection = document.getElementById("learn-mode");
const practiceSection = document.getElementById("practice-mode");

// Add event listener for mode toggle switch
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
        dropdownMenu.style.display === "block" ? "none" : "block";
}); 

// Add click event listener to entire document to close menu when clicking outside
document.addEventListener("click", (e) => {
    // Check if click was outside both the menu icon and dropdown menu
    if (!menuIcon.contains(e.target) && !dropdownMenu.contains(e.target)) {
        // Hide the dropdown menu
        dropdownMenu.style.display = "none";
    }
});