let customSessionId = null;

function startCustomGame() {
  const input = document.getElementById("customWord");
  const word = input.value.trim();

  if (!word) return;

  // IMPORTANT: release mobile keyboard + focus
  input.blur();

  customSessionId = "custom-" + Date.now();

  // Hide creator
  document.getElementById("creator").style.display = "none";

  // Inject temporary level
  LEVELS.Custom = [
    {
      id: customSessionId,
      word: word
    }
  ];

  // Ensure no stale guesses exist
  clearGuessesForLevel(customSessionId);

  startLevelFor("Custom", 0, { resetRestartCount: true });
}

function clearAndNewWord() {
  // Remove custom progress & guesses
  if (customSessionId) {
    clearGuessesForLevel(customSessionId);
  }

  // Reset game UI
  document.getElementById("board").style.display = "none";
  document.getElementById("keyboard").style.display = "none";
  document.getElementById("message").textContent = "";

  hideControls();

  // Clear input
  document.getElementById("customWord").value = "";

  // Show creator again
  document.getElementById("creator").style.display = "flex";

  // Reset script.js state safely
  currentPlayer = null;
  gameOver = false;
}
