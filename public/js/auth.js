document.addEventListener('DOMContentLoaded', () => {
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-card');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    function showMessage(element, message, type) {
        if (!element) return;
        
        // Hide any existing message
        element.classList.remove('show', 'success', 'error', 'info', 'warning');

        if (!message) return;

        // Set message and type
        element.textContent = message;
        element.className = `form-message ${type} show`;

        // Adjust timeout based on message type
        const timeout = type === 'error' ? 6000 : 4000;
        setTimeout(() => {
            element.classList.remove('show');
        }, timeout);
    }

    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); loginCard.style.display = 'none'; registerCard.style.display = 'block'; });
    }
    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => { e.preventDefault(); registerCard.style.display = 'none'; loginCard.style.display = 'block'; });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const messageDiv = document.getElementById('login-message');
            showMessage(messageDiv, '', '');
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.msg || 'فشل تسجيل الدخول');

                // Check if 2FA is required
                if (data.twoFactorRequired) {
                    showMessage(messageDiv, data.msg || 'تم إرسال رمز التحقق إلى بريدك الإلكتروني', 'info');
                    // Save email for 2FA verification
                    localStorage.setItem('temp_email', email);
                    // Show 2FA form
                    const loginContainer = document.querySelector('.auth-container');
                    const twoFactorForm = document.getElementById('2fa-form');
                    if (loginContainer && twoFactorForm) {
                        loginContainer.style.display = 'none';
                        twoFactorForm.style.display = 'block';
                        document.getElementById('2fa-code').focus();
                    }
                    return;
                }

                // No 2FA required, proceed with login
                localStorage.setItem('token', data.token);
                window.location.href = '/dashboard';
            } catch (err) { 
                showMessage(messageDiv, err.message, 'error'); 
            }
        });

        // Add 2FA form handler
        const twoFactorForm = document.getElementById('2fa-form');
        if (twoFactorForm) {
            twoFactorForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const code = document.getElementById('2fa-code').value;
                const email = localStorage.getItem('temp_email');
                const messageDiv = document.getElementById('2fa-message');
                showMessage(messageDiv, '', '');

                if (!code || !email) {
                    showMessage(messageDiv, 'يرجى إدخال رمز التحقق', 'error');
                    return;
                }

                try {
                    const res = await fetch('/api/auth/verify-2fa', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, twoFactorCode: code })
                    });

                    const data = await res.json();
                    if (!res.ok) throw new Error(data.msg || 'فشل التحقق من الرمز');

                    showMessage(messageDiv, 'تم التحقق بنجاح!', 'success');
                    localStorage.removeItem('temp_email');
                    localStorage.setItem('token', data.token);
                    
                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 1000);

                } catch (err) {
                    showMessage(messageDiv, err.message, 'error');
                }
            });
        }
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const messageDiv = document.getElementById('register-message');
            showMessage(messageDiv, '', '');
            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: document.getElementById('register-username').value,
                        email: document.getElementById('register-email').value,
                        password: document.getElementById('register-password').value,
                        adafruitUsername: document.getElementById('register-adafruit-username').value,
                        adafruitApiKey: document.getElementById('register-adafruit-key').value
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.msg || 'فشل التسجيل');
                showMessage(messageDiv, data.msg, 'success');
                registerForm.reset();
            } catch (err) { showMessage(messageDiv, err.message, 'error'); }
        });
    }
});