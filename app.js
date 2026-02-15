// CONFIGURATION
const STEAM_API_KEY = '090699396578741373E4C20915BC617A';
const SERVER_ID = '3344761';

const firebaseConfig = {
    apiKey: "AIzaSyB74-e1hA8JW31YhdR_ZwgF-wfKdb3aqL4",
    authDomain: "ruscik-159d4.firebaseapp.com",
    projectId: "ruscik-159d4",
    storageBucket: "ruscik-159d4.firebasestorage.app",
    messagingSenderId: "127501998256",
    appId: "1:127501998256:web:99a73947e20f1eecb2c375"
};

// INITIALIZE FIREBASE
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let rawPlayerData = []; 
let onlinePlayersNicks = [];
let tempPlayers = [];
let editingTeamId = null;

// --- BATTLEMETRICS & STEAM LOGIC ---

async function updateServerStatus() {
    try {
        const res = await fetch(`https://api.battlemetrics.com/servers/${SERVER_ID}?include=player`);
        const data = await res.json();
        
        const serverNameEl = document.getElementById('serverName');
        const onlineCountEl = document.getElementById('onlineCount');
        
        if (serverNameEl) serverNameEl.innerText = data.data.attributes.name;
        if (onlineCountEl) onlineCountEl.innerText = `${data.data.attributes.players}/${data.data.attributes.maxPlayers}`;
        
        if (data.included) {
            rawPlayerData = data.included; 
            onlinePlayersNicks = data.included.map(p => p.attributes.name.toLowerCase());
        }
    } catch (e) { 
        console.error("Błąd pobierania danych serwera:", e); 
    }
}

async function showPlayerDetails(nick) {
    const tableBody = document.getElementById('playerStatsBody');
    const modalName = document.getElementById('modalPlayerName');
    
    if (modalName) modalName.innerText = nick.toUpperCase();
    if (tableBody) tableBody.innerHTML = "<tr><td colspan='2' style='text-align:center;'>Generowanie raportu...</td></tr>";
    
    toggleModal('playerModal', true);

    const playerBM = rawPlayerData.find(p => p.attributes.name.toLowerCase() === nick.toLowerCase());

    if (playerBM) {
        const playTime = Math.floor(playerBM.attributes.start / 60); 
        const country = playerBM.attributes.country || 'Nieznany';
        
        // Wykorzystujemy SteamID.io jako silnik sprawdzający, ponieważ bezpośrednie 
        // pobieranie avatarów przez JS ze Steama jest blokowane (CORS).
        const steamSearchUrl = `https://steamid.io/lookup/${encodeURIComponent(nick)}`;

        tableBody.innerHTML = `
            <tr><td>STATUS</td><td class="stat-val" style="color:#4CAF50">ONLINE</td></tr>
            <tr><td>CZAS SESJI</td><td class="stat-val">${playTime} min</td></tr>
            <tr><td>KRAJ</td><td class="stat-val">${country}</td></tr>
            <tr><td>IDENTYFIKATOR BM</td><td class="stat-val">${playerBM.id}</td></tr>
            <tr>
                <td colspan="2" style="padding-top:20px;">
                    <button class="btn-rust-main" onclick="window.open('${steamSearchUrl}', '_blank')">
                        AUTO-WYSZUKIWANIE STEAM
                    </button>
                </td>
            </tr>
        `;
    } else {
        tableBody.innerHTML = `
            <tr><td>STATUS</td><td class="stat-val" style="color:#666">OFFLINE</td></tr>
            <tr><td colspan="2" style="font-size:12px; color:#555; text-align:center; padding:20px;">
                Gracz nie jest obecnie na serwerze. Dane sesji wygasły.
            </td></tr>
        `;
    }
}

// --- UI & MODALS ---

function toggleModal(id, show) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = show ? 'block' : 'none';
        if (!show && id === 'teamModal') resetTeamForm();
    }
}

function switchAuthTab(mode) {
    const isLogin = mode === 'login';
    const nickGrp = document.getElementById('nickGroup');
    if (nickGrp) nickGrp.style.display = isLogin ? 'none' : 'block';
    
    const tabLog = document.getElementById('tab-login');
    const tabReg = document.getElementById('tab-register');
    if (tabLog) tabLog.classList.toggle('active', isLogin);
    if (tabReg) tabReg.classList.toggle('active', !isLogin);
}

// --- FIREBASE AUTH & TEAMS ---

async function handleAuth() {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;
    const nick = document.getElementById('authNick')?.value;
    const isLogin = document.getElementById('tab-login')?.classList.contains('active');

    try {
        if (isLogin) {
            await auth.signInWithEmailAndPassword(email, pass);
        } else {
            const res = await auth.createUserWithEmailAndPassword(email, pass);
            await res.user.updateProfile({ displayName: nick });
            alert("Konto utworzone!");
        }
        toggleModal('authModal', false);
    } catch (e) { alert(e.message); }
}

function loadTeams() {
    db.collection("teams").orderBy("createdAt", "desc").onSnapshot(snap => {
        const grid = document.getElementById('teamsGrid');
        if (!grid) return;
        grid.innerHTML = "";
        const currentUser = auth.currentUser;

        snap.forEach(doc => {
            const t = doc.data();
            const id = doc.id;
            const isLeader = currentUser && t.leaderId === currentUser.uid;
            
            const membersHTML = (t.members || []).map(m => {
                const isOnline = onlinePlayersNicks.includes(m.toLowerCase());
                return `
                    <div class="member-row" onclick="showPlayerDetails('${m}')">
                        <span>${m}</span>
                        <span class="status-indicator ${isOnline ? 'status-online' : 'status-offline'}"></span>
                    </div>`;
            }).join('');

            grid.innerHTML += `
                <div class="team-card">
                    <div class="team-card-header">
                        <img class="team-card-logo" src="${t.avatar || 'https://via.placeholder.com/60'}">
                        <div class="team-card-info">
                            <h3>${t.name}</h3>
                            <span class="team-card-grid">GRID: ${t.grid}</span>
                        </div>
                        ${isLeader ? `<span class="edit-icon" onclick="prepareEditTeam('${id}')">⚙️</span>` : ''}
                    </div>
                    <div class="team-card-members">${membersHTML}</div>
                </div>`;
        });
    });
}

// Reszta logiki zapisu/resetu teamu...
function resetTeamForm() {
    editingTeamId = null; tempPlayers = [];
    const fields = ['teamName', 'baseGrid', 'playerInput'];
    fields.forEach(f => { if(document.getElementById(f)) document.getElementById(f).value = ""; });
    const preview = document.getElementById('avatarPreview');
    if(preview) preview.style.display = 'none';
}

function logoutUser() { auth.signOut().then(() => location.reload()); }

auth.onAuthStateChanged(user => {
    const btnCreate = document.getElementById('btnCreateTeam');
    if(btnCreate) btnCreate.style.display = user ? 'inline-block' : 'none';
    if(document.getElementById('authButtons')) document.getElementById('authButtons').style.display = user ? 'none' : 'block';
    if(document.getElementById('userInfo')) document.getElementById('userInfo').style.display = user ? 'flex' : 'none';
    if(user && document.getElementById('userDisplayName')) document.getElementById('userDisplayName').innerText = user.displayName || user.email;
    loadTeams();
});

// START
updateServerStatus();
setInterval(updateServerStatus, 30000);
