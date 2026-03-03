const mongoose = require("mongoose");
const slugify = require("slugify");

const BrcSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
    },
    statement: {
      type: String,
      required: true,
    },

    // Backward-compatible local filename (old uploads)
    coverImage: { type: String, default: "" },
    images: { type: [String], default: [] },

    // Cloudinary (new uploads)
    coverUrl: { type: String, default: "" },          // secure_url
    coverPublicId: { type: String, default: "" },     // public_id

    imageUrls: { type: [String], default: [] },       // secure_url list
    imagePublicIds: { type: [String], default: [] },  // public_id list
  },
  { timestamps: true }
);

BrcSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

module.exports = mongoose.model("Brc", BrcSchema);