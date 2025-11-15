const setupSection = document.getElementById('setup');
const gameSection = document.getElementById('game');
const playerCountInput = document.getElementById('player-count');
const playerNamesContainer = document.getElementById('player-names-container');
const startGameBtn = document.getElementById('start-game-btn');
const setupError = document.getElementById('setup-error');

const diceContainer = document.getElementById('dice-container');
const rollBtn = document.getElementById('roll-btn');
const endTurnBtn = document.getElementById('end-turn-btn');
const rollCounter = document.getElementById('roll-counter');
const manualModeCheckbox = document.getElementById('manual-mode-checkbox');
const messageEl = document.getElementById('message');
const scoreboard = document.getElementById('scoreboard');
const scoreboardHead = scoreboard.querySelector('thead');
const scoreboardBody = scoreboard.querySelector('tbody');
const saveGameBtn = document.getElementById('save-game-btn');
const newGameBtn = document.getElementById('new-game-btn');
const savedGamesSelect = document.getElementById('saved-games');
const loadGameBtn = document.getElementById('load-game-btn');
const deleteGameBtn = document.getElementById('delete-game-btn');
const installButton = document.getElementById('install-pwa-btn');

const manualDialog = document.getElementById('manual-entry-dialog');
const manualForm = document.getElementById('manual-entry-form');
const manualCategoryLabel = document.getElementById('manual-category-label');
const manualScoreInput = document.getElementById('manual-score');
const manualScoreError = document.getElementById('manual-score-error');
const manualCancelBtn = document.getElementById('manual-cancel-btn');

const categories = [
  'ones',
  'twos',
  'threes',
  'fours',
  'fives',
  'sixes',
  'threeOfKind',
  'fourOfKind',
  'fullHouse',
  'smallStraight',
  'largeStraight',
  '5gleicheZahlen',
  'chance'
];

const categoryDisplay = {
  ones: { short: '1er', full: 'Einser' },
  twos: { short: '2er', full: 'Zweier' },
  threes: { short: '3er', full: 'Dreier' },
  fours: { short: '4er', full: 'Vierer' },
  fives: { short: '5er', full: 'Fünfer' },
  sixes: { short: '6er', full: 'Sechser' },
  upperSum: { short: 'Summe ↑', full: 'Summe oben' },
  bonus: { short: 'Bonus', full: 'Bonus (ab 63 Pkt.)' },
  threeOfKind: { short: '3er Pasch', full: 'Dreierpasch' },
  fourOfKind: { short: '4er Pasch', full: 'Viererpasch' },
  fullHouse: { short: 'Full House', full: 'Full House (25 Pkt.)' },
  smallStraight: { short: 'Kl. Straße', full: 'Kleine Straße (30 Pkt.)' },
  largeStraight: { short: 'Gr. Straße', full: 'Große Straße (40 Pkt.)' },
  '5gleicheZahlen': { short: 'Kniffel', full: '5 gleiche Zahlen (50 Pkt.)' },
  chance: { short: 'Chance', full: 'Chance' },
  total: { short: 'Gesamt', full: 'Gesamt' }
};

const upperCategories = categories.slice(0, 6);
const calculatedCategories = ['upperSum', 'bonus', 'total'];
const STORAGE_KEY = 'rollscoreSavedGames_v4';

let deferredInstallPrompt = null;
let gameState = null;
let pendingManualCategory = null;

function getCategoryLabel(category, type = 'full') {
  return categoryDisplay[category]?.[type] || category;
}

function updateMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.classList.toggle('error-message', isError);
}

function updateRollCounter() {
  if (!gameState) {
    rollCounter.textContent = '';
    return;
  }
  rollCounter.textContent = `Würfe übrig: ${gameState.rollsLeft}`;
}

