// public/js/index.js - إكمال الملف مع إصلاح جميع المشاكل
(function() {
    'use strict';
    
    console.log('🚀 صفحة تسجيل الدخول - تحميل النسخة المُحدّثة...');
    
    // ==================== المتغيرات العامة ====================
    let resetEmail = '';
    let resetCode = '';
    let isLoading = false;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // انتظار تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeLoginPage);
    } else {
        initializeLoginPage();
    }
    
    function initializeLoginPage() {
        console.log('📱 نوع الجهاز:', isMobile ? 'موبايل' : 'ديسكتوب');
        
        // فحص المصادقة الموجودة
        checkExistingAuth();
        
        // تهيئة المكونات
        setupForgotPasswordLink();
        setupSupportButton();
        setupForms();
        setupModals();
        setupThemeToggle();
        
        // تحميل الثيم المحفوظ
        loadSavedTheme();
        
        // إضافة أنماط إضافية للصفحة
        addLoginPageStyles();

        // فحص ما إذا كان المستخدم يحتاج لإكمال التسجيل بعد تسجيل الدخول بجوجل
        checkForGoogleSignup();
        
        console.log('✅ تم تهيئة صفحة تسجيل الدخول');
    }
    
    // ==================== إضافة أنماط التصميم المفقودة ====================
    function addLoginPageStyles() {
        if (document.getElementById('login-page-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'login-page-styles';
        styles.textContent = `
            /* تحسينات عامة لصفحة تسجيل الدخول */
            body {
                background: #0d0c1d;
                background-image: 
                    radial-gradient(ellipse at top, rgba(138, 43, 226, 0.1) 0%, transparent 50%),
                    radial-gradient(ellipse at bottom right, rgba(0, 229, 255, 0.1) 0%, transparent 50%);
                background-attachment: fixed;
                min-height: 100vh;
                font-family: 'Tajawal', sans-serif;
            }
            
            .auth-container {
                max-width: 800px !important;
                width: 90% !important;
                margin: 0 auto !important;
                padding: 20px !important;
                min-height: calc(100vh - 100px) !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: center !important;
                align-items: center !important;
            }
            
            .auth-card {
                width: 100% !important;
                max-width: 500px !important;
                margin: 0 auto !important;
                background: rgba(21, 19, 44, 0.85) !important;
                backdrop-filter: blur(20px) !important;
                -webkit-backdrop-filter: blur(20px) !important;
                padding: 40px 35px !important;
                border-radius: 25px !important;
                border: 1px solid rgba(138, 43, 226, 0.3) !important;
                box-shadow: 
                    0 20px 60px rgba(138, 43, 226, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
                position: relative !important;
                overflow: hidden !important;
            }
            
            .auth-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
                transition: left 0.8s;
            }
            
            .auth-card:hover::before {
                left: 100%;
            }
            
            .auth-title {
                text-align: center;
                margin-bottom: 30px;
                font-size: 2rem;
                font-weight: 700;
                background: linear-gradient(135deg, #8A2BE2, #00e5ff);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .form-group {
                margin-bottom: 25px;
                position: relative;
            }
            
            .form-label {
                display: block;
                margin-bottom: 8px;
                font-weight: 600;
                color: white;
                font-size: 1rem;
            }
            
            .form-input, .form-select, .form-textarea {
                width: 100%;
                padding: 15px 20px;
                border: 2px solid rgba(138, 43, 226, 0.3);
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.1);
                color: white;
                font-size: 1rem;
                font-family: 'Tajawal', sans-serif;
                transition: all 0.3s ease;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }
            
            .form-input:focus, .form-select:focus, .form-textarea:focus {
                outline: none;
                border-color: #8A2BE2;
                box-shadow: 0 0 0 3px rgba(138, 43, 226, 0.1);
                background: rgba(255, 255, 255, 0.15);
            }
            
            .form-input::placeholder, .form-textarea::placeholder {
                color: rgba(255, 255, 255, 0.6);
            }
            
            .password-input-group {
                position: relative;
                display: flex;
                align-items: center;
            }
            
            .password-toggle {
                position: absolute;
                left: 15px;
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.7);
                cursor: pointer;
                font-size: 1.1rem;
                transition: color 0.3s ease;
                z-index: 10;
            }
            
            .password-toggle:hover {
                color: #00e5ff;
            }
            
            .btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                padding: 15px 30px;
                border: none;
                border-radius: 12px;
                font-size: 1rem;
                font-weight: 600;
                font-family: 'Tajawal', sans-serif;
                text-decoration: none;
                cursor: pointer;
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
                min-height: 50px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            }
            
            .btn::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
                transition: left 0.5s;
            }
            
            .btn:hover::before {
                left: 100%;
            }
            
            .btn:hover {
                transform: translateY(-3px);
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
            }
            
            .btn:active {
                transform: translateY(-1px);
            }
            
            .btn-primary {
                background: linear-gradient(135deg, #8A2BE2, #00e5ff);
                color: white;
                width: 100%;
            }
            
            .btn-primary:hover {
                background: linear-gradient(135deg, #00e5ff, #8A2BE2);
                box-shadow: 0 8px 25px rgba(138, 43, 226, 0.5);
            }
            
            .btn-secondary {
                background: rgba(255, 255, 255, 0.1);
                color: white;
                border: 2px solid rgba(255, 255, 255, 0.2);
            }
            
            .btn-secondary:hover {
                background: rgba(255, 255, 255, 0.2);
                border-color: #8A2BE2;
                box-shadow: 0 8px 25px rgba(138, 43, 226, 0.2);
            }
            
            .form-message {
                padding: 15px 20px;
                border-radius: 12px;
                margin: 15px 0;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 10px;
                opacity: 0;
                transform: translateY(-10px);
                transition: all 0.3s ease;
                border-left: 4px solid;
            }
            
            .form-message.show {
                opacity: 1;
                transform: translateY(0);
            }
            
            .form-message::before {
                font-family: 'Font Awesome 6 Free';
                font-weight: 900;
                font-size: 1.2rem;
            }
            
            .form-message.success {
                background: rgba(46, 213, 115, 0.1);
                color: #2ed573;
                border-color: #2ed573;
            }
            
            .form-message.success::before {
                content: '\\f00c';
            }
            
            .form-message.error {
                background: rgba(255, 71, 87, 0.1);
                color: #ff4757;
                border-color: #ff4757;
            }
            
            .form-message.error::before {
                content: '\\f00d';
            }
            
            .form-message.warning {
                background: rgba(255, 165, 2, 0.1);
                color: #ffa502;
                border-color: #ffa502;
            }
            
            .form-message.warning::before {
                content: '\\f071';
            }
            
            .form-message.info {
                background: rgba(59, 130, 246, 0.1);
                color: #3b82f6;
                border-color: #3b82f6;
            }
            
            .form-message.info::before {
                content: '\\f05a';
            }
            
            .auth-links {
                text-align: center;
                margin-top: 25px;
            }
            
            .auth-link {
                color: #00e5ff;
                text-decoration: none;
                font-weight: 500;
                transition: all 0.3s ease;
                cursor: pointer;
            }
            
            .auth-link:hover {
                color: #8A2BE2;
                text-shadow: 0 0 10px currentColor;
            }
            
            .divider {
                text-align: center;
                margin: 20px 0;
                position: relative;
                color: rgba(255, 255, 255, 0.6);
            }
            
            .divider::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 0;
                right: 0;
                height: 1px;
                background: rgba(255, 255, 255, 0.2);
                z-index: 1;
            }
            
            .divider span {
                background: rgba(21, 19, 44, 0.85);
                padding: 0 15px;
                position: relative;
                z-index: 2;
            }
            
            /* تحسينات للموبايل */
            @media (max-width: 768px) {
                .auth-container {
                    width: 100% !important;
                    padding: 15px !important;
                }
                
                .auth-card {
                    padding: 30px 20px !important;
                }
                
                .auth-title {
                    font-size: 1.8rem;
                }
                
                .btn {
                    padding: 12px 20px;
                    font-size: 0.9rem;
                }
            }
            
            /* تحسينات إضافية */
            .loading-spinner {
                width: 20px;
                height: 20px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-top: 2px solid #00e5ff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-left: 10px;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                z-index: 99999;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 20px;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .modal.show {
                opacity: 1;
            }
            
            .modal-content {
                background: rgba(21, 19, 44, 0.95);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border-radius: 18px;
                border: 1px solid rgba(138, 43, 226, 0.3);
                box-shadow: 0 20px 60px rgba(138, 43, 226, 0.5);
                padding: 30px;
                max-width: 500px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                position: relative;
                transform: scale(0.8);
                transition: transform 0.3s ease;
            }
            
            .modal.show .modal-content {
                transform: scale(1);
            }
            
            .modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 1px solid rgba(138, 43, 226, 0.3);
            }
            
            .modal-title {
                font-size: 1.3rem;
                font-weight: 600;
                color: white;
                background: linear-gradient(135deg, #8A2BE2, #00e5ff);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .close-button {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.7);
                font-size: 1.5rem;
                cursor: pointer;
                padding: 5px;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }
            
            .close-button:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #ff4757;
                transform: scale(1.1);
            }
        `;
        document.head.appendChild(styles);
    }
    
    // ==================== فحص المصادقة الموجودة ====================
    async function checkExistingAuth() {
        const token = localStorage.getItem('token');
        const urlParams = new URLSearchParams(window.location.search);

        // If completing signup, stop here
        if (urlParams.has('complete_signup')) {
            console.log('إيقاف التحقق التلقائي للسماح بإكمال التسجيل.');
            return;
        }

        if (token) {
            try {
                setLoading(true, 'جاري التحقق من المصادقة...');
                
                const res = await fetch('/api/user/me', {
                    headers: { 'x-auth-token': token }
                });

                if (!res.ok) {
                    throw new Error('Failed to validate token');
                }

                const user = await res.json();
                console.log('🔐 المستخدم مُصادق مسبقاً');

                // Check if account needs completion
                if (!user.isComplete) {
                    console.log('⚠️ الحساب يحتاج إلى إكمال');
                    window.location.href = '/account?complete=true';
                    return;
                }

                // Account is complete, redirect to dashboard
                showMessage('مرحباً بعودتك! جاري توجيهك...', 'success');
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1500);

            } catch (err) {
                console.error('خطأ في التحقق من المصادقة:', err);
                localStorage.removeItem('token');
                setLoading(false);
            } finally {
                setLoading(false);
            }
        }
    }
    
    // ==================== تفعيل رابط نسيت كلمة المرور ====================
    function setupForgotPasswordLink() {
        const forgotLink = document.getElementById('forgot-password-link');
        
        if (forgotLink) {
            console.log('🔗 إعداد رابط نسيت كلمة المرور');
            
            // إزالة مستمعي الأحداث السابقين
            const newForgotLink = forgotLink.cloneNode(true);
            forgotLink.parentNode.replaceChild(newForgotLink, forgotLink);
            
            // إضافة مستمعي أحداث
            const events = isMobile ? ['touchstart', 'click'] : ['click'];
            
            events.forEach(eventType => {
                newForgotLink.addEventListener(eventType, function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    console.log('🔓 تم النقر على رابط نسيت كلمة المرور');
                    showForgotPasswordModal();
                }, { passive: eventType === 'touchstart' });
            });
            
            console.log('✅ تم إعداد رابط نسيت كلمة المرور');
        } else {
            console.warn('⚠️ لم يتم العثور على رابط نسيت كلمة المرور');
        }
    }
    
   // إصلاح زر الدعم الفني في index.js
// إضافة دالة إعداد زر الدعم الفني في account.js
function setupSupportButton() {
    console.log('Setting up support button in account page...');
    
    const supportBtn = document.getElementById('support-gear-btn');
    const supportModal = document.getElementById('support-modal');
    
    if (supportBtn && supportModal) {
        // إزالة المستمع القديم وإضافة جديد
        const newBtn = supportBtn.cloneNode(true);
        supportBtn.parentNode.replaceChild(newBtn, supportBtn);
        
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Support button clicked!');
            showSupportModal();
        });
        
        console.log('✅ Support button setup complete');
    } else {
        console.warn('❌ Support button or modal not found');
    }
}

