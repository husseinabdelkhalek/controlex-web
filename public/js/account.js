document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    console.log('🚀 تهيئة صفحة الحساب...');
    
    // المتغيرات العامة
    let userData = null;

    // تهيئة الصفحة
    initializeAccountPage();

    async function initializeAccountPage() {
        try {
            await loadUserData();
            await loadUserStats();
            setupAllEventListeners();
            console.log('✅ تم تهيئة صفحة الحساب بنجاح');
        } catch (error) {
            console.error('❌ خطأ في تهيئة صفحة الحساب:', error);
            showMessage('خطأ في تحميل الصفحة', 'error');
        }
    }

    // تحميل بيانات المستخدم
    async function loadUserData() {
        try {
            const response = await fetch('/api/user/me', {
                headers: { 'x-auth-token': token }
            });

            if (!response.ok) {
                throw new Error('فشل في تحميل البيانات');
            }

            userData = await response.json();
            updateDisplayFields(userData);
        } catch (error) {
            console.error('خطأ في تحميل بيانات المستخدم:', error);
            showMessage('خطأ في تحميل بيانات الحساب', 'error');
        }
    }

    // تحديث عرض البيانات
    function updateDisplayFields(user) {
        const fields = {
            'username-display': user.username || 'غير محدد',
            'email-display': user.email || 'غير محدد',
            'adafruit-username-display': user.adafruitUsername || 'غير محدد',
            'join-date-display': user.createdAt ? new Date(user.createdAt).toLocaleDateString('ar-EG') : 'غير متوفر',
            'last-login-display': user.security?.lastLogin ? new Date(user.security.lastLogin).toLocaleDateString('ar-EG') : 'غير متوفر'
        };

        Object.entries(fields).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });

        // تحديث قسم ربط جوجل بالكامل
        const googleLinkSection = document.getElementById('google-link-section');
        const googleStatusContainer = googleLinkSection ? googleLinkSection.querySelector('.security-option-info') : null;
        const googleLinkBtn = document.getElementById('google-link-btn');

        if (googleStatusContainer && googleLinkBtn && googleLinkSection) {
            googleLinkSection.style.display = 'flex'; // التأكد من أن القسم مرئي

            const btnTextSpan = googleLinkBtn.querySelector('span') || googleLinkBtn;

            if (user.googleId) {
                // في حالة الربط
                googleStatusContainer.innerHTML = `
                    <div class="google-status" style="margin-bottom: 12px;">
                        <div class="status-card" style="
                            display: inline-flex;
                            align-items: center;
                            padding: 12px 16px;
                            border-radius: 12px;
                            background-color: rgba(46, 213, 115, 0.1);
                            border: 1px solid rgba(46, 213, 115, 0.2);
                            box-shadow: 0 2px 4px rgba(46, 213, 115, 0.1);
                        ">
                            <div class="status-icon" style="margin-left: 12px;">
                                <i class="fab fa-google" style="font-size: 1.2em; color: #2ed573;"></i>
                            </div>
                            <div class="status-details" style="display: flex; flex-direction: column;">
                                <span style="color: #2ed573; font-weight: 600; margin-bottom: 4px;">متصل بحساب Google</span>
                                <span style="color: #666; font-size: 0.9em;">${user.googleEmail || user.email}</span>
                            </div>
                        </div>
                    </div>
                `;
                googleLinkBtn.innerHTML = '<i class="fas fa-unlink"></i> إلغاء ربط حساب Google';
                googleLinkBtn.className = 'btn btn-outline-danger';
                googleLinkBtn.dataset.status = 'linked';
                googleLinkBtn.title = 'انقر لفك ربط حساب Google من هذا الحساب';
            } else {
                // في حالة عدم الربط
                googleStatusContainer.innerHTML = `
                    <div class="google-status" style="margin-bottom: 12px;">
                        <div class="status-card" style="
                            display: inline-flex;
                            align-items: center;
                            padding: 12px 16px;
                            border-radius: 12px;
                            background-color: rgba(255, 165, 2, 0.1);
                            border: 1px solid rgba(255, 165, 2, 0.2);
                            box-shadow: 0 2px 4px rgba(255, 165, 2, 0.1);
                        ">
                            <div class="status-icon" style="margin-left: 12px;">
                                <i class="fab fa-google" style="font-size: 1.2em; color: #ffa502;"></i>
                            </div>
                            <div class="status-details" style="display: flex; flex-direction: column;">
                                <span style="color: #ffa502; font-weight: 600; margin-bottom: 4px;">غير متصل بحساب Google</span>
                                <span style="color: #666; font-size: 0.9em;">اربط حسابك للوصول السريع</span>
                            </div>
                        </div>
                    </div>
                `;
                googleLinkBtn.innerHTML = '<i class="fab fa-google"></i> ربط حساب Google';
                googleLinkBtn.className = 'btn btn-primary';
                googleLinkBtn.dataset.status = 'unlinked';
                googleLinkBtn.title = 'انقر لربط حساب Google مع هذا الحساب';
            }

            // إضافة الرسائل المخزنة إذا وجدت
            const storedMessage = localStorage.getItem('google_link_message');
            const storedMessageType = localStorage.getItem('google_link_message_type');
            if (storedMessage) {
                const messageDiv = document.createElement('div');
                messageDiv.className = `alert alert-${storedMessageType || 'info'}`;
                messageDiv.style.marginTop = '10px';
                messageDiv.textContent = storedMessage;
                googleStatusContainer.appendChild(messageDiv);
                
                // حذف الرسائل المخزنة بعد عرضها
                localStorage.removeItem('google_link_message');
                localStorage.removeItem('google_link_message_type');
            }
        }
        // ==================== Performance Utilities ====================

// Debounce للـ clicks المتكررة
function debounceClick(func, delay = 300) {
    let timeout;
    let isRunning = false;
    
    return async function(...args) {
        if (isRunning) {
            console.log('⚠️ Already processing, please wait...');
            return;
        }
        
        clearTimeout(timeout);
        timeout = setTimeout(async () => {
            isRunning = true;
            try {
                await func.apply(this, args);
            } finally {
                isRunning = false;
            }
        }, delay);
    };
}

// Throttle للـ inputs
function throttle(func, limit = 300) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Cache للـ DOM elements
const DOMCache = new Map();

function getCachedElement(selector, useQuerySelector = false) {
    if (!DOMCache.has(selector)) {
        const element = useQuerySelector 
            ? document.querySelector(selector) 
            : document.getElementById(selector);
        DOMCache.set(selector, element);
    }
    return DOMCache.get(selector);
}

