// Get the packages we need
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

// Read .env file
require('dotenv').config();

// Create our Express application
const app = express();

// Use environment defined port or 3000
const port = process.env.PORT || 3000;

// Connect to a MongoDB
const mongoUri = process.env.MONGODB_URI || process.env.DB || process.env.TOKEN; // keep TOKEN for starter compatibility
if (!mongoUri) {
  console.warn('WARNING: No MONGODB_URI found in environment; set it in your .env');
} else {
  mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Mongo connection error:', err.message));
}

// minimal CORS
app.use(cors());

// Use the body-parser package in our application
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Use routes as a module (see index.js)
require('./routes')(app, router);

// 404 handler for unmatched API routes
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Endpoint not found', data: {} });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error', data: {} });
});

// Start the server
app.listen(port, () => {
  console.log('Server running on port ' + port);
});
