// dashboard.js - الإصدار المُحسن لإصلاح مشاكل الحساسات والترمينال
(function() {
    'use strict';

    // Debounce utility function
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

    console.log('🚀 بدء تحميل dashboard.js - الإصدار المُصحح');

    // === التحقق من المصادقة ===
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('❌ لا يوجد توكن، إعادة توجيه إلى صفحة تسجيل الدخول');
        window.location.href = '/';
        return;
    }

    // === المتغيرات العامة ===
    let widgets = [];
    let isEditMode = false;
    let isInitialized = false;
    let refreshInterval = null;
    let socket = null;
    let currentUser = null;
    let gridStack = null;
    let terminalHistory = new Map();
    let lastSyncTime = null;
    let sensorIntervals = new Map(); // مؤقتات الحساسات
    let terminalIntervals = new Map(); // مؤقتات الترمينال
    let socketReconnectAttempts = 0;
    let maxReconnectAttempts = 10;

    // === بدء التهيئة ===
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeDashboard);
    } else {
        initializeDashboard();
    }

    // === دالة تهيئة لوحة التحكم ===
    async function initializeDashboard() {
        if (isInitialized) return;
        isInitialized = true;

        console.log('🔄 بدء تهيئة لوحة التحكم المُحسّنة');

        try {
            showLoadingOverlay();
            await loadUserData();
            createMessageContainer();
            setupGridContainer();
            initializeSocket();
            await loadWidgets();
            await loadUserStats();
            setupEventListeners();
            initializeTheme();
            setupEditMode();
            setupAutoRefresh();
            hideLoadingOverlay();
            console.log('✅ تم تهيئة لوحة التحكم بنجاح');
            showMessage('تم تحميل لوحة التحكم بنجاح', 'success');
        } catch (error) {
            console.error('❌ خطأ في تهيئة لوحة التحكم:', error);
            hideLoadingOverlay();
            showMessage('خطأ في تحميل لوحة التحكم', 'error');
        }
    }

    // === تحميل بيانات المستخدم ===
    async function loadUserData() {
        try {
            const response = await fetch('/api/user/me', {
                headers: { 'x-auth-token': token }
            });

            if (response.ok) {
                currentUser = await response.json();
                updateUserDisplay();
                console.log('✅ تم تحميل بيانات المستخدم:', currentUser.username);
            } else {
                throw new Error('فشل في تحميل بيانات المستخدم');
            }
        } catch (error) {
            console.error('❌ خطأ في تحميل بيانات المستخدم:', error);
            localStorage.removeItem('token');
            window.location.href = '/';
        }
    }

  function setupGridContainer() {
  const gridContainer = document.getElementById('widgets-grid');
  if (!gridContainer) {
    console.error('Grid container not found');
    return;
  }

  try {
    const isMobile = window.innerWidth <= 768;
    
    gridStack = GridStack.init({
      column: isMobile ? 6 : 12, // 6 columns on mobile for proportion (so width 3 = 50% width)
      cellHeight: isMobile ? 100 : 120,
      verticalMargin: isMobile ? 10 : 20,
      horizontalMargin: isMobile ? 10 : 20,
      animate: true,
      float: false,
      removable: false,
      disableOneColumnMode: true, // Disable 1-column lock so multi-column widths work
      // تحسينات للموبايل
      resizable: {
        handles: isMobile ? 'se, sw' : 'se, sw, ne, nw', // Native big corner handles handle both W and H
        autoHide: true
      },
      draggable: {
        handle: '.widget-header',
        appendTo: 'body',
        scroll: true, 
        scrollSensitivity: 50,
        scrollSpeed: 20
      }
    }, gridContainer);

    console.log('GridStack initialized successfully');
  } catch (error) {
    console.error('GridStack initialization error:', error);
  }
}


    // === إنشاء حاوية الشبكة إذا لم تكن موجودة ===
    function createGridContainer() {
        const widgetsSection = document.querySelector('.widgets-section');
        if (!widgetsSection) {
            console.error('❌ قسم الويدجتس غير موجود');
            return;
        }

        const gridContainer = document.createElement('div');
        gridContainer.id = 'widgets-grid';
        gridContainer.className = 'grid-stack';

        const existingGrid = widgetsSection.querySelector('#widgets-grid');
        if (existingGrid) {
            existingGrid.replaceWith(gridContainer);
        } else {
            widgetsSection.appendChild(gridContainer);
        }

        console.log('✅ تم إنشاء حاوية الشبكة');
    }

    // === تهيئة Socket.IO مع إعادة الاتصال التلقائي ===
    function initializeSocket() {
        try {
            if (typeof io === 'undefined') {
                console.error('❌ مكتبة Socket.IO غير محملة');
                return;
            }

            socket = io({
                transports: ['websocket', 'polling'],
                timeout: 20000,
                forceNew: true,
                reconnection: true,
                reconnectionAttempts: maxReconnectAttempts,
                reconnectionDelay: 2000,
                reconnectionDelayMax: 10000
            });

            socket.on('connect', () => {
                console.log('✅ تم الاتصال بـ Socket.IO');
                updateConnectionStatus(true);
                socketReconnectAttempts = 0;
                if (currentUser) {
                    socket.emit('join-user-room', currentUser.id || currentUser._id);
                }
                // إعادة اشتراك في جميع الحساسات
                widgets.filter(w => w.type === 'sensor').forEach(w => {
                    socket.emit('subscribe-sensor', w.id || w._id);
                });
            });

            socket.on('disconnect', () => {
                console.log('❌ انقطع الاتصال مع Socket.IO');
                updateConnectionStatus(false);
            });

            socket.on('reconnect', (attemptNumber) => {
                console.log(`✅ إعادة الاتصال بـ Socket.IO (المحاولة ${attemptNumber})`);
                updateConnectionStatus(true);
                socketReconnectAttempts = 0;
            });

            socket.on('reconnect_failed', () => {
                console.error('❌ فشل في إعادة الاتصال بـ Socket.IO');
                updateConnectionStatus(false);
                showMessage('فشل في إعادة الاتصال بالخادم', 'error');
            });

            socket.on('connect_error', (error) => {
                console.error('❌ خطأ في الاتصال بـ Socket.IO:', error);
                updateConnectionStatus(false);
                socketReconnectAttempts++;
                if (socketReconnectAttempts >= maxReconnectAttempts) {
                    showMessage('فشل في الاتصال بالخادم', 'error');
                }
            });

            // أحداث الويدجتس
            socket.on('widget-added', (widget) => {
                console.log('📡 تم إضافة ويدجت جديد:', widget);
                widgets.push(widget);
                addWidgetToGrid(widget);
                updateStats();
                startWidgetMonitoring(widget);
            });

            socket.on('widget-deleted', (data) => {
                console.log('📡 تم حذف ويدجت:', data);
                widgets = widgets.filter(w => (w.id || w._id) !== data.widgetId);
                removeWidgetFromGrid(data.widgetId);
                updateStats();
                stopWidgetMonitoring(data.widgetId);
            });

            socket.on('widget-status-update', (data) => {
                console.log('📡 تحديث حالة ويدجت:', data);
                updateWidgetStatus(data.widgetId, data);
            });

            // أحداث الحساسات
            socket.on('sensor-data', (data) => {
                console.log('📡 بيانات حساس جديدة:', data);
                updateSensorData(data.widgetId, data);
            });

            // أحداث الترمينال
            socket.on('terminal-message', (data) => {
                console.log('📡 رسالة ترمنال جديدة:', data);
                appendTerminalMessage(data.widgetId, data.message, data.type, data.timestamp);
            });

            socket.on('terminal-messages', (data) => {
                console.log('📡 رسائل ترمنال متعددة:', data);
                if (data.messages && data.messages.length > 0) {
                    const outputElement = document.querySelector(`#terminal-${data.widgetId}`);
                    if (outputElement) {
                        outputElement.innerHTML = '<div class="terminal-line">جاهز للأوامر...</div>';
                        data.messages.forEach(msg => {
                            appendTerminalMessage(data.widgetId, msg.message, msg.type, msg.timestamp);
                        });
                    }
                }
            });

            socket.on('new-notification', (data) => {
                console.log('🔔 إشعار جديد:', data);
                // Optional: show via a custom toast
                if (window.showToast) {
                    window.showToast(data.title, 'info');
                } else {
                    alert(`${data.title}\n${data.message}`);
                }
            });

            console.log('✅ تم تهيئة Socket.IO بنجاح');

        } catch (error) {
            console.error('❌ خطأ في تهيئة Socket.IO:', error);
        }
    }

    // === تحميل الويدجتس ===
    async function loadWidgets() {
        try {
            showMessage('جاري تحميل الأدوات...', 'info');

            const response = await fetch('/api/widgets', {
                headers: { 'x-auth-token': token }
            });

            if (response.ok) {
                widgets = await response.json();
                displayWidgets();
                updateStats();
                console.log(`✅ تم تحميل ${widgets.length} ويدجت`);
                
                // بدء مراقبة كل ويدجت
                widgets.forEach(widget => {
                    startWidgetMonitoring(widget);
                });
            } else {
                throw new Error('فشل في تحميل الأدوات');
            }
        } catch (error) {
            console.error('❌ خطأ في تحميل الأدوات:', error);
            showMessage('خطأ في تحميل الأدوات', 'error');
        }
    }

    // === بدء مراقبة الويدجت حسب النوع ===
    function startWidgetMonitoring(widget) {
        if (widget.type === 'sensor') {
            startSensorMonitoring(widget);
        } else if (widget.type === 'terminal') {
            startTerminalMonitoring(widget);
        }
    }

    // === إيقاف مراقبة الويدجت ===
    function stopWidgetMonitoring(widgetId) {
        // إيقاف مراقبة الحساس
        if (sensorIntervals.has(widgetId)) {
            clearInterval(sensorIntervals.get(widgetId));
            sensorIntervals.delete(widgetId);
        }
        
        // إيقاف مراقبة الترمينال
        if (terminalIntervals.has(widgetId)) {
            clearInterval(terminalIntervals.get(widgetId));
            terminalIntervals.delete(widgetId);
        }
    }

    // === مراقبة الحساسات (جلب البيانات كل ثانية) ===
    function startSensorMonitoring(widget) {
        // استخدم widget.id (Firebase) أو widget._id (MongoDB)
        const widgetId = widget.id || widget._id;
        
        // إيقاف المراقبة السابقة إن وجدت
        if (sensorIntervals.has(widgetId)) {
            clearInterval(sensorIntervals.get(widgetId));
        }

        // جلب البيانات الأولى
        fetchSensorData(widgetId);

        // بدء المراقبة المستمرة
        const intervalId = setInterval(() => {
            fetchSensorData(widgetId);
        }, 1000); // كل ثانية

        sensorIntervals.set(widgetId, intervalId);
        console.log(`🔄 بدء مراقبة الحساس: ${widget.name}`);
    }

    // === جلب بيانات الحساس ===
    async function fetchSensorData(widgetId) {
        try {
            const response = await fetch(`/api/sensors/${widgetId}/data`, {
                headers: { 'x-auth-token': token }
            });

            if (response.ok) {
                const data = await response.json();
                updateSensorData(widgetId, data);
            } else if (response.status === 404) {
                console.warn(`⚠️ لم يتم العثور على بيانات الحساس: ${widgetId}`);
            }
        } catch (error) {
            console.error(`❌ خطأ في جلب بيانات الحساس ${widgetId}:`, error);
        }
    }

    // === تحديث بيانات الحساس ===
    function updateSensorData(widgetId, data) {
        const widget = widgets.find(w => (w.id || w._id) === widgetId);
        if (!widget) return;

        // تحديث حالة الويدجت
        widget.state = {
            ...widget.state,
            isActive: data.isActive || false,
            lastValue: data.value || data.lastValue || '--',
            lastUpdate: data.timestamp || data.lastUpdate || new Date()
        };

        // تحديث العرض
        updateWidgetStatus(widgetId, widget.state);
    }

    // === مراقبة الترمينال (جلب الرسائل كل ثانية) ===
    function startTerminalMonitoring(widget) {
        // استخدم widget.id (Firebase) أو widget._id (MongoDB)
        const widgetId = widget.id || widget._id;
        
        // إيقاف المراقبة السابقة إن وجدت
        if (terminalIntervals.has(widgetId)) {
            clearInterval(terminalIntervals.get(widgetId));
        }

        // جلب الرسائل الأولى
        loadTerminalMessages(widgetId, 50);

        const intervalId = setInterval(() => {
            loadTerminalMessages(widgetId, 50, true);
        }, 5000); // كل 5 ثواني
        
        terminalIntervals.set(widgetId, intervalId);
        console.log(`🔄 بدء مراقبة الترمينال: ${widget.name}`);
    }

    // === جلب رسائل الترمينال ===
    async function loadTerminalMessages(widgetId, limit = 50) {
        try {
            const response = await fetch(`/api/terminals/${widgetId}/messages?limit=${limit}`, {
                headers: { 'x-auth-token': token }
            });

            if (response.ok) {
                const messages = await response.json();
                updateTerminalMessages(widgetId, messages);
            } else if (response.status === 404) {
                console.warn(`⚠️ لم يتم العثور على رسائل الترمينال: ${widgetId}`);
            }
        } catch (error) {
            console.error(`❌ خطأ في جلب رسائل الترمينال ${widgetId}:`, error);
        }
    }

    // === تحديث رسائل الترمينال ===
    function updateTerminalMessages(widgetId, messages) {
        const outputElement = document.querySelector(`#terminal-${widgetId}`);
        if (!outputElement) return;

        // لا تقم بمسح المحتوى الحالي
        // outputElement.innerHTML = ''; <-- حذف هذا السطر

        // إضافة الرسائل الجديدة فقط (الدالة الذكية ستمنع التكرار)
        messages.forEach(msg => {
            appendTerminalMessage(widgetId, msg.message, msg.type, msg.timestamp);
        });

        // تحديث التاريخ المحفوظ
        terminalHistory.set(widgetId, messages);
    }

    // === عرض الويدجتس ===
    function displayWidgets() {
        const gridContainer = document.getElementById('widgets-grid');
        const emptyState = document.getElementById('empty-state');

        if (!gridContainer) {
            console.error('❌ حاوية الشبكة غير موجودة');
            return;
        }

        if (gridStack) {
            gridStack.removeAll();
        }

        if (widgets.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            if (gridContainer) gridContainer.style.display = 'none';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        if (gridContainer) gridContainer.style.display = 'block';

        widgets.forEach((widget, index) => {
            addWidgetToGrid(widget, index);
        });

        console.log(`✅ تم عرض ${widgets.length} ويدجت`);
    }

    // === إضافة ويدجت للشبكة ===
    function addWidgetToGrid(widget, index = 0) {
        if (!gridStack) {
            console.error('❌ GridStack غير مهيأ');
            return;
        }

        const widgetElement = createWidgetElement(widget);
        const x = (index * 3) % 12;
        const y = Math.floor((index * 3) / 12) * 3;
        const w = getWidgetWidth(widget.type);
        const h = getWidgetHeight(widget.type);
        // استخدم widget.id (Firebase) أو widget._id (MongoDB) بناءً على ما هو متاح
        const widgetId = widget.id || widget._id;

        gridStack.addWidget(widgetElement, { x, y, w, h, id: widgetId });
        attachWidgetEvents(widgetElement, widget);
    }

    // === إنشاء عنصر الويدجت ===
    function createWidgetElement(widget) {
        const widgetElement = document.createElement('div');
        widgetElement.className = `grid-stack-item widget-item widget-${widget.type}`;
        // استخدم widget.id (Firebase) أو widget._id (MongoDB) بناءً على ما هو متاح
        const widgetId = widget.id || widget._id;
        widgetElement.dataset.widgetId = widgetId;
        widgetElement.setAttribute('gs-id', widgetId);
        widgetElement.setAttribute('data-id', widgetId);

        const content = document.createElement('div');
        content.className = 'grid-stack-item-content widget-content';
        content.innerHTML = generateWidgetHTML(widget);
        widgetElement.appendChild(content);

        return widgetElement;
    }

   function generateWidgetHTML(widget) {
    const isActive = widget.state?.isActive || false;
    const lastValue = widget.state?.lastValue || '--';
    const statusClass = isActive ? 'active' : 'inactive';

    let bodyHTML = '';

    // الهيكل الأساسي الثابت الذي يحتوي على الأيقونة والاسم
    const baseHTML = `
        <div class="widget-header" style="width:100%;justify-content:center;align-items:center;flex-direction:column;gap:4px;">
            <div class="widget-icon" style="display:flex;justify-content:center;align-items:center;">
                <i class="${widget.icon}" style="color: ${widget.appearance.primaryColor}; font-size:2.2rem;"></i>
            </div>
            <div class="widget-info" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
                <h3 class="widget-title" style="color:#fff;font-size:1.25rem;font-weight:700;margin:0;">${widget.name}</h3>
                <span class="widget-feed-name">${widget.feedName}</span>
            </div>
        </div>
        <div class="widget-body ${statusClass}" style="width:100%;height:100%;padding:0;display:flex;align-items:center;justify-content:center;">
    `;

    // بناء المحتوى الداخلي (الجزء المتغير) بناءً على نوع الأداة
    switch (widget.type) {
        
        // ... (الأكواد الخاصة بـ toggle, push, sensor, slider تبقى كما هي)
        
        case 'toggle': {
            const onLabel = widget.configuration?.onCommand || 'تشغيل';
            const offLabel = widget.configuration?.offCommand || 'إيقاف';
            const statusLabel = isActive ? onLabel : offLabel;
            bodyHTML = `
                    <button class="toggle-btn ${isActive ? 'active' : ''}"
                        data-action="toggle"
                        style="background: ${isActive ? widget.appearance.activeColor : widget.appearance.primaryColor}; border-color: ${widget.appearance.primaryColor}; width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,0.15);font-size:1.3rem;font-weight:700;color:#fff;letter-spacing:0.5px;cursor:pointer;border:none;outline:none;transition:all 0.2s;user-select:none;padding:0;">
                        <span class="toggle-status" style="font-size:0.95rem;font-weight:700;color:#fff;margin-top:0;">${statusLabel}</span>
                    </button>
            `;
            break;
        }

        case 'push':
            bodyHTML = `
                <button class="push-btn ${isActive ? 'active' : ''}" 
                    data-action="push"
                    style="background: ${widget.appearance.primaryColor}; border-color: ${widget.appearance.primaryColor}; width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,0.15);font-size:1.3rem;font-weight:700;color:#fff;letter-spacing:0.5px;cursor:pointer;border:none;outline:none;transition:all 0.2s;user-select:none;padding:0;">
                    <i class="${widget.icon}" style="font-size:2.2rem;margin-bottom:4px;"></i>
                    <span style="font-size:1.25rem;font-weight:700;">${widget.name}</span>
                    <span class="widget-feed-name" style="font-size:0.95rem;font-weight:400;color:#e0e0e0;margin-top:0;">${widget.feedName}</span>
                </button>
            `;
            break;

        case 'slider':
            const config = widget.configuration || {};
            const minValue = config.min ?? 0;
            const maxValue = config.max ?? 100;
            const step = config.step ?? 1;
            const defaultValue = config.defaultValue ?? 50;
            const currentValue = widget.state?.lastValue ?? defaultValue;
            const valueDisplayHTML = `<div class="slider-value-display" style="font-size:1.5rem;font-weight:700;color:#fff;"><span class="value">${currentValue}</span></div>`;

            bodyHTML = `
                <div class="slider-container" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;">
                    ${valueDisplayHTML}
                    <div class="slider-control" style="width:100%;display:flex;align-items:center;gap:12px;">
                        <span class="min-value" style="color:#aaa;font-size:0.9rem;">${minValue}</span>
                        <input type="range" class="slider-input" data-action="slide" min="${minValue}" max="${maxValue}" step="${step}" value="${currentValue}" style="flex:1;">
                        <span class="max-value" style="color:#aaa;font-size:0.9rem;">${maxValue}</span>
                    </div>
                </div>
            `;
            break;

        case 'sensor':
            bodyHTML = `
                <div class="sensor-display" style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;">
                    <div class="sensor-value">
                        <span class="value">${lastValue}</span>
                        <span class="unit">${widget.configuration.unit || ''}</span>
                    </div>
                    <div class="sensor-status">
                        <div class="status-indicator ${isActive ? 'active' : 'inactive'}"></div>
                        <span>آخر قراءة: ${formatLastUpdate(widget.state?.lastUpdate)}</span>
                    </div>
                </div>
            `;
            break;

        // -->> هذا هو الجزء المهم الخاص بالجويستيك <<--
        case 'joystick':
            bodyHTML = `
                <div class="joystick-container">
                    <div class="joystick-base">
                        <div class="joystick-stick"></div>
                    </div>
                    <div class="joystick-indicators">
                        <div class="direction-indicator up" data-direction="up"></div>
                        <div class="direction-indicator up-right" data-direction="up-right"></div>
                        <div class="direction-indicator right" data-direction="right"></div>
                        <div class="direction-indicator down-right" data-direction="down-right"></div>
                        <div class="direction-indicator down" data-direction="down"></div>
                        <div class="direction-indicator down-left" data-direction="down-left"></div>
                        <div class="direction-indicator left" data-direction="left"></div>
                        <div class="direction-indicator up-left" data-direction="up-left"></div>
                    </div>
                </div>
            `;
            break;
        
        case 'terminal':
             bodyHTML = `
                <div class="terminal-display">
                    <div class="terminal-output" id="terminal-${widget.id || widget._id}">
                        <div class="terminal-line"> جاهز للأوامر...</div>
                    </div>
                    <div class="terminal-input">
                        <span class="prompt">$</span>
                        <input type="text" class="terminal-cmd" placeholder="أدخل الأمر..." />
                        <button class="terminal-send" data-action="send"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>
            `;
            break;

        default:
            bodyHTML = '<span>نوع أداة غير معروف</span>';
    }

    // دمج الهيكل الأساسي مع المحتوى وإغلاق الوسوم
    return baseHTML + bodyHTML + '</div>';
}

    // === ربط أحداث الويدجت ===
    function attachWidgetEvents(widgetElement, widget) {
        const widgetContent = widgetElement.querySelector('.widget-content');
        const floatingBtns = widgetContent.querySelectorAll('.widget-action-btn, .widget-actions');
        floatingBtns.forEach(btn => btn.remove());

        // Event handler for all click events
        widgetContent.addEventListener('click', async (e) => {
            e.stopPropagation();

            const action = e.target.closest('[data-action]')?.dataset.action;
            if (!action) return;

            switch (action) {
                case 'toggle':
                    await handleToggleAction(widget);
                    break;
                case 'push':
                    await handlePushAction(widget);
                    break;
                case 'delete':
                    await handleDeleteAction(widget);
                    break;
                case 'clear':
                    handleTerminalClear(widget);
                    break;
                case 'refresh':
                    await handleTerminalRefresh(widget);
                    break;
                case 'send':
                    await handleTerminalSend(widget, widgetElement);
                    break;
            }
        });

        // Add slider event handling if this is a slider widget
        if (widget.type === 'joystick') {
            const joystickContainer = widgetContent.querySelector('.joystick-container');
            const joystickBase = widgetContent.querySelector('.joystick-base');
            const joystickStick = widgetContent.querySelector('.joystick-stick');
            const directionIndicators = widgetContent.querySelectorAll('.direction-indicator');
            
            if (joystickContainer && joystickBase && joystickStick) {
                let isDragging = false;
                let centerX, centerY, maxDistance;
                let lastSentCommand = null;
                let lastAngle = 0;
                
                // حساب المركز والحد الأقصى للمسافة
                const updateBounds = () => {
                    const rect = joystickBase.getBoundingClientRect();
                    centerX = rect.left + rect.width / 2;
                    centerY = rect.top + rect.height / 2;
                    maxDistance = (rect.width / 2) - (joystickStick.offsetWidth / 2);
                };

                // إرسال الأوامر
                const sendCommand = async (command) => {
                    if (!command || command === lastSentCommand) return;
                    lastSentCommand = command;
                    
                    try {
                        const response = await fetch('/api/command/send', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-auth-token': token
                            },
                            body: JSON.stringify({
                                widgetId: widget.id || widget._id,
                                value: command
                            })
                        });

                        if (!response.ok) {
                            throw new Error('فشل إرسال الأمر');
                        }

                    } catch (error) {
                        console.error('خطأ في إرسال أمر الجويستيك:', error);
                        showMessage('فشل في إرسال الأمر', 'error');
                    }
                };

 const updateDirectionIndicators = (dx, dy) => {
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // إذا كانت المسافة قليلة جداً، لا تُضيء أي نقطة
    if (distance < 15) {
        directionIndicators.forEach(indicator => {
            indicator.classList.remove('active');
        });
        return;
    }
    
    directionIndicators.forEach(indicator => {
        const direction = indicator.dataset.direction;
        let isActive = false;
        
        // حساب دقيق للاتجاهات القطرية أولاً (لها أولوية)
        switch(direction) {
            case 'up-right':
                isActive = (angle >= -67.5 && angle <= -22.5);
                break;
            case 'up-left':
                isActive = (angle >= -157.5 && angle <= -112.5);
                break;
            case 'down-right':
                isActive = (angle >= 22.5 && angle <= 67.5);
                break;
            case 'down-left':
                isActive = (angle >= 112.5 && angle <= 157.5);
                break;
                
            // الاتجاهات الأساسية (نطاقات أصغر لتجنب التداخل)
            case 'up':
                isActive = (angle >= -112.5 && angle <= -67.5);
                break;
            case 'right':
                isActive = (angle >= -22.5 && angle <= 22.5);
                break;
            case 'down':
                isActive = (angle >= 67.5 && angle <= 112.5);
                break;
            case 'left':
                isActive = (angle >= 157.5 || angle <= -157.5);
                break;
        }
        
        indicator.classList.toggle('active', isActive);
    });
};

const getDirection = (dx, dy) => {
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    // استخدام widget.configuration بدلاً من widget.joystickCommands
    const config = widget.configuration;
    console.log('Joystick angle:', angle.toFixed(2));
    
    if (Math.abs(angle - lastAngle) < 5) return null;
    lastAngle = angle;
    
    // الاتجاهات القطرية - فحص وجود الأوامر والتأكد من عدم كونها فارغة
    // فوق-يمين: -67.5° إلى -22.5°
    if (config.upRightCommand && config.upRightCommand.trim() && angle >= -67.5 && angle <= -22.5) {
        console.log('Sending UP-RIGHT command:', config.upRightCommand);
        return config.upRightCommand;
    }
    
    // فوق-شمال: -157.5° إلى -112.5°
    if (config.upLeftCommand && config.upLeftCommand.trim() && angle >= -157.5 && angle <= -112.5) {
        console.log('Sending UP-LEFT command:', config.upLeftCommand);
        return config.upLeftCommand;
    }
    
    // تحت-يمين: 22.5° إلى 67.5°
    if (config.downRightCommand && config.downRightCommand.trim() && angle >= 22.5 && angle <= 67.5) {
        console.log('Sending DOWN-RIGHT command:', config.downRightCommand);
        return config.downRightCommand;
    }
    
    // تحت-شمال: 112.5° إلى 157.5°
    if (config.downLeftCommand && config.downLeftCommand.trim() && angle >= 112.5 && angle <= 157.5) {
        console.log('Sending DOWN-LEFT command:', config.downLeftCommand);
        return config.downLeftCommand;
    }
    
    // الاتجاهات الأساسية
    if (angle >= -22.5 && angle <= 22.5) {
        console.log('Sending RIGHT command:', config.rightCommand);
        return config.rightCommand;
    }
    if (angle >= 67.5 && angle <= 112.5) {
        console.log('Sending DOWN command:', config.downCommand);
        return config.downCommand;
    }
    if (angle >= 157.5 || angle <= -157.5) {
        console.log('Sending LEFT command:', config.leftCommand);
        return config.leftCommand;
    }
    if (angle >= -112.5 && angle <= -67.5) {
        console.log('Sending UP command:', config.upCommand);
        return config.upCommand;
    }
    
    return null;
};



                // بداية السحب
                const startDrag = (e) => {
                    e.preventDefault();
                    isDragging = true;
                    updateBounds();
                    joystickContainer.classList.add('active');
                    document.body.style.userSelect = 'none';
                };

                // إنهاء السحب
                const endDrag = () => {
                    if (!isDragging) return;
                    isDragging = false;
                    
                    // إعادة المقبض للمنتصف
                    joystickStick.style.transform = 'translate(-50%, -50%)';
                    joystickContainer.classList.remove('active');
                    document.body.style.userSelect = '';
                    
                    // إعادة تعيين المتغيرات
                    lastSentCommand = null;
                    lastAngle = null;
                    
                    // إزالة تنشيط كل المؤشرات
                    directionIndicators.forEach(indicator => indicator.classList.remove('active'));
                    
                    // إرسال أمر التوقف إذا كان موجوداً
                    if (widget.configuration?.stopCommand) {
                        sendCommand(widget.configuration.stopCommand);
                    }
                };

                // أثناء السحب
                const onDrag = (e) => {
                    if (!isDragging) return;
                    e.preventDefault();

                    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

                    // حساب المسافة من المركز
                    let dx = clientX - centerX;
                    let dy = clientY - centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    // تقييد الحركة داخل الدائرة
                    if (distance > maxDistance) {
                        dx = dx / distance * maxDistance;
                        dy = dy / distance * maxDistance;
                    }

                    // تحديث موضع المقبض
                    joystickStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

                    // تحديث مؤشرات الاتجاه
                    updateDirectionIndicators(dx, dy);

                    // إرسال الأمر إذا كانت المسافة كافية
                    if (distance > maxDistance * 0.3) { // 30% من الحد الأقصى
                        const directionCommand = getDirection(dx, dy);
                        if (directionCommand) sendCommand(directionCommand);
                    }
                };

                // إضافة مستمعي الأحداث للماوس
                joystickContainer.addEventListener('mousedown', startDrag);
                document.addEventListener('mousemove', onDrag);
                document.addEventListener('mouseup', endDrag);

                // إضافة مستمعي الأحداث للمس
                joystickContainer.addEventListener('touchstart', startDrag, { passive: false });
                document.addEventListener('touchmove', onDrag, { passive: false });
                document.addEventListener('touchend', endDrag);
                document.addEventListener('touchcancel', endDrag);

                // تحديث الحدود عند تغيير حجم النافذة
                const debouncedUpdateBounds = debounce(updateBounds, 250);
                window.addEventListener('resize', debouncedUpdateBounds);
                
                // تهيئة أولية
                updateBounds();

                // تنظيف عند إزالة الويدجت
                return () => {
                    document.removeEventListener('mousemove', onDrag);
                    document.removeEventListener('mouseup', endDrag);
                    document.removeEventListener('touchmove', onDrag);
                    document.removeEventListener('touchend', endDrag);
                    document.removeEventListener('touchcancel', endDrag);
                    window.removeEventListener('resize', debouncedUpdateBounds);
                };
            }
        }

        if (widget.type === 'slider') {
            const sliderInput = widgetContent.querySelector('.slider-input');
            const valueDisplay = widgetContent.querySelector('.slider-value-display .value');
            let debounceTimer;

            if (sliderInput && valueDisplay) {
                // Update display value immediately on input
                sliderInput.addEventListener('input', (e) => {
                    valueDisplay.textContent = e.target.value;
                });

                // Debounced send to server on change
                sliderInput.addEventListener('change', (e) => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(async () => {
                        try {
                            const response = await fetch('/api/command/send', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'x-auth-token': token
                                },
                                body: JSON.stringify({
                                    widgetId: widget._id,
                                    value: e.target.value
                                })
                            });

                            if (!response.ok) {
                                throw new Error('فشل في إرسال قيمة السلايدر');
                            }
                            console.log('✅ تم إرسال قيمة السلايدر:', e.target.value);
                        } catch (error) {
                            console.error('❌ خطأ في إرسال قيمة السلايدر:', error);
                            showMessage('خطأ في إرسال القيمة', 'error');
                        }
                    }, 300); // 300ms debounce delay
                });
            }
        }

        const terminalInput = widgetContent.querySelector('.terminal-cmd');
        if (terminalInput) {
            terminalInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    await handleTerminalSend(widget, widgetElement);
                }
            });
        }
    }

    // === معالجة أحداث الويدجت ===
    async function handleToggleAction(widget) {
        // استخدم widget.id (Firebase) أو widget._id (MongoDB)
        const widgetId = widget.id || widget._id;
        const widgetElement = document.querySelector(`[data-widget-id="${widgetId}"]`);
        if (!widgetElement) return;

        const toggleBtn = widgetElement.querySelector('.toggle-btn');
        const statusSpan = widgetElement.querySelector('.toggle-status');
        const currentState = toggleBtn.classList.contains('active');

        // --- جلب الألوان المخصصة من الويدجت ---
        const activeColor = widget.activeColor || '#8A2BE2'; // اللون في حالة التشغيل
        const primaryColor = widget.primaryColor || '#343a40'; // اللون في حالة الإيقاف

        // --- التحديث المتفائل (الفوري) لواجهة المستخدم ---
        toggleBtn.classList.toggle('active');
        toggleBtn.style.background = !currentState ? activeColor : primaryColor; // <-- تطبيق اللون الجديد

        const onLabel = widget.configuration?.onCommand || 'ON';
        const offLabel = widget.configuration?.offCommand || 'OFF';
        if (statusSpan) {
            statusSpan.textContent = !currentState ? onLabel : offLabel;
        }
        // --- نهاية التحديث المتفائل ---

        try {
            const response = await fetch('/api/command/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ widgetId: widgetId, value: 'TOGGLE' })
            });

            if (!response.ok) {
                console.error('❌ فشل في إرسال أمر Toggle');
                // --- التراجع عن التغييرات في حالة الفشل ---
                toggleBtn.classList.toggle('active');
                toggleBtn.style.background = currentState ? activeColor : primaryColor; // <-- إرجاع اللون الأصلي
                if (statusSpan) statusSpan.textContent = currentState ? onLabel : offLabel;
            }
        } catch (error) {
            console.error('❌ خطأ في إرسال أمر Toggle:', error);
            // --- التراجع عن التغييرات في حالة الخطأ ---
            toggleBtn.classList.toggle('active');
            toggleBtn.style.background = currentState ? activeColor : primaryColor; // <-- إرجاع اللون الأصلي
            if (statusSpan) statusSpan.textContent = currentState ? onLabel : offLabel;
        }
    }

    async function handlePushAction(widget) {
        // استخدم widget.id (Firebase) أو widget._id (MongoDB)
        const widgetId = widget.id || widget._id;
        
        try {
            const response = await fetch('/api/command/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                },
                body: JSON.stringify({
                    widgetId: widgetId,
                    value: widget.configuration.onCommand
                })
            });

            if (response.ok) {
                showMessage('تم إرسال الأمر بنجاح', 'success');
                console.log('✅ تم إرسال أمر Push');
            } else {
                throw new Error('فشل في إرسال الأمر');
            }
        } catch (error) {
            console.error('❌ خطأ في إرسال أمر Push:', error);
            showMessage('خطأ في إرسال الأمر', 'error');
        }
    }

    async function handleDeleteAction(widget) {
        // استخدم widget.id (Firebase) أو widget._id (MongoDB)
        const widgetId = widget.id || widget._id;
        
        if (!confirm(`هل تريد حذف الأداة "${widget.name}"؟`)) return;

        try {
            const response = await fetch(`/api/widgets/${widgetId}`, {
                method: 'DELETE',
                headers: { 'x-auth-token': token }
            });

            if (response.ok) {
                showMessage('تم حذف الأداة بنجاح', 'success');
                console.log('✅ تم حذف الويدجت');
                stopWidgetMonitoring(widgetId);
            } else {
                throw new Error('فشل في حذف الأداة');
            }
        } catch (error) {
            console.error('❌ خطأ في حذف الويدجت:', error);
            showMessage('خطأ في حذف الأداة', 'error');
        }
    }

    // === دوال الترمنال ===
    function appendTerminalMessage(widgetId, message, type = 'info', timestamp = Date.now()) {
        const outputElement = document.querySelector(`#terminal-${widgetId}`);
        if (!outputElement) return;

        // إنشاء مُعرّف فريد لكل رسالة لمنع التكرار
        const messageId = `${timestamp}-${message}`;

        // التحقق إذا كانت الرسالة موجودة بالفعل على الشاشة
        if (outputElement.querySelector(`[data-message-id="${messageId}"]`)) {
            return; // إذا كانت موجودة، لا تفعل شيئاً واخرج
        }

        const messageElement = document.createElement('div');
        messageElement.className = `terminal-line ${type}`;
        messageElement.setAttribute('data-message-id', messageId); // إضافة المُعرّف للعنصر

        const time = new Date(timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        messageElement.innerHTML = `<span class="timestamp">[${time}]</span> ${message}`;

        outputElement.appendChild(messageElement);
        outputElement.scrollTop = outputElement.scrollHeight;

        // الحفاظ على آخر 500 رسالة فقط
        if (outputElement.children.length > 500) {
            outputElement.firstChild.remove();
        }
    }

    async function handleTerminalSend(widget, widgetElement) {
        // استخدم widget.id (Firebase) أو widget._id (MongoDB)
        const widgetId = widget.id || widget._id;
        
        const inputElement = widgetElement.querySelector('.terminal-cmd');
        const command = inputElement?.value?.trim();
        if (!command) return;

        try {
            const response = await fetch('/api/command/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                },
                body: JSON.stringify({
                    widgetId: widgetId,
                    value: command
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.msg || 'فشل إرسال أمر الترمنال');

            console.log('✅ تم إرسال أمر الترمنال بنجاح:', data);
            inputElement.value = '';
        } catch (error) {
            console.error('❌ خطأ في إرسال أمر الترمنال:', error);
            showMessage(error.message, 'error');
        }
    }

    function handleTerminalClear(widget) {
        // استخدم widget.id (Firebase) أو widget._id (MongoDB)
        const widgetId = widget.id || widget._id;
        
        const outputElement = document.querySelector(`#terminal-${widgetId}`);
        if (outputElement) {
            outputElement.innerHTML = '<div class="terminal-line">جاهز للأوامر...</div>';
            terminalHistory.set(widgetId, []);
        }
    }

    async function handleTerminalRefresh(widget) {
        // استخدم widget.id (Firebase) أو widget._id (MongoDB)
        const widgetId = widget.id || widget._id;
        
        showMessage('جاري تحديث الترمنال...', 'info');
        await loadTerminalMessages(widgetId, 50);
    }

    // === تحديث حالة الويدجت ===
    function updateWidgetStatus(widgetId, data) {
        const widgetElement = document.querySelector(`[data-widget-id="${widgetId}"]`);
        if (!widgetElement) return;

        const widget = widgets.find(w => (w.id || w._id) === widgetId);
        if (!widget) return;

        widget.state = { ...widget.state, ...data };
        const isActive = widget.state.isActive;

        // تحديث حالة الزر (toggle)
        if (widget.type === 'toggle') {
            const toggleBtn = widgetElement.querySelector('.toggle-btn');
            const statusSpan = widgetElement.querySelector('.toggle-status');

            if (toggleBtn && statusSpan) {
                // --- جلب الألوان المخصصة ---
                const activeColor = widget.activeColor || '#8A2BE2';
                const primaryColor = widget.primaryColor || '#343a40';

                // تحديث اللون والشكل بناءً على الحالة المؤكدة من الخادم
                if (isActive) {
                    toggleBtn.classList.add('active');
                    toggleBtn.style.background = activeColor; // <-- تطبيق لون التشغيل
                } else {
                    toggleBtn.classList.remove('active');
                    toggleBtn.style.background = primaryColor; // <-- تطبيق لون الإيقاف
                }

                const onLabel = widget.configuration?.onCommand || 'ON';
                const offLabel = widget.configuration?.offCommand || 'OFF';
                statusSpan.textContent = isActive ? onLabel : offLabel;
            }
        }

        // تحديث حالة الحساس (sensor)
        if (widget.type === 'sensor') {
            const sensorValue = widgetElement.querySelector('.sensor-value .value');
            if (sensorValue) sensorValue.textContent = data.lastValue ?? '--';

            const sensorStatus = widgetElement.querySelector('.sensor-status span');
            if (sensorStatus) sensorStatus.textContent = `آخر قراءة: ${formatLastUpdate(data.lastUpdate)}`;

            const statusIndicator = widgetElement.querySelector('.status-indicator');
            if (statusIndicator) {
               statusIndicator.className = `status-indicator ${isActive ? 'active' : 'inactive'}`;
           }
        }

        // تحديث حالة السلايدر (slider)
        if (widget.type === 'slider') {
            const sliderInput = widgetElement.querySelector('.slider-input');
            const valueDisplay = widgetElement.querySelector('.slider-value-display .value');

            if (sliderInput && valueDisplay && typeof data.lastValue !== 'undefined') {
                // تحديث قيمة السلايدر
                sliderInput.value = data.lastValue;
                valueDisplay.textContent = data.lastValue;

                // تحديث مؤشر الحالة (إن وجد)
                const statusIndicator = widgetElement.querySelector('.status-indicator');
                if (statusIndicator) {
                    statusIndicator.className = `status-indicator ${isActive ? 'active' : 'inactive'}`;
                }

                // إضافة تأثير التحديث
                valueDisplay.style.animation = 'none';
                // Trigger reflow
                void valueDisplay.offsetWidth;
                valueDisplay.style.animation = 'pulse 1s ease-in-out';
            }
        }
    }
    // === حفظ مواضع الأدوات المحسن ===
async function saveWidgetPositions() {
    try {
        console.log('💾 بدء حفظ مواضع الأدوات...');
        
        if (!gridStack) {
            throw new Error('GridStack غير مُهيأ');
        }

        // الحصول على جميع عناصر الشبكة
        const gridItems = gridStack.getGridItems();
        const widgetPositions = [];

        // جمع معلومات الموضع لكل أداة
        gridItems.forEach(item => {
            const node = item.gridstackNode;
            // جرب قراءة الـ ID من عدة مصادر ممكنة
            const widgetId = 
                item.getAttribute('data-widget-id') || 
                item.getAttribute('data-id') || 
                item.getAttribute('gs-id') || 
                item.dataset?.widgetId || 
                node?.id;
            
            if (widgetId && node && widgetId !== 'undefined') {
                console.log(`📍 الأداة: ${widgetId}, الموضع: (${node.x}, ${node.y}), الحجم: ${node.w}x${node.h}`);
                widgetPositions.push({
                    widgetId: widgetId,
                    x: node.x || 0,
                    y: node.y || 0,
                    w: node.w || 1,
                    h: node.h || 1
                });
            } else {
                console.warn('⚠️ تحذير: لم يتم العثور على ID للأداة', item);
            }
        });

        console.log(`📊 سيتم حفظ مواضع ${widgetPositions.length} أداة`);

        // حفظ كل موضع في قاعدة البيانات
        const savePromises = widgetPositions.map(async (position) => {
            try {
                const response = await fetch(`/api/widgets/${position.widgetId}/position`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': token
                    },
                    body: JSON.stringify({
                        gs: {
                            x: position.x,
                            y: position.y,
                            w: position.w,
                            h: position.h
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`فشل حفظ موضع الأداة ${position.widgetId}`);
                }

                console.log(`✅ تم حفظ موضع الأداة ${position.widgetId}: (${position.x}, ${position.y}, ${position.w}x${position.h})`);
                return true;

            } catch (error) {
                console.error(`❌ خطأ في حفظ موضع الأداة ${position.widgetId}:`, error);
                return false;
            }
        });

        // انتظار انتهاء جميع عمليات الحفظ
        const results = await Promise.all(savePromises);
        const successCount = results.filter(r => r).length;
        
        if (successCount === widgetPositions.length) {
            console.log(`✅ تم حفظ جميع المواضع بنجاح (${successCount}/${widgetPositions.length})`);
            
            // تحديث الأدوات المحلية
            widgetPositions.forEach(pos => {
                const widget = widgets.find(w => (w.id || w._id) === pos.widgetId);
                if (widget) {
                    widget.gs = {
                        x: pos.x,
                        y: pos.y,
                        w: pos.w,
                        h: pos.h
                    };
                }
            });
            
            return true;
        } else {
            throw new Error(`تم حفظ ${successCount} من أصل ${widgetPositions.length} فقط`);
        }

    } catch (error) {
        console.error('❌ خطأ في حفظ مواضع الأدوات:', error);
        showMessage('❌ فشل في حفظ مواضع الأدوات', 'error');
        throw error;
    }
}

// === تحميل المواضع المحفوظة عند عرض الأدوات ===
function addWidgetToGrid(widget, index = 0) {
    if (!gridStack) {
        console.error('❌ GridStack غير مهيأ');
        return;
    }

    const widgetElement = createWidgetElement(widget);
    
    // استخدام المواضع المحفوظة إن وجدت، وإلا استخدام مواضع افتراضية
    let widgetOptions;
    // استخدم widget.id (Firebase) أو widget._id (MongoDB) بناءً على ما هو متاح
    const widgetId = widget.id || widget._id;
    
    if (widget.gs && typeof widget.gs.x !== 'undefined') {
        // استخدام الموضع المحفوظ
        widgetOptions = {
            id: widgetId,
            x: widget.gs.x,
            y: widget.gs.y,
            w: widget.gs.w || getWidgetWidth(widget.type),
            h: widget.gs.h || getWidgetHeight(widget.type)
        };
        console.log(`📍 استخدام موضع محفوظ للأداة ${widget.name}: (${widget.gs.x}, ${widget.gs.y})`);
    } else {
        // استخدام موضع افتراضي
        const isMobile = window.innerWidth <= 768;
        const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;
        
        widgetOptions = {
            id: widgetId,
            x: isMobile ? 0 : (index % (isTablet ? 2 : 3)) * getWidgetWidth(widget.type),
            y: Math.floor(index / (isMobile ? 1 : (isTablet ? 2 : 3))) * getWidgetHeight(widget.type),
            w: getWidgetWidth(widget.type),
            h: getWidgetHeight(widget.type)
        };
        console.log(`📍 استخدام موضع افتراضي للأداة ${widget.name}: (${widgetOptions.x}, ${widgetOptions.y})`);
    }

    // إضافة الأداة للشبكة
    gridStack.addWidget(widgetElement, widgetOptions);
    attachWidgetEvents(widgetElement, widget);
}

    // === إدارة الإحصائيات ===
    async function loadUserStats() {
        try {
            const response = await fetch('/api/user/stats', {
                headers: { 'x-auth-token': token }
            });

            if (response.ok) {
                const stats = await response.json();
                updateStatsDisplay(stats);
                console.log('✅ تم تحميل إحصائيات المستخدم');
            } else {
                throw new Error('فشل في تحميل الإحصائيات');
            }
        } catch (error) {
            console.error('❌ خطأ في تحميل إحصائيات المستخدم:', error);
        }
    }

    function updateStatsDisplay(stats) {
        const elements = {
            'total-widgets': stats.totalWidgets || 0,
            'total-commands': stats.totalCommands || 0,
            'success-rate': (stats.successRate || 100) + '%',
            'active-days': stats.activeDays || 0,
            'total-widgets-sidebar': stats.totalWidgets || 0,
            'total-commands-sidebar': stats.totalCommands || 0
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

    function updateStats() {
        const totalWidgets = widgets.length;
        const totalCommands = widgets.reduce((sum, w) => sum + (w.analytics?.totalCommands || 0), 0);

        const widgetsElements = document.querySelectorAll('[id*="total-widgets"]');
        const commandsElements = document.querySelectorAll('[id*="total-commands"]');

        widgetsElements.forEach(el => animateNumber(el, parseInt(el.textContent) || 0, totalWidgets));
        commandsElements.forEach(el => animateNumber(el, parseInt(el.textContent) || 0, totalCommands));
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

    // === إعداد مستمعي الأحداث ===
    function setupEventListeners() {
        const mobileMenuToggleBtn = document.getElementById('mobile-menu-toggle');
        const navMenu = document.getElementById('nav-menu');

        if (mobileMenuToggleBtn && navMenu) {
            mobileMenuToggleBtn.addEventListener('click', () => {
                navMenu.classList.toggle('active');
            });
        }

        // أزرار تسجيل الخروج - بحث موسع
        const logoutSelectors = [
            '#logout-btn',
            '.logout-btn',
            '[data-action="logout"]',
            'button[onclick*="logout"]',
            'a[href*="logout"]'
        ];

        logoutSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(btn => {
                btn.addEventListener('click', handleLogout);
            });
        });



        const sidebarMenuToggle = document.getElementById('menu-toggle');
        const sidebarClose = document.getElementById('sidebar-close');
        const sidebar = document.getElementById('sidebar');

        if (sidebarMenuToggle && sidebar) {
            sidebarMenuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
        }
        if (sidebarClose && sidebar) {
            sidebarClose.addEventListener('click', () => sidebar.classList.remove('open'));
        }

        const editModeBtn = document.getElementById('edit-mode-btn');
        if (editModeBtn) editModeBtn.addEventListener('click', toggleEditMode);

        const addWidgetBtn = document.getElementById('add-widget-btn');
        if (addWidgetBtn) addWidgetBtn.addEventListener('click', () => window.location.href = '/settings');

        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) refreshBtn.addEventListener('click', refreshWidgetsData);

        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                filterWidgets(btn.dataset.filter);
            });
        });

        // === Mobile 3-dots menu ===
        setupMobileMenuOverlay();

        console.log('✅ تم إعداد مستمعي الأحداث');
    }
