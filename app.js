const SERVER_ID = '3344761';
let playersOnlineNames = [];

// Obsługa okien modalnych
function toggleModal(modalId, show) {
    document.getElementById(modalId).style.display = show ? 'block' : 'none';
}

// Pobieranie danych z serwera Rust
async function fetchServerData() {
    try {
        const response = await fetch(`https://api.battlemetrics.com/servers/${SERVER_ID}?include=player`);
        const result = await response.json();
        
        // Aktualizacja UI nagłówka
        document.getElementById('serverName').innerText = result.data.attributes.name;
        document.getElementById('onlineCount').innerText = `${result.data.attributes.players} / ${result.data.attributes.maxPlayers}`;
        
        // Lista graczy online do sprawdzania kropki statusu
        playersOnlineNames = (result.included || []).map(p => p.attributes.name.toLowerCase());
        
        renderTeams();
    } catch (e) {
        console.error("Błąd API BattleMetrics");
    }
}

// Tworzenie nowego teamu
function addTeam() {
    const name = document.getElementById('teamName').value;
    const grid = document.getElementById('baseGrid').value.toUpperCase();
    const pass = document.getElementById('leaderPass').value;
    const playersRaw = document.getElementById('teamPlayers').value;

    if (!name || !grid || !pass) return alert("Wypełnij wymagane pola (Nazwa, Kratka, Hasło)!");

    const playersArray = playersRaw.split(',').map(p => p.trim()).filter(p => p !== "");

    const teams = JSON.parse(localStorage.getItem('rust_manager_v7') || "[]");
    teams.push({
        name: name,
        grid: grid,
        pass: pass, // Hasło lidera
        players: playersArray
    });

    localStorage.setItem('rust_manager_v7', JSON.stringify(teams));

    // Czyszczenie i zamykanie
    toggleModal('teamModal', false);
    document.getElementById('teamName').value = "";
    document.getElementById('baseGrid').value = "";
    document.getElementById('leaderPass').value = "";
    document.getElementById('teamPlayers').value = "";
    
    renderTeams();
}

// Wyświetlanie kwadratowych kontenerów
function renderTeams() {
    const gridContainer = document.getElementById('teamsGrid');
    gridContainer.innerHTML = "";
    const teams = JSON.parse(localStorage.getItem('rust_manager_v7') || "[]");

    teams.forEach((team, index) => {
        const box = document.createElement('div');
        box.className = 'team-box';
        
        // Generowanie listy graczy ze statusem
        let playersListHTML = team.players.map(p => {
            const isOnline = playersOnlineNames.includes(p.toLowerCase());
            return `
                <div class="player-row">
                    <span>${p}</span>
                    <span class="status-dot" style="background-color: ${isOnline ? '#4CAF50' : '#ff4444'}"></span>
                </div>
            `;
        }).join('');

        box.innerHTML = `
            <button class="btn-edit-trigger" onclick="openEditModal(${index})">EDYCJA</button>
            <div class="grid-bg-text">${team.grid}</div>
            <h3>${team.name}</h3>
            <div class="players-content">
                ${playersListHTML || '<span style="color:#333">Brak dodanych graczy</span>'}
            </div>
        `;
        gridContainer.appendChild(box);
    });
}

// Otwieranie edycji
function openEditModal(index) {
    const teams = JSON.parse(localStorage.getItem('rust_manager_v7'));
    document.getElementById('editIndex').value = index;
    document.getElementById('editPlayers').value = teams[index].players.join(', ');
    document.getElementById('confirmPass').value = "";
    toggleModal('editModal', true);
}

// Zapisywanie edycji po weryfikacji hasła
function saveEdit() {
    const index = document.getElementById('editIndex').value;
    const enteredPass = document.getElementById('confirmPass').value;
    const playersNew = document.getElementById('editPlayers').value.split(',').map(p => p.trim()).filter(p => p);

    let teams = JSON.parse(localStorage.getItem('rust_manager_v7'));

    if (teams[index].pass !== enteredPass) {
        alert("BŁĘDNE HASŁO LIDERA! Nie możesz edytować tego teamu.");
        return;
    }

    teams[index].players = playersNew;
    localStorage.setItem('rust_manager_v7', JSON.stringify(teams));
    
    toggleModal('editModal', false);
    renderTeams();
}

// Usuwanie pojedynczego teamu
function deleteSingleTeam() {
    const index = document.getElementById('editIndex').value;
    const enteredPass = document.getElementById('confirmPass').value;
    let teams = JSON.parse(localStorage.getItem('rust_manager_v7'));

    if (teams[index].pass !== enteredPass) {
        alert("BŁĘDNE HASŁO! Nie masz uprawnień do usunięcia tego teamu.");
        return;
    }

    if (confirm("Czy na pewno chcesz usunąć ten team?")) {
        teams.splice(index, 1);
        localStorage.setItem('rust_manager_v7', JSON.stringify(teams));
        toggleModal('editModal', false);
        renderTeams();
    }
}

function clearAllTeams() {
    if(confirm("To usunie WSZYSTKIE drużyny z Twojej przeglądarki. Kontynuować?")) {
        localStorage.removeItem('rust_manager_v7');
        renderTeams();
    }
}

// Inicjalizacja
fetchServerData();
setInterval(fetchServerData, 30000); // Odświeżaj statusy co 30 sekund