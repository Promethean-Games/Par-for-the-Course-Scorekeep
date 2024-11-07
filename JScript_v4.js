let players = JSON.parse(localStorage.getItem("players")) || [];
let currentHole = localStorage.getItem("currentHole") ? parseInt(localStorage.getItem("currentHole")) : 1;
let gameEnded = localStorage.getItem("gameEnded") === "true";

// Player constructor function
function Player(name) {
    this.name = name;
    this.scores = Array(18).fill(0); // Set scores for all 18 holes
}

// Save game state to localStorage
function saveGameState() {
    localStorage.setItem("players", JSON.stringify(players));
    localStorage.setItem("currentHole", currentHole);
    localStorage.setItem("gameEnded", gameEnded);
}

// Initialize the players' display
function renderPlayers() {
    if (gameEnded) {
        displayBoxScore();
        return;
    }

    const playersDiv = document.getElementById("players");
    playersDiv.innerHTML = "";

    players.forEach((player, index) => {
        const playerDiv = document.createElement("div");
        playerDiv.classList.add("player");

        playerDiv.innerHTML = `
            <h2>${player.name}</h2>
            <div>Hole ${currentHole} Score: ${player.scores[currentHole - 1]}</div>
            <div class="scores">
                <button onclick="updateScore(${index}, -1)">-</button>
                <button onclick="updateScore(${index}, 1)">+</button>
                <button onclick="scratch(${index})">Scratch (+3)</button>
            </div>
            <div>Total Score: ${calculateTotalScore(player)}</div>
        `;

        playersDiv.appendChild(playerDiv);
    });

    // Save game state after rendering
    saveGameState();
}

// Add a new player
document.getElementById("add-player").addEventListener("click", () => {
    const playerName = prompt("Enter player's name:");
    if (playerName && !gameEnded) {
        players.push(new Player(playerName));
        renderPlayers();
    }
});

// Update a player's score for the current hole
function updateScore(playerIndex, change) {
    if (!gameEnded) {
        players[playerIndex].scores[currentHole - 1] += change;
        renderPlayers();
    }
}

// Mark a scratch (+3 strokes) for a player
function scratch(playerIndex) {
    if (!gameEnded) {
        players[playerIndex].scores[currentHole - 1] += 3;
        renderPlayers();
    }
}

// Calculate a player's total score
function calculateTotalScore(player) {
    return player.scores.slice(0, currentHole).reduce((total, score) => total + score, 0);
}

// Move to the next hole
document.getElementById("next-hole").addEventListener("click", () => {
    if (currentHole < 18 && !gameEnded) {
        currentHole++;
        renderPlayers();
    } else if (currentHole === 18) {
        alert("You've reached the last hole. Consider ending the game.");
    }
});

// Reset the game
document.getElementById("reset-game").addEventListener("click", () => {
    if (confirm("Are you sure you want to reset the game?")) {
        players = [];
        currentHole = 1;
        gameEnded = false;
        localStorage.clear();
        renderPlayers();
    }
});

// Handle "Game Over" and display box score
document.getElementById("game-over").addEventListener("click", () => {
    if (!gameEnded && confirm("Are you sure you want to end the game? This will lock scores.")) {
        gameEnded = true;
        saveGameState();
        displayBoxScore();
    }
});

// Display the box score
function displayBoxScore() {
    const boxScoreDiv = document.getElementById("box-score");
    boxScoreDiv.innerHTML = "<h2>Game Over - Box Score</h2>";
    
    // Create a table to show the scores
    const table = document.createElement("table");
    
    // Only show columns for holes played (up to currentHole)
    const headers = `<tr><th>Player</th>${Array.from({ length: currentHole }, (_, i) => `<th>Hole ${i + 1}</th>`).join('')}<th>Total</th></tr>`;
    table.innerHTML = headers;
    
    players.forEach(player => {
        const row = document.createElement("tr");
        // Only display scores for completed holes
        const scoreCells = player.scores.slice(0, currentHole).map(score => `<td>${score}</td>`).join('');
        row.innerHTML = `<td>${player.name}</td>${scoreCells}<td>${calculateTotalScore(player)}</td>`;
        table.appendChild(row);
    });
    
    boxScoreDiv.appendChild(table);
    boxScoreDiv.style.display = "block"; // Show the box score
    document.getElementById("players").style.display = "none"; // Hide the main player UI
}

// Load the initial state
renderPlayers();
