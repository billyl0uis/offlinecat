/*
  =====================================================================
  OFFLINE CAT — a cat-themed clone of Chrome's "no internet" dino game
  =====================================================================

  How the game works, in one paragraph:
  Every frame (~60 times a second) we (1) figure out how much time has
  passed, (2) UPDATE the positions of everything using that time,
  (3) check for collisions, and (4) DRAW everything onto the canvas.
  This "update then draw, forever" cycle is called the GAME LOOP.
*/

// ---------------------------------------------------------------------
// 1. ASSETS (your cat images)
// ---------------------------------------------------------------------

/*
  Put your images in the "assets" folder with these exact names,
  or change the paths below to match your file names.
  If an image is missing, the game draws a simple placeholder cat
  instead, so the game still works before you have your art ready.
*/
const PLAYER_IMAGE_PATH = 'assets/player-cat.png';
const OBSTACLE_IMAGE_PATH = 'assets/obstacle-cat.png';

const playerImg = new Image();
playerImg.src = PLAYER_IMAGE_PATH;

const obstacleImg = new Image();
obstacleImg.src = OBSTACLE_IMAGE_PATH;

/*
  An image is only safe to draw once it has finished loading successfully.
  - img.complete is true when the browser is done trying (success OR failure).
  - img.naturalWidth is 0 if loading failed (e.g. file not found).
  So both must be true for the image to be usable.
*/
function isImageReady(img) {
  return img.complete && img.naturalWidth > 0;
}

// ---------------------------------------------------------------------
// 2. SETTINGS (tweak these to change how the game feels)
// ---------------------------------------------------------------------

/*
  All speeds are in PIXELS PER SECOND, not pixels per frame.
  This matters: some screens refresh 60 times a second, others 120 or 144.
  If we moved things "5 pixels per frame", the game would run twice as
  fast on a 120Hz screen. Using seconds keeps it the same everywhere.
*/
const GRAVITY = 2400;            // how fast the cat is pulled down (px/s²)
const JUMP_VELOCITY = 850;       // upward speed at the start of a jump (px/s)
const START_SPEED = 350;         // how fast obstacles move at first (px/s)
const SPEED_PER_POINT = 12;      // extra speed added for every point scored
const MAX_SPEED = 900;           // speed never goes above this
const GROUND_HEIGHT = 30;        // thickness of the ground strip at the bottom

/*
  Hitboxes are shrunk a little compared to the drawn picture.
  Cat images have transparent corners, and a crash where the pixels
  clearly didn't touch feels unfair. 0.15 = trim 15% from each side.
*/
const HITBOX_SHRINK = 0.15;

// Where we store the best score in the browser between visits
const HIGH_SCORE_KEY = 'offlinecat-high-score';

// ---------------------------------------------------------------------
// 3. GRABBING THE HTML ELEMENTS
// ---------------------------------------------------------------------

const canvas = document.getElementById('game-canvas');

/*
  The "context" is the object we actually draw with.
  '2d' gives us functions like fillRect, drawImage, fillText, etc.
*/
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const finalScoreEl = document.getElementById('final-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');

// The y-coordinate of the top of the ground. Canvas y=0 is the TOP of
// the canvas and y grows DOWNWARD, which is the opposite of math class.
const GROUND_Y = canvas.height - GROUND_HEIGHT;

// ---------------------------------------------------------------------
// 4. THE PLAYER CLASS
// ---------------------------------------------------------------------

/*
  A "class" is a blueprint. It bundles data (position, speed) with the
  functions that use that data (jump, update, draw).
*/
class Player {
  constructor() {
    this.width = 50;
    this.height = 50;
    this.x = 60;                         // the player never moves left/right
    this.y = GROUND_Y - this.height;     // start standing on the ground
    this.velocityY = 0;                  // vertical speed; negative = moving up
  }

  // True when the cat's feet are touching the ground
  isOnGround() {
    return this.y >= GROUND_Y - this.height;
  }

  jump() {
    // Only allow jumping from the ground (no double jumps / flying)
    if (this.isOnGround()) {
      this.velocityY = -JUMP_VELOCITY;   // negative because "up" is -y on a canvas
    }
  }

  /*
    Basic physics, run every frame:
      - gravity changes the velocity
      - velocity changes the position
    dt ("delta time") is the number of seconds since the last frame,
    usually about 0.016 (1/60th of a second).
  */
  update(dt) {
    this.velocityY += GRAVITY * dt;
    this.y += this.velocityY * dt;

    // Stop at the ground instead of falling through it
    if (this.isOnGround()) {
      this.y = GROUND_Y - this.height;
      this.velocityY = 0;
    }
  }

  draw() {
    if (isImageReady(playerImg)) {
      ctx.drawImage(playerImg, this.x, this.y, this.width, this.height);
    } else {
      drawPlaceholderCat(this.x, this.y, this.width, this.height, '#e07a2f', false);
    }
  }

  // The rectangle we use for collision checks (smaller than the picture)
  getHitbox() {
    return shrinkRect(this.x, this.y, this.width, this.height, HITBOX_SHRINK);
  }
}

