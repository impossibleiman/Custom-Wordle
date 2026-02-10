// ===== CONFIG =====
let TARGET_LAYOUT = [];
let ACTIVE_COLUMNS = 0; // letters only
const MAX_GUESSES = 6;
const keyStates = {}; // letter -> "correct" | "present" | "absent"
let currentLevelId = null;

const LEVELS = {
  Mia: [
    { id: "mia-1", word: "sniffer" },
    { id: "mia-2", word: "beaker" },
    { id: "mia-3", word: "freddy fazbear" },
    { id: "mia-4", word: "james" },
    { id: "mia-5", word: "gavin and stacey" },
    { id: "mia-6", word: "muppets christmas carol" },
    { id: "mia-7", word: "stephen bunting" }
  ],
  Hannah: [
    { id: "han-1", word: "pasta" },
    { id: "han-2", word: "tavern" },
    { id: "han-3", word: "cooper" },
    { id: "han-4", word: "bailey" },
    { id: "han-5", word: "biscoff" },
    { id: "han-6", word: "minecraft" },
    { id: "han-7", word: "garlic bread" }
  ]
};

// ===== STATE =====
let currentPlayer = null;
let levelIndex = 0;
let TARGET_WORD = "";
let CLEAN_TARGET = "";

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

function saveLevelCompleted(player, levelId) {
  const data = getProgress();

  if (!data[player]) {
    data[player] = { completed: [] };
  }

  if (!data[player].completed.includes(levelId)) {
    data[player].completed.push(levelId);
  }

  localStorage.setItem("wordleProgress", JSON.stringify(data));
}


// ===== LEVEL UI =====
function renderLevelPanels() {
  renderPlayer("Mia");
  renderPlayer("Hannah");
}

function renderPlayer(player) {
  const progress = getProgress()[player]?.completed ?? [];
  const container = document.getElementById(
    player === "Mia" ? "mia-levels" : "hannah-levels"
  );

  container.innerHTML = "";

  LEVELS[player].forEach((level, i) => {
    const dot = document.createElement("div");
    dot.className = "level-dot";

    if (progress.includes(level.id)) {
      dot.classList.add("completed");
    }

    if (player === currentPlayer && i === levelIndex) {
      dot.classList.add("active");
    }

    dot.onclick = () =>
      startLevelFor(player, i, { resetRestartCount: true });

    container.appendChild(dot);
  });
}


// ===== GAME FLOW =====
function startLevelFor(player, index, { resetRestartCount }) {
  currentPlayer = player;
  levelIndex = index;

  const levels = LEVELS[player];
  const level = levels[index];
  currentLevelId = level.id;

  if (index < 0 || index >= levels.length) {
    showMessage("No more levels.");
    gameOver = true;
    return;
  }

  TARGET_WORD = level.word.toUpperCase();
  CLEAN_TARGET = TARGET_WORD.replace(/ /g, "");
  TARGET_LAYOUT = parseTarget(TARGET_WORD);
  ACTIVE_COLUMNS = CLEAN_TARGET.length;

  const fontScale = computeFontScale(TARGET_LAYOUT.length);
  boardElement.style.setProperty("--tile-font-scale", fontScale);

  if (resetRestartCount) restartCount = 0;

  hideControls();
  clearMessage();
  for (const k in keyStates) delete keyStates[k];
  boardElement.style.display = "grid";
  keyboardElement.style.display = "flex";

  resetBoard();
  restoreSavedGuesses();
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
  applyTileFontSize();
  createKeyboard();
}

