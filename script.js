"use strict";

// Board settings are kept in one place so the grid is easy to customize.
const GRID_SIZE = 20;
const APPLES_PER_LEVEL = 5;
const STARTING_STEP_MS = 130;
const MIN_STEP_MS = 70;
const STEP_REDUCTION_PER_LEVEL = 10;
const ROUND_COUNTDOWN_SECONDS = 3;
const RESUME_COUNTDOWN_SECONDS = 2;
const STARTING_SNAKE = [
  // This centered spawn gives the player the longest safe opening runway.
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 }
];
const DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 }, KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 }, KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 }
};
const board = document.querySelector("#game-board");
const boardContainer = board.parentElement;
const scoreElement = document.querySelector("#score");
const bestScoreElement = document.querySelector("#best-score");
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");
const overlay = document.querySelector("#message-overlay");
const messageKicker = document.querySelector("#message-kicker");
const messageTitle = document.querySelector("#message-title");
const messageText = document.querySelector("#message-text");
const finalScore = document.querySelector("#final-score");
const foodElement = document.querySelector("#food");
const snakeLayer = document.querySelector("#snake-layer");
const foodEffectElement = document.querySelector("#food-effect");
const soundButton = document.querySelector("#sound-button");
const soundLabel = document.querySelector("#sound-label");
const levelElement = document.querySelector("#level");
const newBestMessage = document.querySelector("#new-best-message");
const resultDetails = document.querySelector("#result-details");

const motionPreference = window.matchMedia
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : { matches: false };
const MOVEMENT_ANIMATION_MS = 105;

let snake;
let food;
let direction;
// Keep only a couple of upcoming turns so quick inputs are not lost.
let directionQueue = [];
let hasMoved = false;
let openingDirectionChosen = false;
let score;
let level = 1;
let timerId = null;
let countdownTimerId = null;
let gameStarted = false;
let paused = false;
let gameOver = false;
let countdownActive = false;
let countdownValue = 0;
let touchStart = null;
let gameOverRestartTimer = null;
let roundCounted = false;
let segmentElements = [];
const movementAnimations = new Map();
const feedbackAnimations = new Map();
let foodEffectAnimation = null;
let soundEnabled = loadSoundPreference();
let bestScore = loadBestScore();
let gamesPlayed = loadGamesPlayed();
let audioContext = null;
let newBestThisRun = false;
let foodPopAnimation = null;

bestScoreElement.textContent = bestScore;
levelElement.textContent = level;
updateSoundButton();

function resetGame() {
  clearInterval(timerId);
  clearInterval(countdownTimerId);
  clearTimeout(gameOverRestartTimer);
  timerId = null;
  countdownTimerId = null;
  gameOverRestartTimer = null;
  countdownActive = false;
  countdownValue = 0;
  cancelAnimations();
  snake = STARTING_SNAKE.map(segment => ({ ...segment }));
  direction = { x: 1, y: 0 };
  directionQueue = [];
  hasMoved = false;
  openingDirectionChosen = false;
  score = 0;
  level = 1;
  food = createFood();
  gameStarted = false;
  paused = false;
  gameOver = false;
  roundCounted = false;
  newBestThisRun = false;
  scoreElement.textContent = score;
  levelElement.textContent = level;
  startButton.textContent = "Start Game";
  startButton.disabled = false;
  pauseButton.textContent = "Pause";
  pauseButton.disabled = true;
  board.classList.remove("crashed");
  showMessage("READY?", "Let's play", "Tap here or press Enter or Space to start. Choose a direction to begin.");
  drawBoard();
  animateFoodPop();
}

function startGame() {
  if (gameStarted) return;
  if (gameOver && startButton.disabled) return;
  // Starting after a collision creates a fresh round automatically.
  if (gameOver) resetGame();
  gameStarted = true;
  paused = false;
  startButton.disabled = true;
  pauseButton.disabled = false;
  board.focus();
  if (soundEnabled) getAudioContext();
  if (!roundCounted) {
    gamesPlayed += 1;
    roundCounted = true;
    saveGamesPlayed();
  }
  beginCountdown(ROUND_COUNTDOWN_SECONDS);
}

function startTimer() {
  // Clearing first guarantees that resume cannot create a second game loop.
  clearInterval(timerId);
  timerId = setInterval(gameLoop, getStepDuration());
}

function getStepDuration() {
  return Math.max(
    MIN_STEP_MS,
    STARTING_STEP_MS - (level - 1) * STEP_REDUCTION_PER_LEVEL
  );
}

