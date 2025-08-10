const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = 3000;
const MONGO_URI = 'mongodb://kavimark:kavimark@127.0.0.1:27017/everesports?authSource=';
const DB_NAME = 'everesports';
let db;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Constants
const UPLOAD_DIR = 'uploads';
const PROFILE_DIR = path.join(UPLOAD_DIR, 'profiles');
const COVER_DIR = path.join(UPLOAD_DIR, 'coverphotos');
const POSTS_DIR = path.join(UPLOAD_DIR, 'posts');
const STORIES_DIR = path.join(UPLOAD_DIR, 'stories');

// === Static Upload Folders ===
const uploadDir = path.join(__dirname, 'uploads');
const weaponUploadDir = path.join(uploadDir, 'weapon');
const mapsUploadDir = path.join(uploadDir, 'maps');
const tournamentUploadDir = path.join(uploadDir, 'tournament');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(weaponUploadDir)) fs.mkdirSync(weaponUploadDir, { recursive: true });
if (!fs.existsSync(mapsUploadDir)) fs.mkdirSync(mapsUploadDir, { recursive: true });
if (!fs.existsSync(tournamentUploadDir)) fs.mkdirSync(tournamentUploadDir, { recursive: true });

// Create necessary directories if not exists
[UPLOAD_DIR, PROFILE_DIR, COVER_DIR, POSTS_DIR, STORIES_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Make sure this folder exists
  },
  filename: function (req, file, cb) {
    // Use original name or generate a unique one
    cb(null, Date.now() + '-' + file.originalname);
  }
});

// Ensure upload/banner directory exists
const bannerDir = path.join(__dirname, 'uploads', 'banner');
if (!fs.existsSync(bannerDir)) {
  fs.mkdirSync(bannerDir, { recursive: true });
}

const upload = multer({ storage: storage });
app.use('/uploads', express.static(uploadDir));




// === Multer Configs ===
const generalStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
  });
  const weaponStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, weaponUploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
  });
  const mapsStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, mapsUploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
  });
  const tournamentStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, tournamentUploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
  });

  
const generalUpload = multer({ storage: generalStorage });
const weaponUpload = multer({ storage: weaponStorage });
const mapsUpload = multer({ storage: mapsStorage });
const tournamentUpload = multer({ storage: tournamentStorage });











// API Endpoints

