// Initialize variables
let players = [];
let currentHole = 0; // Track the current hole being scored
const totalHoles = 18; // Total number of holes in the game

// Load saved game state from local storage
function loadGame() {
    const savedPlayers = localStorage.getItem("players");
    if (savedPlayers) {
        players = JSON.parse(savedPlayers);
    }
    displayPlayers();
}

// Save current game state to local storage
function saveGame() {
    localStorage.setItem("players", JSON.stringify(players));
}

// Display the list of players and their scores
function displayPlayers() {
    const playersContainer = document.getElementById("players");
    playersContainer.innerHTML = ""; // Clear the existing display

    players.forEach((player, playerIndex) => {
        const playerDiv = document.createElement("div");
        playerDiv.classList.add("player");

        const header = document.createElement("div");
        header.classList.add("player-header");
        header.innerHTML = `<strong>${player.name}</strong>`;

        const buttonGroup = document.createElement("div");
        buttonGroup.classList.add("button-group");

        // Display only the current hole score for each player
        const holeScoresDiv = document.createElement("div");
        holeScoresDiv.classList.add("hole-scores");

        const holeScoreDiv = document.createElement("div");
        holeScoreDiv.classList.add("hole-score");

        // Display the current hole score for the player
        holeScoreDiv.innerHTML = `
            <span>Hole ${currentHole + 1}: ${player.scores[currentHole] || 0}</span>
            <button onclick="changeScore(${playerIndex}, 1)">+</button>
            <button onclick="changeScore(${playerIndex}, -1)">-</button>
            <button onclick="scratch(${playerIndex})">Scratch</button>
        `;
        holeScoresDiv.appendChild(holeScoreDiv);

        playerDiv.appendChild(header);
        playerDiv.appendChild(holeScoresDiv);
        playersContainer.appendChild(playerDiv);
    });

    saveGame();
}

// Add a new player
function addPlayer() {
    const playerName = prompt("Enter player's name:");
    if (playerName) {
        const newPlayer = {
            name: playerName,
            scores: Array(currentHole + 1).fill(0) // Initialize scores for current holes
        };
        players.push(newPlayer);
        displayPlayers();
}

// Change the score of the current hole for a player
function changeScore(playerIndex, delta) {
    players[playerIndex].scores[currentHole] = (players[playerIndex].scores[currentHole] || 0) + delta;
    displayPlayers();
}

// Add 3 strokes to a player's score for the current hole as a "Scratch"
function scratch(playerIndex) {
    players[playerIndex].scores[currentHole] = (players[playerIndex].scores[currentHole] || 0) + 3;
    displayPlayers();
}

// Move to the next hole
function nextHole() {
    if (currentHole >= totalHoles - 1) {
        alert("The game is over!");
        return;
    }

    currentHole++; // Increment to the next hole

    // Add new hole scores for all players (if needed)
    players.forEach(player => {
        if (player.scores.length <= currentHole) {
            player.scores.push(0); // Add the new hole with an initial score of 0
        }
    });

    displayPlayers();
}

// Reset all player scores
function resetScores() {
    players.forEach(player => {
        player.scores = Array(currentHole + 1).fill(0); // Reset all scores to 0 for the current hole
    });
    displayPlayers();
}

// End the game and display the final scores in a box score format
function endGame() {
    const playersContainer = document.getElementById("players");
    playersContainer.innerHTML = "<h2>Game Over - Final Scores</h2>";

    players.forEach(player => {
        const playerDiv = document.createElement("div");
        playerDiv.classList.add("player");

        const header = document.createElement("div");
        header.classList.add("player-header");
        header.innerHTML = `<strong>${player.name}</strong>`;

        // Display all holes for the player
        const holeScoresDiv = document.createElement("div");
        holeScoresDiv.classList.add("hole-scores");

        player.scores.forEach((score, index) => {
            const holeScoreDiv = document.createElement("div");
            holeScoreDiv.classList.add("hole-score");
            holeScoreDiv.innerText = `Hole ${index + 1}: ${score}`;
            holeScoresDiv.appendChild(holeScoreDiv);
        });

        playerDiv.appendChild(header);
        playerDiv.appendChild(holeScoresDiv);
        playersContainer.appendChild(playerDiv);
    });

    // Clear the saved game state after game over
    localStorage.removeItem("players");
}

// Load game state on page load
window.onload = loadGame;
