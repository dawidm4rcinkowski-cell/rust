// CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyB74-e1hA8JW31YhdR_ZwgF-wfKdb3aqL4",
    authDomain: "ruscik-159d4.firebaseapp.com",
    projectId: "ruscik-159d4",
    storageBucket: "ruscik-159d4.firebasestorage.app",
    messagingSenderId: "127501998256",
    appId: "1:127501998256:web:99a73947e20f1eecb2c375"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const SERVER_ID = '3344761';
let tempPlayers = [];
let onlinePlayersNames = []; // Tu będziemy trzymać listę graczy z BM

// --- SERWER & STATUS GRACZY ---
async function fetchServerStatus() {
    try {
        const res = await fetch(`https://api.battlemetrics.com/servers/${SERVER_ID}?include=player`);
        const data = await res.json();
        
        // Aktualizacja ogólnych statystyk
        document.getElementById('serverName').innerText = data.data.attributes.name;
        document.getElementById('onlineCount').innerText = `${data.data.attributes.players}/${data.data.attributes.maxPlayers}`;
        
        // Wyciąganie nicków graczy online
        if(data.included) {
            onlinePlayersNames = data.included.map(p => p.attributes.name.toLowerCase());
        }
    } catch (e) { console.error(e); }
}

// --- ZARZĄDZANIE DRUŻYNAMI (WYŚWIETLANIE) ---
function listenToTeams() {
    db.collection("teams").orderBy("createdAt", "desc").onSnapshot(snap => {
        const grid = document.getElementById('teamsGrid');
        grid.innerHTML = "";
        
        snap.forEach(doc => {
            const team = doc.data();
            const card = document.createElement('div');
            card.className = 'team-card';
            
            // Generowanie listy członków ze statusem
            const membersHTML = team.members.map(m => {
                const isOnline = onlinePlayersNames.includes(m.toLowerCase());
                return `
                    <div class="member-row">
                        <span>${m}</span>
                        <span class="status-indicator ${isOnline ? 'status-online' : 'status-offline'}"></span>
                    </div>
                `;
            }).join('');

            card.innerHTML = `
                <div class="team-card-header">
                    <img class="team-card-logo" src="${team.avatar || 'https://via.placeholder.com/50'}">
                    <div class="team-card-info">
                        <h3>${team.name}</h3>
                        <span class="team-card-grid">LOKALIZACJA: ${team.grid}</span>
                    </div>
                </div>
                <div class="team-card-members">
                    <label style="font-size:10px; color:#444; margin-bottom:5px;">SKŁAD:</label>
                    ${membersHTML}
                </div>
            `;
            grid.appendChild(card);
        });
    });
}

// --- TWORZENIE TEAMU ---
async function saveTeam() {
    const user = auth.currentUser;
    const name = document.getElementById('teamName').value;
    const grid = document.getElementById('baseGrid').value;
    const avatar = document.getElementById('avatarPreview').src;

    if(!user || !name) return alert("Błąd danych!");

    await db.collection("teams").add({
        name: name,
        grid: grid,
        avatar: avatar,
        members: tempPlayers,
        leaderId: user.uid,
        leaderNick: user.displayName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    tempPlayers = [];
    document.getElementById('playersTagsList').innerHTML = "";
    toggleModal('teamModal', false);
}

// Obsługa tagów i Enter
document.getElementById('playerInput')?.addEventListener('keypress', function(e) {
    if(e.key === 'Enter') {
        const val = this.value.trim();
        if(val && !tempPlayers.includes(val)) {
            tempPlayers.push(val);
            const tag = document.createElement('div');
            tag.className = 'player-tag';
            tag.innerHTML = `${val} <span onclick="this.parentElement.remove()">×</span>`;
            document.getElementById('playersTagsList').appendChild(tag);
        }
        this.value = "";
    }
});

function handleAvatarPreview(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('avatarPreview').src = e.target.result;
            document.getElementById('avatarPlaceholder').style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// --- START ---
fetchServerStatus().then(() => listenToTeams());
setInterval(fetchServerStatus, 30000); // Odświeżaj BM co 30s

// (Reszta funkcji auth: handleAuth, loginWithGoogle, switchAuthTab - skopiuj z poprzedniego pliku)
