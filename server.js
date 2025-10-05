require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const nodemailer = require('nodemailer');
const router = express.Router();

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------
// Ensure uploads dir exists
// ---------------------
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// ---------------------
// Middleware
// ---------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// ---------------------
// MongoDB connection
// ---------------------
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));


// ---------------------
// Schemas
// ---------------------
const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: String,
  price: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  image: String
}, { timestamps: true });

const Product = mongoose.model('Product', ProductSchema);

// Placeholder Order & User
const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

// ---------------------
// Multer config
// ---------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ---------------------
// FRONTEND ROUTES
// ---------------------
const pages = ['index', 'about', 'contactus', 'login', 'shop', 'product_details', 'register'];
pages.forEach(page => {
  app.get(`/${page === 'index' ? '' : page}`, (req, res) => {
    res.sendFile(path.join(__dirname, `views/pages/${page}.html`));
  });
});

// Admin pages
const adminPages = ['dashboard', 'products', 'orders', 'users'];
adminPages.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(__dirname, `views/pages/Admin/${page}.html`));
  });
});
app.get('/admin', (req, res) => res.redirect('/dashboard'));

// ---------------------
// DASHBOARD COUNTS
// ---------------------
app.get('/api/dashboard-counts', async (req, res) => {
  try {
    const [totalProducts, totalOrders, totalUsers] = await Promise.all([
      Product.countDocuments(),
      Order.countDocuments(),
      User.countDocuments()
    ]);
    res.json({ totalProducts, totalOrders, totalUsers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------
// CRUD API for Products
// ---------------------

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching products' });
  }
});

// Get single product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching product' });
  }
});

// Create new product
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    const { name, category, price, stock } = req.body;

    // Validate required fields
    if (!name || !price || !stock) {
      return res.status(400).json({ message: 'Name, price, and stock are required' });
    }

    // Store image path
    const image = req.file ? `/uploads/${req.file.filename}` : '';

    // Create product
    const product = new Product({
      name,
      category,
      price: Number(price),
      stock: Number(stock),
      image
    });

    // Save to MongoDB
    await product.save();

    res.json(product);

  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Delete image from server
    if (product.image) {
      const imgPath = path.join(__dirname, product.image);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await Product.deleteOne({ _id: req.params.id });
    res.json({ message: 'Product deleted successfully' });

  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// ---------------------
// Sessions + Passport
// ---------------------
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

// Google User Schema
const GUserSchema = new mongoose.Schema({
  googleId: String,
  name: String,
  email: String,
  picture: String
});
const GUser = mongoose.model("UserAuth", GUserSchema);

// Logout
app.get("/logout", (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect("/");
  });
});

//login user
app.get('/api/current_user', (req, res) => {
  if (req.session.userId) {
    return res.json({ name: req.session.fullname}); // or store user name in session
  }
  res.json(null);
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).send("Email and password are required");
    }

    // Find user
    const user = await UserReg.findOne({ email });
    if (!user) {
      return res.status(401).send("Invalid credentials");
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).send("Invalid credentials");
    }

    // Login successful — save session
    req.session.userId = user._id;
    req.session.fullname = user.fullname;

    res.redirect('/'); // Redirect to home or dashboard

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});



// ---------------------
// Custom Product Requests
// ---------------------
const CustomRequestSchema = new mongoose.Schema({
  name: String,
  email: String,
  product: String,
  category: String,
  details: String,
  image: String
}, { timestamps: true });

const CustomRequest = mongoose.model("CustomRequest", CustomRequestSchema);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.post("/submit-request", async (req, res) => {
  try {
    const { name, email, product, category, details, image } = req.body;

    if (!name || !email || !product) {
      return res.status(400).json({ message: "Name, email, and product are required" });
    }

    const request = new CustomRequest({ name, email, product, category, details, image });
    await request.save();

    await transporter.sendMail({
      from: `"ArtistGrade" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Custom Product Request Received",
      html: `<h3>Hi ${name},</h3>
             <p>We received your request for "<strong>${product}</strong>". Our team will contact you soon.</p>`
    });

    res.json({ message: "Request submitted and confirmation email sent!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------------
// User Registration Schema
// ---------------------  
const UserSchema = new mongoose.Schema({
  fullname: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  phone:    { type: String },
  password: { type: String, required: true },
  gender:   { type: String }
}, { timestamps: true });

const UserReg = mongoose.model("UserReg", UserSchema);
const bcrypt = require('bcryptjs');

app.post("/api/register", async (req, res) => {
  try {
    const { fullname, username, email, phone, password, confirmPassword, gender } = req.body;

    // Basic validation
    if (!fullname || !username || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "All required fields must be filled" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Check if user already exists
    const existingUser = await UserReg.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: "Email or username already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user
    const user = new UserReg({
      fullname,
      username,
      email,
      phone,
      password: hashedPassword,
      gender
    });
    await user.save();

    res.json({ message: "User registered successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all users
app.get("/api/users", async (req, res) => {
  try {
    const users = await UserReg.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching users" });
  }
});

// Delete a user
app.delete("/api/users/:id", async (req, res) => {
  try {
    await UserReg.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting user" });
  }
});
// routes/adminRoutes.js


// Get all users
router.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user
router.delete('/api/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
// Update user info
router.put('/api/users/:id', async (req, res) => {
  try {
    const { fullname, email, username, role, isActive } = req.body;
    const user = await User.findById(req.params.id);
    if(!user) return res.status(404).json({ message: 'User not found' });

    user.fullname = fullname;
    user.email = email;
    user.username = username;
    user.role = role;
    user.isActive = isActive;

    await user.save();
    res.json({ message: 'User updated successfully' });
  } catch(err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});



// ---------------------
// Start Server
// ---------------------
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
