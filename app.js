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
let onlinePlayers = [];

// MODALE
function toggleModal(id, show) {
    document.getElementById(id).style.display = show ? 'block' : 'none';
}

function switchAuthTab(mode) {
    const isLogin = mode === 'login';
    document.getElementById('nickGroup').style.display = isLogin ? 'none' : 'block';
    document.getElementById('tab-login').classList.toggle('active', isLogin);
    document.getElementById('tab-register').classList.toggle('active', !isLogin);
}

// STATUS SERWERA I GRACZY
async function updateServerStatus() {
    try {
        const res = await fetch(`https://api.battlemetrics.com/servers/${SERVER_ID}?include=player`);
        const data = await res.json();
        document.getElementById('serverName').innerText = data.data.attributes.name;
        document.getElementById('onlineCount').innerText = `${data.data.attributes.players}/${data.data.attributes.maxPlayers}`;
        
        if (data.included) {
            onlinePlayers = data.included.map(p => p.attributes.name.toLowerCase());
        }
    } catch (e) { console.error("BM Error:", e); }
}

// POBIERANIE TEAMÓW I SPRAWDZANIE STATUSU
function loadTeams() {
    db.collection("teams").orderBy("createdAt", "desc").onSnapshot(snap => {
        const grid = document.getElementById('teamsGrid');
        grid.innerHTML = "";
        snap.forEach(doc => {
            const t = doc.data();
            const membersList = t.members.map(m => {
                const isOnline = onlinePlayers.includes(m.toLowerCase());
                return `<div class="member-row"><span>${m}</span><span class="status-indicator ${isOnline ? 'status-online' : 'status-offline'}"></span></div>`;
            }).join('');

            grid.innerHTML += `
                <div class="team-card">
                    <div class="team-card-header">
                        <img class="team-card-logo" src="${t.avatar || ''}">
                        <div class="team-card-info">
                            <h3>${t.name}</h3>
                            <span class="team-card-grid">GRID: ${t.grid}</span>
                        </div>
                    </div>
                    <div class="team-card-members">${membersList}</div>
                </div>`;
        });
    });
}

// LOGIKA FORMULARZA TEAMU
function handleAvatarPreview(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            const img = document.getElementById('avatarPreview');
            img.src = e.target.result;
            img.style.display = 'block';
            document.getElementById('avatarPlaceholder').style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

document.getElementById('playerInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const nick = this.value.trim();
        if (nick && !tempPlayers.includes(nick)) {
            tempPlayers.push(nick);
            document.getElementById('playersTagsList').innerHTML += `<div class="player-tag">${nick}</div>`;
        }
        this.value = '';
    }
});

async function saveTeam() {
    const user = auth.currentUser;
    const name = document.getElementById('teamName').value;
    const grid = document.getElementById('baseGrid').value;
    const avatar = document.getElementById('avatarPreview').src;
    if (!name || !grid) return alert("Uzupełnij dane!");

    await db.collection("teams").add({
        name, grid, avatar, members: tempPlayers,
        leaderId: user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    location.reload();
}

// AUTH
auth.onAuthStateChanged(user => {
    document.getElementById('btnCreateTeam').style.display = user ? 'inline-block' : 'none';
    document.getElementById('authButtons').style.display = user ? 'none' : 'block';
    document.getElementById('userInfo').style.display = user ? 'flex' : 'none';
    if(user) document.getElementById('userDisplayName').innerText = user.displayName || user.email;
});

// START
updateServerStatus().then(loadTeams);
setInterval(updateServerStatus, 30000);
