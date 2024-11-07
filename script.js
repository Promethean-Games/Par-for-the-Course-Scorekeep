// Initialize variables
let players = [];
const totalHoles = 18;

// Load saved game state from local storage
function loadGame() {
    const savedPlayers = localStorage.getItem("players");
    if (savedPlayers) {
        players = JSON.parse(savedPlayers);
        displayPlayers();
    }
}

// Save current game state to local storage
function saveGame() {
    localStorage.setItem("players", JSON.stringify(players));
}

// Display the list of players and their scores
function displayPlayers() {
    const playersContainer = document.getElementById("players");
    playersContainer.innerHTML = "";

    players.forEach((player, playerIndex) => {
        const playerDiv = document.createElement("div");
        playerDiv.classList.add("player");

        const header = document.createElement("div");
        header.classList.add("player-header");
        header.innerHTML = `<strong>${player.name}</strong>`;

        const buttonGroup = document.createElement("div");
        buttonGroup.classList.add("button-group");

        // Display holes scores with plus/minus buttons and scratch button
        const holeScoresDiv = document.createElement("div");
        holeScoresDiv.classList.add("hole-scores");

        for (let i = 0; i < totalHoles; i++) {
            const holeScoreDiv = document.createElement("div");
            holeScoreDiv.classList.add("hole-score");

            // Display current score for the hole
            holeScoreDiv.innerHTML = `
                <span>Hole ${i + 1}: ${player.scores[i]}</span>
                <button onclick="changeScore(${playerIndex}, ${i}, 1)">+</button>
                <button onclick="changeScore(${playerIndex}, ${i}, -1)">-</button>
                <button onclick="scratch(${playerIndex}, ${i})">Scratch</button>
            `;
            holeScoresDiv.appendChild(holeScoreDiv);
        }

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
            scores: Array(totalHoles).fill(0) // Initialize scores for each hole
        };
        players.push(newPlayer);
        displayPlayers();
    }
}

// Change the score of a specific hole for a player
function changeScore(playerIndex, holeIndex, delta) {
    players[playerIndex].scores[holeIndex] += delta;
    displayPlayers();
}

// Add 3 strokes to a player's score for the specified hole as a "Scratch"
function scratch(playerIndex, holeIndex) {
    players[playerIndex].scores[holeIndex] += 3;
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

        // Display only completed holes
        const holeScoresDiv = document.createElement("div");
        holeScoresDiv.classList.add("hole-scores");

        player.scores.forEach((score, index) => {
            if (score > 0 || index < players[0].scores.findIndex(score => score === 0)) { // Only show played holes
                const holeScoreDiv = document.createElement("div");
                holeScoreDiv.classList.add("hole-score");
                holeScoreDiv.innerText = `Hole ${index + 1}: ${score}`;
                holeScoresDiv.appendChild(holeScoreDiv);
            }
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
