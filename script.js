// Assume players and scores are stored like this:
let players = [];
let currentHole = 1;

// Function to add player
function addPlayer(name) {
    players.push({ name: name, scores: Array(18).fill(0) }); // Initialize 18 holes with a score of 0
    displayPlayers();
}

// Function to display players and scores
function displayPlayers() {
    const playersDiv = document.getElementById('players');
    playersDiv.innerHTML = ''; // Clear previous content

    players.forEach((player, index) => {
        const playerDiv = document.createElement('div');
        playerDiv.classList.add('player');
        
        // Player header
        playerDiv.innerHTML = `<div class="player-header">${player.name}</div>`;

        // Display hole score and add +/- buttons for the current hole
        const scoreDiv = document.createElement('div');
        scoreDiv.classList.add('hole-scores');
        scoreDiv.innerHTML = `
            Hole ${currentHole}: ${player.scores[currentHole - 1]}
            <button onclick="adjustScore(${index}, ${currentHole - 1}, 1)">+</button>
            <button onclick="adjustScore(${index}, ${currentHole - 1}, -1)">-</button>
            <button onclick="applyScratch(${index}, ${currentHole - 1})">Scratch</button>
        `;
        playerDiv.appendChild(scoreDiv);

        playersDiv.appendChild(playerDiv);
    });
}

// Adjust the score for a specific hole
function adjustScore(playerIndex, holeIndex, adjustment) {
    players[playerIndex].scores[holeIndex] += adjustment;
    displayPlayers(); // Update display after adjustment
}

// Apply Scratch (adds +3 points to score)
function applyScratch(playerIndex, holeIndex) {
    players[playerIndex].scores[holeIndex] += 3;
    displayPlayers(); // Update display after scratch adjustment
}

// Example function to proceed to the next hole
function nextHole() {
    if (currentHole < 18) {
        currentHole++;
        displayPlayers(); // Update display to show next hole’s scoring
    } else {
        alert("Game Over");
        displayBoxScore();
    }
}

// Display box score at end of game
function displayBoxScore() {
    const boxScoreDiv = document.getElementById('boxScore');
    boxScoreDiv.innerHTML = '<h2>Box Score</h2>';

    const table = document.createElement('table');
    let headerRow = '<tr><th>Player</th>';
    for (let i = 1; i <= currentHole; i++) {
        headerRow += `<th>Hole ${i}</th>`;
    }
    headerRow += '</tr>';
    table.innerHTML = headerRow;

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
