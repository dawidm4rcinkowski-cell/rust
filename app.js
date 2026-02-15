// TWOJE KLUCZE Z FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyB74-e1hA8JW31YhdR_ZwgF-wfKdb3aqL4",
  authDomain: "ruscik-159d4.firebaseapp.com",
  projectId: "ruscik-159d4",
  storageBucket: "ruscik-159d4.firebasestorage.app",
  messagingSenderId: "127501998256",
  appId: "1:127501998256:web:99a73947e20f1eecb2c375",
  measurementId: "G-71JX7Q9K9X"
};

// Inicjalizacja
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const SERVER_ID = '3344761';
const DEFAULT_LOGO = 'https://i.imgur.com/vUUnjT0.png';
let playersOnlineNames = [];
let authMode = 'login';

// --- SYSTEM AUTORYZACJI ---
function switchAuthTab(mode) {
    authMode = mode;
    document.getElementById('authSubmit').innerText = mode === 'login' ? 'ZALOGUJ SIĘ' : 'ZAŁÓŻ KONTO';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

async function handleAuth() {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;
    try {
        if (authMode === 'login') {
            await auth.signInWithEmailAndPassword(email, pass);
        } else {
            await auth.createUserWithEmailAndPassword(email, pass);
        }
        toggleModal('authModal', false);
    } catch (e) { alert(e.message); }
}

function logoutUser() { auth.signOut(); }

auth.onAuthStateChanged(user => {
    document.getElementById('authButtons').style.display = user ? 'none' : 'block';
    document.getElementById('userInfo').style.display = user ? 'block' : 'none';
    if(user) document.getElementById('userMail').innerText = user.email;
});

// --- POBIERANIE STATUSU SERWERA ---
async function fetchServerStatus() {
    try {
        const res = await fetch(`https://api.battlemetrics.com/servers/${SERVER_ID}?include=player`);
        const data = await res.json();
        document.getElementById('serverName').innerText = data.data.attributes.name;
        document.getElementById('onlineCount').innerText = `${data.data.attributes.players}/${data.data.attributes.maxPlayers}`;
        playersOnlineNames = (data.included || []).map(p => p.attributes.name.toLowerCase());
        listenToTeams(); // Start słuchania bazy danych
    } catch (e) { console.log("API Error"); }
}

// --- OBSŁUGA BAZY DANYCH (Firestore) ---
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

    if (!teamData.name || !teamData.grid) return alert("Wypełnij nazwę i kratkę!");

    db.collection("teams").add(teamData)
        .then(() => {
            toggleModal('teamModal', false);
            alert("Dodano do chmury!");
        });
}

// Słuchanie zmian w czasie rzeczywistym
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
                <h3 style="color:#cd412b; margin:0;">${team.name}</h3>
                <div style="width:100%; margin-top:15px;">${pHTML}</div>
                <div style="position:absolute; bottom:5px; right:10px; font-size:50px; font-weight:900; color:#fff; opacity:0.03;">${team.grid}</div>
            `;
            container.appendChild(box);
        });
    });
}

function toggleModal(id, show) { document.getElementById(id).style.display = show ? 'block' : 'none'; }

fetchServerStatus();
setInterval(fetchServerStatus, 30000);