function beginCountdown(seconds) {
  clearInterval(timerId);
  clearInterval(countdownTimerId);
  timerId = null;
  countdownActive = true;
  countdownValue = seconds;
  showCountdown();
  countdownTimerId = setInterval(() => {
    if (!gameStarted || paused) return;

    countdownValue -= 1;
    if (countdownValue <= 0) {
      clearInterval(countdownTimerId);
      countdownTimerId = null;
      countdownActive = false;
      hideMessage();
      resumeAnimations();
      startTimer();
      return;
    }

    showCountdown();
  }, 1000);
}

function showCountdown() {
  showMessage("GET READY", String(countdownValue), "The snake moves when the countdown ends.");
  playCountdownSound(countdownValue);
}

function gameLoop() {
  // A queued direction is consumed once per movement step.
  if (!gameStarted || paused) return;
  const previousSnake = snake.map(segment => ({ ...segment }));
  direction = directionQueue.shift() || direction;
  hasMoved = true;
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

  // A wall collision ends the game before the snake is moved.
  if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
    endGame();
    return;
  }

  const ateFood = food !== null && head.x === food.x && head.y === food.y;
  const collectedFood = ateFood ? { ...food } : null;
  // Moving into the current tail is allowed when it will move away this turn.
  const bodyToCheck = ateFood ? snake : snake.slice(0, -1);
  if (bodyToCheck.some(segment => segment.x === head.x && segment.y === head.y)) {
    endGame();
    return;
  }

  snake.unshift(head);
  if (ateFood) {
    score += 1;
    scoreElement.textContent = score;
    updateBestScore();
    food = createFood();
    const previousLevel = level;
    level = Math.floor(score / APPLES_PER_LEVEL) + 1;
    levelElement.textContent = level;
    const leveledUp = level !== previousLevel;
    if (leveledUp) {
      pulseElement(levelElement);
      playLevelUpSound();
      if (gameStarted && !paused && !countdownActive) startTimer();
    }
    playFoodCollectionEffect(collectedFood);
    animateFoodPop();
    if (!leveledUp) playCollectionSound();
    pulseElement(scoreElement);
    // This can only happen after every cell on the board is filled.
    if (!food) {
      drawBoard(previousSnake, true);
      endGame(true);
      return;
    }
  } else {
    snake.pop();
  }
  drawBoard(previousSnake, true);
}

function createFood() {
  const freeCells = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (!snake.some(segment => segment.x === x && segment.y === y)) freeCells.push({ x, y });
    }
  }
  return freeCells.length ? freeCells[Math.floor(Math.random() * freeCells.length)] : null;
}

function drawBoard(previousSnake = null, animateMovement = false) {
  if (food) {
    positionElement(foodElement, food);
    foodElement.hidden = false;
  } else {
    foodElement.hidden = true;
  }

  while (segmentElements.length < snake.length) {
    const segment = document.createElement("div");
    segment.className = "snake-segment";
    snakeLayer.appendChild(segment);
    segmentElements.push(segment);
  }

  while (segmentElements.length > snake.length) {
    const segment = segmentElements.pop();
    movementAnimations.get(segment)?.cancel();
    movementAnimations.delete(segment);
    segment.remove();
  }

  segmentElements.forEach((element, index) => {
    const target = snake[index];
    // Existing segment elements keep their own previous position as the animation start.
    // A new tail has no prior element, so it appears at the old tail's current position.
    const previous = previousSnake
      ? previousSnake[index] || (index === previousSnake.length ? target : null)
      : null;
    const hasMoved = previous && (previous.x !== target.x || previous.y !== target.y);
    element.classList.toggle("snake-head", index === 0);

    movementAnimations.get(element)?.cancel();
    movementAnimations.delete(element);

    if (animateMovement && !motionPreference.matches && hasMoved && typeof element.animate === "function") {
      const fromLeft = `${previous.x * 100 / GRID_SIZE}%`;
      const fromTop = `${previous.y * 100 / GRID_SIZE}%`;
      const toLeft = `${target.x * 100 / GRID_SIZE}%`;
      const toTop = `${target.y * 100 / GRID_SIZE}%`;

      // Collision checks use snake[]; this animation only changes the visual position.
      element.style.left = fromLeft;
      element.style.top = fromTop;
      const animation = element.animate(
        [{ left: fromLeft, top: fromTop }, { left: toLeft, top: toTop }],
        {
          duration: Math.min(MOVEMENT_ANIMATION_MS, getStepDuration() * 0.9),
          easing: "linear",
          fill: "forwards"
        }
      );
      element.style.left = toLeft;
      element.style.top = toTop;
      movementAnimations.set(element, animation);
    } else {
      positionElement(element, target);
    }
  });
}