// مسح الـ cache لما الصفحة تتحدث
window.addEventListener('beforeunload', () => DOMCache.clear());

        // تحديث زر المصادقة الثنائية
        const twoFaBtn = document.getElementById('enable-2fa-btn');
        if(twoFaBtn) {
            // الخادم يرسل الحالة تحت user.security.twoFactorEnabled
            const is2faEnabled = user.security?.twoFactorEnabled || false;
            twoFaBtn.textContent = is2faEnabled ? 'إلغاء تفعيل المصادقة' : 'تفعيل المصادقة';
            twoFaBtn.dataset.status = is2faEnabled ? 'on' : 'off';
            
            // تحديث شكل الزر
            if (is2faEnabled) {
                twoFaBtn.style.background = '#10b981';
                twoFaBtn.classList.remove('btn-primary');
                twoFaBtn.classList.add('btn-success');
            } else {
                twoFaBtn.style.background = '';
                twoFaBtn.classList.remove('btn-success');
                twoFaBtn.classList.add('btn-primary');
            }
            twoFaBtn.disabled = false;
        }
    }

    // تحميل الإحصائيات
    async function loadUserStats() {
        try {
            const response = await fetch('/api/user/stats', {
                headers: { 'x-auth-token': token }
            });

            if (response.ok) {
                const stats = await response.json();
                updateStatsDisplay(stats);
            }
        } catch (error) {
            console.error('خطأ في تحميل الإحصائيات:', error);
        }
    }

    function updateStatsDisplay(stats) {
        const elements = {
            'total-widgets': stats.totalWidgets || 0,
            'total-commands': stats.totalCommands || 0,
            'active-days': stats.activeDays || 0,
            'success-rate': (stats.successRate || 100) + '%'
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                if (typeof value === 'number') {
                    animateNumber(element, 0, value);
                } else {
                    element.textContent = value;
                }
            }
        });
    }

    function animateNumber(element, start, end) {
        const duration = 1000;
        const startTime = performance.now();
        
        function updateNumber(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = Math.floor(start + (end - start) * progress);
            element.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            }
        }
        
        requestAnimationFrame(updateNumber);
    }

    // إعداد جميع مستمعي الأحداث
    function setupAllEventListeners() {
        // زر تسجيل الخروج
        setupButton('logout-btn', handleLogout);
        
        // زر تفعيل المصادقة الثنائية
        setupButton('enable-2fa-btn', handleToggle2FA);
        
        // زر عرض الجلسات النشطة
        setupButton('view-sessions-btn', handleViewSessions);
        
        // زر تصدير البيانات
        setupButton('export-data-btn', handleExportData);
        
        // زر استيراد البيانات
        setupButton('import-data-btn', handleImportData);
        
        // زر حفظ إعدادات الخصوصية
        setupButton('save-privacy-btn', handleSavePrivacySettings);
        
        // زر حذف الحساب
        setupButton('delete-account-btn', handleDeleteAccount);
        
        // نموذج تحديث الحساب
        const accountForm = document.getElementById('account-form');
        if (accountForm) {
            accountForm.addEventListener('submit', handleAccountUpdate);
        }

        // نموذج إعدادات Adafruit
        const adafruitForm = document.getElementById('adafruit-form');
        if (adafruitForm) {
            adafruitForm.addEventListener('submit', handleAdafruitUpdate);
        }

        // زر ربط حساب Google
        setupButton('google-link-btn', handleGoogleAccountLink);

        // إنشاء الأزرار المفقودة
        createMissingButtons();

        console.log('✅ تم ربط جميع أزرار صفحة الحساب');
    }

    function setupButton(buttonId, handler) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', handler);
            console.log(`✅ تم ربط زر: ${buttonId}`);
        } else {
            console.warn(`⚠️ زر غير موجود: ${buttonId}`);
        }
    }

    // إنشاء الأزرار المفقودة
    function createMissingButtons() {
        // زر تسجيل الخروج
        if (!document.getElementById('logout-btn')) {
            createLogoutButton();
        }

        // زر تفعيل المصادقة الثنائية
        if (!document.getElementById('enable-2fa-btn')) {
            createEnable2FAButton();
        }

        // زر عرض الجلسات
        if (!document.getElementById('view-sessions-btn')) {
            createViewSessionsButton();
        }

        // أزرار تصدير/استيراد البيانات
        if (!document.getElementById('export-data-btn')) {
            createDataButtons();
        }

        // // زر حفظ إعدادات الخصوصية
        // if (!document.getElementById('save-privacy-btn')) {
        //     createSavePrivacyButton();
        // }

        // // زر ربط حساب Google
        // if (!document.getElementById('google-account-link-btn')) {
        //     createGoogleAccountLinkButton();
        // }
    }
