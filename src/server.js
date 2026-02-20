require("dotenv").config();

const fs = require("fs");
const express = require("express");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const session = require("express-session");

const Inquiry = require("./models/Inquiry");

const app = express();

// --------------------
// MIDDLEWARE
// --------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 2 // 2 hours
    }
  })
);

// Static files
app.use(express.static(path.join(__dirname, "../public")));

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

// Layouts
app.use(expressLayouts);
app.set("layout", "layouts/main");

// --------------------
// MONGODB CONNECT
// --------------------
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

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

// Collections
app.get("/collections", (req, res) => {
  res.render("pages/collections", { title: "Collections" });
});

// Programs list page (loads from JSON)
app.get("/programs", (req, res) => {
  try {
    const raw = fs.readFileSync(
      path.join(__dirname, "../data/programs.json"),
      "utf-8"
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
      "utf-8"
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

// Gallery
app.get("/gallery", (req, res) => {
  res.render("pages/gallery", { title: "Gallery" });
});

// Policies
app.get("/policies", (req, res) => {
  res.render("pages/policies", { title: "Policies" });
});

// Ask a Librarian (GET)
app.get("/ask-a-librarian", (req, res) => {
  res.render("pages/ask", { title: "Ask a Librarian" });
});

// Ask a Librarian (POST) - SAVE TO DB + OPTIONAL EMAIL
app.post("/ask-a-librarian", async (req, res) => {
  const { name, email, category, message } = req.body;

  if (!name || !email || !category || !message) {
    return res.render("pages/ask", {
      title: "Ask a Librarian",
      error: "Please complete all fields.",
    });
  }

  try {
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
const multer = require("multer");
const galleryStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, "../public/assets/gallery");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, '-'));
  }
});
const uploadGallery = multer({ storage: galleryStorage });

// Admin: list
app.get("/admin/inquiries", requireAdmin, async (req, res) => {
  try {
    const inquiries = await Inquiry.find().sort({ createdAt: -1 });
    res.render("pages/admin-inquiries", {
      title: "Admin — Inquiries",
      inquiries,
    });
  } catch (e) {
    console.error("Admin list error:", e);
    res.status(500).send("Server error");
  }
});
// Admin: view single
app.get("/admin/inquiries/:id", requireAdmin, async (req, res) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry)
      return res.status(404).render("pages/404", { title: "Not Found" });

    res.render("pages/admin-inquiry-view", {
      title: `Inquiry — ${inquiry.name}`,
      inquiry,
    });
  } catch (e) {
    console.error("Admin view error:", e);
    res.status(500).send("Server error");
  }
});

// Admin: resolve
app.post("/admin/inquiries/:id/resolve", requireAdmin, async (req, res) => {
  try {
    const updated = await Inquiry.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "resolved" } },
      { new: true }
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
    await Inquiry.findByIdAndDelete(req.params.id);
    res.redirect("/admin/inquiries");
  } catch (e) {
    console.error("Admin delete error:", e);
    res.status(500).send("Server error");
  }
});

// Admin login page
app.get("/admin/login", (req, res) => {
  res.render("pages/admin-login", { title: "Admin Login" });
});

//admin fix status
app.get("/admin/fix-status", requireAdmin, async (req, res) => {
  await Inquiry.updateMany(
    { status: { $exists: false } },
    { $set: { status: "new" } }
  );
  res.send("✅ Fixed missing status field");
});

// Admin login submit
app.post("/admin/login", (req, res) => {
  const { password } = req.body;

  if (password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect("/admin/inquiries");
  }

  return res.render("pages/admin-login", {
    title: "Admin Login",
    error: "Incorrect password."
  });
});

// Admin logout
app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin/login");
  });
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