function positionElement(element, position) {
  element.style.left = `${position.x * 100 / GRID_SIZE}%`;
  element.style.top = `${position.y * 100 / GRID_SIZE}%`;
}

function playFoodCollectionEffect(position) {
  if (motionPreference.matches || typeof foodEffectElement.animate !== "function") return;

  foodEffectAnimation?.cancel();
  positionElement(foodEffectElement, position);
  foodEffectAnimation = foodEffectElement.animate(
    [
      { transform: "scale(0.55)", opacity: 0.9 },
      { transform: "scale(1.8)", opacity: 0 }
    ],
    { duration: 300, easing: "ease-out", fill: "forwards" }
  );
  const currentAnimation = foodEffectAnimation;
  currentAnimation.onfinish = () => {
    if (foodEffectAnimation === currentAnimation) {
      currentAnimation.cancel();
      foodEffectAnimation = null;
    }
  };
}

function animateFoodPop() {
  if (motionPreference.matches || typeof foodElement.animate !== "function" || !food) return;

  foodPopAnimation?.cancel();
  foodPopAnimation = foodElement.animate(
    [
      { transform: "scale(0.35)", opacity: 0 },
      { transform: "scale(1.12)", opacity: 1, offset: 0.72 },
      { transform: "scale(1)", opacity: 1 }
    ],
    { duration: 230, easing: "ease-out" }
  );
  const currentAnimation = foodPopAnimation;
  currentAnimation.onfinish = () => {
    if (foodPopAnimation === currentAnimation) {
      currentAnimation.cancel();
      foodPopAnimation = null;
    }
  };
}

function pauseAnimations() {
  movementAnimations.forEach(animation => {
    if (animation.playState === "running" || animation.playState === "pending") animation.pause();
  });
  feedbackAnimations.forEach(animation => {
    if (animation.playState === "running" || animation.playState === "pending") animation.pause();
  });
  if (foodEffectAnimation && (foodEffectAnimation.playState === "running" || foodEffectAnimation.playState === "pending")) {
    foodEffectAnimation.pause();
  }
  if (foodPopAnimation && (foodPopAnimation.playState === "running" || foodPopAnimation.playState === "pending")) {
    foodPopAnimation.pause();
  }
}

function resumeAnimations() {
  movementAnimations.forEach(animation => {
    if (animation.playState === "paused") animation.play();
  });
  feedbackAnimations.forEach(animation => {
    if (animation.playState === "paused") animation.play();
  });
  if (foodEffectAnimation?.playState === "paused") foodEffectAnimation.play();
  if (foodPopAnimation?.playState === "paused") foodPopAnimation.play();
}

function cancelAnimations() {
  movementAnimations.forEach(animation => animation.cancel());
  movementAnimations.clear();
  feedbackAnimations.forEach(animation => animation.cancel());
  feedbackAnimations.clear();
  foodEffectAnimation?.cancel();
  foodEffectAnimation = null;
  foodPopAnimation?.cancel();
  foodPopAnimation = null;
}

function setDirection(newDirection) {
  // Let the player choose even the reverse of the default heading before movement begins.
  if (!hasMoved && !openingDirectionChosen) {
    direction = { ...newDirection };
    snake = STARTING_SNAKE.map((_, index) => ({
      x: STARTING_SNAKE[0].x - direction.x * index,
      y: STARTING_SNAKE[0].y - direction.y * index
    }));
    if (food && snake.some(segment => segment.x === food.x && segment.y === food.y)) {
      food = createFood();
    }
    openingDirectionChosen = true;
    drawBoard();
    return true;
  }

  // Compare to the last queued turn, or current heading when the queue is empty.
  const lastDirection = directionQueue.length
    ? directionQueue[directionQueue.length - 1]
    : direction;
  const isSameDirection = newDirection.x === lastDirection.x && newDirection.y === lastDirection.y;
  const isReverse = newDirection.x === -lastDirection.x && newDirection.y === -lastDirection.y;

  // Two turns is enough to buffer quick input without building a long backlog.
  if (isReverse || directionQueue.length >= 2) return false;
  if (isSameDirection) return true;
  directionQueue.push({ ...newDirection });
  return true;
}

function handleDirectionInput(newDirection) {
  // Directional input never restarts a game after a collision.
  if (gameOver) return false;

  const accepted = setDirection(newDirection);
  if (!gameStarted && !paused && accepted) startGame();
  return accepted;
}

