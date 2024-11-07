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
    if


