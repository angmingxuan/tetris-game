(function () {
  'use strict';

  // =====================================================================
  // CONSTANTS
  // =====================================================================
  const COLS        = 10;
  const ROWS        = 20;
  const BLOCK_SIZE  = 30;
  const PREVIEW_SIZE = 25;
  const LOCK_DELAY  = 500;

  const COLORS = {
    I: '#00f0f0',
    O: '#f0f000',
    T: '#a000f0',
    S: '#00f000',
    Z: '#f00000',
    J: '#0000f0',
    L: '#f0a000',
  };

  // Drop interval in ms per level (index 0 = level 1)
  const LEVEL_SPEEDS = [
    800, 720, 630, 550, 470,
    380, 300, 220, 130,  80,
     80,  80,  80,  80,  80,
     80,  80,  80,  80,  80,
  ];

  // =====================================================================
  // TETROMINOES
  // =====================================================================
  const SHAPES = {
    I: [[0,0,0,0],
        [1,1,1,1],
        [0,0,0,0],
        [0,0,0,0]],
    O: [[1,1],
        [1,1]],
    T: [[0,1,0],
        [1,1,1],
        [0,0,0]],
    S: [[0,1,1],
        [1,1,0],
        [0,0,0]],
    Z: [[1,1,0],
        [0,1,1],
        [0,0,0]],
    J: [[1,0,0],
        [1,1,1],
        [0,0,0]],
    L: [[0,0,1],
        [1,1,1],
        [0,0,0]],
  };

  function generateRotations(shape) {
    const rotations = [shape];
    for (let i = 1; i < 4; i++) {
      const prev = rotations[i - 1];
      const N = prev.length;
      const M = prev[0].length;
      const next = Array.from({ length: M }, () => Array(N).fill(0));
      for (let r = 0; r < N; r++)
        for (let c = 0; c < M; c++)
          next[c][N - 1 - r] = prev[r][c];
      rotations.push(next);
    }
    return rotations;
  }

  const TETROMINOES = {};
  for (const [key, shape] of Object.entries(SHAPES)) {
    TETROMINOES[key] = {
      color: COLORS[key],
      rotations: generateRotations(shape),
    };
  }

  // SRS wall kick tables
  const SRS_KICKS = {
    OTHER: {
      '0->1': [[ 0,0],[-1,0],[-1,-1],[0, 2],[-1, 2]],
      '1->0': [[ 0,0],[ 1,0],[ 1, 1],[0,-2],[ 1,-2]],
      '1->2': [[ 0,0],[ 1,0],[ 1, 1],[0,-2],[ 1,-2]],
      '2->1': [[ 0,0],[-1,0],[-1,-1],[0, 2],[-1, 2]],
      '2->3': [[ 0,0],[ 1,0],[ 1,-1],[0, 2],[ 1, 2]],
      '3->2': [[ 0,0],[-1,0],[-1, 1],[0,-2],[-1,-2]],
      '3->0': [[ 0,0],[-1,0],[-1, 1],[0,-2],[-1,-2]],
      '0->3': [[ 0,0],[ 1,0],[ 1,-1],[0, 2],[ 1, 2]],
    },
    I: {
      '0->1': [[ 0,0],[-2,0],[ 1,0],[-2, 1],[ 1,-2]],
      '1->0': [[ 0,0],[ 2,0],[-1,0],[ 2,-1],[-1, 2]],
      '1->2': [[ 0,0],[-1,0],[ 2,0],[-1,-2],[ 2, 1]],
      '2->1': [[ 0,0],[ 1,0],[-2,0],[ 1, 2],[-2,-1]],
      '2->3': [[ 0,0],[ 2,0],[-1,0],[ 2,-1],[-1, 2]],
      '3->2': [[ 0,0],[-2,0],[ 1,0],[-2, 1],[ 1,-2]],
      '3->0': [[ 0,0],[ 1,0],[-2,0],[ 1, 2],[-2,-1]],
      '0->3': [[ 0,0],[-1,0],[ 2,0],[-1,-2],[ 2, 1]],
    },
  };

  // =====================================================================
  // BOARD
  // =====================================================================
  class Board {
    constructor() {
      this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    isValid(shape, offsetX, offsetY) {
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (!shape[r][c]) continue;
          const x = offsetX + c;
          const y = offsetY + r;
          if (x < 0 || x >= COLS || y >= ROWS) return false;
          if (y >= 0 && this.grid[y][x]) return false;
        }
      }
      return true;
    }

    lock(piece) {
      const shape = piece.currentShape();
      for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++)
          if (shape[r][c])
            this.grid[piece.y + r][piece.x + c] = piece.color;
    }

    clearLines() {
      let cleared = 0;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (this.grid[r].every(cell => cell !== 0)) {
          this.grid.splice(r, 1);
          this.grid.unshift(Array(COLS).fill(0));
          cleared++;
          r++;
        }
      }
      return cleared;
    }

    reset() {
      this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }
  }

  // =====================================================================
  // PIECE
  // =====================================================================
  class Piece {
    constructor(type) {
      this.type      = type;
      this.color     = TETROMINOES[type].color;
      this.rotations = TETROMINOES[type].rotations;
      this.rotIndex  = 0;
      this.x = Math.floor((COLS - this.rotations[0][0].length) / 2);
      this.y = type === 'I' ? -1 : 0;
    }

    currentShape() {
      return this.rotations[this.rotIndex];
    }

    rotate(dir, board) {
      const nextIndex = (this.rotIndex + dir + 4) % 4;
      const nextShape = this.rotations[nextIndex];
      const table = this.type === 'I' ? SRS_KICKS.I : SRS_KICKS.OTHER;
      const kicks = table[`${this.rotIndex}->${nextIndex}`] || [[0, 0]];
      for (const [dx, dy] of kicks) {
        if (board.isValid(nextShape, this.x + dx, this.y + dy)) {
          this.rotIndex = nextIndex;
          this.x += dx;
          this.y += dy;
          return true;
        }
      }
      return false;
    }

    move(dx, dy, board) {
      if (board.isValid(this.currentShape(), this.x + dx, this.y + dy)) {
        this.x += dx;
        this.y += dy;
        return true;
      }
      return false;
    }

    hardDrop(board) {
      let dropped = 0;
      while (board.isValid(this.currentShape(), this.x, this.y + 1)) {
        this.y++;
        dropped++;
      }
      return dropped;
    }

    ghostY(board) {
      let gy = this.y;
      while (board.isValid(this.currentShape(), this.x, gy + 1)) gy++;
      return gy;
    }
  }

  // =====================================================================
  // RENDERER
  // =====================================================================
  const Renderer = {
    init(gameCanvas, nextCanvas, holdCanvas) {
      this.ctx  = gameCanvas.getContext('2d');
      this.nCtx = nextCanvas.getContext('2d');
      this.hCtx = holdCanvas.getContext('2d');

      gameCanvas.width  = COLS * BLOCK_SIZE;
      gameCanvas.height = ROWS * BLOCK_SIZE;
      nextCanvas.width  = 4 * PREVIEW_SIZE;
      nextCanvas.height = 4 * PREVIEW_SIZE;
      holdCanvas.width  = 4 * PREVIEW_SIZE;
      holdCanvas.height = 4 * PREVIEW_SIZE;
    },

    drawBlock(ctx, x, y, color, size) {
      size = size || BLOCK_SIZE;
      // Main fill
      ctx.fillStyle = color;
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      // Top-left highlight
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, 3);
      ctx.fillRect(x * size + 1, y * size + 1, 3, size - 2);
      // Bottom-right shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x * size + 1, y * size + size - 4, size - 2, 3);
      ctx.fillRect(x * size + size - 4, y * size + 1, 3, size - 2);
    },

    drawBoard(board) {
      const ctx = this.ctx;
      // Background
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);
      // Grid lines
      ctx.strokeStyle = '#1e1e2e';
      ctx.lineWidth = 1;
      for (let c = 1; c < COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * BLOCK_SIZE, 0);
        ctx.lineTo(c * BLOCK_SIZE, ROWS * BLOCK_SIZE);
        ctx.stroke();
      }
      for (let r = 1; r < ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * BLOCK_SIZE);
        ctx.lineTo(COLS * BLOCK_SIZE, r * BLOCK_SIZE);
        ctx.stroke();
      }
      // Locked cells
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (board.grid[r][c])
            this.drawBlock(ctx, c, r, board.grid[r][c], BLOCK_SIZE);
    },

    drawGhost(piece, board) {
      const gy = piece.ghostY(board);
      const shape = piece.currentShape();
      this.ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++)
          if (shape[r][c])
            this.ctx.fillRect(
              (piece.x + c) * BLOCK_SIZE + 1,
              (gy + r)       * BLOCK_SIZE + 1,
              BLOCK_SIZE - 2,
              BLOCK_SIZE - 2
            );
    },

    drawActivePiece(piece) {
      const shape = piece.currentShape();
      for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++)
          if (shape[r][c])
            this.drawBlock(this.ctx, piece.x + c, piece.y + r, piece.color, BLOCK_SIZE);
    },

    drawPreview(ctx, piece) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      if (!piece) return;
      const shape = piece.currentShape();
      const offsetX = Math.floor((4 - shape[0].length) / 2);
      const offsetY = Math.floor((4 - shape.length) / 2);
      for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++)
          if (shape[r][c])
            this.drawBlock(ctx, c + offsetX, r + offsetY, piece.color, PREVIEW_SIZE);
    },

    render(state) {
      this.drawBoard(state.board);
      if (state.activePiece) {
        this.drawGhost(state.activePiece, state.board);
        this.drawActivePiece(state.activePiece);
      }
      this.drawPreview(this.nCtx, state.nextPiece);
      this.drawPreview(this.hCtx, state.holdPiece);
    },
  };

  // =====================================================================
  // INPUT HANDLER
  // =====================================================================
  const InputHandler = {
    keys: {},
    DAS_DELAY:    167,
    ARR_INTERVAL:  33,

    init(game) {
      this._game = game;
      document.addEventListener('keydown', e => this._onKeyDown(e));
      document.addEventListener('keyup',   e => this._onKeyUp(e));
    },

    _onKeyDown(e) {
      // Prevent page scroll on arrow/space keys
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))
        e.preventDefault();

      if (this.keys[e.code]) return;
      this.keys[e.code] = { held: true, dasTimer: 0 };
      this._handleKey(e.code);
    },

    _onKeyUp(e) {
      delete this.keys[e.code];
      if (e.code === 'ArrowDown') this._game.setSoftDrop(false);
    },

    _handleKey(code) {
      const g = this._game;
      switch (code) {
        case 'ArrowLeft':  g.movePiece(-1); break;
        case 'ArrowRight': g.movePiece(1);  break;
        case 'ArrowDown':  g.setSoftDrop(true); break;
        case 'ArrowUp':    g.rotatePiece(1);  break;
        case 'KeyZ':       g.rotatePiece(-1); break;
        case 'Space':      g.hardDrop();    break;
        case 'KeyC':       g.doHold();      break;
        case 'KeyP':
        case 'Escape':     g.togglePause(); break;
        case 'Enter':      g.startOrRestart(); break;
      }
    },

    update(delta, game) {
      for (const [code, state] of Object.entries(this.keys)) {
        if (code === 'ArrowLeft' || code === 'ArrowRight') {
          state.dasTimer += delta;
          if (state.dasTimer >= this.DAS_DELAY) {
            state.dasTimer -= this.ARR_INTERVAL;
            game.movePiece(code === 'ArrowLeft' ? -1 : 1);
          }
        }
      }
    },
  };

  // =====================================================================
  // SCORE MANAGER
  // =====================================================================
  const ScoreManager = {
    score:     0,
    highScore: parseInt(localStorage.getItem('tetrisHighScore') || '0', 10),
    level:     1,
    lines:     0,

    LINE_POINTS: { 1: 100, 2: 300, 3: 500, 4: 800 },

    addLineClear(linesCleared, isBackToBack) {
      if (linesCleared === 0) return;
      let base = this.LINE_POINTS[linesCleared] || 800;
      if (isBackToBack && linesCleared === 4) base = 1200;
      this.score += base * this.level;
      this.lines += linesCleared;
      this._checkLevelUp();
    },

    addSoftDrop()  { this.score += 1; },
    addHardDrop(n) { this.score += n * 2; },

    _checkLevelUp() {
      const newLevel = Math.floor(this.lines / 10) + 1;
      if (newLevel > this.level) this.level = Math.min(newLevel, 20);
    },

    saveHighScore() {
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem('tetrisHighScore', this.highScore);
      }
    },

    reset() {
      this.score = 0;
      this.level = 1;
      this.lines = 0;
    },
  };

  // =====================================================================
  // GAME
  // =====================================================================
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  class Game {
    constructor() {
      this.board        = new Board();
      this.state        = 'IDLE'; // IDLE | PLAYING | PAUSED | GAME_OVER
      this.bag          = [];
      this.activePiece  = null;
      this.nextPiece    = null;
      this.holdPiece    = null;
      this.holdUsed     = false;
      this.backToBack   = false;
      this.softDropping = false;
      this.dropAccumulator  = 0;
      this.lockDelayAcc     = 0;
      this.lastTimestamp    = 0;

      this._overlay      = document.getElementById('overlay');
      this._overlayTitle = document.getElementById('overlay-title');
      this._overlayMsg   = document.getElementById('overlay-message');
      this._overlayScore = document.getElementById('overlay-score');

      Renderer.init(
        document.getElementById('game-canvas'),
        document.getElementById('next-canvas'),
        document.getElementById('hold-canvas')
      );
      InputHandler.init(this);
      this._updateHUD();
      this._showOverlay('TETRIS', 'Press Enter to Start', '');
      requestAnimationFrame(ts => this._loop(ts));
    }

    // ---- Bag randomizer ----
    _nextFromBag() {
      if (this.bag.length === 0)
        this.bag = shuffle(['I','O','T','S','Z','J','L']);
      return new Piece(this.bag.pop());
    }

    // ---- Spawning ----
    _spawn() {
      this.activePiece = this.nextPiece || this._nextFromBag();
      this.nextPiece   = this._nextFromBag();
      this.holdUsed    = false;
      this.dropAccumulator = 0;
      this.lockDelayAcc    = 0;

      if (!this.board.isValid(
            this.activePiece.currentShape(),
            this.activePiece.x,
            this.activePiece.y)) {
        this.state = 'GAME_OVER';
        ScoreManager.saveHighScore();
        this._updateHUD();
        this._showOverlay(
          'GAME OVER',
          'Press Enter to Restart',
          `Score: ${ScoreManager.score}`
        );
      }
    }

    // ---- Locking ----
    _lock() {
      this.board.lock(this.activePiece);
      const cleared = this.board.clearLines();
      const isB2B   = this.backToBack && cleared === 4;
      ScoreManager.addLineClear(cleared, isB2B);
      this.backToBack = cleared === 4;
      this._updateHUD();
      this._spawn();
    }

    // ---- Public actions (called by InputHandler) ----
    movePiece(dx) {
      if (this.state !== 'PLAYING') return;
      if (this.activePiece.move(dx, 0, this.board))
        this.lockDelayAcc = 0;
    }

    rotatePiece(dir) {
      if (this.state !== 'PLAYING') return;
      if (this.activePiece.rotate(dir, this.board))
        this.lockDelayAcc = 0;
    }

    hardDrop() {
      if (this.state !== 'PLAYING') return;
      const dropped = this.activePiece.hardDrop(this.board);
      ScoreManager.addHardDrop(dropped);
      this._updateHUD();
      this._lock();
    }

    doHold() {
      if (this.state !== 'PLAYING' || this.holdUsed) return;
      const currentType = this.activePiece.type;
      if (this.holdPiece) {
        this.activePiece = new Piece(this.holdPiece.type);
      } else {
        this.activePiece = this.nextPiece;
        this.nextPiece   = this._nextFromBag();
      }
      this.holdPiece = new Piece(currentType);
      this.holdUsed  = true;
      this.dropAccumulator = 0;
      this.lockDelayAcc    = 0;
    }

    setSoftDrop(active) {
      this.softDropping = active;
    }

    togglePause() {
      if (this.state === 'PLAYING') {
        this.state = 'PAUSED';
        this._showOverlay('PAUSED', 'Press P or Esc to Resume', '');
      } else if (this.state === 'PAUSED') {
        this.state = 'PLAYING';
        this._hideOverlay();
        this.lastTimestamp = 0; // reset delta to avoid big jump
      }
    }

    startOrRestart() {
      if (this.state === 'PLAYING') return;
      this.board.reset();
      ScoreManager.reset();
      this.bag        = [];
      this.holdPiece  = null;
      this.backToBack = false;
      this.softDropping = false;
      this.nextPiece  = this._nextFromBag();
      this._spawn();
      if (this.state !== 'GAME_OVER') {
        this.state = 'PLAYING';
        this._hideOverlay();
        this._updateHUD();
      }
    }

    // ---- Game Loop ----
    _loop(timestamp) {
      if (this.lastTimestamp === 0) this.lastTimestamp = timestamp;
      const delta = Math.min(timestamp - this.lastTimestamp, 100); // cap at 100ms
      this.lastTimestamp = timestamp;

      if (this.state === 'PLAYING') {
        InputHandler.update(delta, this);

        const baseInterval = LEVEL_SPEEDS[ScoreManager.level - 1];
        const interval = this.softDropping
          ? Math.max(baseInterval / 20, 30)
          : baseInterval;

        this.dropAccumulator += delta;

        if (this.dropAccumulator >= interval) {
          this.dropAccumulator -= interval;
          const moved = this.activePiece.move(0, 1, this.board);
          if (moved) {
            this.lockDelayAcc = 0;
            if (this.softDropping) {
              ScoreManager.addSoftDrop();
              this._updateHUD();
            }
          } else {
            this.lockDelayAcc += interval;
            if (this.lockDelayAcc >= LOCK_DELAY) {
              this.lockDelayAcc = 0;
              this._lock();
            }
          }
        }

        Renderer.render({
          board:       this.board,
          activePiece: this.activePiece,
          nextPiece:   this.nextPiece,
          holdPiece:   this.holdPiece,
        });
      }

      requestAnimationFrame(ts => this._loop(ts));
    }

    // ---- HUD ----
    _updateHUD() {
      document.getElementById('score').textContent      = ScoreManager.score.toLocaleString();
      document.getElementById('high-score').textContent = ScoreManager.highScore.toLocaleString();
      document.getElementById('level').textContent      = ScoreManager.level;
      document.getElementById('lines').textContent      = ScoreManager.lines;
    }

    // ---- Overlay helpers ----
    _showOverlay(title, msg, score) {
      this._overlayTitle.textContent = title;
      this._overlayMsg.textContent   = msg;
      this._overlayScore.textContent = score;
      this._overlay.classList.remove('hidden');
    }

    _hideOverlay() {
      this._overlay.classList.add('hidden');
    }
  }

  // =====================================================================
  // BOOTSTRAP
  // =====================================================================
  document.addEventListener('DOMContentLoaded', () => new Game());

})();