// Get user's cristol balance
app.get('/api/users-cristols/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const usersCristolsCollection = db.collection('users_cristols');
    
    // Find user's cristol document
    const userCristol = await usersCristolsCollection.findOne({ userId: userId });
    
    if (!userCristol) {
      // Create new cristol account if user doesn't have one
      const newCristolAccount = {
        userId: userId,
        amountCristol: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await usersCristolsCollection.insertOne(newCristolAccount);
      
      return res.json({
        userId: userId,
        amountCristol: 0,
        message: 'New cristol account created'
      });
    }
    
    res.json({
      userId: userCristol.userId,
      amountCristol: userCristol.amountCristol || 0
    });
    
  } catch (error) {
    console.error('Error fetching user cristols:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Activate premium package
app.post('/api/activate-package', async (req, res) => {
  try {
    const { userId, packageName, packageId, duration = 30, price } = req.body;
    
    if (!userId || !packageName || !packageId) {
      return res.status(400).json({ 
        error: 'userId, packageName, and packageId are required' 
      });
    }

    // Convert price from USD to cristols (assuming 1 USD = 100 cristols)
    const priceInUSD = parseFloat(price.replace(/[^0-9.]/g, ''));
    const cristolCost = Math.round(priceInUSD * 100);
    
    // Check if user has sufficient cristols
    const usersCristolsCollection = db.collection('users_cristols');
    const userCristol = await usersCristolsCollection.findOne({ userId: userId });
    
    if (!userCristol || userCristol.amountCristol < cristolCost) {
      return res.status(400).json({ 
        error: 'Insufficient cristols',
        required: cristolCost,
        available: userCristol ? userCristol.amountCristol : 0
      });
    }
    
    // Calculate activation and expiry dates
    const activationDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + duration);
    
    // Check if user already has an active package
    const activePackageCollection = db.collection('active_package');
    const existingActivePackage = await activePackageCollection.findOne({
      userId: userId,
      status: 'active',
      expiryDate: { $gt: new Date() }
    });
    
    if (existingActivePackage) {
      return res.status(400).json({ 
        error: 'User already has an active package',
        currentPackage: existingActivePackage.packageName,
        expiresAt: existingActivePackage.expiryDate
      });
    }
    
    // Create new active package record
    const newActivePackage = {
      userId: userId,
      packageId: packageId,
      packageName: packageName,
      activationDate: activationDate,
      expiryDate: expiryDate,
      duration: duration,
      price: price,
      cristolCost: cristolCost,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await activePackageCollection.insertOne(newActivePackage);
    
    // Deduct cristols from user's account
    await usersCristolsCollection.updateOne(
      { userId: userId },
      { 
        $inc: { amountCristol: -cristolCost },
        $set: { updatedAt: new Date() }
      }
    );
    
    res.json({
      success: true,
      message: 'Package activated successfully',
      package: {
        name: packageName,
        activationDate: activationDate,
        expiryDate: expiryDate,
        duration: duration,
        cristolCost: cristolCost
      },
      remainingCristol: userCristol.amountCristol - cristolCost
    });
    
  } catch (error) {
    console.error('Error activating package:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's active package
app.get('/api/active-package/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const activePackageCollection = db.collection('active_package');
    
    // Find user's active package
    const activePackage = await activePackageCollection.findOne({
      userId: userId,
      status: 'active',
      expiryDate: { $gt: new Date() }
    });
    
    if (!activePackage) {
      return res.json({
        hasActivePackage: false,
        message: 'No active package found'
      });
    }
    
    res.json({
      hasActivePackage: true,
      package: {
        packageId: activePackage.packageId,
        packageName: activePackage.packageName,
        activationDate: activePackage.activationDate,
        expiryDate: activePackage.expiryDate,
        duration: activePackage.duration,
        price: activePackage.price,
        cristolCost: activePackage.cristolCost,
        status: activePackage.status
      }
    });
    
  } catch (error) {
    console.error('Error fetching active package:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all premium packages
app.get('/api/premium-packages', async (req, res) => {
  try {
    const premiumPackagesCollection = db.collection('premium_packages');
    
    const packages = await premiumPackagesCollection
      .find({})
      .sort({ price: 1 })
      .toArray();
    
    res.json(packages);
    
  } catch (error) {
    console.error('Error fetching premium packages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get subscriber count
app.get('/api/subscriber-count', async (req, res) => {
  try {
    const activePackageCollection = db.collection('active_package');
    
    // Count active subscriptions (not expired)
    const count = await activePackageCollection.countDocuments({
      status: 'active',
      expiryDate: { $gt: new Date() }
    });
    
    res.json({ count: count });
    
  } catch (error) {
    console.error('Error fetching subscriber count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});











// Multer storage for banner uploads
const bannerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, bannerDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const bannerUpload = multer({ storage: bannerStorage });

// Banner upload endpoint
app.post('/uploads/banner', bannerUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  // Return the relative path for Flutter to use
  res.json({ imagePath: `uploads/banner/${req.file.filename}` });
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Upload to /uploads/
app.post('/uploads', generalUpload.single('file'), async (req, res) => {
    const { gameName } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  
    const imagePath = `/uploads/${req.file.filename}`;
  
    try {
      if (gameName) {
        const result = await db.collection('games').insertOne({ gameName, imagePath });
        res.json({ id: result.insertedId, gameName, imagePath });
      } else {
        res.json({ imagePath });
      }
    } catch (err) {
      res.status(500).json({ message: 'Database error' });
    }
  });
  
  // Upload to /uploads/weapon/
  app.post('/upload/weapon', weaponUpload.single('file'), async (req, res) => {
    const { gameName } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  
    const imagePath = `/uploads/weapon/${req.file.filename}`;
  
    try {
      if (gameName) {
        const result = await db.collection('games').insertOne({ gameName, imagePath });
        res.json({ id: result.insertedId, gameName, imagePath });
      } else {
        res.json({ imagePath });
      }
    } catch (err) {
      res.status(500).json({ message: 'Database error' });
    }
  });
  
  // Upload to /uploads/maps/
  app.post('/upload/maps', mapsUpload.single('file'), async (req, res) => {
    const { gameName } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  
    const imagePath = `/uploads/maps/${req.file.filename}`;
  
    try {
      if (gameName) {
        const result = await db.collection('games').insertOne({ gameName, imagePath });
        res.json({ id: result.insertedId, gameName, imagePath });
      } else {
        res.json({ imagePath });
      }
    } catch (err) {
      res.status(500).json({ message: 'Database error' });
    }
  });
  
  // Delete file
  app.delete('/delete', (req, res) => {
    const relativePath = req.query.path;
    if (!relativePath) return res.status(400).json({ message: 'No path specified' });
  
    const fullPath = path.join(__dirname, relativePath);
  
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        return res.json({ message: 'File deleted' });
      } else {
        return res.status(404).json({ message: 'File not found' });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Error deleting file' });
    }
  });
  
  // Update game record and delete old image if imagePath changed
  app.put('/update/:id', async (req, res) => {
    const { id } = req.params;
    const { gameName, imagePath } = req.body;
  
    try {
      const game = await db.collection('games').findOne({ _id: new mongoose.Types.ObjectId(id) });
      if (!game) return res.status(404).json({ message: 'Record not found' });
      const oldImagePath = game.imagePath;

      await db.collection('games').updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        { $set: { gameName, imagePath } }
      );

      // Delete old image file if path changed and file exists
      if (oldImagePath && oldImagePath !== imagePath) {
        const fullPath = path.join(__dirname, oldImagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlink(fullPath, (err) => {
            if (err) console.error('Failed to delete old image:', err);
          });
        }
      }

      res.json({ message: 'Game updated successfully' });
    } catch (err) {
      res.status(500).json({ message: 'Database update error' });
    }
  });
  
  // Upload to /uploads/tournament/
  app.post('/upload/tournament', tournamentUpload.single('file'), async (req, res) => {
    const { gameName } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  
    const imagePath = `/uploads/tournament/${req.file.filename}`;
  
    try {
      if (gameName) {
        const result = await db.collection('games').insertOne({ gameName, imagePath });
        res.json({ id: result.insertedId, gameName, imagePath });
      } else {
        res.json({ imagePath });
      }
    } catch (err) {
      res.status(500).json({ message: 'Database error' });
    }
  });

// Update a tournament preset by ID
app.put('/tournament-preset/:id', async (req, res) => {
  const { id } = req.params;
  const updateFields = req.body;

  try {
    const result = await db.collection('tournamentpresets').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: updateFields }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Preset not found' });
    }
    res.json({ message: 'Preset updated successfully', updated: result.modifiedCount > 0 });
  } catch (err) {
    console.error('Tournament preset update error:', err);
    res.status(500).json({ message: 'Database update error' });
  }
});

// Get local IP
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const config of iface || []) {
      if (config.family === 'IPv4' && !config.internal) return config.address;
    }
  }
  return 'localhost';
}
const LOCAL_IP = getLocalIp();

// Delete file utility
function deleteFile(filePath) {
  const fullPath = path.join(__dirname, filePath.replace(/^\//, ''));
  if (fs.existsSync(fullPath)) {
    fs.unlink(fullPath, (err) => {
      if (err) console.error(`❌ Error deleting ${filePath}:`, err);
      else console.log(`🗑️ Deleted: ${filePath}`);
    });
  }
}

// Multer config for profile image uploads
const profileUpload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, PROFILE_DIR),
    filename: (_, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, unique + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Multer config for cover image uploads
const coverUpload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, COVER_DIR),
    filename: (_, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, unique + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Multer config for post media uploads
const postUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const type = file.mimetype.startsWith('image') ? 'images' : 'videos';
      const dest = path.join(POSTS_DIR, type);
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (_, file, cb) => {
      const unique = uuidv4();
      cb(null, unique + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed!'), false);
    }
  }
});

// Multer config for story uploads
const storyUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, STORIES_DIR);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images are allowed (jpeg, jpg, png, gif)'));
  }
});

// Story Model
const storySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  description: { type: String, required: true },
  imagePath: { type: String, required: true },
  view: { type: Boolean, default: false }, // ✅ Add this line
  createdAt: { type: Date, default: Date.now }
});
const Story = mongoose.model('Story', storySchema);

/* ------------------ Upload Profile Image ------------------ */
app.post('/upload', profileUpload.single('file'), async (req, res) => {
  const { userId, oldImagePath } = req.body;

  if (!req.file || !userId) {
    return res.status(400).json({ error: 'Missing file or userId' });
  }

  if (oldImagePath) deleteFile(oldImagePath);

  const imagePath = path.join('uploads', 'profiles', req.file.filename).replace(/\\/g, '/');

  try {
    const result = await db.collection('users').updateOne(
      { userId: userId },
      { $set: { profileImageUrl: imagePath } }
    );
    res.json({ imageUrl: imagePath, updated: result.modifiedCount > 0 });
  } catch (err) {
    console.error('MongoDB update error:', err);
    res.status(500).json({ error: 'Failed to update profile image' });
  }
});

/* ------------------ Upload Cover Photo ------------------ */
app.post('/upload-cover', coverUpload.single('file'), async (req, res) => {
  const { userId, oldCoverPath } = req.body;

  if (!req.file || !userId) {
    return res.status(400).json({ error: 'Missing file or userId' });
  }

  if (oldCoverPath) deleteFile(oldCoverPath);

  const coverPath = path.join('uploads', 'coverphotos', req.file.filename).replace(/\\/g, '/');

  try {
    const result = await db.collection('users').updateOne(
      { userId: userId },
      { $set: { coverImageUrl: coverPath } }
    );
    res.json({ imageUrl: coverPath, updated: result.modifiedCount > 0 });
  } catch (err) {
    console.error('MongoDB update error:', err);
    res.status(500).json({ error: 'Failed to update cover image' });
  }
});

/* ------------------ Upload Post Media ------------------ */
app.post('/upload-post-media', postUpload.array('files', 10), async (req, res) => {
  const { userId } = req.body;

  if (!req.files || req.files.length === 0 || !userId) {
    return res.status(400).json({ error: 'Missing files or userId' });
  }

  try {
    const filePaths = req.files.map(file => {
      const type = file.mimetype.startsWith('image') ? 'images' : 'videos';
      return path.join('uploads', 'posts', type, file.filename).replace(/\\/g, '/');
    });

    res.json({ 
      success: true,
      filePaths: filePaths,
      message: 'Files uploaded successfully'
    });
  } catch (err) {
    console.error('Post media upload error:', err);
    res.status(500).json({ error: 'Failed to upload post media' });
  }
});

/* ------------------ Create Post ------------------ */
app.post('/create-post', async (req, res) => {
  const { userId, title, description, filePaths, mentions, hashtags } = req.body;

  if (!userId || !title || !description || !filePaths || filePaths.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const mentionedUsers = await db.collection('users')
      .find({ username: { $in: mentions.map(m => m.replace('@', '')) } })
      .toArray();
    const mentionedUserIds = mentionedUsers.map(u => u.userId);

    const cleanHashtags = hashtags.map(tag => tag.replace('#', '').toLowerCase());
    
    await Promise.all(cleanHashtags.map(async tag => {
      await db.collection('hashtags').updateOne(
        { name: tag },
        { $inc: { count: 1 }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
      );
    }));

    const post = {
      userId,
      title,
      description,
      files: filePaths,
      mentions: mentionedUserIds,
      hashtags: cleanHashtags,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('posts').insertOne(post);

    res.json({
      success: true,
      postId: result.insertedId,
      message: 'Post created successfully'
    });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

/* ------------------ Delete Profile Image ------------------ */
app.post('/delete-image', async (req, res) => {
  const { userId, imagePath } = req.body;
  if (!userId || !imagePath) return res.status(400).json({ error: 'Missing userId or imagePath' });

  deleteFile(imagePath);

  try {
    const result = await db.collection('users').updateOne(
      { userId: userId },
      { $set: { profileImageUrl: '' } }
    );
    res.json({ message: 'Profile image deleted', updated: result.modifiedCount > 0 });
  } catch (err) {
    console.error('MongoDB delete image error:', err);
    res.status(500).json({ error: 'Failed to clear profileImageUrl' });
  }
});

/* ------------------ Delete Cover Image ------------------ */
app.post('/delete-cover', async (req, res) => {
  const { userId, imagePath } = req.body;
  if (!userId || !imagePath) return res.status(400).json({ error: 'Missing userId or imagePath' });

  deleteFile(imagePath);

  try {
    const result = await db.collection('users').updateOne(
      { userId: userId },
      { $set: { coverImageUrl: '' } }
    );
    res.json({ message: 'Cover photo deleted', updated: result.modifiedCount > 0 });
  } catch (err) {
    console.error('MongoDB delete cover error:', err);
    res.status(500).json({ error: 'Failed to clear coverImageUrl' });
  }
});

/* ------------------ Upload Story ------------------ */
app.post('/api/stories', storyUpload.single('image'), async (req, res) => {
  try {
    const { userId, description } = req.body;
    if (!userId || !description || !req.file) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields' 
      });
    }
    const relativeImagePath = path.join('uploads', 'stories', req.file.filename).replace(/\\/g, '/');
  const story = new Story({
  userId,
  description,
  imagePath: relativeImagePath,
  view: false // ✅ Explicitly set here (optional if default is already set)
});

    await story.save();
    res.status(201).json({
      success: true,
      data: {
        id: story._id,
        userId: story.userId,
        description: story.description,
        imageUrl: `/${relativeImagePath}`,  view : false,
        createdAt: story.createdAt
      }
    });
  } catch (error) {
    console.error('Error uploading story:', error);
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
});

/* ------------------ Get Stories ------------------ */
app.get('/api/stories', async (req, res) => {
  try {
    const stories = await Story.find().sort({ createdAt: -1 }).limit(20);
    res.json({
      success: true,
      data: stories.map(story => ({
        id: story._id,
        userId: story.userId,
        description: story.description,
        imageUrl: `/${story.imagePath}`,
        view : false,
        createdAt: story.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
});

/* ------------------ Video Streaming ------------------ */
app.get('/uploads/posts/videos/:filename', (req, res) => {
  const videoPath = path.join(__dirname, 'uploads/posts/videos', req.params.filename);
  if (!fs.existsSync(videoPath)) return res.status(404).send('Video not found');

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    if (start >= fileSize || end >= fileSize) {
      res.status(416).send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
      return;
    }
    const chunkSize = (end - start) + 1;

    const file = fs.createReadStream(videoPath, { start, end });

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4"
    });

    file.pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4"
    });
    fs.createReadStream(videoPath).pipe(res);
  }
});

/* ------------------ Static File Hosting ------------------ */
app.use('/uploads', express.static(path.join(__dirname, UPLOAD_DIR)));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err instanceof multer.MulterError) {
    return res.status(413).json({
      error: 'File too large',
      details: err.message
    });
  }

  res.status(500).json({ error: 'Something went wrong' });
});

/* ------------------ Start Server and Connect to MongoDB ------------------ */
// MongoDB connection (native driver)
MongoClient.connect(process.env.MONGODB_URI || MONGO_URI+DB_NAME)
  .then((client) => {
    db = client.db(DB_NAME);
    console.log('✅ Connected to MongoDB (native driver)');
  })
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB (native driver):', err);
  });

// Mongoose connection
mongoose.connect(process.env.MONGODB_URI || MONGO_URI+DB_NAME, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ Connected to MongoDB (Mongoose)');
  // Start server only after both connections are established
  app.listen(PORT, () => {
    console.log(`✅ Server running at: http://${LOCAL_IP}:${PORT}`);
  });
})
.catch((err) => {
  console.error('❌ Failed to connect to MongoDB (Mongoose):', err);
});