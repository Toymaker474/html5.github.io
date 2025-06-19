// Get canvas and context
const canvas = document.getElementById('sandCanvas');
const ctx = canvas.getContext('2d');

// Canvas dimensions
const canvasWidth = 600;
const canvasHeight = 400;
canvas.width = canvasWidth;
canvas.height = canvasHeight;

// Cell size and grid dimensions
const cellSize = 5;
const cols = Math.floor(canvasWidth / cellSize);
const rows = Math.floor(canvasHeight / cellSize);

// Particle types
const EMPTY = 0;
const SAND = 1;
const LAVA = 2;
const SOUL = 3;

// Initialize grid
let grid = Array(rows).fill(null).map(() => Array(cols).fill(EMPTY));

// Add lava at the bottom
const lavaRows = 5;
for (let i = rows - lavaRows; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
        grid[i][j] = LAVA;
    }
}

// Add initial sand particles (optional, for testing)
grid[0][Math.floor(cols / 2)] = SAND;
grid[1][Math.floor(cols / 2)] = SAND;
grid[2][Math.floor(cols / 2)] = SAND;
grid[0][Math.floor(cols / 2) - 1] = SAND;
grid[1][Math.floor(cols / 2) - 1] = SAND;
grid[0][Math.floor(cols / 2) + 1] = SAND;

// Add initial soul particles for testing
grid[5][Math.floor(cols/2)] = SOUL;
grid[6][Math.floor(cols/2) - 1] = SOUL;
grid[5][Math.floor(cols/2) + 2] = SOUL;


// Function to update the grid
function updateGrid() {
    for (let i = rows - 1; i >= 0; i--) {
        for (let j = cols - 1; j >= 0; j--) {
            const currentParticle = grid[i][j];

            if (currentParticle === EMPTY || currentParticle === LAVA) {
                continue; // Skip empty cells and lava
            }

            // Common behavior for SAND and SOUL
            if (currentParticle === SAND || currentParticle === SOUL) {
                // Check cell below
                if (i + 1 < rows) {
                    if (grid[i + 1][j] === LAVA) {
                        grid[i][j] = EMPTY; // Consumed by lava
                        continue;
                    } else if (grid[i + 1][j] === EMPTY) {
                        grid[i + 1][j] = currentParticle;
                        grid[i][j] = EMPTY;
                        continue;
                    }
                }

                // If blocked or at the bottom (and not above lava), try to slide
                // (Only if not consumed by lava in the step above)
                const canMoveLeft = j - 1 >= 0 && i + 1 < rows && grid[i + 1][j - 1] === EMPTY;
                const canMoveRight = j + 1 < cols && i + 1 < rows && grid[i + 1][j + 1] === EMPTY;

                // Check for lava when sliding too
                const canSlideLeftToLava = j - 1 >= 0 && i + 1 < rows && grid[i + 1][j - 1] === LAVA;
                const canSlideRightToLava = j + 1 < cols && i + 1 < rows && grid[i + 1][j + 1] === LAVA;


                if (canMoveLeft && canMoveRight) {
                    if (Math.random() < 0.5) {
                        grid[i + 1][j - 1] = currentParticle;
                    } else {
                        grid[i + 1][j + 1] = currentParticle;
                    }
                    grid[i][j] = EMPTY;
                } else if (canMoveLeft) {
                    grid[i + 1][j - 1] = currentParticle;
                    grid[i][j] = EMPTY;
                } else if (canMoveRight) {
                    grid[i + 1][j + 1] = currentParticle;
                    grid[i][j] = EMPTY;
                } else {
                    // Check if sliding into lava is an option (if direct fall was blocked by non-empty, non-lava)
                    if (canSlideLeftToLava && canSlideRightToLava) {
                         grid[i][j] = EMPTY; // Consumed by lava while trying to slide
                    } else if (canSlideLeftToLava) {
                         grid[i][j] = EMPTY;
                    } else if (canSlideRightToLava) {
                         grid[i][j] = EMPTY;
                    }
                }
            }
        }
    }
}

// Function to draw the grid
function drawGrid() {
    // Clear canvas to black
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const particle = grid[i][j];
            if (particle === EMPTY) continue;

            let color;
            switch (particle) {
                case SAND:
                    color = '#CC5500'; // Dark orange
                    break;
                case LAVA:
                    color = '#FF4500'; // Orange-red
                    break;
                case SOUL:
                    color = '#E0FFFF'; // LightCyan
                    break;
                default:
                    color = '#FFFFFF'; // Should not happen
            }
            ctx.fillStyle = color;
            ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
        }
    }
}

// Mouse interaction
let isMouseDown = false;

canvas.addEventListener('mousedown', (event) => {
    isMouseDown = true;
    addParticles(event);
});

canvas.addEventListener('mousemove', (event) => {
    if (isMouseDown) {
        addParticles(event);
    }
});

canvas.addEventListener('mouseup', () => {
    isMouseDown = false;
});

canvas.addEventListener('mouseleave', () => {
    isMouseDown = false; // Stop drawing if mouse leaves canvas
});

function addParticles(event) { // Renamed from addSand to be more generic if needed later
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);

    // Add a 3x3 cluster of SAND (current behavior)
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const newRow = row + i;
            const newCol = col + j;
            if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
                // Ensure we don't overwrite lava or other special fixed particles when clicking
                if(grid[newRow][newCol] === EMPTY || grid[newRow][newCol] === SAND || grid[newRow][newCol] === SOUL) {
                     grid[newRow][newCol] = SAND;
                }
            }
        }
    }
}

// Game loop
function gameLoop() {
    updateGrid();
    drawGrid();
    requestAnimationFrame(gameLoop);
}

// Start the game loop
requestAnimationFrame(gameLoop);