function showSupportModal() {
    const modal = document.getElementById('support-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
        
        console.log('✅ Support modal displayed');
    }
}

function closeSupportModal() {
    const modal = document.getElementById('support-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }
}

// إضافة هذا في نهاية setupAllEventListeners
function setupAllEventListeners() {
    // ... الكود الموجود ...
    
    // إضافة إعداد زر الدعم الفني
    setupSupportButton();
    
    console.log('✅ All event listeners setup complete');
}

// جعل الدوال متاحة عالمياً
window.showSupportModal = showSupportModal;
window.closeSupportModal = closeSupportModal;

// إصلاح أيقونة Google في account.js
function fixGoogleIcons() {
    console.log('Fixing Google icons...');
    
    // البحث عن جميع أزرار Google
    const googleButtons = document.querySelectorAll('[class*="google"], .btn-google, #google-link-btn');
    
    googleButtons.forEach(btn => {
        let icon = btn.querySelector('i.fab.fa-google, i[class*="google"]');
        
        if (!icon) {
            // إنشاء أيقونة جديدة
            icon = document.createElement('i');
            icon.className = 'fab fa-google';
            btn.insertBefore(icon, btn.firstChild);
        }
        
        // تطبيق الأنماط المطلوبة
        icon.style.cssText = `
            width: 20px !important;
            height: 20px !important;
            background: #ffffff !important;
            color: #4285F4 !important;
            border-radius: 4px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 14px !important;
            margin-left: 8px !important;
            flex-shrink: 0 !important;
        `;
        
        // Fallback إذا فشلت Font Awesome
        setTimeout(() => {
            const computedStyle = window.getComputedStyle(icon, '::before');
            if (computedStyle.content === 'none' || computedStyle.content === '""') {
                icon.style.cssText += `
                    font-family: Arial, sans-serif !important;
                    font-weight: bold !important;
                    font-size: 12px !important;
                `;
                icon.innerHTML = 'G';
                console.log('Applied Google icon fallback');
            }
        }, 100);
    });
    
    console.log('✅ Google icons fixed');
}

// إضافة هذا في setupAllEventListeners
function setupAllEventListeners() {
    // ... الكود الموجود ...
    
    // إصلاح أيقونات Google
    setTimeout(fixGoogleIcons, 200);
    
    console.log('✅ All event listeners setup complete');
}
function createSupportButton() {
    let supportBtn = document.getElementById('support-fab-btn');
    
    if (!supportBtn) {
        supportBtn = document.createElement('button');
        supportBtn.id = 'support-fab-btn';
        supportBtn.innerHTML = '<i class="fas fa-headset"></i>';
        supportBtn.style.cssText = `
            position: fixed !important;
            bottom: 28px !important;
            left: 28px !important;
            z-index: 1001 !important;
            background: linear-gradient(135deg, #8A2BE2, #00e5ff) !important;
            color: #fff !important;
            border: none !important;
            border-radius: 50% !important;
            width: 60px !important;
            height: 60px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
        `;
        document.body.appendChild(supportBtn);
    }
    
    supportBtn.addEventListener('click', showSupportModal);
}

document.addEventListener('DOMContentLoaded', createSupportButton);

// دالة لإظهار نافذة الدعم الفني
function showSupportModal() {
    console.log('Showing support modal...');
    
    let modal = document.getElementById('support-modal');
    if (!modal) {
        console.log('Creating support modal...');
        createSupportModal();
        modal = document.getElementById('support-modal');
    }
    
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
        
        console.log('✅ Support modal displayed');
    } else {
        console.error('❌ Could not create or find support modal');
    }
}

