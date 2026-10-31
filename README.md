# Snake Game

A small, responsive browser version of the classic Snake game. It is built with plain HTML, CSS, and JavaScript—there is no build step, package manager, or framework.

## Features

- Arrow-key and WASD controls
- Touch swipe controls for phones and tablets
- Start, pause/resume, and restart controls
- Score and persistent best score (saved in the browser)
- Wall and self-collision detection
- Game-over and board-cleared states
- Responsive, accessible interface

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
