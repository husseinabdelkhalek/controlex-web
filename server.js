// بدء تشغيل خادم لوحة التحكم الذكية - النسخة المحدثة...
require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const http = require('http');
const socketIo = require('socket.io');
const passport = require('passport');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const { FirestoreStore } = require('@google-cloud/connect-firestore');
const serviceAccount = require('./firebase-adminsdk.json');

// تأكد من أن مخرجات console.log تعرض الأحرف العربية بشكل صحيح
process.stdout.setEncoding('utf8');

// تهيئة Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || ''
});

const db = admin.firestore();
// ✅ تفعيل خاصية ignoreUndefinedProperties لتجنب أخطاء القيم undefined
db.settings({ ignoreUndefinedProperties: true });

const Users = db.collection('Users');
const Widgets = db.collection('Widgets');
const TerminalMessages = db.collection('TerminalMessages');
const Sessions = db.collection('Sessions');
const ResetCodes = db.collection('ResetCodes');
const Notifications = db.collection('Notifications');
const ClientLogs = db.collection('ClientLogs');
const BannedDevices = db.collection('BannedDevices');
const SystemStats = db.collection('SystemStats');

console.log('✅ تم تهيئة Firebase Admin SDK بنجاح');

const app = express();
app.enable('trust proxy'); 

// ✅ تفعيل حماية Helmet (رؤوس HTTP آمنة)
app.use(helmet({
  contentSecurityPolicy: false, // سنترك إعدادات CSP اليدوية كما هي
}));

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000', // السماح بالاتصال من الواجهة الأمامية
    methods: ['GET', 'POST']
  }
});

// الملفات الثابتة (Static Files)
// تقديم جميع الملفات الموجودة داخل مجلد 'public'
app.use(express.static(path.join(__dirname, 'public')));

// سياسة أمان المحتوى (Content Security Policy)
// إعداد سياسة أمان المحتوى لمنع هجمات XSS وغيرها من الثغرات.
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://unpkg.com https://cdn.socket.io https://fonts.googleapis.com; " +
    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
    "img-src 'self' data: https:; " + // السماح بالصور من self و data URIs و HTTPS
    "connect-src 'self' https://io.adafruit.com https://unpkg.com ws: wss: https://cdn.socket.io;" // السماح بالاتصال بـ Adafruit IO و Socket.IO و unpkg
  );
  next();
});

// تحليل نص الطلب (Body Parsing) و CORS
// تمكين تحليل JSON و URL-encoded bodies وتكوين CORS.
app.use(express.json({ limit: '50mb' })); // لتمكين استقبال JSON في الطلبات
app.use(express.urlencoded({ extended: true })); // لتمكين استقبال بيانات النماذج
app.use(cors({
  origin: [
    process.env.CLIENT_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8080'
  ],
  credentials: true, // السماح بإرسال ملفات تعريف الارتباط
  allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization'] // السماح برؤوس معينة
}));

// START: SECURITY MIDDLEWARES
// تحديد عدد الطلبات المسموح بها للمسارات الحساسة (Login/Register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 20, // أقصى عدد طلبات من نفس الـ IP
  message: { msg: 'طلبات كثيرة جداً، يرجى المحاولة بعد 15 دقيقة.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// تطبيق الـ limiter على مسارات المصادقة فقط
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// START: PASSPORT & SESSION CONFIG
app.use(session({
    store: new FirestoreStore({
        dataset: db,
        kind: 'Sessions' // اسم الكولكشن اللي هيتحط فيها الجلسات
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

app.use(passport.initialize());
app.use(passport.session());
// استبدل Google Strategy الموجودة بهذه النسخة المحدثة:
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback',
    scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // البحث بناءً على googleId
        const googleUserSnapshot = await Users.where('googleId', '==', profile.id).limit(1).get();
        let user = null;
        
        if (!googleUserSnapshot.empty) {
            user = googleUserSnapshot.docs[0];
            // تحديث صورة المستخدم الموجود
            await Users.doc(user.id).update({
                googleProfilePicture: profile.photos && profile.photos[0] ? profile.photos[0].value : null
            });
            return done(null, { id: user.id, ...user.data() });
        }

        // البحث بناءً على البريد الإلكتروني
        const emailUserSnapshot = await Users.where('email', '==', profile.emails[0].value).limit(1).get();
        
        if (!emailUserSnapshot.empty) {
            user = emailUserSnapshot.docs[0];
            // ربط حساب جوجل بالحساب الموجود
            await Users.doc(user.id).update({
                googleId: profile.id,
                googleProfilePicture: profile.photos && profile.photos[0] ? profile.photos[0].value : null
            });
            return done(null, { id: user.id, ...user.data() });
        }

        // إنشاء مستخدم جديد
        const newUserRef = Users.doc();
        const newUserData = {
            id: newUserRef.id,
            googleId: profile.id,
            username: profile.displayName,
            email: profile.emails[0].value,
            googleEmail: profile.emails[0].value,
            googleProfilePicture: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
            password: '',
            adafruitUsername: '',
            adafruitApiKey: '',
            role: profile.emails[0].value.toLowerCase() === 'hussianabdk577@gmail.com' ? 'admin' : 'user',
            status: 'active',
            adminMessage: { show: true, text: 'حسابك معلق حالياً. يرجى التواصل مع المسؤول.', email: 'hussianabdk577@gmail.com', whatsapp: '' },
            security: {
                lastLogin: admin.firestore.Timestamp.now(),
                loginAttempts: 0,
                twoFactorEnabled: false
            },
            preferences: {
                theme: 'dark',
                privacy: {
                    allowDataCollection: false,
                    emailNotifications: true,
                    securityAlerts: true
                }
            },
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
        };
        
        await newUserRef.set(newUserData);
        return done(null, newUserData);
    } catch (err) {
        console.error('❌ خطأ في Google Strategy:', err);
        return done(err, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const userDoc = await Users.doc(id).get();
        if (userDoc.exists) {
            done(null, { id: userDoc.id, ...userDoc.data() });
        } else {
            done(null, null);
        }
    } catch (err) {
        console.error('❌ خطأ في deserializeUser:', err);
        done(err, null);
    }
});
// END: PASSPORT & SESSION CONFIG

// Firestore Collections مهيأة بالفعل أعلاه
// Users, Widgets, TerminalMessages, Sessions, ResetCodes

// خدمة المصادقة (AuthService)
const AuthService = {
  // تشفير كلمة المرور
  hashPassword: password => bcrypt.hash(password, 12),
  // التحقق من كلمة المرور
  verifyPassword: (password, hash) => bcrypt.compare(password, hash),
  // توليد رمز JWT (JSON Web Token)
  generateJWT: payload => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '3650d' }),
  // التحقق من رمز JWT
  verifyJWT: token => jwt.verify(token, process.env.JWT_SECRET),
  // توليد رمز إعادة تعيين مكون من 6 أرقام
  generateResetCode: () => Math.floor(100000 + Math.random() * 900000).toString()
};

// وسيط المصادقة (Auth Middleware)
// وظيفة وسيط للتحقق من رمز المصادقة (JWT) في كل طلب.
const auth = async (req, res, next) => {
  try {
    const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '') || req.query.token;

    if (!token) return res.status(401).json({ msg: 'لا يوجد رمز مصادقة، الوصول مرفوض.' });

    const decoded = AuthService.verifyJWT(token);
    const userDoc = await Users.doc(decoded.id).get();
    
    if (!userDoc.exists) return res.status(401).json({ msg: 'رمز مصادقة غير صالح.' });

    const userData = { id: userDoc.id, ...userDoc.data() };

    // التحقق من وجود جلسة نشطة لهذا الرمز
    if (!req.query.token) {
        const sessionSnapshot = await Sessions.where('userId', '==', userDoc.id)
            .where('token', '==', token)
            .where('isActive', '==', true)
            .limit(1).get();
            
        if (sessionSnapshot.empty) {
          return res.status(401).json({ msg: 'الجلسة منتهية أو غير نشطة، يرجى تسجيل الدخول مرة أخرى.' });
        }
        
        // تحديث وقت النشاط للجلسة
        const sessionDoc = sessionSnapshot.docs[0];
        const sessionData = sessionDoc.data();
        
        // التحقق من الحظر هنا
        if (await isDeviceBanned(req.ip, sessionData.deviceInfo?.deviceId)) {
             return res.status(403).json({ msg: 'هذا الجهاز أو الـ IP محظور.', blocked: true });
        }

        await Sessions.doc(sessionDoc.id).update({
            lastActivity: admin.firestore.Timestamp.now()
        });
    }

    req.user = userData; // إضافة معلومات المستخدم إلى كائن الطلب
    next(); // المتابعة إلى المسار التالي
  } catch (err) {
    console.error('خطأ في المصادقة:', err);
    res.status(401).json({ msg: 'رمز مصادقة غير صالح أو منتهي الصلاحية.' });
  }
};

// ناقل Nodemailer
// إعداد ناقل البريد الإلكتروني لإرسال رسائل إعادة تعيين كلمة المرور.
const transporter = nodemailer.createTransport({
  service: 'gmail', // يمكنك استخدام خدمات أخرى أو إعداد SMTP يدوي
  auth: {
    user: process.env.EMAIL_USER, // بريد إلكتروني لإرسال الرسائل
    pass: process.env.EMAIL_PASS // كلمة مرور التطبيق أو كلمة المرور العادية
  }
});

// التعامل مع Socket.IO
// إدارة الاتصالات في الوقت الفعلي باستخدام Socket.IO.
io.on('connection', socket => {
  console.log(`👤 مستخدم متصل: ${socket.id}`);

  // الانضمام إلى غرفة خاصة بالمستخدم لتلقي التحديثات
  socket.on('join-user-room', userId => {
    socket.join(`user-${userId}`);
    console.log(`Socket ${socket.id} joined room user-${userId}`);
  });

  // استقبال تحديثات من الواجهة الأمامية وإعادة بثها (مثلاً تحديث حالة أداة)
  socket.on('widget-update', data => {
    io.to(`user-${data.userId}`).emit('widget-status-update', data);
  });

  // استقبال تحديثات قراءة المستشعرات من الواجهة الأمامية وإعادة بثها
  socket.on('sensor-reading-update', data => {
    io.to(`user-${data.userId}`).emit('new-sensor-reading', data);
  });


  socket.on('disconnect', () => {
    console.log(`👤 مستخدم منقطع: ${socket.id}`);
  });
});

// مسارات HTML الثابتة
// توجيه الطلبات إلى ملفات HTML الثابتة من المجلد الأساسي.
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/settings', (req, res) => res.sendFile(path.join(__dirname, 'settings.html')));
app.get('/account', (req, res) => res.sendFile(path.join(__dirname, 'account.html')));
app.get('/forgot-password', (req, res) => res.sendFile(path.join(__dirname, 'forgot-password.html')));
app.get('/reset-password', (req, res) => res.sendFile(path.join(__dirname, 'reset-password.html')));
app.get('/offline', (req, res) => res.sendFile(path.join(__dirname, 'offline.html')));

// START: GOOGLE AUTH ROUTES
// المسار الجديد لربط حساب جوجل بمستخدم مسجل دخوله بالفعل
app.get('/auth/google/link', 
  auth, // <-- أولاً، نتأكد أن المستخدم مسجل دخوله
  (req, res, next) => {
    // نحفظ معرف المستخدم الحالي في الجلسة لنستخدمه لاحقًا بعد العودة من جوجل
    req.session.linkingUserId = req.user.id;
    // الآن، نبدأ عملية المصادقة مع جوجل
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  }
);

app.get('/auth/google',
    passport.authenticate('google'));

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    async (req, res) => {
        // -->> هذا هو المنطق الجديد والمهم <<--
        // الحالة الأولى: المستخدم يقوم بربط حسابه (لأننا حفظنا ID في الجلسة)
        if (req.session.linkingUserId) {
            try {
                const linkingUserDoc = await Users.doc(req.session.linkingUserId).get();
                
                if (!linkingUserDoc.exists) {
                    delete req.session.linkingUserId;
                    return res.redirect('/account');
                }

                const linkingUser = linkingUserDoc.data();
                const googleProfileId = req.user.id; // هذا يأتي من ملف جوجل الشخصي

                // تحقق مما إذا كان حساب جوجل هذا مربوطًا بالفعل بحساب آخر
                const googleAccountSnapshot = await Users.where('googleId', '==', googleProfileId).limit(1).get();
                
                if (!googleAccountSnapshot.empty) {
                    const googleAccountDoc = googleAccountSnapshot.docs[0];
                    if (googleAccountDoc.id !== linkingUserDoc.id) {
                        // مسح ID من الجلسة لمنع المحاولات المستقبلية الخاطئة
                        delete req.session.linkingUserId;
                        // أعد توجيه المستخدم برسالة خطأ
                        return res.send(`<script>alert('هذا الحساب في جوجل مربوط بالفعل بحساب آخر.'); window.location.href = '/account';</script>`);
                    }
                }

                // ربط الحساب وتخزين الإيميل
                await Users.doc(linkingUserDoc.id).update({
                    googleId: googleProfileId,
                    googleEmail: req.user.email,
                    googleProfilePicture: req.user.googleProfilePicture
                });

                // مسح ID من الجلسة بعد إتمام العملية بنجاح
                delete req.session.linkingUserId;
                
                // إعادة التوجيه إلى صفحة الحساب
                return res.redirect('/account');

            } catch (err) {
                console.error("Error during Google account linking:", err);
                return res.redirect('/account');
            }
        }

        // الحالة الثانية: تسجيل دخول أو تسجيل حساب جديد (السلوك القديم)
        const user = req.user;
        if (user.status === 'blocked' || user.status === 'suspended') {
             return res.send(`<script>
                 alert('${user.adminMessage?.show ? user.adminMessage.text : "تم إيقاف حسابك."}\\nللإستفسار قم بمراسلة الإدارة.');
                 window.location.href = '/';
             </script>`);
        }
        const token = AuthService.generateJWT({ id: user.id });

        const newSessionRef = Sessions.doc();
        await newSessionRef.set({
            userId: user.id,
            token,
            deviceInfo: { userAgent: req.get('User-Agent'), ip: req.ip },
            isActive: true,
            lastActivity: admin.firestore.Timestamp.now(),
            expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
            createdAt: admin.firestore.Timestamp.now()
        });

        if (!user.password) {
            res.send(`<script>localStorage.setItem('token', '${token}'); window.location.href = '/?complete_signup=true';</script>`);
        } else {
            res.send(`<script>localStorage.setItem('token', '${token}'); window.location.href = '/dashboard';</script>`);
        }
    }
);
// END: GOOGLE AUTH ROUTES

