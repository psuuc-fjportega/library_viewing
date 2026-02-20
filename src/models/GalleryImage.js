const mongoose = require("mongoose");

const GalleryImageSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true }, // stored file name in /public/assets/gallery/
    originalName: { type: String, required: true },
    caption: { type: String, default: "UCPL Gallery" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GalleryImage", GalleryImageSchema);