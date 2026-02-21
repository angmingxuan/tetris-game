# Tetris Game

A classic Tetris game built with vanilla HTML, CSS, and JavaScript. No frameworks, no dependencies — runs directly in the browser.

## Features

- All 7 tetrominoes (I, O, T, S, Z, J, L) with correct colors
- **Ghost piece** — shows where the piece will land
- **Hold piece** — swap the current piece for later
- **Next piece** preview
- **SRS (Super Rotation System)** wall kicks for accurate rotation
- **Back-to-back Tetris** bonus scoring
- **20 levels** with increasing drop speed
- High score saved to localStorage
- Pause / resume support
- Responsive layout (mobile-friendly)

## Controls

| Key | Action |
|---|---|
| `← →` | Move left / right |
| `↑` or `Z` | Rotate |
| `↓` | Soft drop |
| `Space` | Hard drop |
| `C` | Hold piece |
| `P` or `Esc` | Pause / Resume |
| `Enter` | Start / Restart |

## Scoring

| Lines Cleared | Points |
|---|---|
| 1 line | 100 × level |
| 2 lines | 300 × level |
| 3 lines | 500 × level |
| 4 lines (Tetris) | 800 × level |
| Back-to-back Tetris | 1200 × level |

- Soft drop: +1 per row
- Hard drop: +2 per row

Level increases every 10 lines cleared, up to level 20.

## How to Play

1. Clone or download the repo
2. Open `index.html` in any modern browser
3. Press **Enter** to start

No installation or build step required.

## Tech Stack

- HTML5 Canvas
- CSS3 (Grid layout, responsive)
- Vanilla JavaScript (ES6+)
