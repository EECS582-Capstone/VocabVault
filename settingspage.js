const DEFAULT_TRANSCRIPTION_ENDPOINT = 'https://api.assemblyai.com';
const DEFAULT_TRANSCRIPTION_MODEL = 'universal-streaming-multilingual';
const DEFAULT_CARD_COLORS = { frontColor: '#f6efd5', backColor: '#A5BFCC', textColor: '#000000' };

// ── Theme ──────────────────────────────────────────────
const themeSwitch = document.getElementById('themeSwitch');
const themeLabel  = document.getElementById('themeLabel');
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    themeSwitch.checked = true;
    themeLabel.textContent = 'Dark Mode';
}
themeSwitch.addEventListener('change', () => {
    if (themeSwitch.checked) {
        document.body.classList.add('dark-mode');
        themeLabel.textContent = 'Dark Mode';
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.classList.remove('dark-mode');
        themeLabel.textContent = 'Light Mode';
        localStorage.setItem('theme', 'light');
    }
});

// ── Hamburger menu ─────────────────────────────────────
const menuIcon = document.querySelector('.menu-icon');
const dropdownMenu = document.getElementById('dropdown-menu');
menuIcon.addEventListener('click', (e) => {
    dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    e.stopPropagation();
});
document.addEventListener('click', (e) => {
    if (!menuIcon.contains(e.target) && !dropdownMenu.contains(e.target))
        dropdownMenu.style.display = 'none';
});

// ── Card colors ────────────────────────────────────────
function updateColorPreviews(colors) {
    document.getElementById('frontColorPreview').style.background = colors.frontColor;
    document.getElementById('backColorPreview').style.background  = colors.backColor;
    document.getElementById('textColorPreview').style.background  = colors.textColor;
}
chrome.storage.local.get(DEFAULT_CARD_COLORS, (data) => {
    document.getElementById('frontColor').value = data.frontColor || DEFAULT_CARD_COLORS.frontColor;
    document.getElementById('backColor').value  = data.backColor  || DEFAULT_CARD_COLORS.backColor;
    document.getElementById('textColor').value  = data.textColor  || DEFAULT_CARD_COLORS.textColor;
    updateColorPreviews({
        frontColor: data.frontColor || DEFAULT_CARD_COLORS.frontColor,
        backColor:  data.backColor  || DEFAULT_CARD_COLORS.backColor,
        textColor:  data.textColor  || DEFAULT_CARD_COLORS.textColor,
    });
});
document.getElementById('saveCardColors').addEventListener('click', () => {
    const colors = {
        frontColor: document.getElementById('frontColor').value,
        backColor:  document.getElementById('backColor').value,
        textColor:  document.getElementById('textColor').value,
    };
    chrome.storage.local.set(colors, () => {
        updateColorPreviews(colors);
        const st = document.getElementById('cardColorStatus');
        st.textContent = 'Card colors saved.';
        setTimeout(() => st.textContent = '', 2500);
    });
});

// ── Transcription ──────────────────────────────────────
chrome.storage.local.get({
    transcriptionApiKey: '',
    transcriptionEndpoint: DEFAULT_TRANSCRIPTION_ENDPOINT,
    transcriptionModel: DEFAULT_TRANSCRIPTION_MODEL
}, (data) => {
    document.getElementById('transcriptionApiKey').value   = data.transcriptionApiKey   || '';
    document.getElementById('transcriptionEndpoint').value = data.transcriptionEndpoint || DEFAULT_TRANSCRIPTION_ENDPOINT;
    document.getElementById('transcriptionModel').value    = data.transcriptionModel    || DEFAULT_TRANSCRIPTION_MODEL;
});
document.getElementById('saveTranscriptionSettings').addEventListener('click', () => {
    const apiKey   = document.getElementById('transcriptionApiKey').value.trim();
    const endpoint = document.getElementById('transcriptionEndpoint').value.trim() || DEFAULT_TRANSCRIPTION_ENDPOINT;
    const model    = document.getElementById('transcriptionModel').value.trim()    || DEFAULT_TRANSCRIPTION_MODEL;
    const status   = document.getElementById('transcriptionSettingsStatus');
    chrome.storage.local.set({ transcriptionApiKey: apiKey, transcriptionEndpoint: endpoint, transcriptionModel: model }, () => {
        status.textContent = 'Transcription settings saved.';
        setTimeout(() => status.textContent = '', 2500);
    });
});

// ── Move Cards Between Decks ───────────────────────────
let allDecks = [], allFlashcards = [];

function escapeHtml(text) {
    const d = document.createElement('div'); d.textContent = String(text); return d.innerHTML;
}

function populateDeckSelects() {
    const src  = document.getElementById('moveSrcDeck');
    const dest = document.getElementById('moveDestDeck');
    src.innerHTML  = '';
    dest.innerHTML = '';
    allDecks.forEach(deck => {
        src.innerHTML  += `<option value="${escapeHtml(deck.id)}">${escapeHtml(deck.name)}</option>`;
        dest.innerHTML += `<option value="${escapeHtml(deck.id)}">${escapeHtml(deck.name)}</option>`;
    });
    if (allDecks.length > 1) dest.selectedIndex = 1;
    updateCardCountNote();
    renderPerCardMover();
}

function updateCardCountNote() {
    const srcId = document.getElementById('moveSrcDeck').value;
    const deck  = allDecks.find(d => d.id === srcId);
    const count = deck ? (deck.cardIds || []).length : 0;
    document.getElementById('card-count-note').textContent = `Source deck has ${count} card${count !== 1 ? 's' : ''}.`;
}