function createLogoutButton() {
    // التحقق من وجود الزر في شريط التنقل أولاً
    const existingNavLogout = document.querySelector('.nav-link.logout-btn');
    if (existingNavLogout) {
        console.log('زر تسجيل الخروج موجود في شريط التنقل');
        return;
    }
    
    // البحث عن شريط التنقل لإضافة الزر
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
        // إنشاء عنصر li للقائمة
        const logoutItem = document.createElement('li');
        logoutItem.className = 'nav-item';
        
        // إنشاء زر تسجيل الخروج
        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'logout-btn';
        logoutBtn.className = 'nav-link logout-btn';
        logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt" aria-hidden="true"></i><span>تسجيل الخروج</span>';
        logoutBtn.setAttribute('aria-label', 'تسجيل الخروج');
        
        // تطبيق التصميم المتطور
        logoutBtn.style.cssText = `
            background: linear-gradient(135deg, var(--primary-violet), var(--primary-cyan)) !important;
            color: white !important;
            border: none !important;
            border-radius: var(--radius-md) !important;
            padding: 10px 20px !important;
            font-weight: 600 !important;
            font-size: 1rem !important;
            box-shadow: 0 4px 15px rgba(138, 43, 226, 0.2) !important;
            transition: all 0.3s ease !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 8px !important;
            cursor: pointer !important;
            position: relative !important;
            overflow: hidden !important;
        `;
        
        // تأثير التفاعل
        logoutBtn.addEventListener('mouseenter', function() {
            this.style.background = 'linear-gradient(135deg, var(--primary-cyan), var(--primary-violet)) !important';
            this.style.transform = 'translateY(-2px) !important';
            this.style.boxShadow = '0 6px 20px rgba(138, 43, 226, 0.4) !important';
        });
        
        logoutBtn.addEventListener('mouseleave', function() {
            this.style.background = 'linear-gradient(135deg, var(--primary-violet), var(--primary-cyan)) !important';
            this.style.transform = 'translateY(0) !important';
            this.style.boxShadow = '0 4px 15px rgba(138, 43, 226, 0.2) !important';
        });
        
        // إضافة وظيفة تسجيل الخروج
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof handleLogout === 'function') {
                handleLogout();
            } else if (typeof logout === 'function') {
                logout();
            } else {
                // وظيفة تسجيل خروج افتراضية
                if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
                    localStorage.removeItem('token');
                    window.location.href = '/';
                }
            }
        });
        
        // إضافة الزر للقائمة
        logoutItem.appendChild(logoutBtn);
        navMenu.appendChild(logoutItem);
        
        console.log('✅ تم إضافة زر تسجيل الخروج لشريط التنقل');
        
    } else {
        // إذا لم يجد شريط التنقل، ينشئ زر في الزاوية العلوية اليسرى بتصميم أنيق
        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'logout-btn-fallback';
        logoutBtn.className = 'logout-btn-fallback';
        logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
        logoutBtn.setAttribute('aria-label', 'تسجيل الخروج');
        logoutBtn.setAttribute('title', 'تسجيل الخروج');
        
        logoutBtn.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            left: 20px !important;
            z-index: 1000 !important;
            width: 50px !important;
            height: 50px !important;
            border-radius: 50% !important;
            background: linear-gradient(135deg, var(--primary-violet), var(--primary-cyan)) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            border: 1px solid rgba(138, 43, 226, 0.3) !important;
            color: white !important;
            cursor: pointer !important;
            font-size: 1.2rem !important;
            box-shadow: 0 8px 25px rgba(138, 43, 226, 0.3) !important;
            transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
        `;
        
        // تأثير التفاعل
        logoutBtn.addEventListener('mouseenter', function() {
            this.style.background = 'linear-gradient(135deg, var(--primary-cyan), var(--primary-violet)) !important';
            this.style.transform = 'scale(1.1) !important';
            this.style.boxShadow = '0 12px 35px rgba(138, 43, 226, 0.5) !important';
        });
        
        logoutBtn.addEventListener('mouseleave', function() {
            this.style.background = 'linear-gradient(135deg, var(--primary-violet), var(--primary-cyan)) !important';
            this.style.transform = 'scale(1) !important';
            this.style.boxShadow = '0 8px 25px rgba(138, 43, 226, 0.3) !important';
        });
        
        // إضافة وظيفة تسجيل الخروج
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof handleLogout === 'function') {
                handleLogout();
            } else if (typeof logout === 'function') {
                logout();
            } else {
                if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
                    localStorage.removeItem('token');
                    window.location.href = '/';
                }
            }
        });
        
        document.body.appendChild(logoutBtn);
        console.log('✅ تم إنشاء زر تسجيل الخروج البديل');
    }
}

    function createEnable2FAButton() {
        // البحث عن القسم المناسب
        const securitySection = document.querySelector('.security-section') || 
                               document.querySelector('[data-section="security"]') ||
                               document.body;

        const button = document.createElement('button');
        button.id = 'enable-2fa-btn';
        button.className = 'btn btn-primary';
        button.innerHTML = 'تفعيل';
        button.addEventListener('click', handleToggle2FA);
        
        securitySection.appendChild(button);
        console.log('✅ تم إنشاء زر المصادقة الثنائية');
    }

    function createViewSessionsButton() {
        const sessionsSection = document.querySelector('.sessions-section') ||
                               document.querySelector('[data-section="sessions"]') ||
                               document.body;

        const button = document.createElement('button');
        button.id = 'view-sessions-btn';
        button.className = 'btn btn-info';
        button.innerHTML = 'عرض';
        button.addEventListener('click', handleViewSessions);
        
        sessionsSection.appendChild(button);
        console.log('✅ تم إنشاء زر عرض الجلسات');
    }

    function createDataButtons() {
        const dataSection = document.querySelector('.data-section') ||
                           document.querySelector('[data-section="data"]') ||
                           document.body;

        // زر التصدير
        const exportBtn = document.createElement('button');
        exportBtn.id = 'export-data-btn';
        exportBtn.className = 'btn btn-success';
        exportBtn.innerHTML = '<i class="fas fa-download"></i> تصدير البيانات';
        exportBtn.addEventListener('click', handleExportData);

        // زر الاستيراد
        const importBtn = document.createElement('button');
        importBtn.id = 'import-data-btn';
        importBtn.className = 'btn btn-warning';
        importBtn.innerHTML = '<i class="fas fa-upload"></i> استيراد البيانات';
        importBtn.addEventListener('click', handleImportData);

        dataSection.appendChild(exportBtn);
        dataSection.appendChild(importBtn);
        console.log('✅ تم إنشاء أزرار البيانات');
    }

    function createSavePrivacyButton() {
        const privacySection = document.querySelector('.privacy-section') ||
                              document.querySelector('[data-section="privacy"]') ||
                              document.body;

        const button = document.createElement('button');
        button.id = 'save-privacy-btn';
        button.className = 'btn btn-primary';
        button.innerHTML = 'حفظ إعدادات الخصوصية';
        button.addEventListener('click', handleSavePrivacySettings);
        
        privacySection.appendChild(button);
        console.log('✅ تم إنشاء زر حفظ الخصوصية');
    }

    // إنشاء زر ربط حساب Google
    function createGoogleAccountLinkButton() {
        const securitySection = document.querySelector('.security-section') ||
                              document.querySelector('[data-section="security"]') ||
                              document.body;

        const googleAccount = userData?.googleId ? 'linked' : 'not-linked';
        
        const button = document.createElement('button');
        button.id = 'google-account-link-btn';
        button.className = `btn ${googleAccount === 'linked' ? 'btn-danger' : 'btn-primary'}`;
        button.innerHTML = `<i class="fab fa-google"></i> ${googleAccount === 'linked' ? 'فك ربط حساب Google' : 'ربط حساب Google بهذا الحساب'}`;
        button.dataset.status = googleAccount;
        
        if (googleAccount === 'linked') {
            button.classList.add('google-linked');
            button.title = 'انقر لفك ربط حساب Google من هذا الحساب';
        } else {
            button.classList.add('google-not-linked');
            button.title = 'انقر لربط حساب Google بهذا الحساب';
        }

        button.addEventListener('click', handleGoogleAccountLink);
        
        // إضافة عنصر div للحالة مع معلومات إضافية
        const statusDiv = document.createElement('div');
        statusDiv.id = 'google-link-status';
        statusDiv.className = 'account-status';

        const statusText = googleAccount === 'linked' 
            ? `<i class="fas fa-check-circle text-success"></i> متصل بحساب Google${userData?.googleEmail ? ` (${userData.googleEmail})` : ''}`
            : '<i class="fas fa-exclamation-circle text-warning"></i> غير متصل بحساب Google';

        statusDiv.innerHTML = `
            <div class="status-header">حالة حساب Google</div>
            <div class="status-content">
                <span class="status-text ${googleAccount === 'linked' ? 'text-success' : 'text-warning'}">${statusText}</span>
            </div>
            ${googleAccount === 'linked' ? '<div class="status-help">يمكنك فك ربط حساب Google في أي وقت</div>' : '<div class="status-help">يمكنك ربط حسابك بحساب Google لتسجيل الدخول بسهولة</div>'}
        `;
        
        const container = document.createElement('div');
        container.className = 'google-account-container';
        container.style.cssText = `
            background: ${googleAccount === 'linked' ? '#f0fdf4' : '#fff7ed'};
            border: 1px solid ${googleAccount === 'linked' ? '#86efac' : '#fed7aa'};
            border-radius: 8px;
            padding: 20px;
            margin: 15px 0;
        `;
        container.appendChild(statusDiv);
        container.appendChild(button);
        
        securitySection.appendChild(container);
        console.log('✅ تم إنشاء زر ربط حساب Google');
    }

    // === معالجات الأحداث ===
    
    // ربط/فك ربط حساب Google
    async function handleGoogleAccountLink() {
        const btn = document.getElementById('google-link-btn');
        if (!btn) return;

        const currentStatus = btn.dataset.status;
        const token = localStorage.getItem('token');
        
        if (!token) {
            showMessage('لا يمكن إتمام العملية، يرجى تسجيل الدخول مرة أخرى.', 'error');
            setTimeout(() => window.location.href = '/', 2000);
            return;
        }

        if (currentStatus === 'unlinked') {
            try {
                // إنشاء وعرض نافذة التأكيد المخصصة
                const modalHTML = `
                    <div class="modal-content" style="background: white; padding: 25px; border-radius: 15px; max-width: 500px; width: 90%; text-align: center;">
                        <div style="font-size: 3em; color: #4285f4; margin-bottom: 20px;">
                            <i class="fab fa-google"></i>
                        </div>
                        <h3 style="margin-bottom: 15px; color: #333;">ربط حساب Google</h3>
                        <p style="color: #666; margin-bottom: 20px;">
                            سيتم توجيهك إلى صفحة تسجيل الدخول في Google لربط حسابك.
                            هل تريد المتابعة؟
                        </p>
                        <div style="display: flex; gap: 10px; justify-content: center;">
                            <button id="confirm-link" class="btn btn-primary" style="min-width: 120px;">
                                <i class="fab fa-google"></i> متابعة
                            </button>
                            <button id="cancel-link" class="btn btn-secondary" style="min-width: 120px;">
                                إلغاء
                            </button>
                        </div>
                    </div>
                `;

                const modalWrapper = document.createElement('div');
                modalWrapper.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                `;
                modalWrapper.innerHTML = modalHTML;
                document.body.appendChild(modalWrapper);
                
                // تحريك المودال
                setTimeout(() => modalWrapper.style.opacity = '1', 50);

                // معالجة الأحداث
                return new Promise((resolve, reject) => {
                    modalWrapper.querySelector('#confirm-link').onclick = () => {
                        modalWrapper.style.opacity = '0';
                        setTimeout(() => {
                            modalWrapper.remove();
                            // تخزين رسالة "جاري الربط" قبل إعادة التوجيه
                            localStorage.setItem('google_link_message', 'جاري ربط حساب Google...');
                            localStorage.setItem('google_link_message_type', 'info');
                            window.location.href = `/auth/google/link?token=${token}&redirect=${encodeURIComponent(window.location.href)}`;
                        }, 300);
                    };

                    modalWrapper.querySelector('#cancel-link').onclick = () => {
                        modalWrapper.style.opacity = '0';
                        setTimeout(() => {
                            modalWrapper.remove();
                            showMessage('تم إلغاء عملية ربط الحساب.', 'info');
                        }, 300);
                    };

                    modalWrapper.onclick = (e) => {
                        if (e.target === modalWrapper) {
                            modalWrapper.style.opacity = '0';
                            setTimeout(() => {
                                modalWrapper.remove();
                                showMessage('تم إلغاء عملية ربط الحساب.', 'info');
                            }, 300);
                        }
                    };
                });
            } catch (error) {
                showMessage(error.message || 'حدث خطأ أثناء محاولة ربط الحساب.', 'error');
                console.error('خطأ في ربط حساب Google:', error);
            }
        } else if (currentStatus === 'linked') {
            try {
                // إنشاء وعرض نافذة التأكيد المخصصة لفك الربط
                const modalHTML = `
                    <div class="modal-content" style="background: white; padding: 25px; border-radius: 15px; max-width: 500px; width: 90%;">
                        <div style="text-align: center;">
                            <div style="font-size: 3em; color: #dc3545; margin-bottom: 20px;">
                                <i class="fas fa-unlink"></i>
                            </div>
                            <h3 style="margin-bottom: 15px; color: #333;">تأكيد فك ربط حساب Google</h3>
                            <p style="color: #666; margin-bottom: 20px;">
                                هل أنت متأكد من رغبتك في فك ربط حساب Google؟
                                سيتوجب عليك إدخال كلمة المرور للتأكيد.
                            </p>
                        </div>
                        <div style="margin-bottom: 20px;">
                            <input type="password" id="unlink-password" 
                                   placeholder="كلمة المرور الحالية"
                                   class="form-control"
                                   style="direction: ltr; padding: 10px; width: 100%; margin-bottom: 10px;">
                            <small class="text-danger" id="password-error" style="display: none;"></small>
                        </div>
                        <div style="display: flex; gap: 10px; justify-content: center;">
                            <button id="confirm-unlink" class="btn btn-danger" style="min-width: 120px;">
                                <i class="fas fa-unlink"></i> فك الربط
                            </button>
                            <button id="cancel-unlink" class="btn btn-secondary" style="min-width: 120px;">
                                إلغاء
                            </button>
                        </div>
                    </div>
                `;

                const modalWrapper = document.createElement('div');
                modalWrapper.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                `;
                modalWrapper.innerHTML = modalHTML;
                document.body.appendChild(modalWrapper);
                
                // تحريك المودال
                setTimeout(() => modalWrapper.style.opacity = '1', 50);
                
                // تركيز حقل كلمة المرور
                modalWrapper.querySelector('#unlink-password').focus();

                // معالجة الأحداث
                modalWrapper.querySelector('#confirm-unlink').onclick = async () => {
                    const passwordInput = modalWrapper.querySelector('#unlink-password');
                    const errorElement = modalWrapper.querySelector('#password-error');
                    const password = passwordInput.value.trim();

                    if (!password) {
                        errorElement.textContent = 'يرجى إدخال كلمة المرور';
                        errorElement.style.display = 'block';
                        passwordInput.focus();
                        return;
                    }

                    try {
                        setButtonLoading('google-link-btn', true, 'جاري فك الربط...');
                        modalWrapper.style.pointerEvents = 'none';
                        modalWrapper.style.opacity = '0.7';

                            const response = await fetch('/api/user/unlink-google', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-auth-token': token
                            },
                            body: JSON.stringify({ password })
                        });

                        const data = await response.json();
                        
                        if (!response.ok) {
                            // تحسين معالجة الأخطاء المختلفة
                            let errorMessage = 'حدث خطأ غير متوقع';
                            if (data.code === 'INVALID_PASSWORD') {
                                errorMessage = 'كلمة المرور غير صحيحة';
                            } else if (data.code === 'NO_GOOGLE_ACCOUNT') {
                                errorMessage = 'لا يوجد حساب Google مرتبط';
                            } else if (data.message) {
                                errorMessage = data.message;
                            }
                            throw new Error(errorMessage);
                        }

                        modalWrapper.style.opacity = '0';
                        setTimeout(() => {
                            modalWrapper.remove();
                            showMessage('تم فك ربط حساب Google بنجاح.', 'success');
                            loadUserData(); // تحديث واجهة المستخدم
                        }, 300);                    } catch (error) {
                        errorElement.textContent = error.message;
                        errorElement.style.display = 'block';
                        modalWrapper.style.pointerEvents = 'auto';
                        modalWrapper.style.opacity = '1';
                        passwordInput.focus();
                    } finally {
                        setButtonLoading('google-link-btn', false);
                    }
                };

                modalWrapper.querySelector('#cancel-unlink').onclick = () => {
                    modalWrapper.style.opacity = '0';
                    setTimeout(() => {
                        modalWrapper.remove();
                        showMessage('تم إلغاء عملية فك الربط.', 'info');
                    }, 300);
                };

                modalWrapper.onclick = (e) => {
                    if (e.target === modalWrapper) {
                        modalWrapper.style.opacity = '0';
                        setTimeout(() => {
                            modalWrapper.remove();
                            showMessage('تم إلغاء عملية فك الربط.', 'info');
                        }, 300);
                    }
                };

                // معالجة ضغط Enter في حقل كلمة المرور
                modalWrapper.querySelector('#unlink-password').onkeyup = (e) => {
                    if (e.key === 'Enter') {
                        modalWrapper.querySelector('#confirm-unlink').click();
                    }
                };

            } catch (error) {
                showMessage(error.message || 'حدث خطأ أثناء محاولة فك ربط الحساب.', 'error');
                console.error('خطأ في فك ربط حساب Google:', error);
            }
        }
    }

    // تسجيل الخروج
    async function handleLogout() {
        if (!confirm('هل تريد تسجيل الخروج؟')) return;

        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'x-auth-token': token }
            });
        } catch (error) {
            console.warn('خطأ في إشعار الخادم بتسجيل الخروج:', error);
        }

        localStorage.removeItem('token');
        window.location.href = '/';
    }

    // تفعيل/تعطيل المصادقة الثنائية
    async function handleToggle2FA() {
        const btn = document.getElementById('enable-2fa-btn');
        if (!btn) return;

        const currentStatus = btn.dataset.status === 'on';
        const action = currentStatus ? 'disable' : 'enable';

        if (!confirm(`هل أنت متأكد من ${currentStatus ? 'إلغاء تفعيل' : 'تفعيل'} المصادقة الثنائية؟`)) return;

        setButtonLoading('enable-2fa-btn', true);
        try {
            const response = await fetch(`/api/user/${action}-2fa`, {
                method: 'POST',
                headers: { 'x-auth-token': token }
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.msg || 'فشل الإجراء');

            showMessage(data.msg, 'success');
            await loadUserData(); // السطر الأهم: إعادة تحميل البيانات لتحديث الواجهة فوراً

        } catch (error) {
            showMessage(error.message, 'error');
        } finally {
            // لا حاجة لتمرير النص هنا، سيتم تحديثه بواسطة loadUserData
            setButtonLoading('enable-2fa-btn', false); 
        }
    }

    // عرض الجلسات النشطة
    async function handleViewSessions() {
        try {
            setButtonLoading('view-sessions-btn', true, 'جاري التحميل...');
            
            const response = await fetch('/api/user/sessions', {
                headers: { 'x-auth-token': token }
            });

            if (response.ok) {
                const sessions = await response.json();
                showSessionsModal(sessions);
            } else {
                throw new Error('فشل في تحميل الجلسات');
            }
        } catch (error) {
            console.error('خطأ في تحميل الجلسات:', error);
            showMessage('خطأ في تحميل الجلسات النشطة', 'error');
        } finally {
            setButtonLoading('view-sessions-btn', false);
        }
    }

    // تصدير البيانات
    async function handleExportData() {
        try {
            setButtonLoading('export-data-btn', true, 'جاري التصدير...');
            
            const response = await fetch('/api/user/export', {
                headers: { 'x-auth-token': token }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `dashboard-backup-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                
                showMessage('تم تصدير البيانات بنجاح!', 'success');
            } else {
                throw new Error('فشل في تصدير البيانات');
            }
        } catch (error) {
            console.error('خطأ في تصدير البيانات:', error);
            showMessage('خطأ في تصدير البيانات', 'error');
        } finally {
            setButtonLoading('export-data-btn', false);
        }
    }

    // استيراد البيانات
    function handleImportData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                setButtonLoading('import-data-btn', true, 'جاري الاستيراد...');
                
                const text = await file.text();
                const data = JSON.parse(text);
                
                const response = await fetch('/api/user/import', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': token
                    },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    showMessage('تم استيراد البيانات بنجاح!', 'success');
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    throw new Error('فشل في استيراد البيانات');
                }
            } catch (error) {
                console.error('خطأ في استيراد البيانات:', error);
                showMessage('خطأ في استيراد البيانات: ' + error.message, 'error');
            } finally {
                setButtonLoading('import-data-btn', false);
            }
        };
        
        input.click();
    }

    // حفظ إعدادات الخصوصية
    async function handleSavePrivacySettings() {
        try {
            setButtonLoading('save-privacy-btn', true, 'جاري الحفظ...');

            const privacySettings = {
                allowDataCollection: document.getElementById('allow-data-collection')?.checked || false,
                emailNotifications: document.getElementById('email-notifications')?.checked || true,
                securityAlerts: document.getElementById('security-alerts')?.checked || true
            };

            // إرسال الطلب إلى المسار الصحيح
            const response = await fetch('/api/user/preferences', { // المسار الصحيح
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                },
                body: JSON.stringify({ privacy: privacySettings })
            });

            if (response.ok) {
                showMessage('تم حفظ إعدادات الخصوصية بنجاح!', 'success');
                // السطر الأهم: إعادة تحميل البيانات لتحديث الواجهة فوراً
                await loadUserData();
            } else {
                // الآن سيتمكن من قراءة رسالة الخطأ بصيغة JSON بدلاً من HTML
                const errorData = await response.json();
                throw new Error(errorData.msg || 'فشل في حفظ الإعدادات');
            }
        } catch (error) {
            console.error('خطأ في حفظ إعدادات الخصوصية:', error);
            showMessage('خطأ في حفظ الإعدادات: ' + error.message, 'error');
        } finally {
            setButtonLoading('save-privacy-btn', false, 'حفظ إعدادات الخصوصية');
        }
    }

    // تحديث الحساب
    async function handleAccountUpdate(e) {
        e.preventDefault();
        
        try {
            setButtonLoading('update-account-btn', true, 'جاري التحديث...');
            
            const formData = new FormData(e.target);
            const updateData = {
                username: formData.get('username'),
                email: formData.get('email')
            };

            const response = await fetch('/api/user/update', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                },
                body: JSON.stringify(updateData)
            });

            if (response.ok) {
                showMessage('تم تحديث الحساب بنجاح!', 'success');
                await loadUserData();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.msg || 'فشل في تحديث الحساب');
            }
        } catch (error) {
            console.error('خطأ في تحديث الحساب:', error);
            showMessage(error.message, 'error');
        } finally {
            setButtonLoading('update-account-btn', false);
        }
    }

    // تحديث إعدادات Adafruit
    async function handleAdafruitUpdate(e) {
        e.preventDefault();
        
        try {
            const formData = new FormData(e.target);
            const adafruitData = {
                adafruitUsername: formData.get('adafruit-username'),
                adafruitApiKey: formData.get('adafruit-key')
            };

            const response = await fetch('/api/user/update', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                },
                body: JSON.stringify(adafruitData)
            });

            if (response.ok) {
                showMessage('تم حفظ إعدادات Adafruit بنجاح!', 'success');
                await loadUserData();
            } else {
                throw new Error('فشل في الحفظ');
            }
        } catch (error) {
            showMessage('خطأ في حفظ إعدادات Adafruit', 'error');
        }
    }

    // حذف الحساب
   async function handleDeleteAccount() {
    // 1. التأكيد الأولي عبر نافذة المتصفح المنبثقة
    const confirmation = confirm('هل أنت متأكد تماماً من حذف حسابك نهائياً؟ هذا الإجراء لا يمكن التراجع عنه!');
    if (!confirmation) {
        // إذا ضغط المستخدم على "إلغاء"، أوقف العملية
        showMessage('تم إلغاء عملية الحذف.', 'info');
        return;
    }

    // 2. التأكيد النصي لضمان عدم الحذف العرضي
    const finalConfirmation = prompt('للتأكيد، اكتب "حذف حسابي" في المربع أدناه:');

    // تحقق من النص المدخل: تأكد أنه ليس فارغًا وبعد إزالة المسافات، يتطابق مع "حذف حسابي" (مع تجاهل حالة الأحرف)
    if (!finalConfirmation || finalConfirmation.trim().toLowerCase() !== 'حذف حسابي'.toLowerCase()) {
        showMessage('النص المدخل غير صحيح. تم إلغاء عملية الحذف.', 'info');
        return;
    }

    // 3. الحصول على رمز المصادقة (Token)
    const token = localStorage.getItem('token');
    if (!token) {
        showMessage('لا يوجد رمز مصادقة. يرجى تسجيل الدخول أولاً.', 'error');
        // قد تحتاج لإعادة توجيه المستخدم لصفحة تسجيل الدخول هنا
        window.location.href = '/'; 
        return;
    }

    try {
        // 4. إرسال طلب الحذف إلى الخادم
        // المسار هنا يجب أن يتطابق مع المسار في server.js
        const response = await fetch('/api/user/delete-account', { // <--- تم التصحيح هنا
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token // تأكد أن الخادم يتوقع 'x-auth-token' أو غيّرها لـ 'Authorization': `Bearer ${token}`
            }
            // لا حاجة لإرسال body في طلب DELETE هذا، حيث أن المعرف يتم استخلاصه من الـ token في الخادم
        });

        // 5. معالجة استجابة الخادم
        if (response.ok) {
            localStorage.removeItem('token'); // حذف التوكن من التخزين المحلي
            alert('تم حذف حسابك بنجاح. سيتم توجيهك إلى الصفحة الرئيسية.');
            window.location.href = '/'; // إعادة التوجيه لصفحة تسجيل الدخول/الرئيسية
        } else {
            // إذا كانت الاستجابة غير OK (مثل 401, 404, 500)
            const errorData = await response.json(); // محاولة قراءة رسالة الخطأ من الخادم
            throw new Error(errorData.msg || 'فشل غير معروف في حذف الحساب');
        }
    } catch (error) {
        // 6. التعامل مع الأخطاء التي تحدث أثناء الاتصال بالشبكة أو من الخادم
        console.error('خطأ في حذف الحساب:', error);
        showMessage(`حدث خطأ: ${error.message || 'فشل في حذف الحساب.'}`, 'error');
    }
}
    // === إعداد زر تغيير الوضع ===


    // وظيفة عامة لإنهاء الجلسة
    window.terminateSession = async function(sessionId) {
        try {
            const response = await fetch(`/api/user/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: { 'x-auth-token': token }
            });

            if (response.ok) {
                showMessage('تم إنهاء الجلسة بنجاح', 'success');
                document.querySelector('.sessions-modal')?.remove();
                handleViewSessions(); // إعادة تحميل قائمة الجلسات
            } else {
                throw new Error('فشل في إنهاء الجلسة');
            }
        } catch (error) {
            showMessage('خطأ في إنهاء الجلسة', 'error');
        }
    };

    // === وظائف مساعدة ===

    function setButtonLoading(buttonId, loading, text = '') {
        const btn = document.getElementById(buttonId);
        if (!btn) return;

        if (loading) {
            // حفظ النص الأصلي إذا لم يكن محفوظاً من قبل
            if (!btn.dataset.originalText) {
                btn.dataset.originalText = btn.innerHTML;
            }

            // حفظ الأيقونة الأصلية إذا كانت موجودة
            const originalIcon = btn.querySelector('i.fab, i.fas');
            if (originalIcon) {
                btn.dataset.originalIcon = originalIcon.className;
            }

            btn.disabled = true;
            btn.style.opacity = '0.7';
            btn.style.cursor = 'wait';

            // إضافة فئة CSS للتحميل
            btn.classList.add('btn-loading');

            // تغيير المحتوى مع الحفاظ على التنسيق
            const loadingSpinner = '<i class="fas fa-spinner fa-spin"></i>';
            btn.innerHTML = text ? `${loadingSpinner} ${text}` : loadingSpinner;

            // إضافة مؤثر بصري (نبض)
            btn.style.animation = 'button-pulse 1.5s infinite';
        } else {
            // إزالة كل التنسيقات والفئات المضافة
            btn.disabled = false;
            btn.style.opacity = '';
            btn.style.cursor = '';
            btn.classList.remove('btn-loading');
            btn.style.animation = '';

            // استعادة المحتوى الأصلي
            if (btn.dataset.originalText) {
                btn.innerHTML = btn.dataset.originalText;
                delete btn.dataset.originalText;
            }

            // استعادة الأيقونة الأصلية إذا كانت موجودة
            if (btn.dataset.originalIcon) {
                const icon = btn.querySelector('i');
                if (icon) {
                    icon.className = btn.dataset.originalIcon;
                }
                delete btn.dataset.originalIcon;
            }
        }
    }

    function showMessage(message, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `account-message alert-${type}`;
        messageDiv.innerHTML = `
            <i class="fas fa-${getIconForType(type)}"></i>
            <span>${message}</span>
        `;
        messageDiv.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 1001;
            background: ${getColorForType(type)};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 300px;
            display: flex;
            align-items: center;
            gap: 10px;
        `;

        document.body.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.style.transform = 'translateX(0)';
        }, 100);

        setTimeout(() => {
            messageDiv.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 300);
        }, 4000);
    }

    function getIconForType(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    function getColorForType(type) {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        return colors[type] || '#3b82f6';
    }

    function showSessionsModal(sessions) {
        const modal = document.createElement('div');
        modal.className = 'sessions-modal';
        modal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                padding: 30px;
                border-radius: 12px;
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                position: relative;
            ">
                <div class="modal-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid #eee;
                ">
                    <h3 style="margin: 0; color: #333;">الجلسات النشطة</h3>
                    <button class="close-modal" style="
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #999;
                    ">&times;</button>
                </div>
                <div class="modal-body">
                    ${sessions.length > 0 ? 
                        sessions.map(session => `
                            <div class="session-item" style="
                                padding: 15px;
                                border: 1px solid #eee;
                                border-radius: 8px;
                                margin-bottom: 15px;
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                            ">
                                <div class="session-info">
                                    <p style="margin: 5px 0; color: #333;"><strong>الجهاز:</strong> ${session.deviceInfo?.browser || 'غير معروف'}</p>
                                    <p style="margin: 5px 0; color: #666;"><strong>آخر نشاط:</strong> ${new Date(session.lastActivity).toLocaleString('ar-EG')}</p>
                                    <p style="margin: 5px 0; color: #666;"><strong>IP:</strong> ${session.deviceInfo?.ip || 'غير معروف'}</p>
                                </div>
                                ${!session.isCurrent ? 
                                    `<button class="btn btn-danger" onclick="terminateSession('${session.id}')" style="
                                        background: #ef4444;
                                        color: white;
                                        border: none;
                                        padding: 8px 16px;
                                        border-radius: 6px;
                                        cursor: pointer;
                                    ">إنهاء</button>` 
                                    : '<span style="color: #10b981; font-weight: 600;">الجلسة الحالية</span>'
                                }
                            </div>
                        `).join('') 
                        : '<p style="text-align: center; color: #666;">لا توجد جلسات نشطة</p>'
                    }
                </div>
            </div>
        `;

        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
        `;

        document.body.appendChild(modal);

        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // وظيفة عامة لإنهاء الجلسة
    window.terminateSession = async function(sessionId) {
        try {
            const response = await fetch(`/api/user/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: { 'x-auth-token': token }
            });

            if (response.ok) {
                showMessage('تم إنهاء الجلسة بنجاح', 'success');
                document.querySelector('.sessions-modal')?.remove();
                handleViewSessions(); // إعادة تحميل قائمة الجلسات
            } else {
                throw new Error('فشل في إنهاء الجلسة');
            }
        } catch (error) {
            showMessage('خطأ في إنهاء الجلسة', 'error');
        }
    };
    
 
