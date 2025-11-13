const express = require('express');
const mongoose = require("mongoose");
const cors = require("cors");
const ngrok = require('ngrok');


const app = express();
app.use(express.json());
app.use(cors({origin :'http://localhost:5173'}));
const bodyParser = require("body-parser");
const Database = require('./database.js');
const identityRoute = require("./routes/identityRoute.js");
const postRoute = require("./routes/postRoute.js");
const cartRoute = require("./routes/cartRoute.js");
const axios = require('axios');
const moment = require('moment');
const reqRecModel = require("./schemas/reqRecModel.js")
const transaction = require("./schemas/transactionModel.js")
const reqModel = require("./schemas/requestModels.js")
const postModel = require("./schemas/postModel.js")




// Replace with your actual credentials
const consumerKey = 'WUbn6Un5dIg6ctcWTALwt4mlGDl0SF60mmjOjn98YBtGwRai';
const consumerSecret = 'VtyqabkzT2dfLLEjBk5sAi3wDH8Hjpt5I9s6qPjn279n99inXHellJjo5HO7oonC';
const shortcode = '174379';
const passkey = 'YOUR_PASSKEY';
//always start ngrok before testing
const callbackURL = ' https://bradley-oscillatory-callie.ngrok-free.dev';

// 1. Generate Access Token
async function generateToken() {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const response = await axios.get(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return response.data.access_token;
}

// 2. Initiate STK Push
app.post('/pay', async (req, res) => {
  //**
  //in a real app u change phone part to req.body.phone but for a sandbox use fake number 254708374149
  // this is just simulated to show how real app will work so in the real app change alot but we will use req,body.phone to update transactions
  //   in req.body,U need:
  // propertyId
  // personId
  // amount
  // phone*/
  try {
    const token = await generateToken();
    const timestamp = moment().format('YYYYMMDDHHmmss');
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: req.body.amount,
      PartyA: req.body.phone,
      PartyB: shortcode,
      PhoneNumber: 254708374149,
      CallBackURL: callbackURL,
      AccountReference: req.body.reference || 'BookingApp',
      TransactionDesc: req.body.description || 'Booking Payment'
    };

    const newTransaction = new transaction({
      propertyId : req.body.propertyId,
      personId : req.body.personId,
      amount: req.body.amount,
      phone: req.body.phone
    });

    await newTransaction.save();
    console.log('Transaction saved on initiation');

    // Update property status immediately
    const post = await reqModel.findOne({ postId: propertyId });
    if (post) {
      const  reqRec = await reqRecModel.findByIdAndUpdate(
            req.body.personId,
            {$push : {leased : req.body.propertyId}},
            {new: true}
          )

      reqRec.save();
      console.log("lease status on request model table updated")

      post.leased = true;
      await post.save();
      console.log(`Property ${req.body.propertyId} marked as leased`);

      const postEmail = await postModel.findOne({_id: req.body.propertyId})
     
    } else {
      console.log('Post not found');
    }

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkPayload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send('Payment initiation failed');
  }
});

// 3. Handle Callback
app.post('/callback', (req, res) => {
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

app.listen(3001, () => console.log('Server running on port 3000'));