function togglePause() {
  if (!gameStarted) return;
  if (paused) {
    paused = false;
    pauseButton.textContent = "Pause";
    board.focus();
    beginCountdown(RESUME_COUNTDOWN_SECONDS);
  } else {
    pauseGame();
    board.focus();
  }
}

function pauseGame() {
  if (!gameStarted || paused) return;
  paused = true;
  clearInterval(timerId);
  clearInterval(countdownTimerId);
  timerId = null;
  countdownTimerId = null;
  countdownActive = false;
  pauseAnimations();
  pauseButton.textContent = "Resume";
  showMessage("PAUSED", "Take a breath", "Press Resume or tap here when you're ready.");
}

function endGame(won = false) {
  clearInterval(timerId);
  clearInterval(countdownTimerId);
  clearTimeout(gameOverRestartTimer);
  timerId = null;
  countdownTimerId = null;
  gameOverRestartTimer = null;
  countdownActive = false;
  countdownValue = 0;
  cancelAnimations();
  gameStarted = false;
  paused = false;
  gameOver = true;
  updateBestScore();
  startButton.textContent = "Start New Game";
  startButton.disabled = true;
  pauseButton.disabled = true;
  pauseButton.textContent = "Pause";
  drawBoard();
  if (!won) board.classList.add("crashed");
  playEndSound(won);
  showMessage(
    won ? "YOU WIN" : "GAME OVER",
    won ? "Board cleared!" : "Nice try!",
    won ? "You filled every square on the board." : "Avoid the walls and your own tail.",
    `Final score: ${score}`
  );
  // Briefly ignore input carried over from the collision that ended the run.
  gameOverRestartTimer = setTimeout(() => {
    gameOverRestartTimer = null;
    if (gameOver) startButton.disabled = false;
  }, 600);
}

function updateBestScore() {
  if (score > bestScore) {
    bestScore = score;
    if (gameStarted) newBestThisRun = true;
    bestScoreElement.textContent = bestScore;
    try {
      localStorage.setItem("snakeBestScore", bestScore);
    } catch (error) {
      // Keep the in-memory record even when this browser blocks storage.
    }
  }
}

function loadBestScore() {
  try {
    const storedScore = Number(localStorage.getItem("snakeBestScore"));
    return Number.isFinite(storedScore) && storedScore > 0 ? storedScore : 0;
  } catch (error) {
    // Storage is optional; the game still tracks a best score for this session.
    return 0;
  }
}

function loadGamesPlayed() {
  try {
    const storedCount = Number(localStorage.getItem("snakeGamesPlayed"));
    return Number.isSafeInteger(storedCount) && storedCount > 0 ? storedCount : 0;
  } catch (error) {
    return 0;
  }
}

function saveGamesPlayed() {
  try {
    localStorage.setItem("snakeGamesPlayed", gamesPlayed);
  } catch (error) {
    // The game count still works for this page session.
  }
}

function loadSoundPreference() {
  try {
    return localStorage.getItem("snakeSound") !== "off";
  } catch (error) {
    return true;
  }
}

function updateSoundButton() {
  const audioSupported = Boolean(window.AudioContext || window.webkitAudioContext);
  soundButton.disabled = !audioSupported;
  soundLabel.textContent = audioSupported
    ? `Sound: ${soundEnabled ? "On" : "Off"}`
    : "Sound unavailable";
  soundButton.setAttribute("aria-pressed", String(audioSupported && soundEnabled));
  soundButton.setAttribute("aria-label", audioSupported
    ? (soundEnabled ? "Mute sound" : "Enable sound")
    : "Sound is unavailable in this browser");
}

function getAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return null;

  try {
    if (!audioContext) audioContext = new AudioContextConstructor();
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    return audioContext;
  } catch (error) {
    // Audio is optional; unsupported or blocked audio never interrupts play.
    return null;
  }
}

function playTone(frequency, duration, delay = 0) {
  if (!soundEnabled) return;
  const context = getAudioContext();
  if (!context) return;

  try {
    const startAt = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, startAt);
    volume.gain.setValueAtTime(0.0001, startAt);
    volume.gain.exponentialRampToValueAtTime(0.035, startAt + 0.012);
    volume.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  } catch (error) {
    // Audio errors are non-fatal and never interrupt a game round.
  }
}

function playCollectionSound() {
  playTone(660, 0.08);
  playTone(880, 0.1, 0.06);
}

function playLevelUpSound() {
  playTone(523, 0.09);
  playTone(659, 0.09, 0.08);
  playTone(784, 0.14, 0.16);
}

