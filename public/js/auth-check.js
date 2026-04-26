// public/js/auth-check.js - ENHANCED AUTHENTICATION CHECKER v3.0
(function() {
    'use strict';
    function stylize(str) {
  return (str||'')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

   

    
    console.log('🔐 Auth checker v3.0 - Loading...');
    
    // ==================== المتغيرات العامة ==================== 
    const token = localStorage.getItem('token');
    const currentPath = window.location.pathname;
    let authCheckInterval = null;
    let isOnline = navigator.onLine;
    
    // الصفحات المحمية والعامة
    const protectedPages = ['/dashboard', '/settings', '/account'];
    const publicPages = ['/', '/forgot-password', '/reset-password'];
    
    // بدء فحص المصادقة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAuthChecker);
    } else {
        initializeAuthChecker();
    }
    
    async function initializeAuthChecker() {
        console.log(`🔍 Checking auth for path: ${currentPath}`);
        
        // فحص المصادقة الأولي
        await checkAuthStatus();
        
        // بدء الفحص الدوري
        startPeriodicAuthCheck();
        
        // مراقبة حالة الاتصال
        setupConnectionMonitoring();
        
        // مراقبة تغييرات التخزين المحلي
        setupStorageMonitoring();
        
        console.log('✅ Auth checker initialized');
    }
    
    // ==================== فحص المصادقة الأساسي ==================== 
    async function checkAuthStatus() {
        if (!token) {
            handleNoToken();
            return false;
        }
        
        try {
            const response = await fetch('/api/user/me', {
                headers: { 'x-auth-token': token },
                signal: AbortSignal.timeout(10000) // مهلة زمنية 10 ثوان
            });
            
            if (response.ok) {
                const user = await response.json();
                handleValidAuth(user);
                return true;
            } else {
                handleInvalidToken();
                return false;
            }
        } catch (error) {
            console.error('Auth check error:', error);
            handleAuthError(error);
            return false;
        }
    }
    
    function handleNoToken() {
        console.log('🔒 No token found');
        
        if (protectedPages.includes(currentPath)) {
            console.log('🔄 Redirecting to login (no token)');
            redirectToLogin('يرجى تسجيل الدخول للوصول لهذه الصفحة');
        }
    }
   function handleValidAuth(user) {
    console.log('✅ المستخدم مصادق عليه بنجاح');
    
    // ✅ فقط نفحص Google users اللي محتاجين يكملوا التسجيل
    // الشرط: لازم يكون عنده googleId ومعندوش password وعلى صفحة محمية
    if (user.googleId && !user.password && protectedPages.includes(currentPath)) {
        console.log('🔄 حساب Google غير مكتمل - إعادة التوجيه لإكمال التسجيل');
        
        // ✅ تجنب الـ infinite loop - نتأكد إننا مش على الـ home page
        if (currentPath !== '/') {
            window.location.href = '/?completesignup=true';
        }
        return;
    }
    
    // ✅ لو المستخدم على صفحة عامة (login) وحسابه مكتمل، نوديه للـ dashboard
    if (publicPages.includes(currentPath) && user.password) {
        console.log('المستخدم مسجل دخول بالفعل - إعادة التوجيه للوحة التحكم');
        window.location.href = '/dashboard';
        return;
    }

    // تحديث معلومات المستخدم في الواجهة
    updateUserInfo(user);
    updateLastActivity();
    hideOfflineIndicator();
}

    
    function handleInvalidToken() {
        console.log('❌ Invalid token');
        
        // مسح التوكن غير الصالح
        localStorage.removeItem('token');
        sessionStorage.clear();
        
        if (protectedPages.includes(currentPath)) {
            redirectToLogin('انتهت صلاحية جلستك، يرجى تسجيل الدخول مرة أخرى');
        }
    }
    
    function handleAuthError(error) {
        if (!isOnline) {
            console.log('📡 Offline - skipping auth redirect');
            showOfflineIndicator();
            return;
        }
        
        if (error.name === 'AbortError') {
            console.log('⏱️ Auth check timeout');
            showMessage('انتهت مهلة التحقق من المصادقة', 'warning');
        }
        
        // في حالة خطأ الشبكة، لا نقوم بإعادة التوجيه إذا كان المستخدم في صفحة محمية
        if (protectedPages.includes(currentPath)) {
            console.log('🌐 Network error during auth check, staying on current page');
            showOfflineIndicator();
        }
    }
    
    function startPeriodicAuthCheck() {
    // ✅ لو على صفحة Login، متعملش periodic check
    if (publicPages.includes(currentPath)) {
        console.log('على صفحة عامة - لا حاجة لـ periodic auth check');
        return;
    }
    
    // فحص دوري كل 5 دقائق (فقط على الصفحات المحمية)
    authCheckInterval = setInterval(async () => {
        if (protectedPages.includes(window.location.pathname) && isOnline) {
            console.log('⏱️ Periodic auth check...');
            await checkAuthStatus();
        }
    }, 5 * 60 * 1000); // 5 دقائق
    
    console.log('✅ Periodic auth check started (5 minutes interval)');
}

    
    function stopPeriodicAuthCheck() {
        if (authCheckInterval) {
            clearInterval(authCheckInterval);
            authCheckInterval = null;
            console.log('⏹️ Periodic auth check stopped');
        }
    }
    
    // ==================== مراقبة الاتصال ==================== 
    function setupConnectionMonitoring() {
        window.addEventListener('online', () => {
            console.log('🌐 Connection restored');
            isOnline = true;
            hideOfflineIndicator();
            showMessage('تم استعادة الاتصال', 'success');
            
            // فحص المصادقة فوراً عند استعادة الاتصال
            setTimeout(() => {
                checkAuthStatus();
            }, 1000);
        });
        
        window.addEventListener('offline', () => {
            console.log('📡 Connection lost');
            isOnline = false;
            showOfflineIndicator();
            showMessage('فقدان الاتصال بالإنترنت', 'warning');
        });
    }
    
    // ==================== مراقبة التخزين المحلي ==================== 
    function setupStorageMonitoring() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'token' && e.newValue === null) {
                console.log('🔄 Token removed from another tab');
                showMessage('تم تسجيل الخروج من علامة تبويب أخرى', 'info');
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            }
        });
    }
    
    // ==================== تحديث واجهة المستخدم ==================== 
    function updateUserInfo(user) {
        // تحديث عناصر عرض اسم المستخدم
        const usernameDisplays = document.querySelectorAll('[data-user-info="username"]');
        const emailDisplays = document.querySelectorAll('[data-user-info="email"]');
        
        usernameDisplays.forEach(el => {
            el.textContent = user.username || 'مستخدم';
        });
        
        emailDisplays.forEach(el => {
            el.textContent = user.email || '';
        });
        
        // تحديث عنوان الصفحة
        updatePageTitle(user);
        
        // تحديث شريط التنقل
        updateNavigation(user);
    }
    
    function updatePageTitle(user) {
       const pageTitles = {
    '/dashboard': `⚡️ 𝒞𝑜𝓃𝓉𝓇𝑜𝓁𝑒𝓍 ⚙️ – 𝒟𝒜𝒮𝐻𝐵𝒪𝒜𝑅𝒟 📊`,
    '/settings': `⚙️ 𝒞𝑜𝓃𝓉𝓇𝑜𝓁𝑒𝓍 – 𝒮𝐸𝒯𝒯𝐼𝒩𝒢𝒮 🛠️ – ${stylize(user.username)}`,
    '/account': `👤 𝒞𝑜𝓃𝓉𝓇𝑜𝓁𝑒𝓍 – 𝒜𝒞𝒞𝒪𝒰𝒩𝒯 📇 – ${stylize(user.username)}`
};

        
        const newTitle = pageTitles[currentPath];
        if (newTitle) {
            document.title = newTitle;
        }
    }
    
    function updateNavigation(user) {
        // تحديث زر المستخدم في شريط التنقل
        const userButton = document.querySelector('.nav-user-button');
        if (userButton) {
            userButton.innerHTML = `
                <i class="fas fa-user-circle" aria-hidden="true"></i>
                <span>${user.username}</span>
            `;
        }
        
        // إظهار عناصر التنقل للمستخدمين المصادق عليهم
        const authElements = document.querySelectorAll('[data-auth-required]');
        authElements.forEach(el => {
            el.style.display = '';
        });

        // إضافة زر لوحة الإدارة إذا كان المستخدم أدمن
        if (user.role === 'admin') {
            // للقائمة العلوية
            const navMenu = document.getElementById('nav-menu');
            if (navMenu && !document.getElementById('admin-nav-item')) {
                const adminLi = document.createElement('li');
                adminLi.className = 'nav-item';
                adminLi.id = 'admin-nav-item';
                adminLi.innerHTML = `
                    <a href="/admin" class="nav-link" style="color: #ff4757;">
                        <i class="fas fa-shield-alt" aria-hidden="true"></i>
                        <span>لوحة الإدارة</span>
                    </a>
                `;
                // إدخال قبل زر الخروج
                const logoutLi = navMenu.querySelector('li:last-child');
                if (logoutLi) {
                    navMenu.insertBefore(adminLi, logoutLi);
                } else {
                    navMenu.appendChild(adminLi);
                }
            }
            
            // للقائمة الجانبية في الموبايل
            const mobileMenuPanel = document.getElementById('mobile-menu-panel');
            if (mobileMenuPanel && !document.getElementById('mobile-admin-link')) {
                const adminMobileLink = document.createElement('a');
                adminMobileLink.href = '/admin';
                adminMobileLink.id = 'mobile-admin-link';
                adminMobileLink.className = 'mobile-menu-link';
                adminMobileLink.style.color = '#ff4757';
                adminMobileLink.innerHTML = '<i class="fas fa-shield-alt"></i> لوحة الإدارة';
                
                const settingsLink = mobileMenuPanel.querySelector('a[href="/settings"]');
                if (settingsLink && settingsLink.parentNode) {
                    settingsLink.parentNode.insertBefore(adminMobileLink, settingsLink.nextSibling);
                }
            }
        }
    }
    
    function updateLastActivity() {
        localStorage.setItem('lastActivity', Date.now().toString());
    }
    
    // ==================== مؤشرات الحالة ==================== 
    function showOfflineIndicator() {
        let indicator = document.getElementById('offline-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'offline-indicator';
            indicator.className = 'offline-indicator';
            indicator.innerHTML = `
                <div class="offline-content">
                    <i class="fas fa-wifi-slash" aria-hidden="true"></i>
                    <span>غير متصل</span>
                </div>
            `;
            document.body.appendChild(indicator);
        }
        
        indicator.classList.add('show');
    }
    
    function hideOfflineIndicator() {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            indicator.classList.remove('show');
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            }, 300);
        }
    }
    
    // ==================== إعادة التوجيه والرسائل ==================== 
    function redirectToLogin(message) {
        if (message) {
            localStorage.setItem('redirectMessage', message);
        }
        
        // حفظ الصفحة المطلوبة للعودة إليها بعد تسجيل الدخول
        if (protectedPages.includes(currentPath)) {
            localStorage.setItem('redirectAfterLogin', currentPath);
        }
        
        window.location.href = '/';
    }
    
    function showMessage(message, type, duration = 4000) {
        // إنشاء عنصر الرسالة
        const messageEl = document.createElement('div');
        messageEl.className = `auth-message ${type}`;
        messageEl.innerHTML = `
            <div class="auth-message-content">
                <i class="fas ${getMessageIcon(type)}" aria-hidden="true"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(messageEl);
        
        // إظهار الرسالة
        setTimeout(() => messageEl.classList.add('show'), 100);
        
        // إخفاء الرسالة
        setTimeout(() => {
            messageEl.classList.remove('show');
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, duration);
    }
    
    function getMessageIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || 'fa-info-circle';
    }
    
    // ==================== إدارة الجلسة ==================== 
    function checkSessionTimeout() {
        const lastActivity = localStorage.getItem('lastActivity');
        if (lastActivity) {
            const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
            const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 ساعة
            
            if (timeSinceLastActivity > SESSION_TIMEOUT) {
                console.log('⏰ Session expired due to inactivity');
                localStorage.removeItem('token');
                localStorage.removeItem('lastActivity');
                redirectToLogin('انتهت صلاحية الجلسة بسبب عدم النشاط');
                return false;
            }
        }
        return true;
    }
    
    // ==================== معالجة الرسائل المؤجلة ==================== 
    function handleRedirectMessages() {
        const redirectMessage = localStorage.getItem('redirectMessage');
        if (redirectMessage) {
            localStorage.removeItem('redirectMessage');
            setTimeout(() => {
                showMessage(redirectMessage, 'info');
            }, 500);
        }
    }
    
    // ==================== التنظيف عند مغادرة الصفحة ==================== 
    window.addEventListener('beforeunload', () => {
        stopPeriodicAuthCheck();
        updateLastActivity();
    });
    
    // ==================== معالجة تغيير الصفحة ==================== 
    window.addEventListener('popstate', () => {
        // إعادة فحص المصادقة عند العودة للصفحة
        setTimeout(() => {
            checkAuthStatus();
        }, 100);
    });
    
    // ==================== تشغيل الفحوصات الإضافية ==================== 
    setTimeout(() => {
        checkSessionTimeout();
        handleRedirectMessages();
    }, 500);
    
    console.log('✅ Auth checker v3.0 - Ready!');
    
})();

// ==================== أنماط CSS للمؤشرات ==================== 
const authStyles = document.createElement('style');
authStyles.textContent = `
    .offline-indicator {
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, #ff4757, #ff6b7a);
        color: white;
        padding: 10px 15px;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 600;
        z-index: 9999;
        box-shadow: 0 4px 15px rgba(255, 71, 87, 0.4);
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s ease;
    }
    
    .offline-indicator.show {
        transform: translateX(0);
        opacity: 1;
    }
    
    .offline-content {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .auth-message {
        position: fixed;
        top: 20px;
        right: 20px;
        min-width: 300px;
        max-width: 400px;
        padding: 15px;
        border-radius: 10px;
        font-weight: 500;
        z-index: 9998;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s ease;
    }
    
    .auth-message.show {
        transform: translateX(0);
        opacity: 1;
    }
    
    .auth-message.success {
        background: linear-gradient(135deg, #2ed573, #17c0eb);
        color: white;
    }
    
    .auth-message.error {
        background: linear-gradient(135deg, #ff4757, #ff6b7a);
        color: white;
    }
    
    .auth-message.warning {
        background: linear-gradient(135deg, #ffa502, #ffb632);
        color: white;
    }
    
    .auth-message.info {
        background: linear-gradient(135deg, #3742fa, #5352ed);
        color: white;
    }
    
    .auth-message-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .auth-message-content i {
        font-size: 1.2rem;
    }
    
    @media (max-width: 768px) {
        .offline-indicator,
        .auth-message {
            right: 10px;
            left: 10px;
            width: auto;
            min-width: auto;
            max-width: none;
        }
    }
`;
document.head.appendChild(authStyles);