// مسارات API

// START: GOOGLE SIGNUP COMPLETION & UNLINK
app.post('/api/auth/complete-google-signup', auth, async (req, res) => {
    try {
        const { password, adafruitUsername, adafruitApiKey } = req.body;
        if (!password || password.length < 6) {
            return res.status(400).json({ msg: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' });
        }

        const hashed = await AuthService.hashPassword(password);
        
        await Users.doc(req.user.id).update({
            password: hashed,
            adafruitUsername: adafruitUsername || req.user.adafruitUsername || '',
            adafruitApiKey: adafruitApiKey || req.user.adafruitApiKey || ''
        });

        res.json({ msg: 'تم إكمال التسجيل بنجاح.' });
    } catch (err) {
        res.status(500).json({ msg: 'خطأ في الخادم' });
    }
});

app.post('/api/user/unlink-google', auth, async (req, res) => {
    try {
        const { password } = req.body;
        const userDoc = await Users.doc(req.user.id).get();
        const user = { id: userDoc.id, ...userDoc.data() };

        if (!user.password) {
            return res.status(400).json({ msg: 'لا يمكنك فك الربط لأنه لا توجد كلمة مرور محلية. يرجى تعيين واحدة أولاً.' });
        }

        const isMatch = await AuthService.verifyPassword(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'كلمة المرور غير صحيحة.' });
        }

        // حذف كل من معرف جوجل وبريد جوجل
        await Users.doc(user.id).update({
            googleId: '',
            googleEmail: '',
            googleProfilePicture: ''
        });
        res.json({ msg: 'تم فك ربط حساب جوجل بنجاح.' });
    } catch (err) {
        res.status(500).json({ msg: 'خطأ في الخادم' });
    }
});
// END: GOOGLE SIGNUP COMPLETION & UNLINK

// ✅ NEW: Mobile Google Sign-In via Firebase ID Token
// Flutter app sends the Firebase ID Token → server verifies it → returns JWT
app.post('/api/auth/google/mobile', async (req, res) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ msg: 'Firebase ID Token مطلوب.' });
        }

        // Verify the Firebase ID Token using Firebase Admin SDK
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch (verifyErr) {
            console.error('❌ Firebase token verification failed:', verifyErr.message);
            return res.status(401).json({ msg: 'رمز المصادقة من جوجل غير صالح.' });
        }

        const { uid, email, name, picture } = decodedToken;

        if (!email) {
            return res.status(400).json({ msg: 'لم يتم الحصول على البريد الإلكتروني من جوجل.' });
        }

        // Check if user exists by googleId
        let userDoc = null;
        const googleSnapshot = await Users.where('googleId', '==', uid).limit(1).get();

        if (!googleSnapshot.empty) {
            // User found by Google ID — update and login
            userDoc = googleSnapshot.docs[0];
            await Users.doc(userDoc.id).update({
                googleProfilePicture: picture || '',
                'security.lastLogin': admin.firestore.Timestamp.now()
            });
        } else {
            // Check by email
            const emailSnapshot = await Users.where('email', '==', email.toLowerCase()).limit(1).get();

            if (!emailSnapshot.empty) {
                // Existing account with same email — link Google ID
                userDoc = emailSnapshot.docs[0];
                await Users.doc(userDoc.id).update({
                    googleId: uid,
                    googleEmail: email,
                    googleProfilePicture: picture || '',
                    'security.lastLogin': admin.firestore.Timestamp.now()
                });
            } else {
                // New user — create account
                const newUserRef = Users.doc();
                const newUserData = {
                    id: newUserRef.id,
                    googleId: uid,
                    username: name || email.split('@')[0],
                    email: email.toLowerCase(),
                    googleEmail: email.toLowerCase(),
                    googleProfilePicture: picture || '',
                    password: '',
                    adafruitUsername: '',
                    adafruitApiKey: '',
                    role: email.toLowerCase() === 'hussianabdk577@gmail.com' ? 'admin' : 'user',
                    status: 'active',
                    adminMessage: { show: true, text: 'حسابك معلق حالياً. يرجى التواصل مع المسؤول.', email: 'hussianabdk577@gmail.com', whatsapp: '' },
                    security: {
                        lastLogin: admin.firestore.Timestamp.now(),
                        loginAttempts: 0,
                        twoFactorEnabled: false
                    },
                    preferences: {
                        theme: 'dark',
                        privacy: {
                            allowDataCollection: false,
                            emailNotifications: true,
                            securityAlerts: true
                        }
                    },
                    createdAt: admin.firestore.Timestamp.now(),
                    updatedAt: admin.firestore.Timestamp.now()
                };
                await newUserRef.set(newUserData);

                // Return token with flag for new users
                const token = AuthService.generateJWT({ id: newUserRef.id });
                const sessionRef = Sessions.doc();
                await sessionRef.set({
                    userId: newUserRef.id, token,
                    deviceInfo: { userAgent: req.get('User-Agent'), ip: req.ip },
                    isActive: true,
                    lastActivity: admin.firestore.Timestamp.now(),
                    expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
                    createdAt: admin.firestore.Timestamp.now()
                });

                console.log(`✅ New Google user created: ${email}`);
                return res.json({ token, isNewUser: true, user: { id: newUserRef.id, username: newUserData.username } });
            }
        }

        const user = { id: userDoc.id, ...userDoc.data() };
        
        if (user.status === 'blocked' || user.status === 'suspended') {
             return res.status(403).json({
                 msg: user.adminMessage?.show ? user.adminMessage.text : 'حسابك معلق حالياً. يرجى التواصل مع المسؤول.',
                 adminContact: user.adminMessage?.show ? { email: user.adminMessage.email, whatsapp: user.adminMessage.whatsapp } : null,
                 blocked: true
             });
        }

        // --- START 2FA LOGIC FOR GOOGLE ---
        if (user.security?.twoFactorEnabled) {
          const code = AuthService.generateResetCode();
          
          await Users.doc(user.id).update({
            'security.twoFactorCode': code,
            'security.twoFactorCodeExpires': admin.firestore.Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000))
          });

          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'رمز التحقق لتسجيل الدخول (Google)',
            html: `<p>رمز التحقق الخاص بك هو: <strong>${code}</strong>. وهو صالح لمدة 10 دقائق.</p>`
          };
          await transporter.sendMail(mailOptions);

          console.log(`2FA code for Google user ${user.email}: ${code}`);
          return res.json({ twoFactorRequired: true, email: user.email, msg: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني.' });
        }
        // --- END 2FA LOGIC FOR GOOGLE ---

        const token = AuthService.generateJWT({ id: user.id });

        const sessionRef = Sessions.doc();
        await sessionRef.set({
            userId: user.id, token,
            deviceInfo: { 
                 userAgent: req.get('User-Agent'), 
                 ip: req.ip,
                 deviceId: deviceInfo?.deviceId || null,
                 deviceName: deviceInfo?.deviceName || null,
                 platform: deviceInfo?.platform || null
            },
            isActive: true,
            lastActivity: admin.firestore.Timestamp.now(),
            expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
            createdAt: admin.firestore.Timestamp.now()
        });

        console.log(`✅ Google mobile login: ${email}`);
        res.json({ token, isNewUser: false, user: { id: user.id, username: user.username } });

    } catch (err) {
        console.error('❌ خطأ في Google Mobile Auth:', err);
        res.status(500).json({ msg: `خطأ في الخادم: ${err.message || err}` });
    }
});
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, email, adafruitUsername, adafruitApiKey, deviceInfo } = req.body;

        // التحقق من الحظر
        const isBanned = await isDeviceBanned(req.ip, deviceInfo?.deviceId);
        if (isBanned) {
             return res.status(403).json({ msg: 'هذا الجهاز محظور.', blocked: true });
        }

        // ✅ فقط username, password, email مطلوبين
        if (!username || !password || !email) {
            return res.status(400).json({ msg: 'الرجاء إدخال جميع الحقول المطلوبة' });
        }

        if (password.length < 6) {
            return res.status(400).json({ msg: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل' });
        }

        // التحقق من عدم وجود مستخدم بنفس البريد الإلكتروني أو اسم المستخدم
        const emailSnapshot = await Users.where('email', '==', email.toLowerCase()).limit(1).get();
        const usernameSnapshot = await Users.where('username', '==', username).limit(1).get();

        if (!emailSnapshot.empty || !usernameSnapshot.empty) {
            return res.status(400).json({ msg: 'المستخدم موجود بالفعل' });
        }

        const hashed = await AuthService.hashPassword(password);
        const newUserRef = Users.doc();
        
        const userData = {
            id: newUserRef.id,
            username: username.trim(),
            email: email.toLowerCase().trim(),
            password: hashed,
            adafruitUsername: adafruitUsername ? adafruitUsername.trim() : '',
            adafruitApiKey: adafruitApiKey ? adafruitApiKey.trim() : '',
            googleId: '',
            googleEmail: '',
            googleProfilePicture: '',
            role: email.toLowerCase().trim() === 'hussianabdk577@gmail.com' ? 'admin' : 'user',
            status: 'active',
            adminMessage: { show: true, text: 'حسابك معلق حالياً. يرجى التواصل مع المسؤول.', email: 'hussianabdk577@gmail.com', whatsapp: '' },
            security: {
                lastLogin: admin.firestore.Timestamp.now(),
                loginAttempts: 0,
                twoFactorEnabled: false
            },
            preferences: {
                theme: 'dark',
                privacy: {
                    allowDataCollection: false,
                    emailNotifications: true,
                    securityAlerts: true
                }
            },
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
        };

        await newUserRef.set(userData);
        res.status(201).json({ msg: 'تم إنشاء الحساب بنجاح' });

    } catch (err) {
        console.error('خطأ في التسجيل:', err);
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
});
// مسح جميع بيانات المستخدم (ما عدا الحساب وأيام النشاط)
app.post('/api/user/clear-data', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 1. حذف جميع الـ Widgets
        const widgetsSnapshot = await Widgets.where('userId', '==', userId).get();
        const batch = db.batch();
        
        widgetsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // 2. حذف جميع رسائل Terminal
        const messagesSnapshot = await TerminalMessages.where('userId', '==', userId).get();
        messagesSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        
        // 3. تحديث بيانات المستخدم (إعادة تعيين Adafruit بدون التأثير على الحساب)
        const userDoc = await Users.doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ msg: 'المستخدم غير موجود' });
        }
        
        await Users.doc(userId).update({
            adafruitUsername: '',
            adafruitApiKey: ''
        });
        
        // 4. إرسال إشعار عبر Socket.IO
        io.to(`user-${userId}`).emit('data-cleared', {
            message: 'تم مسح جميع البيانات بنجاح',
            timestamp: new Date()
        });
        
        res.json({ 
            msg: 'تم مسح جميع البيانات بنجاح!',
            deletedWidgets: widgetsSnapshot.size,
            clearedAt: new Date()
        });
        
    } catch (err) {
        console.error('خطأ في مسح البيانات:', err);
        res.status(500).json({ msg: 'حدث خطأ أثناء مسح البيانات' });
    }
});

