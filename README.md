# Snake Game

A small, responsive browser version of the classic Snake game. It is built with plain HTML, CSS, and JavaScript—there is no build step, package manager, or framework.

## Features

- Arrow-key and WASD controls
- Touch swipe controls for phones and tablets
- Start, pause/resume, and restart controls
- Levels every five apples, with automatic speed increases from 130 ms to 70 ms per step
- Countdown before each round and after resuming from a pause
- Synthesized arcade sounds with a mute toggle (on by default)
- Score and persistent best score (saved in the browser)
- Games-played count and new-best feedback
- Wall and self-collision detection
- Game-over and board-cleared states
- Responsive, accessible interface

## Controls

- Steer with the arrow keys or WASD. On mobile, swipe on the game board.
- Tap the message or press `Enter` or `Space` to start a ready game.
- Press `P`, `Esc`, or `Space` to pause and resume while playing.
- Use **Restart** to begin a fresh round at any time.
- Sound is on by default and can be muted with the speaker button.

## Run locally

Download or clone the project, then open `index.html` in a current web browser.

For a local development server, if Python is installed, run this from the project folder:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Project structure

```text
.
├── index.html   # Page structure and controls
├── style.css    # Responsive visual design
├── script.js    # Game state, input, rendering, and scoring
├── LICENSE      # MIT license
└── README.md    # Project documentation
```

## Publish with GitHub Pages

1. Push this repository to GitHub.
2. In the repository, open **Settings** → **Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose the `main` branch and the `/ (root)` folder, then save.
5. GitHub will show the public `github.io` address after deployment completes.

## Custom domain

After GitHub Pages is live, add your domain in **Settings** → **Pages** → **Custom domain**. GitHub will provide the exact DNS record to add at your domain registrar. Enable **Enforce HTTPS** once DNS has propagated.

Do not add a `CNAME` file until a domain has been chosen and verified.
