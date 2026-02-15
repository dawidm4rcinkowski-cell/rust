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

// --- SYSTEM AUTORYZACJI (LOGOWANIE I REJESTRACJA) ---

// Przełączanie między zakładkami Logowanie / Rejestracja
function switchAuthTab(mode) {
    authMode = mode;
    document.getElementById('authSubmit').innerText = mode === 'login' ? 'ZALOGUJ SIĘ' : 'ZAŁÓŻ KONTO';
    document.getElementById('nickGroup').style.display = mode === 'login' ? 'none' : 'block';
    document.getElementById('loginLabel').innerText = mode === 'login' ? 'LOGIN LUB E-MAIL' : 'E-MAIL';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

// Obsługa logowania i rejestracji e-mailem/loginem
async function handleAuth() {
    const emailOrLogin = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;
    const nick = document.getElementById('authNick').value;

    try {
        if (authMode === 'login') {
            let finalEmail = emailOrLogin;
            // Logowanie samym loginem - szukanie maila w Firestore
            if (!emailOrLogin.includes('@')) {
                const userDoc = await db.collection("users").doc(emailOrLogin.toLowerCase()).get();
                if (!userDoc.exists) throw new Error("Nie znaleziono takiego loginu.");
                finalEmail = userDoc.data().email;
            }
            await auth.signInWithEmailAndPassword(finalEmail, pass);
        } else {
            // Rejestracja nowego użytkownika
            if (!nick) throw new Error("Login jest wymagany!");
            const nickLower = nick.toLowerCase();
            
            const checkNick = await db.collection("users").doc(nickLower).get();
            if (checkNick.exists) throw new Error("Ten login jest już zajęty!");

            const res = await auth.createUserWithEmailAndPassword(emailOrLogin, pass);
            // Zapisanie powiązania Login -> Email w bazie
            await db.collection("users").doc(nickLower).set({ email: emailOrLogin, uid: res.user.uid });
            await res.user.updateProfile({ displayName: nick });
        }
        toggleModal('authModal', false);
    } catch (e) { alert(e.message); }
}

// Logowanie przez Google
async function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const res = await auth.signInWithPopup(provider);
        // Po udanym logowaniu sprawdzamy nick
        checkUserNick(res.user);
    } catch (e) { alert(e.message); }
}

// Sprawdzanie czy użytkownik ma przypisany login w Firestore
async function checkUserNick(user) {
    if (!user) return;
    
    const userQuery = await db.collection("users").where("uid", "==", user.uid).get();
    
    if (userQuery.empty) {
        // Jeśli nie ma nicku w bazie, wymuś jego wpisanie
        toggleModal('authModal', false);
        toggleModal('onboardingModal', true);
    } else {
        // Jeśli ma nick - zamknij okno logowania i wyświetl dane
        toggleModal('authModal', false); 
        
        const foundNick = userQuery.docs[0].id;
        document.getElementById('userDisplayName').innerText = foundNick;
        
        if (user.displayName !== foundNick) {
            await user.updateProfile({ displayName: foundNick });
        }
    }
}

// Zapisywanie loginu dla użytkowników Google
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

// Słuchacz stanu zalogowania
auth.onAuthStateChanged(user => {
    document.getElementById('authButtons').style.display = user ? 'none' : 'block';
    document.getElementById('userInfo').style.display = user ? 'flex' : 'none';
    if (user) {
        document.getElementById('userDisplayName').innerText = user.displayName || "Ustawianie...";
        checkUserNick(user);
    }
});

function logoutUser() { 
    auth.signOut().then(() => {
        location.reload(); 
    }); 
}

// --- LOGIKA RUST I DRUŻYN ---

// Pobieranie statusu serwera z BattleMetrics
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

// Dodawanie drużyny do Firestore
function addTeam() {
    if (!auth.currentUser) return alert("Musisz być zalogowany!");
    
    const teamData = {
        name: document.getElementById('teamName').value,
        grid: document.getElementById('baseGrid').value.toUpperCase(),
        players: document.getElementById('teamPlayers').value.split(',').map(p => p.trim()).filter(p => p),
        owner: auth.currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!teamData.name || !teamData.grid) return alert("Wypełnij nazwę i kratkę!");

    db.collection("teams").add(teamData).then(() => {
        toggleModal('teamModal', false);
    });
}

// Pobieranie drużyn w czasie rzeczywistym
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

// Funkcje pomocnicze
function toggleModal(id, show) { document.getElementById(id).style.display = show ? 'block' : 'none'; }

// Start aplikacji
fetchServerStatus();
setInterval(fetchServerStatus, 30000); // Odświeżaj status co 30 sekund
