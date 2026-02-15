const firebaseConfig = {
    apiKey: "AIzaSyB74-e1hA8JW31YhdR_ZwgF-wfKdb3aqL4",
    authDomain: "ruscik-159d4.firebaseapp.com",
    projectId: "ruscik-159d4",
    storageBucket: "ruscik-159d4.firebasestorage.app",
    messagingSenderId: "127501998256",
    appId: "1:127501998256:web:99a73947e20f1eecb2c375"
};

// INITIALIZE
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const SERVER_ID = '3344761';

let tempPlayers = [];
let onlinePlayers = [];
let editingTeamId = null;

// --- MODALS & UI ---
function toggleModal(id, show) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = show ? 'block' : 'none';
        if (!show && id === 'teamModal') resetTeamForm();
    }
}

function switchAuthTab(mode) {
    const isLogin = mode === 'login';
    document.getElementById('nickGroup').style.display = isLogin ? 'none' : 'block';
    document.getElementById('tab-login').classList.toggle('active', isLogin);
    document.getElementById('tab-register').classList.toggle('active', !isLogin);
}

// --- AUTHENTICATION ---
async function handleAuth() {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;
    const nick = document.getElementById('authNick').value;
    const isLogin = document.getElementById('tab-login').classList.contains('active');
    try {
        if (isLogin) {
            await auth.signInWithEmailAndPassword(email, pass);
        } else {
            if (!nick) return alert("Podaj nick!");
            const res = await auth.createUserWithEmailAndPassword(email, pass);
            await res.user.updateProfile({ displayName: nick });
            await res.user.sendEmailVerification();
            alert("Zweryfikuj e-mail!");
        }
        toggleModal('authModal', false);
    } catch (e) { alert(e.message); }
}

async function loginWithGoogle() {
    try {
        await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
        toggleModal('authModal', false);
    } catch (e) { alert(e.message); }
}

function logoutUser() { auth.signOut().then(() => location.reload()); }

// --- SERVER STATUS & ONLINE PLAYERS ---
async function updateServerStatus() {
    try {
        const res = await fetch(`https://api.battlemetrics.com/servers/${SERVER_ID}?include=player`);
        const data = await res.json();
        document.getElementById('serverName').innerText = data.data.attributes.name;
        document.getElementById('onlineCount').innerText = `${data.data.attributes.players}/${data.data.attributes.maxPlayers}`;
        if (data.included) {
            onlinePlayers = data.included.map(p => p.attributes.name.toLowerCase());
        }
    } catch (e) { console.error(e); }
}

// --- PLAYER DETAILS (KDA / STATS) ---
function showPlayerDetails(nick) {
    const isOnline = onlinePlayers.includes(nick.toLowerCase());
    document.getElementById('modalPlayerName').innerText = nick;
    document.getElementById('modalPlayerStatus').innerText = isOnline ? "ONLINE" : "OFFLINE";
    document.getElementById('modalPlayerStatus').style.color = isOnline ? "#4CAF50" : "#666";
    
    // Przekierowanie do globalnych statystyk na BattleMetrics
    const bmUrl = `https://www.battlemetrics.com/players?filter[search]=${encodeURIComponent(nick)}`;
    document.getElementById('btnPlayerStats').onclick = () => window.open(bmUrl, '_blank');
    
    toggleModal('playerModal', true);
}

// --- TEAM MANAGEMENT ---
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
            
            const membersHTML = t.members.map(m => {
                const isOnline = onlinePlayers.includes(m.toLowerCase());
                // Dodajemy onclick="showPlayerDetails"
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
                    <div class="team-card-members">
                        <label style="font-size:10px; color:#444;">SKŁAD (KLIKNIJ PO STATY):</label>
                        ${membersHTML}
                    </div>
                </div>`;
        });
    });
}

// FORM LOGIC
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

document.getElementById('playerInput')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const nick = this.value.trim();
        if (nick && !tempPlayers.includes(nick)) {
            tempPlayers.push(nick);
            renderTags();
        }
        this.value = '';
    }
});

function renderTags() {
    document.getElementById('playersTagsList').innerHTML = tempPlayers.map((p, i) => `
        <div class="player-tag">${p} <span class="remove-tag" onclick="removePlayer(${i})">×</span></div>
    `).join('');
}

function removePlayer(i) {
    tempPlayers.splice(i, 1);
    renderTags();
}

async function prepareEditTeam(id) {
    editingTeamId = id;
    const doc = await db.collection("teams").doc(id).get();
    const data = doc.data();
    document.getElementById('teamName').value = data.name;
    document.getElementById('baseGrid').value = data.grid;
    tempPlayers = [...data.members];
    renderTags();
    if (data.avatar) {
        const img = document.getElementById('avatarPreview');
        img.src = data.avatar;
        img.style.display = 'block';
        document.getElementById('avatarPlaceholder').style.display = 'none';
    }
    document.querySelector('#teamModal .rust-title').innerText = "⚙️ EDYTUJ DRUŻYNĘ";
    toggleModal('teamModal', true);
}

async function saveTeam() {
    const user = auth.currentUser;
    const name = document.getElementById('teamName').value;
    const grid = document.getElementById('baseGrid').value;
    const avatar = document.getElementById('avatarPreview').src;
    if (!user || !name || !grid) return alert("Uzupełnij dane!");
    const data = {
        name, grid, avatar, members: tempPlayers,
        leaderId: user.uid, leaderNick: user.displayName || user.email,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
        if (editingTeamId) {
            await db.collection("teams").doc(editingTeamId).update(data);
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection("teams").add(data);
        }
        toggleModal('teamModal', false);
    } catch (e) { alert(e.message); }
}

function resetTeamForm() {
    editingTeamId = null;
    tempPlayers = [];
    document.getElementById('teamName').value = "";
    document.getElementById('baseGrid').value = "";
    document.getElementById('avatarPreview').src = "";
    document.getElementById('avatarPreview').style.display = 'none';
    document.getElementById('avatarPlaceholder').style.display = 'block';
    document.getElementById('playersTagsList').innerHTML = "";
    document.querySelector('#teamModal .rust-title').innerText = "🛡️ UTWÓRZ DRUŻYNĘ";
}

// MONITOR STATE
auth.onAuthStateChanged(user => {
    document.getElementById('btnCreateTeam').style.display = user ? 'inline-block' : 'none';
    document.getElementById('authButtons').style.display = user ? 'none' : 'block';
    document.getElementById('userInfo').style.display = user ? 'flex' : 'none';
    if(user) document.getElementById('userDisplayName').innerText = user.displayName || user.email;
    loadTeams();
});

// START
updateServerStatus();
setInterval(updateServerStatus, 30000);
