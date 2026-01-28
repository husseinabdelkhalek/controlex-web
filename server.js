// بدء تشغيل خادم لوحة التحكم الذكية - النسخة المحدثة...
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
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
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');

// تأكد من أن مخرجات console.log تعرض الأحرف العربية بشكل صحيح
process.stdout.setEncoding('utf8');

const app = express();
app.enable('trust proxy'); 
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

// START: PASSPORT & SESSION CONFIG
app.use(session({
    secret: process.env.SESSION_SECRET || 'a_very_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
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
        let user = await User.findOne({ googleId: profile.id });
        
        if (user) {
            // تحديث صورة المستخدم الموجود
            user.googleProfilePicture = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
            await user.save();
            return done(null, user);
        }

        user = await User.findOne({ email: profile.emails[0].value });
        
        if (user) {
            user.googleId = profile.id;
            user.googleProfilePicture = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
            await user.save();
            return done(null, user);
        }

        // إنشاء مستخدم جديد مع الصورة
        const newUser = new User({
            googleId: profile.id,
            username: profile.displayName,
            email: profile.emails[0].value,
            googleEmail: profile.emails[0].value,
            googleProfilePicture: profile.photos && profile.photos[0] ? profile.photos[0].value : null
        });

        await newUser.save();
        return done(null, newUser);
    } catch (err) {
        return done(err, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});
// END: PASSPORT & SESSION CONFIG

// اتصال MongoDB
// الاتصال بقاعدة بيانات MongoDB باستخدام URI من متغيرات البيئة.
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10, // الحد الأقصى لحجم تجمع الاتصال
  serverSelectionTimeoutMS: 5000, // مهلة اكتشاف الخادم بعد 5 ثوانٍ
  socketTimeoutMS: 45000 // مهلة مقبس بعد 45 ثانية
})
  .then(() => console.log('✅ تم الاتصال بقاعدة بيانات MongoDB بنجاح'))
  .catch(err => {
    console.error('❌ خطأ في الاتصال بقاعدة بيانات MongoDB:', err);
    process.exit(1); // إنهاء العملية في حالة فشل الاتصال
  });

// المخططات والنماذج (Schemas & Models)

// مخطط المستخدم (User Schema)
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: false },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  googleId: { type: String, unique: true, sparse: true },
  googleEmail: { type: String, trim: true, lowercase: true, sparse: true },
  googleProfilePicture: { type: String, trim: true, default: null }, // إضافة حقل جديد لتخزين بريد جوجل
  adafruitUsername: { type: String, trim: true, default: '' },
  adafruitApiKey: { type: String, trim: true, default: '' },
  security: {
    lastLogin: { type: Date, default: Date.now },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: Date,
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorCode: String,
    twoFactorCodeExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date
  },
  preferences: {
    theme: { type: String, default: 'dark' },
    privacy: {
      allowDataCollection: { type: Boolean, default: false },
      emailNotifications: { type: Boolean, default: true },
      securityAlerts: { type: Boolean, default: true }
    }
  }
}, { timestamps: true }); // إضافة حقول createdAt و updatedAt تلقائياً

const User = mongoose.model('User', UserSchema);
// تحديث WidgetSchema في server.js لإضافة حقل المواضع
const WidgetSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    feedName: { type: String, required: true, trim: true },
    type: { type: String, enum: ['toggle', 'push', 'sensor', 'terminal', 'slider', 'joystick'], default: 'toggle' },
    icon: { type: String, default: 'fas fa-toggle-on' },
    
    gs: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
        w: { type: Number, default: 1 },
        h: { type: Number, default: 1 }
    },
    configuration: {
        onCommand: { type: String, default: 'ON' },
        offCommand: { type: String, default: 'OFF' },
        unit: { type: String, default: '' },
        min: { type: Number, default: 0 },
        max: { type: Number, default: 100 },
        // === START: Joystick Commands ===
        upCommand: { type: String, trim: true },
        downCommand: { type: String, trim: true },
        leftCommand: { type: String, trim: true },
        rightCommand: { type: String, trim: true },
        upRightCommand: { type: String, trim: true },
        upLeftCommand: { type: String, trim: true },
        downRightCommand: { type: String, trim: true },
        downLeftCommand: { type: String, trim: true },
        // === END: Joystick Commands ===
    },
    
    appearance: {
        primaryColor: { type: String, default: '#8A2BE2' },
        activeColor: { type: String, default: '#00e5ff' },
        glowColor: { type: String, default: '#8A2BE2' }
    },
    state: {
        isActive: { type: Boolean, default: false },
        lastValue: mongoose.Schema.Types.Mixed,
        lastUpdate: { type: Date, default: Date.now }
    },
    analytics: {
        totalCommands: { type: Number, default: 0 },
        successfulCommands: { type: Number, default: 0 }
    }
}, { timestamps: true });
const Widget = mongoose.model('Widget', WidgetSchema);
// ====== مخطط جديد لرسائل الترمنال (TerminalMessage Schema) ======
const TerminalMessageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  widgetId: { // ربط الرسالة بويدجت الترمنال المحدد
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Widget',
    required: true
  },
  message: { // محتوى الرسالة
    type: String,
    required: true,
    trim: true
  },
  type: { // نوع الرسالة: 'sent' (صادرة من المستخدم) أو 'received' (واردة من الجهاز)
    type: String,
    enum: ['sent', 'received'],
    required: true
  },
  timestamp: { // وقت إرسال/استلام الرسالة
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // تضيف createdAt و updatedAt تلقائيًا
});