// فحص إذا كان الجهاز أو الـ IP محظوراً
async function isDeviceBanned(ip, deviceId) {
    if (ip) {
        const ipBan = await BannedDevices.where('ip', '==', ip).limit(1).get();
        if (!ipBan.empty) return true;
    }
    if (deviceId) {
        const devBan = await BannedDevices.where('deviceId', '==', deviceId).limit(1).get();
        if (!devBan.empty) return true;
    }
    return false;
}

// تسجيل الدخول (Login)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, deviceInfo } = req.body;
    if (!email || !password) {
      return res.status(400).json({ msg: 'البريد الإلكتروني وكلمة المرور مطلوبان.' });
    }

    // التحقق من الحظر
    const isBanned = await isDeviceBanned(req.ip, deviceInfo?.deviceId);
    if (isBanned) {
      return res.status(403).json({ msg: 'هذا الجهاز أو الحساب محظور من استخدام النظام.', blocked: true });
    }

    const userSnapshot = await Users.where('email', '==', email.toLowerCase()).limit(1).get();
    
    if (userSnapshot.empty) {
      return res.status(400).json({ msg: 'بيانات اعتماد غير صحيحة.' });
    }

    const userDoc = userSnapshot.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() };
    
    if (user.status === 'blocked' || user.status === 'suspended') {
       return res.status(403).json({
           msg: user.adminMessage?.show ? user.adminMessage.text : 'حسابك معلق حالياً. يرجى التواصل مع المسؤول.',
           adminContact: user.adminMessage?.show ? { email: user.adminMessage.email, whatsapp: user.adminMessage.whatsapp } : null,
           blocked: true
       });
    }

    const isMatch = await AuthService.verifyPassword(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'بيانات اعتماد غير صحيحة.' });
    }

    // --- START 2FA LOGIC ---
    if (user.security?.twoFactorEnabled) {
      const code = AuthService.generateResetCode(); // Generate 6-digit code
      
      await Users.doc(user.id).update({
        'security.twoFactorCode': code,
        'security.twoFactorCodeExpires': admin.firestore.Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000))
      });

      // Send email with the code
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'رمز التحقق لتسجيل الدخول',
        html: `<p>رمز التحقق الخاص بك هو: <strong>${code}</strong>. وهو صالح لمدة 10 دقائق.</p>`
      };
      await transporter.sendMail(mailOptions);

      if (process.env.NODE_ENV !== 'production') {
        console.log(`2FA code for ${user.email}: ${code}`);
      }
      // Respond that 2FA is needed, without sending the token
      return res.status(200).json({ twoFactorRequired: true, msg: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني.' });
    }
    // --- END 2FA LOGIC ---

    // If 2FA is not enabled, log in directly
    const token = AuthService.generateJWT({ id: user.id });
    const newSessionRef = Sessions.doc();
    
    await newSessionRef.set({
      userId: user.id,
      token,
      deviceInfo: {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        deviceId: deviceInfo?.deviceId || null,
        deviceName: deviceInfo?.deviceName || null,
        platform: deviceInfo?.platform || null
      },
      isActive: true,
      lastActivity: admin.firestore.Timestamp.now(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      createdAt: admin.firestore.Timestamp.now()
    });

    await Users.doc(user.id).update({
      'security.lastLogin': admin.firestore.Timestamp.now()
    });

    res.json({
      token,
      user: { id: user.id, username: user.username }
    });

  } catch (err) {
    console.error('❌ خطأ في تسجيل الدخول:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم.' });
  }
});

// Add this new endpoint for verifying the 2FA code
app.post('/api/auth/verify-2fa', async (req, res) => {
    const { email, twoFactorCode, deviceInfo } = req.body;
    if (!email || !twoFactorCode) {
        return res.status(400).json({ msg: "البريد الإلكتروني والرمز مطلوبان." });
    }

    try {
        const userSnapshot = await Users.where('email', '==', email.toLowerCase()).limit(1).get();
        
        if (userSnapshot.empty) {
            return res.status(400).json({ msg: "الرمز غير صالح أو منتهي الصلاحية." });
        }

        const userDoc = userSnapshot.docs[0];
        const user = { id: userDoc.id, ...userDoc.data() };

        const codeExpires = user.security?.twoFactorCodeExpires?.toDate?.() || null;
        
        if (user.security?.twoFactorCode !== twoFactorCode || !codeExpires || codeExpires < new Date()) {
            return res.status(400).json({ msg: "الرمز غير صالح أو منتهي الصلاحية." });
        }

        // Clear the code
        await Users.doc(user.id).update({
            'security.twoFactorCode': '',
            'security.twoFactorCodeExpires': null
        });

        // If code is correct, issue token and log in
        const token = AuthService.generateJWT({ id: user.id });
        const newSessionRef = Sessions.doc();
        
        await newSessionRef.set({
          userId: user.id,
          token,
          deviceInfo: { 
            userAgent: req.get('User-Agent'), 
            ip: req.ip,
            deviceId: deviceInfo?.deviceId || null,
            deviceName: deviceInfo?.deviceName || null,
            platform: deviceInfo?.platform || null
          },
          isActive: true,
          lastActivity: admin.firestore.Timestamp.now(),
          expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
          createdAt: admin.firestore.Timestamp.now()
        });

        await Users.doc(user.id).update({
          'security.lastLogin': admin.firestore.Timestamp.now()
        });

        res.json({
          token,
          user: { id: user.id, username: user.username }
        });
    } catch (err) {
        console.error('❌ خطأ في التحقق من 2FA:', err);
        res.status(500).json({ msg: 'خطأ في الخادم' });
    }
});

// تسجيل الخروج (Logout)
app.post('/api/auth/logout', auth, async (req, res) => {
  try {
    // تحديد الرمز الحالي كغير نشط في قاعدة البيانات
    const currentToken = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
    
    const sessionSnapshot = await Sessions.where('userId', '==', req.user.id)
        .where('token', '==', currentToken).limit(1).get();
    
    if (!sessionSnapshot.empty) {
        const sessionDoc = sessionSnapshot.docs[0];
        await Sessions.doc(sessionDoc.id).update({
          isActive: false,
          expiresAt: admin.firestore.Timestamp.now()
        });
    }
    
    res.json({ msg: 'تم تسجيل الخروج بنجاح من هذه الجلسة.' });
  } catch (err) {
    console.error('❌ خطأ في عملية تسجيل الخروج:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء تسجيل الخروج.' });
  }
});