// دالة لإنشاء نافذة الدعم الفني
function createSupportModal() {
    const modal = document.createElement('div');
    modal.id = 'support-modal';
    modal.className = 'modal support-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'support-title');
    modal.setAttribute('aria-hidden', 'true');
    
    modal.innerHTML = `
        <div class="modal-content support-modal-content">
            <div class="modal-header">
                <h2 id="support-title" class="modal-title">
                    <i class="fas fa-headset" style="margin-left: 8px;"></i>
                    الدعم الفني
                </h2>
                <button type="button" class="close-button" onclick="closeSupportModal()" aria-label="إغلاق">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </div>
            <div class="modal-body">
                <p>تواصل معنا عبر إحدى الطرق التالية:</p>
                <div class="support-options" role="group" aria-label="خيارات التواصل">
                    <a href="mailto:hussianabdk577@gmail.com" class="support-option email">
                        <i class="fas fa-envelope" aria-hidden="true"></i>
                        <span>البريد الإلكتروني</span>
                    </a>
                    <a href="https://wa.me/201091601661" class="support-option whatsapp" target="_blank" rel="noopener noreferrer">
                        <i class="fab fa-whatsapp" aria-hidden="true"></i>
                        <span>واتساب</span>
                    </a>
                    <a href="tel:01091601661" class="support-option phone">
                        <i class="fas fa-phone" aria-hidden="true"></i>
                        <span>الهاتف</span>
                    </a>
                </div>
            </div>
        </div>
    `;
    
    // إضافة مستمعي الإغلاق
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeSupportModal();
        }
    });
    
    document.body.appendChild(modal);
    console.log('✅ Support modal created');
}

