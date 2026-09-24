# Offline Cat

A cat-themed clone of Chrome's "No internet" dino game, built with plain HTML, CSS and JavaScript (no frameworks, no build step).

## Play it locally

Open `index.html` in your browser. That's it.

## Controls

- **Space** or **↑**: jump
- **Tap/click** the game: jump (works on phones)

## Adding your own cat images

Put two images in the `assets/` folder:

| File | What it is |
| --- | --- |
| `assets/player-cat.png` | The cat you control |
| `assets/obstacle-cat.png` | The cats you jump over |

PNGs with transparent backgrounds look best. Until you add them, the game draws simple placeholder cats so it still works.
To use different file names, change `PLAYER_IMAGE_PATH` and `OBSTACLE_IMAGE_PATH` at the top of `game.js`.

## Files

- `index.html`: page structure (canvas, score, start/game over screens)
- `style.css`: layout and colors
- `game.js`: all the game logic (game loop, `Player` and `Obstacle` classes, collisions, scoring, input)

## Tuning the difficulty

The constants near the top of `game.js` (`GRAVITY`, `JUMP_VELOCITY`, `START_SPEED`, `SPEED_PER_POINT`, `MAX_SPEED`) control how the game feels.

## Hosting on GitHub Pages

1. Go to the repo's **Settings → Pages**.
2. Under "Build and deployment", choose **Deploy from a branch**, pick `main` and `/ (root)`, then save.
3. After a minute or two the game is live at `https://<your-username>.github.io/offlinecat/`.

Note: on a free GitHub account, Pages only works for **public** repositories.
