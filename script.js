let currentHole = 1;
let players = [];
let gameOver = false;

// Function to add player
function addPlayer() {
    if (gameOver) return; // Prevent adding players if game is over
    
    let playerName = prompt("Enter player's name:");
    if (playerName) {
        let player = {
            name: playerName,
            scores: Array(18).fill(0), // Initialize scores for 18 holes with 0
        };
        players.push(player);
        updatePlayers();
    }
}

// Function to update the players' display
function updatePlayers() {
    const playersContainer = document.getElementById("players");
    playersContainer.innerHTML = '';

    players.forEach((player, index) => {
        const playerDiv = document.createElement("div");
        playerDiv.classList.add("player");
        playerDiv.innerHTML = `
            <div class="player-header">
                <span>${player.name}</span>
                <span>Hole ${currentHole}</span>
            </div>
            <div class="hole-scores">
                <div class="hole-score">
                    <button onclick="adjustScore(${index}, ${currentHole - 1}, -1)">-</button>
                    <input type="number" id="score-${index}" value="${player.scores[currentHole - 1]}" ${gameOver ? 'disabled' : ''}>
                    <button onclick="adjustScore(${index}, ${currentHole - 1}, 1)">+</button>
                    <button onclick="scratch(${index}, ${currentHole - 1})">Scratch</button>
                </div>
            </div>
        `;
        playersContainer.appendChild(playerDiv);
    });
}

// Function to adjust score
function adjustScore(playerIndex, holeIndex, change) {
    if (gameOver) return;

    let newScore = players[playerIndex].scores[holeIndex] + change;
    players[playerIndex].scores[holeIndex] = newScore;
    updatePlayers();
}

// Function to add 3 points for Scratch
function scratch(playerIndex, holeIndex) {
    if (gameOver) return;

    players[playerIndex].scores[holeIndex] += 3;
    updatePlayers();
}

// Function to move to next hole
function moveToNextHole() {
    if (currentHole < 18) {
        currentHole++;
        updatePlayers();
    }
}

// Function to reset game
function resetGame() {
    players = [];
    currentHole = 1;
    gameOver = false;
    updatePlayers();
    document.getElementById("boxScore").style.display = 'none';
}

// Function to show box score and handle game over
function endGame() {
    if (!confirm("Are you sure you want to end the game?")) return;
    gameOver = true;
    updatePlayers();
    
    const scoreDetails = document.getElementById("scoreDetails");
    scoreDetails.innerHTML = '';
    
    players.forEach(player => {
        let scoreRow = `<div><strong>${player.name}:</strong>`;
        player.scores.forEach((score, index) => {
            if (score !== 0) {
                scoreRow += ` Hole ${index + 1}: ${score}`;
            }
        });
        scoreRow += `</div>`;
        scoreDetails.innerHTML += scoreRow;
    });
    
    document.getElementById("boxScore").style.display = 'block';
}

// Event listeners
document.getElementById("addPlayer").addEventListener("click", addPlayer);
document.getElementById("nextHole").addEventListener("click", moveToNextHole);
document.getElementById("reset").addEventListener("click", resetGame);
document.getElementById("gameOver").addEventListener("click", endGame);
document.getElementById("closeBoxScore").addEventListener("click", () => {
    document.getElementById("boxScore").style.display = 'none';
});