function generatePlayerNameInputs(count) {
  playerNamesContainer.innerHTML = '';
  for (let i = 1; i <= count; i += 1) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field-group';

    const label = document.createElement('label');
    label.htmlFor = `player-name-${i}`;
    label.textContent = `Name Spieler ${i}`;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = `player-name-${i}`;
    input.value = `Spieler ${i}`;
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('input', validatePlayerNames);

    const error = document.createElement('p');
    error.className = 'field-error';
    error.id = `${input.id}-error`;

    wrapper.append(label, input, error);
    playerNamesContainer.appendChild(wrapper);
  }
  validatePlayerNames();
}

function validatePlayerNames() {
  const inputs = Array.from(playerNamesContainer.querySelectorAll('input[type="text"]'));
  const seenNames = new Map();
  let isValid = true;

  inputs.forEach((input) => {
    const trimmed = input.value.trim();
    const errorElement = document.getElementById(`${input.id}-error`);
    let errorMessage = '';

    if (!trimmed) {
      errorMessage = 'Bitte einen Namen eingeben.';
    } else {
      const lower = trimmed.toLowerCase();
      if (seenNames.has(lower)) {
        errorMessage = 'Name wird bereits verwendet.';
        const duplicateInput = seenNames.get(lower);
        duplicateInput.classList.add('invalid');
        const duplicateError = document.getElementById(`${duplicateInput.id}-error`);
        if (duplicateError && !duplicateError.textContent) {
          duplicateError.textContent = 'Name wird bereits verwendet.';
        }
      } else {
        seenNames.set(lower, input);
      }
    }

    if (errorElement) {
      errorElement.textContent = errorMessage;
    }
    input.classList.toggle('invalid', Boolean(errorMessage));
    if (errorMessage) {
      isValid = false;
    }
  });

  startGameBtn.disabled = !isValid;
  if (isValid) {
    setupError.textContent = '';
  }
  return isValid;
}

function handlePlayerCountChange() {
  let count = parseInt(playerCountInput.value, 10);
  if (Number.isNaN(count)) {
    count = 1;
  }
  count = Math.min(6, Math.max(1, count));
  playerCountInput.value = count;
  generatePlayerNameInputs(count);
}

function getDefaultGameState(playerNames) {
  const players = playerNames.map((name) => ({
    name,
    scores: {},
    used: {}
  }));

  players.forEach((player) => {
    categories.forEach((cat) => {
      player.scores[cat] = null;
      player.used[cat] = false;
    });
  });

  return {
    players,
    currentPlayer: 0,
    dice: Array(5).fill(null),
    held: Array(5).fill(false),
    rollsLeft: 3,
    turnPhase: 'roll',
    gameOver: false,
    timestamp: null,
    manualModeActive: false
  };
}

function startGame(playerNames) {
  gameState = getDefaultGameState(playerNames);
  manualModeCheckbox.checked = gameState.manualModeActive;
  rebuildScoreboardStructure(gameState.players);
  updateScoreboardUI();
  createDiceUI();
  setupSection.classList.add('hidden');
  gameSection.classList.remove('hidden');
  saveGameBtn.disabled = false;
  setTurnPhase('roll');
  loadSavedGamesList();
  updateRollCounter();
}

function rebuildScoreboardStructure(players) {
  scoreboardHead.innerHTML = '';
  scoreboardBody.innerHTML = '';

  const headerRow = document.createElement('tr');
  const categoryHeader = document.createElement('th');
  categoryHeader.scope = 'col';
  categoryHeader.textContent = 'Kategorie';
  headerRow.appendChild(categoryHeader);

  players.forEach((player) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = player.name;
    headerRow.appendChild(th);
  });
  scoreboardHead.appendChild(headerRow);

  const rows = [
    ...categories.slice(0, 6),
    'upperSum',
    'bonus',
    ...categories.slice(6),
    'total'
  ];

  rows.forEach((catId) => {
    const row = document.createElement('tr');
    row.dataset.category = catId;

    const rowHeader = document.createElement('th');
    rowHeader.scope = 'row';
    const abbr = document.createElement('abbr');
    abbr.title = getCategoryLabel(catId);
    abbr.textContent = getCategoryLabel(catId, 'short');
    rowHeader.appendChild(abbr);
    row.appendChild(rowHeader);

    players.forEach((_, playerIndex) => {
      const cell = document.createElement('td');
      cell.dataset.playerIndex = playerIndex.toString();
      if (calculatedCategories.includes(catId)) {
        cell.classList.add('calculated');
        cell.textContent = '0';
      } else {
        cell.classList.add('score-cell');
      }
      row.appendChild(cell);
    });
    scoreboardBody.appendChild(row);
  });
}

