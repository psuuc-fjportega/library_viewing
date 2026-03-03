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
      index: true,
    },

    statement: {
      type: String,
      required: true,
    },

    // Backward compatibility (local uploads)
    coverImage: {
      type: String,
      default: "",
    },

    images: {
      type: [String],
      default: [],
    },

    // Cloudinary support (recommended)
    coverUrl: {
      type: String,
      default: "",
    },

    coverPublicId: {
      type: String,
      default: "",
    },

    imageUrls: {
      type: [String],
      default: [],
    },

    imagePublicIds: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// 🔥 Safe unique slug generator
BrcSchema.pre("save", async function () {
  if (!this.isModified("name") && !this.isNew) return;

  const baseSlug = slugify(this.name, { lower: true, strict: true });
  let slug = baseSlug;
  let counter = 1;

  const Brc = mongoose.models.Brc;

  // Ensure slug uniqueness
  while (await Brc.exists({ slug, _id: { $ne: this._id } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  this.slug = slug;
});

module.exports = mongoose.model("Brc", BrcSchema);