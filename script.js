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
            scores: Array(maxHoles).fill(0), // Initialize scores with 0 for each hole
        });
        renderPlayers();
        document.getElementById('nextHoleButton').disabled = false; // Enable "Next Hole" button after first player is added
    }
});

// Function to render player names and score fields
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
        player.scores.forEach((score, holeIndex) => {
            let scoreDiv = document.createElement('div');
            scoreDiv.innerHTML = `
                <span>Hole ${holeIndex + 1}: </span>
                <button class="scoreButton" data-player-index="${index}" data-hole-index="${holeIndex}" onclick="adjustScore(${index}, ${holeIndex}, -1)">-</button>
                <span id="score-${index}-${holeIndex}">${score}</span>
                <button class="scoreButton" data-player-index="${index}" data-hole-index="${holeIndex}" onclick="adjustScore(${index}, ${holeIndex}, 1)">+</button>
                <button class="scratchButton" data-player-index="${index}" data-hole-index="${holeIndex}" onclick="addScratch(${index}, ${holeIndex})">Scratch</button>
            `;
            holeScoresDiv.appendChild(scoreDiv);
        });
        playerDiv.appendChild(holeScoresDiv);
        playersDiv.appendChild(playerDiv);
    });
}

// Adjust the score for a specific hole
function adjustScore(playerIndex, holeIndex, delta) {
    let player = players[playerIndex];
    player.scores[holeIndex] += delta;
    if (player.scores[holeIndex] < 0) player.scores[holeIndex] = 0; // Prevent negative scores
    renderPlayers();
}

// Add a Scratch (i.e. +3 to the score)
function addScratch(playerIndex, holeIndex) {
    let player = players[playerIndex];
    player.scores[holeIndex] += 3;
    renderPlayers();
}

// Move to the next hole
document.getElementById('nextHoleButton').addEventListener('click', function() {
    if (currentHole < maxHoles) {
        currentHole++;
        document.getElementById('nextHoleButton').disabled = currentHole >= maxHoles;
        renderBoxScore();
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
            tableRow.innerHTML += `<td>${player.scores[i]}</td>`;
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
