// CONFIGURATION
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
let authMode = 'login';

// --- AUTH LOGIC ---

// Funkcja przełączania taba (Login/Register)
function switchAuthTab(mode) {
    authMode = mode;
    const nickGroup = document.getElementById('nickGroup');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');

    if (mode === 'login') {
        nickGroup.style.display = 'none';
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
    } else {
        nickGroup.style.display = 'block';
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
    }
}

// Logowanie / Rejestracja E-mail
async function handleAuth() {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;
    const nick = document.getElementById('authNick').value;

    try {
        if (authMode === 'login') {
            await auth.signInWithEmailAndPassword(email, pass);
        } else {
            if (!nick) return alert("Podaj nick!");
            const res = await auth.createUserWithEmailAndPassword(email, pass);
            await res.user.updateProfile({ displayName: nick });
            await res.user.sendEmailVerification();
            alert("Konto utworzone! Zweryfikuj e-mail, aby móc tworzyć teamy.");
        }
        toggleModal('authModal', false);
    } catch (e) {
        alert("Błąd: " + e.message);
    }
}

// Logowanie Google
async function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        toggleModal('authModal', false);
    } catch (e) {
        alert("Błąd Google: " + e.message);
    }
}

// Wylogowanie
function logoutUser() {
    auth.signOut().then(() => location.reload());
}

// MONITOROWANIE STANU UŻYTKOWNIKA (To tutaj włącza przycisk)
auth.onAuthStateChanged(user => {
    const btnCreate = document.getElementById('btnCreateTeam');
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    const userNameDisplay = document.getElementById('userDisplayName');

    if (user) {
        authButtons.style.display = 'none';
        userInfo.style.display = 'flex';
        userNameDisplay.innerText = user.displayName || "GRACZ";

        // Sprawdź czy zweryfikowany (Google jest od razu, mail po kliknięciu w link)
        const isVerified = user.emailVerified || (user.providerData.length > 0 && user.providerData[0].providerId === 'google.com');

        if (isVerified) {
            btnCreate.style.display = 'inline-block'; // POKAZUJE PRZYCISK
        } else {
            btnCreate.style.display = 'none';
        }
    } else {
        authButtons.style.display = 'block';
        userInfo.style.display = 'none';
        btnCreate.style.display = 'none'; // UKRYWA PRZYCISK
    }
});

// --- UI LOGIC ---

function toggleModal(id, show) {
    document.getElementById(id).style.display = show ? 'block' : 'none';
}

// --- BATTLEMETRICS & DATA ---

async function fetchServerStatus() {
    try {
        const res = await fetch(`https://api.battlemetrics.com/servers/${SERVER_ID}`);
        const data = await res.json();
        const server = data.data.attributes;
        
        document.getElementById('serverName').innerText = server.name;
        document.getElementById('onlineCount').innerText = `${server.players}/${server.maxPlayers}`;
    } catch (e) {
        console.error("BattleMetrics Error:", e);
    }
}

// Odświeżanie serwera co 30 sek
fetchServerStatus();
setInterval(fetchServerStatus, 30000);

// --- TEAMS LOGIC ---

function listenToTeams() {
    db.collection("teams").orderBy("createdAt", "desc").onSnapshot(snap => {
        const container = document.getElementById('teamsGrid');
        container.innerHTML = "";
        snap.forEach(doc => {
            const team = doc.data();
            const div = document.createElement('div');
            div.className = 'team-card'; // Upewnij się, że masz styl .team-card w CSS
            div.innerHTML = `
                <div style="background: #1a1a1a; padding: 20px; border-left: 4px solid #cd412b; margin-bottom: 15px;">
                    <h3 style="margin:0; color:#cd412b;">${team.name} [${team.grid}]</h3>
                    <p style="color:#888; margin: 5px 0;">Lider: ${team.leaderNick}</p>
                </div>
            `;
            container.appendChild(div);
        });
    });
}
listenToTeams();