function createDiceUI() {
  if (!gameState) return;
  diceContainer.innerHTML = '';
  gameState.dice.forEach((value, index) => {
    const die = document.createElement('button');
    die.type = 'button';
    die.className = 'dice';
    if (gameState.held[index]) {
      die.classList.add('held');
    }
    die.textContent = value !== null ? value : '?';
    die.dataset.index = index;
    die.setAttribute('aria-pressed', gameState.held[index].toString());
    const valueLabel = value === null ? 'noch nicht geworfen' : value;
    const holdLabel = gameState.held[index] ? 'gehalten' : 'frei';
    die.setAttribute('aria-label', `Würfel ${index + 1}: ${valueLabel}, ${holdLabel}`);
    die.addEventListener('click', handleDieClick);
    die.addEventListener('keydown', handleDieKeyDown);
    diceContainer.appendChild(die);
  });
}

function handleDieKeyDown(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    event.currentTarget?.click();
  }
}

function handleDieClick(event) {
  if (!gameState || gameState.turnPhase !== 'roll' || gameState.rollsLeft === 3 || gameState.gameOver) {
    return;
  }
  const index = Number(event.currentTarget.dataset.index);
  if (Number.isNaN(index)) return;
  gameState.held[index] = !gameState.held[index];
  createDiceUI();
}

function animateDice() {
  const diceElements = diceContainer.querySelectorAll('.dice:not(.held)');
  diceElements.forEach((die) => {
    const delay = Math.random() * 120;
    setTimeout(() => {
      die.classList.add('shaking');
      setTimeout(() => die.classList.remove('shaking'), 400);
    }, delay);
  });
}

function rollDice() {
  if (!gameState || gameState.rollsLeft <= 0 || gameState.turnPhase !== 'roll' || gameState.gameOver) {
    return;
  }

  gameState.rollsLeft -= 1;
  let rolledAtLeastOnce = false;
  for (let i = 0; i < 5; i += 1) {
    if (!gameState.held[i]) {
      gameState.dice[i] = Math.floor(Math.random() * 6) + 1;
      rolledAtLeastOnce = true;
    }
  }

  if (rolledAtLeastOnce) {
    createDiceUI();
    animateDice();
  } else if (gameState.rollsLeft > 0) {
    updateMessage('Bitte halte Würfel oder wähle eine Kategorie.');
    gameState.rollsLeft += 1;
    updateRollCounter();
    return;
  }

  const currentPlayerName = gameState.players[gameState.currentPlayer].name;
  updateMessage(`${currentPlayerName}: Würfe übrig: ${gameState.rollsLeft}.`);
  updateRollCounter();

  if (gameState.rollsLeft === 0) {
    setTurnPhase('selectCategory');
  } else {
    endTurnBtn.disabled = false;
  }
}

