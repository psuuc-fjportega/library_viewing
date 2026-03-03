const mongoose = require("mongoose");

const GalleryImageSchema = new mongoose.Schema(
  {
    // Backward-compatible local filename (old uploads)
    filename: { type: String, required: true },

    // Cloudinary (new uploads)
    url: { type: String, default: "" },        // secure_url
    publicId: { type: String, default: "" },   // public_id (useful for deletes)

    originalName: { type: String, default: "" },
    caption: { type: String, default: "UCPL Gallery" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GalleryImage", GalleryImageSchema);