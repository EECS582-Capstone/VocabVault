// Apply saved theme
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
}

// Hamburger menu
const menuIcon = document.querySelector('.menu-icon');
const dropdownMenu = document.getElementById('dropdown-menu');
menuIcon.addEventListener('click', (e) => {
    dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    e.stopPropagation();
});
document.addEventListener('click', (e) => {
    if (!menuIcon.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownMenu.style.display = 'none';
    }
});

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = String(text);
    return d.innerHTML;
}

function pctClass(pct) {
    return pct >= 80 ? 'pct-good' : pct >= 50 ? 'pct-mid' : 'pct-bad';
}

function loadStats() {
    chrome.storage.local.get({ flashcards: [], quizHistory: [], wordMisses: {}, deckStats: {} }, (data) => {
        const { flashcards, quizHistory, wordMisses, deckStats } = data;

        // Total cards
        document.getElementById('stat-total-cards').textContent = flashcards.length;

        // Quizzes taken
        document.getElementById('stat-quizzes').textContent = quizHistory.length;

        // Overall accuracy
        const totQ = quizHistory.reduce((a, r) => a + r.total, 0);
        const totC = quizHistory.reduce((a, r) => a + r.correct, 0);
        const acc = totQ > 0 ? Math.round((totC / totQ) * 100) : null;
        document.getElementById('stat-accuracy').textContent = acc !== null ? `${acc}%` : '—';

        // Most missed word
        const missedEntries = Object.entries(wordMisses).sort((a, b) => b[1] - a[1]);
        if (missedEntries.length > 0) {
            document.getElementById('stat-missed-word').textContent = missedEntries[0][0];
            document.getElementById('stat-missed-count').textContent = `missed ${missedEntries[0][1]} time${missedEntries[0][1] !== 1 ? 's' : ''}`;
        }

        // Worst deck
        const deckEntries = Object.entries(deckStats)
            .filter(([, d]) => d.total > 0)
            .map(([id, d]) => ({ id, name: d.name, pct: Math.round((d.correct / d.total) * 100) }))
            .sort((a, b) => a.pct - b.pct);
        if (deckEntries.length > 0) {
            document.getElementById('stat-worst-deck').textContent = deckEntries[0].name;
            document.getElementById('stat-worst-pct').textContent = `${deckEntries[0].pct}% accuracy`;
        }

        // Missed words table
        const mwEl = document.getElementById('missed-words-table');
        if (missedEntries.length === 0) {
            mwEl.innerHTML = '<p class="empty-note">No missed words recorded yet.</p>';
        } else {
            const top = missedEntries.slice(0, 20);
            mwEl.innerHTML = `<table>
                <thead><tr><th>#</th><th>Word</th><th>Times Missed</th></tr></thead>
                <tbody>${top.map(([word, count], i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${escapeHtml(word)}</td>
                        <td><strong>${count}</strong></td>
                    </tr>`).join('')}
                </tbody></table>`;
        }

        // Deck stats table
        const dsEl = document.getElementById('deck-stats-table');
        if (deckEntries.length === 0) {
            dsEl.innerHTML = '<p class="empty-note">No deck quiz data yet.</p>';
        } else {
            const sorted = [...deckEntries].sort((a, b) => a.pct - b.pct);
            dsEl.innerHTML = `<table>
                <thead><tr><th>Deck</th><th>Questions</th><th>Correct</th><th>Accuracy</th></tr></thead>
                <tbody>${sorted.map(d => {
                    const ds = deckStats[d.id];
                    return `<tr>
                        <td>${escapeHtml(d.name)}</td>
                        <td>${ds.total}</td>
                        <td>${ds.correct}</td>
                        <td class="${pctClass(d.pct)}">${d.pct}%</td>
                    </tr>`;
                }).join('')}</tbody></table>`;
        }

        // Quiz history table
        const histEl = document.getElementById('history-table');
        if (quizHistory.length === 0) {
            histEl.innerHTML = '<p class="empty-note">No quiz history yet.</p>';
        } else {
            histEl.innerHTML = `<table>
                <thead><tr><th>Date</th><th>Deck</th><th>Score</th><th>%</th><th>Missed</th></tr></thead>
                <tbody>${quizHistory.map(r => {
                    const pct = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0;
                    const dateStr = new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    const missed = (r.missedWords || []).join(', ') || '—';
                    return `<tr>
                        <td>${dateStr}</td>
                        <td>${escapeHtml(r.deckName)}</td>
                        <td>${r.correct}/${r.total}</td>
                        <td class="${pctClass(pct)}">${pct}%</td>
                        <td style="font-size:0.82rem;color:var(--text-muted);">${escapeHtml(missed)}</td>
                    </tr>`;
                }).join('')}</tbody></table>`;
        }
    });
}

document.getElementById('clearStatsBtn').addEventListener('click', () => {
    if (confirm('Clear all statistics? This cannot be undone.')) {
        chrome.storage.local.remove(['quizHistory', 'wordMisses', 'deckStats'], () => {
            loadStats();
        });
    }
});

loadStats();