// ... (باقي الكود الموجود)
// إصلاح مشكلة الصورة الشخصية
document.addEventListener('DOMContentLoaded', function() {
    const profileImg = document.getElementById('profile-img');
    if (profileImg) {
        // جرب مسارات مختلفة للصورة
        const imagePaths = [
            '/images/profile.jpeg',
            '/images/profile.jpg', 
            './images/profile.jpeg',
            './images/profile.jpg',
            'images/profile.jpeg',
            'images/profile.jpg'
        ];
        
        let currentIndex = 0;
        
        function tryNextImage() {
            if (currentIndex < imagePaths.length) {
                profileImg.src = imagePaths[currentIndex];
                currentIndex++;
            } else {
                // إذا فشلت جميع المحاولات، استخدم SVG افتراضي
                profileImg.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDE4MCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iOTAiIGN5PSI5MCIgcj0iOTAiIGZpbGw9InVybCgjZ3JhZCkiLz48Y2lyY2xlIGN4PSI5MCIgY3k9IjcwIiByPSIzNSIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC45Ii8+PHBhdGggZD0iTTQwIDE0MEM0MCA5Ny4yIDc0LjYgNjAgMTE1IDYwczc1IDM3LjIgNzUgODB2MzBINDBaIiBmaWxsPSJ3aGl0ZSIgZmlsbC1vcGFjaXR5PSIwLjkiLz48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImdyYWQiIHgxPSIwIiB5MT0iMCIgeDI9IjE4MCIgeTI9IjE4MCI+PHN0b3Agc3RvcC1jb2xvcj0iIzhBMkJFMiIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzAwRTVGRiIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjwvc3ZnPg==';
            }
        }
        
        profileImg.onerror = tryNextImage;
        profileImg.onload = function() {
            console.log('Profile image loaded successfully:', this.src);
        };
        
        // ابدأ بأول مسار
        tryNextImage();
    }
});
// إدارة عرض صفحة "عني"
function setupAboutPageToggle() {
    const aboutBtn = document.getElementById('about-btn');
    const aboutSection = document.getElementById('about-section');
    const mainSections = document.querySelectorAll('.unified-card:not(#about-section)');
    
    if (aboutBtn && aboutSection) {
        aboutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // تحقق من الحالة الحالية
            const isAboutVisible = aboutSection.style.display !== 'none';
            
            if (isAboutVisible) {
                // إخفاء صفحة "عني" وإظهار الصفحات الأخرى
                aboutSection.style.display = 'none';
                mainSections.forEach(section => {
                    section.style.display = 'block';
                });
                aboutBtn.classList.remove('active');
                aboutBtn.querySelector('span').textContent = 'عني';
                
                // تمرير سلس للأعلى
                window.scrollTo({ top: 0, behavior: 'smooth' });
                
                console.log('Main account page displayed');
            } else {
                // إخفاء الصفحات الأخرى وإظهار صفحة "عني"
                mainSections.forEach(section => {
                    section.style.display = 'none';
                });
                aboutSection.style.display = 'block';
                aboutBtn.classList.add('active');
                aboutBtn.querySelector('span').textContent = 'العودة للحساب';
                
                // تمرير سلس لصفحة "عني"
                aboutSection.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
                
                console.log('About page displayed');
            }
            
            // تحديث الـ nav links
            updateNavLinksState(aboutBtn, !isAboutVisible);
        });
    }
}