const TerminalMessage = mongoose.model('TerminalMessage', TerminalMessageSchema);
// مخطط الجلسة (Session Schema)
const SessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  token: String,
  deviceInfo: {
    browser: String,
    ip: String,
    userAgent: String
  },
  isActive: { type: Boolean, default: true },
  lastActivity: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) } // انتهاء الصلاحية بعد 24 ساعة
}, { timestamps: true });

const Session = mongoose.model('Session', SessionSchema);

// مخطط رمز إعادة التعيين (ResetCode Schema)
const ResetCodeSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  code: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 600 } // تنتهي صلاحية الرمز بعد 10 دقائق (600 ثانية)
});

const ResetCode = mongoose.model('ResetCode', ResetCodeSchema);

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
    const user = await User.findById(decoded.id).select('-password'); // لا ترجع كلمة المرور
    if (!user) return res.status(401).json({ msg: 'رمز مصادقة غير صالح.' });

    // التحقق من وجود جلسة نشطة لهذا الرمز
    // ملاحظة: سنتجاوز التحقق من الجلسة عند استخدام التوكن من الرابط لتسهيل عملية الربط
    if (!req.query.token) {
        const session = await Session.findOne({ userId: user._id, token, isActive: true });
        if (!session) {
          return res.status(401).json({ msg: 'الجلسة منتهية أو غير نشطة، يرجى تسجيل الدخول مرة أخرى.' });
        }
        // تحديث وقت النشاط للجلسة
        session.lastActivity = Date.now();
        await session.save();
    }

    req.user = user; // إضافة معلومات المستخدم إلى كائن الطلب
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
                const linkingUser = await User.findById(req.session.linkingUserId);
                const googleProfileId = req.user.googleId; // هذا يأتي من ملف جوجل الشخصي

                // تحقق مما إذا كان حساب جوجل هذا مربوطًا بالفعل بحساب آخر
                const googleAccountExists = await User.findOne({ googleId: googleProfileId });
                if (googleAccountExists && googleAccountExists.id !== linkingUser.id) {
                    // مسح ID من الجلسة لمنع المحاولات المستقبلية الخاطئة
                    delete req.session.linkingUserId;
                    // أعد توجيه المستخدم برسالة خطأ
                    return res.send(`<script>alert('هذا الحساب في جوجل مربوط بالفعل بحساب آخر.'); window.location.href = '/account';</script>`);
                }

                // ربط الحساب وتخزين الإيميل
                linkingUser.googleId = googleProfileId;
                linkingUser.googleEmail = req.user.emails[0].value; // حفظ إيميل جوجل
                await linkingUser.save();

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
        const token = AuthService.generateJWT({ id: user._id });

        const session = new Session({
            userId: user._id,
            token,
            deviceInfo: { userAgent: req.get('User-Agent'), ip: req.ip }
        });
        await session.save();

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

        const user = await User.findById(req.user.id);
        user.password = await AuthService.hashPassword(password);
        user.adafruitUsername = adafruitUsername || user.adafruitUsername || '';
        user.adafruitApiKey = adafruitApiKey || user.adafruitApiKey || '';
        
        await user.save();

        res.json({ msg: 'تم إكمال التسجيل بنجاح.' });
    } catch (err) {
        res.status(500).json({ msg: 'خطأ في الخادم' });
    }
});