// ---------------------------------------------------------------------
// 5. THE OBSTACLE CLASS
// ---------------------------------------------------------------------

class Obstacle {
  constructor() {
    // Random sizes so every obstacle cat isn't identical
    this.width = randomBetween(35, 50);
    this.height = randomBetween(35, 55);
    this.x = canvas.width;                 // start just off the right edge
    this.y = GROUND_Y - this.height;       // sit on the ground
    this.passed = false;                   // becomes true once the player clears it
  }

  // Move left. Faster game speed = bigger step each frame.
  update(dt, speed) {
    this.x -= speed * dt;
  }

  draw() {
    if (isImageReady(obstacleImg)) {
      ctx.drawImage(obstacleImg, this.x, this.y, this.width, this.height);
    } else {
      drawPlaceholderCat(this.x, this.y, this.width, this.height, '#7a7f87', true);
    }
  }

  // True once the obstacle has completely left the screen on the left
  isOffScreen() {
    return this.x + this.width < 0;
  }

  getHitbox() {
    return shrinkRect(this.x, this.y, this.width, this.height, HITBOX_SHRINK);
  }
}

// ---------------------------------------------------------------------
// 6. HELPER FUNCTIONS
// ---------------------------------------------------------------------

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// Returns a smaller rectangle centered inside the original one
function shrinkRect(x, y, width, height, amount) {
  const dx = width * amount;
  const dy = height * amount;
  return { x: x + dx, y: y + dy, width: width - dx * 2, height: height - dy * 2 };
}

/*
  Collision detection using "AABB" (Axis-Aligned Bounding Boxes).
  Two rectangles overlap if they overlap BOTH horizontally AND vertically.
  If there is a gap on either axis, they are not touching.
*/
function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/*
  A simple cat made of shapes, used until you add real images.
  facingLeft flips the face so obstacle cats look toward the player.
*/
function drawPlaceholderCat(x, y, w, h, color, facingLeft) {
  ctx.fillStyle = color;

  // Body
  ctx.fillRect(x, y + h * 0.3, w, h * 0.7);

  // Two triangle ears
  ctx.beginPath();
  ctx.moveTo(x + w * 0.1, y + h * 0.3);
  ctx.lineTo(x + w * 0.25, y);
  ctx.lineTo(x + w * 0.4, y + h * 0.3);
  ctx.moveTo(x + w * 0.6, y + h * 0.3);
  ctx.lineTo(x + w * 0.75, y);
  ctx.lineTo(x + w * 0.9, y + h * 0.3);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#ffffff';
  const eyeY = y + h * 0.45;
  const eyeSize = Math.max(3, w * 0.1);
  const offset = facingLeft ? -w * 0.08 : w * 0.08;
  ctx.fillRect(x + w * 0.28 + offset, eyeY, eyeSize, eyeSize);
  ctx.fillRect(x + w * 0.62 + offset, eyeY, eyeSize, eyeSize);
}

// localStorage can throw in private browsing or if storage is blocked,
// so we wrap it in try/catch. If it fails, the high score just won't be saved.
function loadHighScore() {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  } catch (error) {
    return 0;
  }
}

function saveHighScore(value) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(value));
  } catch (error) {
    // Ignore — saving the high score is a nice-to-have, not essential
  }
}

// ---------------------------------------------------------------------
// 7. GAME STATE
// ---------------------------------------------------------------------

/*
  The game is always in exactly one of three states:
    'start'    - showing the start screen, nothing moving
    'playing'  - the game is running
    'gameover' - the player crashed, showing the game over screen
  Checking this variable tells every part of the code what it should do.
*/
let gameState = 'start';

let player = new Player();
let obstacles = [];
let score = 0;
let highScore = loadHighScore();
let speed = START_SPEED;
let distanceUntilNextObstacle = 0;
let groundOffset = 0;         // used to scroll the ground pattern
let lastTimestamp = 0;        // time of the previous frame, for delta time
let gameOverTime = 0;         // used to ignore key presses right after crashing

highScoreEl.textContent = highScore;

/*
  How far apart obstacles are, in pixels.
  The cat spends a fixed amount of TIME in the air per jump.
  At higher speeds the world moves further during that time, so the
  gap must grow with speed or the game becomes literally impossible.
*/
function pickNextObstacleDistance() {
  const timeInAir = (2 * JUMP_VELOCITY) / GRAVITY;   // seconds for a full jump
  const minGap = speed * timeInAir + 120;            // room to land and jump again
  return randomBetween(minGap, minGap + 350);
}

function startGame() {
  // Guard: if we're already playing, do nothing. This prevents a double
  // start when, for example, Space both "clicks" the button and triggers keydown.
  if (gameState === 'playing') return;

  player = new Player();
  obstacles = [];
  score = 0;
  speed = START_SPEED;
  distanceUntilNextObstacle = 200;   // short wait before the first obstacle
  scoreEl.textContent = score;

  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');

  // Move keyboard focus off the button, so pressing Space doesn't
  // "click" the hidden button again while playing
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  gameState = 'playing';
}