function updateNavLinksState(activeBtn, isAboutActive) {
    const allNavLinks = document.querySelectorAll('.nav-link');
    
    allNavLinks.forEach(link => {
        if (link === activeBtn) {
            link.classList.toggle('active', isAboutActive);
        } else {
            link.classList.remove('active');
        }
    });
}

// تشغيل الدالة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    setupAboutPageToggle();
    
    // باقي الكود السابق...
});

// ==========================
// Google Profile Picture Functions
// إضافة هذه الدوال في نهاية ملف account.js قبل آخر قوس إغلاق
// ==========================

async function loadGoogleProfilePicture() {
    try {
        // التحقق من وجود حساب Google مربوط
        if (!userData || !userData.googleId) {
            hideProfilePicture();
            return;
        }

        // إنشاء عنصر صورة البروفايل إذا لم يكن موجود
        let profileContainer = document.querySelector('.profile-picture-container');
        if (!profileContainer) {
            profileContainer = createProfilePictureContainer();
        }

        // محاولة الحصول على صورة Google من API
        const googlePictureUrl = await getGoogleProfilePicture();
        if (googlePictureUrl) {
            displayProfilePicture(googlePictureUrl, profileContainer);
        } else {
            // عرض أيقونة افتراضية إذا لم تكن الصورة متوفرة
            displayDefaultAvatar(profileContainer);
        }

    } catch (error) {
        console.error('Error loading Google profile picture:', error);
        displayDefaultAvatar(document.querySelector('.profile-picture-container'));
    }
}