app.post('/api/user/unlink-google', auth, async (req, res) => {
    try {
        const { password } = req.body;
        const user = await User.findById(req.user.id);

        if (!user.password) {
            return res.status(400).json({ msg: 'لا يمكنك فك الربط لأنه لا توجد كلمة مرور محلية. يرجى تعيين واحدة أولاً.' });
        }

        const isMatch = await AuthService.verifyPassword(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'كلمة المرور غير صحيحة.' });
        }

        // حذف كل من معرف جوجل وبريد جوجل
        user.googleId = undefined;
        user.googleEmail = undefined;
        await user.save();
        res.json({ msg: 'تم فك ربط حساب جوجل بنجاح.' });
    } catch (err) {
        res.status(500).json({ msg: 'خطأ في الخادم' });
    }
});
// END: GOOGLE SIGNUP COMPLETION & UNLINK
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, email, adafruitUsername, adafruitApiKey } = req.body;

        // ✅ فقط username, password, email مطلوبين
        if (!username || !password || !email) {
            return res.status(400).json({ msg: 'الرجاء إدخال جميع الحقول المطلوبة' });
        }

        if (password.length < 6) {
            return res.status(400).json({ msg: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل' });
        }

        const exists = await User.findOne({ 
            $or: [{ email: email.toLowerCase() }, { username }] 
        });

        if (exists) {
            return res.status(400).json({ msg: 'المستخدم موجود بالفعل' });
        }

        const hashed = await AuthService.hashPassword(password);

        const user = new User({
            username: username.trim(),
            email: email.toLowerCase().trim(),
            password: hashed,
            // ✅ Adafruit IO اختياري - يمكن إضافته لاحقاً
            adafruitUsername: adafruitUsername ? adafruitUsername.trim() : '',
            adafruitApiKey: adafruitApiKey ? adafruitApiKey.trim() : ''
        });

        await user.save();

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
        const deletedWidgets = await Widget.deleteMany({ userId });
        
        // 2. حذف جميع رسائل Terminal
        await TerminalMessage.deleteMany({ userId });
        
        // 3. إعادة تعيين بيانات Adafruit IO (اختياري)
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ msg: 'المستخدم غير موجود' });
        }
        
        // مسح بيانات Adafruit فقط (الحساب نفسه يبقى)
        user.adafruitUsername = '';
        user.adafruitApiKey = '';
        
        // ✅ نحافظ على createdAt (أيام النشاط)
        // ✅ نحافظ على username, email, password
        
        await user.save();
        
        // 4. إرسال إشعار عبر Socket.IO
        io.to(`user-${userId}`).emit('data-cleared', {
            message: 'تم مسح جميع البيانات بنجاح',
            timestamp: new Date()
        });
        
        res.json({ 
            msg: 'تم مسح جميع البيانات بنجاح!',
            deletedWidgets: deletedWidgets.deletedCount,
            clearedAt: new Date()
        });
        
    } catch (err) {
        console.error('خطأ في مسح البيانات:', err);
        res.status(500).json({ msg: 'حدث خطأ أثناء مسح البيانات' });
    }
});

// تسجيل الدخول (Login)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ msg: 'البريد الإلكتروني وكلمة المرور مطلوبان.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ msg: 'بيانات اعتماد غير صحيحة.' });
    }

    const isMatch = await AuthService.verifyPassword(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'بيانات اعتماد غير صحيحة.' });
    }

    // --- START 2FA LOGIC ---
    if (user.security.twoFactorEnabled) {
      const code = AuthService.generateResetCode(); // Generate 6-digit code
      user.security.twoFactorCode = code;
      user.security.twoFactorCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
      await user.save();

      // Send email with the code (using your existing transporter)
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'رمز التحقق لتسجيل الدخول',
        html: `<p>رمز التحقق الخاص بك هو: <strong>${code}</strong>. وهو صالح لمدة 10 دقائق.</p>`
      };
      await transporter.sendMail(mailOptions);

      console.log(`2FA code for ${user.email}: ${code}`);
      // Respond that 2FA is needed, without sending the token
      return res.status(200).json({ twoFactorRequired: true, msg: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني.' });
    }
    // --- END 2FA LOGIC ---

    // If 2FA is not enabled, log in directly
    const token = AuthService.generateJWT({ id: user._id });
    const session = new Session({
      userId: user._id,
      token,
      deviceInfo: {
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });
    await session.save();

    user.security.lastLogin = Date.now();
    await user.save();

    res.json({
      token,
      user: { id: user._id, username: user.username }
    });

  } catch (err) {
    console.error('❌ خطأ في تسجيل الدخول:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم.' });
  }
});

// Add this new endpoint for verifying the 2FA code
app.post('/api/auth/verify-2fa', async (req, res) => {
    const { email, twoFactorCode } = req.body;
    if (!email || !twoFactorCode) {
        return res.status(400).json({ msg: "البريد الإلكتروني والرمز مطلوبان." });
    }

    const user = await User.findOne({ 
        email: email.toLowerCase(),
        'security.twoFactorCode': twoFactorCode,
        'security.twoFactorCodeExpires': { $gt: Date.now() }
    });

    if (!user) {
        return res.status(400).json({ msg: "الرمز غير صالح أو منتهي الصلاحية." });
    }

    // Clear the code
    user.security.twoFactorCode = undefined;
    user.security.twoFactorCodeExpires = undefined;
    await user.save();

    // If code is correct, issue token and log in
    const token = AuthService.generateJWT({ id: user._id });
    const session = new Session({
      userId: user._id,
      token,
      deviceInfo: { userAgent: req.get('User-Agent'), ip: req.ip }
    });
    await session.save();

    user.security.lastLogin = Date.now();
    await user.save();

    res.json({
      token,
      user: { id: user._id, username: user.username }
    });
});

