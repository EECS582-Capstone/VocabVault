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

let allDecks = [];
let allFlashcards = [];
let activeDeckId = 'all';

chrome.storage.local.get({ decks: [], flashcards: [] }, (raw) => {
    const data = ensureDefaultDeck(raw);
    allDecks = data.decks;
    allFlashcards = data.flashcards;
    renderDecks(allDecks, allFlashcards, activeDeckId);
    renderFlashcards(allFlashcards);
});

function renderDecks(decks, flashcards, activeId) {
    const tabsContainer = document.getElementById('deck-tabs');
    tabsContainer.innerHTML = '';

    // "All" tab
    const allTab = createTab('All', 'all', activeId === 'all');
    tabsContainer.appendChild(allTab);

    // One tab per deck
    decks.forEach(deck => {
        const tab = createTab(deck.name, deck.id, activeId === deck.id);
        tabsContainer.appendChild(tab);
    });

    // "＋ New Deck" button
    const newDeckBtn = document.createElement('button');
    newDeckBtn.className = 'deck-tab new-deck-btn';
    newDeckBtn.textContent = '+ New Deck';
    newDeckBtn.addEventListener('click', () => showNewDeckForm(tabsContainer));
    tabsContainer.appendChild(newDeckBtn);
}

function createTab(label, deckId, isActive) {
    const btn = document.createElement('button');
    btn.className = 'deck-tab' + (isActive ? ' active' : '');
    btn.textContent = label;
    btn.dataset.deckId = deckId;
    btn.addEventListener('click', () => {
        activeDeckId = deckId;
        renderDecks(allDecks, allFlashcards, activeDeckId);
        const filtered = deckId === 'all'
            ? allFlashcards
            : allFlashcards.filter(c => c.deckId === deckId);
        renderFlashcards(filtered);
    });
    return btn;
}

function showNewDeckForm(tabsContainer) {
    // Avoid duplicate forms
    if (document.getElementById('new-deck-form')) return;

    const form = document.createElement('div');
    form.id = 'new-deck-form';
    form.className = 'new-deck-form';
    form.innerHTML = `
        <input id="new-deck-name" type="text" placeholder="Deck name..." class="new-deck-input">
        <button id="new-deck-create" class="new-deck-create-btn">Create</button>
        <button id="new-deck-cancel" class="new-deck-cancel-btn">Cancel</button>
    `;

    tabsContainer.parentElement.insertBefore(form, tabsContainer.nextSibling);

    document.getElementById('new-deck-cancel').addEventListener('click', () => form.remove());

    document.getElementById('new-deck-create').addEventListener('click', () => {
        const name = document.getElementById('new-deck-name').value.trim();
        if (!name) { document.getElementById('new-deck-name').focus(); return; }
        const newDeck = { id: Date.now().toString(), name, created: new Date().toISOString() };
        allDecks.push(newDeck);
        chrome.storage.local.set({ decks: allDecks }, () => {
            form.remove();
            activeDeckId = newDeck.id;
            renderDecks(allDecks, allFlashcards, activeDeckId);
            renderFlashcards(allFlashcards.filter(c => c.deckId === newDeck.id));
        });
    });
}

function renderFlashcards(flashcards) {
    const container = document.getElementById("flashcard-container");
    container.innerHTML = "";

    flashcards.forEach(card => {
        const cardDiv = document.createElement("div");
        cardDiv.classList.add("card");

        cardDiv.innerHTML = `
            <div class="card-inner">
                <div class="card-front">${card.front}</div>
                <div class="card-back">${card.back}</div>
            </div>
        `;

        cardDiv.addEventListener("click", () => {
            cardDiv.classList.toggle("flipped");
        });

        container.appendChild(cardDiv);
    });
}


const modeSwitch = document.getElementById("modeSwitch");
const modeLabel = document.getElementById("modeLabel");

const learnSection = document.getElementById("learn-mode");
const practiceSection = document.getElementById("practice-mode");

modeSwitch.addEventListener("change", () => {
  if (modeSwitch.checked) {
    learnSection.style.display = "none";
    practiceSection.style.display = "block";
    modeLabel.textContent = "Practice Mode";
  } else {
    practiceSection.style.display = "none";
    learnSection.style.display = "block";
    modeLabel.textContent = "Learn Mode";
  }
});

const menuIcon = document.querySelector(".menu-icon");
const dropdownMenu = document.getElementById("dropdown-menu");

menuIcon.addEventListener("click", (e) => {
    dropdownMenu.style.display =
        dropdownMenu.style.display === "block" ? "none" : "block";
});

document.addEventListener("click", (e) => {
    if (!menuIcon.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownMenu.style.display = "none";
    }
});
