"use strict";

// Board settings are kept in one place so the grid is easy to customize.
const GRID_SIZE = 20;
const STARTING_SNAKE = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 }
];
const DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, S: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, D: { x: 1, y: 0 }
};

const board = document.querySelector("#game-board");
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

let snake;
let food;
let direction;
let nextDirection;
let score;
let bestScore = Number(localStorage.getItem("snakeBestScore")) || 0;
let timerId = null;
let gameStarted = false;
let paused = false;
let gameOver = false;
let touchStart = null;

bestScoreElement.textContent = bestScore;

function resetGame() {
  clearInterval(timerId);
  timerId = null;
  snake = STARTING_SNAKE.map(segment => ({ ...segment }));
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
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
  // Starting after a collision creates a fresh round automatically.
  if (gameOver) resetGame();
  gameStarted = true;
  paused = false;
  startButton.disabled = true;
  pauseButton.disabled = false;
  hideMessage();
  board.focus();
  timerId = setInterval(gameLoop, 115);
}

function gameLoop() {
  direction = nextDirection;
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

  // A wall collision ends the game before the snake is moved.
  if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
    endGame();
    return;
  }

  const ateFood = head.x === food.x && head.y === food.y;
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
    // This can only happen after every cell on the board is filled.
    if (!food) {
      drawBoard();
      endGame(true);
      return;
    }
  } else {
    snake.pop();
  }
  drawBoard();
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

function drawBoard() {
  const snakeCells = new Set(snake.map(segment => `${segment.x},${segment.y}`));
  let cells = "";
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      let classes = "cell";
      if (x === food.x && y === food.y) classes += " food";
      if (snakeCells.has(`${x},${y}`)) classes += x === snake[0].x && y === snake[0].y ? " snake snake-head" : " snake";
      cells += `<div class="${classes}" role="gridcell"></div>`;
    }
  }
  board.innerHTML = cells;
}

function setDirection(newDirection) {
  // Prevent the snake from making an immediate 180-degree turn.
  if (newDirection.x === -direction.x && newDirection.y === -direction.y) return;
  nextDirection = newDirection;
}

function togglePause() {
  if (!gameStarted) return;
  paused = !paused;
  pauseButton.textContent = paused ? "Resume" : "Pause";
  if (paused) {
    clearInterval(timerId);
    showMessage("PAUSED", "Take a breath", "Press Resume when you're ready.");
  } else {
    hideMessage();
    timerId = setInterval(gameLoop, 115);
    board.focus();
  }
}

function endGame(won = false) {
  clearInterval(timerId);
  timerId = null;
  gameStarted = false;
  paused = false;
  gameOver = true;
  updateBestScore();
  startButton.textContent = "Start New Game";
  startButton.disabled = false;
  pauseButton.disabled = true;
  pauseButton.textContent = "Pause";
  showMessage(
    won ? "YOU WIN" : "GAME OVER",
    won ? "Board cleared!" : "Nice try!",
    won ? "You filled every square on the board." : "Avoid the walls and your own tail.",
    `Final score: ${score}`
  );
}

function updateBestScore() {
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("snakeBestScore", bestScore);
    bestScoreElement.textContent = bestScore;
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
  const newDirection = DIRECTIONS[event.key];
  if (newDirection) {
    event.preventDefault();
    setDirection(newDirection);
    if (!gameStarted && !paused) startGame();
  } else if (event.key === " ") {
    event.preventDefault();
    togglePause();
  }
});

board.addEventListener("touchstart", event => {
  const touch = event.changedTouches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });

board.addEventListener("touchend", event => {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  setDirection(Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) });
  if (!gameStarted && !paused) startGame();
}, { passive: true });

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", resetGame);

resetGame();
