chrome.storage.local.get({ flashcards: [] }, (data) => {
    renderFlashcards(data.flashcards);  
});

function renderFlashcards(flashcards) {
    const container = document.getElementById("flashcard-container");
    container.innerHTML = ""; // clear old cards

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

menuIcon.addEventListener("click", (e) => {
    dropdownMenu.style.display =
        dropdownMenu.style.display === "block" ? "none" : "block";
}); 

document.addEventListener("click", (e) => {
    if (!menuIcon.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownMenu.style.display = "none";
    }
});