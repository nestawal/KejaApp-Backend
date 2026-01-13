const express = require('express');
const mongoose = require("mongoose");
const cors = require("cors");
const transaction = require('./schemas/transactionModel.js');
const reqModel = require("./schemas/requestModels.js")
const reqRecModel = require("./schemas/reqRecModel.js")
const postModel = require("./schemas/postModel.js")
const identityModel = require("./schemas/identityModel.js")


const app = express();
app.use(express.json());
app.use(cors({origin : ['http://localhost:5173',"https://kejafrontend.netlify.app"]}));
const bodyParser = require("body-parser");
const Database = require('./database.js');
const identityRoute = require("./routes/identityRoute.js");
const postRoute = require("./routes/postRoute.js");
const cartRoute = require("./routes/cartRoute.js");
const reqRoute = require("./routes/requestRoute.js")
const axios = require('axios');



app.use('/identities',identityRoute)
app.use("/Post",postRoute)
app.use("/Cart",cartRoute)
app.use("/requests",reqRoute)


mongoose.connect(Database)
    .then(()=>{
        console.log("database connected")
        app.listen(3001,()=>{
            console.log("3k running")
        });
    })
    .catch((error)=>{
        console.log("failed connection",error)
    });

const moment = require('moment');




// Replace with your actual credentials
const consumerKey = "WUbn6Un5dIg6ctcWTALwt4mlGDl0SF60mmjOjn98YBtGwRai";
const consumerSecret ='VtyqabkzT2dfLLEjBk5sAi3wDH8Hjpt5I9s6qPjn279n99inXHellJjo5HO7oonC';
const shortcode = '174379';
const passkey = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
//always start ngrok before testing
const callbackURL = 'https://bradley-oscillatory-callie.ngrok-free.dev/callback';

// 1. Generate Access Token
async function generateToken() {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  try {
    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      { headers: { Authorization: `Basic ${auth}` } }
    );
    console.log("Token generated successfully");
    return response.data.access_token;
  } catch (error) {
    console.error("Token Generation Error:", error.response?.data || error.message);
    throw new Error("Failed to generate Safaricom token");
  }
}



// 2. Initiate STK Push
app.post('/pay', async (req, res) => {
 try {
    const { personId, propertyId, amount, phone, reference, description } = req.body;

    // 1. Generate Token & Auth
    const token = await generateToken();
    const timestamp = moment().format('YYYYMMDDHHmmss');
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    // 2. Setup Payload 
    // IMPORTANT: Use the 'phone' variable from req.body
    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone, // Real phone number (e.g., 254700000000)
      PartyB: shortcode,
      PhoneNumber: phone, // Real phone number
      CallBackURL: `${callbackURL}?propertyId=${propertyId}&personId=${personId}`,
      AccountReference: reference || 'Keja BookingApp',
      TransactionDesc: description || 'Booking Payment'
    };

    console.log('Sending STK Push to Safaricom...');

    // 3. HIT THE ACTUAL SAFARICOM API
    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkPayload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // 4. Save transaction to DB (Initial state: Pending)
    const newTransaction = new transaction({
      propertyId,
      personId,
      amount,
      phone,
      checkoutRequestId: response.data.CheckoutRequestID, // Store this to track the callback
      status: 'PENDING' 
    });
    await newTransaction.save();

    // Send success response to Frontend
    res.status(200).json({
      message: "STK Push sent successfully",
      data: response.data
    });

  } catch (error) {
    console.error('STK Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Payment initiation failed',
      details: error.response?.data
    });
  }
});


// 3. Handle Callback
app.post('/callback', async(req, res) => {
  const callbackData = req.body;
  console.log('Callback received:', JSON.stringify(callbackData, null, 2));

  

  // TODO: Update booking status in your DB based on callbackData.Body.stkCallback.ResultCode
  res.sendStatus(200);
});

// 4. Optional: Check Payment Status
app.post('/status', async (req, res) => {
  try {
    const token = await generateToken();
    const timestamp = moment().format('YYYYMMDDHHmmss');
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const statusPayload = {
      Initiator: 'testapi',
      SecurityCredential: 'YOUR_ENCRYPTED_CREDENTIAL',
      CommandID: 'TransactionStatusQuery',
      TransactionID: req.body.transactionId,
      PartyA: shortcode,
      IdentifierType: '4',
      ResultURL: 'https://yourdomain.com/status/result',
      QueueTimeOutURL: 'https://yourdomain.com/status/timeout',
      Remarks: 'Status Check'
    };

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/transactionstatus/v1/query',
      statusPayload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send('Status check failed');
  }
});


