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

    res.send('✅ QuickBooks connected! Now visit /report/open-orders');
  } catch (err) {
     console.error("🔴 Failed to exchange token:");
  if (err.response) {
    console.error("Status:", err.response.status);
    console.error("Data:", err.response.data);
  } else {
    console.error(err.message);
  }
  res.status(500).send('❌ OAuth error');
  }
});

router.get('/report/open-orders', async (req, res) => {
  if (!access_token || !realmId) {
    return res.status(401).send('Not connected to QuickBooks');
  }

  try {
    const response = await axios.get(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=SELECT * FROM Invoice WHERE Balance > '0'`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: 'application/json',
        },
      }
    );

    const orders = response.data.QueryResponse.Invoice || [];
    res.json(orders);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send('Error fetching report');
  }
});

module.exports = router;
