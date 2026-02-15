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

let authMode = 'login';

// --- LOGIKA AUTORYZACJI ---

function switchAuthTab(mode) {
    authMode = mode;
    document.getElementById('authSubmit').innerText = mode === 'login' ? 'ZALOGUJ SIĘ' : 'ZAŁÓŻ KONTO';
    document.getElementById('nickGroup').style.display = mode === 'login' ? 'none' : 'block';
    document.getElementById('loginLabel').innerText = mode === 'login' ? 'LOGIN LUB E-MAIL' : 'E-MAIL';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

async function handleAuth() {
    const emailOrLogin = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;
    const nick = document.getElementById('authNick').value;

    try {
        if (authMode === 'login') {
            let finalEmail = emailOrLogin;
            // Jeśli nie zawiera @, szukamy maila po loginie w Firestore
            if (!emailOrLogin.includes('@')) {
                const userDoc = await db.collection("users").doc(emailOrLogin.toLowerCase()).get();
                if (!userDoc.exists) throw new Error("Nie znaleziono takiego loginu.");
                finalEmail = userDoc.data().email;
            }
            await auth.signInWithEmailAndPassword(finalEmail, pass);
        } else {
            // REJESTRACJA
            if (!nick) throw new Error("Login jest wymagany!");
            const nickLower = nick.toLowerCase();
            
            // Sprawdź czy login zajęty
            const checkNick = await db.collection("users").doc(nickLower).get();
            if (checkNick.exists) throw new Error("Ten login jest już zajęty!");

            const res = await auth.createUserWithEmailAndPassword(emailOrLogin, pass);
            // Zapisz parę Login -> Email w Firestore
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
        // Po logowaniu Google sprawdzamy czy użytkownik ma przypisany login
        checkUserNick(res.user);
    } catch (e) { alert(e.message); }
}

async function checkUserNick(user) {
    if (!user) return;
    // Szukamy w Firestore czy ten UID ma przypisany jakikolwiek login
    const userQuery = await db.collection("users").where("uid", "==", user.uid).get();
    
    if (userQuery.empty && !user.displayName) {
        toggleModal('authModal', false);
        toggleModal('onboardingModal', true); // WYMUŚ WPISANIE LOGINU
    } else if (!userQuery.empty) {
        // Jeśli ma login w bazie, upewnij się że profil jest zaktualizowany
        const existingNick = userQuery.docs[0].id;
        if (user.displayName !== existingNick) {
            await user.updateProfile({ displayName: existingNick });
        }
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
        location.reload(); // Odśwież, aby załadować dane
    } catch (e) { alert(e.message); }
}

auth.onAuthStateChanged(user => {
    document.getElementById('authButtons').style.display = user ? 'none' : 'block';
    document.getElementById('userInfo').style.display = user ? 'flex' : 'none';
    if (user) {
        document.getElementById('userDisplayName').innerText = user.displayName || "Ustawianie...";
        checkUserNick(user);
    }
});

function logoutUser() { auth.signOut(); }
function toggleModal(id, show) { document.getElementById(id).style.display = show ? 'block' : 'none'; }