function endGame() {
  gameState = 'gameover';
  gameOverTime = performance.now();

  if (score > highScore) {
    highScore = score;
    highScoreEl.textContent = highScore;
    saveHighScore(highScore);
  }

  finalScoreEl.textContent = score;
  gameOverScreen.classList.remove('hidden');
  restartButton.focus();
}

// ---------------------------------------------------------------------
// 8. UPDATE — move everything and apply the game rules
// ---------------------------------------------------------------------

function update(dt) {
  player.update(dt);

  // Spawn a new obstacle once the world has scrolled far enough
  distanceUntilNextObstacle -= speed * dt;
  if (distanceUntilNextObstacle <= 0) {
    obstacles.push(new Obstacle());
    distanceUntilNextObstacle = pickNextObstacleDistance();
  }

  const playerBox = player.getHitbox();

  for (const obstacle of obstacles) {
    obstacle.update(dt, speed);

    // Crash check
    if (rectsOverlap(playerBox, obstacle.getHitbox())) {
      endGame();
      return;
    }

    // Once an obstacle is fully behind the player, count it as cleared
    if (!obstacle.passed && obstacle.x + obstacle.width < player.x) {
      obstacle.passed = true;
      score += 1;
      scoreEl.textContent = score;

      // Difficulty scaling: every point makes the game a little faster
      speed = Math.min(START_SPEED + score * SPEED_PER_POINT, MAX_SPEED);
    }
  }

  // Throw away obstacles that are off screen so the array doesn't grow forever
  obstacles = obstacles.filter((obstacle) => !obstacle.isOffScreen());

  // Scroll the ground pattern at the same speed as the obstacles
  groundOffset = (groundOffset + speed * dt) % 40;
}

// ---------------------------------------------------------------------
// 9. DRAW — paint the current frame onto the canvas
// ---------------------------------------------------------------------

function drawGround() {
  // Solid line where the cats stand
  ctx.fillStyle = '#b9ae9f';
  ctx.fillRect(0, GROUND_Y, canvas.width, 2);

  // Little dashes that scroll left, so the ground looks like it's moving
  ctx.fillStyle = '#d9d2c7';
  for (let x = -groundOffset; x < canvas.width; x += 40) {
    ctx.fillRect(x, GROUND_Y + 10, 14, 2);
  }
}

function draw() {
  /*
    clearRect wipes the whole canvas. Without this, every frame would be
    painted on top of the last one and moving things would leave smears.
  */
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawGround();
  for (const obstacle of obstacles) {
    obstacle.draw();
  }
  player.draw();
}

// ---------------------------------------------------------------------
// 10. THE GAME LOOP
// ---------------------------------------------------------------------

/*
  requestAnimationFrame(fn) asks the browser: "call fn right before you
  next repaint the screen." It is better than setInterval because:
    - it syncs with the monitor's refresh, so motion is smooth
    - it pauses automatically when the tab is hidden, saving battery
  The browser passes fn a timestamp in milliseconds, which we use for dt.
*/
function gameLoop(timestamp) {
  // Seconds since the last frame. On the very first frame there is no
  // previous one, so use 0.
  let dt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
  lastTimestamp = timestamp;

  /*
    If you switch tabs and come back, dt could be several seconds, and the
    cat would teleport through obstacles. Capping it avoids that.
  */
  dt = Math.min(dt, 0.05);

  if (gameState === 'playing') {
    update(dt);
  }
  draw();   // draw in every state, so the start/game over screens have a scene behind them

  requestAnimationFrame(gameLoop);   // schedule the next frame
}

// ---------------------------------------------------------------------
// 11. INPUT (keyboard, mouse, touch)
// ---------------------------------------------------------------------

/*
  One function decides what "the jump button" means in each state,
  so keyboard and touch behave exactly the same.
*/
function handleAction() {
  if (gameState === 'playing') {
    player.jump();
  } else if (gameState === 'start') {
    startGame();
  } else if (gameState === 'gameover') {
    // Wait a moment after crashing so a jump you were already mashing
    // doesn't instantly restart the game before you see your score.
    if (performance.now() - gameOverTime > 500) {
      startGame();
    }
  }
}

document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' || event.code === 'ArrowUp') {
    // Stop Space/ArrowUp from scrolling the page
    event.preventDefault();
    // Holding a key down fires repeated keydown events; ignore the repeats
    if (event.repeat) return;
    handleAction();
  }
});

/*
  'pointerdown' covers mouse clicks, finger taps and pen input in one event,
  and fires the instant you press (a 'click' only fires on release, which
  feels laggy for a jump).
  We listen on the whole game container, so tapping anywhere on the game
  works, including on the start/game over screens.
*/
document.getElementById('game-container').addEventListener('pointerdown', (event) => {
  // Let the Start/Restart buttons handle their own clicks
  if (event.target.closest('button')) return;
  event.preventDefault();
  handleAction();
});

startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);

// Kick off the loop. It runs forever; gameState decides what happens.
requestAnimationFrame(gameLoop);
