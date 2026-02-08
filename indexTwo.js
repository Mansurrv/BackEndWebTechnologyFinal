const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const MongoDBStore = require('connect-mongodb-session')(session);

require('dotenv').config();

console.log('Environment loaded. PORT:', process.env.PORT);
console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');

const requiredEnv = ['SESSION_SECRET', 'MONGODB_URI'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error(`❌ Missing required env vars: ${missingEnv.join(', ')}`);
  process.exit(1);
}

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(cors({ origin: true, credentials: true }));

app.use((req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Content-Security-Policy');
  res.removeHeader('X-WebKit-CSP');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

const sessionStore = new MongoDBStore({
  uri: process.env.MONGODB_URI,
  collection: 'sessions',
  connectionOptions: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
});

sessionStore.on('error', function(error) {
  console.error('Session store error:', error);
});

const cookieSecure = process.env.COOKIE_SECURE === 'true';
if (cookieSecure) {
  app.set('trust proxy', 1);
}

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: cookieSecure ? 'none' : 'lax',
    secure: cookieSecure
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

const SchemaContact = new mongoose.Schema({
  name: String,
  email: String,
  number: String,
  message: String,
  date: { type: Date, default: Date.now }
});
const Contact = mongoose.model('Contact', SchemaContact);

const SchemaConstructor = new mongoose.Schema({
  position: Number,
  team: String,
  color: String,
  drivers: String,
  points: Number,
  wins: Number,
  podiums: Number,
  season: Number
});
const Constructor = mongoose.model('Constructor', SchemaConstructor);

const SchemaDriver = new mongoose.Schema({
  name: String,
  team: String,
  constructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Constructor'
  },
  nationality: String,
  points: Number,
  wins: Number,
  podiums: Number,
  championships: Number,
  season: Number,
  polePositions: Number,
  starts: Number,
  image_url: String
});
const Driver = mongoose.model('Driver', SchemaDriver);

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  favoriteTeams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Constructor'
  }],
  favoriteDrivers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  }],
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
});

userSchema.pre('save', async function() {

  if (this.isModified('password')) {
    console.log('Hashing password for user:', this.username);
    try {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(this.password, salt);
      this.password = hash;
      console.log('Password hashed successfully');
    } catch (err) {
      console.error('Password hashing error:', err);
      throw err;
    }
  }
});

userSchema.methods.comparePassword = function(candidatePassword) {
  return new Promise((resolve, reject) => {
    bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
      if (err) return reject(err);
      resolve(isMatch);
    });
  });
};

const User = mongoose.model('User', userSchema);

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});
const Notification = mongoose.model('Notification', notificationSchema);

passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return done(null, false, { message: 'Invalid email or password' });
    }

    if (user.isActive === false) {
      return done(null, false, { message: 'Account is disabled. Contact admin.' });
    }
    
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return done(null, false, { message: 'Invalid email or password' });
    }
    

    user.lastLogin = new Date();
    await user.save();
    
    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}

function isAuthenticatedApi(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({
    success: false,
    message: 'Authentication required'
  });
}

function isAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  res.status(403).send('Access denied');
}

function requireAdminApi(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  return next();
}

function requireValidObjectId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid id'
    });
  }
  return next();
}

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

function getPaginationParams(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(query.limit, 10) || DEFAULT_PAGE_LIMIT, 1),
    MAX_PAGE_LIMIT
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

app.get('/', (req, res) => {
  console.log('User in session:', req.user ? req.user.username : 'No user');
  res.render('index', { user: req.user || null });
});

app.get('/constructorsPage', (req, res) => res.render('constructorsPage', { user: req.user || null }));
app.get('/driversPage', (req, res) => res.render('driversPage', { user: req.user || null }));
app.get('/contact', (req, res) => res.render('contact', { user: req.user || null }));
app.get('/add', isAdmin, (req, res) => res.render('add', { user: req.user || null }));
app.get('/mongo', (req, res) => res.render('filters', { user: req.user || null }));
app.get('/sqll', isAdmin, (req, res) => res.render('sqll', { user: req.user || null }));
app.get('/constructor-manager', isAdmin, (req, res) => res.render('constructor-manager', { user: req.user || null }));
app.get('/admin', isAdmin, (req, res) => res.render('admin', { user: req.user || null }));

app.get('/login', (req, res) => {
  return res.redirect('/');
});

