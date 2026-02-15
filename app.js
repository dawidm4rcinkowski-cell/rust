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
let authMode = 'login';

function toggleModal(id, show) {
    const modal = document.getElementById(id);
    if(modal) modal.style.display = show ? 'block' : 'none';
}

function switchAuthTab(mode) {
    authMode = mode;
    const nickGroup = document.getElementById('nickGroup');
    const tLogin = document.getElementById('tab-login');
    const tRegister = document.getElementById('tab-register');
    if(nickGroup) nickGroup.style.display = mode === 'login' ? 'none' : 'block';
    tLogin.classList.toggle('active', mode === 'login');
    tRegister.classList.toggle('active', mode === 'register');
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

// MONITOROWANIE STANU
auth.onAuthStateChanged(user => {
    const btnCreate = document.getElementById('btnCreateTeam');
    const authBox = document.getElementById('authButtons');
    const userBox = document.getElementById('userInfo');
    
    if (user) {
        if(authBox) authBox.style.display = 'none';
        if(userBox) userBox.style.display = 'flex';
        document.getElementById('userDisplayName').innerText = user.displayName || user.email;
        
        // WYMUSZENIE POKAZANIA PRZYCISKU
        if(btnCreate) {
            btnCreate.style.setProperty('display', 'inline-block', 'important');
        }
    } else {
        if(authBox) authBox.style.display = 'block';
        if(userBox) userBox.style.display = 'none';
        if(btnCreate) btnCreate.style.display = 'none';
    }
});

async function fetchServerStatus() {
    try {
        const res = await fetch(`https://api.battlemetrics.com/servers/${SERVER_ID}`);
        const data = await res.json();
        document.getElementById('serverName').innerText = data.data.attributes.name;
        document.getElementById('onlineCount').innerText = `${data.data.attributes.players}/${data.data.attributes.maxPlayers}`;
    } catch (e) { console.log(e); }
}
fetchServerStatus();
setInterval(fetchServerStatus, 30000);