// === منيو الموبايل (3 نقاط) ===
function setupMobileMenuOverlay() {
    // تحقق إذا كان الزر موجود أو أنشئه
    let mobileMenuBtn = document.getElementById('mobile-3dots-btn');
    if (!mobileMenuBtn) {
        mobileMenuBtn = document.createElement('button');
        mobileMenuBtn.id = 'mobile-3dots-btn';
        mobileMenuBtn.className = 'mobile-3dots-btn';
        mobileMenuBtn.innerHTML = '<i class="fas fa-ellipsis-v"></i>';
        mobileMenuBtn.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10010;background:rgba(30,30,30,0.85);color:#fff;border:none;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;box-shadow:0 2px 8px rgba(0,0,0,0.15);cursor:pointer;';
        document.body.appendChild(mobileMenuBtn);
    }

    // تحقق إذا كان overlay موجود أو أنشئه
    let mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
    if (!mobileMenuOverlay) {
        mobileMenuOverlay = document.createElement('div');
        mobileMenuOverlay.id = 'mobile-menu-overlay';
        mobileMenuOverlay.className = 'mobile-menu-overlay';
        mobileMenuOverlay.style.cssText = 'position:fixed;top:0;right:0;width:100vw;height:100vh;background:rgba(0,0,0,0.35);z-index:10009;display:none;';
        document.body.appendChild(mobileMenuOverlay);
    }

    // تحقق إذا كان المنيو الجانبي موجود أو أنشئه
    let mobileMenuPanel = document.getElementById('mobile-menu-panel');
    if (!mobileMenuPanel) {
        mobileMenuPanel = document.createElement('div');
        mobileMenuPanel.id = 'mobile-menu-panel';
        mobileMenuPanel.className = 'mobile-menu-panel';
        mobileMenuPanel.style.cssText = 'position:fixed;top:0;right:0;width:82vw;max-width:340px;height:100vh;background:var(--sidebar-bg,#23272f);box-shadow:-2px 0 16px rgba(0,0,0,0.18);z-index:10011;display:flex;flex-direction:column;align-items:stretch;padding:0;transform:translateX(100%);transition:transform 0.25s cubic-bezier(.4,1.2,.4,1);';
        document.body.appendChild(mobileMenuPanel);
    }

    // محتوى المنيو الجانبي (الهيدر)
    function renderMobileMenuContent() {
        mobileMenuPanel.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 18px 12px 12px;border-bottom:1px solid #333;">
                <div style="font-size:1.25rem;font-weight:700;color:#fff;display:flex;align-items:center;gap:8px;">
                    <i class="fas fa-user-circle" style="font-size:1.5rem;"></i>
                    ${currentUser ? currentUser.username : 'الحساب'}
                </div>
                <button id="mobile-menu-close" style="background:none;border:none;color:#fff;font-size:1.5rem;cursor:pointer;"><i class="fas fa-times"></i></button>
            </div>
            <div style="display:flex;flex-direction:column;gap:2px;padding:18px 0 0 0;">
                <a href="/account" class="mobile-menu-link"><i class="fas fa-user"></i> الحساب</a>
                <a href="/settings" class="mobile-menu-link"><i class="fas fa-cog"></i> الإعدادات</a>
                <button class="mobile-menu-link" id="mobile-menu-logout"><i class="fas fa-sign-out-alt"></i> تسجيل الخروج</button>
            </div>
        `;
        // روابط المنيو ستايل
        const style = document.createElement('style');
        style.innerHTML = `
            .mobile-menu-link {
                display:flex;align-items:center;gap:12px;font-size:1.13rem;font-weight:500;color:#fff;background:none;border:none;text-align:right;padding:14px 24px;cursor:pointer;transition:background 0.15s;border-radius:0;
            }
            .mobile-menu-link:hover {background:rgba(255,255,255,0.07);}
        `;
        document.head.appendChild(style);
    }

    // فتح المنيو
    function openMobileMenu() {
        renderMobileMenuContent();
        mobileMenuOverlay.style.display = 'block';
        mobileMenuPanel.style.transform = 'translateX(0)';
        document.body.style.overflow = 'hidden';

        // زر الإغلاق
        document.getElementById('mobile-menu-close').onclick = closeMobileMenu;
        // // زر تغيير الوضع
        // document.getElementById('mobile-menu-theme-toggle').onclick = function() {
        //     toggleTheme();
        //     closeMobileMenu();
        // };
        // زر تسجيل الخروج
        document.getElementById('mobile-menu-logout').onclick = function() {
            closeMobileMenu();
            setTimeout(handleLogout, 200);
        };
    }

    // إغلاق المنيو
    function closeMobileMenu() {
        mobileMenuOverlay.style.display = 'none';
        mobileMenuPanel.style.transform = 'translateX(100%)';
        document.body.style.overflow = '';
    }

    // إظهار الزر فقط على الموبايل
    function updateMobileMenuVisibility() {
        if (window.innerWidth <= 900) {
            mobileMenuBtn.style.display = 'flex';
        } else {
            mobileMenuBtn.style.display = 'none';
            closeMobileMenu();
        }
    }
    updateMobileMenuVisibility();
    window.addEventListener('resize', updateMobileMenuVisibility);

    // فتح المنيو عند الضغط على الزر
    mobileMenuBtn.onclick = function(e) {
        e.stopPropagation();
        openMobileMenu();
    };
    // إغلاق عند الضغط على overlay
    mobileMenuOverlay.onclick = closeMobileMenu;
    // إغلاق عند الضغط على Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && mobileMenuPanel.style.transform === 'translateX(0)') {
            closeMobileMenu();
        }
    });
}
    
    // === الوظائف المساعدة ===
    function getWidgetWidth(type) {
        switch (type) {
            case 'sensor': return 4;
            case 'terminal': return 6;
            case 'slider': return 4; // Slider needs more width for good UX
            case 'joystick': return 4; // Joystick needs enough space for comfortable control
            default: return 3;
        }
    }

    function getWidgetHeight(type) {
        switch (type) {
            case 'terminal': return 4;
            case 'slider': return 2; // Standard 2-row height is good for sliders
            case 'joystick': return 3; // Joystick needs to be square-ish for good UX
            default: return 2;
        }
    }

    function formatLastUpdate(date) {
        if (!date) return 'غير متوفر';

        const now = new Date();
        const updateTime = new Date(date);
        const diffMs = now - updateTime;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'الآن';
        if (diffMins < 60) return `منذ ${diffMins} دقيقة`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `منذ ${diffHours} ساعة`;

        const diffDays = Math.floor(diffHours / 24);
        return `منذ ${diffDays} يوم`;
    }

    function removeWidgetFromGrid(widgetId) {
        if (!gridStack) return;

        const widgetElement = document.querySelector(`[data-widget-id="${widgetId}"]`);
        if (widgetElement) gridStack.removeWidget(widgetElement);
    }

    function filterWidgets(filter) {
        const allWidgets = document.querySelectorAll('.widget-item');

        allWidgets.forEach(widget => {
            if (filter === 'all' || widget.classList.contains(`widget-${filter}`)) {
                widget.style.display = 'block';
            } else {
                widget.style.display = 'none';
            }
        });
    }

    // === إعداد التجديد التلقائي ===
    function setupAutoRefresh() {
        if (refreshInterval) clearInterval(refreshInterval);
        // استدعاء الدالة الجديدة والآمنة
        refreshInterval = setInterval(refreshWidgetsData, 60000); // كل دقيقة
        console.log('✅ تم تفعيل التحديث التلقائي الآمن للبيانات.');
    }

    /**
     * دالة التحديث الجديدة والآمنة (Non-Destructive Refresh).
     * تقوم هذه الدالة بتحديث بيانات الأدوات في مكانها دون إعادة بنائها.
     */
    async function refreshWidgetsData() {
    console.log('🔄 [آمن] بدء تحديث بيانات الأدوات...');
    try {
        // تحديث الإحصائيات العامة أولاً
        await loadUserStats();

        // تحديث بيانات الحساسات فقط
        const sensorWidgets = widgets.filter(widget => widget.type === 'sensor');
        
        console.log(`Found ${sensorWidgets.length} sensor(s) to refresh.`);

        await Promise.all(sensorWidgets.map(widget => {
            // الآن نحن متأكدون أننا نطلب البيانات للحساسات فقط
            return fetch(`/api/sensors/${widget._id}/data`, { headers: { 'x-auth-token': token } })
                .then(res => {
                    if (res.ok) return res.json();
                    // إذا فشل الطلب، نطبع تحذيرًا بدلاً من إيقاف كل شيء
                    console.warn(`Could not fetch data for sensor: ${widget.name}`);
                    return null;
                })
                .then(data => {
                    if (data) {
                        // تحديث واجهة المستخدم بالبيانات الجديدة
                        updateWidgetStatus(widget._id, data);
                    }
                });
        }));

        lastSyncTime = new Date();
        console.log('✅ [آمن] اكتمل تحديث البيانات بنجاح.');

    } catch (error) {
        console.error('❌ خطأ أثناء التحديث التلقائي للبيانات:', error);
        // يمكنك إضافة رسالة للمستخدم هنا إذا أردت
        // showMessage('حدث خطأ أثناء تحديث البيانات تلقائياً', 'error');
    }
}
    // === إدارة واجهة المستخدم ===
    function updateUserDisplay() {
        if (!currentUser) return;

        const usernameDisplay = document.getElementById('username-display');
        if (usernameDisplay) usernameDisplay.textContent = currentUser.username;
    }

    function updateConnectionStatus(isConnected) {
        const connectionStatus = document.getElementById('connection-status');
        const connectionIndicator = document.getElementById('connection-indicator');

        const updateElement = (element) => {
            if (!element) return;

            const dot = element.querySelector('.status-dot, .indicator-dot');
            const text = element.querySelector('span');

            if (dot) {
                dot.className = isConnected ?
                    (dot.classList.contains('indicator-dot') ? 'indicator-dot' : 'status-dot') :
                    (dot.classList.contains('indicator-dot') ? 'indicator-dot offline' : 'status-dot offline');
            }

            if (text) text.textContent = isConnected ? 'متصل' : 'غير متصل';
        };

        updateElement(connectionStatus);
        updateElement(connectionIndicator);
    }

   function createMessageContainer()  {
        if (document.getElementById('message-container')) return;

        const container = document.createElement('div');
        container.id = 'message-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
        `;
        document.body.appendChild(container);
    }

   function showMessage(message, type = 'info')  {
        const container = document.getElementById('message-container');
        if (!container) return;

        const messageEl = document.createElement('div');
        messageEl.className = `toast ${type} show`;
        messageEl.innerHTML = `
            <div class="toast-content">
                <i class="fas ${getMessageIcon(type)}"></i>
                <span>${message}</span>
                <button class="toast-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        container.appendChild(messageEl);

        const closeBtn = messageEl.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => messageEl.remove());

        setTimeout(() => {
            if (messageEl.parentNode) messageEl.remove();
        }, type === 'error' ? 7000 : 5000);
    }

    function getMessageIcon(type) {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-exclamation-circle';
            case 'warning': return 'fa-exclamation-triangle';
            case 'info': return 'fa-info-circle';
            default: return 'fa-info-circle';
        }
    }

    function showLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'flex';
    }

    function hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    // === إدارة الثيم ===
    function initializeTheme() {
        document.documentElement.setAttribute('data-theme', 'dark');
    }

    // === تسجيل الخروج المحسن ===
    async function handleLogout() {
        if (!confirm('هل تريد تسجيل الخروج؟')) return;

        try {
            // إيقاف جميع المؤقتات
            sensorIntervals.forEach(intervalId => clearInterval(intervalId));
            terminalIntervals.forEach(intervalId => clearInterval(intervalId));
            if (refreshInterval) clearInterval(refreshInterval);

            // إنهاء الاتصال
            if (socket) socket.disconnect();

            // إشعار الخادم
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'x-auth-token': token }
            });
        } catch (error) {
            console.warn('خطأ في إشعار الخادم بتسجيل الخروج:', error);
        }

        // تنظيف التخزين المحلي
        localStorage.removeItem('token');
        
        // إعادة التوجيه
        window.location.href = '/';
    }
// استبدال جزء وضع التعديل في dashboard.js

// === إعداد وضع التحرير المحسن ===
function setupEditMode() {
    if (!gridStack) return;

    // التأكد من أن الشبكة تبدأ في الوضع العادي (غير قابل للتعديل)
    gridStack.setStatic(true);
    gridStack.enableMove(false);
    gridStack.enableResize(false);
    
    // متغير للتحكم في الحالة
    isEditMode = false;

    const debouncedSavePositions = debounce(() => {
        saveWidgetPositions();
    }, 1500);

    gridStack.on('change', (event, items) => {
        // فقط في وضع التعديل وعند وجود تغييرات
        if (isEditMode && items && items.length > 0) {
            console.log('📐 تم تغيير مواضع الأدوات:', items);
            // حفظ تلقائي للمواضع (بالتأخير لمنع استهلاك حصة قاعدة البيانات)
             debouncedSavePositions();
        }
    });

    console.log('✅ تم إعداد وضع التحرير - الحالة: معطل');
}
// تحديث دالة appendTerminalMessage لحذف الرسائل القديمة
function appendTerminalMessage(widgetId, message, type = 'info', timestamp = Date.now()) {
    const outputElement = document.querySelector(`#terminal-${widgetId}`);
    if (!outputElement) return;
    
    // إنشاء معرف فريد للرسالة
    const messageId = `${timestamp}-${message.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '')}`;
    
    // تحقق من وجود الرسالة مسبقاً لتجنب التكرار
    if (outputElement.querySelector(`[data-message-id="${messageId}"]`)) {
        console.log('Message already exists, skipping...');
        return;
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = `terminal-line ${type}`;
    messageElement.setAttribute('data-message-id', messageId);
    messageElement.setAttribute('data-timestamp', timestamp);
    
    // تنسيق الوقت
    const time = new Date(timestamp).toLocaleTimeString('ar-EG', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    
    messageElement.innerHTML = `
        <span class="timestamp">[${time}]</span>
        <span class="message-text">${message}</span>
    `;
    
    outputElement.appendChild(messageElement);
    outputElement.scrollTop = outputElement.scrollHeight;
    
    // حذف الرسائل القديمة (الاحتفاظ بآخر 100 رسالة فقط)
    const maxMessages = 100;
    const allMessages = outputElement.querySelectorAll('.terminal-line');
    
    if (allMessages.length > maxMessages) {
        const messagesToDelete = allMessages.length - maxMessages;
        for (let i = 0; i < messagesToDelete; i++) {
            if (allMessages[i]) allMessages[i].remove();
        }
        console.log(`Removed ${messagesToDelete} old messages from terminal ${widgetId}`);
    }
}

// تنظيف الرسائل القديمة تلقائياً كل 30 دقيقة
setInterval(() => {
    const terminalWidgets = widgets.filter(w => w.type === 'terminal');
    terminalWidgets.forEach(widget => {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 ساعة
        const outputElement = document.querySelector(`#terminal-${widget.id}`);
        if (!outputElement) return;
        
        const messages = outputElement.querySelectorAll('.terminal-line[data-timestamp]');
        messages.forEach(msg => {
            const timestamp = parseInt(msg.getAttribute('data-timestamp'));
            if (now - timestamp > maxAge) {
                msg.remove();
            }
        });
    });
}, 30 * 60 * 1000);

// === تحسين دالة تبديل وضع التعديل ===
function toggleEditMode() {
    // منع التفعيل المزدوج
    if (document.querySelector('.grid-stack').classList.contains('switching-mode')) {
        return;
    }

    const editBtn = document.getElementById('edit-mode-btn');
    const gridContainer = document.getElementById('widgets-grid');

    // إضافة class للمنع من التفعيل المزدوج
    gridContainer.classList.add('switching-mode');

    try {
        if (isEditMode) {
            // === الخروج من وضع التعديل وحفظ التغييرات ===
            console.log('💾 حفظ التغييرات والخروج من وضع التعديل...');
            
            // تعطيل التحريك والتكبير
            gridStack.setStatic(true);
            gridStack.enableMove(false);
            gridStack.enableResize(false);
            
            // حفظ المواضع
            saveWidgetPositions().then(() => {
                showMessage('✅ تم حفظ مواضع الأدوات بنجاح', 'success');
            }).catch(err => {
                console.error('❌ خطأ في حفظ المواضع:', err);
                showMessage('❌ فشل في حفظ مواضع الأدوات', 'error');
            });

            // تحديث المظهر
            isEditMode = false;
            updateEditModeUI(false);
            gridContainer.classList.remove('edit-mode');
            
        } else {
            // === تفعيل وضع التعديل ===
            console.log('🎛️ تفعيل وضع التعديل...');
            
            // تفعيل التحريك والتكبير
            gridStack.setStatic(false);
            gridStack.enableMove(true);
            
            // تفعيل التكبير فقط للأجهزة الكبيرة
            const isMobile = window.innerWidth <= 768;
            if (!isMobile) {
                gridStack.enableResize(true);
            }
            
            // تحديث المظهر
            isEditMode = true;
            updateEditModeUI(true);
            gridContainer.classList.add('edit-mode');
            
            showMessage(isMobile ? 
                '📱 وضع التعديل مُفعل - اسحب الأدوات لترتيبها' : 
                '🎛️ وضع التعديل مُفعل - اسحب لنقل أو اسحب الحواف لتكبير', 
                'info'
            );
        }

    } catch (error) {
        console.error('❌ خطأ في تبديل وضع التعديل:', error);
        showMessage('❌ حدث خطأ في وضع التعديل', 'error');
    } finally {
        // إزالة المنع من التفعيل المزدوج
        setTimeout(() => {
            gridContainer.classList.remove('switching-mode');
        }, 500);
    }
}

// === تحديث واجهة وضع التعديل ===
function updateEditModeUI(editMode) {
    const editBtn = document.getElementById('edit-mode-btn');
    
    if (!editBtn) return;

    if (editMode) {
        // وضع الحفظ
        editBtn.innerHTML = '<i class="fas fa-save"></i> حفظ التغييرات';
        editBtn.classList.add('active', 'save-mode');
        editBtn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
        
        // إضافة تأثيرات بصرية للأدوات
        updateWidgetsEditAppearance(true);
        
    } else {
        // وضع التعديل
        editBtn.innerHTML = '<i class="fas fa-edit"></i> وضع التحرير';
        editBtn.classList.remove('active', 'save-mode');
        editBtn.style.background = 'linear-gradient(135deg, #8A2BE2, #00e5ff)';
        
        // إزالة التأثيرات البصرية
        updateWidgetsEditAppearance(false);
    }
}

// === تحديث مظهر الأدوات في وضع التعديل ===
function updateWidgetsEditAppearance(editMode) {
    const allWidgets = document.querySelectorAll('.grid-stack-item-content');
    
    allWidgets.forEach(widget => {
        if (editMode) {
            widget.style.cursor = 'move';
            widget.style.border = '2px dashed #00e5ff';
            widget.style.boxShadow = '0 0 15px rgba(0, 229, 255, 0.3)';
            widget.classList.add('widget-editing');
        } else {
            widget.style.cursor = 'pointer';
            widget.style.border = '1px solid rgba(138, 43, 226, 0.2)';
            widget.style.boxShadow = '';
            widget.classList.remove('widget-editing');
        }
    });
}

    // === تنظيف الذاكرة عند إغلاق الصفحة ===
    window.addEventListener('beforeunload', () => {
        sensorIntervals.forEach(intervalId => clearInterval(intervalId));
        terminalIntervals.forEach(intervalId => clearInterval(intervalId));
        if (refreshInterval) clearInterval(refreshInterval);
        if (socket) socket.disconnect();
    });
// === إدارة Hamburger Menu للموبايل ===
function setupMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileSettingsBtn = document.getElementById('mobile-settings-btn');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    // إنشاء العناصر إذا لم تكن موجودة
    if (!document.querySelector('.mobile-header')) {
        createMobileHeader();
    }
    
    if (!document.getElementById('sidebar-overlay')) {
        createSidebarOverlay();
    }
    
    // فتح/إغلاق السايدبار
    function toggleSidebar() {
        if (!sidebar) return;
        
        const isOpen = sidebar.classList.contains('open');
        
        if (isOpen) {
            // إغلاق السايدبار
            sidebar.classList.remove('open');
            sidebarOverlay?.classList.remove('show');
            document.body.style.overflow = 'auto';
        } else {
            // فتح السايدبار
            sidebar.classList.add('open');
            sidebarOverlay?.classList.add('show');
            document.body.style.overflow = 'hidden'; // منع التمرير
        }
    }
    
    // ربط الأحداث
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleSidebar();
            console.log('🍔 Mobile menu clicked');
        });
    }
    
    if (mobileSettingsBtn) {
        mobileSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/settings';
        });
    }
    
    // إغلاق عند النقر على الـ overlay
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', (e) => {
            e.preventDefault();
            toggleSidebar();
        });
    }
    
    // إغلاق عند النقر خارج السايدبار
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            const isClickInsideSidebar = sidebar?.contains(e.target);
            const isClickOnMenuBtn = mobileMenuBtn?.contains(e.target);
            
            if (!isClickInsideSidebar && !isClickOnMenuBtn && sidebar?.classList.contains('open')) {
                toggleSidebar();
            }
        }
    });
    
    // إغلاق عند الضغط على Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar?.classList.contains('open')) {
            toggleSidebar();
        }
    });
    
    console.log('✅ Mobile menu setup completed');
}