// ===== BOARD/KEYBOARD CREATION =====
function createBoard() {
  board = [];
  boardElement.innerHTML = "";

  for (let r = 0; r < MAX_GUESSES; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    rowEl.style.gridTemplateColumns =
      `repeat(${TARGET_LAYOUT.length}, minmax(0,1fr))`;

    board[r] = [];

    TARGET_LAYOUT.forEach(slot => {
      if (slot.isSpace) {
        const gap = document.createElement("div");
        gap.className = "gap";
        rowEl.appendChild(gap);
        board[r].push(null);
      } else {
        const tile = document.createElement("div");
        tile.className = "tile";
        rowEl.appendChild(tile);
        board[r].push(tile);
      }
    });

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
  if (isRevealing) return;

  // Count letters already entered
  const lettersEntered = board[currentRow].filter(t => t && t.textContent).length;
  if (lettersEntered >= CLEAN_TARGET.length) return;

  while (
    currentCol < TARGET_LAYOUT.length &&
    TARGET_LAYOUT[currentCol].isSpace
  ) {
    currentCol++;
  }

  if (currentCol >= TARGET_LAYOUT.length) return;

  board[currentRow][currentCol].textContent = letter;
  currentCol++;
}



function deleteLetter() {
  do {
    currentCol--;
  } while (
    currentCol >= 0 &&
    TARGET_LAYOUT[currentCol].isSpace
  );

  if (currentCol < 0) {
    currentCol = 0;
    return;
  }

  board[currentRow][currentCol].textContent = "";
}


async function submitGuess() {
  if (isRevealing) return;

  const guess = board[currentRow]
    .filter(t => t)
    .map(t => t.textContent)
    .join("");

  if (guess.length < CLEAN_TARGET.length) return;

  const result = scoreGuess(guess, CLEAN_TARGET);
  saveGuess(currentLevelId, guess);
  revealRowAnimated(result);


  const totalRevealMs = CLEAN_TARGET.length * 300 + 50;
  isRevealing = true;

  setTimeout(() => {
    isRevealing = false;

    // WIN
    if (guess === CLEAN_TARGET) {
      gameOver = true;
      saveLevelCompleted(currentPlayer, currentLevelId);
      renderLevelPanels();
      document.getElementById("continue").style.display = "inline-block";
      showMessage("Nice!");
      return;
    }

    // Next row
    currentRow++;
    currentCol = 0;

    // FAIL
    if (currentRow === MAX_GUESSES) {
      gameOver = true;
      document.getElementById("restart").style.display = "inline-block";
      showMessage("Try again.");
    }
  }, totalRevealMs);
}


// Wordle-style scoring with duplicate handling
function scoreGuess(guess, cleanTarget) {
  const targetWords = TARGET_WORD.split(" ");
  const guessWords = [];
  let ptr = 0;

  // Split guess into word segments matching target word lengths
  for (const word of targetWords) {
    guessWords.push(guess.slice(ptr, ptr + word.length));
    ptr += word.length;
  }

  const results = [];

  // Score each word independently
  for (let i = 0; i < targetWords.length; i++) {
    const segmentResult = scoreSegment(
      guessWords[i],
      targetWords[i].toUpperCase()
    );
    results.push(...segmentResult);
  }

  return results;
}



function revealRowAnimated(states) {
  clearMessage();

  let stateIndex = 0;
  let tileIndex = 0;

  for (let i = 0; i < TARGET_LAYOUT.length; i++) {
    const tile = board[currentRow][i];
    if (!tile) continue;

    const delay = tileIndex * 300;
    tileIndex++;

    setTimeout(() => {
      tile.classList.add("flip-in");

      setTimeout(() => {
        tile.classList.remove("flip-in");

        const state = states[stateIndex++];
        tile.classList.remove("correct", "present", "absent");
        tile.classList.add(state);

        setKeyState(tile.textContent, state);

        tile.classList.add("flip-out");
      }, 250);
    }, delay);
  }
}



// ===== BUTTON ACTIONS =====
function restartLevel() {
  // Only valid after a fail (gameOver)
  if (!currentPlayer) return;

  clearGuessesForLevel(currentLevelId);
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

  saveLevelCompleted(currentPlayer, currentLevelId);
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

function parseTarget(word) {
  return word.split("").map(ch => ({
    char: ch,
    isSpace: ch === " "
  }));
}

function computeFontScale(columnCount) {
  if (columnCount <= 6) return 75;   // big, chunky
  if (columnCount <= 9) return 65;
  if (columnCount <= 12) return 58;
  if (columnCount <= 16) return 52;
  return 46; // very long phrases
}

function applyTileFontSize() {
  requestAnimationFrame(() => {
    const tile = boardElement.querySelector(".tile");
    if (!tile) return;

    const size = tile.getBoundingClientRect().width;
    boardElement.style.setProperty("--tile-size", `${size}px`);
  });
}

function scoreSegment(guess, target) {
  const res = Array(guess.length).fill("absent");
  const targetArr = target.split("");
  const guessArr = guess.split("");

  // Pass 1: correct
  for (let i = 0; i < guessArr.length; i++) {
    if (guessArr[i] === targetArr[i]) {
      res[i] = "correct";
      targetArr[i] = null;
      guessArr[i] = null;
    }
  }

  // Pass 2: present (within segment only)
  for (let i = 0; i < guessArr.length; i++) {
    if (!guessArr[i]) continue;
    const idx = targetArr.indexOf(guessArr[i]);
    if (idx !== -1) {
      res[i] = "present";
      targetArr[idx] = null;
    }
  }

  return res;
}

function getSavedGuesses() {
  return JSON.parse(localStorage.getItem("wordleGuesses")) || {};
}

function saveGuess(levelId, guess) {
  const data = getSavedGuesses();

  if (!data[levelId]) {
    data[levelId] = [];
  }

  data[levelId].push(guess);
  localStorage.setItem("wordleGuesses", JSON.stringify(data));
}

function clearGuessesForLevel(levelId) {
  const data = getSavedGuesses();
  delete data[levelId];
  localStorage.setItem("wordleGuesses", JSON.stringify(data));
}

function restoreSavedGuesses() {
  const data = getSavedGuesses();
  const guesses = data[currentLevelId];
  if (!Array.isArray(guesses)) return;

  guesses.forEach(guess => {
    if (currentRow >= MAX_GUESSES) return;

    // Fill row
    let col = 0;
    for (let i = 0; i < TARGET_LAYOUT.length; i++) {
      if (TARGET_LAYOUT[i].isSpace) continue;
      board[currentRow][i].textContent = guess[col++];
    }

    // Score + reveal instantly (no animation)
    const result = scoreGuess(guess, CLEAN_TARGET);
    revealRowInstant(result);

    currentRow++;
    currentCol = 0;
  });
}

function revealRowInstant(states) {
  let stateIndex = 0;

  for (let i = 0; i < TARGET_LAYOUT.length; i++) {
    const tile = board[currentRow][i];
    if (!tile) continue;

    const state = states[stateIndex++];
    tile.classList.add(state);
    setKeyState(tile.textContent, state);
  }
}



// ===== INIT =====
renderLevelPanels();
