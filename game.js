// ===== 1. Canvas & basic settings =====
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const WORLD_WIDTH = 2000;
const GROUND_HEIGHT = 40;
const GROUND_Y = canvas.height - GROUND_HEIGHT;

const GRAVITY = 0.5;
const JUMP_POWER = -12;
const MOVE_SPEED = 4;

const PLAYER_NAME = 'Player1'; // change this to your name

// Camera follows the player
let cameraX = 0;

// Level / game state
const MAX_LEVEL = 10;
let currentLevel = 1;
let score = 0;
let levelComplete = false;
let gameComplete = false;

// ===== 2. Base world data (reused for all levels) =====
const basePlatforms = [
  // start area
  { x: 140, y: 220, width: 120, height: 15 },
  { x: 320, y: 190, width: 120, height: 15 },

  // middle
  { x: 550, y: 210, width: 100, height: 15 },
  { x: 720, y: 170, width: 110, height: 15 },
  { x: 900, y: 200, width: 130, height: 15 },

  // late
  { x: 1150, y: 190, width: 100, height: 15 },
  { x: 1350, y: 160, width: 100, height: 15 },
  { x: 1550, y: 210, width: 120, height: 15 },
  { x: 1750, y: 180, width: 120, height: 15 }
];

const baseHazards = [
  { x: 260, y: GROUND_Y - 20, width: 40, height: 20 },
  { x: 630, y: GROUND_Y - 20, width: 40, height: 20 },
  { x: 980, y: GROUND_Y - 20, width: 40, height: 20 },
  { x: 1500, y: GROUND_Y - 20, width: 40, height: 20 }
];

const baseCoins = [
  { x: 220, y: 180, size: 14 },
  { x: 360, y: 150, size: 14 },
  { x: 720, y: 130, size: 14 },
  { x: 950, y: 160, size: 14 },
  { x: 1320, y: 130, size: 14 },
  { x: 1720, y: 140, size: 14 }
];

// Active world data (cloned per level)
let platforms = [];
let hazards = [];
let coins = [];

// Goal (finish flag)
const goal = {
  x: WORLD_WIDTH - 80,
  y: GROUND_Y - 80,
  width: 30,
  height: 80
};

// ===== 3. Player =====
const player = {
  x: 50,
  y: GROUND_Y - 40,
  width: 40,
  height: 40,
  vx: 0,
  vy: 0
};

// ===== 4. Input state =====
let input = {
  left: false,
  right: false,
  jump: false
};

// ===== 5. Keyboard handling =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.right = true;
  if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') input.jump = true;

  // Press R to restart the whole game from level 1
  if (e.key === 'r' || e.key === 'R') {
    restartGame();
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.right = false;
  if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') input.jump = false;
});

// ===== 6. Helpers =====
function cloneLevelData() {
  platforms = basePlatforms.map(p => ({ ...p }));
  hazards = baseHazards.map(h => ({ ...h }));
  coins = baseCoins.map(c => ({ ...c, active: true }));
}

function isOnGround() {
  return player.y + player.height >= GROUND_Y - 0.5;
}

function isOnPlatform() {
  const feetY = player.y + player.height;
  for (const plat of platforms) {
    const withinX =
      player.x + player.width > plat.x &&
      player.x < plat.x + plat.width;
    const closeToTop = Math.abs(feetY - plat.y) < 1;
    if (withinX && closeToTop) {
      return true;
    }
  }
  return false;
}

function canJump() {
  return isOnGround() || isOnPlatform();
}

function resetPlayerOnly() {
  player.x = 50;
  player.y = GROUND_Y - player.height;
  player.vx = 0;
  player.vy = 0;
  cameraX = 0;
}

function resetLevelState() {
  levelComplete = false;
  gameComplete = false;
  resetPlayerOnly();
  cloneLevelData();
}

function restartGame() {
  currentLevel = 1;
  score = 0;
  resetLevelState();
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// send score to Python backend when game is finished
async function sendHighScore() {
  try {
    await fetch('/api/highscores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: PLAYER_NAME,
        score: score,
        level: currentLevel
      })
    });
  } catch (err) {
    console.error('Failed to send high score', err);
  }
}

function advanceToNextLevel() {
  if (currentLevel < MAX_LEVEL) {
    currentLevel += 1;
    resetLevelState();
  } else {
    gameComplete = true;
    levelComplete = true;
    sendHighScore();
  }
}

