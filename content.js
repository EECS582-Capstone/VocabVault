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

// Display translation popup
function displayPopup(original, translation) {
    // Remove existing popup
    const existing = document.getElementById('vv-popup');
    if (existing) existing.remove();

    // Create popup
    const popup = document.createElement('div');
    popup.id = 'vv-popup';
    popup.innerHTML = `
        <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483647;background:white;padding:24px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4);min-width:350px;max-width:500px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
            <button onclick="this.parentElement.parentElement.remove()" style="position:absolute;top:-8px;right:-8px;background:#ff5252;color:white;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:20px;line-height:1;box-shadow:0 2px 8px rgba(0,0,0,0.2);">×</button>
            <div style="margin-bottom:16px;">
                <strong style="display:block;margin-bottom:8px;color:#333;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Original:</strong>
                <div style="padding:12px;background:#f5f5f5;border-radius:6px;color:#222;font-size:16px;line-height:1.5;">${escapeHtml(original)}</div>
            </div>
            <div style="margin-bottom:16px;">
                <strong style="display:block;margin-bottom:8px;color:#333;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Translation:</strong>
                <div style="padding:12px;background:#e3f2fd;border-radius:6px;color:#222;font-size:16px;line-height:1.5;font-weight:500;">${escapeHtml(translation)}</div>
            </div>
            <button id="vv-add-btn" style="width:100%;padding:12px;background:#2196F3;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;transition:background 0.2s;" onmouseover="this.style.background='#1976D2'" onmouseout="this.style.background='#2196F3'">Add to Flashcards</button>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Add flashcard button
    document.getElementById('vv-add-btn').addEventListener('click', () => {
        addFlashcard(original, translation);
        popup.remove();
        showNotification('Flashcard added!');
    });
}

// Add flashcard to storage
function addFlashcard(front, back) {
    chrome.storage.local.get({ flashcards: [] }, (data) => {
        const flashcards = data.flashcards;
        flashcards.push({
            id: Date.now(),
            front: front,
            back: back,
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