// تسجيل الخروج (Logout)
app.post('/api/auth/logout', auth, async (req, res) => {
  try {
    // تحديد الرمز الحالي كغير نشط في قاعدة البيانات
    const currentToken = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
    await Session.findOneAndUpdate(
      { userId: req.user._id, token: currentToken },
      { isActive: false, expiresAt: new Date() } // إنهاء صلاحية الجلسة فوراً
    );
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

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // لا تخبر المهاجم إذا كان البريد الإلكتروني موجودًا أم لا لأسباب أمنية
      return res.status(400).json({ msg: 'إذا كان البريد الإلكتروني مسجلاً لدينا، فسيتم إرسال رمز إعادة تعيين كلمة المرور إليه.' });
    }

    // توليد رمز إعادة تعيين فريد
    const code = AuthService.generateResetCode();
    // حفظ الرمز في قاعدة البيانات مع وقت انتهاء صلاحية
    const resetCode = new ResetCode({ email: email.toLowerCase(), code });
    await resetCode.save();

    // طباعة الرمز في الـ console لأغراض التطوير والاختبار.
    console.log(`\n==================================================`);
    console.log(`🔑 رمز إعادة التعيين الجديد لـ ${email}`);
    console.log(`🔢 الرمز: ${code}`);
    console.log(`⏱️ انتهاء الصلاحية: ${new Date(Date.now() + 10 * 60 * 1000).toLocaleString('ar-EG')}`);
    console.log(`==================================================\n`);

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
    const record = await ResetCode.findOne({
      email: email.toLowerCase(),
      code,
      createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) } // الرمز صالح لمدة 10 دقائق
    });

    if (!record) {
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

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ msg: 'المستخدم غير موجود.' });
    }

    const record = await ResetCode.findOne({
      email: email.toLowerCase(),
      code,
      createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) } // التحقق من أن الرمز لم تنته صلاحيته
    });
    if (!record) {
      return res.status(400).json({ msg: 'الرمز غير صالح أو منتهي الصلاحية. يرجى طلب رمز جديد.' });
    }

    // تحديث كلمة المرور وحذف الرمز من قاعدة البيانات
    const hashed = await AuthService.hashPassword(newPassword);
    user.password = hashed;
    await user.save();
    await ResetCode.deleteOne({ _id: record._id }); // حذف الرمز بعد الاستخدام الناجح

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
    const widgets = await Widget.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(widgets);
  } catch (err) {
    console.error('❌ خطأ في جلب الأدوات:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء جلب الأدوات.' });
  }
});

/// server.js

app.post('/api/widgets', auth, async (req, res) => {
  try {
    const { name, feedName, type, icon, primaryColor, activeColor, glowColor, unit, onCommand, offCommand, configuration, joystickCommands } = req.body;

    if (!name || !feedName || !type) {
      return res.status(400).json({ msg: 'اسم الأداة، اسم المجرى، والنوع هي حقول مطلوبة.' });
    }
    
    const widgetData = {
      userId: req.user._id,
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
      }
    };

    // دمج إعدادات السلايدر إذا كان النوع هو سلايدر
    if (type === 'slider' && configuration) {
        widgetData.configuration = { ...widgetData.configuration, ...configuration };
    }

    // دمج إعدادات الجويستيك إذا كان النوع هو جويستيك
    if (type === 'joystick' && joystickCommands) {
        widgetData.configuration = { ...widgetData.configuration, ...joystickCommands };
    }

    const widget = new Widget(widgetData);
    await widget.save();

    io.to(`user-${req.user._id}`).emit('widget-added', widget);
    res.status(201).json(widget);

  } catch (err) {
    console.error('❌ خطأ في إضافة الأداة:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء إضافة الأداة.' });
  }
});
// server.js

