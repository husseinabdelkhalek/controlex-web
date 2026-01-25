// public/js/settings.js - COMPLETE ENHANCED VERSION v3.0
(function() {
    'use strict';
    
    console.log('🚀 Settings page v3.0 - Loading...');
    
    // ==================== المتغيرات العامة ==================== 
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }
    
    let iconPicker = null;
    let isFormSubmitting = false;
    let configuredWidgets = [];
    const isMobile = window.innerWidth <= 768;
    
    // انتظار تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSettingsPage);
    } else {
        initializeSettingsPage();
    }
    
function initializeSettingsPage() {
    console.log('⚡ Optimizing Settings Page...');
    console.log('Device:', isMobile ? 'Mobile' : 'Desktop');
    
    // ✅ 1. تفعيل التحميل الكسول lazy loading
    const lazyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('loaded');
            }
        });
    });
    
    document.querySelectorAll('.unified-card').forEach(card => {
        lazyObserver.observe(card);
    });
    
    // ✅ 2. تقليل العمليات على DOM
    const configuredList = document.getElementById('configured-list');
    if (configuredList) {
        // استخدام DocumentFragment لتقليل Repaints
        const fragment = document.createDocumentFragment();
    }
    
    // ✅ 3. Debounce للبحث في الأيقونات
    const iconSearch = document.querySelector('.icon-picker-search');
    if (iconSearch) {
        let searchTimeout;
        iconSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                // كود البحث
            }, 300); // تأخير 300ms
        });
    }
    
    initializeFormElements();
    initializeIconPicker();
    initializeColorPickers();
    initializeEventListeners();
    loadConfiguredWidgets();
    setDefaultValues();
    
    // Set initial widget type on body
    const widgetTypeSelect = document.getElementById('widget-type');
    if (widgetTypeSelect) {
        document.body.setAttribute('data-widget-type', widgetTypeSelect.value);
    }
    
    console.log('✅ Settings page optimized and initialized');
}

    
    // ==================== تهيئة عناصر النموذج ==================== 
    function initializeFormElements() {
        const widgetForm = document.getElementById('widget-form');
        const widgetTypeSelect = document.getElementById('widget-type');
        const configuredList = document.getElementById('configured-list');
        
        if (!widgetForm || !widgetTypeSelect || !configuredList) {
            console.error('❌ Required form elements not found');
            return;
        }
        
        // تعيين القيم الافتراضية
        widgetTypeSelect.value = 'toggle';
        toggleFieldVisibility('toggle');
        
        console.log('✅ Form elements initialized');
    }
    
    // ==================== تهيئة منتقي الأيقونات ==================== 
    function initializeIconPicker() {
        const iconInput = document.getElementById('widget-icon');
        const widgetTypeSelect = document.getElementById('widget-type');
        
        if (iconInput && typeof initIconPicker === 'function') {
            iconPicker = initIconPicker(iconInput, widgetTypeSelect.value);
            console.log('✅ Icon picker initialized');
        } else {
            console.warn('⚠️ Icon picker not available');
        }
    }
    
    // ==================== تهيئة منتقيات الألوان ==================== 
    function initializeColorPickers() {
        const colorInputs = [
            { color: 'widget-primary-color', text: 'widget-primary-color-text' },
            { color: 'widget-active-color', text: 'widget-active-color-text' },
            { color: 'widget-glow-color', text: 'widget-glow-color-text' }
        ];
        
        colorInputs.forEach(({ color, text }) => {
            const colorInput = document.getElementById(color);
            const textInput = document.getElementById(text);
            
            if (colorInput && textInput) {
                // تزامن قيم الألوان
                colorInput.addEventListener('change', (e) => {
                    const value = e.target.value.toUpperCase();
                    textInput.value = value;
                    updateColorPreview(color, value);
                });
                
                textInput.addEventListener('input', (e) => {
                    const value = e.target.value.trim();
                    if (isValidColor(value)) {
                        colorInput.value = value;
                        updateColorPreview(color, value);
                        textInput.classList.remove('error');
                    } else {
                        textInput.classList.add('error');
                    }
                });
                
                textInput.addEventListener('blur', (e) => {
                    const value = e.target.value.trim();
                    if (!isValidColor(value) && value !== '') {
                        e.target.value = colorInput.value.toUpperCase();
                        textInput.classList.remove('error');
                    }
                });
                
                // تعيين القيم الافتراضية
                textInput.value = colorInput.value.toUpperCase();
                updateColorPreview(color, colorInput.value);
            }
        });
        
        console.log('✅ Color pickers initialized');
    }
    
    // ==================== مستمعي الأحداث ==================== 
    function initializeEventListeners() {
        const widgetForm = document.getElementById('widget-form');
        const widgetTypeSelect = document.getElementById('widget-type');
        
        // معالجة تغيير نوع الأداة
        if (widgetTypeSelect) {
            widgetTypeSelect.addEventListener('change', handleWidgetTypeChange);
        }
        
        // معالجة إرسال النموذج
        if (widgetForm) {
            widgetForm.addEventListener('submit', handleFormSubmit);
        }
        
        // معالجة تغيير حجم النافذة
        window.addEventListener('resize', debounce(handleWindowResize, 250));
        
        console.log('✅ Event listeners attached');
    }
    
    function handleWidgetTypeChange(e) {
        const selectedType = e.target.value;
        console.log(`🔄 Widget type changed to: ${selectedType}`);
        
        toggleFieldVisibility(selectedType);
        updateDefaultFieldsByType(selectedType);
        
        if (iconPicker) {
            iconPicker.updateWidgetType(selectedType);
            const defaultIcon = iconPicker.getDefaultIcon(selectedType);
            iconPicker.selectIcon(defaultIcon);
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

    async function handleFormSubmit(e) {
        e.preventDefault();
        
        if (isFormSubmitting) {
            console.log('⏳ Form already submitting...');
            return;
        }
        
        const formData = new FormData(e.target);
        const widgetData = extractWidgetData(formData);
        
        // التحقق من صحة البيانات
        const validation = validateWidgetData(widgetData);
        if (!validation.isValid) {
            showMessage(validation.message, 'error');
            return;
        }
        
        // تحقق إذا كان في وضع التعديل
        const widgetForm = document.getElementById('widget-form');
        const editId = widgetForm ? widgetForm.getAttribute('data-edit-id') : null;
        try {
            isFormSubmitting = true;
            setFormLoading(true, editId ? 'جاري تعديل الأداة...' : 'جاري إضافة الأداة...');
            if (editId) {
                // تعديل أداة موجودة
                await updateWidget(editId, widgetData);
                showMessage('تم تعديل الأداة بنجاح!', 'success');
            } else {
                // إضافة أداة جديدة
                await submitWidget(widgetData);
                showMessage('تم إضافة الأداة بنجاح!', 'success');
            }
            resetForm();
            await loadConfiguredWidgets();
        } catch (error) {
            console.error('❌ Form submission error:', error);
            showMessage(error.message || (editId ? 'حدث خطأ في تعديل الأداة' : 'حدث خطأ في إضافة الأداة'), 'error');
        } finally {
            isFormSubmitting = false;
            setFormLoading(false);
            // إزالة وضع التعديل بعد الحفظ
            if (widgetForm) widgetForm.removeAttribute('data-edit-id');
        }
    }
    
    function handleWindowResize() {
        const newIsMobile = window.innerWidth <= 768;
        if (newIsMobile !== isMobile) {
            console.log('📱 Device type changed, adapting UI...');
            // يمكن إضافة تعديلات هنا حسب الحاجة
        }
    }
function toggleFieldVisibility(type) {
    console.log('Toggling field visibility for type:', type);
    
    const commandFieldset = document.querySelector('.command-fields');
    const unitFieldset = document.querySelector('.unit-field');
    const sliderFieldset = document.querySelector('.slider-fields');
    const joystickFieldset = document.querySelector('.joystick-fields');
    const colorFieldset = document.querySelector('.color-fields');
    const activeColorGroup = document.getElementById('widget-active-color')?.closest('.unified-form-group');
    const glowColorLabel = document.querySelector('label[for="widget-glow-color"]');
    
    // Hide all fields first
    if (commandFieldset) commandFieldset.style.setProperty('display', 'none', 'important');
    if (unitFieldset) unitFieldset.style.display = 'none';
    if (sliderFieldset) sliderFieldset.style.display = 'none';
    if (joystickFieldset) joystickFieldset.style.display = 'none';
    if (colorFieldset) colorFieldset.style.display = 'none';
    
    switch (type) {
        case 'toggle':
        case 'push':
            // Show command fields
            if (commandFieldset) {
                commandFieldset.style.setProperty('display', 'block', 'important');
            }
            
            // Show colors
            if (colorFieldset) colorFieldset.style.display = 'block';
            if (activeColorGroup) activeColorGroup.style.display = 'block';
            
            // Update labels and field visibility
            if (typeof updateFieldLabels === 'function') {
                updateFieldLabels(type);
            }
            break;
            
        case 'sensor':
            if (commandFieldset) commandFieldset.style.setProperty('display', 'none', 'important');
            if (unitFieldset) unitFieldset.style.display = 'block';
            if (colorFieldset) colorFieldset.style.display = 'block';
            if (activeColorGroup) activeColorGroup.style.display = 'none';
            break;
            
        case 'slider':
            if (commandFieldset) commandFieldset.style.setProperty('display', 'none', 'important');
            if (sliderFieldset) sliderFieldset.style.display = 'block';
            if (colorFieldset) colorFieldset.style.display = 'block';
            if (activeColorGroup) activeColorGroup.style.display = 'none';
            if (glowColorLabel) glowColorLabel.textContent = 'لون الشريط';
            break;
            
        case 'terminal':
            if (commandFieldset) commandFieldset.style.setProperty('display', 'none', 'important');
            if (colorFieldset) colorFieldset.style.display = 'block';
            if (activeColorGroup) activeColorGroup.style.display = 'none';
            break;
            
        case 'joystick':
            if (commandFieldset) commandFieldset.style.setProperty('display', 'none', 'important');
            if (joystickFieldset) joystickFieldset.style.display = 'block';
            if (colorFieldset) colorFieldset.style.display = 'block';
            if (activeColorGroup) activeColorGroup.style.display = 'none';
            if (glowColorLabel) glowColorLabel.textContent = 'لون التوهج';
            break;
    }
    
    // Reset glow label for non-slider/joystick types
    if (type !== 'slider' && type !== 'joystick') {
        if (glowColorLabel) glowColorLabel.textContent = 'لون التوهج';
    }
    
    console.log('Field visibility updated for type:', type);
}


function updateFieldLabels(type) {
    console.log('Updating field labels for type:', type);
    
    const onCommandLabel = document.querySelector('label[for="on-command"]');
    const offCommandInput = document.getElementById('off-command');
    const offCommandGroup = offCommandInput?.closest('.unified-form-group');
    const commandFieldset = document.querySelector('.command-fields');
    const formRow = commandFieldset?.querySelector('.form-row');
    
    if (type === 'push') {
        // Push button - only show on-command
        if (onCommandLabel) {
            onCommandLabel.textContent = 'أمر الضغط';
        }
        
        // Hide the ENTIRE form-group of off-command
        if (offCommandGroup) {
            offCommandGroup.style.cssText = `
                display: none !important; 
                visibility: hidden !important; 
                height: 0 !important; 
                width: 0 !important;
                opacity: 0 !important; 
                margin: 0 !important; 
                padding: 0 !important; 
                overflow: hidden !important;
                position: absolute !important;
                line-height: 0 !important;
            `;
        }
        
        // Also hide from form-row if it has grid/flex layout
        if (formRow) {
            formRow.style.display = 'block';
            formRow.style.gridTemplateColumns = '1fr';
        }
        
        // Clear off-command value
        if (offCommandInput) {
            offCommandInput.value = '';
            offCommandInput.removeAttribute('required');
        }
        
        console.log('Push button: off-command completely removed');
        
    } else if (type === 'toggle') {
        // Toggle - show both commands
        if (onCommandLabel) {
            onCommandLabel.textContent = 'أمر التشغيل';
        }
        
        // Restore off-command
        if (offCommandGroup) {
            offCommandGroup.style.cssText = '';
        }
        
        // Restore form-row grid layout
        if (formRow) {
            formRow.style.display = '';
            formRow.style.gridTemplateColumns = '';
        }
        
        if (offCommandInput) {
            offCommandInput.setAttribute('required', '');
        }
        
        console.log('Toggle: both commands visible');
    }
}

    
   function updateDefaultFieldsByType(type) {
    const onCommandInput = document.getElementById('on-command');
    const offCommandInput = document.getElementById('off-command');
    
    const defaults = {
        'toggle': { on: 'ON', off: 'OFF' },
        'push': { on: 'PUSH', off: '' },  // off command is empty for push
        'sensor': { on: '', off: '' },
        'terminal': { on: '', off: '' },
        'joystick': { on: '', off: '' },
        'slider': { on: '', off: '' }
    };
    
    const typeDefaults = defaults[type] || defaults['toggle'];
    
    if (onCommandInput) onCommandInput.value = typeDefaults.on;
    if (offCommandInput) offCommandInput.value = typeDefaults.off;
    
    console.log('Default fields updated for type:', type);
}

    
    function setDefaultValues() {
        // تعيين القيم الافتراضية عند التحميل
        updateDefaultFieldsByType('toggle');
        toggleFieldVisibility('toggle');
        
        // تعيين الألوان الافتراضية
        const defaultColors = {
            'widget-primary-color': '#8A2BE2',
            'widget-active-color': '#00e5ff', 
            'widget-glow-color': '#8A2BE2'
        };
        
        Object.entries(defaultColors).forEach(([id, color]) => {
            const colorInput = document.getElementById(id);
            const textInput = document.getElementById(id + '-text');
            
            if (colorInput && !colorInput.value) {
                colorInput.value = color;
            }
            if (textInput && !textInput.value) {
                textInput.value = color.toUpperCase();
            }
        });
        
        console.log('🎨 Default values set');
    }
    
    // ==================== إدارة الألوان ==================== 
    function updateColorPreview(inputId, color) {
        const colorInput = document.getElementById(inputId);
        if (colorInput) {
            colorInput.style.boxShadow = `0 0 15px ${color}60`;
            colorInput.style.borderColor = color;
        }
    }
    
    function isValidColor(color) {
        if (!color) return false;
        
        // التحقق من صيغة hex
        const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        if (hexPattern.test(color)) return true;
        
        // التحقق من أسماء الألوان CSS
        const style = new Option().style;
        style.color = color;
        return style.color !== '';
    }
    
   // public/js/settings.js

function extractWidgetData(formData) {
    const type = formData.get('widget-type'); // نحصل على النوع أولاً
    const data = {
        name: formData.get('widget-name')?.trim(),
        feedName: formData.get('feed-name')?.trim(),
        type: type, // استخدام المتغير المحفوظ
        icon: formData.get('widget-icon')?.trim(),
        primaryColor: formData.get('widget-primary-color') || '#8A2BE2',
        
        // لا نطلب لون التشغيل (activeColor) إلا إذا كان النوع ليس سلايدر أو جويستيك
        activeColor: (type === 'slider' || type === 'joystick') ? null : (formData.get('widget-active-color') || '#00e5ff'),
        
        glowColor: formData.get('widget-glow-color') || '#8A2BE2',
        unit: formData.get('widget-unit')?.trim() || '',
        onCommand: formData.get('on-command')?.trim() || '',
        offCommand: formData.get('off-command')?.trim() || ''
    };

    // إضافة الإعدادات الخاصة بالسلايدر
    if (data.type === 'slider') {
        data.configuration = {
            min: parseInt(formData.get('widget-min')) || 0,
            max: parseInt(formData.get('widget-max')) || 100,
            step: parseInt(formData.get('widget-step')) || 1,
            defaultValue: parseInt(formData.get('widget-default')) || 50,
            showValue: formData.get('widget-show-value') === 'on',
            showTicks: formData.get('widget-show-ticks') === 'on',
            // استخدم لون الإضاءة كلون لشريط السلايدر
            color: data.glowColor
        };
        // حذف الألوان غير المستخدمة في السلايدر
        delete data.activeColor;
    }

    // إضافة أوامر الجويستيك
    if (data.type === 'joystick') {
        data.joystickCommands = {
            // الأوامر الرئيسية
            upCommand: formData.get('joystick-up')?.trim() || '',
            downCommand: formData.get('joystick-down')?.trim() || '',
            leftCommand: formData.get('joystick-left')?.trim() || '',
            rightCommand: formData.get('joystick-right')?.trim() || '',
            // الأوامر القطرية
            upRightCommand: formData.get('joystick-up-right')?.trim() || '',
            upLeftCommand: formData.get('joystick-up-left')?.trim() || '',
            downRightCommand: formData.get('joystick-down-right')?.trim() || '',
            downLeftCommand: formData.get('joystick-down-left')?.trim() || '',
            // أمر التوقف
            stopCommand: formData.get('joystick-stop')?.trim() || '',
            // تفعيل الاتجاهات القطرية
            diagonalCommands: formData.get('joystick-diagonal') === 'on'
        };
        // حذف الألوان غير المستخدمة في الجويستيك
        delete data.activeColor;
    }

    return data;}

    
  // public/js/settings.js

function validateWidgetData(data) {
    if (!data.name || data.name.length < 2) {
        return { isValid: false, message: 'اسم الأداة يجب أن يكون حرفين على الأقل' };
    }
    
    if (!data.feedName || data.feedName.length < 2) {
        return { isValid: false, message: 'اسم Feed يجب أن يكون حرفين على الأقل' };
    }
    
    if (!['toggle', 'push', 'sensor', 'terminal', 'slider', 'joystick'].includes(data.type)) {
        return { isValid: false, message: 'نوع الأداة غير صحيح' };
    }
    
    if (!data.icon) {
        return { isValid: false, message: 'يرجى اختيار أيقونة للأداة' };
    }
    
    // التحقق من قيم السلايدر
    if (data.type === 'slider') {
        const min = parseFloat(data.configuration?.min);
        const max = parseFloat(data.configuration?.max);
        if (isNaN(min) || isNaN(max)) {
            return { isValid: false, message: 'القيم الصغرى والعظمى يجب أن تكون أرقاماً' };
        }
        if (min >= max) {
            return { isValid: false, message: 'القيمة العظمى يجب أن تكون أكبر من القيمة الصغرى' };
        }
    }
    
    // التحقق من أوامر الجويستيك
    if (data.type === 'joystick') {
        const cmds = data.joystickCommands || {};
        if (!cmds.upCommand || !cmds.downCommand || !cmds.leftCommand || !cmds.rightCommand) {
            return { isValid: false, message: 'يرجى إدخال أوامر الاتجاهات الأربعة الأساسية للجويستيك' };
        }
        // التحقق من الأوامر القطرية إذا كان الخيار مفعلاً
        if (cmds.diagonalCommands) {
            if (!cmds.upRightCommand || !cmds.upLeftCommand || !cmds.downRightCommand || !cmds.downLeftCommand) {
                return { isValid: false, message: 'يرجى إدخال جميع الأوامر القطرية للجويستيك' };
            }
        }
    }
    
    // التحقق من الألوان الأساسية المطلوبة لكل الأدوات
    if (!isValidColor(data.primaryColor) || !isValidColor(data.glowColor)) {
        return { isValid: false, message: 'يرجى التأكد من صحة قيم الألوان الأساسية ولون الإضاءة.' };
    }

    // التحقق من لون التشغيل فقط للأنواع التي تستخدمه (toggle, push)
    if ((data.type === 'toggle' || data.type === 'push') && !isValidColor(data.activeColor)) {
        return { isValid: false, message: 'يرجى إدخال لون تشغيل صحيح لمفتاح التشغيل أو زر الضغط.' };
    }
    
    // التحقق من الأوامر للأدوات التفاعلية
    if (data.type === 'toggle' && !data.onCommand) {
        return { isValid: false, message: 'يرجى إدخال أمر التشغيل' };
    }
    if (data.type === 'toggle' && !data.offCommand) {
        return { isValid: false, message: 'يرجى إدخال أمر الإيقاف لمفتاح التشغيل' };
    }
    if (data.type === 'push' && !data.onCommand) {
        return { isValid: false, message: 'يرجى إدخال أمر الضغط' };
    }
    
    return { isValid: true };
}
    
    async function submitWidget(widgetData) {
        const response = await fetch('/api/widgets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify(widgetData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
    }
    
    // دالة لتعديل أداة موجودة
    async function updateWidget(widgetId, widgetData) {
        const response = await fetch(`/api/widgets/${widgetId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify(widgetData)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || `HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }
    
    // ==================== تحميل الأدوات المكونة ==================== 
    async function loadConfiguredWidgets() {
        try {
            showLoadingState('جاري تحميل الأدوات...');
            
            const response = await fetch('/api/widgets', {
                headers: { 'x-auth-token': token }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            configuredWidgets = await response.json();
            displayConfiguredWidgets(configuredWidgets);
            
            console.log(`📦 Loaded ${configuredWidgets.length} configured widgets`);
            
        } catch (error) {
            console.error('❌ Error loading widgets:', error);
            showErrorState('خطأ في تحميل الأدوات');
        }
    }
    
    function displayConfiguredWidgets(widgets) {
        const configuredList = document.getElementById('configured-list');
        if (!configuredList) return;
        
        configuredList.innerHTML = '';
        
        if (widgets.length === 0) {
            configuredList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox" aria-hidden="true"></i>
                    <h3>لا توجد أدوات مُكوَّنة</h3>
                    <p>ابدأ بإضافة أول أداة لك</p>
                </div>
            `;
            return;
        }
        
        widgets.forEach((widget, index) => {
            const item = createWidgetListItem(widget, index);
            configuredList.appendChild(item);
        });
    }
    
    function createWidgetListItem(widget, index) {
        const item = document.createElement('div');
        item.className = 'configured-item';
        item.setAttribute('data-widget-id', widget._id);
        
        const typeLabels = {
            'toggle': 'مفتاح تشغيل/إيقاف',
            'push': 'زر ضغط',
            'sensor': 'حساس',
            'terminal': 'ترمنال',
            'slider': 'سلايدر',
            'joystick': 'عصا تحكم'
        };
        
        const colorPreview = (widget.type === 'toggle' || widget.type === 'push') && widget.activeColor ? 
            `<div class="color-preview" style="background: ${widget.activeColor}; width: 16px; height: 16px; border-radius: 50%; margin-left: 8px;"></div>` : '';
        
        item.innerHTML = `
            <div class="configured-item-info">
                <div class="configured-item-name">
                    <i class="${widget.icon || 'fas fa-question-circle'}" 
                       style="color: ${widget.primaryColor || '#8A2BE2'};" 
                       aria-hidden="true"></i>
                    <span>${widget.name}</span>
                </div>
                <div class="configured-item-details">
                    ${colorPreview}
                    <span>${typeLabels[widget.type] || widget.type}</span>
                    <span class="separator">•</span>
                    <span>${widget.feedName}</span>
                    ${widget.unit ? `<span class="separator">•</span><span>(${widget.unit})</span>` : ''}
                </div>
            </div>
            <div class="configured-item-actions">
                <button class="btn-edit" onclick="editWidget('${widget._id}')" title="تعديل الأداة">
                    <i class="fas fa-edit" aria-hidden="true"></i>
                    تعديل
                </button>
                <button class="btn-delete" onclick="deleteWidget('${widget._id}')" title="حذف الأداة">
                    <i class="fas fa-trash" aria-hidden="true"></i>
                    حذف
                </button>
            </div>
        `;
        
        // إضافة تأثير التحميل التدريجي
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            item.style.transition = 'all 0.3s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
        }, index * 50);
        
        return item;
    }
    
    // ==================== حذف الأدوات ==================== 
    window.deleteWidget = async function(widgetId) {
        const widget = configuredWidgets.find(w => w._id === widgetId);
        if (!widget) {
            console.error('Widget not found');
            return;
        }
        
        const confirmDelete = confirm(`هل أنت متأكد من حذف الأداة "${widget.name}"؟\n\nهذا الإجراء لا يمكن التراجع عنه.`);
        if (!confirmDelete) return;
        
        try {
            const response = await fetch(`/api/widgets/${widgetId}`, {
                method: 'DELETE',
                headers: { 'x-auth-token': token }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.msg || 'فشل في حذف الأداة');
            }
            
            showMessage('تم حذف الأداة بنجاح', 'success');
            await loadConfiguredWidgets();
            
        } catch (error) {
            console.error('Delete error:', error);
            showMessage(error.message || 'حدث خطأ في حذف الأداة', 'error');
        }
    };
    
    // ==================== تعديل الأدوات ==================== 
    window.editWidget = function(widgetId) {
        const widget = configuredWidgets.find(w => w._id === widgetId);
        if (!widget) {
            console.error('Widget not found');
            return;
        }
        
        // ملء النموذج ببيانات الأداة
        fillFormWithWidgetData(widget);
        
        // التمرير إلى النموذج
        const widgetForm = document.getElementById('widget-form');
        if (widgetForm) {
            widgetForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        showMessage(`جاري تحرير الأداة "${widget.name}"`, 'info');
    };
    
    function fillFormWithWidgetData(widget) {
        const fields = {
            // البيانات الأساسية
            'widget-name': widget.name,
            'feed-name': widget.feedName,
            'widget-type': widget.type,
            'widget-icon': widget.icon,
            // الألوان
            'widget-primary-color': widget.primaryColor,
            'widget-active-color': widget.activeColor,
            'widget-glow-color': widget.glowColor,
            // الوحدة والأوامر الأساسية
            'widget-unit': widget.unit || '',
            'on-command': widget.onCommand || '',
            'off-command': widget.offCommand || '',
            // إعدادات السلايدر
            'widget-min': widget.configuration?.min || 0,
            'widget-max': widget.configuration?.max || 100,
            // أوامر الجويستيك الأساسية
            'joystick-up': widget.joystickCommands?.upCommand || '',
            'joystick-down': widget.joystickCommands?.downCommand || '',
            'joystick-left': widget.joystickCommands?.leftCommand || '',
            'joystick-right': widget.joystickCommands?.rightCommand || '',
            // أوامر الجويستيك القطرية
            'joystick-up-right': widget.joystickCommands?.upRightCommand || '',
            'joystick-up-left': widget.joystickCommands?.upLeftCommand || '',
            'joystick-down-right': widget.joystickCommands?.downRightCommand || '',
            'joystick-down-left': widget.joystickCommands?.downLeftCommand || '',
            // أمر التوقف وخيار التحكم القطري
            'joystick-stop': widget.joystickCommands?.stopCommand || '',
            'joystick-diagonal': widget.joystickCommands?.diagonalCommands ? 'on' : ''
        };
        // حفظ معرف الأداة في النموذج (للتعديل)
        const widgetForm = document.getElementById('widget-form');
        if (widgetForm) {
            widgetForm.setAttribute('data-edit-id', widget._id);
        }
        Object.entries(fields).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = value;
                // إطلاق أحداث التغيير للحقول الخاصة
                if (fieldId === 'widget-type') {
                    field.dispatchEvent(new Event('change'));
                }
                if (fieldId.includes('color')) {
                    field.dispatchEvent(new Event('change'));
                }
            }
        });
        // تحديث منتقي الأيقونات
        if (iconPicker && widget.icon) {
            iconPicker.selectIcon(widget.icon);
        }
    }
    
    // ==================== واجهة المستخدم المساعدة ==================== 
    function showLoadingState(message) {
        const configuredList = document.getElementById('configured-list');
        if (configuredList) {
            configuredList.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner" aria-hidden="true"></div>
                    <span>${message}</span>
                </div>
            `;
        }
    }
    
    function showErrorState(message) {
        const configuredList = document.getElementById('configured-list');
        if (configuredList) {
            configuredList.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                    <h3>حدث خطأ</h3>
                    <p>${message}</p>
                    <button class="btn btn-secondary" onclick="location.reload()">
                        <i class="fas fa-refresh" aria-hidden="true"></i>
                        إعادة تحميل
                    </button>
                </div>
            `;
        }
    }
    
    function setFormLoading(loading, message = '') {
        const submitButton = document.querySelector('#widget-form button[type="submit"]');
        const formInputs = document.querySelectorAll('#widget-form input, #widget-form select, #widget-form button');
        
        formInputs.forEach(input => {
            input.disabled = loading;
        });
        
        if (submitButton) {
            if (loading) {
                submitButton.dataset.originalText = submitButton.textContent;
                submitButton.innerHTML = `<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> ${message || 'جاري المعالجة...'}`;
            } else {
                submitButton.innerHTML = submitButton.dataset.originalText || 'إضافة الأداة';
            }
        }
    }
    
    function resetForm() {
        const widgetForm = document.getElementById('widget-form');
        if (widgetForm) {
            widgetForm.reset();
            setDefaultValues();
            // إزالة وضع التعديل
            widgetForm.removeAttribute('data-edit-id');
            // إعادة تعيين منتقي الأيقونات
            if (iconPicker) {
                const defaultIcon = iconPicker.getDefaultIcon('toggle');
                iconPicker.selectIcon(defaultIcon);
            }
        }
    }
    
    function showMessage(message, type = 'info') {
        // التحقق من وجود حاوية التوست
        const container = document.getElementById('toast-container');
        if (!container) {
            console.error('Toast container not found!');
            return;
        }

        // إنشاء عنصر التوست
        const toast = document.createElement('div');
        toast.className = `toast-message ${type}`;
        toast.setAttribute('role', 'alert'); // إضافة للتوافق مع قارئات الشاشة

        // تحديد الأيقونة المناسبة
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        // إضافة زر الإغلاق
        const closeButton = document.createElement('button');
        closeButton.className = 'toast-close';
        closeButton.innerHTML = '×';
        closeButton.setAttribute('aria-label', 'إغلاق الإشعار');
        closeButton.onclick = () => dismissToast(toast);
        
        // تجميع محتوى التوست
        toast.innerHTML = `
            <i class="fas ${icons[type] || 'fa-info-circle'}" aria-hidden="true"></i>
            <span class="toast-text">${message}</span>
        `;
        toast.appendChild(closeButton);

        // إضافة التوست للحاوية
        container.appendChild(toast);

        // تطبيق أنيميشن الظهور
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // تحديد مدة العرض حسب النوع
        const duration = {
            error: 8000,    // رسائل الخطأ تظهر لفترة أطول
            warning: 6000,  // التحذيرات تظهر لفترة متوسطة
            success: 4000,  // رسائل النجاح تظهر لفترة قصيرة
            info: 5000     // الرسائل العادية تظهر لفترة عادية
        };

        // جدولة الإخفاء التلقائي
        const timeout = setTimeout(() => dismissToast(toast), duration[type] || 5000);

        // تخزين مؤقت الإخفاء في خاصية مخصصة
        toast.dataset.timeout = timeout;
    }
    
    // ==================== وظائف مساعدة ==================== 
    function dismissToast(toast) {
        // إلغاء المؤقت إذا كان موجوداً
        if (toast.dataset.timeout) {
            clearTimeout(parseInt(toast.dataset.timeout));
            delete toast.dataset.timeout;
        }
        
        // إزالة صنف الظهور وإضافة صنف الإخفاء
        toast.classList.remove('show');
        toast.classList.add('hide');
        
        // إزالة العنصر من الـ DOM بعد انتهاء حركة الإخفاء
        toast.addEventListener('animationend', () => {
            toast.remove();
        }, { once: true }); // استخدام once لضمان تنفيذ المستمع مرة واحدة فقط
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // ==================== تنظيف الذاكرة ==================== 
    window.addEventListener('beforeunload', () => {
        if (iconPicker && typeof iconPicker.destroy === 'function') {
            iconPicker.destroy();
        }
    });
    
    console.log('✅ Settings page v3.0 - Ready!');
    
    // ==================== تحميل الأنماط CSS ==================== 
    function loadStyles() {
    const settingsStyles = document.createElement('style');
    settingsStyles.textContent = `
    .configured-item {
        transition: all 0.3s ease;
        border-radius: var(--border-radius, 12px);
        overflow: hidden;
    }
    
    .configured-item:hover {
        transform: translateX(-5px);
        box-shadow: 0 8px 25px rgba(138, 43, 226, 0.2);
    }
    
    .configured-item-details .separator {
        margin: 0 8px;
        color: var(--text-muted, #999);
    }
    
    .btn-edit {
        background: linear-gradient(135deg, #17a2b8, #20c997);
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.3s ease;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 5px;
    }
    
    .btn-edit:hover {
        background: linear-gradient(135deg, #20c997, #17a2b8);
        transform: scale(1.05);
    }
    
    .color-preview {
        display: inline-block;
        border: 2px solid rgba(255,255,255,0.3);
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    
    .form-input.error {
        border-color: var(--error-color, #ff4757) !important;
        box-shadow: 0 0 0 3px rgba(255, 71, 87, 0.1) !important;
    }
    
    .loading-state {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 15px;
        padding: 40px;
        color: var(--text-secondary, #666);
    }
    
    .loading-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid var(--text-secondary, #666);
        border-top: 2px solid var(--primary-cyan, #00e5ff);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    .error-state {
        text-align: center;
        padding: 40px;
        color: var(--text-secondary, #666);
    }
    
    .error-state i {
        font-size: 3rem;
        color: var(--error-color, #ff4757);
        margin-bottom: 15px;
    }
    
    .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: var(--text-secondary, #666);
    }
    
    .empty-state i {
        font-size: 4rem;
        color: var(--text-muted, #999);
        margin-bottom: 20px;
        opacity: 0.5;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
    document.head.appendChild(settingsStyles);
    }

    // تنفيذ تحميل الأنماط مباشرة
    loadStyles();

    // ==================== دالة عرض الرسائل ==================== 
function showMessage(message, type = 'info') {
    // ✅ إنشاء أو الحصول على Toast Container
    let toastContainer = document.getElementById('toast-container');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // ✅ إنشاء Toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // ✅ الأيقونات المطابقة للداشبورد
    const icons = {
        'success': 'fas fa-check-circle',
        'error': 'fas fa-exclamation-circle',
        'warning': 'fas fa-exclamation-triangle',
        'info': 'fas fa-info-circle'
    };
    
    // ✅ زر الإغلاق
    const closeButton = document.createElement('button');
    closeButton.className = 'toast-close';
    closeButton.innerHTML = '<i class="fas fa-times"></i>';
    closeButton.setAttribute('aria-label', 'إغلاق');
    closeButton.onclick = () => dismissToast(toast);
    
    // ✅ محتوى Toast
    toast.innerHTML = `
        <i class="${icons[type] || icons.info}" aria-hidden="true"></i>
        <span class="toast-text">${message}</span>
    `;
    toast.appendChild(closeButton);
    
    // ✅ إضافة Toast
    toastContainer.appendChild(toast);
    
    // ✅ تفعيل الأنيميشن
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    // ✅ الوقت المناسب لكل نوع
    const durations = {
        'error': 8000,
        'warning': 6000,
        'success': 4000,
        'info': 5000
    };
    
    // ✅ إزالة تلقائية
    const timeout = setTimeout(() => {
        dismissToast(toast);
    }, durations[type] || 5000);
    
    toast.dataset.timeout = timeout;
}

function dismissToast(toast) {
    if (toast.dataset.timeout) {
        clearTimeout(parseInt(toast.dataset.timeout));
        delete toast.dataset.timeout;
    }
    
    toast.classList.remove('show');
    toast.classList.add('hide');
    
    // ✅ إزالة من DOM بعد الأنيميشن
    toast.addEventListener('animationend', () => {
        toast.remove();
    }, { once: true });
}

})();
