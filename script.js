let players = [];
let currentHole = 1; // Start with hole 1

// Function to add a player
function addPlayer(name) {
    players.push({ name: name, scores: Array(18).fill(0) }); // Initialize scores for 18 holes
    displayPlayers();
}

// Display players and scores for the current hole
function displayPlayers() {
    const playersDiv = document.getElementById('players');
    playersDiv.innerHTML = ''; // Clear previous player list to prevent duplicate rendering

    players.forEach((player, index) => {
        const playerDiv = document.createElement('div');
        playerDiv.classList.add('player');

        // Display player name
        playerDiv.innerHTML = `<div class="player-header">${player.name}</div>`;

        // Score and adjustment buttons for the current hole only
        const scoreDiv = document.createElement('div');
        scoreDiv.classList.add('hole-scores');
        scoreDiv.innerHTML = `
            Hole ${currentHole} Score: ${player.scores[currentHole - 1]}
            <button onclick="adjustScore(${index}, ${currentHole - 1}, 1)">+</button>
            <button onclick="adjustScore(${index}, ${currentHole - 1}, -1)">-</button>
            <button onclick="applyScratch(${index}, ${currentHole - 1})">Scratch</button>
        `;
        playerDiv.appendChild(scoreDiv);

        playersDiv.appendChild(playerDiv);
    });
}

// Adjust the score for the current hole
function adjustScore(playerIndex, holeIndex, adjustment) {
    // Adjust score and immediately update display
    players[playerIndex].scores[holeIndex] += adjustment;
    displayPlayers();
}

// Add scratch penalty (+3 points) to the current hole
function applyScratch(playerIndex, holeIndex) {
    players[playerIndex].scores[holeIndex] += 3;
    displayPlayers();
}

// Proceed to the next hole, preventing proceeding past hole 18
function nextHole() {
    if (currentHole < 18) {
        currentHole++;
        displayPlayers();
    } else {
        alert("Game Over");
        displayBoxScore();
    }
}

// Display box score at the end of the game or current hole status
function displayBoxScore() {
    const boxScoreDiv = document.getElementById('boxScore');
    boxScoreDiv.innerHTML = '<h2>Box Score</h2>';

    // Create table header dynamically based on current hole
    const table = document.createElement('table');
    let headerRow = '<tr><th>Player</th>';
    for (let i = 1; i <= currentHole; i++) {
        headerRow += `<th>Hole ${i}</th>`;
    }
    headerRow += '</tr>';
    table.innerHTML = headerRow;

    // Display scores up to the current hole for each player
    players.forEach(player => {
        let scoreRow = `<tr><td>${player.name}</td>`;
        for (let i = 0; i < currentHole; i++) {
            scoreRow += `<td>${player.scores[i]}</td>`;
        }
        scoreRow += '</tr>';
        table.innerHTML += scoreRow;
    });

    boxScoreDiv.appendChild(table);
}