// نسيت كلمة المرور (Forgot Password)
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ msg: 'البريد الإلكتروني مطلوب لإعادة تعيين كلمة المرور.' });
    }

    const userSnapshot = await Users.where('email', '==', email.toLowerCase()).limit(1).get();
    
    if (userSnapshot.empty) {
      // لا تخبر المهاجم إذا كان البريد الإلكتروني موجودًا أم لا لأسباب أمنية
      return res.status(400).json({ msg: 'إذا كان البريد الإلكتروني مسجلاً لدينا، فسيتم إرسال رمز إعادة تعيين كلمة المرور إليه.' });
    }

    const userDoc = userSnapshot.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() };

    // توليد رمز إعادة تعيين فريد
    const code = AuthService.generateResetCode();
    // حفظ الرمز في قاعدة البيانات مع وقت انتهاء صلاحية
    const newResetCodeRef = ResetCodes.doc();
    await newResetCodeRef.set({
      email: email.toLowerCase(),
      code,
      createdAt: admin.firestore.Timestamp.now()
    });

    // طباعة الرمز في الـ console لأغراض التطوير والاختبار.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n==================================================`);
      console.log(`🔑 رمز إعادة التعيين الجديد لـ ${email}`);
      console.log(`🔢 الرمز: ${code}`);
      console.log(`⏱️ انتهاء الصلاحية: ${new Date(Date.now() + 10 * 60 * 1000).toLocaleString('ar-EG')}`);
      console.log(`==================================================\n`);
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'رمز إعادة تعيين كلمة المرور - controlex',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height:1.6; color:#333; max-width:600px; margin:auto; padding:20px; border:1px solid #ddd; border-radius:8px; background:#f9f9f9;">
          <h2 style="color: #4CAF50; text-align:center;">طلب إعادة تعيين كلمة المرور</h2>
          <p>مرحباً ${user.username || 'بالمستخدم'},</p>
          <p>لقد تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك في <strong>controlex</strong>.</p>
          <p>رمز التحقق الخاص بك هو:</p>
          <p style="font-size:28px; font-weight:bold; color:#007bff; text-align:center; margin:25px 0; padding:10px; background-color:#e9f7ff; border-radius:5px;">${code}</p>
          <p>هذا الرمز صالح لمدة <strong>10 دقائق فقط</strong>. يرجى عدم مشاركة هذا الرمز مع أي شخص.</p>
          <p>إذا لم تطلب ذلك، يرجى تجاهل هذا البريد الإلكتروني أو الاتصال بنا على الفور إذا كنت تشك في وجود نشاط غير مصرح به.</p>
          <p style="font-size:0.9em; color:#777; margin-top:30px;">شكراً لك،<br>فريق دعم controlex</p>
          <p style="text-align:center; border-top:1px solid #eee; padding-top:15px; margin-top:25px; font-size:0.8em; color:#555;">&copy; ${new Date().getFullYear()} controlex. جميع الحقوق محفوظة.</p>
        </div>`
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ تم إرسال الرمز إلى: ${email}`);
      res.json({ msg: 'تم إرسال رمز إعادة التعيين إلى بريدك الإلكتروني. يرجى التحقق من صندوق الوارد الخاص بك (وقسم الرسائل غير المرغوب فيها/البريد العشوائي).' });
    } catch (emailErr) {
      console.error('❌ خطأ في إرسال البريد الإلكتروني لنسيت كلمة المرور:', emailErr);
      res.status(500).json({ msg: 'فشل في إرسال رمز إعادة التعيين. يرجى التأكد من صحة البريد الإلكتروني والمحاولة مرة أخرى لاحقًا.' });
    }
  } catch (err) {
    console.error('❌ خطأ عام في مسار "نسيت كلمة المرور":', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.' });
  }
});

// التحقق من رمز إعادة التعيين (Verify Reset Code)
app.post('/api/auth/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ msg: 'البريد الإلكتروني والرمز مطلوبان للتحقق.' });
    }

    // البحث عن الرمز والتحقق من صلاحيته (لم تنتهي صلاحيته بعد)
    const resetCodeSnapshot = await ResetCodes.where('email', '==', email.toLowerCase())
        .where('code', '==', code).limit(1).get();

    if (resetCodeSnapshot.empty) {
      return res.status(400).json({ msg: 'الرمز غير صالح أو منتهي الصلاحية. يرجى طلب رمز جديد.' });
    }

    const resetCodeDoc = resetCodeSnapshot.docs[0];
    const createdAt = resetCodeDoc.data().createdAt?.toDate?.() || new Date(resetCodeDoc.data().createdAt);
    
    // تحقق من أن الرمز لا يزال صالحاً (10 دقائق)
    if (new Date() - createdAt > 10 * 60 * 1000) {
      await ResetCodes.doc(resetCodeDoc.id).delete();
      return res.status(400).json({ msg: 'الرمز غير صالح أو منتهي الصلاحية. يرجى طلب رمز جديد.' });
    }

    res.json({ msg: 'تم التحقق من الرمز بنجاح. يمكنك الآن تعيين كلمة مرور جديدة.' });
  } catch (err) {
    console.error('❌ خطأ في التحقق من رمز إعادة التعيين:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء التحقق من الرمز. يرجى المحاولة مرة أخرى.' });
  }
});

// إعادة تعيين كلمة المرور (Reset Password)
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword, confirmPassword } = req.body;
    if (!email || !code || !newPassword || !confirmPassword) {
      return res.status(400).json({ msg: 'جميع الحقول مطلوبة لإعادة تعيين كلمة المرور (البريد الإلكتروني، الرمز، كلمة المرور الجديدة، تأكيد كلمة المرور).' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ msg: 'كلمتا المرور الجديدتان غير متطابقتين. يرجى التأكد من تطابقهما.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ msg: 'يجب أن تكون كلمة المرور الجديدة 6 أحرف على الأقل.' });
    }

    const userSnapshot = await Users.where('email', '==', email.toLowerCase()).limit(1).get();
    if (userSnapshot.empty) {
      return res.status(404).json({ msg: 'المستخدم غير موجود.' });
    }

    const userDoc = userSnapshot.docs[0];

    const resetCodeSnapshot = await ResetCodes.where('email', '==', email.toLowerCase())
        .where('code', '==', code).limit(1).get();
        
    if (resetCodeSnapshot.empty) {
      return res.status(400).json({ msg: 'الرمز غير صالح أو منتهي الصلاحية. يرجى طلب رمز جديد.' });
    }

    const resetCodeDoc = resetCodeSnapshot.docs[0];
    const createdAt = resetCodeDoc.data().createdAt?.toDate?.() || new Date(resetCodeDoc.data().createdAt);
    
    // تحقق من أن الرمز لا يزال صالحاً (10 دقائق)
    if (new Date() - createdAt > 10 * 60 * 1000) {
      await ResetCodes.doc(resetCodeDoc.id).delete();
      return res.status(400).json({ msg: 'الرمز غير صالح أو منتهي الصلاحية. يرجى طلب رمز جديد.' });
    }

    // تحديث كلمة المرور وحذف الرمز من قاعدة البيانات
    const hashed = await AuthService.hashPassword(newPassword);
    await Users.doc(userDoc.id).update({
      password: hashed
    });
    await ResetCodes.doc(resetCodeDoc.id).delete(); // حذف الرمز بعد الاستخدام الناجح

    res.json({ msg: 'تم تحديث كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.' });
  } catch (err) {
    console.error('❌ خطأ في عملية إعادة تعيين كلمة المرور:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء إعادة تعيين كلمة المرور. يرجى المحاولة مرة أخرى.' });
  }
});


// إدارة الأدوات (Widgets CRUD)

// جلب جميع الأدوات الخاصة بالمستخدم
app.get('/api/widgets', auth, async (req, res) => {
  try {
    const widgetsSnapshot = await Widgets.where('userId', '==', req.user.id).orderBy('createdAt', 'desc').get();
    
    const widgets = widgetsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
      'state.lastUpdate': doc.data().state?.lastUpdate?.toDate?.() || doc.data().state?.lastUpdate
    }));
    
    res.json(widgets);
  } catch (err) {
    console.error('❌ خطأ في جلب الأدوات:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء جلب الأدوات.' });
  }
});

app.post('/api/widgets', auth, async (req, res) => {
  try {
    const { name, feedName, type, icon, primaryColor, activeColor, glowColor, unit, onCommand, offCommand, configuration, joystickCommands } = req.body;

    if (!name || !feedName || !type) {
      return res.status(400).json({ msg: 'اسم الأداة، اسم المجرى، والنوع هي حقول مطلوبة.' });
    }
    
    const newWidgetRef = Widgets.doc();
    const widgetData = {
      id: newWidgetRef.id,
      userId: req.user.id,
      name: name.trim(),
      feedName: feedName.trim(),
      type: type,
      icon: icon || 'fas fa-toggle-on',
      appearance: {
        primaryColor: primaryColor || '#8A2BE2',
        activeColor: (type === 'toggle' || type === 'push') ? (activeColor || '#00e5ff') : undefined,
        glowColor: glowColor || '#8A2BE2'
      },
      configuration: {
        onCommand: onCommand || (type === 'push' ? 'PUSH' : 'ON'),
        offCommand: (type === 'toggle') ? (offCommand || 'OFF') : '',
        unit: unit || ''
      },
      gs: {
        x: 0,
        y: 0,
        w: 1,
        h: 1
      },
      state: {
        isActive: false,
        lastValue: null,
        lastUpdate: admin.firestore.Timestamp.now()
      },
      analytics: {
        totalCommands: 0,
        successfulCommands: 0
      },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    // دمج إعدادات السلايدر إذا كان النوع هو سلايدر
    if (type === 'slider') {
        widgetData.configuration.min = configuration?.min !== undefined ? configuration.min : 0;
        widgetData.configuration.max = configuration?.max !== undefined ? configuration.max : 100;
        widgetData.configuration.step = configuration?.step || 1;
    }

    // دمج إعدادات الجويستيك إذا كان النوع هو جويستيك
    if (type === 'joystick' && joystickCommands) {
        widgetData.configuration = { ...widgetData.configuration, ...joystickCommands };
    }

    await newWidgetRef.set(widgetData);

    io.to(`user-${req.user.id}`).emit('widget-added', widgetData);
    res.status(201).json(widgetData);

  } catch (err) {
    console.error('❌ خطأ في إضافة الأداة:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء إضافة الأداة.' });
  }
});
app.put('/api/widgets/:id', auth, async (req, res) => {
  try {
    const { name, feedName, type, icon, primaryColor, activeColor, glowColor, unit, onCommand, offCommand, configuration, joystickCommands } = req.body;

    const widgetDoc = await Widgets.doc(req.params.id).get();
    
    if (!widgetDoc.exists) {
      return res.status(404).json({ msg: 'الأداة غير موجودة أو لا تملك صلاحية لتعديلها.' });
    }

    if (widgetDoc.data().userId !== req.user.id) {
      return res.status(403).json({ msg: 'لا تملك صلاحية لتعديل هذه الأداة.' });
    }

    const updatedData = {
        name: name ? name.trim() : undefined,
        feedName: feedName ? feedName.trim() : undefined,
        type: type,
        icon: icon,
        'appearance.primaryColor': primaryColor,
        'appearance.activeColor': activeColor,
        'appearance.glowColor': glowColor,
        'configuration.onCommand': onCommand,
        'configuration.offCommand': offCommand,
        'configuration.unit': unit,
        // إعدادات السلايدر
        'configuration.min': configuration?.min,
        'configuration.max': configuration?.max,
        'configuration.step': configuration?.step,
        'configuration.defaultValue': configuration?.defaultValue,
        'configuration.showValue': configuration?.showValue,
        'configuration.showTicks': configuration?.showTicks,
        'configuration.color': configuration?.color,
        // إعدادات الجويستيك
        'configuration.upCommand': joystickCommands?.upCommand,
        'configuration.downCommand': joystickCommands?.downCommand,
        'configuration.leftCommand': joystickCommands?.leftCommand,
        'configuration.rightCommand': joystickCommands?.rightCommand,
        'configuration.upRightCommand': joystickCommands?.upRightCommand,
        'configuration.upLeftCommand': joystickCommands?.upLeftCommand,
        'configuration.downRightCommand': joystickCommands?.downRightCommand,
        'configuration.downLeftCommand': joystickCommands?.downLeftCommand,
        updatedAt: admin.firestore.Timestamp.now()
    };

    // إزالة القيم undefined
    Object.keys(updatedData).forEach(key => updatedData[key] === undefined && delete updatedData[key]);

    await Widgets.doc(req.params.id).update(updatedData);

    const updatedWidgetDoc = await Widgets.doc(req.params.id).get();
    const updatedWidget = { id: updatedWidgetDoc.id, ...updatedWidgetDoc.data() };

    io.to(`user-${req.user.id}`).emit('widget-updated', updatedWidget);
    res.json({ msg: 'تم تحديث الأداة بنجاح.', widget: updatedWidget });

  } catch (err) {
    console.error('❌ خطأ في تحديث الأداة:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء تحديث الأداة.' });
  }
});
// حذف أداة
app.delete('/api/widgets/:id', auth, async (req, res) => {
  try {
    const widgetDoc = await Widgets.doc(req.params.id).get();
    
    if (!widgetDoc.exists) {
      return res.status(404).json({ msg: 'الأداة غير موجودة أو لا تملك صلاحية لحذفها.' });
    }

    if (widgetDoc.data().userId !== req.user.id) {
      return res.status(403).json({ msg: 'لا تملك صلاحية لحذف هذه الأداة.' });
    }

    await Widgets.doc(req.params.id).delete();

    io.to(`user-${req.user.id}`).emit('widget-deleted', { widgetId: req.params.id }); // إرسال تحديث لجميع الأجهزة المتصلة

    res.json({ msg: 'تم حذف الأداة بنجاح.' });
  } catch (err) {
    console.error('❌ خطأ في حذف الأداة:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء حذف الأداة.' });
  }
});

