let players = [];
let currentHole = 1;

// Player constructor function
function Player(name) {
    this.name = name;
    this.scores = Array(18).fill(0);
}

// Initialize the players' display
function renderPlayers() {
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
}

// Add a new player
document.getElementById("add-player").addEventListener("click", () => {
    const playerName = prompt("Enter player's name:");
    if (playerName) {
        players.push(new Player(playerName));
        renderPlayers();
    }
});

// Update a player's score for the current hole
function updateScore(playerIndex, change) {
    players[playerIndex].scores[currentHole - 1] += change;
    renderPlayers();
}

// Mark a scratch (+3 strokes) for a player
function scratch(playerIndex) {
    players[playerIndex].scores[currentHole - 1] += 3;
    renderPlayers();
}

// Calculate a player's total score
function calculateTotalScore(player) {
    return player.scores.reduce((total, score) => total + score, 0);
}

// Move to the next hole
document.getElementById("next-hole").addEventListener("click", () => {
    if (currentHole < 18) {
        currentHole++;
        renderPlayers();
    } else {
        alert("Game complete! No more holes.");
    }
});

// Reset the game
document.getElementById("reset-game").addEventListener("click", () => {
    if (confirm("Are you sure you want to reset the game?")) {
        players = [];
        currentHole = 1;
        renderPlayers();
    }
});

renderPlayers();
