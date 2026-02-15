// CONFIGURATION
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

// MODALS
function toggleModal(id, show) {
    const m = document.getElementById(id);
    if(m) m.style.display = show ? 'block' : 'none';
}

function switchAuthTab(mode) {
    const n = document.getElementById('nickGroup');
    const tl = document.getElementById('tab-login');
    const tr = document.getElementById('tab-register');
    if(n) n.style.display = mode === 'login' ? 'none' : 'block';
    tl.classList.toggle('active', mode === 'login');
    tr.classList.toggle('active', mode === 'register');
}

// AUTH ACTIONS
async function handleAuth() {
    const e = document.getElementById('authEmail').value;
    const p = document.getElementById('authPassword').value;
    const ni = document.getElementById('authNick').value;
    try {
        if (document.getElementById('tab-login').classList.contains('active')) {
            await auth.signInWithEmailAndPassword(e, p);
        } else {
            const res = await auth.createUserWithEmailAndPassword(e, p);
            await res.user.updateProfile({ displayName: ni });
            await res.user.sendEmailVerification();
            alert("Zweryfikuj maila!");
        }
        toggleModal('authModal', false);
    } catch (err) { alert(err.message); }
}

async function loginWithGoogle() {
    try {
        await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
        toggleModal('authModal', false);
    } catch (err) { alert(err.message); }
}

function logoutUser() { auth.signOut().then(() => location.reload()); }

// MONITOROWANIE STANU
auth.onAuthStateChanged(user => {
    const btn = document.getElementById('btnCreateTeam');
    const ab = document.getElementById('authButtons');
    const ui = document.getElementById('userInfo');
    if (user) {
        if(ab) ab.style.display = 'none';
        if(ui) ui.style.display = 'flex';
        document.getElementById('userDisplayName').innerText = user.displayName || user.email;
        if(btn) btn.style.setProperty('display', 'inline-block', 'important');
    } else {
        if(ab) ab.style.display = 'block';
        if(ui) ui.style.display = 'none';
        if(btn) btn.style.display = 'none';
    }
});

// TEAM ACTION (TEST)
function addTeam() {
    const name = document.getElementById('teamName').value;
    if(!name) return alert("Podaj nazwę teamu!");
    alert("Tworzenie teamu: " + name);
    // Tutaj dodasz zapis do Firebase db.collection('teams').add(...)
    toggleModal('teamModal', false);
}

// SERVER DATA
async function fetchServerStatus() {
    try {
        const res = await fetch(`https://api.battlemetrics.com/servers/${SERVER_ID}`);
        const d = await res.json();
        document.getElementById('serverName').innerText = d.data.attributes.name;
        document.getElementById('onlineCount').innerText = `${d.data.attributes.players}/${d.data.attributes.maxPlayers}`;
    } catch (e) { console.log(e); }
}
fetchServerStatus();
setInterval(fetchServerStatus, 30000);
