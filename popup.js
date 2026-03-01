/*
Name of Code Artifact: popup.js
Description: Displays most recent flashcard on extension popup
Programmer's Name: Jenny Tsotezo, Genea Dinnall
Date Created: 02/15/2026
Date Revised: 03/01/2026
Preconditions (inputs): Flashcard from chrome local storage
Postcondition (outputs): HTML div of flashcard
Errors: n/a
*/

// Show flashcard on extension popup menu
chrome.storage.local.get({ flashcards: [] }, (data) => { // Retrieve all flashcards
    const container = document.getElementById('flashcards'); // Grab popup flashcard container element
    const flashcards = data.flashcards; // Assign flashcards to variable/list
    
    if (flashcards.length === 0) {  // If there are no flashcards
        container.innerHTML = '<div class="empty">No flashcards yet!<br>Select text on any webpage and right-click to translate.</div>'; // Put message
        return;
    }
    
    const mostRecentCard = flashcards.at(-1);   // Get most recent flashcard (last)
    const cardElement = displayFlashcard(mostRecentCard);   // Create element based on last flashcard
    container.appendChild(cardElement); // Add flashcard to popup.html container
});

// Function to display a flashcard
function displayFlashcard(card) {

    const cardDiv = document.createElement("div");  // Create a new div
    cardDiv.classList.add("card");  // And adds the class "card" to the new div (for styling)

    cardDiv.innerHTML = `
        <div class="card-inner">
            <div class="card-front">${card.front}</div>
            <div class="card-back">${card.back}</div>
        </div>
    `;  // Add the front and back words to card

    cardDiv.addEventListener("click", () => {   // Add event so that when card is clicked
        cardDiv.classList.toggle("flipped");    // It flips it
    });

    return cardDiv;
}

