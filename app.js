const firebaseConfig = {
  apiKey: "AIzaSyB74-e1hA8JW31YhdR_ZwgF-wfKdb3aqL4",
  authDomain: "ruscik-159d4.firebaseapp.com",
  projectId: "ruscik-159d4",
  storageBucket: "ruscik-159d4.firebasestorage.app",
  messagingSenderId: "127501998256",
  appId: "1:127501998256:web:99a73947e20f1eecb2c375",
  measurementId: "G-71JX7Q9K9X"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const SERVER_ID = '3344761';
const DEFAULT_LOGO = 'https://i.imgur.com/vUUnjT0.png';
let playersOnlineNames = [];
let authMode = 'login';

// --- AUTORYZACJA ---

function switchAuthTab(mode) {
    authMode = mode;
    document.getElementById('authSubmit').innerText = mode === 'login' ? 'ZALOGUJ SIĘ' : 'ZAŁÓŻ KONTO';
    document.getElementById('nickGroup').style.display = mode === 'login' ? 'none' : 'block';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

async function handleAuth() {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;
    const nick = document.getElementById('authNick').value;

    try {
        if (authMode === 'login') {
            await auth.signInWithEmailAndPassword(email, pass);
        } else {
            if(!nick) return alert("Podaj nick!");
            const res = await auth.createUserWithEmailAndPassword(email, pass);
            await res.user.updateProfile({ displayName: nick });
        }
        toggleModal('authModal', false);
    } catch (e) { alert(e.message); }
}

async function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        toggleModal('authModal', false);
    } catch (e) { alert(e.message); }
}

function logoutUser() { auth.signOut(); }

auth.onAuthStateChanged(user => {
    document.getElementById('authButtons').style.display = user ? 'none' : 'block';
    document.getElementById('userInfo').style.display = user ? 'flex' : 'none';
    if(user) {
        document.getElementById('userMail').innerText = user.displayName || user.email.split('@')[0];
    }
    renderTeams();
});

// --- RUST LOGIKA ---

async function fetchServerStatus() {
    try {
        const res = await fetch(`https://api.battlemetrics.com/servers/${SERVER_ID}?include=player`);
        const data = await res.json();
        document.getElementById('serverName').innerText = data.data.attributes.name;
        document.getElementById('onlineCount').innerText = `${data.data.attributes.players}/${data.data.attributes.maxPlayers}`;
        playersOnlineNames = (data.included || []).map(p => p.attributes.name.toLowerCase());
        listenToTeams();
    } catch (e) { console.log("Błąd BattleMetrics"); }
}

function addTeam() {
    if (!auth.currentUser) return alert("Musisz być zalogowany!");
    
    const teamData = {
        name: document.getElementById('teamName').value,
        logo: document.getElementById('teamLogo').value || DEFAULT_LOGO,
        grid: document.getElementById('baseGrid').value.toUpperCase(),
        pass: document.getElementById('leaderPass').value,
        players: document.getElementById('teamPlayers').value.split(',').map(p => p.trim()).filter(p => p),
        owner: auth.currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!teamData.name || !teamData.grid) return alert("Wypełnij dane!");

    db.collection("teams").add(teamData).then(() => {
        toggleModal('teamModal', false);
    });
}

function listenToTeams() {
    db.collection("teams").orderBy("createdAt", "desc").onSnapshot(snapshot => {
        const container = document.getElementById('teamsGrid');
        container.innerHTML = "";
        snapshot.forEach(doc => {
            const team = doc.data();
            const box = document.createElement('div');
            box.className = 'team-box';
            let pHTML = team.players.map(p => {
                const isOnline = playersOnlineNames.includes(p.toLowerCase());
                return `<div class="player-row"><span>${p}</span><span class="status-dot" style="background:${isOnline ? '#4CAF50' : '#ff4444'}"></span></div>`;
            }).join('');
            box.innerHTML = `
                <img src="${team.logo}" class="team-logo-img" onerror="this.src='${DEFAULT_LOGO}'">
                <h3 style="color:#cd412b; margin:0; font-size:16px;">${team.name}</h3>
                <div style="width:100%; margin-top:15px;">${pHTML}</div>
                <div style="position:absolute; bottom:5px; right:10px; font-size:50px; font-weight:900; color:#fff; opacity:0.03; pointer-events:none;">${team.grid}</div>
            `;
            container.appendChild(box);
        });
    });
}

function toggleModal(id, show) { document.getElementById(id).style.display = show ? 'block' : 'none'; }

fetchServerStatus();
setInterval(fetchServerStatus, 30000);
