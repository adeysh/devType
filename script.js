let snippets = [];
let snippetsLoaded = false;
let currentSnippet = "";
let startTime = null;
let timerInterval = null;
let hasStarted = false;
let errorCount = 0;

// DOM Elements
const codeDisplay = document.getElementById("snippet-output");
const codeInput = document.getElementById("code-input");
const startBtn = document.getElementById("start-btn");
const retryBtn = document.getElementById("retry-btn");
const resetBtn = document.getElementById("reset-btn");
const languageSelect = document.getElementById("language-select");
const difficultySelect = document.getElementById("difficulty-select");
const timeEl = document.getElementById("time");
const errorsEl = document.getElementById("errors");
const speedEl = document.getElementById("speed");
const scoreList = document.getElementById("score-list");
const highlightLayer = document.getElementById("highlight-layer");
const themeToggle = document.getElementById("theme-toggle");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

// === INIT ===
window.addEventListener("DOMContentLoaded", () => {
    const savedLang = localStorage.getItem("preferredLang");
    if (savedLang) languageSelect.value = savedLang;

    const savedDiff = localStorage.getItem("preferredDifficulty");
    if (savedDiff) difficultySelect.value = savedDiff;

    const saved = localStorage.getItem("theme");
    const themeToSet = saved || (prefersDark ? "dark" : "light");
    setTheme(themeToSet);
    resetTest();
    updateLeaderboard();
    loadSnippets();
});

// === Theme ===
function setTheme(mode) {
    document.body.classList.toggle("light", mode === "light");
    themeToggle.querySelector("i").className = mode === "light"
        ? "fas fa-sun"
        : "fas fa-moon";
    localStorage.setItem("theme", mode);
}

function toggleTheme() {
    const isLight = document.body.classList.contains("light");
    setTheme(isLight ? "dark" : "light");
}

themeToggle.addEventListener("click", toggleTheme);

