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
        coverImage: {
            type: String,
        },
        images: {
            type: [String], // Array of filenames
            default: [],
        }
    },
    { timestamps: true }
);

BrcSchema.pre("save", function () {
    if (this.isModified("name")) {
        this.slug = slugify(this.name, { lower: true, strict: true });
    }
});

module.exports = mongoose.model("Brc", BrcSchema);
