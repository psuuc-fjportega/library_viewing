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

    // Affiliation status
    affiliation: {
      type: String,
      enum: ["affiliated", "not_affiliated"],
      default: "not_affiliated",
    },

    // Facebook link
    facebookLink: {
      type: String,
      default: "",
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

// 🔥 Auto-determine affiliation based on name
BrcSchema.pre("save", function () {
  // Lists of affiliated and not affiliated BRCs
  const affiliated = [
    "Anonas", "Bayaoas", "Bolaoen", "Bactad East", "Catablan",
    "Cabaruan", "Casantaan", "Camanang", "Cabuloan", "Consolacion",
    "Cayambanan", "Dilan Paurido", "Labit Proper", "Labit West",
    "Nancamaliran West", "Nancayasan", "Oltama", "Pinmaludpod",
    "San Jose", "Sugcong"
  ];

  const notAffiliated = [
    "Camantiles", "Mabanogbog", "Macalong", "Nancalobasaan",
    "Nancamaliran East", "Poblacion", "Palina East", "Palina West",
    "Pedro D. Orata", "Sta. Lucia", "San Vicente", "Sto. Domingo",
    "Tipuso", "Tulong"
  ];

  // Remove "Barangay " prefix if present, then normalize
  const nameWithoutPrefix = this.name.replace(/^Barangay\s+/i, "").trim().toLowerCase();
  const normalizedName = this.name.trim().toLowerCase();
  
  // Check if name matches any affiliated BRC (case-insensitive)
  const affiliatedMatch = affiliated.find(name => name.toLowerCase() === nameWithoutPrefix);
  if (affiliatedMatch) {
    this.affiliation = "affiliated";
  }
  // Check if name matches any not affiliated BRC (case-insensitive)
  else {
    const notAffiliatedMatch = notAffiliated.find(name => name.toLowerCase() === nameWithoutPrefix);
    if (notAffiliatedMatch) {
      this.affiliation = "not_affiliated";
    } else {
      this.affiliation = "not_affiliated";
    }
  }
});

module.exports = mongoose.model("Brc", BrcSchema);