app.put('/api/widgets/:id', auth, async (req, res) => {
  try {
    const { name, feedName, type, icon, primaryColor, activeColor, glowColor, unit, onCommand, offCommand, configuration, joystickCommands } = req.body;

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
        updatedAt: new Date()
    };

    const updatedWidget = await Widget.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: updatedData },
      { new: true, runValidators: true, omitUndefined: true }
    );

    if (!updatedWidget) {
      return res.status(404).json({ msg: 'الأداة غير موجودة أو لا تملك صلاحية لتعديلها.' });
    }

    io.to(`user-${req.user._id}`).emit('widget-updated', updatedWidget);
    res.json({ msg: 'تم تحديث الأداة بنجاح.', widget: updatedWidget });

  } catch (err) {
    console.error('❌ خطأ في تحديث الأداة:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء تحديث الأداة.' });
  }
});
app.get('/css/styles.css', (req, res) => {
    res.set('Content-Type', 'text/css');
    res.sendFile(path.join(__dirname, 'public/css/styles.css'));
});
// حذف أداة
app.delete('/api/widgets/:id', auth, async (req, res) => {
  try {
    const widget = await Widget.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!widget) {
      return res.status(404).json({ msg: 'الأداة غير موجودة أو لا تملك صلاحية لحذفها.' });
    }

    io.to(`user-${req.user._id}`).emit('widget-deleted', { widgetId: req.params.id }); // إرسال تحديث لجميع الأجهزة المتصلة

    res.json({ msg: 'تم حذف الأداة بنجاح.' });
  } catch (err) {
    console.error('❌ خطأ في حذف الأداة:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء حذف الأداة.' });
  }
});

