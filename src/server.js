const fs = require("fs");
const express = require("express");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");

const app = express();

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

// Layouts
app.use(expressLayouts);
app.set("layout", "layouts/main");

// Static files
app.use(express.static(path.join(__dirname, "../public")));

// --------------------
// ROUTES
// --------------------

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

// Gallery
app.get("/gallery", (req, res) => {
  res.render("pages/gallery", { title: "Gallery" });
});

// Policies
app.get("/policies", (req, res) => {
  res.render("pages/policies", { title: "Policies" });
});

// Ask a Librarian
app.get("/ask-a-librarian", (req, res) => {
  res.render("pages/ask", { title: "Ask a Librarian" });
});

// Contact
app.get("/contact", (req, res) => {
  res.render("pages/contact", { title: "Contact" });
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
      data
    });
  } catch (e) {
    console.error("Failed to load programs.json:", e.message);

    res.render("pages/programs", {
      title: "Library Program",
      data: { list: [] }
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
      program
    });
  } catch (e) {
    console.error("Failed to load programs.json:", e.message);
    res.status(500).send("Server error");
  }
});

// --------------------
// 404 PAGE
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
