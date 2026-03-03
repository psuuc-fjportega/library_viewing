const mongoose = require("mongoose");
const slugify = require("slugify");

const BrcSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    statement: { type: String, required: true },
    coverImage: { type: String },
    images: { type: [String], default: [] },
  },
  { timestamps: true }
);

// No next() needed
BrcSchema.pre("save", function () {
  if (this.isModified("name") || this.isNew) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
});

module.exports = mongoose.model("Brc", BrcSchema);