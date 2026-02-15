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
let tempPlayers = []; 
let currentAvatarBase64 = null;
let checkInterval = null;

// --- AVATAR ---
function previewAvatar(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('avatarPreview').innerHTML = `<img src="${e.target.result}">`;
            currentAvatarBase64 = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// --- SYSTEM GRACZY ---
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
        <div class="player-tag">${p} <span onclick="removePlayerTag('${p}')">&times;</span></div>
    `).join('');
}

// --- TWORZENIE TEAMU ---
async function addTeam() {
    const user = auth.currentUser;
    if (!user || !user.emailVerified) return alert("Najpierw zweryfikuj email!");

    const name = document.getElementById('teamName').value.trim();
    const grid = document.getElementById('baseGrid').value.trim().toUpperCase();

    if (!name || !grid) return alert("Wypełnij dane!");

    try {
        await db.collection("teams").add({
            name, grid, players: tempPlayers, avatar: currentAvatarBase64,
            owner: user.uid, leaderName: user.displayName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        tempPlayers = [];
        currentAvatarBase64 = null;
        renderTags();
        toggleModal('teamModal', false);
    } catch (e) { alert(e.message); }
}

// --- STAN UŻYTKOWNIKA ---
auth.onAuthStateChanged(user => {
    const btnCreateTeam = document.getElementById('btnCreateTeam');
    const overlay = document.getElementById('verificationOverlay');
    if (user) {
        const isVerified = user.emailVerified || (user.providerData[0] && user.providerData[0].providerId === 'google.com');
        if (isVerified) {
            overlay.style.display = 'none';
            btnCreateTeam.style.display = 'inline-block';
            clearInterval(checkInterval);
        } else {
            overlay.style.display = 'flex';
            if(!checkInterval) {
                checkInterval = setInterval(async () => {
                    await user.reload();
                    if(auth.currentUser.emailVerified) location.reload();
                }, 4000);
            }
        }
        document.getElementById('authButtons').style.display = 'none';
        document.getElementById('userInfo').style.display = 'flex';
        document.getElementById('userDisplayName').innerText = user.displayName || "Gracz";
    } else {
        document.getElementById('authButtons').style.display = 'block';
        document.getElementById('userInfo').style.display = 'none';
    }
});

// --- RĘCZNA WERYFIKACJA ---
async function manualCheckStatus() {
    const user = auth.currentUser;
    if (user) {
        await user.reload();
        if (user.emailVerified) location.reload();
        else alert("Nadal brak weryfikacji. Kliknij link w mailu!");
    }
}

// --- BATTLEMETRICS ---
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

function listenToTeams() {
    db.collection("teams").orderBy("createdAt", "desc").onSnapshot(snap => {
        const container = document.getElementById('teamsGrid');
        container.innerHTML = "";
        snap.forEach(doc => {
            const team = doc.data();
            const box = document.createElement('div');
            box.className = 'team-box';
            let pHTML = team.players.map(p => {
                const online = playersOnlineNames.includes(p.toLowerCase());
                return `<div class="player-row"><span>${p}</span><span class="status-dot" style="background:${online?'#4CAF50':'#ff4444'}"></span></div>`;
            }).join('');
            box.innerHTML = `
                <div class="team-card-header">
                    ${team.avatar ? `<img src="${team.avatar}" class="team-card-avatar">` : `<div class="team-card-avatar" style="background:#222"></div>`}
                    <h3>${team.name}</h3>
                </div>
                ${pHTML}
            `;
            container.appendChild(box);
        });
    });
}

function toggleModal(id, show) { document.getElementById(id).style.display = show ? 'block' : 'none'; }
function logoutUser() { auth.signOut().then(() => location.reload()); }
function resendVerifyEmail() { auth.currentUser.sendEmailVerification().then(() => alert("Wysłano!")); }

fetchServerStatus();
