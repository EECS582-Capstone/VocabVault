// Load and display flashcards
chrome.storage.local.get({ flashcards: [] }, (data) => {
    const container = document.getElementById('flashcards');
    const flashcards = data.flashcards;
    
    if (flashcards.length === 0) {
        container.innerHTML = '<div class="empty">No flashcards yet!<br>Select text on any webpage and right-click to translate.</div>';
        return;
    }
    
    const mostRecentCard = flashcards.at(-1);
    const cardElement = displayFlashcard(mostRecentCard);
    container.appendChild(cardElement); 
    
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function displayFlashcard(card) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';

    const front = document.createElement('div');
    front.className = 'front';
    front.textContent = card.front;

    const back = document.createElement('div');
    back.className = 'back';
    back.textContent = card.back;   

    cardDiv.appendChild(front);
    cardDiv.appendChild(back);

    return cardDiv;
}

