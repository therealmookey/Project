// ============================================================
// AUTH - Login pagina (index.html)
// ============================================================

import { loginUser, registerUser, resetPasswordUser } from './core/auth.js';

console.log('auth.js geladen');

document.addEventListener('DOMContentLoaded', function() {
    // DOM elementen
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginTabBtn = document.getElementById('loginTabBtn');
    const registerTabBtn = document.getElementById('registerTabBtn');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const forgotLink = document.getElementById('forgotPasswordLink');
    const resetPopup = document.getElementById('resetPopup');
    const closePopup = document.getElementById('closePopup');
    const resetBtn = document.getElementById('resetBtn');
    const messageEl = document.getElementById('message');

    function toonBericht(bericht, type) {
        if (messageEl) {
            messageEl.textContent = bericht;
            messageEl.className = `message ${type}`;
            messageEl.style.display = 'block';
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 8000);
        }
    }

    // Tabbladen
    if (loginTabBtn && registerTabBtn) {
        loginTabBtn.onclick = () => {
            loginTabBtn.classList.add('active');
            registerTabBtn.classList.remove('active');
            if (loginForm) loginForm.classList.add('active');
            if (registerForm) registerForm.classList.remove('active');
        };
        registerTabBtn.onclick = () => {
            registerTabBtn.classList.add('active');
            loginTabBtn.classList.remove('active');
            if (registerForm) registerForm.classList.add('active');
            if (loginForm) loginForm.classList.remove('active');
        };
    }

    // ===== REGISTREREN =====
    if (registerBtn) {
        registerBtn.onclick = async () => {
            const gebruikersnaam = document.getElementById('registerUsername').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;

            if (!gebruikersnaam || !email || !password) {
                toonBericht('Vul alle velden in', 'error');
                return;
            }

            if (password.length < 6) {
                toonBericht('Wachtwoord moet minimaal 6 tekens zijn', 'error');
                return;
            }

            const result = await registerUser(email, password, gebruikersnaam);
            if (result.error) {
                toonBericht(result.error.message, 'error');
            } else {
                document.getElementById('registerUsername').value = '';
                document.getElementById('registerEmail').value = '';
                document.getElementById('registerPassword').value = '';
                toonBericht('✅ Account aanvraag ontvangen! Een administrator moet je account nog goedkeuren.', 'success');
            }
        };
    }

    // ===== INLOGGEN =====
    if (loginBtn) {
        loginBtn.onclick = async () => {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            if (!email || !password) {
                toonBericht('Vul e-mail en wachtwoord in', 'error');
                return;
            }

            const result = await loginUser(email, password);
            if (result.error) {
                toonBericht(result.error.message, 'error');
            }
        };
    }

    // ===== WACHTWOORD VERGETEN =====
    if (forgotLink) {
        forgotLink.onclick = (e) => {
            e.preventDefault();
            if (resetPopup) resetPopup.style.display = 'flex';
        };
    }

    if (closePopup) {
        closePopup.onclick = () => {
            if (resetPopup) resetPopup.style.display = 'none';
        };
    }

    if (resetBtn) {
        resetBtn.onclick = async () => {
            const email = document.getElementById('resetEmail').value;
            if (!email) {
                toonBericht('Vul je e-mailadres in', 'error');
                return;
            }

            const result = await resetPasswordUser(email);
            if (result.error) {
                toonBericht('Fout: ' + result.error.message, 'error');
            } else {
                if (resetPopup) resetPopup.style.display = 'none';
            }
        };
    }

    // Enter toets
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            if (loginForm && loginForm.classList.contains('active')) {
                if (loginBtn) loginBtn.click();
            } else if (registerForm && registerForm.classList.contains('active')) {
                if (registerBtn) registerBtn.click();
            }
        }
    });
});