function renderPerCardMover() {
    const srcId  = document.getElementById('moveSrcDeck').value;
    const destId = document.getElementById('moveDestDeck').value;
    const srcDeck = allDecks.find(d => d.id === srcId);
    if (!srcDeck) { document.getElementById('per-card-move').innerHTML = ''; return; }

    const cards = allFlashcards.filter(c => (srcDeck.cardIds || []).includes(c.id));
    if (cards.length === 0) {
        document.getElementById('per-card-move').innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No cards in this deck.</p>';
        return;
    }

    const destOptions = allDecks
        .filter(d => d.id !== srcId)
        .map(d => `<option value="${escapeHtml(d.id)}" ${d.id === destId ? 'selected' : ''}>${escapeHtml(d.name)}</option>`)
        .join('');

    let html = `<p style="font-size:13px;font-weight:700;margin-bottom:8px;">Move individual cards:</p>
        <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
        <thead><tr style="background:rgba(52,89,110,0.1);">
            <th style="padding:8px;text-align:left;">Front</th>
            <th style="padding:8px;text-align:left;">Back</th>
            <th style="padding:8px;text-align:left;">Move to</th>
            <th style="padding:8px;"></th>
        </tr></thead><tbody>`;
    cards.forEach(card => {
        html += `<tr data-card-id="${card.id}" style="border-bottom:1px solid var(--border-light);">
            <td style="padding:7px 8px;">${escapeHtml(card.front)}</td>
            <td style="padding:7px 8px;">${escapeHtml(card.back)}</td>
            <td style="padding:7px 8px;">
                <select class="single-dest-select" style="padding:5px 8px;border-radius:6px;border:1px solid var(--border-light);background:var(--panel-bg);color:var(--text-main);">
                    ${destOptions}
                </select>
            </td>
            <td style="padding:7px 8px;">
                <button class="move-single-btn" style="padding:5px 10px;background:var(--button-primary-bg);color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">Move</button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    document.getElementById('per-card-move').innerHTML = html;

    // Wire up individual move buttons
    document.querySelectorAll('.move-single-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const row = btn.closest('tr');
            const cardId = Number(row.dataset.cardId);
            const newDeckId = row.querySelector('.single-dest-select').value;
            moveSingleCard(cardId, srcId, newDeckId, btn);
        });
    });
}

function moveSingleCard(cardId, fromDeckId, toDeckId, btn) {
    if (fromDeckId === toDeckId) { showMoveStatus('Source and destination are the same.'); return; }
    const fromDeck = allDecks.find(d => d.id === fromDeckId);
    const toDeck   = allDecks.find(d => d.id === toDeckId);
    if (!fromDeck || !toDeck) return;

    fromDeck.cardIds = (fromDeck.cardIds || []).filter(id => id !== cardId);
    toDeck.cardIds   = toDeck.cardIds || [];
    if (!toDeck.cardIds.includes(cardId)) toDeck.cardIds.push(cardId);

    const card = allFlashcards.find(c => c.id === cardId);
    if (card) card.deckId = toDeckId;

    chrome.storage.local.set({ decks: allDecks, flashcards: allFlashcards }, () => {
        showMoveStatus(`Moved "${card ? card.front : cardId}" to ${toDeck.name}.`);
        updateCardCountNote();
        renderPerCardMover();
    });
}

function showMoveStatus(msg) {
    const st = document.getElementById('move-status');
    st.textContent = msg;
    setTimeout(() => st.textContent = '', 3000);
}

document.getElementById('moveSrcDeck').addEventListener('change', () => {
    updateCardCountNote();
    renderPerCardMover();
});
document.getElementById('moveDestDeck').addEventListener('change', () => {
    renderPerCardMover();
});

document.getElementById('moveAllCardsBtn').addEventListener('click', () => {
    const srcId  = document.getElementById('moveSrcDeck').value;
    const destId = document.getElementById('moveDestDeck').value;
    if (srcId === destId) { showMoveStatus('Source and destination deck must be different.'); return; }
    const srcDeck  = allDecks.find(d => d.id === srcId);
    const destDeck = allDecks.find(d => d.id === destId);
    if (!srcDeck || !destDeck) return;

    const cardIds = srcDeck.cardIds || [];
    if (cardIds.length === 0) { showMoveStatus('No cards to move.'); return; }

    destDeck.cardIds = destDeck.cardIds || [];
    cardIds.forEach(id => {
        if (!destDeck.cardIds.includes(id)) destDeck.cardIds.push(id);
        const card = allFlashcards.find(c => c.id === id);
        if (card) card.deckId = destId;
    });
    srcDeck.cardIds = [];

    chrome.storage.local.set({ decks: allDecks, flashcards: allFlashcards }, () => {
        showMoveStatus(`Moved ${cardIds.length} card${cardIds.length !== 1 ? 's' : ''} to "${destDeck.name}".`);
        updateCardCountNote();
        renderPerCardMover();
    });
});

// Load data on start
chrome.storage.local.get({ decks: [], flashcards: [] }, (data) => {
    allDecks      = data.decks;
    allFlashcards = data.flashcards;
    if (allDecks.length === 0) {
        document.getElementById('per-card-move').innerHTML = '<p style="color:var(--text-muted);">No decks found. Create a deck on the home page first.</p>';
    } else {
        populateDeckSelects();
    }
});