// ===== 7. Update (logic + physics + camera) =====
function update() {
  if (gameComplete) return;

  const previousY = player.y;

  // Horizontal movement
  if (input.left) player.vx = -MOVE_SPEED;
  else if (input.right) player.vx = MOVE_SPEED;
  else player.vx = 0;

  // Jump (from ground or platform)
  if (input.jump && canJump()) {
    player.vy = JUMP_POWER;
  }

  // Gravity
  player.vy += GRAVITY;

  // Apply velocity
  player.x += player.vx;
  player.y += player.vy;

  // World horizontal limits
  if (player.x < 0) player.x = 0;
  if (player.x + player.width > WORLD_WIDTH) {
    player.x = WORLD_WIDTH - player.width;
  }

  // Platform collisions (landing from above)
  const playerBottomBefore = previousY + player.height;

  for (const plat of platforms) {
    const playerBottomNow = player.y + player.height;
    const fallingDown = player.vy > 0;
    const wasAbove = playerBottomBefore <= plat.y;
    const withinX =
      player.x + player.width > plat.x &&
      player.x < plat.x + plat.width;

    if (
      fallingDown &&
      wasAbove &&
      withinX &&
      playerBottomNow >= plat.y &&
      playerBottomNow <= plat.y + plat.height
    ) {
      player.y = plat.y - player.height;
      player.vy = 0;
    }
  }

  // Ground collision
  if (player.y + player.height > GROUND_Y) {
    player.y = GROUND_Y - player.height;
    player.vy = 0;
  }

  // Player box for collision checks
  const playerBox = {
    x: player.x,
    y: player.y,
    width: player.width,
    height: player.height
  };

  // Hazards (death)
  for (const hz of hazards) {
    if (rectsOverlap(playerBox, hz)) {
      resetLevelState();
      return;
    }
  }

  // Fall off the bottom
  if (player.y > canvas.height + 200) {
    resetLevelState();
    return;
  }

  // Coins
  for (const coin of coins) {
    if (!coin.active) continue;

    const coinBox = {
      x: coin.x - coin.size / 2,
      y: coin.y - coin.size / 2,
      width: coin.size,
      height: coin.size
    };

    if (rectsOverlap(playerBox, coinBox)) {
      coin.active = false;
      score += 1;
    }
  }

  // Goal / finish flag
  const goalBox = {
    x: goal.x,
    y: goal.y,
    width: goal.width,
    height: goal.height
  };

  if (rectsOverlap(playerBox, goalBox)) {
    levelComplete = true;
    advanceToNextLevel();
  }

  // Camera follow
  cameraX = player.x - canvas.width / 2;
  if (cameraX < 0) cameraX = 0;
  const maxCamera = WORLD_WIDTH - canvas.width;
  if (cameraX > maxCamera) cameraX = maxCamera;
}

// ===== 8. Drawing (uses cameraX) =====
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawBackground() {
  ctx.fillStyle = '#202020';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawGround() {
  ctx.fillStyle = '#444';
  ctx.fillRect(-cameraX, GROUND_Y, WORLD_WIDTH, GROUND_HEIGHT);
}

function drawPlatforms() {
  ctx.fillStyle = '#888';
  for (const plat of platforms) {
    ctx.fillRect(
      plat.x - cameraX,
      plat.y,
      plat.width,
      plat.height
    );
  }
}

function drawHazards() {
  ctx.fillStyle = 'red';
  for (const hz of hazards) {
    ctx.fillRect(
      hz.x - cameraX,
      hz.y,
      hz.width,
      hz.height
    );
  }
}

function drawCoins() {
  ctx.fillStyle = 'gold';
  for (const coin of coins) {
    if (!coin.active) continue;
    ctx.fillRect(
      coin.x - coin.size / 2 - cameraX,
      coin.y - coin.size / 2,
      coin.size,
      coin.size
    );
  }
}

function drawGoal() {
  ctx.fillStyle = 'lightgreen';
  ctx.fillRect(
    goal.x - cameraX,
    goal.y,
    goal.width,
    goal.height
  );
}

function drawPlayer() {
  ctx.fillStyle = 'orange';
  ctx.fillRect(
    player.x - cameraX,
    player.y,
    player.width,
    player.height
  );
}

function drawUI() {
  ctx.fillStyle = 'white';
  ctx.font = '16px Arial';
  ctx.fillText('Arrows / A-D: Move | Space / W / Up: Jump', 10, 20);
  ctx.fillText('Score: ' + score, 10, 40);
  ctx.fillText('Level: ' + currentLevel + ' / ' + MAX_LEVEL, 10, 60);

  if (gameComplete) {
    ctx.font = '24px Arial';
    ctx.fillText('Game Complete! Press R to Play Again', 20, 100);
  }
}

// ===== 9. Game loop =====
function gameLoop() {
  clearCanvas();
  drawBackground();
  update();
  drawGround();
  drawPlatforms();
  drawHazards();
  drawCoins();
  drawGoal();
  drawUI();
  drawPlayer();
  requestAnimationFrame(gameLoop);
}

// ===== 10. Init =====
cloneLevelData();
gameLoop();