// In-memory quota tracker
const userAdafruitQuotas = new Map();

// إرسال الأوامر (Command Sending) إلى Adafruit IO
app.post('/api/command/send', auth, async (req, res) => {
  try {
    const { widgetId, value } = req.body;
    if (!widgetId || value === undefined) {
      return res.status(400).json({ msg: 'معرف الأداة والقيمة مطلوبان لإرسال الأمر.' });
    }

    const widgetDoc = await Widgets.doc(widgetId).get();
    
    if (!widgetDoc.exists) {
      return res.status(404).json({ msg: 'الأداة غير موجودة.' });
    }

    const widget = { id: widgetDoc.id, ...widgetDoc.data() };

    if (widget.userId !== req.user.id) {
      return res.status(403).json({ msg: 'لا تملك صلاحية للتحكم بهذه الأداة.' });
    }

    // التحقق من بيانات Adafruit IO للمستخدم
    if (!req.user.adafruitUsername || !req.user.adafruitApiKey) {
      return res.status(400).json({ msg: 'بيانات اعتماد Adafruit IO (اسم المستخدم ومفتاح API) ناقصة. يرجى تحديث ملفك الشخصي في الإعدادات.' });
    }

    let commandValue = value;

    // معالجة أوامر التبديل (TOGGLE)
    if (value === 'TOGGLE' && widget.type === 'toggle') {
      commandValue = widget.state.isActive
        ? widget.configuration.offCommand
        : widget.configuration.onCommand;
    } else if (widget.type === 'push') {
      commandValue = widget.configuration.onCommand;
    }

    const url = `https://io.adafruit.com/api/v2/${req.user.adafruitUsername}/feeds/${encodeURIComponent(widget.feedName)}/data`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AIO-Key': req.user.adafruitApiKey
      },
      body: JSON.stringify({ value: commandValue }),
      timeout: 10000
    });

    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    if (rateLimitRemaining) {
        userAdafruitQuotas.set(req.user.id, {
            remaining: parseInt(rateLimitRemaining),
            lastUpdated: new Date()
        });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ خطأ من Adafruit IO (${response.status}): ${errorText}`);
      throw new Error(`خطأ في Adafruit IO: ${response.status} - ${response.statusText}. يرجى التحقق من اسم المجرى ومفتاح API.`);
    }

    // تحديث الحالة في الذاكرة لتجنب الكتابة الكثيفة في قاعدة البيانات (لتوفير حصة Firebase)
    let isActiveState = widget.state.isActive;
    if (widget.type === 'toggle') {
      isActiveState = commandValue.toUpperCase() === widget.configuration.onCommand.toUpperCase();
    } else if (widget.type === 'push') {
      isActiveState = true;
      
      // إعادة تعيين حالة الزر بعد 500ms 
      setTimeout(async () => {
        io.to(`user-${req.user.id}`).emit('widget-status-update', {
          widgetId: widget.id,
          isActive: false,
          lastValue: commandValue
        });
      }, 500);
    }

    // إرسال الإشعار للواجهة الأمامية باستخدام Socket.IO
    io.to(`user-${req.user.id}`).emit('widget-status-update', {
      widgetId: widget.id,
      isActive: isActiveState,
      lastValue: commandValue,
      lastUpdate: new Date()
    });
    
    // إرسال كرسالة محطة طرفية للواجهة لو كان من نوع ترمنال
    if (widget.type === 'terminal') {
      io.to(`user-${req.user.id}`).emit('terminal-message', {
        widgetId: widget.id,
        message: commandValue,
        type: 'sent',
        timestamp: new Date()
      });
    }

    res.json({ msg: 'تم إرسال الأمر بنجاح إلى Adafruit IO.', widget });

  } catch (err) {
    console.error('❌ خطأ في إرسال الأمر إلى Adafruit IO:', err.message);
    res.status(500).json({ msg: `حدث خطأ في الخادم أثناء إرسال الأمر: ${err.message}` });
  }
});

// ملف المستخدم الشخصي والإعدادات
// ====== مسارات جديدة لرسائل الترمنال (Terminal Messages Routes) ======

// جلب آخر 50 رسالة لترمنال معين
app.get('/api/terminal/messages/:widgetId', auth, async (req, res) => {
  try {
    const { widgetId } = req.params;
    const userId = req.user.id;

    // تأكد أن الويدجت موجود وينتمي للمستخدم ونوعه 'terminal'
    const widgetDoc = await Widgets.doc(widgetId).get();
    
    if (!widgetDoc.exists || widgetDoc.data().userId !== userId || widgetDoc.data().type !== 'terminal') {
      return res.status(404).json({ msg: 'لم يتم العثور على أداة الترمنال هذه أو لا تملك صلاحية الوصول إليها.' });
    }

    const messagesSnapshot = await TerminalMessages.where('widgetId', '==', widgetId)
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(50).get();
    
    const messages = messagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
    })).reverse(); // عكس الترتيب لعرض الأقدم أولاً

    res.json(messages);

  } catch (err) {
    console.error('❌ خطأ في جلب رسائل الترمنال:', err.message);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء جلب رسائل الترمنال.' });
  }
});
app.get('/api/user/me', auth, async (req, res) => {
    try {
        const userDoc = await Users.doc(req.user.id).get();
        if (!userDoc.exists) return res.status(404).json({ msg: 'المستخدم غير موجود' });

        const user = userDoc.data();
        
        // ✅ الحساب يكون مكتمل إذا كان عنده password
        // (Google users بدون password يعتبروا غير مكتملين)
        const isAccountComplete = !!(user.password);

        const userProfile = {
            id: user.id || userDoc.id,
            username: user.username,
            email: user.email,
            googleId: user.googleId,
            googleEmail: user.googleEmail,
            googleProfilePicture: user.googleProfilePicture,
            password: !!user.password, // ✅ نرجع true/false بس (مش الـ hash)
            adafruitUsername: user.adafruitUsername || '',
            preferences: user.preferences,
            security: {
                lastLogin: user.security?.lastLogin?.toDate?.() || user.security?.lastLogin,
                twoFactorEnabled: user.security?.twoFactorEnabled
            },
            updatedAt: user.updatedAt?.toDate?.() || user.updatedAt,
            role: (user.email.toLowerCase() === 'hussianabdk577@gmail.com' || user.googleEmail?.toLowerCase() === 'hussianabdk577@gmail.com') ? 'admin' : (user.role || 'user'),
            isComplete: isAccountComplete
        };

        res.json(userProfile);
    } catch (err) {
        console.error('خطأ في تحميل بيانات المستخدم:', err);
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
});

// جلب إحصائيات المستخدم
app.get('/api/user/stats', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const widgetsSnapshot = await Widgets.where('userId', '==', userId).get();
    const widgets = widgetsSnapshot.docs.map(doc => doc.data());
    
    const totalWidgets = widgets.length;
    const totalCommands = widgets.reduce((sum, widget) => sum + (widget.analytics?.totalCommands || 0), 0);
    const successfulCommands = widgets.reduce((sum, widget) => sum + (widget.analytics?.successfulCommands || 0), 0);
    const successRate = totalCommands > 0 ? Math.round((successfulCommands / totalCommands) * 100) : 100;

    // حساب الأيام النشطة (تبسيط لأغراض العرض)
    const userCreatedAt = req.user.createdAt?.toDate?.() || new Date(req.user.createdAt);
    const daysSinceJoin = Math.floor((Date.now() - userCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
    const activeDays = daysSinceJoin > 0 ? daysSinceJoin : 1; // على الأقل يوم واحد

    res.json({
      totalWidgets,
      totalCommands,
      successfulCommands,
      successRate,
      activeDays
    });
  } catch (err) {
    console.error('❌ خطأ في جلب إحصائيات المستخدم:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء جلب إحصائيات المستخدم.' });
  }
});


// جلب جلسات المستخدم النشطة
app.get('/api/user/sessions', auth, async (req, res) => {
  try {
    // 1. تنظيف الجلسات القديمة (أكثر من أسبوع) - في try-catch منفصل حتى لا يعطل جلب الجلسات
    try {
      const allUserSessions = await Sessions.where('userId', '==', req.user.id).get();
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const batch = db.batch();
      let deletedCount = 0;
      
      allUserSessions.docs.forEach(doc => {
        const lastActivity = doc.data().lastActivity?.toDate?.() || null;
        if (lastActivity && lastActivity < oneWeekAgo) {
          batch.delete(doc.ref);
          deletedCount++;
        }
      });
      
      if (deletedCount > 0) {
        await batch.commit();
        console.log(`🧹 تم مسح ${deletedCount} جلسة قديمة للمستخدم ${req.user.id}`);
      }
    } catch (cleanupErr) {
      console.warn('⚠️ تعذر تنظيف الجلسات القديمة:', cleanupErr.message);
    }

    // 2. جلب الجلسات النشطة المتبقية
    const sessionsSnapshot = await Sessions.where('userId', '==', req.user.id)
        .where('isActive', '==', true)
        .orderBy('lastActivity', 'desc').get();
    
    const sessions = sessionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastActivity: doc.data().lastActivity?.toDate?.() || doc.data().lastActivity,
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
    }));

    res.json(sessions);
  } catch (err) {
    console.error('❌ خطأ في جلب الجلسات النشطة:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء جلب الجلسات.' });
  }
});

// إنهاء جلسة محددة
app.delete('/api/user/sessions/:sessionId', auth, async (req, res) => {
  try {
    // التأكد من أن المستخدم يملك صلاحية إنهاء هذه الجلسة
    const sessionDoc = await Sessions.doc(req.params.sessionId).get();
    
    if (!sessionDoc.exists || sessionDoc.data().userId !== req.user.id) {
      return res.status(404).json({ msg: 'الجلسة غير موجودة أو لا تملك صلاحية لإنهائها.' });
    }

    await Sessions.doc(req.params.sessionId).update({ 
      isActive: false, 
      expiresAt: admin.firestore.Timestamp.now()
    });
    
    res.json({ msg: 'تم إنهاء الجلسة بنجاح.' });
  } catch (err) {
    console.error('❌ خطأ في إنهاء الجلسة:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء إنهاء الجلسة.' });
  }
});

// تحديث بيانات ملف المستخدم الشخصي
app.put('/api/user/update', auth, async (req, res) => {
  try {
    const { username, email, password, adafruitUsername, adafruitApiKey } = req.body;
    const userDoc = await Users.doc(req.user.id).get();
    
    if (!userDoc.exists) return res.status(404).json({ msg: 'المستخدم غير موجود.' });

    const user = userDoc.data();
    const updateData = {};

    // تحديث اسم المستخدم
    if (username !== undefined && username.trim() !== '') {
      const u = username.trim();
      if (u && u !== user.username) {
        const usernameSnapshot = await Users.where('username', '==', u).limit(1).get();
        if (!usernameSnapshot.empty && usernameSnapshot.docs[0].id !== userDoc.id) {
          return res.status(400).json({ msg: 'اسم المستخدم هذا مستخدم بالفعل من قبل شخص آخر.' });
        }
        updateData.username = u;
      }
    }

    // تحديث البريد الإلكتروني
    if (email !== undefined && email.trim() !== '') {
      const e = email.trim().toLowerCase();
      if (e && e !== user.email) {
        const emailSnapshot = await Users.where('email', '==', e).limit(1).get();
        if (!emailSnapshot.empty && emailSnapshot.docs[0].id !== userDoc.id) {
          return res.status(400).json({ msg: 'البريد الإلكتروني هذا مستخدم بالفعل من قبل شخص آخر.' });
        }
        updateData.email = e;
      }
    }

    // تحديث كلمة المرور
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ msg: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.' });
      }
      updateData.password = await AuthService.hashPassword(password);
    }

    // تحديث بيانات Adafruit IO
    updateData.adafruitUsername = (adafruitUsername || '').trim();
    updateData.adafruitApiKey = (adafruitApiKey || '').trim();
    updateData.updatedAt = admin.firestore.Timestamp.now();

    await Users.doc(req.user.id).update(updateData);
    
    // إرجاع بيانات المستخدم المحدثة (بدون كلمة المرور)
    const updatedUserDoc = await Users.doc(req.user.id).get();
    const updatedUser = updatedUserDoc.data();
    delete updatedUser.password;
    
    res.json({ msg: 'تم تحديث ملفك الشخصي بنجاح.', user: updatedUser });
  } catch (err) {
    console.error('❌ خطأ في تحديث ملف المستخدم الشخصي:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء تحديث ملفك الشخصي. يرجى المحاولة مرة أخرى.' });
  }
});

// تحديث إعدادات الخصوصية والتفضيلات
app.put('/api/user/preferences', auth, async (req, res) => {
  try {
    const { theme, privacy } = req.body; // privacy يمكن أن تحتوي على allowDataCollection, emailNotifications, securityAlerts

    const updateData = {};

    if (theme !== undefined) {
      updateData['preferences.theme'] = theme;
    }
    if (privacy !== undefined) {
      if (privacy.allowDataCollection !== undefined) {
        updateData['preferences.privacy.allowDataCollection'] = privacy.allowDataCollection;
      }
      if (privacy.emailNotifications !== undefined) {
        updateData['preferences.privacy.emailNotifications'] = privacy.emailNotifications;
      }
      if (privacy.securityAlerts !== undefined) {
        updateData['preferences.privacy.securityAlerts'] = privacy.securityAlerts;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ msg: 'لا توجد بيانات لتحديثها في التفضيلات.' });
    }

    await Users.doc(req.user.id).update(updateData);

    res.json({ msg: 'تم حفظ إعدادات التفضيلات والخصوصية بنجاح.' });
  } catch (err) {
    console.error('❌ خطأ في حفظ إعدادات الخصوصية والتفضيلات:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم.' });
  }
});

// إضافة هذا الكود لملف السيرفر الحالي

// ===== API Endpoints للحساسات =====

// جلب آخر قيمة من feed معين
app.get('/api/feed/latest/:feedName', auth, async (req, res) => {
  try {
    const { feedName } = req.params;
    
    if (!req.user.adafruitUsername || !req.user.adafruitApiKey) {
      return res.status(400).json({ msg: 'بيانات Adafruit IO مفقودة' });
    }

    const url = `https://io.adafruit.com/api/v2/${req.user.adafruitUsername}/feeds/${feedName}/data/last`;
    const response = await fetch(url, {
      headers: {
        'X-AIO-Key': req.user.adafruitApiKey
      }
    });

    if (!response.ok) {
      throw new Error(`خطأ من Adafruit IO: ${response.status}`);
    }

    const data = await response.json();
    res.json({
      value: data.value,
      timestamp: data.created_at,
      feedName: feedName
    });

  } catch (err) {
    console.error('❌ خطأ في جلب آخر قيمة:', err);
    res.status(500).json({ msg: 'فشل في جلب البيانات' });
  }
});

