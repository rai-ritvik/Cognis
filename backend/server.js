require('dotenv').config();
const express = require('express');
const cors = require('cors');

const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api', studentRoutes);
app.use('/api/sessions', adminRoutes);

app.get('/api/health', (req, res) => {
    res.json({
        status: "success",
        message: "OmniScan API is awake and ready."
    });
});

app.listen(PORT, () => {
    console.log("OmniScan Backend is running on port " + PORT);
});