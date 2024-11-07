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
            scores: Array(18).fill(0), // Initialize scores for 18 holes with 0 (zero score)
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

    players[playerIndex].scores[holeIndex] += change;
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
    
    // Create a table for the box score
    let table = '<table><thead><tr><th>Player</th>';
    
    // Add headers for each hole
    for (let i = 1; i <= currentHole; i++) {
        table += `<th>Hole ${i}</th>`;
    }
    table += `<th>Total</th></tr></thead><tbody>`;

    players.forEach(player => {
        let totalScore = 0;
        table += `<tr><td>${player.name}</td>`;
        
        // Display scores for holes played up to and including the current hole
        for (let i = 0; i < currentHole; i++) {
            table += `<td>${player.scores[i]}</td>`;
            totalScore += player.scores[i];
        }

        table += `<td>${totalScore}</td></tr>`;
    });
    
    table += '</tbody></table>';
    scoreDetails.innerHTML = table;
    
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

