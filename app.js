// Konfiguracja Firebase (pozostaje bez zmian)
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
let tempPlayers = []; // Lista graczy w formularzu
let currentAvatarBase64 = null; // Przechowywanie zdjęcia w pamięci

// --- OBSŁUGA FORMULARZA DRUŻYNY ---

// Podgląd zdjęcia
function previewAvatar(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('avatarPreview').innerHTML = `<img src="${e.target.result}">`;
            currentAvatarBase64 = e.target.result; // Zdjęcie jako tekst (Base64)
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// Dodawanie tagu gracza
document.getElementById('playerSearch')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addPlayerTag();
    }
});

function addPlayerTag() {
    const input = document.getElementById('playerSearch');
    const nick = input.value.trim();
    
    if (nick && !tempPlayers.includes(nick)) {
        tempPlayers.push(nick);
        renderTags();
        input.value = "";
    }
}

function removePlayerTag(nick) {
    tempPlayers = tempPlayers.filter(p => p !== nick);
    renderTags();
}

function renderTags() {
    const container = document.getElementById('playersTagsList');
    container.innerHTML = tempPlayers.map(p => `
        <div class="player-tag">
            ${p} <span onclick="removePlayerTag('${p}')">&times;</span>
        </div>
    `).join('');
}

// --- GŁÓWNA LOGIKA DODAWANIA ---

async function addTeam() {
    const user = auth.currentUser;
    if (!user || !user.emailVerified) return alert("Błąd weryfikacji!");

    const name = document.getElementById('teamName').value.trim();
    const grid = document.getElementById('baseGrid').value.trim().toUpperCase();

    if (!name || !grid) return alert("Podaj nazwę i kratkę!");
    if (tempPlayers.length === 0) return alert("Dodaj przynajmniej jednego gracza!");

    // Dodaj lidera automatycznie jeśli go nie ma
    if (!tempPlayers.includes(user.displayName)) {
        tempPlayers.unshift(user.displayName);
    }

    const teamData = {
        name: name,
        grid: grid,
        players: tempPlayers,
        avatar: currentAvatarBase64, // Zapisujemy zdjęcie w Firestore
        owner: user.uid,
        leaderName: user.displayName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection("teams").add(teamData);
        // Reset
        tempPlayers = [];
        currentAvatarBase64 = null;
        document.getElementById('avatarPreview').innerHTML = '<svg viewBox="0 0 24 24" width="30" fill="#444"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
        document.getElementById('teamName').value = "";
        document.getElementById('baseGrid').value = "";
        renderTags();
        toggleModal('teamModal', false);
    } catch (e) {
        alert("Błąd: " + e.message);
    }
}

// --- RESZTA SYSTEMU (Z poprzednich kroków) ---

auth.onAuthStateChanged(user => {
    const btnCreateTeam = document.getElementById('btnCreateTeam');
    const verificationOverlay = document.getElementById('verificationOverlay');
    const mainContent = document.getElementById('mainContent');

    if (user) {
        document.getElementById('authButtons').style.display = 'none';
        document.getElementById('userInfo').style.display = 'flex';
        
        const isVerified = user.emailVerified || (user.providerData[0] && user.providerData[0].providerId === 'google.com');

        if (isVerified) {
            if (verificationOverlay) verificationOverlay.style.display = 'none';
            if (mainContent) mainContent.style.opacity = '1';
            if (btnCreateTeam) btnCreateTeam.style.display = 'inline-block';
        } else {
            if (verificationOverlay) verificationOverlay.style.display = 'flex';
            if (mainContent) mainContent.style.opacity = '0';
        }
        checkUserNick(user);
    } else {
        document.getElementById('authButtons').style.display = 'block';
        document.getElementById('userInfo').style.display = 'none';
    }
});

async function checkUserNick(user) {
    if (!user) return;
    const userQuery = await db.collection("users").where("uid", "==", user.uid).get();
    if (!userQuery.empty) {
        document.getElementById('userDisplayName').innerText = userQuery.docs[0].id;
    }
}

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

function listenToTeams() {
    db.collection("teams").orderBy("createdAt", "desc").onSnapshot(snapshot => {
        const container = document.getElementById('teamsGrid');
        container.innerHTML = "";
        snapshot.forEach(doc => {
            const team = doc.data();
            const box = document.createElement('div');
            box.className = 'team-box';
            
            // Renderowanie avatara w karcie
            const avatarHtml = team.avatar ? `<img src="${team.avatar}" class="team-card-avatar">` : `<div class="team-card-avatar-empty"></div>`;

            let pHTML = team.players.map(p => {
                const online = playersOnlineNames.includes(p.toLowerCase());
                return `<div class="player-row"><span>${p}</span><span class="status-dot" style="background:${online ? '#4CAF50' : '#ff4444'}"></span></div>`;
            }).join('');

            box.innerHTML = `
                <div class="team-card-header">
                    ${avatarHtml}
                    <h3>${team.name}</h3>
                </div>
                ${pHTML}
                <div class="grid-bg">${team.grid}</div>
            `;
            container.appendChild(box);
        });
    });
}

function toggleModal(id, show) { document.getElementById(id).style.display = show ? 'block' : 'none'; }
function logoutUser() { auth.signOut().then(() => location.reload()); }

fetchServerStatus();
