// ===== CONFIG =====
const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
const keyStates = {}; // letter -> "correct" | "present" | "absent"

const LEVELS = {
  Mia: ["APPLE", "CRANE", "PLANE"],
  Hannah: ["GRAPE", "BRICK", "SMILE"]
};

// ===== STATE =====
let currentPlayer = null;
let levelIndex = 0;
let TARGET_WORD = "";

let currentRow = 0;
let currentCol = 0;
let board = [];
let gameOver = false;

// Counts restarts for THIS level only
let restartCount = 0;

// Prevent duplicate keyboard listeners
let keyboardListening = false;

// Lock input while flip animation is running
let isRevealing = false;

// ===== ELEMENTS =====
const boardElement = document.getElementById("board");
const keyboardElement = document.getElementById("keyboard");
const messageEl = document.getElementById("message");

// ===== STORAGE =====
function getProgress() {
  return JSON.parse(localStorage.getItem("wordleProgress")) || {};
}

function saveProgress(player, level) {
  const data = getProgress();
  data[player] = Math.max(data[player] ?? 0, level);
  localStorage.setItem("wordleProgress", JSON.stringify(data));
}

// ===== LEVEL UI =====
function renderLevelPanels() {
  renderPlayer("Mia");
  renderPlayer("Hannah");
}

function renderPlayer(player) {
  const progress = getProgress()[player] ?? 0;
  const container = document.getElementById(player === "Mia" ? "mia-levels" : "hannah-levels");

  container.innerHTML = "";

  // All levels clickable (scales automatically)
  LEVELS[player].forEach((_, i) => {
    const dot = document.createElement("div");
    dot.className = "level-dot";

    if (i < progress) dot.classList.add("completed");
    if (player === currentPlayer && i === levelIndex) dot.classList.add("active");

    dot.onclick = () => startLevelFor(player, i, { resetRestartCount: true });

    container.appendChild(dot);
  });
}

// ===== GAME FLOW =====
function startLevelFor(player, index, { resetRestartCount }) {
  currentPlayer = player;
  levelIndex = index;

  if (resetRestartCount) restartCount = 0;

  hideControls();
  clearMessage();
  for (const k in keyStates) delete keyStates[k];
  boardElement.style.display = "grid";
  keyboardElement.style.display = "flex";

  const levels = LEVELS[player];
  if (index < 0 || index >= levels.length) {
    showMessage("No more levels.");
    gameOver = true;
    return;
  }

  TARGET_WORD = levels[index].toUpperCase();
  resetBoard();
  listenForKeyboard();
  renderLevelPanels();
}

function resetBoard() {
  boardElement.innerHTML = "";
  keyboardElement.innerHTML = "";
  currentRow = 0;
  currentCol = 0;
  gameOver = false;
  isRevealing = false;
  document.querySelectorAll(".key").forEach(k =>
  k.classList.remove("absent", "present", "correct")
  );

  createBoard();
  createKeyboard();
}

// ===== BOARD/KEYBOARD CREATION =====
function createBoard() {
  board = [];

  for (let r = 0; r < MAX_GUESSES; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    board[r] = [];

    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      rowEl.appendChild(tile);
      board[r][c] = tile;
    }

    boardElement.appendChild(rowEl);
  }
}

function createKeyboard() {
  const rows = [
    ["Q","W","E","R","T","Y","U","I","O","P"],
    ["A","S","D","F","G","H","J","K","L"],
    ["ENTER","Z","X","C","V","B","N","M","DEL"]
  ];

  rows.forEach(keys => {
    const rowEl = document.createElement("div");
    rowEl.className = "key-row";

    keys.forEach(k => {
    const keyEl = document.createElement("div");
    keyEl.className = "key";
    keyEl.textContent = k;
    keyEl.dataset.key = k;


      keyEl.onclick = () => {
        if (gameOver || isRevealing) return;
        handleKey(k);
      };

      rowEl.appendChild(keyEl);
    });

    keyboardElement.appendChild(rowEl);
  });
}

// ===== INPUT =====
function listenForKeyboard() {
  if (keyboardListening) return;
  keyboardListening = true;

  document.addEventListener("keydown", e => {
    if (gameOver || isRevealing) return;

    let key = e.key.toUpperCase();
    if (key === "BACKSPACE") key = "DEL";
    if (key === "ENTER") key = "ENTER";

    if (key === "ENTER" || key === "DEL" || /^[A-Z]$/.test(key)) {
      e.preventDefault();
      handleKey(key);
    }
  });
}

function handleKey(key) {
  if (key === "DEL") deleteLetter();
  else if (key === "ENTER") submitGuess();
  else if (/^[A-Z]$/.test(key)) addLetter(key);
}

function addLetter(letter) {
  if (currentCol >= WORD_LENGTH) return;
  board[currentRow][currentCol].textContent = letter;
  currentCol++;
}

