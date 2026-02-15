// TWOJE DANE KONFIGURACYJNE Z FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyB74-e1hA8JW31YhdR_ZwgF-wfKdb3aqL4",
    authDomain: "ruscik-159d4.firebaseapp.com",
    projectId: "ruscik-159d4",
    storageBucket: "ruscik-159d4.firebasestorage.app",
    messagingSenderId: "127501998256",
    appId: "1:127501998256:web:99a73947e20f1eecb2c375"
};

// Inicjalizacja Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const SERVER_ID = '3344761';
let playersOnlineNames = [];
let authMode = 'login';

// --- SYSTEM AUTORYZACJI ---

function switchAuthTab(mode) {
    authMode = mode;
    document.getElementById('authSubmit').innerText = mode === 'login' ? 'ZALOGUJ SIĘ' : 'ZAŁÓŻ KONTO';
    document.getElementById('nickGroup').style.display = mode === 'login' ? 'none' : 'block';
    document.getElementById('loginLabel').innerText = mode === 'login' ? 'LOGIN LUB E-MAIL' : 'E-MAIL';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (event) event.target.classList.add('active');
}

async function handleAuth() {
    const emailOrLogin = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;
    const nick = document.getElementById('authNick').value;

    try {
        if (authMode === 'login') {
            let finalEmail = emailOrLogin;
            if (!emailOrLogin.includes('@')) {
                const userDoc = await db.collection("users").doc(emailOrLogin.toLowerCase()).get();
                if (!userDoc.exists) throw new Error("Nie znaleziono takiego loginu.");
                finalEmail = userDoc.data().email;
            }
            await auth.signInWithEmailAndPassword(finalEmail, pass);
        } else {
            if (!nick) throw new Error("Login jest wymagany!");
            const nickLower = nick.toLowerCase();
            const checkNick = await db.collection("users").doc(nickLower).get();
            if (checkNick.exists) throw new Error("Ten login jest już zajęty!");

            const res = await auth.createUserWithEmailAndPassword(emailOrLogin, pass);
            await db.collection("users").doc(nickLower).set({ email: emailOrLogin, uid: res.user.uid });
            await res.user.updateProfile({ displayName: nick });
        }
        toggleModal('authModal', false);
    } catch (e) { alert(e.message); }
}

async function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const res = await auth.signInWithPopup(provider);
        // Po zamknięciu popupu Google, sprawdzamy nick
        checkUserNick(res.user);
    } catch (e) { alert(e.message); }
}

// KLUCZOWA FUNKCJA: Sprawdzanie nicku i zamykanie okien
async function checkUserNick(user) {
    if (!user) return;
    
    try {
        const userQuery = await db.collection("users").where("uid", "==", user.uid).get();
        
        if (userQuery.empty) {
            // Brak nicku - przełączamy modale
            toggleModal('authModal', false);
            toggleModal('onboardingModal', true);
        } else {
            // Nick istnieje - ZAMYKAMY OKNO LOGOWANIA natychmiast
            toggleModal('authModal', false); 
            
            const foundNick = userQuery.docs[0].id;
            document.getElementById('userDisplayName').innerText = foundNick;
            
            if (user.displayName !== foundNick) {
                await user.updateProfile({ displayName: foundNick });
            }
        }
    } catch (error) {
        console.error("Błąd sprawdzania nicku:", error);
    }
}

async function saveOnboardingNick() {
    const nick = document.getElementById('onboardingNick').value;
    if (!nick || nick.length < 3) return alert("Login musi mieć min. 3 znaki!");
    
    const nickLower = nick.toLowerCase();
    const user = auth.currentUser;

    try {
        const check = await db.collection("users").doc(nickLower).get();
        if (check.exists) throw new Error("Ten login jest już zajęty!");

        await db.collection("users").doc(nickLower).set({
            email: user.email,
            uid: user.uid
        });
        await user.updateProfile({ displayName: nick });
        
        toggleModal('onboardingModal', false);
        location.reload(); 
    } catch (e) { alert(e.message); }
}

// Słuchacz stanu zalogowania z wymuszonym zamykaniem modala
auth.onAuthStateChanged(user => {
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');

    if (user) {
        authButtons.style.display = 'none';
        userInfo.style.display = 'flex';
        // Wymuszone zamknięcie modala przy wykryciu sesji
        toggleModal('authModal', false);
        checkUserNick(user);
    } else {
        authButtons.style.display = 'block';
        userInfo.style.display = 'none';
    }
});

function logoutUser() { 
    auth.signOut().then(() => {
        location.reload(); 
    }); 
}

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
        grid: document.getElementById('baseGrid').value.toUpperCase(),
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
                <h3>${team.name}</h3>
                <div style="width:100%; margin-top:10px;">${pHTML}</div>
                <div style="position:absolute; bottom:5px; right:10px; font-size:40px; font-weight:900; color:#fff; opacity:0.05; pointer-events:none;">${team.grid}</div>
            `;
            container.appendChild(box);
        });
    });
}

function toggleModal(id, show) { 
    const el = document.getElementById(id);
    if (el) el.style.display = show ? 'block' : 'none'; 
}

fetchServerStatus();
setInterval(fetchServerStatus, 30000);
