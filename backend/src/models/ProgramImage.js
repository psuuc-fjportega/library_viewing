const mongoose = require("mongoose");

const ProgramImageSchema = new mongoose.Schema(
  {
    programSlug: { type: String, required: true, index: true },
    
    // cloudinary uploads
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },

    originalName: { type: String, default: "" },
    caption: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProgramImage", ProgramImageSchema);