// === Snippet Loading ===
async function loadSnippets() {
    try {
        const res = await fetch("snippets.json");
        const data = await res.json();
        snippets = data;

        const languages = new Set();
        const difficulties = new Set();

        // Collect unique languages and difficulties
        data.forEach(snip => {
            languages.add(snip.language);
            difficulties.add(snip.difficulty);
        });

        languageSelect.innerHTML = [...languages]
            .sort()
            .map(lang => `<option value="${lang}">${capitalize(lang)}</option>`)
            .join("");

        difficultySelect.innerHTML = [...difficulties]
            .sort()
            .map(diff => `<option value="${diff}">${capitalize(diff)}</option>`)
            .join("");

        const savedLang = localStorage.getItem("preferredLang");
        const savedDiff = localStorage.getItem("preferredDifficulty");
        if (savedLang && languages.has(savedLang)) languageSelect.value = savedLang;
        if (savedDiff && difficulties.has(savedDiff)) difficultySelect.value = savedDiff;

    } catch (err) {
        console.error("❌ Failed to load snippets.json:", err);
        alert("Failed to load code snippets.");
    }
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getRandomSnippet() {
    const selectedLang = languageSelect.value;
    const selectedDiff = difficultySelect.value;

    const filtered = snippets.filter(
        snip => snip.language === selectedLang && snip.difficulty === selectedDiff
    );

    if (filtered.length === 0) {
        alert("No snippets available for this selection.");
        return { code: "", language: selectedLang };
    }

    const index = Math.floor(Math.random() * filtered.length);
    return filtered[index].code;
}

function escapeHTML(str) {
    return (str || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function displaySnippet(snippet) {
    const codeEl = codeDisplay.querySelector("code");
    const selectedLang = languageSelect.value;

    // Default to JS if 'any' selected
    const langClass = selectedLang === "any" ? "language-javascript" : `language-${selectedLang}`;
    codeEl.className = langClass;
    codeEl.textContent = snippet;
    Prism.highlightElement(codeEl);
}

function toggleInputsDuringTest(disabled) {
    languageSelect.disabled = disabled;
    difficultySelect.disabled = disabled;
    if (disabled === true) {
        languageSelect.style.cursor = "not-allowed";
        difficultySelect.style.cursor = "not-allowed";
    } else {
        languageSelect.style.cursor = "auto";
        difficultySelect.style.cursor = "auto";
    }
}

languageSelect.addEventListener("change", () => {
    localStorage.setItem("preferredLang", languageSelect.value);
});

difficultySelect.addEventListener("change", () => {
    localStorage.setItem("preferredDifficulty", difficultySelect.value);
});

function resetCurrentSnippet() {
    toggleInputsDuringTest(true);
    clearInterval(timerInterval);
    startTime = null;
    hasStarted = false;
    errorCount = 0;

    timeEl.classList.remove("active-timer");
    codeInput.classList.remove("active-input");
    errorsEl.classList.remove("active-error");

    codeInput.value = "";
    highlightLayer.innerHTML = "";

    codeInput.disabled = false;
    codeInput.focus();

    timeEl.textContent = "0.00s";
    errorsEl.textContent = "0";
    speedEl.textContent = "0 CPM / 0 WPM";
}

// === Game Flow ===
function resetTest() {
    toggleInputsDuringTest(false);
    resetBtn.disabled = true;
    [hasStarted, errorCount] = [false, 0];
    clearInterval(timerInterval);
    [startTime, codeInput.value] = [null, ""];

    Object.assign(codeInput, { disabled: true });
    highlightLayer.innerHTML = "";

    [retryBtn.disabled, startBtn.disabled] = [true, false];
    [errorsEl.textContent, timeEl.textContent, speedEl.innerHTML] =
        ["0", "0.00s", "0 CPM / 0 WPM"];
}

function startTest() {
    resetBtn.disabled = false;
    toggleInputsDuringTest(true);
    clearInterval(timerInterval);
    Object.assign(codeInput, { value: "", disabled: false });
    currentSnippet = getRandomSnippet();

    displaySnippet(currentSnippet);
    highlightLayer.innerHTML = "";
    codeInput.focus();

    [startTime, errorCount, hasStarted] = [null, 0, false];
    [errorsEl.textContent, timeEl.textContent, speedEl.innerHTML] =
        ["0", "0.00s", "0 CPM / 0 WPM"];
    [retryBtn.disabled, startBtn.disabled] = [false, true];

    codeInput.classList.remove("active-input");
    timeEl.classList.remove("active-timer");
    errorsEl.classList.remove("active-error");
}

function startTimer() {
    startTime = Date.now();
    timeEl.classList.add("active-timer");
    codeInput.classList.add("active-input");

    timerInterval = setInterval(() => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        timeEl.textContent = `${elapsed}s`;
    }, 100);
}

function endTest() {
    clearInterval(timerInterval);
    toggleInputsDuringTest(false);
    codeInput.classList.remove("active-input");
    timeEl.classList.remove("active-timer");

    const timeTaken = (Date.now() - startTime) / 1000;
    const charsTyped = currentSnippet.length;
    const cpm = Math.round((charsTyped / timeTaken) * 60);
    const wpm = Math.round((charsTyped / 5) / (timeTaken / 60));

    speedEl.innerHTML = `${cpm} <span class="unit">CPM</span> / ${wpm} <span class="unit">WPM</span>`;

    saveScore({ time: timeTaken, errors: errorCount, cpm, wpm });
    updateLeaderboard();

    codeInput.disabled = true;
    retryBtn.disabled = false;
    startBtn.disabled = false;
}

// === Typing Logic ===
codeInput.addEventListener("input", updateHighlight);
codeInput.addEventListener("scroll", () => {
    highlightLayer.scrollTop = codeInput.scrollTop;
    highlightLayer.scrollLeft = codeInput.scrollLeft;
});

function updateHighlight() {
    if (!hasStarted) {
        hasStarted = true;
        startTimer();
    }

    const typed = codeInput.value;
    const snippet = currentSnippet;
    const cursorPos = codeInput.selectionStart;
    errorCount = 0;

    if (typed.length === 0 && cursorPos === 0) {
        highlightLayer.innerHTML = "";
        return;
    }

    let highlighted = "";
    for (let i = 0; i < snippet.length; i++) {
        const typedChar = escapeHTML(typed[i] || "");
        const actualChar = escapeHTML(snippet[i] || "");

        if (i < typed.length) {
            highlighted += typedChar === actualChar
                ? `<span class="correct-char">${typedChar}</span>`
                : `<span class="incorrect-char">${typedChar}</span>`;
            if (typedChar !== actualChar) errorCount++;
        } else if (i === cursorPos) {
            highlighted += `<span class="cursor-char">${actualChar}</span>`;
        } else if (i > cursorPos && i <= cursorPos + 3) {
            highlighted += `<span class="preview-char">${actualChar}</span>`;
        } else {
            highlighted += `<span class="faded-char">${actualChar}</span>`;
        }
    }

    highlightLayer.innerHTML = highlighted;
    errorsEl.textContent = errorCount;

    if (typed === snippet) endTest();
}

// === Leaderboard ===
function saveScore(score) {
    const scores = JSON.parse(localStorage.getItem("devTypeScores")) || [];
    scores.push(score);
    scores.sort((a, b) => a.time - b.time);
    localStorage.setItem("devTypeScores", JSON.stringify(scores.slice(0, 5)));
}

function updateLeaderboard() {
    const scores = JSON.parse(localStorage.getItem("devTypeScores")) || [];
    scoreList.innerHTML = scores.length === 0 ? "<li>No scores yet</li>" : "";

    scores.forEach((score, i) => {
        scoreList.innerHTML += `
        <li class="score-card">
            <div class="score-rank">#${i + 1}</div>
            <div class="score-details">
                <div class="score-stat">
                    <i class="fas fa-clock"></i> Time
                    <span>${score.time.toFixed(2)}s</span>
                </div>
                <div class="score-stat">
                    <i class="fas fa-times-circle"></i> Errors
                    <span>${score.errors}</span>
                </div>
                <div class="score-stat">
                    <i class="fas fa-font"></i> Speed
                    <span>${score.cpm} CPM</span>
                </div>
                <div class="score-stat">
                    <i class="fas fa-bolt"></i> Speed
                    <span>${score.wpm || 0} WPM</span>
                </div>
            </div>
        </li>`;
    });
}

// === Buttons ===
startBtn.addEventListener("click", () => {
    if (!snippetsLoaded) {
        alert("Snippets are still loading. Please wait.");
        return;
    }
    startTest();
});

retryBtn.addEventListener("click", startTest);

resetBtn.addEventListener("click", () => {
    resetCurrentSnippet();
});