function createProfilePictureContainer() {
    const container = document.createElement('div');
    container.className = 'profile-picture-container';
    
    // البحث عن مكان إدراج الصورة (فوق معلومات الحساب)
    const accountInfoSection = document.querySelector('.account-info-section');
    const pageHeader = document.querySelector('.page-header');
    const mainContent = document.querySelector('.unified-card') || document.querySelector('main');
    
    if (pageHeader && accountInfoSection) {
        // إدراج الحاوية بين العنوان ومعلومات الحساب
        pageHeader.parentNode.insertBefore(container, accountInfoSection);
    } else if (accountInfoSection) {
        // إدراج الحاوية قبل قسم معلومات الحساب
        accountInfoSection.parentNode.insertBefore(container, accountInfoSection);
    } else if (mainContent) {
        // إدراج في بداية المحتوى كبديل
        mainContent.insertBefore(container, mainContent.firstChild);
    } else {
        // إدراج في body كملاذ أخير
        document.body.appendChild(container);
    }
    
    return container;
}
// إصلاحات شاملة لصفحة الحساب
document.addEventListener('DOMContentLoaded', function() {
    // تأخير لضمان تحميل كل شيء
    setTimeout(() => {
        setupSupportButton();
        fixGoogleIcons();
        
        // التأكد من تحميل Font Awesome
        if (!document.querySelector('link[href*="font-awesome"]')) {
            const fontAwesome = document.createElement('link');
            fontAwesome.rel = 'stylesheet';
            fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
            document.head.appendChild(fontAwesome);
            console.log('✅ Font Awesome loaded');
        }
    }, 500);
});

