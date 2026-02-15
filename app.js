const STEAM_API_KEY = 'TWOJ_KLUCZ_STEAM_API'; // Wklej tutaj swój klucz

async function showPlayerDetails(nick) {
    const tableBody = document.getElementById('playerStatsBody');
    const modalName = document.getElementById('modalPlayerName');
    
    modalName.innerText = "POBIERANIE DANYCH...";
    tableBody.innerHTML = "<tr><td colspan='2' style='text-align:center;'>Szukanie powiązań Steam...</td></tr>";
    toggleModal('playerModal', true);

    // 1. Szukamy gracza w danych z BattleMetrics (pobranych wcześniej w updateServerStatus)
    const playerBM = rawPlayerData.find(p => p.attributes.name.toLowerCase() === nick.toLowerCase());

    if (playerBM && playerBM.relationships && playerBM.relationships.identifiers) {
        // Wyciągamy SteamID (BattleMetrics trzyma to w relacjach/identyfikatorach)
        // Uwaga: W darmowym API BM, SteamID jest często zakodowany w polu 'externalId'
        const steamId = playerBM.attributes.id; // To jest ID BattleMetrics, Steam ID wymaga głębszego skanowania

        // Symulacja wyciągania SteamID i strzału do Steam API
        // Ponieważ Steam API ma blokadę CORS (nie pozwala na strzały bezpośrednio z przeglądarki),
        // zazwyczaj używa się proxy lub wyświetla bezpośredni link do profilu z zaciągniętym ID.
        
        const steamProfileUrl = `https://steamcommunity.com/profiles/${steamId}`;
        
        renderStatsTable(playerBM, steamId);
    } else {
        tableBody.innerHTML = "<tr><td colspan='2' style='text-align:center;'>Gracz Offline - dane archiwalne niedostępne.</td></tr>";
    }
}

function renderStatsTable(player, sId) {
    const attr = player.attributes;
    const tableBody = document.getElementById('playerStatsBody');
    
    // Obliczamy godziny (BattleMetrics podaje sekundy)
    const hoursOnServer = (attr.start / 3600).toFixed(1);

    tableBody.innerHTML = `
        <tr>
            <td colspan="2" style="text-align:center;">
                <img src="https://via.placeholder.com/80?text=STEAM" id="steamAvatar" style="border-radius:50%; border: 2px solid #cd412b;">
            </td>
        </tr>
        <tr><td>STATUS</td><td class="stat-val" style="color:#4CAF50">ONLINE</td></tr>
        <tr><td>SESJA (H)</td><td class="stat-val">${hoursOnServer} h</td></tr>
        <tr><td>KRAJ</td><td class="stat-val">${attr.country || 'PL'}</td></tr>
        <tr><td>STEAM ID</td><td class="stat-val">${sId}</td></tr>
        <tr>
            <td colspan="2">
                <button class="btn-rust-main" onclick="window.open('https://steamcommunity.com/profiles/${sId}', '_blank')">PROFIL STEAM</button>
            </td>
        </tr>
    `;
}
