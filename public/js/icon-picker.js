// public/js/icon-picker.js - نسخة مُحدّثة مع إصلاح مشاكل العرض
// حماية التعريف من التكرار
if (typeof window.IconPicker === 'undefined') {
    window.IconPicker = class IconPicker {
        constructor(inputElement, widgetType = 'toggle') {
            this.input = inputElement;
            this.widgetType = widgetType;
            this.isOpen = false;
            this.selectedIcon = inputElement.value || this.getDefaultIcon(widgetType);
            
            // مجموعة أيقونات مُحدّثة ومُصنّفة
            this.icons = {
                toggle: [
                    'fas fa-toggle-on', 'fas fa-toggle-off', 'fas fa-power-off',
                    'fas fa-lightbulb', 'fas fa-plug', 'fas fa-wifi',
                    'fas fa-bluetooth', 'fas fa-battery-full', 'fas fa-tv',
                    'fas fa-desktop', 'fas fa-mobile-alt', 'fas fa-laptop',
                    'fas fa-fan', 'fas fa-thermometer-half', 'fas fa-snowflake',
                    'fas fa-fire', 'fas fa-lock', 'fas fa-unlock',
                    'fas fa-door-open', 'fas fa-door-closed', 'fas fa-eye',
                    'fas fa-eye-slash', 'fas fa-volume-up', 'fas fa-volume-mute',
                    'fas fa-home', 'fas fa-car', 'fas fa-bell',
                'fas fa-bell-slash', 'fas fa-moon', 'fas fa-sun'
            ],
            
            push: [
                'fas fa-hand-pointer', 'fas fa-mouse-pointer', 'fas fa-touch',
                'fas fa-play', 'fas fa-stop', 'fas fa-pause',
                'fas fa-step-forward', 'fas fa-step-backward', 'fas fa-fast-forward',
                'fas fa-fast-backward', 'fas fa-eject', 'fas fa-random',
                'fas fa-repeat', 'fas fa-volume-up', 'fas fa-volume-down',
                'fas fa-plus', 'fas fa-minus', 'fas fa-times',
                'fas fa-check', 'fas fa-arrow-up', 'fas fa-arrow-down',
                'fas fa-arrow-left', 'fas fa-arrow-right', 'fas fa-undo',
                'fas fa-redo', 'fas fa-refresh', 'fas fa-sync'
            ],
            
            sensor: [
                'fas fa-thermometer-half', 'fas fa-tint', 'fas fa-eye',
                'fas fa-wifi', 'fas fa-battery-three-quarters', 'fas fa-heartbeat',
                'fas fa-tachometer-alt', 'fas fa-weight', 'fas fa-ruler',
                'fas fa-compass', 'fas fa-location-arrow', 'fas fa-clock',
                'fas fa-sun', 'fas fa-moon', 'fas fa-cloud',
                'fas fa-wind', 'fas fa-fire', 'fas fa-snowflake',
                'fas fa-bolt', 'fas fa-radiation', 'fas fa-atom',
                'fas fa-magnet', 'fas fa-broadcast-tower', 'fas fa-satellite',
                'fas fa-microphone', 'fas fa-camera', 'fas fa-video'
            ],
            
            terminal: [
                'fas fa-terminal', 'fas fa-code', 'fas fa-laptop-code',
                'fas fa-server', 'fas fa-database', 'fas fa-cogs',
                'fas fa-microchip', 'fas fa-memory', 'fas fa-hdd',
                'fas fa-network-wired', 'fas fa-ethernet', 'fas fa-usb',
                'fas fa-keyboard', 'fas fa-mouse', 'fas fa-desktop',
                'fas fa-monitor', 'fas fa-bug', 'fas fa-wrench',
                'fas fa-tools', 'fas fa-hammer', 'fas fa-screwdriver',
                'fas fa-search', 'fas fa-filter', 'fas fa-sort'
            ],
            
            // ✅ إضافة أيقونات Slider
            slider: [
                'fas fa-sliders-h', 'fas fa-adjust', 'fas fa-balance-scale',
                'fas fa-tachometer-alt', 'fas fa-volume-up', 'fas fa-volume-down',
                'fas fa-sun', 'fas fa-moon', 'fas fa-lightbulb',
                'fas fa-thermometer-half', 'fas fa-fire', 'fas fa-snowflake',
                'fas fa-tint', 'fas fa-fan', 'fas fa-wind',
                'fas fa-gauge', 'fas fa-chart-line', 'fas fa-signal',
                'fas fa-wifi', 'fas fa-battery-half', 'fas fa-bolt',
                'fas fa-arrows-alt-h', 'fas fa-arrows-alt-v', 'fas fa-compress',
                'fas fa-expand', 'fas fa-level-up-alt', 'fas fa-level-down-alt'
            ],
            
            // ✅ إضافة أيقونات Joystick
            joystick: [
                'fas fa-gamepad', 'fas fa-arrows-alt', 'fas fa-compass',
                'fas fa-crosshairs', 'fas fa-map-marker-alt', 'fas fa-location-arrow',
                'fas fa-paper-plane', 'fas fa-rocket', 'fas fa-car',
                'fas fa-motorcycle', 'fas fa-bicycle', 'fas fa-walking',
                'fas fa-running', 'fas fa-helicopter', 'fas fa-plane',
                'fas fa-drone', 'fas fa-robot', 'fas fa-cog',
                'fas fa-steering-wheel', 'fas fa-directions', 'fas fa-route',
                'fas fa-arrow-circle-up', 'fas fa-arrow-circle-down', 'fas fa-arrow-circle-left',
                'fas fa-arrow-circle-right', 'fas fa-hand-point-up', 'fas fa-hand-point-down'
            ]
        };
        
        this.init();
    }
    
    getDefaultIcon(type) {
        const defaults = {
            'toggle': 'fas fa-toggle-on',
            'push': 'fas fa-hand-pointer',
            'sensor': 'fas fa-thermometer-half',
            'terminal': 'fas fa-terminal',
            'slider': 'fas fa-sliders-h',      // ✅ أيقونة افتراضية للـ Slider
            'joystick': 'fas fa-gamepad'       // ✅ أيقونة افتراضية للـ Joystick
        };
        
        return defaults[type] || 'fas fa-question-circle';
    }
    
    init() {
        this.createPickerButton();
        this.createPickerModal();
        this.updateInputDisplay();
        
        // إضافة أنماط CSS المطلوبة
        this.addRequiredStyles();
    }
    
    addRequiredStyles() {
        if (document.getElementById('icon-picker-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'icon-picker-styles';
        styles.textContent = `
            .icon-picker-container {
                position: relative;
                display: flex;
                align-items: center;
            }
            
            .icon-picker-button {
                position: absolute;
                left: 10px;
                top: 50%;
                transform: translateY(-50%);
                width: 45px;
                height: 45px;
                border: none;
                background: linear-gradient(135deg, #8A2BE2, #00e5ff);
                color: white;
                border-radius: 8px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.3rem;
                transition: all 0.3s ease;
                z-index: 10;
                box-shadow: 0 4px 15px rgba(138, 43, 226, 0.3);
            }
            
            .icon-picker-button:hover {
                transform: translateY(-50%) scale(1.1);
                box-shadow: 0 6px 20px rgba(138, 43, 226, 0.5);
                background: linear-gradient(135deg, #00e5ff, #8A2BE2);
            }
            
            .icon-picker-modal {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                background: rgba(0, 0, 0, 0.8) !important;
                backdrop-filter: blur(20px) !important;
                z-index: 99999 !important;
                display: none !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 20px !important;
                opacity: 0 !important;
                transition: opacity 0.3s ease !important;
            }
            
            .icon-picker-modal.show {
                display: flex !important;
                opacity: 1 !important;
            }
            
            .icon-picker-content {
                width: 100% !important;
                max-width: 600px !important;
                max-height: 90vh !important;
                background: rgba(21, 19, 44, 0.95) !important;
                backdrop-filter: blur(30px) !important;
                border: 1px solid rgba(138, 43, 226, 0.3) !important;
                border-radius: 18px !important;
                box-shadow: 0 25px 50px rgba(138, 43, 226, 0.5) !important;
                padding: 30px !important;
                position: relative !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 20px !important;
                transform: scale(0.9) translateY(20px) !important;
                transition: transform 0.3s ease !important;
            }
            
            .icon-picker-modal.show .icon-picker-content {
                transform: scale(1) translateY(0) !important;
            }
            
            .icon-picker-title {
                text-align: center !important;
                color: white !important;
                font-size: 1.5rem !important;
                font-weight: 600 !important;
                margin: 0 !important;
                background: linear-gradient(135deg, #8A2BE2, #00e5ff) !important;
                -webkit-background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
                background-clip: text !important;
            }
            
            .icon-picker-search {
                width: 100% !important;
                padding: 15px 20px !important;
                border: 2px solid rgba(138, 43, 226, 0.3) !important;
                border-radius: 12px !important;
                background: rgba(255, 255, 255, 0.1) !important;
                color: white !important;
                font-size: 1rem !important;
                outline: none !important;
                transition: all 0.3s ease !important;
            }
            
            .icon-picker-search:focus {
                border-color: #8A2BE2 !important;
                box-shadow: 0 0 0 3px rgba(138, 43, 226, 0.1) !important;
                background: rgba(255, 255, 255, 0.15) !important;
            }
            
            .icon-picker-search::placeholder {
                color: rgba(255, 255, 255, 0.6) !important;
            }
            
            .icon-picker-icons {
                display: grid !important;
                grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)) !important;
                gap: 15px !important;
                max-height: 400px !important;
                overflow-y: auto !important;
                padding: 10px !important;
                border-radius: 12px !important;
                background: rgba(0, 0, 0, 0.3) !important;
            }
            
            .icon-picker-item {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                height: 70px !important;
                border-radius: 12px !important;
                background: rgba(255, 255, 255, 0.1) !important;
                border: 2px solid rgba(255, 255, 255, 0.2) !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                position: relative !important;
                overflow: hidden !important;
            }
            
            .icon-picker-item::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
                transition: left 0.5s;
            }
            
            .icon-picker-item:hover::before {
                left: 100%;
            }
            
            .icon-picker-item i {
                font-size: 28px !important;
                color: white !important;
                transition: all 0.2s ease !important;
            }
            
            .icon-picker-item:hover {
                background: rgba(255, 255, 255, 0.2) !important;
                border-color: #8A2BE2 !important;
                transform: scale(1.1) !important;
                box-shadow: 0 8px 25px rgba(138, 43, 226, 0.4) !important;
            }
            
            .icon-picker-item:hover i {
                color: #00e5ff !important;
                transform: scale(1.1) !important;
            }
            
            .icon-picker-item.selected {
                background: linear-gradient(135deg, #8A2BE2, #00e5ff) !important;
                border-color: #00e5ff !important;
                transform: scale(1.05) !important;
                box-shadow: 0 0 20px rgba(138, 43, 226, 0.6) !important;
            }
            
            .icon-picker-item.selected i {
                color: white !important;
                transform: scale(1.1) !important;
            }
            
            .icon-picker-close {
                position: absolute !important;
                top: 15px !important;
                left: 15px !important;
                width: 40px !important;
                height: 40px !important;
                border-radius: 50% !important;
                background: rgba(255, 71, 87, 0.2) !important;
                border: 2px solid #ff4757 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: #ff4757 !important;
                cursor: pointer !important;
                font-size: 18px !important;
                transition: all 0.3s ease !important;
                z-index: 10 !important;
            }
            
            .icon-picker-close:hover {
                background: #ff4757 !important;
                color: white !important;
                transform: scale(1.1) rotate(90deg) !important;
                box-shadow: 0 4px 15px rgba(255, 71, 87, 0.4) !important;
            }
            
            .icon-picker-no-results {
                text-align: center !important;
                padding: 40px 20px !important;
                color: rgba(255, 255, 255, 0.7) !important;
                font-size: 1.1rem !important;
            }
            
            .icon-picker-no-results i {
                font-size: 3rem !important;
                color: rgba(255, 255, 255, 0.5) !important;
                margin-bottom: 15px !important;
                opacity: 0.5 !important;
            }
            
            /* تحسينات للأجهزة المحمولة */
            @media (max-width: 768px) {
                .icon-picker-content {
                    margin: 20px !important;
                    padding: 25px 20px !important;
                    max-height: 85vh !important;
                }
                
                .icon-picker-icons {
                    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)) !important;
                    gap: 12px !important;
                    max-height: 300px !important;
                }
                
                .icon-picker-item {
                    height: 60px !important;
                }
                
                .icon-picker-item i {
                    font-size: 24px !important;
                }
                
                .icon-picker-close {
                    top: 10px !important;
                    left: 10px !important;
                    width: 35px !important;
                    height: 35px !important;
                    font-size: 16px !important;
                }
            }
            
            /* شريط التمرير */
            .icon-picker-icons::-webkit-scrollbar {
                width: 8px !important;
            }
            
            .icon-picker-icons::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1) !important;
                border-radius: 10px !important;
            }
            
            .icon-picker-icons::-webkit-scrollbar-thumb {
                background: linear-gradient(135deg, #8A2BE2, #00e5ff) !important;
                border-radius: 10px !important;
            }
            
            .icon-picker-icons::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(135deg, #00e5ff, #8A2BE2) !important;
            }
        `;
        document.head.appendChild(styles);
    }
  createPickerButton() {
    // ✅ تحقق إذا الزر موجود مسبقاً - لا تضيفه مرة تانية
    if (this.input.parentNode.querySelector('.icon-picker-container')) {
        console.log('⚠️ Icon picker button already exists');
        return;
    }

    const container = document.createElement('div');
    container.className = 'icon-picker-container';
    
    this.input.setAttribute('readonly', true);
    this.input.style.cursor = 'pointer';
    this.input.style.paddingLeft = '60px';
    
    const iconButton = document.createElement('button');
    iconButton.type = 'button';
    iconButton.className = 'icon-picker-button';
    iconButton.innerHTML = `<i class="${this.selectedIcon}" aria-hidden="true"></i>`;
    iconButton.title = 'اختر أيقونة';
    
    // ✅ تأكد إن الزر بس يتضاف مرة واحدة
    this.input.parentNode.insertBefore(container, this.input);
    container.appendChild(this.input);
    container.appendChild(iconButton);
    
    [this.input, iconButton].forEach(element => {
        element.addEventListener('click', (e) => {
            e.preventDefault();
            this.togglePicker();
        });
    });
    
    console.log('✅ Icon picker button created');
}

    
    createPickerModal() {
        // إنشاء النافذة المنبثقة
        const modal = document.createElement('div');
        modal.className = 'icon-picker-modal';
        modal.style.display = 'none';
        
        // إنشاء المحتوى
        const content = document.createElement('div');
        content.className = 'icon-picker-content';
        
        // العنوان
        const title = document.createElement('h3');
        title.textContent = `اختر أيقونة للـ ${this.getTypeLabel(this.widgetType)}`;
        title.className = 'icon-picker-title';
        
        // حقل البحث
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'البحث عن أيقونة...';
        searchInput.className = 'icon-picker-search';
        
        // حاوية الأيقونات
        const iconsContainer = document.createElement('div');
        iconsContainer.className = 'icon-picker-icons';
        
        // زر الإغلاق
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'icon-picker-close';
        closeButton.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
        closeButton.title = 'إغلاق';
        
        // تجميع العناصر
        content.appendChild(closeButton);
        content.appendChild(title);
        content.appendChild(searchInput);
        content.appendChild(iconsContainer);
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // حفظ المراجع
        this.modal = modal;
        this.iconsContainer = iconsContainer;
        this.searchInput = searchInput;
        this.titleElement = title;
        
        // عرض الأيقونات وإضافة مستمعي الأحداث
        this.renderIcons();
        this.attachModalEvents(closeButton, searchInput);
        
        console.log('✅ تم إنشاء نافذة منتقي الأيقونات');
    }
    
    getTypeLabel(type) {
        const labels = {
            'toggle': 'اختر أيقونة التبديل',
            'push': 'اختر أيقونة الزر',
            'sensor': 'اختر أيقونة المستشعر',
            'terminal': 'اختر أيقونة الطرفية',
            'slider': 'اختر أيقونة السلايدر',      // ✅ إضافة
            'joystick': 'اختر أيقونة الجويستيك'    // ✅ إضافة
        };
        
        return labels[type] || 'اختر أيقونة';
    }
    
    renderIcons(filter = '') {
        const availableIcons = this.icons[this.widgetType] || this.icons.toggle;
        const filteredIcons = filter ? 
            availableIcons.filter(icon => 
                icon.toLowerCase().includes(filter.toLowerCase()) ||
                icon.replace('fas fa-', '').replace('-', ' ').includes(filter.toLowerCase())
            ) : 
            availableIcons;
        
        this.iconsContainer.innerHTML = '';
        
        if (filteredIcons.length === 0) {
            this.iconsContainer.innerHTML = `
                <div class="icon-picker-no-results">
                    <i class="fas fa-search" aria-hidden="true"></i>
                    <div>لم يتم العثور على أيقونات مطابقة</div>
                    <small>جرب مصطلحات بحث أخرى</small>
                </div>
            `;
            return;
        }
        
        filteredIcons.forEach(iconClass => {
            const iconElement = document.createElement('div');
            iconElement.className = 'icon-picker-item';
            
            if (iconClass === this.selectedIcon) {
                iconElement.classList.add('selected');
            }
            
            iconElement.innerHTML = `<i class="${iconClass}" aria-hidden="true"></i>`;
            iconElement.title = iconClass;
            iconElement.setAttribute('data-icon', iconClass);
            
            iconElement.addEventListener('click', () => {
                this.selectIcon(iconClass);
            });
            
            this.iconsContainer.appendChild(iconElement);
        });
        
        console.log(`📋 عرض ${filteredIcons.length} أيقونة`);
    }
    
    attachModalEvents(closeButton, searchInput) {
        // زر الإغلاق
        closeButton.addEventListener('click', () => this.closePicker());
        
        // النقر خارج المحتوى
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closePicker();
            }
        });
        
        // البحث
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.renderIcons(e.target.value);
            }, 300);
        });
        
        // مفتاح الهروب
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closePicker();
            }
        });
        
        console.log('✅ تم إعداد أحداث النافذة المنبثقة');
    }
    
    selectIcon(iconClass) {
        this.selectedIcon = iconClass;
        this.input.value = iconClass;
        this.updateInputDisplay();
        this.closePicker();
        
        // إطلاق حدث التغيير
        const event = new Event('change', { bubbles: true });
        this.input.dispatchEvent(event);
        
        console.log(`✅ تم اختيار الأيقونة: ${iconClass}`);
    }
    
    updateInputDisplay() {
        // تحديث زر الأيقونة
        const button = this.input.parentNode.querySelector('.icon-picker-button');
        if (button) {
            button.innerHTML = `<i class="${this.selectedIcon}" aria-hidden="true"></i>`;
        }
        
        // تحديث العرض في النافذة المنبثقة
        if (this.iconsContainer) {
            this.iconsContainer.querySelectorAll('.icon-picker-item').forEach(item => {
                item.classList.remove('selected');
                const iconData = item.getAttribute('data-icon');
                if (iconData === this.selectedIcon) {
                    item.classList.add('selected');
                }
            });
        }
    }
    
    togglePicker() {
        if (this.isOpen) {
            this.closePicker();
        } else {
            this.openPicker();
        }
    }
    
    openPicker() {
        if (!this.modal) {
            console.error('النافذة المنبثقة غير موجودة');
            return;
        }
        
        this.modal.style.display = 'flex';
        this.isOpen = true;
        
        // تأخير لضمان العرض
        setTimeout(() => {
            this.modal.classList.add('show');
            this.searchInput.focus();
        }, 10);
        
        document.body.style.overflow = 'hidden';
        console.log('📖 فتح منتقي الأيقونات');
    }
    
    closePicker() {
        if (!this.modal) return;
        
        this.modal.classList.remove('show');
        this.isOpen = false;
        
        setTimeout(() => {
            this.modal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
        
        // مسح البحث
        this.searchInput.value = '';
        this.renderIcons();
        
        console.log('📕 إغلاق منتقي الأيقونات');
    }
    
    updateWidgetType(newType) {
        this.widgetType = newType;
        
        if (this.titleElement) {
            this.titleElement.textContent = `اختر أيقونة للـ ${this.getTypeLabel(newType)}`;
        }
        
        if (this.isOpen) {
            this.renderIcons();
        }
        
        console.log(`🔄 تحديث نوع الأداة إلى: ${newType}`);
    }
    
    // تدمير منتقي الأيقونات
    destroy() {
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
        
        const styles = document.getElementById('icon-picker-styles');
        if (styles) {
            styles.remove();
        }
        
        console.log('🗑️ تم تدمير منتقي الأيقونات');
    }
    };
}

// وظيفة التهيئة العامة
function initIconPicker(inputElement, widgetType = 'toggle') {
    if (!inputElement) {
        console.error('عنصر الإدخال مطلوب لمنتقي الأيقونات');
        return null;
    }
    
    return new window.IconPicker(inputElement, widgetType);
}

// تصدير للاستخدام العام
window.IconPicker = IconPicker;
window.initIconPicker = initIconPicker;

console.log('✅ منتقي الأيقونات جاهز للاستخدام');