// إصلاح CSS للهيدر عبر JavaScript إذا لزم الأمر
function fixHeaderStyles() {
    const header = document.querySelector('.header');
    if (header) {
        header.style.cssText = `
            background: linear-gradient(135deg, rgba(26, 24, 62, 0.9), rgba(13, 12, 29, 0.95)) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            border-bottom: 1px solid rgba(138, 43, 226, 0.3) !important;
            box-shadow: 0 4px 20px rgba(138, 43, 226, 0.2) !important;
        `;
    }
}

// تشغيل إصلاح الهيدر
setTimeout(fixHeaderStyles, 100);

// استبدال دالة getGoogleProfilePicture بهذه النسخة المحدثة:

async function getGoogleProfilePicture() {
    try {
        // أولاً: استخدام الصورة المحفوظة من Google إذا كانت متوفرة
        if (userData.googleProfilePicture) {
            console.log('Using saved Google profile picture:', userData.googleProfilePicture);
            return userData.googleProfilePicture;
        }

        // ثانياً: محاولة الحصول على الصورة من Google API مباشرة
        if (userData.googleId) {
            try {
                // استخدام Google People API للحصول على الصورة
                const peopleApiUrl = `https://people.googleapis.com/v1/people/${userData.googleId}?personFields=photos`;
                
                const response = await fetch(peopleApiUrl, {
                    headers: {
                        'Authorization': `Bearer ${await getGoogleAccessToken()}`
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.photos && data.photos.length > 0) {
                        const photoUrl = data.photos[0].url;
                        console.log('Found Google profile picture:', photoUrl);
                        
                        // حفظ الصورة في قاعدة البيانات للمرات القادمة
                        await saveGoogleProfilePicture(photoUrl);
                        return photoUrl;
                    }
                }
            } catch (apiError) {
                console.warn('Google People API failed:', apiError.message);
            }
        }

        // ثالثاً: استخدام Gravatar كبديل، لكن مع صورة افتراضية أفضل
        if (userData.googleEmail || userData.email) {
            const email = userData.googleEmail || userData.email;
            const emailHash = await generateMD5Hash(email.toLowerCase().trim());
            
            // استخدام 'retro' أو 'robohash' بدلاً من 'identicon' للحصول على صورة أفضل
            return `https://www.gravatar.com/avatar/${emailHash}?s=200&d=retro&r=g`;
        }

        return null;
    } catch (error) {
        console.error('Error getting profile picture:', error);
        return null;
    }
}

// دالة جديدة لحفظ صورة Google في قاعدة البيانات
async function saveGoogleProfilePicture(photoUrl) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/user/update-google-picture', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify({ googleProfilePicture: photoUrl })
        });
        
        if (response.ok) {
            console.log('Google profile picture saved successfully');
            userData.googleProfilePicture = photoUrl;
        }
    } catch (error) {
        console.error('Error saving Google profile picture:', error);
    }
}