// إنشاء Mobile Header إذا لم يكن موجوداً
function createMobileHeader() {
    const header = document.createElement('div');
    header.className = 'mobile-header';
    header.innerHTML = `
        <div class="mobile-header-content">
            <button class="hamburger-menu" id="mobile-menu-btn" aria-label="فتح القائمة">
                <i class="fas fa-bars"></i>
            </button>
            <div class="mobile-logo">
                <i class="fas fa-home"></i> لوحة التحكم
            </div>
            <button class="hamburger-menu" id="mobile-settings-btn" aria-label="الإعدادات">
                <i class="fas fa-cog"></i>
            </button>
        </div>
    `;
    document.body.insertBefore(header, document.body.firstChild);
}

// إنشاء Sidebar Overlay
function createSidebarOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.id = 'sidebar-overlay';
    document.body.appendChild(overlay);
}

// === تحديث setupEventListeners لتشمل Mobile Menu ===
const originalSetupEventListeners = setupEventListeners;
setupEventListeners = function() {
    // استدعاء الدالة الأصلية
    if (originalSetupEventListeners) {
        originalSetupEventListeners();
    }
    
    // إضافة Mobile Menu
    setupMobileMenu();
    
    // إعادة تهيئة عند تغيير حجم الشاشة
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            // إخفاء mobile menu في الأجهزة الكبيرة
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            
            if (sidebar) sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('show');
            document.body.style.overflow = 'auto';
        }
    });
};

    console.log('✅ dashboard.js - جاهز للاستخدام مع المراقبة المستمرة!');
})();