function setTurnPhase(phase) {
  if (!gameState) return;
  gameState.turnPhase = phase;
  const currentPlayerName = gameState.players[gameState.currentPlayer]?.name || 'Spieler';

  rollBtn.disabled = phase !== 'roll';
  endTurnBtn.disabled = !(phase === 'roll' && gameState.rollsLeft < 3);
  manualModeCheckbox.disabled = false;

  if (gameState.gameOver) {
    manualModeCheckbox.disabled = true;
    updateScoreboardClickability(false);
    updateMessage(determineWinner());
    saveGameBtn.disabled = true;
    updateRollCounter();
    return;
  }

  switch (phase) {
    case 'roll':
      updateScoreboardClickability(false);
      if (gameState.rollsLeft === 3) {
        updateMessage(`${currentPlayerName} ist am Zug. Bitte würfeln.`);
      } else {
        updateMessage(`${currentPlayerName}: Würfe übrig: ${gameState.rollsLeft}.`);
      }
      break;
    case 'selectCategory':
      rollBtn.disabled = true;
      endTurnBtn.disabled = true;
      updateScoreboardClickability(true);
      updateMessage(
        `${currentPlayerName}: Wähle eine Kategorie${manualModeCheckbox.checked ? ' oder gib Punkte manuell ein' : ''}.`
      );
      break;
    default:
      break;
  }
  updateRollCounter();
}

function calculateScore(category, dice) {
  if (dice.some((d) => d === null)) return 0;

  const counts = {};
  let sum = 0;
  dice.forEach((d) => {
    counts[d] = (counts[d] || 0) + 1;
    sum += d;
  });
  const sortedDice = [...dice].sort();

  switch (category) {
    case 'ones':
      return (counts[1] || 0) * 1;
    case 'twos':
      return (counts[2] || 0) * 2;
    case 'threes':
      return (counts[3] || 0) * 3;
    case 'fours':
      return (counts[4] || 0) * 4;
    case 'fives':
      return (counts[5] || 0) * 5;
    case 'sixes':
      return (counts[6] || 0) * 6;
    case 'threeOfKind':
      return Object.values(counts).some((c) => c >= 3) ? sum : 0;
    case 'fourOfKind':
      return Object.values(counts).some((c) => c >= 4) ? sum : 0;
    case 'fullHouse':
      return Object.values(counts).includes(3) && Object.values(counts).includes(2) ? 25 : 0;
    case 'smallStraight': {
      const uniqueSorted = [...new Set(sortedDice)].sort((a, b) => a - b).join('');
      return /(1234|2345|3456)/.test(uniqueSorted) ? 30 : 0;
    }
    case 'largeStraight': {
      const uniqueSorted = [...new Set(sortedDice)].sort((a, b) => a - b).join('');
      return /(12345|23456)/.test(uniqueSorted) ? 40 : 0;
    }
    case '5gleicheZahlen':
      return Object.values(counts).some((c) => c >= 5) ? 50 : 0;
    case 'chance':
      return sum;
    default:
      return 0;
  }
}

function updateScoreboardUI() {
  if (!gameState) return;
  gameState.players.forEach((player, playerIndex) => {
    let upperSum = 0;
    let totalSum = 0;

    categories.forEach((category) => {
      const cell = scoreboardBody.querySelector(
        `tr[data-category="${category}"] td[data-player-index="${playerIndex}"]`
      );
      if (cell) {
        const score = player.scores[category];
        cell.textContent = score !== null ? score : '';
        cell.classList.toggle('used', Boolean(player.used[category]));
      }
      if (player.scores[category] !== null) {
        if (upperCategories.includes(category)) {
          upperSum += player.scores[category];
        }
        totalSum += player.scores[category];
      }
    });

    const upperSumCell = scoreboardBody.querySelector(
      `tr[data-category="upperSum"] td[data-player-index="${playerIndex}"]`
    );
    if (upperSumCell) upperSumCell.textContent = upperSum;

    const bonusCell = scoreboardBody.querySelector(
      `tr[data-category="bonus"] td[data-player-index="${playerIndex}"]`
    );
    const bonus = upperSum >= 63 ? 35 : 0;
    if (bonusCell) bonusCell.textContent = bonus;
    totalSum += bonus;

    const totalCell = scoreboardBody.querySelector(
      `tr[data-category="total"] td[data-player-index="${playerIndex}"]`
    );
    if (totalCell) totalCell.textContent = totalSum;
  });
}

