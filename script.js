"use strict";

// Board settings are kept in one place so the grid is easy to customize.
const GRID_SIZE = 20;
const STARTING_SNAKE = [
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

const motionPreference = window.matchMedia
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : { matches: false };
const MOVEMENT_ANIMATION_MS = 105;

let snake;
let food;
let direction;
// Keep only a couple of upcoming turns so quick inputs are not lost.
let directionQueue = [];
let score;
let bestScore = loadBestScore();
let timerId = null;
let gameStarted = false;
let paused = false;
let gameOver = false;
let touchStart = null;
let gameOverRestartTimer = null;
let segmentElements = [];
const movementAnimations = new Map();
let foodEffectAnimation = null;

bestScoreElement.textContent = bestScore;

function resetGame() {
  clearInterval(timerId);
  clearTimeout(gameOverRestartTimer);
  timerId = null;
  gameOverRestartTimer = null;
  cancelAnimations();
  snake = STARTING_SNAKE.map(segment => ({ ...segment }));
  direction = { x: 1, y: 0 };
  directionQueue = [];
  score = 0;
  food = createFood();
  gameStarted = false;
  paused = false;
  gameOver = false;
  scoreElement.textContent = score;
  startButton.textContent = "Start Game";
  startButton.disabled = false;
  pauseButton.textContent = "Pause";
  pauseButton.disabled = true;
  showMessage("READY?", "Let's play", "Use arrow keys, WASD, or swipe to guide the snake.");
  drawBoard();
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
  hideMessage();
  board.focus();
  startTimer();
}

function startTimer() {
  // Clearing first guarantees that resume cannot create a second game loop.
  clearInterval(timerId);
  timerId = setInterval(gameLoop, 115);
}

function gameLoop() {
  // A queued direction is consumed once per movement step.
  if (!gameStarted || paused) return;
  const previousSnake = snake.map(segment => ({ ...segment }));
  direction = directionQueue.shift() || direction;
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
    playFoodCollectionEffect(collectedFood);
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
        { duration: MOVEMENT_ANIMATION_MS, easing: "linear", fill: "forwards" }
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

function pauseAnimations() {
  movementAnimations.forEach(animation => {
    if (animation.playState === "running" || animation.playState === "pending") animation.pause();
  });
  if (foodEffectAnimation && (foodEffectAnimation.playState === "running" || foodEffectAnimation.playState === "pending")) {
    foodEffectAnimation.pause();
  }
}

function resumeAnimations() {
  movementAnimations.forEach(animation => {
    if (animation.playState === "paused") animation.play();
  });
  if (foodEffectAnimation?.playState === "paused") foodEffectAnimation.play();
}

function cancelAnimations() {
  movementAnimations.forEach(animation => animation.cancel());
  movementAnimations.clear();
  foodEffectAnimation?.cancel();
  foodEffectAnimation = null;
}

function setDirection(newDirection) {
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
    hideMessage();
    resumeAnimations();
    startTimer();
    board.focus();
  } else {
    pauseGame();
  }
}

function pauseGame() {
  if (!gameStarted || paused) return;
  paused = true;
  clearInterval(timerId);
  timerId = null;
  pauseAnimations();
  pauseButton.textContent = "Resume";
  showMessage("PAUSED", "Take a breath", "Press Resume when you're ready.");
}

function endGame(won = false) {
  clearInterval(timerId);
  clearTimeout(gameOverRestartTimer);
  timerId = null;
  gameOverRestartTimer = null;
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

function showMessage(kicker, title, text, scoreText = "") {
  messageKicker.textContent = kicker;
  messageTitle.textContent = title;
  messageText.textContent = text;
  finalScore.hidden = !scoreText;
  finalScore.textContent = scoreText;
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

  const newDirection = DIRECTIONS[event.code];
  if (newDirection) {
    event.preventDefault();
    handleDirectionInput(newDirection);
  } else if (event.key === " " || event.code === "Space") {
    event.preventDefault();
    togglePause();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseGame();
});

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

resetGame();
