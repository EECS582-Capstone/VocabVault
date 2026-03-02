// Listen for translation requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "translate") {
        showTranslation(request.text);
    }
});

// Show translation popup
function showTranslation(text) {
    chrome.runtime.sendMessage({
        action: "translateText",
        text: text,
        direction: "en-es"
    }, (response) => {
        if (response && response.success) {
            displayPopup(text, response.translation);
        }
    });
}

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

// Display translation popup
function displayPopup(original, translation) {
    // Remove existing popup
    const existing = document.getElementById('vv-popup');
    if (existing) existing.remove();

    chrome.storage.local.get({ decks: [], flashcards: [] }, (raw) => {
        const { decks } = ensureDefaultDeck(raw);

        // Build deck options HTML
        const deckOptions = decks.map(d =>
            `<option value="${escapeAttr(d.id)}">${escapeHtml(d.name)}</option>`
        ).join('');

        // Create popup
        const popup = document.createElement('div');
        popup.id = 'vv-popup';
        popup.innerHTML = `
            <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483647;background:white;padding:24px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4);min-width:350px;max-width:500px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
                <button id="vv-close-btn" style="position:absolute;top:-8px;right:-8px;background:#ff5252;color:white;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:20px;line-height:1;box-shadow:0 2px 8px rgba(0,0,0,0.2);">×</button>
                <div style="margin-bottom:16px;">
                    <strong style="display:block;margin-bottom:8px;color:#333;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Original:</strong>
                    <div style="padding:12px;background:#f5f5f5;border-radius:6px;color:#222;font-size:16px;line-height:1.5;">${escapeHtml(original)}</div>
                </div>
                <div style="margin-bottom:16px;">
                    <strong style="display:block;margin-bottom:8px;color:#333;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Translation:</strong>
                    <div style="padding:12px;background:#e3f2fd;border-radius:6px;color:#222;font-size:16px;line-height:1.5;font-weight:500;">${escapeHtml(translation)}</div>
                </div>
                <div style="margin-bottom:12px;">
                    <label for="vv-deck-select" style="display:block;margin-bottom:6px;color:#333;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Deck:</label>
                    <select id="vv-deck-select" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px;background:white;">
                        ${deckOptions}
                        <option value="__new__">+ New Deck</option>
                    </select>
                    <input id="vv-new-deck-input" type="text" placeholder="New deck name..." style="display:none;width:100%;margin-top:8px;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px;box-sizing:border-box;">
                </div>
                <button id="vv-add-btn" style="width:100%;padding:12px;background:#2196F3;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;transition:background 0.2s;" onmouseover="this.style.background='#1976D2'" onmouseout="this.style.background='#2196F3'">Add to Flashcards</button>
            </div>
        `;

        document.body.appendChild(popup);

        const selectEl = document.getElementById('vv-deck-select');
        const newDeckInput = document.getElementById('vv-new-deck-input');

        selectEl.addEventListener('change', () => {
            newDeckInput.style.display = selectEl.value === '__new__' ? 'block' : 'none';
        });

        document.getElementById('vv-close-btn').addEventListener('click', () => {
            popup.remove();
        });

        document.getElementById('vv-add-btn').addEventListener('click', () => {
            let deckId = selectEl.value;

            if (deckId === '__new__') {
                const name = newDeckInput.value.trim();
                if (!name) {
                    newDeckInput.focus();
                    return;
                }
                deckId = Date.now().toString();
                const newDeck = { id: deckId, name, created: new Date().toISOString() };
                chrome.storage.local.get({ decks: [] }, (d) => {
                    const updatedDecks = [...d.decks, newDeck];
                    chrome.storage.local.set({ decks: updatedDecks }, () => {
                        addFlashcard(original, translation, deckId);
                    });
                });
            } else {
                addFlashcard(original, translation, deckId);
            }

            popup.remove();
            showNotification('Flashcard added!');
        });
    });
}

// Add flashcard to storage
function addFlashcard(front, back, deckId) {
    chrome.storage.local.get({ flashcards: [] }, (data) => {
        const flashcards = data.flashcards;
        flashcards.push({
            id: Date.now(),
            front: front,
            back: back,
            deckId: deckId,
            created: new Date().toISOString()
        });
        chrome.storage.local.set({ flashcards: flashcards });
    });
}

// Show notification
function showNotification(message) {
    const note = document.createElement('div');
    note.textContent = message;
    note.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483647;background:#4CAF50;color:white;padding:14px 24px;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.2);font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:500;';
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 2500);
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Escape HTML attribute values
function escapeAttr(text) {
    return String(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