function updateScoreboardClickability(enable) {
  if (!gameState) return;
  const playerIndex = gameState.currentPlayer;
  categories.forEach((category) => {
    const cell = scoreboardBody.querySelector(
      `tr[data-category="${category}"] td[data-player-index="${playerIndex}"]`
    );
    if (!cell) return;
    cell.removeEventListener('click', handleCategoryClick);
    cell.removeEventListener('keydown', handleCategoryKeydown);
    cell.classList.remove('available');
    cell.tabIndex = -1;

    if (enable && !gameState.players[playerIndex].used[category]) {
      cell.addEventListener('click', handleCategoryClick);
      cell.addEventListener('keydown', handleCategoryKeydown);
      cell.classList.add('available');
      cell.tabIndex = 0;
    }
  });
}

function handleCategoryKeydown(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    event.currentTarget?.click();
  }
}

function openManualEntry(category) {
  pendingManualCategory = category;
  manualCategoryLabel.textContent = getCategoryLabel(category);
  manualScoreInput.value = '';
  manualScoreInput.classList.remove('invalid');
  manualScoreError.textContent = '';
  manualDialog.showModal();
  setTimeout(() => manualScoreInput.focus(), 50);
}

function handleManualSubmit(event) {
  event.preventDefault();
  if (!pendingManualCategory || !gameState) {
    manualDialog.close('cancel');
    return;
  }
  const value = parseInt(manualScoreInput.value, 10);
  if (Number.isNaN(value) || value < 0 || value > 300) {
    manualScoreError.textContent = 'Bitte eine Zahl zwischen 0 und 300 eingeben.';
    manualScoreInput.classList.add('invalid');
    return;
  }
  manualDialog.close('confirm');
  const category = pendingManualCategory;
  pendingManualCategory = null;
  applyScore(category, value, true);
}

function applyScore(category, score, isManual = false) {
  if (!gameState) return;
  const playerIndex = gameState.currentPlayer;
  gameState.players[playerIndex].scores[category] = score;
  gameState.players[playerIndex].used[category] = true;
  updateScoreboardUI();
  updateScoreboardClickability(false);
  const label = getCategoryLabel(category);
  const prefix = isManual ? 'Manuell ' : '';
  const playerName = gameState.players[playerIndex].name;
  updateMessage(`${playerName}: ${prefix}${score} Punkte für ${label}.`);
  nextTurn();
}

function handleCategoryClick(event) {
  if (!gameState || gameState.turnPhase !== 'selectCategory') {
    return;
  }
  const category = event.currentTarget.closest('tr')?.dataset.category;
  if (!category || gameState.players[gameState.currentPlayer].used[category]) {
    return;
  }

  if (manualModeCheckbox.checked) {
    openManualEntry(category);
    return;
  }

  if (gameState.dice.some((d) => d === null)) {
    updateMessage('Bitte zuerst würfeln!', true);
    return;
  }
  const score = calculateScore(category, gameState.dice);
  applyScore(category, score, false);
}

function endTurn() {
  if (!gameState || gameState.turnPhase !== 'roll' || gameState.rollsLeft === 3 || gameState.gameOver) {
    if (gameState && gameState.turnPhase === 'roll' && gameState.rollsLeft === 3) {
      updateMessage('Bitte zunächst würfeln.', true);
    }
    return;
  }
  setTurnPhase('selectCategory');
}

function nextTurn() {
  if (!gameState || checkGameOver()) {
    return;
  }
  gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;
  gameState.rollsLeft = 3;
  gameState.held = Array(5).fill(false);
  gameState.dice = Array(5).fill(null);
  createDiceUI();
  setTurnPhase('roll');
}

function checkGameOver() {
  if (!gameState) return false;
  const finished = gameState.players.every((player) => categories.every((cat) => player.used[cat]));
  if (finished) {
    gameState.gameOver = true;
    setTurnPhase('gameOver');
    return true;
  }
  return false;
}

