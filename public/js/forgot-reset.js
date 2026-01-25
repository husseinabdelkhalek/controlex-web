// public/js/forgot-reset.js - النسخة النهائية والمحسنة والمصححة
(function() {
    'use strict';
    
    console.log('🚀 نظام إعادة تعيين كلمة المرور - تحميل النسخة v3.0...');

    // ==================== المتغيرات العامة لإدارة الحالة ====================
    let resetEmail = ''; // لتخزين بريد المستخدم بين الخطوات
    let resetCode = ''; // لتخزين كود التحقق
    let isLoading = false; // لمنع الإرسال المتعدد

    // ==================== بدء التهيئة عند تحميل الصفحة ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeResetFlow);
    } else {
        initializeResetFlow();
    }
     // بعد let resetCode = ''; أضف:
const urlParams = new URLSearchParams(window.location.search);
resetEmail = urlParams.get('email') || '';
resetCode  = urlParams.get('code')  || '';
console.log('🔍 resetEmail=', resetEmail, ' resetCode=', resetCode);

    function initializeResetFlow() {
        // إذا كنت تستخدم مودالز، فتأكد أن هذه الـ IDs هي لأي فورم ممكن يكون في أي مودال.
        // وإذا كانت صفحات HTML منفصلة، يجب أن يتم تبديل setupFunctions لكل صفحة على حدة
        // أو دمجها بطريقة ذكية تعتمد على الـ URL.

        // بما أن الـ HTML اللي أرسلته لـ reset-password.html هو صفحة HTML كاملة،
        // فده معناه إن كل خطوة (forgot, verification, reset) ممكن تكون صفحة منفصلة.
        // لو دي الحالة، المتغيرات resetEmail و resetCode هتفقد قيمتها بين الصفحات.
        // الحل هو تمريرها في الـ URL أو استخدام Local Storage.
        // بناءً على رسالتك اللي بتقول "جميع الحقول مطلوبة" من الـ backend، فغالباً المشكلة هنا.
        
        // سنفترض أنك في صفحة 'reset-password.html' حالياً.
        // هنا يجب أن يتم قراءة email و code من الـ URL.

        const urlParams = new URLSearchParams(window.location.search);
        resetEmail = urlParams.get('email') || '';
        resetCode = urlParams.get('code') || ''; // لو الكود بيتم تمريره في الـ URL

        // For debugging:
        console.log('Initial resetEmail from URL:', resetEmail);
        console.log('Initial resetCode from URL:', resetCode);

        // ربط الأحداث بالنماذج الثلاثة (حتى لو مش كلهم موجودين في الصفحة الحالية، الكود مش هيضرب)
        setupForgotPasswordForm();
        setupVerificationForm();
        setupResetPasswordForm(); // ده هيكون أهم واحد لصفحة reset-password.html

        console.log('✅ تم تهيئة نظام إعادة تعيين كلمة المرور بنجاح');
    }

    // ==================== الخطوة 1: نموذج طلب كود إعادة التعيين (غالباً في forgot-password.html) ====================
    function setupForgotPasswordForm() {
        const forgotForm = document.getElementById('forgot-form'); // تأكد إن ده الـ ID الصح
        if (forgotForm) {
            forgotForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (isLoading) return;

                const emailInput = forgotForm.querySelector('input[type="email"]');
                const email = emailInput?.value.trim();
                
                if (!email || !isValidEmail(email)) {
                    showMessage('forgot-message', 'يرجى إدخال بريد إلكتروني صحيح', 'error');
                    return;
                }
                
                resetEmail = email; // حفظ البريد الإلكتروني للخطوة التالية (لو في نفس الصفحة)

                try {
                    setLoading(true, forgotForm.querySelector('.btn'));
                    showMessage('forgot-message', 'جاري إرسال كود إعادة التعيين...', 'info');

                    const res = await fetch('/api/auth/forgot-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });
                    
                    const data = await res.json();
                    
                    if (res.ok) {
                        showMessage('forgot-message', 'تم إرسال الكود إلى بريدك. تحقق من صندوق الوارد.', 'success');
                        setTimeout(() => {
                            // لو بتوجه لصفحة HTML منفصلة:
                            // تأكد انك بتوجه لصفحة التحقق مع تمرير الإيميل
                            window.location.href = `/verification-page.html?email=${encodeURIComponent(email)}`; 
                            // لو الكود بيتم تمريره من الـ backend، ممكن تمرره هنا كمان:
                            // window.location.href = `/verification-page.html?email=${encodeURIComponent(email)}&code=${encodeURIComponent(data.code || '')}`;
                            // ولكن الأفضل أن المستخدم هو اللي يدخل الكود.
                        }, 2500);
                    } else {
                        throw new Error(data.msg || 'خطأ في إرسال الكود');
                    }
                } catch (err) {
                    console.error('خطأ في طلب إعادة التعيين:', err);
                    showMessage('forgot-message', err.message || 'حدث خطأ غير متوقع', 'error');
                } finally {
                    setLoading(false, forgotForm.querySelector('.btn'));
                }
            });
            console.log('✅ تم إعداد نموذج "نسيت كلمة المرور"');
        }
    }

   function setupVerificationForm() {
    const verificationForm = document.getElementById('verification-form');
    
    if (verificationForm) {
        // ✅ البحث عن OTP Container
        const otpContainer = document.getElementById('otp-container');
        
        if (otpContainer) {
            // ✅ إنشاء OTP Input
            const otpInput = new OTPInput('#otp-container', {
                length: 6,
                type: 'number',
                autoSubmit: true,
                onComplete: (code) => {
                    console.log('✅ تم إدخال الكود:', code);
                    showMessage('verification-message', 'جاري التحقق...', 'info');
                },
                onInput: (value) => {
                    // ✅ إخفاء رسالة الخطأ عند الكتابة
                    const msgEl = document.getElementById('verification-message');
                    if (msgEl && msgEl.classList.contains('error')) {
                        msgEl.classList.remove('show');
                    }
                }
            });
            
            // ✅ حفظ المرجع
            window.otpInput = otpInput;
        }
        
        verificationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (isLoading) return;
            
            // ✅ الحصول على الكود من OTP Input
            const code = window.otpInput ? window.otpInput.getValue() : '';
            
            if (!code || !/^\d{6}$/.test(code)) {
                showMessage('verification-message', 'يرجى إدخال كود مكون من 6 أرقام', 'error');
                return;
            }
            
            resetCode = code;
            
            const currentEmail = resetEmail || new URLSearchParams(window.location.search).get('email');
            
            if (!currentEmail) {
                showMessage('verification-message', 'البريد الإلكتروني مفقود. يرجى المحاولة مرة أخرى.', 'error');
                return;
            }
            
            try {
                setLoading(true, verificationForm.querySelector('.btn'));
                showMessage('verification-message', 'جاري التحقق من الكود...', 'info');
                
                const res = await fetch('/api/auth/verify-reset-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentEmail, code })
                });
                
                const data = await res.json();
                
                if (res.ok) {
                    showMessage('verification-message', 'تم التحقق بنجاح! جاري التوجيه...', 'success');
                    setTimeout(() => {
                        window.location.href = `reset-password.html?email=${encodeURIComponent(currentEmail)}&code=${encodeURIComponent(code)}`;
                    }, 1500);
                } else {
                    throw new Error(data.msg || 'فشل التحقق من الكود');
                }
                
            } catch (err) {
                console.error('خطأ في التحقق:', err);
                showMessage('verification-message', err.message, 'error');
                
                // ✅ إظهار حالة الخطأ ومسح OTP
                if (window.otpInput) {
                    window.otpInput.showError();
                    window.otpInput.clear();
                }
                
            } finally {
                setLoading(false, verificationForm.querySelector('.btn'));
            }
        });
        
        console.log('✅ تم تفعيل OTP Input');
    }
}


    // ==================== الخطوة 3: نموذج إعادة تعيين كلمة المرور الجديدة (في reset-password.html) ====================
    // ==================== الخطوة 3: نموذج إعادة تعيين كلمة المرور الجديدة (في reset-password.html) ====================
 function setupResetPasswordForm() {
    const resetForm = document.getElementById('reset-form');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isLoading) return;

            // ✅ الحصول على القيم بالطريقة الصحيحة
            const formData = new FormData(resetForm);
            const email = document.getElementById('email').value || 
                         new URLSearchParams(window.location.search).get('email');
            const code = document.getElementById('verification-code').value || 
                        new URLSearchParams(window.location.search).get('code');
            const password = formData.get('password');
            const confirmPassword = formData.get('confirm-password');

            console.log('🔍 فحص البيانات:', {
                email: email ? '✅ موجود' : '❌ مفقود',
                code: code ? '✅ موجود' : '❌ مفقود',
                password: password ? '✅ موجود' : '❌ مفقود',
                confirmPassword: confirmPassword ? '✅ موجود' : '❌ مفقود'
            });

            // التحقق من وجود جميع الحقول
            if (!email) {
                showMessage('form-message', 'خطأ: لم يتم العثور على البريد الإلكتروني. يرجى البدء من جديد.', 'error');
                return;
            }
            
            if (!code) {
                showMessage('form-message', 'خطأ: لم يتم العثور على كود التحقق. يرجى البدء من جديد.', 'error');
                return;
            }
            
            if (!password || !confirmPassword) {
                showMessage('form-message', 'جميع الحقول مطلوبة', 'error');
                return;
            }

            if (password.length < 6) {
                showMessage('form-message', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
                return;
            }

            if (password !== confirmPassword) {
                showMessage('form-message', 'كلمتا المرور غير متطابقتين', 'error');
                return;
            }

            try {
                setLoading(true, resetForm.querySelector('.btn'));
                showMessage('form-message', 'جاري تحديث كلمة المرور...', 'info');
                
                // ✅ البيانات الصحيحة للإرسال
                const requestData = {
                    email: email,
                    code: code,
                    newPassword: password,
                    confirmPassword: confirmPassword
                };
                
                console.log('📤 إرسال البيانات:', requestData);

                const res = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestData)
                });

                const data = await res.json();
                
                if (res.ok) {
                    showMessage('form-message', 'تم تحديث كلمة المرور بنجاح! جاري توجيهك...', 'success');
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 3000);
                } else {
                    throw new Error(data.msg || 'فشل تحديث كلمة المرور');
                }

            } catch (err) {
                console.error('❌ خطأ في تحديث كلمة المرور:', err);
                showMessage('form-message', err.message, 'error');
            } finally {
                setLoading(false, resetForm.querySelector('.btn'));
            }
        });

        console.log('✅ تم إعداد نموذج إعادة تعيين كلمة المرور');
    }
}

    // ==================== وظائف مساعدة ====================

    // إظهار الرسائل للمستخدم
    // تم تعديلها لتستقبل الـ elementId بدلاً من الاعتماد على id="form-message" ثابت
    function showMessage(elementId, message, type) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn(`Element with ID '${elementId}' not found for message: ${message}`);
            // fallback if element not found, could be an alert or logging
            return;
        }
        element.innerHTML = `<i class="fas ${getIconForType(type)}"></i> ${message}`;
        element.className = `form-message ${type} show`;
        if (type !== 'info') {
            setTimeout(() => { element.classList.remove('show'); }, 5000);
        }
    }

    // إدارة حالة التحميل للأزرار
    function setLoading(loading, button) {
        if (!button) return;
        isLoading = loading;
        if (loading) {
            button.disabled = true;
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = `<span class="loading-spinner"></span> جاري العمل...`;
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText;
        }
    }
    
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    function getIconForType(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };
        return icons[type] || 'fa-info-circle';
    }

    // وظائف التحكم بالنوافذ المنبثقة (لو بتستخدم مودالز في صفحة واحدة)
    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('show'), 10);
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    }

})();