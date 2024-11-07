// Variables to keep track of game state
let currentHole = 1;
let players = [];
let maxHoles = 18;

// Add Player - Prompt user for player's name
document.getElementById('addPlayerButton').addEventListener('click', function() {
    let playerName = prompt("Enter player name:");
    if (playerName) {
        players.push({
            name: playerName,
            scores: Array(maxHoles).fill(null), // Initialize scores with null (not played yet)
        });
        renderPlayers();
        document.getElementById('nextHoleButton').disabled = false; // Enable "Next Hole" button after first player is added
    }
});

// Function to render player names and score fields for the current hole
function renderPlayers() {
    let playersDiv = document.getElementById('players');
    playersDiv.innerHTML = '';
    players.forEach((player, index) => {
        let playerDiv = document.createElement('div');
        playerDiv.classList.add('player');
        
        let playerHeader = document.createElement('div');
        playerHeader.classList.add('player-header');
        playerHeader.innerText = player.name;
        playerDiv.appendChild(playerHeader);

        let holeScoresDiv = document.createElement('div');
        holeScoresDiv.classList.add('hole-scores');

        // Display score input for the current hole only
        if (player.scores[currentHole - 1] === null) { // Only show the input if no score yet
            let scoreDiv = document.createElement('div');
            scoreDiv.innerHTML = `
                <span>Hole ${currentHole}: </span>
                <button class="scoreButton" data-player-index="${index}" data-hole-index="${currentHole - 1}" onclick="adjustScore(${index}, ${currentHole - 1}, -1)">-</button>
                <span id="score-${index}-${currentHole - 1}">${player.scores[currentHole - 1] === null ? 'N/A' : player.scores[currentHole - 1]}</span>
                <button class="scoreButton" data-player-index="${index}" data-hole-index="${currentHole - 1}" onclick="adjustScore(${index}, ${currentHole - 1}, 1)">+</button>
                <button class="scratchButton" data-player-index="${index}" data-hole-index="${currentHole - 1}" onclick="addScratch(${index}, ${currentHole - 1})">Scratch</button>
            `;
            holeScoresDiv.appendChild(scoreDiv);
        }

        playerDiv.appendChild(holeScoresDiv);
        playersDiv.appendChild(playerDiv);
    });
}

// Adjust the score for a specific hole
function adjustScore(playerIndex, holeIndex, delta) {
    let player = players[playerIndex];
    player.scores[holeIndex] = player.scores[holeIndex] === null ? delta : player.scores[holeIndex] + delta; // If score is null, initialize with delta value
    if (player.scores[holeIndex] < 0) player.scores[holeIndex] = 0; // Prevent negative scores
    renderPlayers();
}

// Add a Scratch (i.e. +3 to the score)
function addScratch(playerIndex, holeIndex) {
    let player = players[playerIndex];
    player.scores[holeIndex] = player.scores[holeIndex] === null ? 3 : player.scores[holeIndex] + 3;
    renderPlayers();
}

// Move to the next hole
document.getElementById('nextHoleButton').addEventListener('click', function() {
    if (currentHole < maxHoles) {
        currentHole++;
        renderPlayers();
        renderBoxScore(); // Update box score with the new hole
        document.getElementById('nextHoleButton').disabled = currentHole >= maxHoles;
    }
});

// Render Box Score
function renderBoxScore() {
    let boxScoreDiv = document.getElementById('boxScore');
    boxScoreDiv.innerHTML = '<h2>Box Score</h2>';

    let table = document.createElement('table');
    let tableHeader = document.createElement('tr');
    tableHeader.innerHTML = `<th>Player</th>`;
    for (let i = 0; i < currentHole; i++) {
        tableHeader.innerHTML += `<th>Hole ${i + 1}</th>`;
    }
    table.appendChild(tableHeader);

    players.forEach(player => {
        let tableRow = document.createElement('tr');
        tableRow.innerHTML = `<td>${player.name}</td>`;
        for (let i = 0; i < currentHole; i++) {
            tableRow.innerHTML += `<td>${player.scores[i] !== null ? player.scores[i] : 'N/A'}</td>`;
        }
        table.appendChild(tableRow);
    });

    boxScoreDiv.appendChild(table);
}

// Reset the game
document.getElementById('resetButton').addEventListener('click', function() {
    location.reload(); // Reload the page for a clean slate
});

// End the game
document.getElementById('gameOverButton').addEventListener('click', function() {
    if (confirm("Are you sure you want to end the game?")) {
        renderBoxScore();
    }
});
