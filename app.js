const firebaseConfig = {
    apiKey: "AIzaSyB74-e1hA8JW31YhdR_ZwgF-wfKdb3aqL4",
    authDomain: "ruscik-159d4.firebaseapp.com",
    projectId: "ruscik-159d4",
    storageBucket: "ruscik-159d4.firebasestorage.app",
    messagingSenderId: "127501998256",
    appId: "1:127501998256:web:99a73947e20f1eecb2c375"
};

// Inicjalizacja
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const SERVER_ID = '3344761';
let playersOnlineNames = [];
let authMode = 'login';
let checkInterval = null; 

// --- 1. SYSTEM AUTORYZACJI ---

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
            if (!nick || nick.length < 3) throw new Error("Nick musi mieć min. 3 znaki!");
            const nickLower = nick.toLowerCase();
            const check = await db.collection("users").doc(nickLower).get();
            if (check.exists) throw new Error("Ten login jest już zajęty!");

            const res = await auth.createUserWithEmailAndPassword(emailOrLogin, pass);
            await res.user.sendEmailVerification();
            alert("Konto utworzone! Potwierdź e-mail w swojej poczcie.");

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
        checkUserNick(res.user);
    } catch (e) { alert(e.message); }
}

// --- 2. LOGIKA BLOKADY I WERYFIKACJI ---

auth.onAuthStateChanged(user => {
    const btnCreateTeam = document.getElementById('btnCreateTeam');
    const verificationOverlay = document.getElementById('verificationOverlay');
    const mainContent = document.getElementById('mainContent');

    if (user) {
        document.getElementById('authButtons').style.display = 'none';
        document.getElementById('userInfo').style.display = 'flex';
        
        const updateUI = () => {
            const isVerified = user.emailVerified || (user.providerData[0] && user.providerData[0].providerId === 'google.com');
            
            if (isVerified) {
                if (verificationOverlay) verificationOverlay.style.display = 'none';
                if (mainContent) mainContent.style.opacity = '1';
                if (btnCreateTeam) btnCreateTeam.style.display = 'inline-block';
                clearInterval(checkInterval);
                checkInterval = null;
            } else {
                if (verificationOverlay) verificationOverlay.style.display = 'flex';
                if (mainContent) mainContent.style.opacity = '0';
                if (btnCreateTeam) btnCreateTeam.style.display = 'none';

                if (!checkInterval) {
                    checkInterval = setInterval(async () => {
                        await user.reload();
                        if (auth.currentUser.emailVerified) updateUI();
                    }, 5000); // Automat co 5s
                }
            }
        };

        updateUI();
        checkUserNick(user);
    } else {
        document.getElementById('authButtons').style.display = 'block';
        document.getElementById('userInfo').style.display = 'none';
        if (verificationOverlay) verificationOverlay.style.display = 'none';
        if (mainContent) mainContent.style.opacity = '1';
        if (btnCreateTeam) btnCreateTeam.style.display = 'none';
        clearInterval(checkInterval);
        checkInterval = null;
    }
});

// FUNKCJA RĘCZNEGO SPRAWDZANIA
async function manualCheckStatus() {
    const user = auth.currentUser;
    if (user) {
        await user.reload();
        if (user.emailVerified) {
            alert("Gratulacje! Twój e-mail został zweryfikowany. Strona zostanie odświeżona.");
            location.reload();
        } else {
            alert("Nadal brak weryfikacji. Sprawdź pocztę i kliknij w link, a potem spróbuj ponownie.");
        }
    }
}

function resendVerifyEmail() {
    const user = auth.currentUser;
    if (user) {
        user.sendEmailVerification()
            .then(() => alert("📧 Wysłano ponownie! Sprawdź pocztę."))
            .catch(e => alert("Błąd: " + e.message));
    }
}

async function checkUserNick(user) {
    if (!user) return;
    const userQuery = await db.collection("users").where("uid", "==", user.uid).get();
    if (userQuery.empty) {
        toggleModal('authModal', false);
        toggleModal('onboardingModal', true);
    } else {
        const foundNick = userQuery.docs[0].id;
        document.getElementById('userDisplayName').innerText = foundNick;
    }
}

async function saveOnboardingNick() {
    const nick = document.getElementById('onboardingNick').value;
    if (!nick || nick.length < 3) return alert("Min. 3 znaki!");
    const user = auth.currentUser;
    try {
        const nickLower = nick.toLowerCase();
        const check = await db.collection("users").doc(nickLower).get();
        if (check.exists) throw new Error("Zajęty!");
        await db.collection("users").doc(nickLower).set({ email: user.email, uid: user.uid });
        await user.updateProfile({ displayName: nick });
        location.reload(); 
    } catch (e) { alert(e.message); }
}

function logoutUser() { 
    clearInterval(checkInterval);
    auth.signOut().then(() => location.reload()); 
}

// --- 3. RUST ---

async function fetchServerStatus() {
    try {
        const res = await fetch(`https://api.battlemetrics.com/servers/${SERVER_ID}?include=player`);
        const data = await res.json();
        if (data.data) {
            document.getElementById('serverName').innerText = data.data.attributes.name;
            document.getElementById('onlineCount').innerText = `${data.data.attributes.players}/${data.data.attributes.maxPlayers}`;
            playersOnlineNames = (data.included || []).map(p => p.attributes.name.toLowerCase());
            listenToTeams();
        }
    } catch (e) { console.error(e); }
}

function addTeam() {
    const user = auth.currentUser;
    if (!user || !user.emailVerified) return;
    
    const teamData = {
        name: document.getElementById('teamName').value,
        grid: document.getElementById('baseGrid').value.toUpperCase(),
        players: document.getElementById('teamPlayers').value.split(',').map(p => p.trim()).filter(p => p),
        owner: user.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    db.collection("teams").add(teamData).then(() => toggleModal('teamModal', false));
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
                const online = playersOnlineNames.includes(p.toLowerCase());
                return `<div class="player-row"><span>${p}</span><span class="status-dot" style="background:${online ? '#4CAF50' : '#ff4444'}"></span></div>`;
            }).join('');
            box.innerHTML = `<h3>${team.name}</h3>${pHTML}<div style="position:absolute; bottom:5px; right:10px; font-size:40px; font-weight:900; color:#fff; opacity:0.05; pointer-events:none;">${team.grid}</div>`;
            container.appendChild(box);
        });
    });
}

function toggleModal(id, show) { 
    const modal = document.getElementById(id);
    if(modal) modal.style.display = show ? 'block' : 'none'; 
}

fetchServerStatus();
setInterval(fetchServerStatus, 30000);