// جلب بيانات حساس معين
app.get('/api/sensors/:widgetId/data', auth, async (req, res) => {
  try {
    const { widgetId } = req.params;
    
    const widgetDoc = await Widgets.doc(widgetId).get();
    
    if (!widgetDoc.exists) {
      return res.status(404).json({ msg: 'الحساس غير موجود' });
    }

    const widget = { id: widgetDoc.id, ...widgetDoc.data() };
    
    if (widget.userId !== req.user.id || widget.type !== 'sensor') {
      return res.status(404).json({ msg: 'الحساس غير موجود' });
    }

    if (!req.user.adafruitUsername || !req.user.adafruitApiKey) {
      return res.status(400).json({ msg: 'بيانات Adafruit IO مفقودة' });
    }

    const url = `https://io.adafruit.com/api/v2/${req.user.adafruitUsername}/feeds/${widget.feedName}/data/last`;
    const response = await fetch(url, {
      headers: {
        'X-AIO-Key': req.user.adafruitApiKey
      }
    });

    if (!response.ok) {
      throw new Error(`خطأ من Adafruit IO: ${response.status}`);
    }

    const data = await response.json();
    
    // تحديث حالة الويدجت
    await Widgets.doc(widgetId).update({
      'state.lastValue': data.value,
      'state.lastUpdate': admin.firestore.Timestamp.fromDate(new Date(data.created_at)),
      'state.isActive': true
    });

    // إرسال تحديث عبر Socket.IO
    io.to(`user-${req.user.id}`).emit('sensor-data', {
      widgetId: widget.id,
      value: data.value,
      timestamp: data.created_at,
      isActive: true
    });

    res.json({
      value: data.value,
      timestamp: data.created_at,
      isActive: true,
      lastUpdate: data.created_at
    });

  } catch (err) {
    console.error('❌ خطأ في جلب بيانات الحساس:', err);
    res.status(500).json({ msg: 'فشل في جلب بيانات الحساس' });
  }
});

// ===== تصحيح API الترمينال =====
// إضافة endpoint لتحديث صورة Google
app.put('/api/user/update-google-picture', auth, async (req, res) => {
    try {
        const { googleProfilePicture } = req.body;
        
        await Users.doc(req.user.id).update({
            googleProfilePicture
        });
        
        res.json({ msg: 'تم تحديث الصورة الشخصية بنجاح', googleProfilePicture });
    } catch (err) {
        console.error('خطأ في تحديث الصورة:', err);
        res.status(500).json({ msg: 'خطأ في الخادم' });
    }
});

// تحديث المسار ليكون متوافق مع الكود الأمامي
app.get('/api/terminals/:widgetId/messages', auth, async (req, res) => {
  try {
    const { widgetId } = req.params;
    const { limit = 50 } = req.query; // دعم parameter limit
    const userId = req.user.id;

    const widgetDoc = await Widgets.doc(widgetId).get();
    
    if (!widgetDoc.exists || widgetDoc.data().userId !== userId || widgetDoc.data().type !== 'terminal') {
      return res.status(404).json({ msg: 'الترمينال غير موجود' });
    }

    const widget = { id: widgetDoc.id, ...widgetDoc.data() };

    // جلب الرسائل مع دعم limit
    const messagesSnapshot = await TerminalMessages.where('widgetId', '==', widgetId)
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(parseInt(limit)).get();
    
    const messages = messagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
    }));

    // جلب آخر رسائل من Adafruit IO أيضاً
    if (req.user.adafruitUsername && req.user.adafruitApiKey) {
      try {
        const url = `https://io.adafruit.com/api/v2/${req.user.adafruitUsername}/feeds/${widget.feedName}/data?limit=${Math.min(limit, 10)}`;
        const response = await fetch(url, {
          headers: { 'X-AIO-Key': req.user.adafruitApiKey }
        });

        if (response.ok) {
          const adafruitData = await response.json();
          
          // دمج البيانات من Adafruit IO مع قاعدة البيانات المحلية
          const combinedMessages = [];
          
          // إضافة رسائل من قاعدة البيانات
          messages.forEach(msg => {
            combinedMessages.push({
              message: msg.message,
              type: msg.type,
              timestamp: msg.timestamp
            });
          });

          // إضافة رسائل من Adafruit IO
          adafruitData.forEach(data => {
            combinedMessages.push({
              message: data.value,
              type: 'received',
              timestamp: data.created_at
            });
          });

          // ترتيب حسب الوقت
          combinedMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          
          return res.json(combinedMessages.slice(0, limit));
        }
      } catch (adafruitErr) {
        console.warn('تعذر جلب البيانات من Adafruit IO:', adafruitErr);
      }
    }

    res.json(messages.reverse()); // الأقدم أولاً

  } catch (err) {
    console.error('❌ خطأ في جلب رسائل الترمينال:', err);
    res.status(500).json({ msg: 'فشل في جلب رسائل الترمينال' });
  }
});

// ===== نظام Polling تلقائي من Adafruit IO =====

// دالة لجلب التحديثات تلقائياً
// دالة لجلب التحديثات تلقائياً
async function pollAdafruitIO() {
  try {
    // Firestore بيسمح بشرط واحد بس فيه (!=)
    const usersSnapshot = await Users.where('adafruitUsername', '!=', '').get();
    
    // هنفلتر الشرط التاني بالكود هنا
    const users = usersSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => user.adafruitApiKey && user.adafruitApiKey.trim() !== '');

    for (const user of users) {
      const widgetsSnapshot = await Widgets.where('userId', '==', user.id)
          .where('type', 'in', ['sensor', 'terminal']).get();
      
      const widgets = widgetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      for (const widget of widgets) {
        try {
          const url = `https://io.adafruit.com/api/v2/${user.adafruitUsername}/feeds/${widget.feedName}/data/last`;
          const response = await fetch(url, {
            headers: { 'X-AIO-Key': user.adafruitApiKey }
          });

          if (response.ok) {
            const data = await response.json();
            const newValue = data.value;
            const newTimestamp = new Date(data.created_at);

            // تحقق من وجود تحديث جديد
            const lastUpdate = widget.state?.lastUpdate?.toDate?.() || widget.state?.lastUpdate;
            
            if (widget.state?.lastValue !== newValue || 
                !lastUpdate || 
                newTimestamp > lastUpdate) {
              
              // تحديث الويدجت
              await Widgets.doc(widget.id).update({
                'state.lastValue': newValue,
                'state.lastUpdate': admin.firestore.Timestamp.fromDate(newTimestamp),
                'state.isActive': true
              });

              // إرسال التحديث عبر Socket.IO
              if (widget.type === 'sensor') {
                io.to(`user-${user.id}`).emit('sensor-data', {
                  widgetId: widget.id,
                  value: newValue,
                  timestamp: data.created_at,
                  isActive: true,
                  lastUpdate: newTimestamp
                });
              } else if (widget.type === 'terminal') {
                // حفظ كرسالة ترمينال جديدة
                const terminalMessageRef = TerminalMessages.doc();
                await terminalMessageRef.set({
                  userId: user.id,
                  widgetId: widget.id,
                  message: newValue,
                  type: 'received',
                  timestamp: admin.firestore.Timestamp.fromDate(newTimestamp),
                  createdAt: admin.firestore.Timestamp.now()
                });

                io.to(`user-${user.id}`).emit('terminal-message', {
                  widgetId: widget.id,
                  message: newValue,
                  type: 'received',
                  timestamp: newTimestamp
                });
              }
            }
          }
        } catch (widgetErr) {
          console.error(`خطأ في تحديث الويدجت ${widget.id}:`, widgetErr);
        }
      }
    }
  } catch (err) {
    console.error('❌ خطأ في polling Adafruit IO:', err);
  }
}

