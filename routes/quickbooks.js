const express = require('express');
const axios = require('axios');
const qs = require('qs');

const router = express.Router();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

let access_token = null;
let realmId = null;

router.get('/connect', (req, res) => {
  const url = `https://appcenter.intuit.com/connect/oauth2?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=com.intuit.quickbooks.accounting&state=xyz`;

  console.log("Redirecting to QuickBooks auth URL:");
  console.log(url);

  res.redirect(url);
});

router.get('/callback', async (req, res) => {
  const { code, realmId: qboRealmId } = req.query;

  console.log("✅ Connected to Realm ID:", qboRealmId); // 👈 this one is correct

  try {
    const tokenRes = await axios.post(
      'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      qs.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
      {
        headers: {
          Authorization:
            'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    access_token = tokenRes.data.access_token;
    realmId = qboRealmId;

    console.log("🔐 Access token:", access_token); // optional: remove in production

    res.send('✅ QuickBooks connected! Now visit /report/open-orders');
  } catch (err) {
    console.error("❌ Error in /callback:");
    console.error(err.response?.data || err.message);
    res.status(500).send('OAuth callback failed');
  }
});


router.get('/report/open-orders', async (req, res) => {
  if (!access_token || !realmId) {
    return res.status(401).send('Not connected to QuickBooks');
  }

  const { customer, fromDate, toDate, limit = 10, offset = 0 } = req.query;

  // Build WHERE clause
  let where = `Balance > '0'`;

  if (customer) {
    where += ` AND DisplayName LIKE '%${customer}%'`;
  }

  if (fromDate && toDate) {
    where += ` AND TxnDate >= '${fromDate}' AND TxnDate <= '${toDate}'`;
  }

  const query = `SELECT * FROM Invoice WHERE ${where} STARTPOSITION ${offset} MAXRESULTS ${limit}`;

  try {
    const response = await axios.get(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: 'application/json',
        },
      }
    );

    const invoices = response.data.QueryResponse.Invoice || [];
    res.json(invoices);
  } catch (err) {
  console.error("❌ Error fetching report:");
  if (err.response) {
    console.error("Status:", err.response.status);
    console.error("Data:", JSON.stringify(err.response.data, null, 2)); // 👈 Add this!
  } else {
    console.error(err.message);
  }
  res.status(500).send('Error fetching report');
  }
});

module.exports = router;
