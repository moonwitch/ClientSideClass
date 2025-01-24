document.addEventListener("DOMContentLoaded", () => {
  /************************************
   * DOM REFERENCES
   ************************************/
  const DOM = {
    // Setup
    gameSetup: document.getElementById("game-setup"),
    playerName: document.getElementById("game-setup__player-name"),
    difficultySelect: document.getElementById("game-setup__difficulty"),
    startButton: document.getElementById("game-setup__start-button"),

    // Main game
    gameWindow: document.getElementById("game-window"),
    gameCanvas: document.getElementById("game-canvas"),
    banditOverview: document.getElementById("game-window__bandit-overview"),
    banditOverviewBanditHealth: document.querySelectorAll(
      ".game-window__bandit-overview__bandit__health"
    ),
    targetLayer: document.getElementById("game-window__target-layer"),
    gameLog: document.getElementById("game-window__log"),
    playerLives: document.getElementById("game-window__lives"),
    gunCylinder: document.getElementById("game-window__cylinder"),

    // Info text
    playerNameDisplay: document.getElementById("game-window__player-name"),
    difficultyDisplay: document.getElementById("game-window__difficulty"),

    // Highscore
    gameHighscore: document.getElementById("game-highscore"),
    gameHighscoreTitle: document.getElementById("game-highscore__title"),
    gameHighscoreFinalScore: document.getElementById(
      "game-highscore__final-score"
    ),
    gameHighscorePlayAgainButton: document.getElementById(
      "game-highscore__play-again"
    ),
    gameHighscoreStopGameButton: document.getElementById(
      "game-highscore__stop-game"
    ),
  };

  /************************************
   * AUDIO REFERENCES
   ************************************/
  const AudioFiles = {
    shootSound: new Audio("sounds/gunshot.mp3"),
    reloadSound: new Audio("sounds/reload.mp3"),
    backgroundMusic: new Audio("sounds/background.mp3"),
    gameOverSound: new Audio("sounds/game-over.mp3"),
    congratzSound: new Audio("sounds/congratulations.mp3"),
    emptySound: new Audio("sounds/gun-empty.mp3"),
  };
  AudioFiles.backgroundMusic.loop = true;

  /************************************
   * GAME CONSTANTS
   ************************************/
  const BANDIT_POSITIONS = [
    { left: 155, top: 300 },
    { left: 260, top: 300 },
    { left: 476, top: 217 },
    { left: 676, top: 300 },
    { left: 776, top: 300 },
    { left: 155, top: 490 },
    { left: 260, top: 490 },
    { left: 476, top: 490 },
    { left: 676, top: 490 },
    { left: 776, top: 490 },
  ];

  const BANDITS = [
    { name: "Jack", imgSrc: "./img/sprites/jack.png" },
    { name: "Joe", imgSrc: "./img/sprites/joe.png" },
    { name: "John", imgSrc: "./img/sprites/john.png" },
  ];

  /************************************
   * GAME STATE
   ************************************/
  const gameState = {
    playerLives: 0,
    startTime: null,
    spawnTimer: null,
    difficultyConfig: null,
    lastSpawnedName: null,
    availablePositions: [...BANDIT_POSITIONS],
  };

  let bandits = [];

  /************************************
   * DIFFICULTY SETTINGS
   ************************************/
  function getDifficultySettings(difficulty) {
    switch (difficulty) {
      case "easy":
        return {
          playerLives: 5,
          banditLives: 2,
          spawnTime: 3000,
          despawnTime: 4000,
        };
      case "hard":
        return {
          playerLives: 3,
          banditLives: 3,
          spawnTime: 1500,
          despawnTime: 2000,
        };
      default:
        return {
          playerLives: 4,
          banditLives: 2,
          spawnTime: 2000,
          despawnTime: 3000,
        };
    }
  }

  /************************************
   * BANDIT CLASS
   ************************************/
  class Bandit {
    constructor(name, imgSrc, lives) {
      this.name = name;
      this.imgSrc = imgSrc;
      this.lives = lives;
      this.isDead = false;
      this.isOnScreen = false;
      this.element = null;
      this.currentPosition = null;
    }

    spawn() {
      if (
        this.isDead ||
        this.isOnScreen ||
        gameState.availablePositions.length === 0
      )
        return;

      this.isOnScreen = true;
      const randomIndex = Math.floor(
        Math.random() * gameState.availablePositions.length,
      );
      this.currentPosition = gameState.availablePositions.splice(
        randomIndex,
        1,
      )[0];

      const { left, top } = this.currentPosition;

      this.element = document.createElement("img");
      this.element.src = this.imgSrc;
      this.element.classList.add("target__bandit__img");
      this.element.style.left = `${left}px`;
      this.element.style.top = `${top}px`;

      this.element.addEventListener("click", () => this.handleHit());

      DOM.targetLayer.appendChild(this.element);

      setTimeout(() => this.despawn(), gameState.difficultyConfig.despawnTime);
    }

    despawn() {
      if (!this.isOnScreen) return;

      this.isOnScreen = false;
      if (this.element) {
        DOM.targetLayer.removeChild(this.element);
        this.element = null;
      }

      gameState.availablePositions.push(this.currentPosition);
      this.currentPosition = null;

      if (!this.isDead) {
        gameState.playerLives--;
        updatePlayerLives();
        logAction(`${this.name} escaped! -1 life.`);
        if (gameState.playerLives <= 0) stopGame();
      }
    }

    handleHit() {
      // Check if there are bullets in the cylinder
      const bulletCount = parseInt(
        DOM.gunCylinder.querySelector("img").alt.split("_")[1],
      );

      if (bulletCount > 0) {
        // Decrease bullet count and update the cylinder
        const newBulletCount = bulletCount - 1;
        DOM.gunCylinder.innerHTML = `<img src="./img/sprites/gun_cylinder_${newBulletCount}.svg" alt="Cylinder_${newBulletCount}" id="animate" />`;

        // Play shooting sound
        AudioFiles.shootSound.cloneNode().play();

        // Despawn the bandit image immediately
        this.isOnScreen = false;
        if (this.element) {
          DOM.targetLayer.removeChild(this.element);
          this.element = null;
        }

        // Return the position to the pool
        gameState.availablePositions.push(this.currentPosition);
        this.currentPosition = null;

        // Reduce bandit lives and log the action
        this.lives--;
        if (this.lives <= 0) {
          this.isDead = true;
          logAction(`You defeated ${this.name}!`);
        } else {
          logAction(`You hit ${this.name}! ${this.lives} lives left.`);
        }

        // Update the bandit overview
        updateBanditOverview();

        // Check if all bandits are defeated
        if (bandits.every((b) => b.isDead)) stopGame(true);
      } else {
        // Play empty gun sound if no bullets left
        AudioFiles.emptySound.cloneNode().play();
        logAction("No bullets left! Reload your gun.");
      }
    }
  }

  /************************************
   * GAME FUNCTIONS
   ************************************/
  function startGame() {
    // Set up game state
    const difficulty = DOM.difficultySelect.value;
    gameState.difficultyConfig = getDifficultySettings(difficulty);
    gameState.playerLives = gameState.difficultyConfig.playerLives;
    gameState.startTime = new Date();
    bandits = BANDITS.map(
      (b) =>
        new Bandit(b.name, b.imgSrc, gameState.difficultyConfig.banditLives),
    );

    // Display player info
    DOM.playerNameDisplay.textContent = DOM.playerName.value;
    DOM.difficultyDisplay.textContent = difficulty;

    // Reset UI
    updatePlayerLives();
    updateBanditOverview();

    // Start spawning bandits
    gameState.spawnTimer = setInterval(
      spawnRandomBandit,
      gameState.difficultyConfig.spawnTime,
    );
    DOM.gameSetup.style.display = "none";
    DOM.gameWindow.style.display = "block";

    // Reset cylinder bullets
    DOM.gunCylinder.innerHTML = `<img src="./img/sprites/gun_cylinder_4.svg" alt="Cylinder_4" />`;

    // Key listener for reload
    document.addEventListener("keydown", reloadKeyListener);

    AudioFiles.backgroundMusic.volume = 0.1;
    AudioFiles.backgroundMusic.play();

    logAction("Game started!");
  }

  function stopGame(won = false) {
    clearInterval(gameState.spawnTimer);
    AudioFiles.backgroundMusic.pause();
    if (won) {
      logAction("You won the game!");
      DOM.gameHighscoreTitle.innerHTML = "You won the game!";
      AudioFiles.congratzSound.play();
    } else {
      logAction("Game over! You lost!");
      DOM.gameHighscoreTitle.innerHTML = "Game over! You lost!";
      AudioFiles.gameOverSound.play();
    }

    //  hide ui and show score
    DOM.gameWindow.style.display = "none";
    DOM.gameHighscore.style.display = "block";
    DOM.gameHighscoreFinalScore.textContent = calculateFinalScore();
  }

  function spawnRandomBandit() {
    const candidates = bandits.filter((b) => !b.isDead && !b.isOnScreen);
    if (candidates.length === 0) {
      stopGame(true);
      return;
    }

    const randomBandit = candidates[Math.floor(Math.random() * candidates.length)];
    randomBandit.spawn();
  }

  /************************************
   * UI UPDATES
   ************************************/
  function logAction(message) {
    const p = document.createElement("p");
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const ts = `${hh}:${mm}:${ss}`;
    p.innerHTML = `<span class="timestamp">${ts}</span>${message}`;
    DOM.gameLog.prepend(p);
  }

  function updatePlayerLives() {
    DOM.playerLives.innerHTML = "";
    for (let i = 0; i < gameState.playerLives; i++) {
      const live = document.createElement("img");
      live.src = "./img/sprites/heart.png";
      DOM.playerLives.appendChild(live);
    }
    if (gameState.playerLives <= 0) {
      stopGame();
    }
  }

  function updateBanditOverview() {
    DOM.banditOverview.querySelectorAll("img").forEach((img) => {
      img.src = "./img/sprites/skull.png";
    });
    DOM.banditOverviewBanditHealth.forEach((bandit, index) => {
      if (bandits[index]?.isDead) {
        bandit.textContent = "DEAD";
        DOM.banditOverview.querySelectorAll("img")[index].src = "./img/sprites/skull.png";
      } else {
        bandit.textContent = `${bandits[index]?.lives} HP`;
        DOM.banditOverview.querySelectorAll("img")[index].src =
          bandits[index].imgSrc;
      }
    });
  }

  function reloadGun() {
    // Refill bullets and play reload sound
    DOM.gunCylinder.innerHTML = `<img src="./img/sprites/gun_cylinder_4.svg" alt="Cylinder_4" />`;
    AudioFiles.reloadSound.cloneNode().play();
    logAction("You reloaded your gun!");
  }

  function calculateFinalScore() {
    const timePlayed = Math.floor((new Date() - gameState.startTime) / 1000);
    return timePlayed * 10;
  }

  /************************************
   * EVENT LISTENERS
   ************************************/
  DOM.startButton.addEventListener("click", startGame);
  DOM.playerName.addEventListener("input", checkStartButton);
  DOM.difficultySelect.addEventListener("change", checkStartButton);

  function checkStartButton() {
    DOM.startButton.disabled = !DOM.playerName.value || !DOM.difficultySelect.value;
  }

  function reloadKeyListener(e) {
    // Listen for the "R" key to reload
    if (e.key.toLowerCase() === "r" || e.code === "KeyR") {
      reloadGun();
    }
  }

  DOM.gameHighscorePlayAgainButton.addEventListener("click", () => {
    resetGame();
    startGame();
  });

  DOM.gameHighscoreStopGameButton.addEventListener("click", () => {
    resetGame();
    DOM.gameHighscore.style.display = "none";
    DOM.gameSetup.style.display = "block";
    DOM.gameWindow.style.display = "none";
  });

  function resetGame() {
    clearInterval(gameState.spawnTimer);
    DOM.targetLayer.innerHTML = "";
    DOM.gameLog.innerHTML = "";
    bandits.forEach((b) => (b.isDead = false));
    gameState.availablePositions = [...BANDIT_POSITIONS];
    DOM.gunCylinder.innerHTML = `<img src="./img/sprites/gun_cylinder_4.svg" alt="Cylinder_4" />`;
    // Remove event listeners to avoid duplication
    document.removeEventListener("keydown", reloadKeyListener);
  }
});