function determineWinner() {
  if (!gameState) return '';
  const finalScores = gameState.players.map((player) => {
    const upperSum = upperCategories.reduce((sum, cat) => sum + (player.scores[cat] || 0), 0);
    const bonus = upperSum >= 63 ? 35 : 0;
    const total = categories.reduce((sum, cat) => sum + (player.scores[cat] || 0), 0) + bonus;
    return { name: player.name, total };
  });

  finalScores.sort((a, b) => b.total - a.total);
  const winner = finalScores[0];
  const ties = finalScores.filter((score) => score.total === winner.total);
  if (ties.length > 1) {
    return `Unentschieden mit ${winner.total} Punkten (${ties.map((t) => t.name).join(', ')}).`;
  }
  return `${winner.name} gewinnt mit ${winner.total} Punkten!`;
}

function saveGame() {
  if (!gameState) return;
  try {
    const savedGames = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const timestamp = new Date().toLocaleString('de-DE');
    const snapshot = JSON.parse(JSON.stringify(gameState));
    snapshot.timestamp = timestamp;
    savedGames.push(snapshot);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedGames));
    loadSavedGamesList();
    updateMessage('Spiel gespeichert.');
  } catch (error) {
    console.error('Save game error', error);
    updateMessage('Konnte Spiel nicht speichern.', true);
  }
}

function loadSavedGamesList() {
  try {
    const savedGames = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    savedGamesSelect.innerHTML = '';
    if (savedGames.length === 0) {
      const option = document.createElement('option');
      option.textContent = 'Keine Spiele';
      option.disabled = true;
      savedGamesSelect.appendChild(option);
      loadGameBtn.disabled = true;
      deleteGameBtn.disabled = true;
      return;
    }

    savedGames.slice().reverse().forEach((game, reverseIndex) => {
      const originalIndex = savedGames.length - 1 - reverseIndex;
      const option = document.createElement('option');
      option.value = originalIndex.toString();
      let playerInfo = '';
      if (Array.isArray(game.players) && game.players.length > 0) {
        const preview = game.players.map((p) => p.name).slice(0, 2).join(', ');
        playerInfo = `(${game.players.length} Spieler: ${preview}${game.players.length > 2 ? '…' : ''})`;
      }
      const infoText = game.timestamp ? `Spiel vom ${game.timestamp}` : `Spiel ${originalIndex + 1}`;
      option.textContent = [infoText, playerInfo].filter(Boolean).join(' ');
      savedGamesSelect.appendChild(option);
    });
    loadGameBtn.disabled = false;
    deleteGameBtn.disabled = false;
  } catch (error) {
    console.error('Load list error', error);
    localStorage.removeItem(STORAGE_KEY);
    updateMessage('Fehler beim Laden der gespeicherten Spiele.', true);
  }
}

function loadGame() {
  try {
    const savedGames = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const index = parseInt(savedGamesSelect.value, 10);
    if (Number.isNaN(index) || !savedGames[index]) {
      updateMessage('Bitte ein gültiges Spiel auswählen.', true);
      return;
    }
    gameState = JSON.parse(JSON.stringify(savedGames[index]));
    manualModeCheckbox.checked = Boolean(gameState.manualModeActive);
    rebuildScoreboardStructure(gameState.players);
    updateScoreboardUI();
    createDiceUI();
    setupSection.classList.add('hidden');
    gameSection.classList.remove('hidden');
    setTurnPhase(gameState.gameOver ? 'gameOver' : gameState.turnPhase);
    saveGameBtn.disabled = Boolean(gameState.gameOver);
    updateRollCounter();
    const statusAfterPhase = messageEl.textContent;
    const loadInfo = `Spiel vom ${gameState.timestamp ?? 'Speicherstand'} geladen.`;
    updateMessage(statusAfterPhase ? `${loadInfo} ${statusAfterPhase}` : loadInfo);
  } catch (error) {
    console.error('Load game error', error);
    updateMessage('Fehler beim Laden des Spiels.', true);
  }
}

