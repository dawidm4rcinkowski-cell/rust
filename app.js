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
let authMode = 'login';

// --- AUTORYZACJA ---

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
            if (!nick) throw new Error("Nick jest wymagany!");
            const nickLower = nick.toLowerCase();
            const check = await db.collection("users").doc(nickLower).get();
            if (check.exists) throw new Error("Login zajęty!");

            const res = await auth.createUserWithEmailAndPassword(emailOrLogin, pass);
            // WYSYŁKA MAILA WERYFIKACYJNEGO
            await res.user.sendEmailVerification();
            alert("Konto założone! Wysłaliśmy link weryfikacyjny na e-mail.");

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

async function checkUserNick(user) {
    if (!user) return;
    const userQuery = await db.collection("users").where("uid", "==", user.uid).get();
    if (userQuery.empty) {
        toggleModal('authModal', false);
        toggleModal('onboardingModal', true);
    } else {
        toggleModal('authModal', false); 
        const foundNick = userQuery.docs[0].id;
        document.getElementById('userDisplayName').innerText = foundNick;
        if (user.displayName !== foundNick) await user.updateProfile({ displayName: foundNick });
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

// KLUCZOWE: SPRAWDZANIE STANU WERYFIKACJI
auth.onAuthStateChanged(user => {
    const btnCreateTeam = document.getElementById('btnCreateTeam');
    const verifyBanner = document.getElementById('verifyBanner');

    if (user) {
        document.getElementById('authButtons').style.display = 'none';
        document.getElementById('userInfo').style.display = 'flex';
        
        // Google jest autoweryfikowane
        const isVerified = user.emailVerified || user.providerData[0].providerId === 'google.com';

        if (isVerified) {
            btnCreateTeam.style.display = 'inline-block';
            verifyBanner.style.display = 'none';
        } else {
            btnCreateTeam.style.display = 'none';
            verifyBanner.style.display = 'flex';
        }
        checkUserNick(user);
    } else {
        document.getElementById('authButtons').style.display = 'block';
        document.getElementById('userInfo').style.display = 'none';
        btnCreateTeam.style.display = 'none';
        verifyBanner.style.display = 'none';
    }
});

function resendVerifyEmail() {
    auth.currentUser.sendEmailVerification()
        .then(() => alert("E-mail został wysłany ponownie!"));
}

function logoutUser() { auth.signOut().then(() => location.reload()); }

// --- RUST ---

async function fetchServerStatus() {
    try {
        const res = await fetch(`https://api.battlemetrics.com/servers/${SERVER_ID}?include=player`);
        const data = await res.json();
        document.getElementById('serverName').innerText = data.data.attributes.name;
        document.getElementById('onlineCount').innerText = `${data.data.attributes.players}/${data.data.attributes.maxPlayers}`;
        playersOnlineNames = (data.included || []).map(p => p.attributes.name.toLowerCase());
        listenToTeams();
    } catch (e) { console.error(e); }
}

function addTeam() {
    if (!auth.currentUser || (!auth.currentUser.emailVerified && auth.currentUser.providerData[0].providerId !== 'google.com')) {
        return alert("Najpierw zweryfikuj e-mail!");
    }
    const teamData = {
        name: document.getElementById('teamName').value,
        grid: document.getElementById('baseGrid').value.toUpperCase(),
        players: document.getElementById('teamPlayers').value.split(',').map(p => p.trim()).filter(p => p),
        owner: auth.currentUser.uid,
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

function toggleModal(id, show) { document.getElementById(id).style.display = show ? 'block' : 'none'; }

fetchServerStatus();
setInterval(fetchServerStatus, 30000);
