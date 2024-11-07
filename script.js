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
            scores: Array(18).fill(null), // Initialize scores for 18 holes
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
                    Score: <input type="number" id="score-${index}" ${gameOver ? 'disabled' : ''}>
                    <button onclick="submitScore(${index})" ${gameOver ? 'disabled' : ''}>Submit</button>
                </div>
            </div>
        `;
        playersContainer.appendChild(playerDiv);
    });
}

// Function to submit score
function submitScore(playerIndex) {
    const scoreInput = document.getElementById(`score-${playerIndex}`);
    const score = parseInt(scoreInput.value);
    
    if (!isNaN(score)) {
        players[playerIndex].scores[currentHole - 1] = score;
        moveToNextHole();
    }
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
            if (score !== null) {
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