// دالة محسنة لتوليد MD5 hash
async function generateMD5Hash(text) {
    try {
        if (crypto && crypto.subtle) {
            const encoder = new TextEncoder();
            const data = encoder.encode(text);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
        } else {
            // Fallback MD5-like hash
            let hash = 0;
            for (let i = 0; i < text.length; i++) {
                const char = text.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(16).padStart(8, '0');
        }
    } catch (error) {
        console.error('Error generating hash:', error);
        return '00000000';
    }
}


function displayProfilePicture(imageUrl, container) {
    container.innerHTML = `
        <div class="profile-picture-wrapper">
            <div class="profile-picture-frame">
                <img src="${imageUrl}" 
                     alt="صورة الملف الشخصي" 
                     class="profile-picture"
                     onerror="handleImageError(this)">
                <div class="profile-picture-glow"></div>
                <div class="profile-picture-border"></div>
            </div>
            <div class="profile-info">
                <h3 class="profile-name">${userData.username || 'المستخدم'}</h3>
                <p class="profile-email">${userData.googleEmail || userData.email || ''}</p>
                ${userData.googleId ? '<span class="google-badge"><i class="fab fa-google"></i> مرتبط بـ Google</span>' : ''}
            </div>
        </div>
    `;
}

function displayDefaultAvatar(container) {
    if (!container) return;
    
    const initials = userData && userData.username ? userData.username.charAt(0).toUpperCase() : 'U';
    
    container.innerHTML = `
        <div class="profile-picture-wrapper">
            <div class="profile-picture-frame">
                <div class="profile-picture-default">
                    <span class="profile-initials">${initials}</span>
                </div>
                <div class="profile-picture-glow"></div>
                <div class="profile-picture-border"></div>
            </div>
            <div class="profile-info">
                <h3 class="profile-name">${userData ? userData.username || 'المستخدم' : 'المستخدم'}</h3>
                <p class="profile-email">${userData ? userData.email || '' : ''}</p>
                ${userData && userData.googleId ? '<span class="google-badge"><i class="fab fa-google"></i> مرتبط بـ Google</span>' : ''}
            </div>
        </div>
    `;
}

function hideProfilePicture() {
    const container = document.querySelector('.profile-picture-container');
    if (container) {
        container.style.display = 'none';
    }
}

function handleImageError(img) {
    // في حالة فشل تحميل الصورة، عرض الأيقونة الافتراضية
    console.warn('Failed to load profile picture, showing default avatar');
    const container = img.closest('.profile-picture-container');
    if (container) {
        displayDefaultAvatar(container);
    }
}

// تحديث دالة updateDisplayFields الموجودة لتشمل تحميل الصورة
// ابحث عن الدالة الموجودة واستبدلها بهذه النسخة المحدثة:
const originalUpdateDisplayFields = updateDisplayFields;
updateDisplayFields = function(user) {
    // تشغيل الدالة الأصلية
    originalUpdateDisplayFields.call(this, user);
    
    // إضافة تحميل الصورة الشخصية
    setTimeout(() => {
        loadGoogleProfilePicture();
    }, 100);
};

console.log('Google profile picture functions loaded ✅');
});
// إدارة عرض صفحة "عني" - بسيط ومضمون
(function() {
    'use strict';
    
    function initAboutPage() {
        console.log('Initializing About page functionality...');
        
        const showBtn = document.getElementById('show-about-btn');
        const backBtn = document.getElementById('back-to-account-btn');
        const aboutSection = document.getElementById('about-section');
        const mainContent = document.getElementById('main-account-content');
        
        console.log('Elements:', {
            showBtn: !!showBtn,
            backBtn: !!backBtn, 
            aboutSection: !!aboutSection,
            mainContent: !!mainContent
        });
        
        if (showBtn && aboutSection && mainContent) {
            showBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('Show About clicked');
                mainContent.style.display = 'none';
                aboutSection.style.display = 'block';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
        
        if (backBtn && aboutSection && mainContent) {
            backBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('Back to Account clicked');
                aboutSection.style.display = 'none';
                mainContent.style.display = 'block';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
        
        // إعداد الصورة الشخصية
        const profileImg = document.getElementById('profile-img');
        if (profileImg) {
            profileImg.onerror = function() {
                this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTAwIiBjeT0iMTAwIiByPSIxMDAiIGZpbGw9InVybCgjZ3JhZCkiLz48Y2lyY2xlIGN4PSIxMDAiIGN5PSI4MCIgcj0iNDAiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOSIvPjxwYXRoIGQ9Ik00NSAxNTVDNDUgMTEwIDcwIDc1IDEyNSA3NXM4MCAzNSA4MCA4MHY0NUg0NVoiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOSIvPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZCIgeDE9IjAiIHkxPSIwIiB4Mj0iMjAwIiB5Mj0iMjAwIj48c3RvcCBzdG9wLWNvbG9yPSIjOEEyQkUyIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMDBFNUZGIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PC9zdmc+';
            };
        }
    }
    // دالة حساب العمر الديناميكي
function calculateAge() {
    // تاريخ الميلاد: 31 أكتوبر 2010 (بافتراض إنك هتبقى 15 في 2025)
    const birthDate = new Date(2010, 9, 31); // الشهر 9 = أكتوبر (يبدأ من 0)
    const today = new Date();
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    
    // إذا لم يأت عيد الميلاد بعد هذا العام
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
}

// دالة عرض العمر مع رسالة خاصة لعيد الميلاد
function getAgeDisplay() {
    const age = calculateAge();
    const today = new Date();
    const birthDate = new Date(today.getFullYear(), 9, 31); // 31 أكتوبر من العام الحالي
    
    // تحقق إذا كان اليوم عيد الميلاد
    if (today.getMonth() === 9 && today.getDate() === 31) {
        return {
            age: age,
            message: `🎉 عيد ميلاد سعيد! أصبحت ${age} سنة اليوم! 🎂`,
            isSpecialDay: true
        };
    }
    
    // حساب الأيام المتبقية لعيد الميلاد
    if (birthDate < today) {
        // إذا فات عيد الميلاد هذا العام، احسب للعام القادم
        birthDate.setFullYear(today.getFullYear() + 1);
    }
    
    const daysUntilBirthday = Math.ceil((birthDate - today) / (1000 * 60 * 60 * 24));
    
    return {
        age: age,
        message: `عمري ${age} سنة`,
        daysUntil: daysUntilBirthday,
        isSpecialDay: false
    };
}

// تحديث النص في صفحة "عني"
function updateAgeInAboutPage() {
    const ageInfo = getAgeDisplay();
    
    // البحث عن النص في صفحة عني وتحديثه
    const aboutDescription = document.querySelector('.about-description');
    if (aboutDescription) {
        const paragraphs = aboutDescription.querySelectorAll('p');
        if (paragraphs.length > 0) {
            // تحديث أول paragraph بالعمر الجديد
            let firstParagraph = paragraphs[0];
            
            if (ageInfo.isSpecialDay) {
                // رسالة خاصة لعيد الميلاد
                firstParagraph.innerHTML = `${ageInfo.message} ومبرمج في الأنظمة المدمجة (Embedded Systems).`;
                firstParagraph.style.color = '#00e5ff';
                firstParagraph.style.fontWeight = 'bold';
                firstParagraph.style.animation = 'celebration 2s ease-in-out infinite alternate';
            } else {
                firstParagraph.innerHTML = `${ageInfo.message}، ومبرمج في الأنظمة المدمجة (Embedded Systems).`;
                
                // إضافة رسالة العد التنازلي (اختياري)
                if (ageInfo.daysUntil <= 30) {
                    const countdownElement = document.createElement('small');
                    countdownElement.style.display = 'block';
                    countdownElement.style.color = '#8A2BE2';
                    countdownElement.style.marginTop = '5px';
                    countdownElement.style.fontSize = '0.9em';
                    
                    if (!firstParagraph.querySelector('small')) {
                        firstParagraph.appendChild(countdownElement);
                    }
                }
            }
        }
    }
}
// تشغيل تحديث العمر عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    // تحديث العمر فور التحميل
    updateAgeInAboutPage();
    
    // تحديث العمر كل دقيقة (للتأكد من التحديث في عيد الميلاد)
    setInterval(updateAgeInAboutPage, 60000);
    
    // تحديث العمر كل 24 ساعة
    setInterval(updateAgeInAboutPage, 24 * 60 * 60 * 1000);
    
    console.log('Age calculator initialized');
    console.log('Current age:', getAgeDisplay());
});
// دالة مسح جميع بيانات الحساب (ما عدا أيام النشاط)
async function clearAllData() {
    // 1. تأكيد أولي
    const confirmation = confirm('⚠️ هل أنت متأكد من مسح جميع بيانات حسابك؟\n\n• سيتم حذف جميع الـ Widgets\n• سيتم مسح إعدادات Adafruit IO\n• لن يتم حذف الحساب نفسه\n• لن يتم حذف أيام النشاط');
    
    if (!confirmation) {
        showMessage('تم إلغاء العملية.', 'info');
        return;
    }
    
    // 2. تأكيد ثاني بكتابة كلمة
    const finalConfirmation = prompt('⚠️ للتأكيد، اكتب كلمة "مسح" بالعربي أو "clear" بالإنجليزي:');
    
    if (!finalConfirmation || 
        (finalConfirmation.trim().toLowerCase() !== 'مسح' && 
         finalConfirmation.trim().toLowerCase() !== 'clear')) {
        showMessage('تم إلغاء العملية. الكلمة غير صحيحة.', 'info');
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        showMessage('الرجاء تسجيل الدخول أولاً.', 'error');
        window.location.href = '/';
        return;
    }
    
    try {
        showMessage('جاري مسح البيانات...', 'info');
        
        // 4. إرسال الطلب للسيرفر
        const response = await fetch('/api/user/clear-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'حدث خطأ أثناء مسح البيانات');
        }
        
        const data = await response.json();
        
        // 5. إظهار رسالة النجاح
        showMessage('✅ تم مسح جميع البيانات بنجاح! جاري إعادة تحميل الصفحة...', 'success');
        
        // 6. إعادة تحميل البيانات
        setTimeout(async () => {
            await loadUserData();
            await loadUserStats();
            window.location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('خطأ في مسح البيانات:', error);
        showMessage(`خطأ: ${error.message}`, 'error');
    }
}

// تأكد من ربط الزر عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    // ... الكود الموجود
    
    // إضافة event listener لزر مسح البيانات
    const clearDataBtn = document.querySelector('.btn-danger[onclick="clearAllData()"]');
    if (clearDataBtn) {
        clearDataBtn.onclick = clearAllData;
    }
});

// فحص عيد الميلاد وإظهار إشعار خاص
function checkBirthdayNotification() {
    const ageInfo = getAgeDisplay();
    
    if (ageInfo.isSpecialDay) {
        // إظهار إشعار احتفالي
        setTimeout(() => {
            if (confirm('🎉 كل سنة وأنت طيب! اليوم عيد ميلادك! 🎂\nهل تريد مشاركة هذه اللحظة السعيدة؟')) {
                // يمكن إضافة كود لمشاركة الاحتفال
                console.log('Birthday celebration shared!');
            }
        }, 2000);
    } else if (ageInfo.daysUntil <= 7) {
        // تنبيه قبل أسبوع من عيد الميلاد
        console.log(`🎂 عيد ميلادك بعد ${ageInfo.daysUntil} أيام!`);
    }
}

    
    // تشغيل الدالة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAboutPage);
    } else {
        initAboutPage();
    }
    
    // تشغيل الدالة بعد ثانية واحدة كخطة احتياطية
    setTimeout(initAboutPage, 1000);
})();
