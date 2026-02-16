// Load and display flashcards
chrome.storage.local.get({ flashcards: [] }, (data) => {
    const container = document.getElementById('flashcards');
    const flashcards = data.flashcards;
    
    if (flashcards.length === 0) {
        container.innerHTML = '<div class="empty">No flashcards yet!<br>Select text on any webpage and right-click to translate.</div>';
        return;
    }
    
    flashcards.reverse().forEach(card => {
        const div = document.createElement('div');
        div.className = 'flashcard';
        div.innerHTML = `
            <div class="front">${escapeHtml(card.front)}</div>
            <div class="back">${escapeHtml(card.back)}</div>
        `;
        container.appendChild(div);
    });
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}