app.get('/test-user-model', async (req, res) => {
    try {
        console.log('Testing User model...');
        

        const users = await User.find({});
        console.log('Existing users:', users.length);
        

        const testUser = new User({
            username: 'testuser',
            email: 'test@example.com',
            password: 'Test123!'
        });
        
        console.log('Test user object created');
        
        res.json({
            success: true,
            usersCount: users.length,
            testUser: {
                username: testUser.username,
                email: testUser.email,
                hasPassword: !!testUser.password
            }
        });
        
    } catch (error) {
        console.error('User model test error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

app.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const user = req.user;
    

    const favoriteTeams = await Constructor.find({
      _id: { $in: user.favoriteTeams }
    }).sort({ position: 1 });
    

    const favoriteDrivers = await Driver.find({
      _id: { $in: user.favoriteDrivers }
    }).sort({ points: -1 });
    
    res.render('dashboard', {
      user: user,
      favoriteTeams: favoriteTeams,
      favoriteDrivers: favoriteDrivers,
      favoritesCount: user.favoriteTeams.length + user.favoriteDrivers.length,
      message: req.query.message || null,
      messageType: req.query.type || null
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.redirect('/');
  }
});

app.post('/profile', isAuthenticated, async (req, res) => {
  try {
    const { username, email, currentPassword, newPassword, confirmNewPassword } = req.body;
    const updates = {};

    if (!username || !email) {
      const message = 'Username and email are required';
      if (wantsJSON(req)) return res.status(400).json({ success: false, message });
      return res.redirect('/dashboard?type=error&message=' + encodeURIComponent(message));
    }

    if (username.length < 3 || username.length > 30) {
      const message = 'Username must be between 3 and 30 characters';
      if (wantsJSON(req)) return res.status(400).json({ success: false, message });
      return res.redirect('/dashboard?type=error&message=' + encodeURIComponent(message));
    }

    const normalizedEmail = email.toLowerCase();

    if (username !== req.user.username) {
      const existingByUsername = await User.findOne({ username });
      if (existingByUsername) {
        const message = 'Username already taken';
        if (wantsJSON(req)) return res.status(400).json({ success: false, message });
        return res.redirect('/dashboard?type=error&message=' + encodeURIComponent(message));
      }
      updates.username = username;
    }

    if (normalizedEmail !== req.user.email) {
      const existingByEmail = await User.findOne({ email: normalizedEmail });
      if (existingByEmail) {
        const message = 'Email already registered';
        if (wantsJSON(req)) return res.status(400).json({ success: false, message });
        return res.redirect('/dashboard?type=error&message=' + encodeURIComponent(message));
      }
      updates.email = normalizedEmail;
    }

    if (newPassword || confirmNewPassword) {
      if (!currentPassword) {
        const message = 'Current password is required to change your password';
        if (wantsJSON(req)) return res.status(400).json({ success: false, message });
        return res.redirect('/dashboard?type=error&message=' + encodeURIComponent(message));
      }

      const isMatch = await req.user.comparePassword(currentPassword);
      if (!isMatch) {
        const message = 'Current password is incorrect';
        if (wantsJSON(req)) return res.status(400).json({ success: false, message });
        return res.redirect('/dashboard?type=error&message=' + encodeURIComponent(message));
      }

      if (!newPassword || newPassword.length < 8) {
        const message = 'New password must be at least 8 characters';
        if (wantsJSON(req)) return res.status(400).json({ success: false, message });
        return res.redirect('/dashboard?type=error&message=' + encodeURIComponent(message));
      }

      if (newPassword !== confirmNewPassword) {
        const message = 'New passwords do not match';
        if (wantsJSON(req)) return res.status(400).json({ success: false, message });
        return res.redirect('/dashboard?type=error&message=' + encodeURIComponent(message));
      }

      updates.password = newPassword;
    }

    Object.assign(req.user, updates);
    await req.user.save();

    const successMessage = 'Profile updated successfully';
    if (wantsJSON(req)) {
      return res.json({
        success: true,
        message: successMessage,
        user: authUserPayload(req.user)
      });
    }
    return res.redirect('/dashboard?type=success&message=' + encodeURIComponent(successMessage));
  } catch (error) {
    console.error('Profile update error:', error);
    const message = 'Failed to update profile. Please try again.';
    if (wantsJSON(req)) return res.status(500).json({ success: false, message });
    return res.redirect('/dashboard?type=error&message=' + encodeURIComponent(message));
  }
});

app.get('/drivers/ver', (req, res) => res.render('ver', { user: req.user || null }));
app.get('/drivers/nor', (req, res) => res.render('lando', { user: req.user || null }));
app.get('/drivers/pia', (req, res) => res.render('piastri', { user: req.user || null }));

// ================= API Protection =================
app.use('/api', (req, res, next) => {
  if (req.path === '/auth/status') return next();
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!isWrite) return next();
  return isAuthenticatedApi(req, res, next);
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    ensureAdminUser()
      .then(() => seedData())
      .catch((err) => console.error('❌ Admin seed error:', err));
  })
  .catch(err => console.error('❌ MongoDB error:', err));

async function seedData() {
  try {

    const constructorCount = await Constructor.countDocuments();
    if (constructorCount === 0) {
      console.log('Seeding initial constructor data...');
      const initialConstructors = [
        { position: 1, team: 'Red Bull Racing', color: '#3671C6', drivers: 'Verstappen / Perez', points: 524, wins: 15, podiums: 22, season: 2024 },
        { position: 2, team: 'McLaren', color: '#FF8700', drivers: 'Norris / Piastri', points: 412, wins: 4, podiums: 18, season: 2024 },
        { position: 3, team: 'Ferrari', color: '#DC0000', drivers: 'Leclerc / Sainz', points: 406, wins: 3, podiums: 17, season: 2024 },
        { position: 4, team: 'Mercedes', color: '#27F4D2', drivers: 'Hamilton / Russell', points: 382, wins: 1, podiums: 12, season: 2024 },
        { position: 5, team: 'Aston Martin', color: '#229971', drivers: 'Alonso / Stroll', points: 280, wins: 0, podiums: 8, season: 2024 }
      ];
      await Constructor.insertMany(initialConstructors);
      console.log('✅ Constructor data seeded');
    } else {
      console.log(`✅ Found ${constructorCount} constructors in DB`);
    }

    const constructors = await Constructor.find();
    const constructorByTeam = new Map(constructors.map((c) => [c.team, c._id]));

    const driverCount = await Driver.countDocuments();
    if (driverCount === 0) {
      console.log('Seeding initial drivers data...');
      const initialDrivers = [
        { 
          name: 'Max Verstappen', 
          team: 'Red Bull Racing', 
          constructor: constructorByTeam.get('Red Bull Racing'),
          nationality: 'Dutch', 
          points: 395, 
          wins: 14, 
          podiums: 18, 
          championships: 3, 
          polePositions: 12,
          starts: 22,
          season: 2024,
          image_url: 'https://e0.365dm.com/f1/drivers/256x256/h_full_1465.png'
        },
        { 
          name: 'Lando Norris', 
          team: 'McLaren', 
          constructor: constructorByTeam.get('McLaren'),
          nationality: 'British', 
          points: 285, 
          wins: 2, 
          podiums: 12, 
          championships: 0,
          polePositions: 7,
          starts: 22,
          season: 2024,
          image_url: 'https://www.kymillman.com/wp-content/uploads/f1/pages/driver-profiles/driver-faces/lando-norris-f1-driver-profile-picture.png'
        },
        { 
          name: 'Charles Leclerc', 
          team: 'Ferrari', 
          constructor: constructorByTeam.get('Ferrari'),
          nationality: 'Monegasque', 
          points: 252, 
          wins: 2, 
          podiums: 8, 
          championships: 0,
          polePositions: 5,
          starts: 22,
          season: 2024,
          image_url: 'https://www.formulaonehistory.com/wp-content/uploads/2023/10/Charles-Leclerc-F1-2023.webp'
        },
        { 
          name: 'Sergio Perez', 
          team: 'Red Bull Racing', 
          constructor: constructorByTeam.get('Red Bull Racing'),
          nationality: 'Mexican', 
          points: 229, 
          wins: 2, 
          podiums: 10, 
          championships: 0,
          polePositions: 2,
          starts: 22,
          season: 2024,
          image_url: 'https://a.espncdn.com/combiner/i?img=/i/headshots/rpm/players/full/4472.png'
        },
        { 
          name: 'Oscar Piastri', 
          team: 'McLaren', 
          constructor: constructorByTeam.get('McLaren'),
          nationality: 'Australian', 
          points: 197, 
          wins: 1, 
          podiums: 7, 
          championships: 0,
          polePositions: 2,
          starts: 22,
          season: 2024,
          image_url: 'https://a.espncdn.com/combiner/i?img=/i/headshots/rpm/players/full/5752.png&w=350&h=254'
        }
      ];
      await Driver.insertMany(initialDrivers);
      console.log('✅ Drivers data seeded');
    } else {
      console.log(`✅ Found ${driverCount} drivers in DB`);
    }

    const driversMissingConstructor = await Driver.find({ constructor: { $exists: false } });
    if (driversMissingConstructor.length) {
      console.log('Linking drivers to constructors...');
      for (const driver of driversMissingConstructor) {
        const constructorId = constructorByTeam.get(driver.team);
        if (constructorId) {
          driver.constructor = constructorId;
          await driver.save();
        }
      }
    }
    
  } catch (err) {
    console.error('Error seeding data:', err.message);
  }
}

async function ensureAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';

  if (!adminEmail || !adminPassword) {
    console.log('ℹ️  ADMIN_EMAIL/ADMIN_PASSWORD not set. Skipping admin seed.');
    return;
  }

  const normalizedEmail = adminEmail.toLowerCase();
  const adminUser = await User.findOne({
    $or: [
      { email: normalizedEmail },
      { username: adminUsername }
    ]
  });

  if (!adminUser) {
    console.log('Creating admin user...');
    const admin = new User({
      username: adminUsername,
      email: normalizedEmail,
      password: adminPassword,
      role: 'admin'
    });
    await admin.save();
    console.log('✅ Admin user created');
    return;
  }

  let needsSave = false;
  if (adminUser.role !== 'admin') {
    adminUser.role = 'admin';
    needsSave = true;
  }
  if (adminUsername && adminUser.username !== adminUsername) {
    adminUser.username = adminUsername;
    needsSave = true;
  }
  if (adminUser.email !== normalizedEmail) {
    const emailOwner = await User.findOne({ email: normalizedEmail });
    if (!emailOwner || emailOwner._id.toString() === adminUser._id.toString()) {
      adminUser.email = normalizedEmail;
      needsSave = true;
    } else {
      console.warn('⚠️  ADMIN_EMAIL is already used by another account. Skipping email update.');
    }
  }
  const passwordMatches = await adminUser.comparePassword(adminPassword).catch(() => false);
  if (!passwordMatches) {
    adminUser.password = adminPassword;
    needsSave = true;
  }
  if (needsSave) {
    await adminUser.save();
    console.log('✅ Admin user updated from environment settings');
  }
}

app.post('/send-data', isAuthenticatedApi, async (req, res) => {
  try {
    const contact = new Contact({
      name: req.body.name,
      email: req.body.email,
      number: req.body.number,
      message: req.body.msg
    });
    await contact.save();
    res.json({ status: "success", saved: contact });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get('/api/constructors', async (req, res) => {
  try {
    const { season, team, minPoints, maxPoints, fields, search } = req.query;
    const filter = {};
    
    if (season) filter.season = Number(season);
    if (team) filter.team = team;
    
    if (search) {
      filter.$or = [
        { team: { $regex: search, $options: 'i' } },
        { drivers: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (minPoints || maxPoints) {
      filter.points = {};
      if (minPoints) filter.points.$gte = Number(minPoints);
      if (maxPoints) filter.points.$lte = Number(maxPoints);
    }
    
    let projection = null;
    if (fields) projection = fields.split(',').join(' ');
    
    const { page, limit, skip } = getPaginationParams(req.query);
    const [total, constructors] = await Promise.all([
      Constructor.countDocuments(filter),
      Constructor.find(filter, projection)
        .sort({ position: 1 })
        .skip(skip)
        .limit(limit)
    ]);
    
    res.json({ 
      success: true,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      count: constructors.length,
      data: constructors 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

app.get('/api/constructors/:id', requireValidObjectId, async (req, res) => {
  try {
    const constructor = await Constructor.findById(req.params.id);
    if (!constructor) {
      return res.status(404).json({ 
        success: false,
        error: 'Constructor not found' 
      });
    }
    res.json({
      success: true,
      data: constructor
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

app.post('/api/constructors', requireAdminApi, async (req, res) => {
  try {
    const { position, team, color, drivers, points, wins, podiums, season } = req.body;
    
    if (!team || !drivers || position === undefined) {
      return res.status(400).json({ 
        success: false,
        error: 'Position, team, and drivers are required' 
      });
    }

    const constructor = new Constructor({
      position: Number(position),
      team: team.trim(),
      color: color || '#FF0000',
      drivers: drivers.trim(),
      points: points ? Number(points) : 0,
      wins: wins ? Number(wins) : 0,
      podiums: podiums ? Number(podiums) : 0,
      season: season ? Number(season) : 2024
    });

    await constructor.save();
    
    res.status(201).json({
      success: true,
      data: constructor,
      message: 'Constructor created successfully'
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

app.put('/api/constructors/:id', requireAdminApi, requireValidObjectId, async (req, res) => {
  try {
    const { position, team, color, drivers, points, wins, podiums, season } = req.body;
    
    if (!team || !drivers || position === undefined) {
      return res.status(400).json({ 
        success: false,
        error: 'Position, team, and drivers are required' 
      });
    }

    const updateData = {
      position: Number(position),
      team: team.trim(),
      color: color || '#FF0000',
      drivers: drivers.trim(),
      points: points ? Number(points) : 0,
      wins: wins ? Number(wins) : 0,
      podiums: podiums ? Number(podiums) : 0,
      season: season ? Number(season) : 2024
    };

    const updated = await Constructor.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updated) {
      return res.status(404).json({ 
        success: false,
        error: 'Constructor not found' 
      });
    }
    
    res.json({
      success: true,
      data: updated,
      message: 'Constructor updated successfully'
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

app.delete('/api/constructors/:id', requireAdminApi, requireValidObjectId, async (req, res) => {
  try {
    const deleted = await Constructor.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ 
        success: false,
        error: 'Constructor not found' 
      });
    }
    
    res.json({ 
      success: true,
      message: 'Constructor deleted successfully', 
      deletedId: deleted._id 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

app.get('/api/constructors/stats', async (req, res) => {
  try {
    const constructors = await Constructor.find();
    
    const totalConstructors = constructors.length;
    const totalPoints = constructors.reduce((sum, c) => sum + (c.points || 0), 0);
    const totalWins = constructors.reduce((sum, c) => sum + (c.wins || 0), 0);
    const totalPodiums = constructors.reduce((sum, c) => sum + (c.podiums || 0), 0);
    
    res.json({
      success: true,
      data: {
        totalConstructors,
        totalPoints,
        totalWins,
        totalPodiums,
        averagePoints: totalConstructors > 0 ? totalPoints / totalConstructors : 0
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

app.get('/api/drivers', async (req, res) => {
  console.log('GET /api/drivers called');
  try {
    const { team, season, search } = req.query;
    const filter = {};

    if (team) filter.team = team;
    if (season) filter.season = Number(season);
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { team: { $regex: search, $options: 'i' } },
        { nationality: { $regex: search, $options: 'i' } }
      ];
    }

    const { page, limit, skip } = getPaginationParams(req.query);
    const [total, drivers] = await Promise.all([
      Driver.countDocuments(filter),
      Driver.find(filter)
        .populate('constructor', 'team color')
        .sort({ points: -1 })
        .skip(skip)
        .limit(limit)
    ]);

    console.log(`Found ${drivers.length} drivers`);
    
    res.json({
      success: true,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      count: drivers.length,
      data: drivers
    });
    
  } catch (err) {
    console.error('Error in GET /api/drivers:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

app.post('/api/drivers', requireAdminApi, async (req, res) => {
  console.log('POST /api/drivers called with:', req.body);
  try {
    const { name, team, points, wins, podiums, constructorId } = req.body;
    
    if (!name || !team) {
      return res.status(400).json({ 
        success: false,
        error: 'Name and team are required' 
      });
    }

    let constructorRef = null;
    if (constructorId) {
      if (!mongoose.isValidObjectId(constructorId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid constructor id'
        });
      }
      constructorRef = constructorId;
    } else {
      const constructorDoc = await Constructor.findOne({ team: team.trim() });
      if (constructorDoc) {
        constructorRef = constructorDoc._id;
      }
    }

    if (!constructorRef) {
      return res.status(400).json({
        success: false,
        error: 'Constructor not found. Create the constructor first.'
      });
    }

    const driver = new Driver({
      name: name.trim(),
      team: team.trim(),
      constructor: constructorRef,
      nationality: 'Unknown',
      points: points ? Number(points) : 0,
      wins: wins ? Number(wins) : 0,
      podiums: podiums ? Number(podiums) : 0,
      championships: 0,
      polePositions: 0,
      starts: 0,
      season: 2024
    });

    await driver.save();
    console.log('Driver saved:', driver);
    
    res.status(201).json({
      success: true,
      data: {
        id: driver._id,
        name: driver.name,
        team: driver.team,
        points: driver.points,
        wins: driver.wins,
        podiums: driver.podiums
      },
      message: 'Driver created successfully'
    });
  } catch (err) {
    console.error('Error in POST /api/drivers:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

app.put('/api/drivers/:id', requireAdminApi, requireValidObjectId, async (req, res) => {
  console.log('PUT /api/drivers/:id called with:', req.params.id, req.body);
  try {
    const { points } = req.body;
    
    if (!points && points !== 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Points are required' 
      });
    }

    const updated = await Driver.findByIdAndUpdate(
      req.params.id,
      { points: Number(points) },
      { new: true }
    );
    
    if (!updated) {
      return res.status(404).json({ 
        success: false,
        error: 'Driver not found' 
      });
    }
    
    console.log('Driver updated:', updated);
    
    res.json({
      success: true,
      data: {
        id: updated._id,
        name: updated.name,
        team: updated.team,
        points: updated.points,
        wins: updated.wins,
        podiums: updated.podiums
      },
      message: 'Driver updated successfully'
    });
  } catch (err) {
    console.error('Error in PUT /api/drivers/:id:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

app.delete('/api/drivers/:id', requireAdminApi, requireValidObjectId, async (req, res) => {
  console.log('DELETE /api/drivers/:id called with:', req.params.id);
  try {
    const deleted = await Driver.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ 
        success: false,
        error: 'Driver not found' 
      });
    }
    
    console.log('Driver deleted:', deleted);
    
    res.json({ 
      success: true,
      message: 'Driver deleted successfully', 
      deletedId: deleted._id 
    });
  } catch (err) {
    console.error('Error in DELETE /api/drivers/:id:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    
    if (!query || query.trim().length < 2) {
      return res.json({
        success: true,
        data: [],
        message: 'Query too short'
      });
    }
    
    const searchTerm = query.trim().toLowerCase();
    

    const constructors = await Constructor.find({
      $or: [
        { team: { $regex: searchTerm, $options: 'i' } },
        { drivers: { $regex: searchTerm, $options: 'i' } }
      ]
    }).limit(5);
    

    const drivers = await Driver.find({
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { team: { $regex: searchTerm, $options: 'i' } },
        { nationality: { $regex: searchTerm, $options: 'i' } }
      ]
    }).limit(5);
    

    const constructorResults = constructors.map(constructor => ({
      type: 'constructor',
      id: constructor._id,
      name: constructor.team,
      description: `Constructors' Championship: Position ${constructor.position}`,
      detail: `Drivers: ${constructor.drivers} • Points: ${constructor.points}`,
      position: constructor.position,
      drivers: constructor.drivers,
      points: constructor.points
    }));
    
    const driverResults = drivers.map(driver => ({
      type: 'driver',
      id: driver._id,
      name: driver.name,
      description: `Drivers' Championship`,
      detail: `Team: ${driver.team} • Points: ${driver.points}`,
      team: driver.team,
      points: driver.points,
      nationality: driver.nationality
    }));
    

    const allResults = [...constructorResults, ...driverResults];
    
    res.json({
      success: true,
      count: allResults.length,
      data: allResults,
      query: searchTerm
    });
    
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: err.message
    });
  }
});

app.get('/api/auth/status', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            authenticated: true,
            user: {
                id: req.user._id,
                username: req.user.username,
                email: req.user.email,
                role: req.user.role,
                isActive: req.user.isActive !== false
            }
        });
    } else {
        res.json({
            authenticated: false
        });
    }
});

const wantsJSON = (req) => {
    if (req.xhr) return true;
    if (req.is('application/json')) return true;
    const accept = req.headers.accept || '';
    return accept.includes('application/json');
};

const authUserPayload = (user) => ({
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role
});

app.post('/login', (req, res, next) => {
    console.log('Login attempt for email:', req.body.email);
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            console.error('Login error:', err);
            if (wantsJSON(req)) {
                return res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
            }
            return res.redirect('/login?error=' + encodeURIComponent('Login failed. Please try again.'));
        }
        
        if (!user) {
            const message = info?.message || 'Invalid credentials';
            console.log('Login failed:', message);
            if (wantsJSON(req)) {
                return res.status(401).json({ success: false, message });
            }
            return res.redirect('/login?error=' + encodeURIComponent(message));
        }
        
        req.logIn(user, (err) => {
            if (err) {
                console.error('Session error:', err);
                if (wantsJSON(req)) {
                    return res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
                }
                return res.redirect('/login?error=' + encodeURIComponent('Login failed. Please try again.'));
            }
            
            console.log('Login successful for user:', user.username);
            const finish = () => {
                if (wantsJSON(req)) {
                    return res.json({
                        success: true,
                        message: 'Login successful!',
                        user: authUserPayload(user),
                        redirect: '/dashboard'
                    });
                }
                return res.redirect('/dashboard');
            };

            if (req.session) {
                return req.session.save((saveErr) => {
                    if (saveErr) {
                        console.error('Session save error:', saveErr);
                    }
                    finish();
                });
            }
            return finish();
        });
    })(req, res, next);
});

app.post('/register', async (req, res) => {
    try {
        console.log('Registration attempt:', req.body);
        const { username, email, password, confirmPassword } = req.body;
        

        if (!username || !email || !password || !confirmPassword) {
            const message = 'All fields are required';
            if (wantsJSON(req)) return res.status(400).json({ success: false, message });
            return res.redirect('/register?error=' + encodeURIComponent(message));
        }
        
        if (password !== confirmPassword) {
            const message = 'Passwords do not match';
            if (wantsJSON(req)) return res.status(400).json({ success: false, message });
            return res.redirect('/register?error=' + encodeURIComponent(message));
        }
        
        if (password.length < 8) {
            const message = 'Password must be at least 8 characters long';
            if (wantsJSON(req)) return res.status(400).json({ success: false, message });
            return res.redirect('/register?error=' + encodeURIComponent(message));
        }
        

        const existingUser = await User.findOne({ 
            $or: [{ email: email.toLowerCase() }, { username }] 
        });
        
        if (existingUser) {
            let message = 'Registration failed';
            if (existingUser.email === email.toLowerCase()) {
                message = 'Email already registered';
            } else {
                message = 'Username already taken';
            }
            if (wantsJSON(req)) return res.status(400).json({ success: false, message });
            return res.redirect('/register?error=' + encodeURIComponent(message));
        }
        

        const user = new User({
            username,
            email: email.toLowerCase(),
            password,
            role: 'user'
        });
        
        await user.save();
        console.log('User registered successfully:', user.username);
        

        req.login(user, (err) => {
            if (err) {
                console.error('Auto-login error:', err);
                const message = 'Registration successful but auto-login failed. Please login.';
                if (wantsJSON(req)) return res.status(500).json({ success: false, message });
                return res.redirect('/login?success=' + encodeURIComponent(message));
            }
            
            console.log('User auto-logged in:', user.username);
            const finish = () => {
                if (wantsJSON(req)) {
                    return res.json({
                        success: true,
                        message: 'Registration successful! You are now logged in.',
                        user: authUserPayload(user),
                        redirect: '/dashboard'
                    });
                }
                return res.redirect('/dashboard');
            };

            if (req.session) {
                return req.session.save((saveErr) => {
                    if (saveErr) {
                        console.error('Session save error:', saveErr);
                    }
                    finish();
                });
            }
            return finish();
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        const message = 'Registration failed. Please try again.';
        if (wantsJSON(req)) {
            return res.status(500).json({ success: false, message });
        }
        res.redirect('/register?error=' + encodeURIComponent(message));
    }
});

app.post('/logout', (req, res) => {
    console.log('Logout request from user:', req.user ? req.user.username : 'Unknown');
    req.logout((err) => {
        if (err) {
            console.error('Logout error:', err);
            if (wantsJSON(req)) {
                return res.status(500).json({ success: false, message: 'Logout failed' });
            }
            return res.redirect('/?error=' + encodeURIComponent('Logout failed'));
        }
        console.log('Logout successful');
        if (wantsJSON(req)) {
            return res.json({ success: true, message: 'Logged out successfully' });
        }
        return res.redirect('/');
    });
});

app.post('/api/favorites/add', isAuthenticated, async (req, res) => {
    try {
        const { type, id } = req.body;
        const user = req.user;
        
        if (type === 'team') {
            if (!user.favoriteTeams.includes(id)) {
                user.favoriteTeams.push(id);
            }
        } else if (type === 'driver') {
            if (!user.favoriteDrivers.includes(id)) {
                user.favoriteDrivers.push(id);
            }
        }
        
        await user.save();
        
        res.json({
            success: true,
            message: 'Added to favorites'
        });
    } catch (error) {
        console.error('Add favorite error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add to favorites'
        });
    }
});

app.post('/api/favorites/remove', isAuthenticated, async (req, res) => {
    try {
        const { type, id } = req.body;
        const user = req.user;
        
        if (type === 'team') {
            user.favoriteTeams = user.favoriteTeams.filter(
                favId => favId.toString() !== id
            );
        } else if (type === 'driver') {
            user.favoriteDrivers = user.favoriteDrivers.filter(
                favId => favId.toString() !== id
            );
        }
        
        await user.save();
        
        res.json({
            success: true,
            message: 'Removed from favorites'
        });
    } catch (error) {
        console.error('Remove favorite error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove from favorites'
        });
    }
});

// ================= Admin APIs =================
app.get('/api/admin/users', requireAdminApi, async (req, res) => {
  try {
    const { search, role, status } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (status === 'active') filter.isActive = true;
    if (status === 'disabled') filter.isActive = false;

    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const { page, limit, skip } = getPaginationParams(req.query);
    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('username email role isActive createdAt lastLogin')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
    ]);

    res.json({
      success: true,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      count: users.length,
      data: users
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/admin/users/:id/role', requireAdminApi, requireValidObjectId, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }
    if (req.user._id.toString() === req.params.id && role !== 'admin') {
      return res.status(400).json({ success: false, error: 'You cannot remove your own admin role.' });
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('username email role isActive createdAt lastLogin');

    if (!updated) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/admin/users/:id/status', requireAdminApi, requireValidObjectId, async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, error: 'isActive must be boolean' });
    }
    if (req.user._id.toString() === req.params.id && isActive === false) {
      return res.status(400).json({ success: false, error: 'You cannot disable your own account.' });
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select('username email role isActive createdAt lastLogin');

    if (!updated) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/users/:id', requireAdminApi, requireValidObjectId, async (req, res) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ success: false, error: 'You cannot delete your own account.' });
    }
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, message: 'User deleted', deletedId: deleted._id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/notifications', requireAdminApi, async (req, res) => {
  try {
    const { title, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, error: 'Title and message are required' });
    }
    const notification = new Notification({
      title: title.trim(),
      message: message.trim(),
      createdBy: req.user._id
    });
    await notification.save();
    res.status(201).json({ success: true, data: notification });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/notifications', requireAdminApi, async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const [total, notifications] = await Promise.all([
      Notification.countDocuments(),
      Notification.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
    ]);
    res.json({
      success: true,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      count: notifications.length,
      data: notifications
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/notifications', isAuthenticatedApi, async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const [total, notifications] = await Promise.all([
      Notification.countDocuments(),
      Notification.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
    ]);
    res.json({
      success: true,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      count: notifications.length,
      data: notifications
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/info', (req, res) => {
  res.json({
    success: true,
    data: {
      project: "F1 Website",
      version: "1.0.0",
      description: "Formula 1 statistics and management system",
      features: [
        "Constructor Management",
        "Driver Statistics",
        "Contact Forms",
        "API Endpoints",
        "Real-time Data",
        "User Authentication",
        "Favorites System"
      ],
      status: "active",
      uptime: process.uptime(),
      lastUpdated: new Date().toISOString().split('T')[0],
      endpoints: {
        constructors: "/api/constructors",
        drivers: "/api/drivers",
        info: "/api/info",
        constructorStats: "/api/constructors/stats",
        authStatus: "/api/auth/status",
        login: "/login",
        register: "/register",
        logout: "/logout"
      }
    }
  });
});

app.get('/js/constructors.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
    const API_URL = '/api/constructors';
    let currentConstructorId = null;
    let allConstructors = [];

    const elements = {
        team: document.getElementById('team'),
        pos: document.getElementById('pos'),
        color: document.getElementById('color'),
        colorPreview: document.getElementById('colorPreview'),
        drivers: document.getElementById('drivers'),
        points: document.getElementById('points'),
        wins: document.getElementById('wins'),
        podiums: document.getElementById('podiums'),
        constructorId: document.getElementById('constructorId'),
        formMode: document.getElementById('formMode'),
        constructorsList: document.getElementById('constructorsList'),
        searchInput: document.getElementById('searchInput'),
        showingCount: document.getElementById('showingCount'),
        totalCount: document.getElementById('totalCount'),
        totalConstructors: document.getElementById('totalConstructors'),
        totalPoints: document.getElementById('totalPoints'),
        totalWins: document.getElementById('totalWins'),
        toast: document.getElementById('toast'),
        toastMessage: document.getElementById('toastMessage'),
        confirmModal: document.getElementById('confirmModal'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn')
    };

    document.addEventListener('DOMContentLoaded', () => {
        loadConstructors();
        setupEventListeners();
        if (elements.color) {
            elements.color.addEventListener('input', updateColorPreview);
            updateColorPreview();
        }
        

        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
          if (button.textContent.includes('Save Constructor')) {
            button.addEventListener('click', saveConstructor);
          } else if (button.textContent.includes('Refresh')) {
            button.addEventListener('click', refreshConstructors);
          } else if (button.textContent.includes('Export')) {
            button.addEventListener('click', exportConstructors);
          } else if (button.textContent.includes('Reset Form')) {
            button.addEventListener('click', resetForm);
          }
        });
        

        if (elements.searchInput) {
          elements.searchInput.addEventListener('input', filterConstructors);
        }
    });

    function setupEventListeners() {
        if (elements.confirmDeleteBtn) {
            elements.confirmDeleteBtn.addEventListener('click', confirmDelete);
        }
    }

    async function loadConstructors() {
        try {
            showLoading();
            const response = await fetch(API_URL);
            const result = await response.json();
            
            if (result.success) {
                allConstructors = result.data;
                displayConstructors(allConstructors);
                updateStats();
            } else {
                throw new Error(result.error || 'Failed to load constructors');
            }
        } catch (error) {
            showError('Failed to load constructors: ' + error.message);
            showEmptyState();
        }
    }

    function displayConstructors(constructors) {
        if (!constructors || constructors.length === 0) {
            showEmptyState();
            return;
        }

        const sortedConstructors = [...constructors].sort((a, b) => a.position - b.position);
        
        if (elements.constructorsList) {
            elements.constructorsList.innerHTML = sortedConstructors.map(constructor => \`
                <tr data-id="\${constructor._id}">
                    <td><div class="position-badge">\${constructor.position}</div></td>
                    <td>
                        <div class="team-cell">
                            <div class="team-color" style="background-color: \${constructor.color || '#FF0000'}"></div>
                            <strong>\${constructor.team}</strong>
                        </div>
                    </td>
                    <td><div class="driver-badge">\${constructor.drivers}</div></td>
                    <td><div class="points-badge">\${constructor.points || 0}</div></td>
                    <td><div class="wins-badge">\${constructor.wins || 0}</div></td>
                    <td><div class="podiums-badge">\${constructor.podiums || 0}</div></td>
                    <td class="actions-cell">
                        <button class="action-btn edit-btn" data-id="\${constructor._id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="action-btn delete-btn" data-id="\${constructor._id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            \`).join('');
            

            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    editConstructor(this.getAttribute('data-id'));
                });
            });
            
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    showDeleteConfirm(this.getAttribute('data-id'));
                });
            });
        }
        updateCounts(constructors.length);
    }

    async function saveConstructor() {
        if (!validateForm()) return;

        const constructorData = {
            position: parseInt(elements.pos.value),
            team: elements.team.value.trim(),
            color: elements.color.value,
            drivers: elements.drivers.value.trim(),
            points: parseInt(elements.points.value) || 0,
            wins: parseInt(elements.wins.value) || 0,
            podiums: parseInt(elements.podiums.value) || 0,
            season: 2024
        };

        const method = currentConstructorId ? 'PUT' : 'POST';
        const url = currentConstructorId ? \`\${API_URL}/\${currentConstructorId}\` : API_URL;

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(constructorData)
            });
            const result = await response.json();

            if (response.ok && result.success) {
                showToast(currentConstructorId ? 'Constructor updated!' : 'Constructor created!');
                resetForm();
                await loadConstructors();
            } else {
                throw new Error(result.error || 'Failed to save constructor');
            }
        } catch (error) {
            showError('Failed to save constructor: ' + error.message);
        }
    }

    async function editConstructor(id) {
        try {
            const response = await fetch(\`\${API_URL}/\${id}\`);
            const result = await response.json();

            if (response.ok && result.success) {
                const constructor = result.data;
                currentConstructorId = constructor._id;
                elements.constructorId.value = constructor._id;
                elements.team.value = constructor.team || '';
                elements.pos.value = constructor.position || '';
                elements.color.value = constructor.color || '#FF0000';
                elements.drivers.value = constructor.drivers || '';
                elements.points.value = constructor.points || 0;
                elements.wins.value = constructor.wins || 0;
                elements.podiums.value = constructor.podiums || 0;
                elements.formMode.textContent = 'EDIT';
                elements.formMode.style.background = '#f59e0b';
                updateColorPreview();
                scrollToForm();
                showToast('Constructor loaded for editing');
            } else {
                throw new Error(result.error || 'Failed to load constructor');
            }
        } catch (error) {
            showError('Failed to load constructor: ' + error.message);
        }
    }

    function showDeleteConfirm(id) {
        currentConstructorId = id;
        if (elements.confirmModal) {
            elements.confirmModal.style.display = 'flex';
        }
    }

    async function confirmDelete() {
        if (!currentConstructorId) return;
        try {
            const response = await fetch(\`\${API_URL}/\${currentConstructorId}\`, {
                method: 'DELETE'
            });
            const result = await response.json();

            if (response.ok && result.success) {
                showToast('Constructor deleted!');
                closeModal();
                await loadConstructors();
            } else {
                throw new Error(result.error || 'Failed to delete constructor');
            }
        } catch (error) {
            showError('Failed to delete constructor: ' + error.message);
        } finally {
            currentConstructorId = null;
        }
    }

    function closeModal() {
        if (elements.confirmModal) {
            elements.confirmModal.style.display = 'none';
        }
        currentConstructorId = null;
    }

    function resetForm() {
        if (!elements.team) return;
        elements.team.value = '';
        elements.pos.value = '';
        elements.color.value = '#FF0000';
        elements.drivers.value = '';
        elements.points.value = '';
        elements.wins.value = '';
        elements.podiums.value = '';
        elements.constructorId.value = '';
        currentConstructorId = null;
        elements.formMode.textContent = 'CREATE';
        elements.formMode.style.background = '#dc0000';
        updateColorPreview();
    }

    function updateColorPreview() {
        if (elements.colorPreview && elements.color) {
            elements.colorPreview.style.background = elements.color.value;
        }
    }

    function filterConstructors() {
        if (!elements.searchInput) return;
        const searchTerm = elements.searchInput.value.toLowerCase();
        
        if (!searchTerm.trim()) {
            displayConstructors(allConstructors);
            return;
        }

        const filtered = allConstructors.filter(constructor => 
            constructor.team.toLowerCase().includes(searchTerm) ||
            constructor.drivers.toLowerCase().includes(searchTerm) ||
            constructor.position.toString().includes(searchTerm)
        );
        displayConstructors(filtered);
    }

    function updateStats() {
        if (!allConstructors.length) return;
        const totalConstructors = allConstructors.length;
        const totalPoints = allConstructors.reduce((sum, c) => sum + (c.points || 0), 0);
        const totalWins = allConstructors.reduce((sum, c) => sum + (c.wins || 0), 0);

        if (elements.totalConstructors) elements.totalConstructors.textContent = totalConstructors;
        if (elements.totalPoints) elements.totalPoints.textContent = totalPoints;
        if (elements.totalWins) elements.totalWins.textContent = totalWins;
    }

    function updateCounts(count) {
        if (elements.showingCount) elements.showingCount.textContent = count;
        if (elements.totalCount) elements.totalCount.textContent = allConstructors.length;
    }

    function refreshConstructors() {
        loadConstructors();
        showToast('Constructors list refreshed');
    }

    function exportConstructors() {
        const dataStr = JSON.stringify(allConstructors, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = \`constructors-\${new Date().toISOString().split('T')[0]}.json\`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        showToast('Constructors exported!');
    }

    function showLoading() {
        if (elements.constructorsList) {
            elements.constructorsList.innerHTML = \`
                <tr class="loading-row">
                    <td colspan="7">
                        <div class="loading-spinner">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>Loading constructors...</span>
                        </div>
                    </td>
                </tr>
            \`;
        }
    }

    function showEmptyState() {
        if (elements.constructorsList) {
            elements.constructorsList.innerHTML = \`
                <tr>
                    <td colspan="7">
                        <div class="empty-state">
                            <i class="fas fa-trophy"></i>
                            <h3>No Constructors Found</h3>
                            <p>Add your first constructor using the form above!</p>
                        </div>
                    </td>
                </tr>
            \`;
        }
        updateCounts(0);
    }

    function showToast(message) {
        if (!elements.toast || !elements.toastMessage) return;
        elements.toastMessage.textContent = message;
        elements.toast.style.display = 'flex';
        setTimeout(() => {
            elements.toast.style.display = 'none';
        }, 3000);
    }

    function showError(message) {
        alert(\`Error: \${message}\`);
    }

    function validateForm() {
        if (!elements.team || !elements.team.value.trim()) {
            showError('Team name is required');
            if (elements.team) elements.team.focus();
            return false;
        }
        if (!elements.pos || !elements.pos.value || elements.pos.value < 1) {
            showError('Position must be at least 1');
            if (elements.pos) elements.pos.focus();
            return false;
        }
        if (!elements.drivers || !elements.drivers.value.trim()) {
            showError('Drivers are required');
            if (elements.drivers) elements.drivers.focus();
            return false;
        }
        return true;
    }

    function scrollToForm() {
        const formCard = document.querySelector('.form-card');
        if (formCard) {
            formCard.scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    window.onclick = function(event) {
        if (elements.confirmModal && event.target === elements.confirmModal) {
            closeModal();
        }
    };

    window.saveConstructor = saveConstructor;
    window.editConstructor = editConstructor;
    window.showDeleteConfirm = showDeleteConfirm;
    window.filterConstructors = filterConstructors;
    window.refreshConstructors = refreshConstructors;
    window.exportConstructors = exportConstructors;
    window.resetForm = resetForm;
    window.closeModal = closeModal;
  `);
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
      message: `The requested API endpoint ${req.originalUrl} does not exist`
    });
  } else {
    res.status(404).render('404', {
      title: 'Page Not Found',
      message: 'The page you are looking for does not exist.',
      currentUrl: req.originalUrl,
      user: req.user || null
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Access the app at: http://localhost:${PORT}`);
  console.log(`🔧 Constructor Manager: http://localhost:${PORT}/constructor-manager`);
  console.log(`🔧 Drivers CRUD: http://localhost:${PORT}/sqll`);
  console.log(`🔐 Login: http://localhost:${PORT}/login`);
  console.log(`📝 Register: http://localhost:${PORT}/register`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
  console.log('✅ App is ready to accept requests');
});
