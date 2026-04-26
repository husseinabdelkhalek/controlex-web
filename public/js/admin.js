const token = localStorage.getItem('token');
if (!token) window.location.href = '/';

let currentUsers = [];

document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    loadLogs();
    loadClientLogs();
    loadQuota();
    
    document.getElementById('edit-user-status').addEventListener('change', (e) => {
        const msgSection = document.getElementById('ban-message-section');
        if (e.target.value === 'blocked' || e.target.value === 'suspended') {
            msgSection.style.display = 'block';
        } else {
            msgSection.style.display = 'none';
        }
    });

    document.getElementById('edit-user-role').addEventListener('change', (e) => {
        const pSection = document.getElementById('admin-permissions-section');
        if (e.target.value === 'admin') {
            pSection.style.display = 'block';
        } else {
            pSection.style.display = 'none';
        }
    });

    document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('edit-user-id').value;
        const role = document.getElementById('edit-user-role').value;
        const status = document.getElementById('edit-user-status').value;
        const showMsg = document.getElementById('edit-show-message').value === 'true';
        const msgText = document.getElementById('edit-message-text').value;
        const wa = document.getElementById('edit-message-whatsapp').value;
        const em = document.getElementById('edit-message-email').value;

        let adminPermissions = [];
        if (role === 'admin') {
            ['manage_users', 'manage_roles', 'send_notifications', 'view_logs'].forEach(p => {
                const cb = document.getElementById(`perm-${p.replace('_','-')}`);
                if(cb && cb.checked) adminPermissions.push(p);
            });
            if(document.getElementById('perm-all').checked) adminPermissions.push('*');
        }

        try {
            const adminMessage = { show: showMsg, text: msgText, email: em, whatsapp: wa };
            
            await fetch(`/api/admin/users/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ status, adminMessage })
            });

            await fetch(`/api/admin/users/${id}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ role, adminPermissions })
            });

            closeEditModal();
            loadUsers();
        } catch(err) {
            alert('حدث خطأ أثناء الحفظ');
        }
    });

    document.getElementById('notification-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const targetUserId = document.getElementById('notif-target-user').value;
        const title = document.getElementById('notif-title').value;
        const message = document.getElementById('notif-message').value;

        try {
            const res = await fetch('/api/admin/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ title, message, targetUserId })
            });
            if (res.ok) {
                alert('تم إرسال الإشعار بنجاح');
                closeNotificationModal();
            } else {
                alert('فشل إرسال الإشعار');
            }
        } catch(err) {
            alert('خطأ في الاتصال');
        }
    });
});