// إرسال الأوامر (Command Sending) إلى Adafruit IO
app.post('/api/command/send', auth, async (req, res) => {
  try {
    const { widgetId, value } = req.body;
    if (!widgetId || value === undefined) {
      return res.status(400).json({ msg: 'معرف الأداة والقيمة مطلوبان لإرسال الأمر.' });
    }

    const widget = await Widget.findOne({ _id: widgetId, userId: req.user._id });
    if (!widget) {
      return res.status(404).json({ msg: 'الأداة غير موجودة.' });
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

    const url = `https://io.adafruit.com/api/v2/${req.user.adafruitUsername}/feeds/${widget.feedName}/data`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AIO-Key': req.user.adafruitApiKey
      },
      body: JSON.stringify({ value: commandValue }),
      timeout: 10000
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ خطأ من Adafruit IO (${response.status}): ${errorText}`);
      throw new Error(`خطأ في Adafruit IO: ${response.status} - ${response.statusText}. يرجى التحقق من اسم المجرى ومفتاح API.`);
    }

    // تحديث الحالة
    widget.analytics.totalCommands = (widget.analytics.totalCommands || 0) + 1;
    widget.analytics.successfulCommands = (widget.analytics.successfulCommands || 0) + 1;
    widget.state.lastValue = commandValue;
    widget.state.lastUpdate = new Date();

    if (widget.type === 'toggle') {
      widget.state.isActive = commandValue.toUpperCase() === widget.configuration.onCommand.toUpperCase();
    } else if (widget.type === 'push') {
      widget.state.isActive = true;
      setTimeout(async () => {
        widget.state.isActive = false;
        await widget.save();
        io.to(`user-${req.user._id}`).emit('widget-status-update', {
          widgetId: widget._id,
          isActive: false,
          lastValue: widget.state.lastValue
        });
      }, 500);
    }

    // ✅ حفظ الرسالة لو نوعها ترمنال
    if (widget.type === 'terminal') {
      const terminalMessage = new TerminalMessage({
        userId: req.user._id,
        widgetId: widget._id,
        message: commandValue,
        type: 'sent',
        timestamp: new Date()
      });
      await terminalMessage.save();

      io.to(`user-${req.user._id}`).emit('terminal-message', {
        widgetId: widget._id,
        message: commandValue,
        type: 'sent',
        timestamp: terminalMessage.timestamp
      });
    }

    await widget.save();

    io.to(`user-${req.user._id}`).emit('widget-status-update', {
      widgetId: widget._id,
      isActive: widget.state.isActive,
      lastValue: widget.state.lastValue,
      lastUpdate: widget.state.lastUpdate
    });

    res.json({ msg: 'تم إرسال الأمر بنجاح إلى Adafruit IO.', widget });

  } catch (err) {
    console.error('❌ خطأ في إرسال الأمر إلى Adafruit IO:', err.message);

    // زيادة عدد المحاولات حتى مع الفشل
    if (req.body.widgetId) {
      try {
        await Widget.findByIdAndUpdate(req.body.widgetId, {
          $inc: { 'analytics.totalCommands': 1 }
        });
      } catch (updateErr) {
        console.error('❌ خطأ في تحديث إحصائيات الأوامر الفاشلة:', updateErr);
      }
    }

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
    const widget = await Widget.findOne({ _id: widgetId, userId, type: 'terminal' });
    if (!widget) {
      return res.status(404).json({ msg: 'لم يتم العثور على أداة الترمنال هذه أو لا تملك صلاحية الوصول إليها.' });
    }

    const messages = await TerminalMessage.find({ widgetId, userId })
      .sort({ timestamp: -1 }) // الأحدث أولاً
      .limit(50); // آخر 50 رسالة

    res.json(messages.reverse()); // عكس الترتيب لعرض الأقدم أولاً في الواجهة الأمامية

  } catch (err) {
    console.error('❌ خطأ في جلب رسائل الترمنال:', err.message);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء جلب رسائل الترمنال.' });
  }
});
app.get('/api/user/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'المستخدم غير موجود' });

        // ✅ الحساب يكون مكتمل إذا كان عنده password
        // (Google users بدون password يعتبروا غير مكتملين)
        const isAccountComplete = !!(user.password);

        const userProfile = {
            id: user._id,
            username: user.username,
            email: user.email,
            googleId: user.googleId,
            googleEmail: user.googleEmail,
            googleProfilePicture: user.googleProfilePicture,
            password: !!user.password, // ✅ نرجع true/false بس (مش الـ hash)
            adafruitUsername: user.adafruitUsername || '',
            preferences: user.preferences,
            security: {
                lastLogin: user.security?.lastLogin,
                twoFactorEnabled: user.security?.twoFactorEnabled
            },
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
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
    const userId = req.user._id;

    const widgets = await Widget.find({ userId });
    const totalWidgets = widgets.length;
    const totalCommands = widgets.reduce((sum, widget) => sum + (widget.analytics?.totalCommands || 0), 0);
    const successfulCommands = widgets.reduce((sum, widget) => sum + (widget.analytics?.successfulCommands || 0), 0);
    const successRate = totalCommands > 0 ? Math.round((successfulCommands / totalCommands) * 100) : 100;

    // حساب الأيام النشطة (تبسيط لأغراض العرض)
    const daysSinceJoin = Math.floor((Date.now() - new Date(req.user.createdAt).getTime()) / (1000 * 60 * 60 * 24));
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
    const sessions = await Session.find({
      userId: req.user._id,
      isActive: true
    }).sort({ lastActivity: -1 }); // ترتيب من الأحدث إلى الأقدم

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
    const session = await Session.findOne({ _id: req.params.sessionId, userId: req.user._id });
    if (!session) {
      return res.status(404).json({ msg: 'الجلسة غير موجودة أو لا تملك صلاحية لإنهائها.' });
    }

    await Session.findByIdAndUpdate(req.params.sessionId, { isActive: false, expiresAt: new Date() });
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
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ msg: 'المستخدم غير موجود.' });

    // تحديث اسم المستخدم
    if (username !== undefined && username.trim() !== '') {
      const u = username.trim();
      if (u && u !== user.username) {
        const usernameExists = await User.findOne({ username: u, _id: { $ne: user._id } });
        if (usernameExists) {
          return res.status(400).json({ msg: 'اسم المستخدم هذا مستخدم بالفعل من قبل شخص آخر.' });
        }
        user.username = u;
      }
    }

    // تحديث البريد الإلكتروني
    if (email !== undefined && email.trim() !== '') {
      const e = email.trim().toLowerCase();
      if (e && e !== user.email) {
        const emailExists = await User.findOne({ email: e, _id: { $ne: user._id } });
        if (emailExists) {
          return res.status(400).json({ msg: 'البريد الإلكتروني هذا مستخدم بالفعل من قبل شخص آخر.' });
        }
        user.email = e;
      }
    }

    // تحديث كلمة المرور
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ msg: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.' });
      }
      user.password = await AuthService.hashPassword(password);
    }

    // تحديث بيانات Adafruit IO
    user.adafruitUsername = (adafruitUsername || '').trim();
    user.adafruitApiKey = (adafruitApiKey || '').trim();

    await user.save();
    // إرجاع بيانات المستخدم المحدثة (بدون كلمة المرور)
    const updated = await User.findById(user._id).select('-password');
    res.json({ msg: 'تم تحديث ملفك الشخصي بنجاح.', user: updated });
  } catch (err) {
    console.error('❌ خطأ في تحديث ملف المستخدم الشخصي:', err);
    // معالجة الأخطاء المتعلقة بتكرار البيانات (مثلاً إذا تم استخدام اسم المستخدم/البريد الإلكتروني بالفعل)
    if (err.code === 11000) {
      if (err.keyPattern.username) return res.status(400).json({ msg: 'اسم المستخدم هذا مستخدم بالفعل.' });
      if (err.keyPattern.email) return res.status(400).json({ msg: 'البريد الإلكتروني هذا مستخدم بالفعل.' });
    }
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

    await User.findByIdAndUpdate(req.user._id, updateData, { new: true, runValidators: true });

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
    
    const widget = await Widget.findOne({ _id: widgetId, userId: req.user._id, type: 'sensor' });
    if (!widget) {
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
    widget.state.lastValue = data.value;
    widget.state.lastUpdate = new Date(data.created_at);
    widget.state.isActive = true;
    await widget.save();

    // إرسال تحديث عبر Socket.IO
    io.to(`user-${req.user._id}`).emit('sensor-data', {
      widgetId: widget._id,
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
        
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { googleProfilePicture },
            { new: true }
        );
        
        if (!user) {
            return res.status(404).json({ msg: 'المستخدم غير موجود' });
        }
        
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
    const userId = req.user._id;

    const widget = await Widget.findOne({ _id: widgetId, userId, type: 'terminal' });
    if (!widget) {
      return res.status(404).json({ msg: 'الترمينال غير موجود' });
    }

    // جلب الرسائل مع دعم limit
    const messages = await TerminalMessage.find({ widgetId, userId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

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
async function pollAdafruitIO() {
  try {
    const users = await User.find({ 
      adafruitUsername: { $ne: '' }, 
      adafruitApiKey: { $ne: '' } 
    });

    for (const user of users) {
      const widgets = await Widget.find({ userId: user._id, type: { $in: ['sensor', 'terminal'] } });
      
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
            if (widget.state.lastValue !== newValue || 
                !widget.state.lastUpdate || 
                newTimestamp > widget.state.lastUpdate) {
              
              // تحديث الويدجت
              widget.state.lastValue = newValue;
              widget.state.lastUpdate = newTimestamp;
              widget.state.isActive = true;
              await widget.save();

              // إرسال التحديث عبر Socket.IO
              if (widget.type === 'sensor') {
                io.to(`user-${user._id}`).emit('sensor-data', {
                  widgetId: widget._id,
                  value: newValue,
                  timestamp: data.created_at,
                  isActive: true,
                  lastUpdate: newTimestamp
                });
              } else if (widget.type === 'terminal') {
                // حفظ كرسالة ترمينال جديدة
                const terminalMessage = new TerminalMessage({
                  userId: user._id,
                  widgetId: widget._id,
                  message: newValue,
                  type: 'received',
                  timestamp: newTimestamp
                });
                await terminalMessage.save();

                io.to(`user-${user._id}`).emit('terminal-message', {
                  widgetId: widget._id,
                  message: newValue,
                  type: 'received',
                  timestamp: newTimestamp
                });
              }
            }
          }
        } catch (widgetErr) {
          console.error(`خطأ في تحديث الويدجت ${widget._id}:`, widgetErr);
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

        const widget = await Widget.findOne({ 
            _id: widgetId, 
            userId: req.user._id 
        });

        if (!widget) {
            return res.status(404).json({ msg: 'الأداة غير موجودة' });
        }

        // تحديث موضع الأداة
        widget.gs = {
            x: parseInt(gs.x) || 0,
            y: parseInt(gs.y) || 0,
            w: parseInt(gs.w) || 1,
            h: parseInt(gs.h) || 1
        };

        await widget.save();

        console.log(`✅ تم حفظ موضع الأداة ${widget.name}: (${widget.gs.x}, ${widget.gs.y})`);

        res.json({ 
            msg: 'تم حفظ موضع الأداة بنجاح',
            gs: widget.gs
        });

    } catch (error) {
        console.error('❌ خطأ في حفظ موضع الأداة:', error);
        res.status(500).json({ msg: 'فشل في حفظ موضع الأداة' });
    }
});

// تصدير بيانات المستخدم (JSON Backup)
app.get('/api/user/export', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    const widgets = await Widget.find({ userId: req.user._id });

    const exportData = {
      user: {
        username: user.username,
        email: user.email,
        adafruitUsername: user.adafruitUsername,
        preferences: user.preferences,
        createdAt: user.createdAt,
        lastLogin: user.security?.lastLogin // تضمين آخر تسجيل دخول
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

    // اختيار استراتيجية الاستيراد:
    // 1. حذف جميع الأدوات الحالية للمستخدم وإضافة الأدوات المستوردة (للتجنب التكرار والتعارض)
    await Widget.deleteMany({ userId: req.user._id });

    // 2. إضافة الأدوات الجديدة من البيانات المستوردة
    const newWidgets = importedWidgets.map(widgetData => ({
      userId: req.user._id,
      name: widgetData.name || 'أداة مستوردة',
      feedName: widgetData.feedName || 'default-feed',
      type: widgetData.type || 'toggle',
      icon: widgetData.icon || 'fas fa-toggle-on',
      configuration: {
        onCommand: widgetData.configuration?.onCommand || 'ON',
        offCommand: widgetData.configuration?.offCommand || 'OFF',
        unit: widgetData.configuration?.unit || ''
      },
      appearance: {
        primaryColor: widgetData.appearance?.primaryColor || '#8A2BE2',
        activeColor: widgetData.appearance?.activeColor || '#00e5ff',
        glowColor: widgetData.appearance?.glowColor || '#8A2BE2'
      },
      state: {
        isActive: false, // تعيين الحالة الافتراضية
        lastValue: null,
        lastUpdate: new Date()
      },
      analytics: {
        totalCommands: 0,
        successfulCommands: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    if (newWidgets.length > 0) {
      await Widget.insertMany(newWidgets);
    }

    // إرسال تحديث Socket.IO إلى الواجهة الأمامية لإعادة تحميل الأدوات
    io.to(`user-${req.user._id}`).emit('widgets-reloaded');

    res.json({ msg: `تم استيراد ${newWidgets.length} أداة بنجاح.` });
  } catch (err) {
    console.error('❌ خطأ في استيراد البيانات:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء استيراد البيانات. يرجى التأكد من أن الملف بصيغة JSON صحيحة.' });
  }
});


// تمكين المصادقة الثنائية (Enable 2FA)
app.post('/api/auth/enable-2fa', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ msg: 'المستخدم غير موجود.' });
    }

    if (user.security.twoFactorEnabled) {
      return res.status(400).json({ msg: 'المصادقة الثنائية ممكّنة بالفعل.' });
    }

    // توليد مفتاح سري جديد (استخدام عشوائي بسيط هنا، استخدم مكتبة TOTP في الإنتاج)
    const secret = crypto.randomBytes(20).toString('hex'); // مفتاح سري عشوائي

    user.security.twoFactorEnabled = true;
    user.security.twoFactorSecret = secret;
    await user.save();

    res.json({
      msg: 'تم تفعيل المصادقة الثنائية بنجاح.',
      secret: secret // يجب عرض هذا الرمز للمستخدم ليتمكن من إعداده في تطبيق المصادقة الخاص به
    });
  } catch (err) {
    console.error('❌ خطأ في تفعيل المصادقة الثنائية:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء تفعيل المصادقة الثنائية.' });
  }
});

// حذف الحساب (Delete Account)
app.delete('/api/user/delete-account', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // حذف جميع البيانات المرتبطة بالمستخدم بشكل آمن ومنظم
    await Promise.all([
      Widget.deleteMany({ userId }), // حذف جميع الأدوات الخاصة بالمستخدم
      Session.deleteMany({ userId }), // حذف جميع جلسات المستخدم
      User.findByIdAndDelete(userId) // حذف حساب المستخدم نفسه
    ]);

    res.json({ msg: 'تم حذف الحساب وجميع البيانات المرتبطة به بنجاح. نأمل أن نراك مرة أخرى!' });
  } catch (err) {
    console.error('❌ خطأ في حذف الحساب:', err);
    res.status(500).json({ msg: 'حدث خطأ في الخادم أثناء حذف الحساب. يرجى المحاولة مرة أخرى.' });
  }
});
// دالة لجلب التحديثات تلقائياً
async function pollAdafruitIO() {
  try {
    const users = await User.find({ 
      adafruitUsername: { $ne: '' }, 
      adafruitApiKey: { $ne: '' } 
    });

    for (const user of users) {
      const widgets = await Widget.find({ userId: user._id, type: { $in: ['sensor', 'terminal'] } });
      
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

            if (widget.state.lastValue !== newValue || 
                !widget.state.lastUpdate || 
                newTimestamp > widget.state.lastUpdate) {
              
              widget.state.lastValue = newValue;
              widget.state.lastUpdate = newTimestamp;
              widget.state.isActive = true;
              await widget.save();

              if (widget.type === 'sensor') {
                io.to(`user-${user._id}`).emit('sensor-data', {
                  widgetId: widget._id,
                  value: newValue,
                  timestamp: data.created_at,
                  isActive: true,
                  lastUpdate: newTimestamp
                });
              }
            }
          }
        } catch (widgetErr) {
          console.error(`خطأ في تحديث الويدجت ${widget._id}:`, widgetErr);
        }
      }
    }
  } catch (err) {
    console.error('❌ خطأ في polling Adafruit IO:', err);
  }
}

// تشغيل polling كل 5 ثوانٍ
setInterval(pollAdafruitIO, 5000);

// ==========================================================
// START: NEW 2FA AND SESSION ENDPOINTS
// ==========================================================

// تفعيل المصادقة الثنائية
app.post('/api/user/enable-2fa', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        user.security.twoFactorEnabled = true;
        await user.save();
        res.json({ msg: 'تم تفعيل المصادقة الثنائية بنجاح.' });
    } catch (err) {
        res.status(500).json({ msg: 'خطأ في الخادم.' });
    }
});

// تعطيل المصادقة الثنائية
app.post('/api/user/disable-2fa', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        user.security.twoFactorEnabled = false;
        await user.save();
        res.json({ msg: 'تم إلغاء تفعيل المصادقة الثنائية.' });
    } catch (err) {
        res.status(500).json({ msg: 'خطأ في الخادم.' });
    }
});

// ==========================================================
// END: NEW 2FA AND SESSION ENDPOINTS
// ==========================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT} - http://0.0.0.0:${PORT}`);
});