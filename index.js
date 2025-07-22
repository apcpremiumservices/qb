// Load .env early
require('dotenv').config();

console.log("👀 ENV CHECK:");
console.log("CLIENT_ID:", process.env.CLIENT_ID);
console.log("REDIRECT_URI:", process.env.REDIRECT_URI);

const express = require('express');
const quickbooksRoutes = require('./routes/quickbooks');

const app = express();
app.use(express.json());
app.use('/', quickbooksRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Start QuickBooks auth at: http://localhost:${PORT}/connect`);
});