async function loadUsers() {
    try {
        document.getElementById('users-tbody').innerHTML = '<tr><td colspan="7" style="text-align: center;">جاري التحميل...</td></tr>';
        
        const res = await fetch('/api/admin/users', { headers: { 'x-auth-token': token } });
        if (!res.ok) {
            if(res.status === 403) {
                alert('ليس لديك صلاحية الوصول لهذه الصفحة');
                window.location.href = '/dashboard';
                return;
            }
            throw new Error();
        }
        currentUsers = await res.json();
        
        const tbody = document.getElementById('users-tbody');
        tbody.innerHTML = '';
        let blockedCount = 0;
        
        currentUsers.forEach(u => {
            if (u.status === 'blocked') blockedCount++;
            
            let statusBadge = '';
            if(u.status === 'active') statusBadge = '<span class="badge active">نشط</span>';
            else if(u.status === 'suspended') statusBadge = '<span class="badge suspended">معلق</span>';
            else if(u.status === 'blocked') statusBadge = '<span class="badge blocked">محظور</span>';
            
            let roleBadge = u.role === 'admin' ? '<span class="badge admin">Admin</span>' : '<span class="badge" style="background:#555">User</span>';
            
            let dt = new Date(u.lastLogin);
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.username}</td>
                <td style="direction:ltr;text-align:right;">${u.email}</td>
                <td>${roleBadge}</td>
                <td>${statusBadge}</td>
                <td>${u.widgetCount}</td>
                <td style="direction:ltr;text-align:right;">${dt.toLocaleString()}</td>
                <td>
                    <button class="action-btn edit" onclick="openEditModal('${u.id}')" title="تعديل"><i class="fas fa-edit"></i></button>
                    <button class="action-btn" onclick="openSessionsModal('${u.id}')" title="أجهزة المستخدم" style="color: #00e5ff;"><i class="fas fa-laptop"></i></button>
                    <button class="action-btn" onclick="openNotificationModal('${u.id}')" title="إرسال إشعار للمستخدم" style="color: #f1c40f;"><i class="fas fa-bell"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        document.getElementById('stats-users').textContent = currentUsers.length;
        document.getElementById('stats-blocked').textContent = blockedCount;
        
    } catch(err) {
        document.getElementById('users-tbody').innerHTML = '<tr><td colspan="7" style="text-align: center;color:#ff4757;">حدث خطأ في تحميل البيانات</td></tr>';
    }
}

async function loadLogs() {
    try {
        const res = await fetch('/api/admin/logs', { headers: { 'x-auth-token': token } });
        if (!res.ok) throw new Error();
        const logs = await res.json();
        
        const container = document.getElementById('logs-container');
        container.innerHTML = '';
        if(logs.length === 0) {
            container.innerHTML = 'لا توجد سجلات حالية.';
            return;
        }
        logs.forEach(lg => {
            let dt = new Date(lg.timestamp);
            let div = document.createElement('div');
            div.className = 'log-entry error';
            div.textContent = `[${dt.toLocaleString()}] ERROR: ${lg.message}`;
            container.appendChild(div);
        });
    } catch(err) {
        document.getElementById('logs-container').textContent = 'فشل في تحميل السجلات.';
    }
}

async function loadClientLogs() {
    try {
        const res = await fetch('/api/admin/client-logs', { headers: { 'x-auth-token': token } });
        if (!res.ok) throw new Error();
        const logs = await res.json();
        
        const container = document.getElementById('client-logs-container');
        container.innerHTML = '';
        if(logs.length === 0) {
            container.innerHTML = 'لا توجد سجلات أعطال حالية.';
            return;
        }
        logs.forEach(lg => {
            let dt = new Date(lg.timestamp);
            let div = document.createElement('div');
            div.className = 'log-entry error';
            div.innerHTML = `[${dt.toLocaleString()}] <strong>V:${lg.appVersion} User:${lg.userId}</strong><br>
            Error: ${lg.error}<br>
            Device: ${lg.deviceInfo?.platform} ${lg.deviceInfo?.deviceName}`;
            container.appendChild(div);
        });
    } catch(err) {
        document.getElementById('client-logs-container').textContent = 'فشل في تحميل السجلات.';
    }
}

async function loadQuota() {
    try {
        const res = await fetch('/api/admin/adafruit-quota', { headers: { 'x-auth-token': token } });
        if (!res.ok) throw new Error();
        const quotas = await res.json();
        let totalRemaining = 0;
        quotas.forEach(q => totalRemaining += q.remaining);
        document.getElementById('stats-quota').textContent = totalRemaining;
    } catch(err) {
        document.getElementById('stats-quota').textContent = 'Error';
    }
}

function openEditModal(id) {
    const user = currentUsers.find(u => u.id === id);
    if (!user) return;
    
    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-user-role').value = user.role || 'user';
    document.getElementById('edit-user-status').value = user.status || 'active';
    
    document.getElementById('admin-permissions-section').style.display = (user.role === 'admin') ? 'block' : 'none';
    
    // clear checkboxes
    ['manage_users', 'manage_roles', 'send_notifications', 'view_logs', 'all'].forEach(p => {
        let el = document.getElementById(`perm-${p.replace('_','-')}`);
        if(el) el.checked = false;
    });

    if (user.adminPermissions) {
        if (user.adminPermissions.includes('*')) document.getElementById('perm-all').checked = true;
        user.adminPermissions.forEach(p => {
            if (p !== '*') {
                let el = document.getElementById(`perm-${p.replace('_','-')}`);
                if (el) el.checked = true;
            }
        });
    }

    const msg = user.adminMessage || {};
    document.getElementById('edit-show-message').value = msg.show !== false ? 'true' : 'false';
    document.getElementById('edit-message-text').value = msg.text || '';
    document.getElementById('edit-message-whatsapp').value = msg.whatsapp || '';
    document.getElementById('edit-message-email').value = msg.email || '';
    
    const msgSection = document.getElementById('ban-message-section');
    msgSection.style.display = (user.status === 'blocked' || user.status === 'suspended') ? 'block' : 'none';
    
    document.getElementById('edit-user-modal').classList.add('show');
}

function closeEditModal() {
    document.getElementById('edit-user-modal').classList.remove('show');
}

function openNotificationModal(targetUserId) {
    document.getElementById('notif-target-user').value = targetUserId;
    document.getElementById('notif-title').value = '';
    document.getElementById('notif-message').value = '';
    document.getElementById('notification-modal').classList.add('show');
}

function closeNotificationModal() {
    document.getElementById('notification-modal').classList.remove('show');
}

async function openSessionsModal(userId) {
    document.getElementById('sessions-container').innerHTML = '<div style="color:white; text-align:center;">جاري تحميل الجلسات...</div>';
    document.getElementById('sessions-modal').classList.add('show');
    try {
        const res = await fetch(`/api/admin/sessions/${userId}`, { headers: { 'x-auth-token': token } });
        const sessions = await res.json();
        
        const container = document.getElementById('sessions-container');
        container.innerHTML = '';
        if(sessions.length === 0) {
            container.innerHTML = '<div style="color:white; text-align:center;">لا توجد جلسات نشطة.</div>';
            return;
        }

        sessions.forEach(s => {
            let dt = new Date(s.lastActivity || s.createdAt);
            let deviceStr = s.deviceInfo?.deviceName ? `${s.deviceInfo.platform} - ${s.deviceInfo.deviceName}` : 'Unknown Device';
            let ipInfo = s.deviceInfo?.ip || 'Unknown IP';
            
            let div = document.createElement('div');
            div.style.background = 'rgba(255,255,255,0.05)';
            div.style.padding = '15px';
            div.style.borderRadius = '8px';
            div.style.border = '1px solid rgba(138,43,226,0.3)';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';

            div.innerHTML = `
                <div style="color: white; line-height: 1.6;">
                    <strong><i class="${s.deviceInfo?.platform === 'web' ? 'fas fa-globe' : 'fas fa-mobile-alt'}"></i> ${deviceStr}</strong><br>
                    <span style="color: #aaa; font-size: 0.9em;">ID: ${s.deviceInfo?.deviceId || 'N/A'}</span><br>
                    <span style="color: #aaa; font-size: 0.9em;">IP: ${ipInfo} | آخر نشاط: ${dt.toLocaleString()}</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary" onclick="logoutSession('${s.id}')" title="إنهاء الجلسة"><i class="fas fa-sign-out-alt"></i></button>
                    ${s.deviceInfo?.deviceId ? `<button class="btn" style="background:#ff4757;color:white;" onclick="banDevice('${s.deviceInfo.deviceId}', '${ipInfo}')" title="حظر الجهاز"><i class="fas fa-ban"></i></button>` : ''}
                </div>
            `;
            container.appendChild(div);
        });
    } catch(err) {
        document.getElementById('sessions-container').innerHTML = '<div style="color:red; text-align:center;">فشل تحميل الجلسات.</div>';
    }
}

function closeSessionsModal() {
    document.getElementById('sessions-modal').classList.remove('show');
}

async function logoutSession(sessionId) {
    if(!confirm('هل أنت متأكد من إنهاء هذه الجلسة؟')) return;
    try {
        const res = await fetch(`/api/admin/logout-device/${sessionId}`, { method: 'DELETE', headers: { 'x-auth-token': token } });
        if(res.ok) {
            alert('تم إنهاء الجلسة.');
            closeSessionsModal();
        } else {
            alert('فشل الإنهاء.');
        }
    } catch(err) {
        alert('حدث خطأ');
    }
}

async function banDevice(deviceId, ip) {
    if(!confirm('هل أنت متأكد من حظر هذا الجهاز؟ سيتم فصله مباشرة ولن يتمكن من الدخول مجدداً.')) return;
    try {
        const res = await fetch(`/api/admin/ban-device`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body: JSON.stringify({ deviceId, ip, reason: 'حظر من لوحة الإدارة' })
        });
        if(res.ok) {
            alert('تم الحظر بنجاح.');
        } else {
            alert('فشل الحظر.');
        }
    } catch(err) {
        alert('حدث خطأ');
    }
}
