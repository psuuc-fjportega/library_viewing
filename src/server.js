const multer = require("multer");
const GalleryImage = require("./models/GalleryImage");
require("dotenv").config();
// Keep the dev server alive on transient Mongo/DNS failures
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught exception:", err);
});
console.log("--- ENV DIAGNOSTIC ---");
console.log("Current Directory:", process.cwd());
console.log(
  "Is MONGODB_URI|MONGO_URI defined?:",
  !!(process.env.MONGODB_URI || process.env.MONGO_URI),
);
console.log("----------------------");
const compression = require("compression");

const fs = require("fs");
const express = require("express");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const session = require("express-session");
const MongoStore =
  require("connect-mongo").default ||
  require("connect-mongo").MongoStore ||
  require("connect-mongo");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const expressMongoSanitize = require("express-mongo-sanitize");
const xssClean = require("xss-clean");
const crypto = require("crypto");

const Inquiry = require("./models/Inquiry");
const Brc = require("./models/Brc"); // BRC Model

const cloudinary = require("cloudinary").v2;

// Cloudinary config (Render env vars)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function cldThumb(publicId) {
  if (!publicId) return "";
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      { width: 480, height: 320, crop: "fill", gravity: "auto" },
      { fetch_format: "auto", quality: "auto" },
      { dpr: "auto" },
    ],
  });
}

function cldFull(publicId) {
  if (!publicId) return "";
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      { width: 1600, crop: "limit" },
      { fetch_format: "auto", quality: "auto" },
      { dpr: "auto" },
    ],
  });
}

// Upload helper (buffer -> cloudinary)
function uploadBufferToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result); // { secure_url, public_id, ... }
      },
    );

    stream.end(buffer);
  });
}

const app = express();

// --------------------
// MIDDLEWARE
// --------------------
// Trus proxy for correct IP identification behind Render
app.set("trust proxy", 1);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sanitize user input
app.use(expressMongoSanitize());
app.use(xssClean());

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const hasMongoConfigured = !!MONGODB_URI;
let mongoReady = false;

const sessionOptions = {
  secret: process.env.SESSION_SECRET || "dev_secret_change_me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 2, // 2 hours
  },
};

// Use Mongo-backed sessions when DB is configured; otherwise fall back to MemoryStore
// so the website can still boot in local/dev without Mongo.
if (hasMongoConfigured) {
  try {
    sessionOptions.store = MongoStore.create({ mongoUrl: MONGODB_URI });
  } catch (e) {
    console.warn(
      "⚠️  Failed to initialize Mongo session store; using in-memory sessions.",
      e?.message || e,
    );
  }
} else {
  console.warn(
    "⚠️  No MONGODB_URI/MONGO_URI found. Using in-memory sessions (dev-only).",
  );
}

app.use(session(sessionOptions));

// Secure headers
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

// Rate limiters
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per `window` (here, per 15 minutes)
  message:
    "Too many login attempts from this IP, please try again after 15 minutes",
});

const askLibrarianLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // Limit each IP to 5 requests per window
  handler: (req, res) => {
    return res.status(429).render("pages/ask", {
      title: "Ask a Librarian",
      error:
        "Too many inquiries from this IP. Please try again after 10 minutes.",
    });
  },
});

// Static files
app.use(
  express.static(path.join(__dirname, "../public"), {
    // Avoid stale assets during local development (e.g., landing-bg.jpg changes)
    maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
    etag: true,
    lastModified: true,
  }),
);

const galleryUploadDir = path.join(
  __dirname,
  "../public/assets/gallery/uploads",
);

// ensure folder exists

if (!fs.existsSync(galleryUploadDir))
  fs.mkdirSync(galleryUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, galleryUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only JPG/PNG/WEBP images are allowed."), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15mb per image
});

// BRC Multer Setup
const brcUploadDir = path.join(__dirname, "../public/assets/brc/uploads");
if (!fs.existsSync(brcUploadDir))
  fs.mkdirSync(brcUploadDir, { recursive: true });

const brcStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, brcUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `brc-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

const uploadBrc = multer({
  storage: multer.memoryStorage(), // ✅ keep in RAM, then upload to Cloudinary
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
});

const uploadGallery = multer({
  storage: multer.memoryStorage(), // upload to Cloudinary
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
});

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

// Layouts
app.use(expressLayouts);
app.set("layout", "layouts/main");

// --------------------
// MONGODB CONNECT
// --------------------
if (hasMongoConfigured) {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      mongoReady = true;
      console.log("✅ MongoDB connected");
    })
    .catch((err) => {
      mongoReady = false;
      console.error("❌ MongoDB connection error:", err.message);
      console.warn(
        "⚠️  Continuing without MongoDB. Check Atlas network access / DNS, or use the non-SRV connection string.",
      );
    });
} else {
  console.warn(
    "⚠️  MongoDB is not configured. DB-backed pages (gallery/admin/BRC/ask) will be limited.",
  );
}

function isMongoReady() {
  return mongoReady && mongoose.connection.readyState === 1;
}

// --------------------
// ROUTES
// --------------------

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect("/admin/login");
}
// Home
app.get("/", (req, res) => {
  res.render("pages/home", { title: "Home" });
});

// History
app.get("/history", (req, res) => {
  res.render("pages/history", { title: "History" });
});

app.get("/collections", (req, res) => {
  res.render("pages/collections", { title: "Collections" });
});

// Fiction (types)
app.get("/fiction/literary", (req, res) => {
  res.render("pages/fiction-type", {
    title: "Literary Fiction",
    type: "literary",
    typeTitle: "Literary Fiction",
    typeDescription:
      "Emphasizes style, character, and theme over plot. Often more focused on meaning and literary craft.",
    typeBody:
      "Literary fiction is a category of novels that prioritize writing quality, deep character development, and thematic exploration. Instead of relying primarily on action-driven plot, these stories often encourage readers to reflect on ideas, emotions, and human experience.",
  });
});

app.get("/fiction/genre", (req, res) => {
  res.render("pages/fiction-type", {
    title: "Genre Fiction",
    type: "genre",
    typeTitle: "Genre Fiction",
    typeDescription:
      "Written to fit into a specific genre—so readers know what to expect.",
    typeBody:
      "Genre fiction (also known as popular fiction) is written with a clear genre identity—like mystery, romance, science fiction, fantasy, or crime thrillers. Authors often follow genre conventions while still offering fresh characters and compelling storytelling.",
  });
});

app.get("/fiction/mainstream", (req, res) => {
  res.render("pages/fiction-type", {
    title: "Mainstream Fiction",
    type: "mainstream",
    typeTitle: "Mainstream Fiction",
    typeDescription:
      "When a literary or genre novel becomes widely popular with a larger audience.",
    typeBody:
      "Mainstream fiction describes novels that break out beyond a smaller core audience. When a book gains widespread attention—often becoming a bestseller—it draws new readers and enters broader conversations in culture and media.",
  });
});

// Legacy: keep old link from collections page working
app.get("/collections/fiction", (req, res) => {
  res.render("pages/fiction", { title: "Fiction" });
});

// Programs list page (loads from JSON)
app.get("/programs", (req, res) => {
  try {
    const raw = fs.readFileSync(
      path.join(__dirname, "../data/programs.json"),
      "utf-8",
    );
    const data = JSON.parse(raw);

    res.render("pages/programs", {
      title: "Library Program",
      data,
    });
  } catch (e) {
    console.error("Failed to load programs.json:", e.message);
    res.render("pages/programs", {
      title: "Library Program",
      data: { list: [] },
    });
  }
});

// Program details page (dynamic)
app.get("/programs/:slug", (req, res) => {
  try {
    const raw = fs.readFileSync(
      path.join(__dirname, "../data/programs.json"),
      "utf-8",
    );

    const data = JSON.parse(raw);
    const list = Array.isArray(data.list) ? data.list : [];
    const program = list.find((p) => p.slug === req.params.slug);

    if (!program) {
      return res.status(404).render("pages/404", { title: "Not Found" });
    }

    res.render("pages/program-details", {
      title: program.name,
      program,
    });
  } catch (e) {
    console.error("Failed to load programs.json:", e.message);
    res.status(500).send("Server error");
  }
});

// Gallery (paginated – 20 per page)
app.get("/gallery", async (req, res) => {
  if (!isMongoReady()) {
    return res.render("pages/gallery", {
      title: "Gallery",
      images: [],
      currentPage: 1,
      totalPages: 1,
    });
  }

  const LIMIT = 20;
  const page = Math.max(1, parseInt(req.query.page) || 1);

  const total = await GalleryImage.countDocuments();
  const totalPages = Math.ceil(total / LIMIT);

  const rawImages = await GalleryImage.find()
    .sort({ createdAt: -1 })
    .skip((page - 1) * LIMIT)
    .limit(LIMIT)
    .lean();

  const images = rawImages.map((img) => {
    // If Cloudinary exists, use optimized thumb + full
    if (img.publicId) {
      return {
        ...img,
        _thumbUrl: cldThumb(img.publicId),
        _fullUrl: cldFull(img.publicId),
      };
    }

    // Legacy fallback
    const local = "/assets/gallery/uploads/" + img.filename;
    return { ...img, _thumbUrl: local, _fullUrl: local };
  });

  res.render("pages/gallery", {
    title: "Gallery",
    images,
    currentPage: page,
    totalPages,
  });
});

// Policies
app.get("/policies", (req, res) => {
  res.render("pages/policies", { title: "Policies" });
});

// Ask a Librarian (GET)
app.get("/ask-a-librarian", (req, res) => {
  // Generate token and issuedAt for timing/CSRF check
  const token = crypto.randomBytes(16).toString("hex");
  req.session.askFormToken = token;
  req.session.askFormIssuedAt = Date.now();

  res.render("pages/ask", {
    title: "Ask a Librarian",
    askFormToken: token,
  });
});

// Ask a Librarian (POST) - SAVE TO DB + OPTIONAL EMAIL
app.post("/ask-a-librarian", askLibrarianLimiter, async (req, res) => {
  let { name, email, category, message, botCheck, askFormToken } = req.body;

  // 1. Honeypot check
  if (botCheck) {
    console.warn(`[Anti-Spam] Honeypot filled by IP: ${req.ip}`);
    return res.render("pages/ask", { title: "Ask a Librarian", success: true });
  }

  // 2. Token & Timing validation
  const sessionToken = req.session.askFormToken;
  const sessionIssuedAt = req.session.askFormIssuedAt;

  // Clear session tokens to prevent replay
  req.session.askFormToken = null;
  req.session.askFormIssuedAt = null;

  if (!sessionToken || !askFormToken || sessionToken !== askFormToken) {
    console.warn(`[Anti-Spam] Invalid or missing token from IP: ${req.ip}`);
    return res.render("pages/ask", { title: "Ask a Librarian", success: true });
  }

  if (!sessionIssuedAt || Date.now() - sessionIssuedAt < 3000) {
    console.warn(`[Anti-Spam] Form submitted too quickly by IP: ${req.ip}`);
    return res.render("pages/ask", { title: "Ask a Librarian", success: true });
  }

  // 3. Validation & Sanitization
  if (!name || !email || !category || !message) {
    return res.render("pages/ask", {
      title: "Ask a Librarian",
      error: "Please complete all fields.",
    });
  }

  name = name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) {
    return res.render("pages/ask", {
      title: "Ask a Librarian",
      error: "Name must be between 2 and 80 characters.",
    });
  }

  email = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email) || email.length > 120) {
    return res.render("pages/ask", {
      title: "Ask a Librarian",
      error: "Please provide a valid email address.",
    });
  }

  const allowedCategories = [
    "Book Inquiry",
    "Research Assistance",
    "Library Membership",
    "Programs & Events",
    "Tech4Ed / Computer Use",
    "Other",
  ];
  if (!allowedCategories.includes(category)) {
    return res.render("pages/ask", {
      title: "Ask a Librarian",
      error: "Please select a valid category.",
    });
  }

  message = message
    .trim()
    .replace(/\s+/g, " ")
    .replace(/<[^>]+>/g, ""); // strip HTML
  if (message.length < 10 || message.length > 2000) {
    return res.render("pages/ask", {
      title: "Ask a Librarian",
      error: "Message must be between 10 and 2000 characters.",
    });
  }

  try {
    if (!isMongoReady()) {
      return res.render("pages/ask", {
        title: "Ask a Librarian",
        error:
          "This form is temporarily unavailable because the database is not configured.",
      });
    }

    // ✅ Save to MongoDB
    const saved = await Inquiry.create({ name, email, category, message });

    // ✅ Optional email send (only if MAIL_TO exists)
    if (process.env.MAIL_TO && process.env.MAIL_HOST && process.env.MAIL_USER) {
      const transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT || 587),
        secure: process.env.MAIL_SECURE === "true",
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      });

      const subject = `[Ask a Librarian] ${category} — ${name}`;
      const textBody = `New inquiry received:

Name: ${name}
Email: ${email}
Category: ${category}

Message:
${message}

Saved ID: ${saved._id}
`;

      await transporter.sendMail({
        from: `"Urdaneta City Library Website" <${process.env.MAIL_USER}>`,
        to: process.env.MAIL_TO,
        replyTo: email,
        subject,
        text: textBody,
      });
    }

    return res.render("pages/ask", {
      title: "Ask a Librarian",
      success: true,
    });
  } catch (err) {
    console.error("Inquiry submit error:", err);
    return res.render("pages/ask", {
      title: "Ask a Librarian",
      error: "Failed to submit inquiry. Please try again.",
    });
  }
});

// Contact
app.get("/contact", (req, res) => {
  res.render("pages/contact", { title: "Contact" });
});

// --------------------
// ADMIN ROUTES
// --------------------

// Include Multer for Admin Gallery handling

// const galleryStorage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     const dir = path.join(__dirname, "../public/assets/gallery");
//     if (!fs.existsSync(dir)) {
//       fs.mkdirSync(dir, { recursive: true });
//     }
//     cb(null, dir);
//   },
//   filename: function (req, file, cb) {
//     cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, '-'));
//   }
// });
// const uploadGallery = multer({ storage: galleryStorage });

// Admin: list (paginated – 15 per page)
app.get("/admin/inquiries", requireAdmin, async (req, res) => {
  if (!isMongoReady()) return res.status(503).send("Database not configured.");

  const LIMIT = 15;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const total = await Inquiry.countDocuments();
  const totalPages = Math.ceil(total / LIMIT);
  const inquiries = await Inquiry.find()
    .sort({ createdAt: -1 })
    .skip((page - 1) * LIMIT)
    .limit(LIMIT);
  res.render("pages/admin-inquiries", {
    title: "Admin — Inquiries",
    inquiries,
    currentPage: page,
    totalPages,
    layout: "layouts/admin",
  });
});

// Admin: view single
app.get("/admin/inquiries/:id", requireAdmin, async (req, res) => {
  if (!isMongoReady()) return res.status(503).send("Database not configured.");

  const inquiry = await Inquiry.findById(req.params.id);
  if (!inquiry)
    return res.status(404).render("pages/404", { title: "Not Found" });

  res.render("pages/admin-inquiry-view", {
    title: `Inquiry — ${inquiry.name}`,
    inquiry,
    layout: "layouts/admin",
  });
});

// Admin: resolve
app.post("/admin/inquiries/:id/resolve", requireAdmin, async (req, res) => {
  try {
    if (!isMongoReady())
      return res.status(503).send("Database not configured.");

    const updated = await Inquiry.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "resolved" } },
      { new: true },
    );

    if (!updated) {
      return res.status(404).render("pages/404", { title: "Not Found" });
    }

    return res.redirect(`/admin/inquiries/${req.params.id}`);
  } catch (e) {
    console.error("Admin resolve error:", e);
    return res.status(500).send("Server error");
  }
});

// Admin: delete
app.post("/admin/inquiries/:id/delete", requireAdmin, async (req, res) => {
  try {
    if (!isMongoReady())
      return res.status(503).send("Database not configured.");

    await Inquiry.findByIdAndDelete(req.params.id);
    res.redirect("/admin/inquiries");
  } catch (e) {
    console.error("Admin delete error:", e);
    res.status(500).send("Server error");
  }
});

// Admin login page
app.get("/admin/login", (req, res) => {
  res.render("pages/admin-login", {
    title: "Admin Login",
    layout: "layouts/admin",
  });
});

//admin fix status
app.get("/admin/fix-status", requireAdmin, async (req, res) => {
  if (!isMongoReady()) return res.status(503).send("Database not configured.");

  await Inquiry.updateMany(
    { status: { $exists: false } },
    { $set: { status: "new" } },
  );
  res.send("✅ Fixed missing status field");
});

// Admin login submit
app.post("/admin/login", adminLoginLimiter, (req, res) => {
  const { username, password } = req.body;

  const validUsername = process.env.ADMIN_USERNAME || "admin";
  const validPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (username === validUsername) {
    let isValid = false;

    // Backward compatibility: If no hash is set in .env, fallback to plain text ADMIN_PASSWORD check
    // BUT we strongly encourage setting ADMIN_PASSWORD_HASH in Render.
    if (validPasswordHash) {
      isValid = bcrypt.compareSync(password, validPasswordHash);
    } else if (process.env.ADMIN_PASSWORD) {
      isValid = password === process.env.ADMIN_PASSWORD;
    }

    if (isValid) {
      req.session.isAdmin = true;
      return res.redirect("/admin/inquiries");
    }
  }

  return res.render("pages/admin-login", {
    title: "Admin Login",
    error: "Incorrect username or password.",
  });
});

// Admin logout
app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin/login");
  });
});
// Admin Gallery (view + upload, paginated – 15 per page)
app.get("/admin/gallery", requireAdmin, async (req, res) => {
  if (!isMongoReady()) return res.status(503).send("Database not configured.");

  const LIMIT = 15;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const total = await GalleryImage.countDocuments();
  const totalPages = Math.ceil(total / LIMIT);
  const images = await GalleryImage.find()
    .sort({ createdAt: -1 })
    .skip((page - 1) * LIMIT)
    .limit(LIMIT);
  res.render("pages/admin-gallery", {
    title: "Admin — Gallery",
    images,
    currentPage: page,
    totalPages,
    layout: "layouts/admin",
  });
});

// Multiple upload: up to 20 images in one submit
app.post(
  "/admin/gallery/upload",
  requireAdmin,
  uploadGallery.array("images", 20),
  async (req, res) => {
    try {
      if (!isMongoReady())
        return res.status(503).send("Database not configured.");

      if (!req.files || req.files.length === 0) {
        return res.status(400).send("No images received.");
      }

      const docs = [];
      for (const f of req.files) {
        const r = await uploadBufferToCloudinary(f.buffer, "ucpl/gallery");
        docs.push({
          url: r.secure_url,
          publicId: r.public_id,
          originalName: f.originalname,
          caption: "UCPL Gallery",
          filename: "", // keep empty (only for old local uploads)
        });
      }

      await GalleryImage.insertMany(docs);
      return res.redirect("/admin/gallery");
    } catch (err) {
      console.error("Gallery upload error:", err);
      return res.status(500).send("Upload failed.");
    }
  },
);

// Optional: delete image
app.post("/admin/gallery/:id/delete", requireAdmin, async (req, res) => {
  try {
    if (!isMongoReady())
      return res.status(503).send("Database not configured.");

    const img = await GalleryImage.findById(req.params.id);
    if (!img) return res.redirect("/admin/gallery");

    // ✅ If Cloudinary
    if (img.publicId) {
      await cloudinary.uploader.destroy(img.publicId).catch(() => {});
    }

    // ✅ Backward-compatible: if local filename exists, attempt delete
    if (img.filename) {
      const fp = path.join(galleryUploadDir, img.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }

    await GalleryImage.findByIdAndDelete(req.params.id);
    return res.redirect("/admin/gallery");
  } catch (e) {
    console.error("Gallery delete error:", e);
    return res.status(500).send("Delete failed.");
  }
});

// --------------------
// ADMIN BRC ROUTES
// --------------------

// List BRCs
app.get("/admin/brc", requireAdmin, async (req, res) => {
  try {
    if (!isMongoReady())
      return res.status(503).send("Database not configured.");

    const brcs = await Brc.find().sort({ createdAt: -1 });
    res.render("pages/admin-brc", {
      title: "Admin — BRC",
      brcs,
      layout: "layouts/admin",
    });
  } catch (err) {
    console.error("Error fetching BRCs:", err);
    res.status(500).send("Server Error");
  }
});

// Add New BRC Form
app.get("/admin/brc/new", requireAdmin, (req, res) => {
  res.render("pages/admin-brc-form", {
    title: "Admin — Add BRC",
    layout: "layouts/admin",
    brc: null, // Indicates new entry
  });
});

// Handle Add New BRC
app.post(
  "/admin/brc",
  requireAdmin,
  uploadBrc.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "images", maxCount: 20 },
  ]),
  async (req, res) => {
    try {
      if (!isMongoReady())
        return res.status(503).send("Database not configured.");

      const { name, statement } = req.body;

      let coverUrl = "";
      let coverPublicId = "";
      let imageUrls = [];
      let imagePublicIds = [];

      // Cover upload
      if (req.files?.coverImage?.[0]) {
        const r = await uploadBufferToCloudinary(
          req.files.coverImage[0].buffer,
          "ucpl/brc/covers",
        );
        coverUrl = r.secure_url;
        coverPublicId = r.public_id;
      }

      // Gallery images upload
      if (req.files?.images?.length) {
        for (const f of req.files.images) {
          const r = await uploadBufferToCloudinary(f.buffer, "ucpl/brc/images");
          imageUrls.push(r.secure_url);
          imagePublicIds.push(r.public_id);
        }
      }

      await Brc.create({
        name,
        statement,

        // ✅ Cloudinary fields
        coverUrl,
        coverPublicId,
        imageUrls,
        imagePublicIds,

        // (optional) keep old fields empty
        coverImage: "",
        images: [],
      });

      return res.redirect("/admin/brc");
    } catch (err) {
      console.error("Error adding BRC:", err);
      return res.status(500).send("Error adding BRC. Please try again.");
    }
  },
);

// Edit BRC Form (GET)
app.get("/admin/brc/:id/edit", requireAdmin, async (req, res) => {
  try {
    if (!isMongoReady())
      return res.status(503).send("Database not configured.");

    const brc = await Brc.findById(req.params.id);
    if (!brc) return res.redirect("/admin/brc");

    res.render("pages/admin-brc-form", {
      title: "Admin — Edit BRC",
      layout: "layouts/admin",
      brc,
    });
  } catch (err) {
    console.error("Error loading edit form:", err);
    res.status(500).send("Server error");
  }
});

// Handle Edit BRC
app.post(
  "/admin/brc/:id/edit",
  requireAdmin,
  uploadBrc.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "images", maxCount: 20 },
  ]),
  async (req, res) => {
    try {
      if (!isMongoReady())
        return res.status(503).send("Database not configured.");

      const brc = await Brc.findById(req.params.id);
      if (!brc) return res.redirect("/admin/brc");

      const { name, statement } = req.body;

      // Update text fields
      brc.name = name;
      brc.statement = statement;

      // Replace cover image (if new uploaded)
      if (req.files?.coverImage?.[0]) {
        // delete old cover from Cloudinary
        if (brc.coverPublicId) {
          await cloudinary.uploader.destroy(brc.coverPublicId).catch(() => {});
        }

        const r = await uploadBufferToCloudinary(
          req.files.coverImage[0].buffer,
          "ucpl/brc/covers",
        );
        brc.coverUrl = r.secure_url;
        brc.coverPublicId = r.public_id;
      }

      // Add new gallery images (append)
      if (req.files?.images?.length) {
        for (const f of req.files.images) {
          const r = await uploadBufferToCloudinary(f.buffer, "ucpl/brc/images");
          brc.imageUrls.push(r.secure_url);
          brc.imagePublicIds.push(r.public_id);
        }
      }

      // Remove selected images (if your form sends removeImages indexes or publicIds)
      // BEST PRACTICE: send publicIds to remove
      if (req.body.removePublicIds) {
        const toRemove = Array.isArray(req.body.removePublicIds)
          ? req.body.removePublicIds
          : [req.body.removePublicIds];

        // delete from cloudinary
        for (const pid of toRemove) {
          await cloudinary.uploader.destroy(pid).catch(() => {});
        }

        // remove from arrays
        const kept = [];
        const keptIds = [];
        for (let i = 0; i < brc.imagePublicIds.length; i++) {
          if (!toRemove.includes(brc.imagePublicIds[i])) {
            kept.push(brc.imageUrls[i]);
            keptIds.push(brc.imagePublicIds[i]);
          }
        }
        brc.imageUrls = kept;
        brc.imagePublicIds = keptIds;
      }

      await brc.save();
      return res.redirect("/admin/brc");
    } catch (err) {
      console.error("Error updating BRC:", err);
      return res.status(500).send("Error updating BRC.");
    }
  },
);

// Delete BRC
app.post("/admin/brc/:id/delete", requireAdmin, async (req, res) => {
  try {
    if (!isMongoReady())
      return res.status(503).send("Database not configured.");

    const brc = await Brc.findById(req.params.id);
    if (!brc) return res.redirect("/admin/brc");

    // Remove cover image
    if (brc.coverImage) {
      const p = path.join(brcUploadDir, brc.coverImage);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    // Remove all gallery images
    if (brc.images && brc.images.length > 0) {
      brc.images.forEach((img) => {
        const p = path.join(brcUploadDir, img);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });
    }

    await Brc.findByIdAndDelete(req.params.id);
    res.redirect("/admin/brc");
  } catch (e) {
    console.error("Error deleting BRC:", e);
    res.status(500).send("Delete failed.");
  }
});

// --------------------
// PUBLIC BRC ROUTES
// --------------------

app.get("/brc", async (req, res) => {
  try {
    if (!isMongoReady()) {
      return res.render("pages/brc", {
        title: "Barangay Reading Centers",
        brcs: [],
        q: (req.query.q || "").trim(),
      });
    }

    const q = (req.query.q || "").trim();

    const filter = q
      ? {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { statement: { $regex: q, $options: "i" } },
          ],
        }
      : {};

    const brcs = await Brc.find(filter).sort({ name: 1 });

    res.render("pages/brc", {
      title: "Barangay Reading Centers",
      brcs,
      q, // pass query back to the page so the input can keep its value
    });
  } catch (err) {
    console.error("Error loading BRCs:", err);
    res.status(500).render("pages/404", { title: "Error" });
  }
});

app.get("/brc/:slug", async (req, res) => {
  try {
    if (!isMongoReady()) {
      return res.status(503).render("pages/404", { title: "Error" });
    }

    const brc = await Brc.findOne({ slug: req.params.slug });
    if (!brc)
      return res.status(404).render("pages/404", { title: "Not Found" });

    res.render("pages/brc-details", {
      title: brc.name,
      brc,
    });
  } catch (err) {
    console.error("Error loading BRC details:", err);
    res.status(500).render("pages/404", { title: "Error" });
  }
});

// --------------------
// 404 PAGE (KEEP LAST)
// --------------------
app.use((req, res) => {
  res.status(404).render("pages/404", { title: "Not Found" });
});

// --------------------
// SERVER START
// --------------------
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