function playCountdownSound(value) {
  playTone(value === 1 ? 880 : 660, 0.07);
}

function playEndSound(won) {
  if (won) {
    playTone(660, 0.12);
    playTone(880, 0.16, 0.1);
  } else {
    playTone(330, 0.12);
    playTone(220, 0.18, 0.12);
  }
}

function pulseElement(element) {
  if (motionPreference.matches || typeof element.animate !== "function") return;
  feedbackAnimations.get(element)?.cancel();
  const animation = element.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.3)", offset: 0.45 },
      { transform: "scale(1)" }
    ],
    { duration: 220, easing: "ease-out" }
  );
  feedbackAnimations.set(element, animation);
  animation.onfinish = () => {
    if (feedbackAnimations.get(element) === animation) {
      animation.cancel();
      feedbackAnimations.delete(element);
    }
  };
}

function showMessage(kicker, title, text, scoreText = "") {
  messageKicker.textContent = kicker;
  messageTitle.textContent = title;
  messageText.textContent = text;
  finalScore.hidden = !scoreText;
  finalScore.textContent = scoreText;
  newBestMessage.hidden = !(gameOver && newBestThisRun);
  resultDetails.hidden = !scoreText;
  resultDetails.textContent = `Best: ${bestScore} · Games played: ${gamesPlayed}`;
  overlay.classList.toggle("game-over-overlay", kicker === "GAME OVER");
  overlay.classList.remove("hidden");
}

function hideMessage() { overlay.classList.add("hidden"); }

document.addEventListener("keydown", event => {
  // Leave button activation, links, and editable controls to the browser.
  const target = event.target;
  const focusableTarget = target.closest && target.closest(
    "button, a[href], input, select, textarea, summary, [role='button'], [role='link'], [role='textbox'], [role='searchbox'], [role='combobox'], [tabindex]:not([tabindex='-1'])"
  );
  const editableTarget = target.isContentEditable || (target.closest && target.closest(
    "[contenteditable]:not([contenteditable='false'])"
  ));
  const boardHasFocus = focusableTarget === board;
  if ((focusableTarget && !boardHasFocus) || editableTarget || event.altKey || event.ctrlKey || event.metaKey) return;

  const isStateKey = event.code === "Enter" || event.code === "Space"
    || event.code === "KeyP" || event.code === "Escape";
  if (event.repeat && isStateKey) {
    event.preventDefault();
    return;
  }

  if (gameOver) {
    if (event.code === "ArrowUp" || event.code === "ArrowDown" || event.code === "ArrowLeft" || event.code === "ArrowRight") {
      event.preventDefault();
      return;
    }
    if (event.code === "Enter" || event.code === "Space") {
      event.preventDefault();
      if (!startButton.disabled) startGame();
    }
    return;
  }

  if (!gameStarted && (event.code === "Enter" || event.code === "Space")) {
    event.preventDefault();
    startGame();
    return;
  }

  if (event.code === "Space" || event.code === "KeyP" || event.code === "Escape") {
    event.preventDefault();
    togglePause();
    return;
  }

  const newDirection = DIRECTIONS[event.code];
  if (newDirection) {
    event.preventDefault();
    handleDirectionInput(newDirection);
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseGame();
});
window.addEventListener("blur", pauseGame);

function handleMotionPreferenceChange(event) {
  if (!event.matches) return;
  cancelAnimations();
  drawBoard();
}

if (motionPreference.addEventListener) {
  motionPreference.addEventListener("change", handleMotionPreferenceChange);
} else if (motionPreference.addListener) {
  motionPreference.addListener(handleMotionPreferenceChange);
}

boardContainer.addEventListener("touchstart", event => {
  const touch = event.changedTouches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });

boardContainer.addEventListener("touchend", event => {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  handleDirectionInput(
    Math.abs(dx) > Math.abs(dy)
      ? { x: Math.sign(dx), y: 0 }
      : { x: 0, y: Math.sign(dy) }
  );
}, { passive: true });

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", () => {
  resetGame();
  board.focus();
});

overlay.addEventListener("click", () => {
  if (gameOver) {
    if (!startButton.disabled) startGame();
    return;
  }
  if (paused) {
    togglePause();
    return;
  }
  if (!gameStarted) startGame();
});

soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  updateSoundButton();
  try {
    localStorage.setItem("snakeSound", soundEnabled ? "on" : "off");
  } catch (error) {
    // Sound preference still applies until this page is closed.
  }
  if (soundEnabled) getAudioContext();
  if (gameStarted) board.focus();
});

resetGame();