// دالة لإغلاق نافذة الدعم الفني
function closeSupportModal() {
    const modal = document.getElementById('support-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
        console.log('✅ Support modal closed');
    }
}
// التأكد من تحميل أيقونة Google
document.addEventListener('DOMContentLoaded', function() {
    const googleBtns = document.querySelectorAll('.btn-google');
    
    googleBtns.forEach(btn => {
        // التحقق من وجود الأيقونة
        let icon = btn.querySelector('.fab.fa-google, i[class*="google"]');
        
        if (!icon) {
            // إنشاء أيقونة إذا لم تكن موجودة
            icon = document.createElement('i');
            icon.className = 'fab fa-google';
            btn.insertBefore(icon, btn.firstChild);
        }
        
        // إضافة fallback إذا فشلت Font Awesome
        setTimeout(() => {
            const computedStyle = window.getComputedStyle(icon, '::before');
            if (computedStyle.content === 'none' || computedStyle.content === '""') {
                icon.classList.add('google-fallback');
                icon.innerHTML = 'G';
            }
        }, 100);
    });
});


// إضافة المتغيرات للنطاق العالمي
window.showSupportModal = showSupportModal;
window.closeSupportModal = closeSupportModal;

    
    function setupLoginForm() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                if (isLoading) return;
                
                const formData = new FormData(e.target);
                const loginData = {
                    email: formData.get('email')?.trim(),
                    password: formData.get('password'),
                    deviceInfo: getDeviceInfo()
                };
                
                // التحقق من صحة البيانات
                if (!loginData.email || !loginData.password) {
                    showMessage('يرجى ملء جميع الحقول', 'error');
                    return;
                }
                
                if (!isValidEmail(loginData.email)) {
                    showMessage('يرجى إدخال بريد إلكتروني صحيح', 'error');
                    return;
                }
                
                try {
                    setLoading(true, 'جاري تسجيل الدخول...');
                    showMessage('جاري تسجيل الدخول...', 'info');
                    
                    const res = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(loginData)
                    });
                    
                    const data = await res.json();

                    if (res.ok) {
                        // *** START: NEW 2FA LOGIC ***
                        if (data.twoFactorRequired) {
                            // إذا كانت المصادقة مفعلة، أظهر نافذة إدخال الكود
                            showMessage(data.msg, 'info');
                            resetEmail = loginData.email; // حفظ الإيميل لاستخدامه لاحقاً
                            showModal('2fa-modal');
                        } else {
                            // إذا كانت المصادقة معطلة، سجل الدخول مباشرة
                            localStorage.setItem('token', data.token);
                            showMessage('تم تسجيل الدخول بنجاح!', 'success');
                            setTimeout(() => { window.location.href = '/dashboard'; }, 1500);
                        }
                        // *** END: NEW 2FA LOGIC ***
                    } else {
                        throw data;
                    }
                } catch (err) {
                    console.error('خطأ في تسجيل الدخول:', err);
                    if (err.blocked) {
                        let contactHTML = '';
                        if (err.adminContact) {
                            contactHTML = `<div style="margin-top: 10px; font-size: 0.9em;">للتواصل: `;
                            if (err.adminContact.whatsapp) {
                                let waLink = err.adminContact.whatsapp.includes('http') ? err.adminContact.whatsapp : 'https://wa.me/' + err.adminContact.whatsapp.replace(/[^0-9]/g, '');
                                contactHTML += `<a href="${waLink}" target="_blank" style="color:#25D366; text-decoration:none;"><i class="fab fa-whatsapp"></i> واتساب</a> `;
                            }
                            if (err.adminContact.email) {
                                contactHTML += ` &nbsp;|&nbsp; <a href="mailto:${err.adminContact.email}" style="color:#EA4335; text-decoration:none;"><i class="fas fa-envelope"></i> تعليق/إيميل</a>`;
                            }
                            contactHTML += `</div>`;
                        }
                        
                        // تخصيص عرض الرسالة لتشمل HTML
                        const messageDiv = document.getElementById('form-message') || getOrCreateMessageDiv('form-message');
                        messageDiv.innerHTML = `<i class="fas fa-ban" style="margin-left: 8px;"></i> <div>${err.msg || 'تم إيقاف حسابك'} ${contactHTML}</div>`;
                        messageDiv.className = `form-message error show`;
                        
                        setTimeout(() => {
                            messageDiv.classList.remove('show');
                            setTimeout(() => { messageDiv.innerHTML = ''; messageDiv.className = 'form-message'; }, 300);
                        }, 10000); // 10 ثواني للرسائل الطويلة
                    } else {
                        showMessage(err.msg || err.message || 'حدث خطأ في تسجيل الدخول', 'error');
                    }
                } finally {
                    setLoading(false);
                }
            });
            console.log('✅ تم إعداد نموذج تسجيل الدخول');
        }
    }
    
    function setupRegisterForm() {
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                if (isLoading) return;
                
                const formData = new FormData(e.target);
                const registerData = {
                    username: formData.get('username')?.trim(),
                    email: formData.get('email')?.trim(),
                    password: formData.get('password'),
                    adafruitUsername: formData.get('adafruitUsername')?.trim() || '',
                    adafruitApiKey: formData.get('adafruitApiKey')?.trim() || ''
                };
                
                // التحقق من صحة البيانات
                const validation = validateRegistrationData(registerData);
                if (!validation.isValid) {
                    showMessage(validation.message, 'error');
                    return;
                }
                
                try {
                    setLoading(true, 'جاري إنشاء الحساب...');
                    showMessage('جاري إنشاء الحساب...', 'info');
                    
                    const res = await fetch('/api/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(registerData)
                    });
                    
                    const data = await res.json();
                    
                    if (res.ok) {
                        showMessage('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول', 'success');
                        setTimeout(() => {
                            showLoginForm();
                            registerForm.reset();
                        }, 2000);
                    } else {
                        throw new Error(data.msg || 'فشل في إنشاء الحساب');
                    }
                } catch (err) {
                    console.error('خطأ في التسجيل:', err);
                    showMessage(err.message || 'حدث خطأ في إنشاء الحساب', 'error');
                } finally {
                    setLoading(false);
                }
            });
            console.log('✅ تم إعداد نموذج التسجيل');
        }
    }
    
    function setupForgotPasswordForm() {
        const forgotForm = document.getElementById('forgot-password-form');
        if (forgotForm) {
            forgotForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                if (isLoading) return;
                
                const email = new FormData(e.target).get('email')?.trim();
                
                if (!email) {
                    showForgotMessage('يرجى إدخال البريد الإلكتروني', 'error');
                    return;
                }
                
                if (!isValidEmail(email)) {
                    showForgotMessage('يرجى إدخال بريد إلكتروني صحيح', 'error');
                    return;
                }
                
                resetEmail = email;
                
                try {
                    setLoading(true, 'جاري إرسال الكود...');
                    showForgotMessage('جاري إرسال كود إعادة التعيين...', 'info');
                    
                    const res = await fetch('/api/auth/forgot-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });
                    
                    const data = await res.json();
                    
                    if (res.ok) {
                        showForgotMessage('تم إرسال كود إعادة التعيين إلى بريدك الإلكتروني', 'success');
                        setTimeout(() => {
                            closeForgotPasswordModal();
                            showVerificationModal();
                        }, 2000);
                    } else {
                        throw new Error(data.msg || 'خطأ في إرسال الكود');
                    }
                } catch (err) {
                    console.error('خطأ في نسيت كلمة المرور:', err);
                    showForgotMessage(err.message || 'حدث خطأ في إرسال الكود', 'error');
                } finally {
                    setLoading(false);
                }
            });
            console.log('✅ تم إعداد نموذج نسيت كلمة المرور');
        }
    }
    
    function setupVerificationForm() {
        const verificationForm = document.getElementById('verification-form');
        if (verificationForm) {
            verificationForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                if (isLoading) return;
                
                const code = new FormData(e.target).get('verification-code')?.trim();
                
                if (!code) {
                    showVerificationMessage('يرجى إدخال كود التحقق', 'error');
                    return;
                }
                
                if (code.length !== 6 || !/^\d{6}$/.test(code)) {
                    showVerificationMessage('كود التحقق يجب أن يكون 6 أرقام', 'error');
                    return;
                }
                
                resetCode = code;
                
                try {
                    setLoading(true, 'جاري التحقق من الكود...');
                    showVerificationMessage('جاري التحقق من الكود...', 'info');
                    
                    const res = await fetch('/api/auth/verify-reset-code', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: resetEmail, code })
                    });
                    
                    const data = await res.json();
                    
                    if (res.ok) {
                        showVerificationMessage('تم التحقق بنجاح!', 'success');
                        setTimeout(() => {
                            closeVerificationModal();
                            showResetPasswordModal();
                        }, 1500);
                    } else {
                        throw new Error(data.msg || 'كود التحقق غير صحيح');
                    }
                } catch (err) {
                    console.error('خطأ في التحقق:', err);
                    showVerificationMessage(err.message || 'حدث خطأ في التحقق', 'error');
                } finally {
                    setLoading(false);
                }
            });
            console.log('✅ تم إعداد نموذج التحقق');
        }
    }
    
    function setupResetPasswordForm() {
    const resetForm = document.getElementById('reset-password-form');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isLoading) return;
            
            // 🔧 الحل: استخدام FormData للحصول على القيم بشكل صحيح
            const formData = new FormData(e.target);
            const newPassword = formData.get('new-password');
            const confirmPassword = formData.get('confirm-password'); // ✅ المهم جداً

            const validation = validatePasswords(newPassword, confirmPassword);
            if (!validation.isValid) {
                showResetMessage(validation.message, 'error');
                return;
            }

            try {
                setLoading(true, 'جاري تحديث كلمة المرور...');
                showResetMessage('جاري تحديث كلمة المرور...', 'info');
                
                const res = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        email: resetEmail, 
                        code: resetCode, 
                        newPassword,
                        confirmPassword // ✅ الآن سيتم إرساله
                    })
                });
                
                const data = await res.json();
                if (res.ok) {
                    showResetMessage(data.msg, 'success');
                    setTimeout(() => {
                        closeResetPasswordModal();
                        showLoginForm();
                        showMessage('يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة', 'success');
                    }, 2500);
                } else {
                    throw new Error(data.msg || 'فشل في تحديث كلمة المرور');
                }
            } catch (err) {
                console.error('خطأ في إعادة تعيين كلمة المرور:', err);
                showResetMessage(err.message || 'حدث خطأ في تحديث كلمة المرور', 'error');
            } finally {
                setLoading(false);
            }
        });
        
        console.log('✅ تم إعداد نموذج إعادة تعيين كلمة المرور');
    }
}

    // ==================== التحقق من صحة البيانات ====================
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    function validateRegistrationData(data) {
        if (!data.username || data.username.length < 3) {
            return { isValid: false, message: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' };
        }
        
        if (!data.email || !isValidEmail(data.email)) {
            return { isValid: false, message: 'يرجى إدخال بريد إلكتروني صحيح' };
        }
        
        if (!data.password || data.password.length < 6) {
            return { isValid: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
        }
        
        return { isValid: true };
    }
    
    function validatePasswords(password, confirmPassword) {
        if (!password || !confirmPassword) {
            return { isValid: false, message: 'يرجى ملء جميع حقول كلمة المرور' };
        }
        
        if (password !== confirmPassword) {
            return { isValid: false, message: 'كلمتا المرور غير متطابقتين' };
        }
        
        if (password.length < 6) {
            return { isValid: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
        }
        
        return { isValid: true };
    }
    
    // ==================== إعداد النوافذ المنبثقة ====================
    function setupModals() {
        setupModalCloseEvents();
        setupKeyboardNavigation();
    }
    
    function setupModalCloseEvents() {
        const modals = [
            'forgot-password-modal',
            'verification-modal', 
            'reset-password-modal',
            'support-modal'
        ];
        
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                // إغلاق عند النقر خارج المحتوى
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        closeModal(modalId);
                    }
                });
                
                // إغلاق عند النقر على زر الإغلاق
                const closeBtn = modal.querySelector('.close-button');
                if (closeBtn) {
                    const events = isMobile ? ['touchstart', 'click'] : ['click'];
                    events.forEach(eventType => {
                        closeBtn.addEventListener(eventType, (e) => {
                            e.preventDefault();
                            closeModal(modalId);
                        });
                    });
                }
            }
        });
        
        // إغلاق عند الضغط على Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal.show');
                if (openModal) {
                    closeModal(openModal.id);
                }
            }
        });
    }
    
    function setupKeyboardNavigation() {
        // تحسين التنقل بلوحة المفاتيح
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const activeElement = document.activeElement;
                const form = activeElement.closest('form');
                
                if (form && activeElement.tagName !== 'BUTTON' && activeElement.type !== 'submit') {
                    e.preventDefault();
                    const submitBtn = form.querySelector('button[type="submit"]');
                    if (submitBtn && !submitBtn.disabled) {
                        submitBtn.click();
                    }
                }
            }
        });
    }
    
    // ==================== وظائف النوافذ المنبثقة ====================
    function showForgotPasswordModal() {
        resetEmail = '';
        resetCode = '';
        showModal('forgot-password-modal');
        
        // التركيز على حقل البريد الإلكتروني
        setTimeout(() => {
            const emailInput = document.querySelector('#forgot-password-modal input[type="email"]');
            if (emailInput) {
                emailInput.focus();
            }
        }, 300);
        
        console.log('🔓 فتح نافذة نسيت كلمة المرور');
    }
    
    function closeForgotPasswordModal() {
        closeModal('forgot-password-modal');
        const form = document.getElementById('forgot-password-form');
        if (form) form.reset();
        clearMessage('forgot-message');
    }
    
    function showVerificationModal() {
        showModal('verification-modal');
        
        // التركيز على حقل الكود
        setTimeout(() => {
            const codeInput = document.querySelector('#verification-modal input[type="text"]');
            if (codeInput) {
                codeInput.focus();
            }
        }, 300);
        
        console.log('🔢 فتح نافذة التحقق');
    }
    
    function closeVerificationModal() {
        closeModal('verification-modal');
        const form = document.getElementById('verification-form');
        if (form) form.reset();
        clearMessage('verification-message');
    }
    
    function showResetPasswordModal() {
        showModal('reset-password-modal');
        
        // التركيز على حقل كلمة المرور الجديدة
        setTimeout(() => {
            const passwordInput = document.querySelector('#reset-password-modal input[type="password"]');
            if (passwordInput) {
                passwordInput.focus();
            }
        }, 300);
        
        console.log('🔄 فتح نافذة إعادة تعيين كلمة المرور');
    }
    
    function closeResetPasswordModal() {
        closeModal('reset-password-modal');
        const form = document.getElementById('reset-password-form');
        if (form) form.reset();
        clearMessage('reset-message');
        resetEmail = '';
        resetCode = '';
    }
    
    function showSupportModal() {
        showModal('support-modal');
        console.log('🛠️ فتح نافذة الدعم');
    }
    
    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
            
            modal.setAttribute('aria-hidden', 'false');
            modal.dataset.previousFocus = document.activeElement.id || '';
        }
    }
    
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
            
            setTimeout(() => {
                modal.style.display = 'none';
                document.body.style.overflow = '';
                
                const previousFocusId = modal.dataset.previousFocus;
                if (previousFocusId) {
                    const previousElement = document.getElementById(previousFocusId);
                    if (previousElement) {
                        previousElement.focus();
                    }
                }
            }, 300);
        }
    }
    
    // ==================== إدارة حالة التحميل ====================
    function setLoading(loading, message = '') {
        isLoading = loading;
        
        // تعطيل/تفعيل جميع النماذج
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            const inputs = form.querySelectorAll('input, button, select, textarea');
            inputs.forEach(input => {
                input.disabled = loading;
            });
        });
        
        // تحديث نص أزرار الإرسال
        const submitButtons = document.querySelectorAll('button[type="submit"]');
        submitButtons.forEach(button => {
            if (loading) {
                button.dataset.originalText = button.textContent;
                button.innerHTML = '<div class="loading-spinner"></div>' + (message || 'جاري المعالجة...');
            } else {
                button.innerHTML = button.dataset.originalText || button.textContent;
            }
        });
    }
    
    // ==================== وظائف الرسائل ====================
    function showMessage(message, type) {
        const messageDiv = getOrCreateMessageDiv('form-message');
        displayMessage(messageDiv, message, type);
    }
    
    function showForgotMessage(message, type) {
        const messageDiv = getOrCreateMessageDiv('forgot-message');
        displayMessage(messageDiv, message, type);
    }
    
    function showVerificationMessage(message, type) {
        const messageDiv = getOrCreateMessageDiv('verification-message');
        displayMessage(messageDiv, message, type);
    }
    
    function showResetMessage(message, type) {
        const messageDiv = getOrCreateMessageDiv('reset-message');
        displayMessage(messageDiv, message, type);
    }
    
    function getOrCreateMessageDiv(id) {
        let messageDiv = document.getElementById(id);
        if (!messageDiv) {
            messageDiv = document.createElement('div');
            messageDiv.id = id;
            messageDiv.className = 'form-message';
            messageDiv.setAttribute('role', 'alert');
            messageDiv.setAttribute('aria-live', 'polite');
            
            const targetForm = findTargetForm(id);
            if (targetForm) {
                targetForm.appendChild(messageDiv);
            }
        }
        return messageDiv;
    }
    
    function findTargetForm(messageId) {
        const formMappings = {
            'form-message': 'login-form',
            'forgot-message': 'forgot-password-form',
            'verification-message': 'verification-form',
            'reset-message': 'reset-password-form'
        };
        
        const formId = formMappings[messageId];
        return formId ? document.getElementById(formId) : null;
    }
    
    function displayMessage(messageDiv, message, type) {
        if (messageDiv) {
            // Check if it already has custom HTML injected before overriding
            if (!messageDiv.innerHTML.includes('<a') && !messageDiv.innerHTML.includes('<i class="fas fa-ban"')) {
                messageDiv.textContent = message;
            }
            messageDiv.className = `form-message ${type} show`;
            
            const duration = type === 'error' ? 7000 : 5000;
            setTimeout(() => {
                messageDiv.classList.remove('show');
            }, duration);
        }
    }
    
    function clearMessage(messageId) {
        const messageDiv = document.getElementById(messageId);
        if (messageDiv) {
            messageDiv.classList.remove('show');
        }
    }
    
    // ==================== إدارة الثيمات ====================
    function setupThemeToggle() {
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
            console.log('🎨 تم إعداد تبديل الثيم');
        }
    }
    
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        const themeToggle = document.querySelector('.theme-toggle i');
        if (themeToggle) {
            themeToggle.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
        
        console.log(`🎨 تم تغيير الثيم إلى: ${newTheme}`);
    }
    
    function loadSavedTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        const themeToggle = document.querySelector('.theme-toggle i');
        if (themeToggle) {
            themeToggle.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
        
        console.log(`🎨 تم تحميل الثيم: ${savedTheme}`);
    }
    
    // ==================== وظائف التنقل بين النماذج ====================
    window.showRegisterForm = function() {
        const loginContainer = document.getElementById('login-form').parentElement;
        const registerForm = document.getElementById('register-form');
        
        if (loginContainer && registerForm) {
            loginContainer.style.display = 'none';
            registerForm.style.display = 'block';
            
            setTimeout(() => {
                const firstInput = registerForm.querySelector('input');
                if (firstInput) firstInput.focus();
            }, 100);
        }
    };
    
    window.showLoginForm = function() {
        const registerForm = document.getElementById('register-form');
        const loginContainer = document.getElementById('login-form').parentElement;
        
        if (registerForm && loginContainer) {
            registerForm.style.display = 'none';
            loginContainer.style.display = 'block';
            
            setTimeout(() => {
                const firstInput = loginContainer.querySelector('input');
                if (firstInput) firstInput.focus();
            }, 100);
        }
    };
    
    // ==================== وظائف إضافية ====================
    window.togglePasswordVisibility = function(inputId) {
        const input = document.getElementById(inputId);
        const icon = document.getElementById(inputId + '-icon');
        
        if (input && icon) {
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fas fa-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'fas fa-eye';
            }
        }
    };
    
    // ==================== معالجة النماذج الموجودة ====================
    function handleFormSubmissions() {
        // Handle Forgot Password Form
        const forgotPasswordForm = document.getElementById('forgot-password-form');
        if (forgotPasswordForm) {
            forgotPasswordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const email = new FormData(e.target).get('email');
                
                try {
                    const response = await fetch('/api/auth/forgot-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        showForgotMessage('تم إرسال كود إعادة التعيين', 'success');
                        resetEmail = email;
                        setTimeout(() => {
                            closeForgotPasswordModal();
                            showVerificationModal();
                        }, 2000);
                    } else {
                        showForgotMessage(data.msg || 'خطأ في إرسال الكود', 'error');
                    }
                } catch (err) {
                    showForgotMessage('فشل في الاتصال بالخادم', 'error');
                }
            });
        }
        
        // Handle Verification Form
        const verificationForm = document.getElementById('verification-form');
        if (verificationForm) {
            verificationForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const code = new FormData(e.target).get('verification-code');
                
                try {
                    const response = await fetch('/api/auth/verify-reset-code', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: resetEmail, code })
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        showVerificationMessage('تم التحقق بنجاح', 'success');
                        resetCode = code;
                        setTimeout(() => {
                            closeVerificationModal();
                            showResetPasswordModal();
                        }, 1500);
                    } else {
                        showVerificationMessage(data.msg || 'كود التحقق غير صحيح', 'error');
                    }
                } catch (err) {
                    showVerificationMessage('فشل في التحقق', 'error');
                }
            });
        }
        
        // Handle Reset Password Form
        const resetPasswordForm = document.getElementById('reset-password-form');
        if (resetPasswordForm) {
            resetPasswordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(e.target);
                const newPassword = formData.get('new-password');
                const confirmPassword = formData.get('confirm-password');
                
                if (newPassword !== confirmPassword) {
                    showResetMessage('كلمتا المرور غير متطابقتين', 'error');
                    return;
                }
                
                try {
                    const response = await fetch('/api/auth/reset-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            email: resetEmail,
                            code: resetCode,
                            newPassword 
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        showResetMessage('تم تحديث كلمة المرور بنجاح', 'success');
                        setTimeout(() => {
                            closeResetPasswordModal();
                            showMessage('يمكنك الآن تسجيل الدخول', 'success');
                        }, 2000);
                    } else {
                        showResetMessage(data.msg || 'فشل في تحديث كلمة المرور', 'error');
                    }
                } catch (err) {
                    showResetMessage('حدث خطأ', 'error');
                }
            });
        }
    }
    
    // ==================== تشغيل الوظائف ====================
    document.addEventListener('DOMContentLoaded', () => {
        handleFormSubmissions();
    });
    
    // دالة التحقق من المصادقة الثنائية
    async function handle2FAVerification(e) {
        e.preventDefault();
        if (isLoading) return;

        const twoFactorCode = document.getElementById('2fa-code').value.trim();
        const messageDiv = document.getElementById('2fa-message');

        if (!twoFactorCode) {
            showMessage(messageDiv, 'يرجى إدخال رمز التحقق', 'error');
            return;
        }

        try {
            setLoading(true);
            showMessage(messageDiv, 'جاري التحقق من الرمز...', 'info');

            const response = await fetch('/api/auth/verify-2fa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetEmail, twoFactorCode })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.msg || 'فشل التحقق');
            }

            // عند النجاح، احفظ التوكن وسجل الدخول
            localStorage.setItem('token', data.token);
            showMessage(messageDiv, 'تم التحقق بنجاح! جاري تسجيل الدخول...', 'success');

            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1500);

        } catch (error) {
            showMessage(messageDiv, error.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    console.log('✅ صفحة تسجيل الدخول - جاهزة للاستخدام!');
    
})();

