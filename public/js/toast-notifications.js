// public/js/toast-notifications.js - نظام الإشعارات الموحد
(function() {
    'use strict';

    // إنشاء container للإشعارات عند تحميل الصفحة
    function createToastContainer() {
        if (document.getElementById('toast-container')) return;

        const container = document.createElement('div');
        container.id = 'toast-container';
        container.setAttribute('role', 'region');
        container.setAttribute('aria-label', 'الإشعارات');
        container.style.cssText = `
            position: fixed;
            top: 90px;
            left: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-width: 380px;
            pointer-events: none;
        `;
        
        document.body.appendChild(container);
    }

    // دالة عرض الإشعارات - Glass Morphism Design
    window.showMessage = function(message, type = 'info') {
        // إنشاء container لو مش موجود
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            createToastContainer();
            toastContainer = document.getElementById('toast-container');
        }

        // تحديد الألوان والأيقونات
        const config = {
            success: {
                icon: 'fas fa-check-circle',
                gradient: 'linear-gradient(135deg, rgba(46, 213, 115, 0.25), rgba(16, 185, 129, 0.25))',
                borderColor: 'rgba(46, 213, 115, 0.4)',
                glowColor: 'rgba(46, 213, 115, 0.3)'
            },
            error: {
                icon: 'fas fa-exclamation-circle',
                gradient: 'linear-gradient(135deg, rgba(255, 71, 87, 0.25), rgba(220, 38, 38, 0.25))',
                borderColor: 'rgba(255, 71, 87, 0.4)',
                glowColor: 'rgba(255, 71, 87, 0.3)'
            },
            warning: {
                icon: 'fas fa-exclamation-triangle',
                gradient: 'linear-gradient(135deg, rgba(255, 165, 2, 0.25), rgba(217, 119, 6, 0.25))',
                borderColor: 'rgba(255, 165, 2, 0.4)',
                glowColor: 'rgba(255, 165, 2, 0.3)'
            },
            info: {
                icon: 'fas fa-info-circle',
                gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(37, 99, 235, 0.25))',
                borderColor: 'rgba(59, 130, 246, 0.4)',
                glowColor: 'rgba(59, 130, 246, 0.3)'
            }
        };

        const typeConfig = config[type] || config.info;

        // إنشاء عنصر الإشعار
        const toast = document.createElement('div');
        toast.className = 'glass-toast';
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="${typeConfig.icon}"></i>
            </div>
            <span class="toast-message">${message}</span>
            <button class="toast-close" aria-label="إغلاق">
                <i class="fas fa-times"></i>
            </button>
        `;

        // تطبيق الأنماط
        toast.style.cssText = `
            background: ${typeConfig.gradient};
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid ${typeConfig.borderColor};
            border-radius: 16px;
            padding: 16px 20px;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 8px 32px ${typeConfig.glowColor}, 
                        0 4px 12px rgba(0, 0, 0, 0.2),
                        inset 0 1px 0 rgba(255, 255, 255, 0.15);
            color: #fff;
            font-size: 14px;
            font-weight: 500;
            line-height: 1.5;
            min-width: 280px;
            max-width: 380px;
            transform: translateX(-120%);
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55);
            pointer-events: all;
            position: relative;
            overflow: hidden;
        `;

        // إضافة الرسالة للـ container
        toastContainer.appendChild(toast);

        // تفعيل الأنيميشن
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        });

        // زر الإغلاق
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.onclick = () => dismissToast(toast);

        // حذف تلقائي بعد 4 ثوان
        const autoHideTimeout = setTimeout(() => {
            dismissToast(toast);
        }, 4000);

        // حفظ timeout للإلغاء عند الحاجة
        toast.dataset.timeout = autoHideTimeout;

        return toast;
    };

    // دالة إخفاء الإشعار
    function dismissToast(toast) {
        if (!toast || !toast.parentElement) return;

        // إلغاء الـ timeout
        if (toast.dataset.timeout) {
            clearTimeout(parseInt(toast.dataset.timeout));
            delete toast.dataset.timeout;
        }

        // أنيميشن الإخفاء
        toast.style.transform = 'translateX(-120%)';
        toast.style.opacity = '0';

        // حذف من DOM بعد انتهاء الأنيميشن
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 400);
    }

    // إنشاء container عند تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createToastContainer);
    } else {
        createToastContainer();
    }

    // CSS للإشعارات
    const style = document.createElement('style');
    style.textContent = `
        .glass-toast .toast-icon {
            font-size: 20px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50%;
        }

        .glass-toast .toast-message {
            flex: 1;
            font-family: 'Tajawal', sans-serif;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .glass-toast .toast-close {
            background: transparent;
            border: none;
            color: #fff;
            cursor: pointer;
            padding: 4px 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.7;
            transition: all 0.2s ease;
            border-radius: 6px;
            flex-shrink: 0;
        }

        .glass-toast .toast-close:hover {
            opacity: 1;
            background: rgba(255, 255, 255, 0.1);
        }

        .glass-toast .toast-close i {
            font-size: 14px;
        }

        /* للشاشات الصغيرة */
        @media (max-width: 768px) {
            #toast-container {
                top: 80px !important;
                left: 10px;
                right: 10px;
                max-width: calc(100% - 20px);
            }
            
            .glass-toast {
                min-width: auto !important;
                max-width: 100% !important;
            }
        }

        /* Dark mode adjustments */
        @media (prefers-color-scheme: dark) {
            .glass-toast {
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
                           0 4px 12px rgba(0, 0, 0, 0.3),
                           inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
            }
        }
    `;
    document.head.appendChild(style);

    console.log('✅ نظام الإشعارات الموحد تم تحميله');
})();