function deleteLetter() {
  if (currentCol <= 0) return;
  currentCol--;
  board[currentRow][currentCol].textContent = "";
}

// ===== GUESS CHECK + ANIMATION =====
async function submitGuess() {
  if (currentCol < WORD_LENGTH || isRevealing) return;

  const guess = board[currentRow].map(t => t.textContent).join("");

  // x Invalid word -> shake, no penalty
  if (!(await isRealWord(guess))) {
    showMessage("Not a real word");
    shakeCurrentRow();
    return;
  }

  const result = scoreGuess(guess, TARGET_WORD);
  revealRowAnimated(result);

  // After reveal finishes, advance state
  const totalRevealMs = WORD_LENGTH * 300 + 50;
  isRevealing = true;

  setTimeout(() => {
    isRevealing = false;

    // WIN
    if (guess === TARGET_WORD) {
      gameOver = true;
      // Mark progress (unlock next level)
      saveProgress(currentPlayer, levelIndex + 1);
      renderLevelPanels();
      // Win shows Continue
      document.getElementById("continue").style.display = "inline-block";
      showMessage("Nice!");
      return;
    }

    // Next row
    currentRow++;
    currentCol = 0;

    // FAIL (used all guesses)
    if (currentRow === MAX_GUESSES) {
      gameOver = true;
      document.getElementById("restart").style.display = "inline-block";
      showMessage("Try again.");
    }
  }, totalRevealMs);
}

// Wordle-style scoring with duplicate handling
function scoreGuess(guess, target) {
  const res = Array(WORD_LENGTH).fill("absent");
  const targetArr = target.split("");
  const guessArr = guess.split("");

  // Pass 1: correct
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessArr[i] === targetArr[i]) {
      res[i] = "correct";
      targetArr[i] = null;
      guessArr[i] = null;
    }
  }

  // Pass 2: present
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (!guessArr[i]) continue;
    const idx = targetArr.indexOf(guessArr[i]);
    if (idx !== -1) {
      res[i] = "present";
      targetArr[idx] = null;
    }
  }

  return res;
}

function revealRowAnimated(states) {
  clearMessage();

  for (let i = 0; i < WORD_LENGTH; i++) {
    const tile = board[currentRow][i];

    // Clear any previous flip classes (safety)
    tile.classList.remove("flip-in", "flip-out");

    const delay = i * 300;

    setTimeout(() => {
      tile.classList.add("flip-in");

      setTimeout(() => {
        tile.classList.remove("flip-in");

        tile.classList.remove("correct", "present", "absent");
        tile.classList.add(states[i]);

        setKeyState(
        board[currentRow][i].textContent,
        states[i]
        );
        
        tile.classList.add("flip-out");

      }, 250);
    }, delay);
  }
}

// ===== BUTTON ACTIONS =====
function restartLevel() {
  // Only valid after a fail (gameOver)
  if (!currentPlayer) return;

  restartCount++;

  // After 3 restarts on THIS level, allow Reveal + Continue
  if (restartCount >= 3) {
    document.getElementById("reveal").style.display = "inline-block";
    document.getElementById("continue").style.display = "inline-block";
  } else {
    // still hide continue until either win or 3 restarts
    document.getElementById("continue").style.display = "none";
    document.getElementById("reveal").style.display = "none";
  }

  // Restart same level WITHOUT resetting restartCount
  startLevelFor(currentPlayer, levelIndex, { resetRestartCount: false });
}

function revealWord() {
  if (!TARGET_WORD) return;
  showMessage(`Word was: ${TARGET_WORD}`);
}

function continueLevel() {
  if (!currentPlayer) return;

  // Continue to next level (and reset restartCount)
  saveProgress(currentPlayer, levelIndex + 1);
  startLevelFor(currentPlayer, levelIndex + 1, { resetRestartCount: true });
}

// ===== UI HELPERS =====
function hideControls() {
  document.getElementById("restart").style.display = "none";
  document.getElementById("reveal").style.display = "none";
  document.getElementById("continue").style.display = "none";
}

function showMessage(text) {
  messageEl.textContent = text;
}

function clearMessage() {
  messageEl.textContent = "";
}


async function isRealWord(word) {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`
    );
    return res.ok;
  } catch {
    return false;
  }
}

function shakeCurrentRow() {
  board[currentRow].forEach(tile => {
    tile.classList.add("shake");
    setTimeout(() => tile.classList.remove("shake"), 400);
  });
}
function setKeyState(letter, state) {
  const priority = { absent: 1, present: 2, correct: 3 };
  const current = keyStates[letter];

  if (current && priority[current] >= priority[state]) return;

  keyStates[letter] = state;

  document.querySelectorAll(`.key[data-key="${letter}"]`)
    .forEach(k => {
      k.classList.remove("absent", "present", "correct");
      k.classList.add(state);
    });
}




// ===== INIT =====
renderLevelPanels();