// ==================== إعادة إرسال الكود ====================
async function resendCode() {
    if (!resetEmail) return;
    
    try {
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: resetEmail })
        });
        
        if (response.ok) {
            showVerificationMessage('تم إعادة إرسال الكود', 'success');
        }
    } catch (err) {
        showVerificationMessage('فشل في إعادة الإرسال', 'error');
    }
}

// ==================== وظائف إكمال تسجيل جوجل ====================
function checkForGoogleSignup() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('complete_signup')) {
        // إزالة البارامتر من الرابط لكي لا تظهر النافذة عند تحديث الصفحة
        window.history.replaceState({}, document.title, "/");
        
        // بما أن الخادم أرسل التوكن، يمكننا الآن إظهار نافذة إكمال التسجيل
        const token = localStorage.getItem('token');
        if (token) {
             showModal('complete-signup-modal');
        } else {
            console.error("Redirected to complete signup without a token.");
            showMessage('حدث خطأ، يرجى المحاولة مرة أخرى', 'error');
        }
    }
}

// تأكد من ربط النموذج
const completeSignupForm = document.getElementById('complete-signup-form');
if (completeSignupForm) {
    completeSignupForm.addEventListener('submit', handleCompleteSignup);
}

async function handleCompleteSignup(e) {
    e.preventDefault();
    const password = document.getElementById('complete-password').value;
    const adafruitUsername = document.getElementById('complete-adafruit-username').value;
    const adafruitApiKey = document.getElementById('complete-adafruit-key').value;
    const messageDiv = document.getElementById('complete-signup-message');
    const token = localStorage.getItem('token');

    if (password.length < 6) {
        return showMessage(messageDiv, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.', 'error');
    }

    try {
        setLoading(true);
        const response = await fetch('/api/auth/complete-google-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body: JSON.stringify({ password, adafruitUsername, adafruitApiKey })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.msg);

        showMessage(messageDiv, 'تم إكمال التسجيل بنجاح! جاري توجيهك...', 'success');
        setTimeout(() => window.location.href = '/dashboard', 2000);

    } catch (err) {
        showMessage(messageDiv, err.message, 'error');
    } finally {
        setLoading(false);
    }
}