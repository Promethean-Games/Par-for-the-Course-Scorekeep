let players = JSON.parse(localStorage.getItem("players")) || [];
let currentHole = localStorage.getItem("currentHole") ? parseInt(localStorage.getItem("currentHole")) : 1;
let gameEnded = localStorage.getItem("gameEnded") === "true";

function Player(name) {
    this.name = name;
    this.scores = Array(18).fill(0);
}

function saveGameState() {
    localStorage.setItem("players", JSON.stringify(players));
    localStorage.setItem("currentHole", currentHole);
    localStorage.setItem("gameEnded", gameEnded);
}

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

    saveGameState();
}

document.getElementById("add-player").addEventListener("click", () => {
    const playerName = prompt("Enter player's name:");
    if (playerName && !gameEnded) {
        players.push(new Player(playerName));
        renderPlayers();
    }
});

function updateScore(playerIndex, change) {
    if (!gameEnded) {
        players[playerIndex].scores[currentHole - 1] += change;
        renderPlayers();
    }
}

function scratch(playerIndex) {
    if (!gameEnded) {
        players[playerIndex].scores[currentHole - 1] += 3;
        renderPlayers();
    }
}

function calculateTotalScore(player) {
    return player.scores.slice(0, currentHole).reduce((total, score) => total + score, 0);
}

document.getElementById("next-hole").addEventListener("click", () => {
    if (currentHole < 18 && !gameEnded) {
        currentHole++;
        renderPlayers();
    } else if (currentHole === 18) {
        alert("You've reached the last hole. Consider ending the game.");
    }
});

document.getElementById("reset-game").addEventListener("click", () => {
    if (confirm("Are you sure you want to reset the game?")) {
        players = [];
        currentHole = 1;
        gameEnded = false;
        localStorage.clear();
        renderPlayers();
    }
});

document.getElementById("game-over").addEventListener("click", () => {
    if (!gameEnded && confirm("Are you sure you want to end the game? This will lock scores.")) {
        gameEnded = true;
        saveGameState();
        displayBoxScore();
    }
});

function displayBoxScore() {
    const boxScoreDiv = document.getElementById("box-score");
    boxScoreDiv.innerHTML = "<h2>Game Over - Box Score</h2>";
    
    const table = document.createElement("table");
    const headers = `<tr><th>Player</th>${Array.from({ length: currentHole }, (_, i) => `<th>Hole ${i + 1}</th>`).join('')}<th>Total</th></tr>`;
    table.innerHTML = headers;
    
    players.forEach(player => {
        const row = document.createElement("tr");
        const scoreCells = player.scores.slice(0, currentHole).map(score => `<td>${score}</td>`).join('');
        row.innerHTML = `<td>${player.name}</td>${scoreCells}<td>${calculateTotalScore(player)}</td>`;
        table.appendChild(row);
    });
    
    boxScoreDiv.appendChild(table);
    boxScoreDiv.style.display = "block";
    document.getElementById("players").style.display = "none";
}

renderPlayers();
