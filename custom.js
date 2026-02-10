// JavaScript source code
function generateId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getCustomStore() {
  return JSON.parse(localStorage.getItem("customGames")) || {};
}

function saveCustomGame(id, word) {
  const store = getCustomStore();
  store[id] = word.toUpperCase();
  localStorage.setItem("customGames", JSON.stringify(store));
}

function loadCustomGame(id) {
  const store = getCustomStore();
  return store[id] || null;
}

function createCustomGame() {
  const input = document.getElementById("customWord");
  const word = input.value.trim();

  if (!word) return;

  const id = generateId();
  saveCustomGame(id, word);

  const link = `${location.origin}${location.pathname}?id=${id}`;
  document.getElementById("shareLink").textContent =
    `Share this link: ${link}`;
}

function getCustomIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

const customId = getCustomIdFromURL();

if (customId) {
  const word = loadCustomGame(customId);

  if (word) {
    startCustomLevel(word);
    document.getElementById("creator").style.display = "none";
  } else {
    document.getElementById("message").textContent =
      "This game was created on another device.";
  }
}

function startCustomLevel(word) {
  LEVELS.Custom = [
    { id: `custom-${customId}`, word }
  ];

  startLevelFor("Custom", 0, { resetRestartCount: true });
}