// تشغيل polling كل 5 ثوانٍ
setInterval(pollAdafruitIO, 5000);

// ===== إضافة Socket.IO Events مفقودة =====

// إضافة events جديدة لـ Socket.IO
io.on('connection', socket => {
  console.log(`👤 مستخدم متصل: ${socket.id}`);

  socket.on('join-user-room', userId => {
    socket.join(`user-${userId}`);
    console.log(`Socket ${socket.id} joined room user-${userId}`);
  });

  // اشتراك في تحديثات حساس معين
  socket.on('subscribe-sensor', async (widgetId) => {
    socket.join(`sensor-${widgetId}`);
    console.log(`Socket ${socket.id} subscribed to sensor ${widgetId}`);
  });

  // إلغاء الاشتراك من حساس
  socket.on('unsubscribe-sensor', (widgetId) => {
    socket.leave(`sensor-${widgetId}`);
    console.log(`Socket ${socket.id} unsubscribed from sensor ${widgetId}`);
  });

  socket.on('disconnect', () => {
    console.log(`👤 مستخدم منقطع: ${socket.id}`);
  });
});

console.log('✅ تم إضافة نظام Polling وتحديث APIs');
// إضافة هذا المسار في server.js

// حفظ موضع أداة معينة
app.put('/api/widgets/:widgetId/position', auth, async (req, res) => {
    try {
        const { widgetId } = req.params;
        const { gs } = req.body;

        if (!gs || typeof gs.x === 'undefined' || typeof gs.y === 'undefined') {
            return res.status(400).json({ msg: 'بيانات الموضع مطلوبة (x, y)' });
        }

        // التحقق من أن الأداة موجودة وتنتمي للمستخدم
        const widgetDoc = await Widgets.doc(widgetId).get();
        if (!widgetDoc.exists) {
            return res.status(404).json({ msg: 'الأداة غير موجودة' });
        }

        const widget = widgetDoc.data();
        if (widget.userId !== req.user.id) {
            return res.status(403).json({ msg: 'ليس لديك صلاحية لتعديل هذه الأداة' });
        }

        // تحديث موضع الأداة
        const gsData = {
            x: parseInt(gs.x) || 0,
            y: parseInt(gs.y) || 0,
            w: parseInt(gs.w) || 1,
            h: parseInt(gs.h) || 1
        };

        await Widgets.doc(widgetId).update({
            gs: gsData,
            updatedAt: admin.firestore.Timestamp.now()
        });

        console.log(`✅ تم حفظ موضع الأداة ${widget.name}: (${gsData.x}, ${gsData.y})`);

        res.json({ 
            msg: 'تم حفظ موضع الأداة بنجاح',
            gs: gsData
        });

    } catch (error) {
        console.error('❌ خطأ في حفظ موضع الأداة:', error);
        res.status(500).json({ msg: 'فشل في حفظ موضع الأداة' });
    }
});

// تصدير بيانات المستخدم (JSON Backup)
app.get('/api/user/export', auth, async (req, res) => {
  try {
    const userDoc = await Users.doc(req.user.id).get();
    const user = userDoc.data();
    
    const widgetsSnapshot = await Widgets.where('userId', '==', req.user.id).get();
    const widgets = widgetsSnapshot.docs.map(doc => doc.data());

    const exportData = {
      user: {
        username: user.username,
        email: user.email,
        adafruitUsername: user.adafruitUsername,
        preferences: user.preferences,
        createdAt: user.createdAt?.toDate?.() || user.createdAt,
        lastLogin: user.security?.lastLogin?.toDate?.() || user.security?.lastLogin
      },
      widgets: widgets.map(widget => ({
        // استبعاد البيانات الحساسة أو غير الضرورية للاستيراد
        name: widget.name,
        feedName: widget.feedName,
        type: widget.type,
        icon: widget.icon,
        configuration: widget.configuration,
        appearance: widget.appearance
        // لا تشمل "state" أو "analytics" أو "userId" هنا لأنها خاصة بالمستخدم
      })),
      exportDate: new Date().toISOString(),
      appVersion: '1.0.0' // لتحديد إصدار التطبيق عند التصدير
    };

    // إعداد رؤوس الاستجابة لتنزيل الملف
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="dashboard-backup-${req.user.username}-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(exportData);
  } catch (err) {
    console.error('❌ خطأ في تصدير البيانات:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء تصدير البيانات.' });
  }
});

// استيراد بيانات المستخدم (JSON Restore)
app.post('/api/user/import', auth, async (req, res) => {
  try {
    const { widgets: importedWidgets } = req.body; // استخراج مصفوفة widgets من الجسم

    if (!importedWidgets || !Array.isArray(importedWidgets)) {
      return res.status(400).json({ msg: 'بيانات الأدوات المستوردة غير صالحة. يرجى التأكد من اختيار ملف JSON صحيح.' });
    }

    // حذف جميع الأدوات الحالية للمستخدم تجنباً للتكرار والتعارض
    const currentWidgetsSnapshot = await Widgets.where('userId', '==', req.user.id).get();
    const batch = db.batch();
    
    currentWidgetsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();

    // إضافة الأدوات الجديدة من البيانات المستوردة
    const newBatch = db.batch();
    
    importedWidgets.forEach(widgetData => {
      const newWidgetRef = Widgets.doc();
      const widgetContent = {
        userId: req.user.id,
        name: widgetData.name || 'أداة مستوردة',
        feedName: widgetData.feedName || 'default-feed',
        type: widgetData.type || 'toggle',
        icon: widgetData.icon || 'fas fa-toggle-on',
        configuration: {
          onCommand: widgetData.configuration?.onCommand || 'ON',
          offCommand: widgetData.configuration?.offCommand || 'OFF',
          unit: widgetData.configuration?.unit || '',
          ...widgetData.configuration
        },
        appearance: {
          primaryColor: widgetData.appearance?.primaryColor || '#8A2BE2',
          activeColor: widgetData.appearance?.activeColor || '#00e5ff',
          glowColor: widgetData.appearance?.glowColor || '#8A2BE2'
        },
        gs: {
          x: 0,
          y: 0,
          w: 1,
          h: 1
        },
        state: {
          isActive: false,
          lastValue: null,
          lastUpdate: admin.firestore.Timestamp.now()
        },
        analytics: {
          totalCommands: 0,
          successfulCommands: 0
        },
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };
      
      newBatch.set(newWidgetRef, widgetContent);
    });

    if (importedWidgets.length > 0) {
      await newBatch.commit();
    }

    // إرسال تحديث Socket.IO إلى الواجهة الأمامية لإعادة تحميل الأدوات
    io.to(`user-${req.user.id}`).emit('widgets-reloaded');

    res.json({ msg: `تم استيراد ${importedWidgets.length} أداة بنجاح.` });
  } catch (err) {
    console.error('❌ خطأ في استيراد البيانات:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء استيراد البيانات. يرجى التأكد من أن الملف بصيغة JSON صحيحة.' });
  }
});


// (Removed redundant 2FA route replaced by combined one below)

// حذف الحساب (Delete Account)
app.delete('/api/user/delete-account', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // حذف جميع البيانات المرتبطة بالمستخدم بشكل آمن ومنظم
    // 1. حذف جميع الأدوات الخاصة بالمستخدم
    const widgetsSnapshot = await Widgets.where('userId', '==', userId).get();
    const widgetsBatch = db.batch();
    widgetsSnapshot.docs.forEach(doc => {
      widgetsBatch.delete(doc.ref);
    });
    await widgetsBatch.commit();

    // 2. حذف جميع رسائل المحطات الطرفية
    const messagesSnapshot = await TerminalMessages.where('userId', '==', userId).get();
    const messagesBatch = db.batch();
    messagesSnapshot.docs.forEach(doc => {
      messagesBatch.delete(doc.ref);
    });
    await messagesBatch.commit();

    // 3. حذف جميع جلسات المستخدم
    const sessionsSnapshot = await Sessions.where('userId', '==', userId).get();
    const sessionsBatch = db.batch();
    sessionsSnapshot.docs.forEach(doc => {
      sessionsBatch.delete(doc.ref);
    });
    await sessionsBatch.commit();

    // 4. حذف جميع رموز إعادة تعيين كلمة المرور
    const resetCodesSnapshot = await ResetCodes.where('userId', '==', userId).get();
    const resetCodesBatch = db.batch();
    resetCodesSnapshot.docs.forEach(doc => {
      resetCodesBatch.delete(doc.ref);
    });
    await resetCodesBatch.commit();

    // 5. حذف حساب المستخدم نفسه
    await Users.doc(userId).delete();

    res.json({ msg: 'تم حذف الحساب وجميع البيانات المرتبطة به بنجاح. نأمل أن نراك مرة أخرى!' });
  } catch (err) {
    console.error('❌ خطأ في حذف الحساب:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء حذف الحساب. يرجى المحاولة مرة أخرى.' });
  }
});

// حذف جميع الأدوات والبيانات (Clear All Data)
app.post('/api/user/clear-data', auth, async (req, res) => {
    try {
      const userId = req.user.id;
  
      // 1. حذف جميع الأدوات الخاصة بالمستخدم
      const widgetsSnapshot = await Widgets.where('userId', '==', userId).get();
      const widgetsBatch = db.batch();
      widgetsSnapshot.docs.forEach(doc => {
        widgetsBatch.delete(doc.ref);
      });
      await widgetsBatch.commit();
  
      // 2. حذف جميع رسائل المحطات الطرفية
      const messagesSnapshot = await TerminalMessages.where('userId', '==', userId).get();
      const messagesBatch = db.batch();
      messagesSnapshot.docs.forEach(doc => {
        messagesBatch.delete(doc.ref);
      });
      await messagesBatch.commit();
  
      // إرسال تحديث Socket.IO لإفراغ الواجهة الأمامية
      io.to(`user-${userId}`).emit('widgets-reloaded');
  
      res.json({ msg: 'تم حذف جميع الأدوات والبيانات بنجاح.' });
    } catch (err) {
      console.error('❌ خطأ في مسح البيانات:', err);
      res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء مسح البيانات.' });
    }
  });

// ==========================================================
// START: NEW 2FA AND SESSION ENDPOINTS
// ==========================================================

