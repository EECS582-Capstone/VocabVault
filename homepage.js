/*
Name of Code Artifact: homepage.js
Description: Displays all flashcards on homepage.html
Programmer's Name: Genea Dinnal, Skylar Franz
Date Created: 02/16/2026
Date Revised: 03/01/2026
Preconditions (inputs): Clicks and flashcards
Postcondition (outputs): Displays flashcards as divs, Removes cards
Errors: n/a
*/

// Retrieves all flashcards and displays them
chrome.storage.local.get({ flashcards: [] }, (data) => {    // Get all flashcards
    renderFlashcards(data.flashcards);  // Renders those flashcards
});

// Takes flashcards from chrome local storage and adds them to homepage
function renderFlashcards(flashcards) {
    const container = document.getElementById("flashcard-container");   // Get flashcard section from homepage.html
    container.innerHTML = ""; // Remove old cards

    flashcards.forEach(card => {    // For each flashcard
        const cardDiv = document.createElement("div");  // Create a new div
        cardDiv.classList.add("card");  // And adds the class "card" to the new div (for styling)

        cardDiv.innerHTML = `
            <button class="delete-button">X</button>
            <div class="card-inner">
                <div class="card-front">${card.front}</div>
                <div class="card-back">${card.back}</div>
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
  if (modeSwitch.checked) {
    // Practice mode
    learnSection.style.display = "none";
    practiceSection.style.display = "block";
    modeLabel.textContent = "Practice Mode";
  } else {
    // Learn mode
    practiceSection.style.display = "none";
    learnSection.style.display = "block";
    modeLabel.textContent = "Learn Mode";
  }
});

const menuIcon = document.querySelector(".menu-icon");
const dropdownMenu = document.getElementById("dropdown-menu");

// When menu icon is clicked, show dropdown
menuIcon.addEventListener("click", (e) => { // When menu icon is clicked
    dropdownMenu.style.display =
        dropdownMenu.style.display === "block" ? "none" : "block"; // If dropdown menu is already shown, hide it. Elsewise, show dropdown.
});

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