function deleteGame() {
  try {
    const savedGames = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const index = parseInt(savedGamesSelect.value, 10);
    if (Number.isNaN(index) || !savedGames[index]) {
      updateMessage('Bitte ein gültiges Spiel auswählen.', true);
      return;
    }
    const timestamp = savedGames[index].timestamp || `Spiel ${index + 1}`;
    if (confirm(`Soll das Spiel "${timestamp}" wirklich gelöscht werden?`)) {
      savedGames.splice(index, 1);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedGames));
      loadSavedGamesList();
      updateMessage('Spiel gelöscht.');
    }
  } catch (error) {
    console.error('Delete game error', error);
    updateMessage('Fehler beim Löschen.', true);
  }
}

function handleNewGame() {
  if (!gameSection.classList.contains('hidden')) {
    const confirmReset = confirm('Neues Spiel starten? Nicht gespeicherte Änderungen gehen verloren.');
    if (!confirmReset) {
      return;
    }
  }
  gameState = null;
  setupSection.classList.remove('hidden');
  gameSection.classList.add('hidden');
  playerCountInput.value = 2;
  generatePlayerNameInputs(2);
  setupError.textContent = '';
  updateMessage('');
  updateRollCounter();
}

function handleManualCancel() {
  pendingManualCategory = null;
  manualDialog.close('cancel');
  if (gameState && gameState.turnPhase === 'selectCategory') {
    const playerName = gameState.players[gameState.currentPlayer]?.name || 'Spieler';
    updateMessage(`${playerName}: Manuelle Eingabe abgebrochen.`);
  }
}

playerCountInput.addEventListener('input', handlePlayerCountChange);
startGameBtn.addEventListener('click', () => {
  if (!validatePlayerNames()) {
    setupError.textContent = 'Bitte korrigiere die markierten Felder.';
    return;
  }
  const names = Array.from(playerNamesContainer.querySelectorAll('input[type="text"]')).map((input, index) => {
    const trimmed = input.value.trim();
    return trimmed || `Spieler ${index + 1}`;
  });
  startGame(names);
});

rollBtn.addEventListener('click', rollDice);
endTurnBtn.addEventListener('click', endTurn);
saveGameBtn.addEventListener('click', saveGame);
loadGameBtn.addEventListener('click', loadGame);
deleteGameBtn.addEventListener('click', deleteGame);
newGameBtn.addEventListener('click', handleNewGame);
manualModeCheckbox.addEventListener('change', () => {
  if (gameState) {
    gameState.manualModeActive = manualModeCheckbox.checked;
    if (gameState.turnPhase === 'selectCategory') {
      setTurnPhase('selectCategory');
    }
  }
});

manualForm.addEventListener('submit', handleManualSubmit);
manualCancelBtn.addEventListener('click', handleManualCancel);
manualScoreInput.addEventListener('input', () => {
  manualScoreInput.classList.remove('invalid');
  manualScoreError.textContent = '';
});
manualDialog.addEventListener('close', () => {
  manualScoreInput.value = '';
  manualScoreInput.classList.remove('invalid');
  manualScoreError.textContent = '';
  if (manualDialog.returnValue !== 'confirm') {
    pendingManualCategory = null;
  }
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener('click', async () => {
  if (!deferredInstallPrompt) {
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js')
      .then((registration) => {
        console.log('Service Worker registriert:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker Fehler:', error);
      });
  });
}

function initializeApp() {
  setupSection.classList.remove('hidden');
  gameSection.classList.add('hidden');
  const initialCount = parseInt(playerCountInput.value, 10) || 2;
  generatePlayerNameInputs(initialCount);
  loadSavedGamesList();
  updateMessage('');
  updateRollCounter();
}

initializeApp();