// تفعيل المصادقة الثنائية (البريد الإلكتروني فقط)
app.post('/api/user/enable-2fa', auth, async (req, res) => {
    try {
        const userDoc = await Users.doc(req.user.id).get();
        if (!userDoc.exists) return res.status(404).json({ msg: 'المستخدم غير موجود.' });
        
        await Users.doc(req.user.id).update({
            'security.twoFactorEnabled': true
        });
        
        res.json({ 
            msg: 'تم تفعيل المصادقة الثنائية بنجاح. سيتم إرسال رمز التحقق إلى بريدك عند الدخول.'
        });
    } catch (err) {
        console.error('2FA Enable Error:', err);
        res.status(500).json({ msg: 'خطأ في تفعيل المصادقة الثنائية.' });
    }
});

// تعطيل المصادقة الثنائية
app.post('/api/user/disable-2fa', auth, async (req, res) => {
    try {
        const userDoc = await Users.doc(req.user.id).get();
        if (!userDoc.exists) {
            return res.status(404).json({ msg: 'المستخدم غير موجود.' });
        }
        
        await Users.doc(req.user.id).update({
            'security.twoFactorEnabled': false
        });
        
        res.json({ msg: 'تم إلغاء تفعيل المصادقة الثنائية.' });
    } catch (err) {
        res.status(500).json({ msg: 'خطأ في الخادم.' });
    }
});

// ==========================================================
// END: NEW 2FA AND SESSION ENDPOINTS
// ==========================================================

app.post('/api/logs/client', async (req, res) => {
    try {
        const { error, stackTrace, deviceInfo, appVersion } = req.body;
        let userId = 'anonymous';
        const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
        if (token) {
            try {
                const decoded = AuthService.verifyJWT(token);
                userId = decoded.id;
            } catch (e) {}
        }
        
        await ClientLogs.add({
            userId,
            error: error || 'Unknown Error',
            stackTrace: stackTrace || '',
            deviceInfo: deviceInfo || {},
            appVersion: appVersion || 'Unknown',
            timestamp: admin.firestore.Timestamp.now()
        });
        
        res.status(201).json({ msg: 'Log recorded successfully' });
    } catch (err) {
        console.error('Failed to log client error:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// Fetch notifications for a user
app.get('/api/notifications', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const allSnapshot = await Notifications.where('targetUserId', '==', 'all').orderBy('timestamp', 'desc').limit(20).get();
        const userSnapshot = await Notifications.where('targetUserId', '==', userId).orderBy('timestamp', 'desc').limit(20).get();
        
        const allNotifs = allSnapshot.docs.map(d => ({id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate?.()}));
        const userNotifs = userSnapshot.docs.map(d => ({id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate?.()}));
        
        let merged = [...allNotifs, ...userNotifs];
        merged.sort((a,b) => b.timestamp - a.timestamp);
        const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
        
        res.json(unique.slice(0, 30));
    } catch(err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ msg: 'Server error fetching notifications' });
    }
});

// ==========================================================
// START: ADMIN DASHBOARD ROUTES
// ==========================================================
const adminAuth = async (req, res, next) => {
    try {
        await auth(req, res, async () => {
            if (req.user.role === 'admin' || req.user.email?.toLowerCase() === 'hussianabdk577@gmail.com' || req.user.googleEmail?.toLowerCase() === 'hussianabdk577@gmail.com') {
                next();
            } else {
                res.status(403).json({ msg: 'Access denied. Admins only.' });
            }
        });
    } catch (err) {
        res.status(500).json({ msg: 'Server error check admin' });
    }
};

const requirePermission = (permission) => async (req, res, next) => {
    try {
        await auth(req, res, async () => {
            const isSuperAdmin = (req.user.email?.toLowerCase() === 'hussianabdk577@gmail.com' || req.user.googleEmail?.toLowerCase() === 'hussianabdk577@gmail.com');
            if (isSuperAdmin) {
                return next();
            }
            if (req.user.role === 'admin') {
                const perms = req.user.adminPermissions || [];
                if (perms.includes(permission) || perms.includes('*')) {
                    return next();
                }
            }
            res.status(403).json({ msg: 'ليس لديك الصلاحية لفعل هذا: ' + permission });
        });
    } catch (err) {
        res.status(500).json({ msg: 'Server error check permission' });
    }
};

app.get('/api/admin/users', requirePermission('manage_users'), async (req, res) => {
    try {
        const usersSnapshot = await Users.get();
        const users = [];
        for (const doc of usersSnapshot.docs) {
             const u = doc.data();
             // Get total widgets count for this user
             const widgetsSnapshot = await Widgets.where('userId', '==', doc.id).get();
             const widgetCount = widgetsSnapshot.size;
             users.push({
                 id: doc.id,
                 username: u.username,
                 email: u.email,
                 role: u.role || 'user',
                 status: u.status || 'active',
                 adminMessage: u.adminMessage || { show: true, text: 'حسابك معلق حالياً. يرجى التواصل مع المسؤول.', email: 'hussianabdk577@gmail.com', whatsapp: '' },
                 widgetCount,
                 lastLogin: u.security?.lastLogin?.toDate?.() || u.createdAt?.toDate?.()
             });
        }
        res.json(users);
    } catch (error) {
        res.status(500).json({ msg: 'Error getting users' });
    }
});

app.put('/api/admin/users/:id/status', requirePermission('manage_users'), async (req, res) => {
    try {
        const { status, adminMessage } = req.body;
        const targetUserDoc = await Users.doc(req.params.id).get();
        if(!targetUserDoc.exists) return res.status(404).json({ msg: 'User not found' });
        
        const targetEmail = targetUserDoc.data().email?.toLowerCase();
        if(targetEmail === 'hussianabdk577@gmail.com' && req.user.email?.toLowerCase() !== 'hussianabdk577@gmail.com') {
             return res.status(403).json({ msg: 'لا يمكنك تغيير حالة المشرف الرئيسي!' });
        }

        await Users.doc(req.params.id).update({
            status,
            adminMessage
        });
        res.json({ msg: 'تم تحديث حالة الحساب.' });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

app.put('/api/admin/users/:id/role', requirePermission('manage_roles'), async (req, res) => {
    try {
        const { role, adminPermissions } = req.body;
        const targetUserDoc = await Users.doc(req.params.id).get();
        if(!targetUserDoc.exists) return res.status(404).json({ msg: 'User not found' });

        const targetEmail = targetUserDoc.data().email?.toLowerCase();
        if(targetEmail === 'hussianabdk577@gmail.com') {
             return res.status(403).json({ msg: 'لا يمكنك تغيير رتبة أو صلاحيات المشرف الرئيسي!' });
        }

        await Users.doc(req.params.id).update({ 
            role,
            adminPermissions: role === 'admin' ? (adminPermissions || []) : []
        });
        res.json({ msg: 'تم تحديث الدور والصلاحيات بنجاح.' });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// Add a simple in-memory log buffer for the admin interface
const systemLogs = [];
const originalConsoleError = console.error;
console.error = function() {
    const message = Array.from(arguments).join(' ');
    systemLogs.unshift({ timestamp: new Date(), type: 'ERROR', message });
    if (systemLogs.length > 500) systemLogs.pop();
    originalConsoleError.apply(console, arguments);
};

app.get('/api/admin/logs', requirePermission('view_logs'), (req, res) => {
     res.json(systemLogs);
});

app.get('/api/admin/client-logs', requirePermission('view_logs'), async (req, res) => {
    try {
        const logsSnapshot = await ClientLogs.orderBy('timestamp', 'desc').limit(100).get();
        const logs = logsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.()
        }));
        res.json(logs);
    } catch (err) {
        console.error('Error fetching client logs:', err);
        res.status(500).json({ msg: 'Server error fetching client logs' });
    }
});

app.post('/api/admin/notifications', requirePermission('send_notifications'), async (req, res) => {
    try {
        const { title, message, targetUserId } = req.body;
        if (!title || !message) {
            return res.status(400).json({ msg: 'Title and message are required' });
        }
        
        const notifRef = Notifications.doc();
        const notification = {
            id: notifRef.id,
            title,
            message,
            targetUserId: targetUserId || 'all',
            senderId: req.user.id,
            timestamp: admin.firestore.Timestamp.now()
        };
        
        await notifRef.set(notification);
        
        if (notification.targetUserId === 'all') {
            io.emit('new-notification', notification);
        } else {
            io.to(`user-${notification.targetUserId}`).emit('new-notification', notification);
        }
        
        res.status(201).json({ msg: 'Notification sent successfully', notification });
    } catch(err) {
        console.error('Error sending notification:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

app.get('/api/admin/sessions/:userId', requirePermission('manage_users'), async (req, res) => {
    try {
        const userId = req.params.userId;
        const sessionsSnapshot = await Sessions.where('userId', '==', userId).get();
        const sessions = sessionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            lastActivity: doc.data().lastActivity?.toDate?.(),
            createdAt: doc.data().createdAt?.toDate?.()
        }));
        // Sort in memory to avoid Firestore requiring a composite index
        sessions.sort((a, b) => (b.lastActivity || b.createdAt) - (a.lastActivity || a.createdAt));
        res.json(sessions);
    } catch (err) {
        console.error('Error fetching user sessions:', err);
        res.status(500).json({ msg: 'Server error fetching sessions' });
    }
});

app.get('/api/admin/adafruit-quota', requirePermission('view_logs'), async (req, res) => {
    try {
        const quotas = [];
        for (const [userId, data] of userAdafruitQuotas.entries()) {
            const userDoc = await Users.doc(userId).get();
            const username = userDoc.exists ? userDoc.data().username : 'Unknown';
            quotas.push({
                userId,
                username,
                remaining: data.remaining,
                lastUpdated: data.lastUpdated
            });
        }
        res.json(quotas);
    } catch(err) {
        res.status(500).json({ msg: 'Server error fetching quotas' });
    }
});

app.post('/api/admin/ban-device', requirePermission('manage_users'), async (req, res) => {
    try {
        const { ip, deviceId, reason } = req.body;
        if (!ip && !deviceId) {
            return res.status(400).json({ msg: 'يجب توفير IP أو Device ID.' });
        }
        
        const banRef = BannedDevices.doc();
        await banRef.set({
            ip: ip || null,
            deviceId: deviceId || null,
            reason: reason || 'محظور من قبل الإدارة',
            bannedAt: admin.firestore.Timestamp.now(),
            bannedBy: req.user.id
        });
        
        res.json({ msg: 'تم إضافة الحظر بنجاح.' });
    } catch (err) {
        console.error('Error banning device:', err);
        res.status(500).json({ msg: 'Server error banning device' });
    }
});

app.delete('/api/admin/logout-device/:sessionId', requirePermission('manage_users'), async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        const sessionDoc = await Sessions.doc(sessionId).get();
        if(!sessionDoc.exists) {
            return res.status(404).json({ msg: 'الجلسة غير موجودة' });
        }
        
        await Sessions.doc(sessionId).update({
            isActive: false,
            expiresAt: admin.firestore.Timestamp.now()
        });
        
        res.json({ msg: 'تم إنهاء الجلسة بنجاح.' });
    } catch (err) {
        console.error('Error terminating session:', err);
        res.status(500).json({ msg: 'Server error terminating session' });
    }
});
// ==========================================================
// END: ADMIN DASHBOARD ROUTES
// ==========================================================

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT} - http://0.0.0.0:${PORT}`);
});