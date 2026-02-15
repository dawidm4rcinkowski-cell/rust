// Konfiguracja (bez zmian)
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
let playersOnlineNames = [];
let tempPlayers = [];
let currentAvatarBase64 = null;
let authMode = 'login';

// --- LOGOWANIE GOOGLE ---
async function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        toggleModal('authModal', false);
    } catch (e) { alert("Błąd Google: " + e.message); }
}

// --- RESZTA LOGIKI (IDENTYCZNA JAK WCZEŚNIEJ) ---
function switchAuthTab(mode) {
    authMode = mode;
    document.getElementById('nickGroup').style.display = mode === 'login' ? 'none' : 'block';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + mode).classList.add('active');
}

async function handleAuth() {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;
    const nick = document.getElementById('authNick').value;

    try {
        if (authMode === 'login') {
            await auth.signInWithEmailAndPassword(email, pass);
        } else {
            const res = await auth.createUserWithEmailAndPassword(email, pass);
            await res.user.updateProfile({ displayName: nick });
            await res.user.sendEmailVerification();
            alert("Konto utworzone! Sprawdź e-mail.");
        }
        toggleModal('authModal', false);
    } catch (e) { alert(e.message); }
}

// System tagów graczy
function addPlayerTag() {
    const input = document.getElementById('playerSearch');
    const nick = input.value.trim();
    if (nick && !tempPlayers.includes(nick)) {
        tempPlayers.push(nick);
        renderTags();
        input.value = "";
    }
}
function renderTags() {
    const container = document.getElementById('playersTagsList');
    container.innerHTML = tempPlayers.map(p => `<div class="player-tag">${p}</div>`).join('');
}

// Stan użytkownika
auth.onAuthStateChanged(user => {
    const btnCreate = document.getElementById('btnCreateTeam');
    const overlay = document.getElementById('verificationOverlay');
    
    if (user) {
        document.getElementById('authButtons').style.display = 'none';
        document.getElementById('userInfo').style.display = 'flex';
        document.getElementById('userDisplayName').innerText = user.displayName || "Gracz";
        
        const verified = user.emailVerified || user.providerData[0].providerId === 'google.com';
        overlay.style.display = verified ? 'none' : 'flex';
        btnCreate.style.display = verified ? 'inline-block' : 'none';
    } else {
        document.getElementById('authButtons').style.display = 'block';
        document.getElementById('userInfo').style.display = 'none';
        overlay.style.display = 'none';
    }
});

// Funkcje pomocnicze
function toggleModal(id, show) { document.getElementById(id).style.display = show ? 'block' : 'none'; }
function logoutUser() { auth.signOut().then(() => location.reload()); }
async function manualCheckStatus() { 
    await auth.currentUser.reload(); 
    if(auth.currentUser.emailVerified) location.reload(); 
    else alert("Brak weryfikacji!"); 
}

// BattleMetrics
async function fetchServerStatus() {
    try {
        const res = await fetch(`https://api.battlemetrics.com/servers/${SERVER_ID}?include=player`);
        const data = await res.json();
        document.getElementById('serverName').innerText = data.data.attributes.name;
        document.getElementById('onlineCount').innerText = `${data.data.attributes.players}/${data.data.attributes.maxPlayers}`;
        playersOnlineNames = (data.included || []).map(p => p.attributes.name.toLowerCase());
        listenToTeams();
    } catch (e) {}
}

function listenToTeams() {
    db.collection("teams").orderBy("createdAt", "desc").onSnapshot(snap => {
        const container = document.getElementById('teamsGrid');
        container.innerHTML = "";
        snap.forEach(doc => {
            const team = doc.data();
            const box = document.createElement('div');
            box.className = 'team-box';
            box.style = "background:#111; padding:15px; margin-bottom:10px; border-left:4px solid #cd412b";
            box.innerHTML = `<h3>${team.name} [${team.grid}]</h3>`;
            container.appendChild(box);
        });
    });
}

fetchServerStatus();
setInterval(fetchServerStatus, 30000);
