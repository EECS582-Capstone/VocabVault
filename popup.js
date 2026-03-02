/*
Name of Code Artifact: popup.js
Description:
Programmer's Name: Jenny Tsotezo, Genea Dinnall
Date Created: 02/15/2026
Date Revised: 02/16/2026s
Preconditions (inputs):
Postcondition (outputs):
Errors: n/a
*/

// Event listener that executes when the popup DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Load available decks into the deck selector dropdown
    loadDecks();
    
    // Load and display all flashcards (unfiltered)
    loadFlashcards('all');
    
    // Add event listener to deck selector dropdown
    document.getElementById('deckSelector').addEventListener('change', (e) => {
        // When user selects a different deck, reload flashcards filtered by that deck
        loadFlashcards(e.target.value);
    });
    
    // Add event listener to "New Deck" button
    document.getElementById('newDeckBtn').addEventListener('click', createNewDeck);
});

// Loads all decks from Chrome storage and populates the deck selector dropdown
function loadDecks() {
    // Retrieve decks from Chrome storage (default to empty array if none exist)
    chrome.storage.local.get({ decks: [] }, (data) => {
        // Get reference to the deck selector dropdown element
        const selector = document.getElementById('deckSelector');
        
        // Clear existing options and add "All Cards" option
        selector.innerHTML = '<option value="all">All Cards</option>';
        
        // Iterate through each deck in storage
        data.decks.forEach(deck => {
            // Create a new option element for this deck
            const option = document.createElement('option');
            
            // Set the option value to the deck ID
            option.value = deck.id;
            
            // Set the option display text to the deck name
            option.textContent = deck.name;
            
            // Append the option to the selector
            selector.appendChild(option);
        });
    });
}

// Prompts user to create a new deck and saves it to Chrome storage
function createNewDeck() {
    // Show browser prompt asking for deck name
    const deckName = prompt('Enter deck name:');
    
    // Exit if user cancelled or entered empty name
    if (!deckName) return;
    
    // Retrieve existing decks from Chrome storage
    chrome.storage.local.get({ decks: [] }, (data) => {
        // Get the decks array
        const decks = data.decks;
        
        // Create a new deck object
        const newDeck = {
            id: Date.now().toString(),      // Unique ID based on current timestamp
            name: deckName,                 // User-provided deck name
            isDefault: false                // Not a default deck
        };
        
        // Add the new deck to the decks array
        decks.push(newDeck);
        
        // Save updated decks array back to Chrome storage
        chrome.storage.local.set({ decks: decks }, () => {
            // Reload the deck selector to show the new deck
            loadDecks();
            
            // Show confirmation alert to user
            alert(`Deck "${deckName}" created!`);
        });
    });
}

// Loads flashcards from storage and displays them, optionally filtered by deck
function loadFlashcards(deckId) {
    // Retrieve flashcards from Chrome storage
    chrome.storage.local.get({ flashcards: [] }, (data) => {
        // Get reference to the flashcards container element
        const container = document.getElementById('flashcards');
        
        // Get all flashcards from storage
        let flashcards = data.flashcards;
        
        // Filter flashcards by deck if a specific deck is selected
        if (deckId !== 'all') {
            // Keep only flashcards that belong to the selected deck
            flashcards = flashcards.filter(card => card.deckId === deckId);
        }
        
        // Check if there are no flashcards to display
        if (flashcards.length === 0) {
            // Show empty state message
            container.innerHTML = '<div class="empty">No flashcards in this deck!<br>Select text on any webpage and right-click to translate.</div>';
            return;
        }
        
        // Clear the container before adding flashcards
        container.innerHTML = '';
        
        // Reverse array to show most recent cards first, then iterate through each card
        flashcards.reverse().forEach(card => {
            // Create a flashcard element for this card
            const cardElement = createFlashcardElement(card);
            
            // Append the card element to the container
            container.appendChild(cardElement);
        });
    });
}

// Creates a DOM element for a single flashcard with flip and delete functionality
function createFlashcardElement(card) {
    // Create a div element for the card
    const cardDiv = document.createElement('div');
    
    // Add CSS class for styling
    cardDiv.className = 'card-item';
    
    // Store the card ID as a data attribute for later reference
    cardDiv.dataset.id = card.id;
    
    // Set the inner HTML with card content and delete button
    cardDiv.innerHTML = `
        <div class="card-content">
            <div class="card-content-front">${escapeHtml(card.front)}</div>
            <div class="card-content-back">${escapeHtml(card.back)}</div>
        </div>
        <button class="delete-btn" title="Delete card">×</button>
    `;
    
    // Add click event listener to flip the card when clicked
    cardDiv.addEventListener('click', (e) => {
        // Only flip if user didn't click the delete button
        if (!e.target.classList.contains('delete-btn')) {
            // Toggle the 'flipped' class to show/hide back content
            cardDiv.classList.toggle('flipped');
        }
    });
    
    // Add click event listener to the delete button
    cardDiv.querySelector('.delete-btn').addEventListener('click', (e) => {
        // Prevent the click from bubbling up to the card (which would flip it)
        e.stopPropagation();
        
        // Call the delete function with this card's ID
        deleteFlashcard(card.id);
    });
    
    // Return the completed card element
    return cardDiv;
}

// Deletes a flashcard from Chrome storage after user confirmation
function deleteFlashcard(cardId) {
    // Show confirmation dialog to user
    if (!confirm('Are you sure you want to delete this flashcard?')) {
        // Exit if user cancels
        return;
    }
    
    // Retrieve flashcards from Chrome storage
    chrome.storage.local.get({ flashcards: [] }, (data) => {
        // Filter out the flashcard with matching ID
        const flashcards = data.flashcards.filter(card => card.id !== cardId);
        
        // Save the updated flashcards array back to storage
        chrome.storage.local.set({ flashcards: flashcards }, () => {
            // Get the currently selected deck from dropdown
            const currentDeck = document.getElementById('deckSelector').value;
            
            // Reload flashcards with the current filter to update the display
            loadFlashcards(currentDeck);
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


// Legacy function to display a single flashcard 
function displayFlashcard(card) {
    // Create a div element for the card
    const cardDiv = document.createElement('div');
    
    // Add CSS class for styling
    cardDiv.className = 'card';

    // Create div for front side
    const front = document.createElement('div');
    front.className = 'front';
    front.textContent = card.front;

    // Create div for back side
    const back = document.createElement('div');
    back.className = 'back';
    back.textContent = card.back;   

    // Append front and back to card
    cardDiv.appendChild(front);
    cardDiv.appendChild(back);

    // Return the completed card element
    return cardDiv;
}