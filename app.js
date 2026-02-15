const firebaseConfig = {
    apiKey: "AIzaSyB74-e1hA8JW31YhdR_ZwgF-wfKdb3aqL4",
    authDomain: "ruscik-159d4.firebaseapp.com",
    projectId: "ruscik-159d4",
    storageBucket: "ruscik-159d4.firebasestorage.app",
    messagingSenderId: "127501998256",
    appId: "1:127501998256:web:99a73947e20f1eecb2c375"
};

// INICJALIZACJA
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const SERVER_ID = '3344761';

let tempPlayers = [];
let onlinePlayers = [];

// --- FUNKCJE MODALI ---
function toggleModal(id, show) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = show ? 'block' : 'none';
}

function switchAuthTab(mode) {
    const isLogin = mode === 'login';
    const nickGroup = document.getElementById('nickGroup');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');

    if (nickGroup) nickGroup.style.display = isLogin ? 'none' : 'block';
    if (tabLogin) tabLogin.classList.toggle('active', isLogin);
    if (tabRegister) tabRegister.classList.toggle('active', !isLogin);
}

// --- LOGIKA AUTORYZACJI (NAPRAWIONE PRZYCISKI) ---
async function handleAuth() {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;
    const nick = document.getElementById('authNick').value;
    const isLogin = document.getElementById('tab-login').classList.contains('active');

    try {
        if (isLogin) {
            await auth.signInWithEmailAndPassword(email, pass);
        } else {
            if (!nick) return alert("Podaj swój nick!");
            const res = await auth.createUserWithEmailAndPassword(email, pass);
            await res.user.updateProfile({ displayName: nick });
            await res.user.sendEmailVerification();
            alert("Konto utworzone! Zweryfikuj e-mail.");
        }
        toggleModal('authModal', false);
    } catch (e) {
        alert("Błąd: " + e.message);
    }
}

async function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        toggleModal('authModal', false);
    } catch (e) {
        alert("Błąd Google: " + e.message);
    }
}

function logoutUser() {
    auth.signOut().then(() => {
        location.reload();
    });
}

// MONITOROWANIE STANU UŻYTKOWNIKA
auth.onAuthStateChanged(user => {
    const btnCreate = document.getElementById('btnCreateTeam');
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    const userNameDisplay = document.getElementById('userDisplayName');

    if (user) {
        if (authButtons) authButtons.style.display = 'none';
        if (userInfo) userInfo.style.display = 'flex';
        if (userNameDisplay) userNameDisplay.innerText = user.displayName || user.email;
        if (btnCreate) btnCreate.style.setProperty('display', 'inline-block', 'important');
    } else {
        if (authButtons) authButtons.style.display = 'block';
        if (userInfo) userInfo.style.display = 'none';
        if (btnCreate) btnCreate.style.display = 'none';
    }
});

// --- STATUS SERWERA I GRACZY ---
async function updateServerStatus() {
    try {
        const res = await fetch(`https://api.battlemetrics.com/servers/${SERVER_ID}?include=player`);
        const data = await res.json();
        
        const serverName = document.getElementById('serverName');
        const onlineCount = document.getElementById('onlineCount');
        
        if (serverName) serverName.innerText = data.data.attributes.name;
        if (onlineCount) onlineCount.innerText = `${data.data.attributes.players}/${data.data.attributes.maxPlayers}`;
        
        if (data.included) {
            onlinePlayers = data.included.map(p => p.attributes.name.toLowerCase());
        }
    } catch (e) {
        console.error("BattleMetrics Error:", e);
    }
}

// --- SYSTEM TEAMÓW ---
function loadTeams() {
    db.collection("teams").orderBy("createdAt", "desc").onSnapshot(snap => {
        const grid = document.getElementById('teamsGrid');
        if (!grid) return;
        grid.innerHTML = "";
        
        snap.forEach(doc => {
            const t = doc.data();
            const membersList = t.members.map(m => {
                const isOnline = onlinePlayers.includes(m.toLowerCase());
                return `
                    <div class="member-row">
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
                    </div>
                    <div class="team-card-members">
                        <label style="font-size:10px; color:#444;">SKŁAD:</label>
                        ${membersList}
                    </div>
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

// Dodawanie członków (Enter)
const playerInput = document.getElementById('playerInput');
if (playerInput) {
    playerInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const nick = this.value.trim();
            if (nick && !tempPlayers.includes(nick)) {
                tempPlayers.push(nick);
                const tagsList = document.getElementById('playersTagsList');
                if (tagsList) {
                    tagsList.innerHTML += `<div class="player-tag">${nick}</div>`;
                }
            }
            this.value = '';
        }
    });
}

async function saveTeam() {
    const user = auth.currentUser;
    if (!user) return alert("Zaloguj się!");

    const name = document.getElementById('teamName').value;
    const grid = document.getElementById('baseGrid').value;
    const avatar = document.getElementById('avatarPreview').src;

    if (!name || !grid) return alert("Uzupełnij nazwę i grid!");

    try {
        await db.collection("teams").add({
            name: name,
            grid: grid,
            avatar: avatar,
            members: tempPlayers,
            leaderId: user.uid,
            leaderNick: user.displayName || user.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        tempPlayers = [];
        toggleModal('teamModal', false);
        alert("Drużyna zapisana!");
    } catch (e) {
        alert("Błąd zapisu: " + e.message);
    }
}

// START
updateServerStatus().then(() => {
    loadTeams();
});
setInterval(updateServerStatus, 30000);
