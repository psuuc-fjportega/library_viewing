require('dotenv').config();
const mongoose = require('mongoose');

console.log('Testing MongoDB connection...');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully!');
    console.log('Database name:', mongoose.connection.name);
    mongoose.connection.close();
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
  });
