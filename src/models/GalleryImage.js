const mongoose = require("mongoose");

const GalleryImageSchema = new mongoose.Schema(
  {
    // old/local uploads (optional now)
    filename: { type: String, default: "" },

    // cloudinary uploads
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },

    originalName: { type: String, default: "" },
    caption: { type: String, default: "UCPL Gallery" },
  },
  { timestamps: true }
);

GalleryImageSchema.path("url").validate(function () {
  return this.url || this.filename;
}, "Either url or filename must exist.");


module.exports = mongoose.model("GalleryImage", GalleryImageSchema);