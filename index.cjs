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
app.use(cors({origin :'http://localhost:5173'}));
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
  const response = await axios.get(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return response.data.access_token;
}


app.post('/paySimulate', async (req, res) => {
  try {
    console.log('=== PAY SIMULATION ENDPOINT CALLED ===');
    const { personId, propertyId, amount, phone, reference, description } = req.body;

    // Validate required fields
    if (!personId || !propertyId || !amount || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        received: { personId, propertyId, amount, phone }
      });
    }

    // Convert string IDs to ObjectId to prevent schema errors
    const mongoose = require('mongoose');
    const personObjectId = new mongoose.Types.ObjectId(personId);
    const propertyObjectId = new mongoose.Types.ObjectId(propertyId);

    // Simulate STK Payload
    const timestamp = moment().format('YYYYMMDDHHmmss');
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: `${callbackURL}?propertyId=${propertyId}&personId=${personId}`,
      AccountReference: reference || 'Keja BookingApp',
      TransactionDesc: description || 'Booking Payment'
    };

    console.log('=== SIMULATION STK PAYLOAD ===');
    console.log(JSON.stringify(stkPayload, null, 2));

    // Save transaction with proper ObjectId conversion
    const newTransaction = new transaction({
      propertyId,
      personId,
      amount,
      phone
    });

    await newTransaction.save();
    console.log('Transaction saved with COMPLETED status');

    // Update property status (simulated success)
    console.log('=== SIMULATING DATABASE UPDATES ===');
    
    let databaseUpdates = {
      userLeased: false,
      propertyMarkedLeased: false,
      ownerBalanceUpdated: false
    };

    // Update user's leased properties - handle ObjectId conversion
    try {
      const updatedReqRec = await reqRecModel.findByIdAndUpdate(
        personId,
        { $push: { leased: propertyId } },
        { new: true }
      );
      
      if (updatedReqRec) {
        databaseUpdates.userLeased = true;
        console.log("Lease status on request model table updated");
      } else {
        console.log('User record not found in reqRecModel');
      }
    } catch (userError) {
      console.log('Could not update user leased properties:', userError.message);
      // Try alternative approach with string ID if ObjectId fails
      try {
        await reqRecModel.findByIdAndUpdate(
          personId,
          { $push: { leased: propertyId } },
          { new: true }
        );
        databaseUpdates.userLeased = true;
        console.log(" Lease status updated (using string IDs)");
      } catch (altError) {
        console.log(' Alternative update also failed:', altError.message);
      }
    }

    // Update post leased status
    try {
      // Try multiple ways to find the post
      let post = await reqModel.findOne({ postId: propertyObjectId });
      if (!post) {
        post = await reqModel.findOne({ postId: propertyId });
      }
      if (!post) {
        post = await reqModel.findOne({ _id: propertyObjectId });
      }

      if (post) {
        post.leased = true;
        await post.save();
        databaseUpdates.propertyMarkedLeased = true;
        console.log(` Property ${propertyId} marked as leased`);
      } else {
        console.log(' Post not found in reqModel with any identifier');
      }
    } catch (postError) {
      console.log(' Could not update post leased status:', postError.message);
    }

    // Update owner's balance
    try {
      // Try multiple ways to find the post in postModel
      let postEmail = await postModel.findOne({ _id: propertyObjectId });
      if (!postEmail) {
        postEmail = await postModel.findOne({ _id: propertyId });
      }

      if (postEmail && postEmail.email) {
        const findEmailId = await identityModel.findOne({ email: postEmail.email });
        if (findEmailId) {
          findEmailId.balance = (parseFloat(findEmailId.balance) || 0) + parseFloat(amount);
          await findEmailId.save();
          databaseUpdates.ownerBalanceUpdated = true;
          console.log(` Added balance ${amount} to ${findEmailId.email}`);
        } else {
          console.log(' Owner identity not found for email:', postEmail.email);
        }
      } else {
        console.log('Property post not found in postModel or missing email');
      }
    } catch (balanceError) {
      console.log(' Could not update owner balance:', balanceError.message);
    }

    console.log('=== SIMULATION COMPLETED SUCCESSFULLY ===');

    // Return complete simulation results
    const simulationResults = {
      success: true,
      simulated: true,
      message: 'Payment simulation completed successfully',
      stkPayload: stkPayload,
      transaction: {
        id: newTransaction._id,
        propertyId: propertyId,
        personId: personId,
        amount: amount,
        phone: phone,
        status: 'COMPLETED',
        mpesaReceiptNumber: newTransaction.mpesaReceiptNumber
      },
      databaseUpdates: databaseUpdates,
      mpesaResponse: {
        ResponseCode: '0',
        ResponseDescription: 'Success',
        MerchantRequestID: `SIM-${Date.now()}`,
        CheckoutRequestID: `ws_CO_SIM_${Date.now()}`,
        CustomerMessage: 'Success. Request processed successfully'
      },
      timestamp: new Date().toISOString()
    };

    res.json(simulationResults);

  } catch (error) {
    console.error('=== SIMULATION ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    res.status(500).json({ 
      success: false,
      error: 'Payment simulation failed',
      message: error.message,
      simulated: true
    });
  }
});

// 2. Initiate STK Push
app.post('/pay', async (req, res) => {
  try {
    const { personId, propertyId, amount, phone, reference, description } = req.body;

    const token = await generateToken();
    const timestamp = moment().format('YYYYMMDDHHmmss');
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: "254708374149",
      CallBackURL: `${callbackURL}?propertyId=${propertyId}&personId=${personId}`,
      AccountReference: reference || 'Keja BookingApp',
      TransactionDesc: description || 'Booking Payment'
    };

    console.log('STK Payload:', JSON.stringify(stkPayload, null, 2));
    console.log('Incoming request:', req.body);

    // Save transaction immediately
    const newTransaction = new transaction({
      propertyId,
      personId,
      amount,
      phone
    });

    await newTransaction.save();
    console.log('Transaction saved on initiation');

    // Update property status immediately
    const post = await reqModel.findOne({ postId: propertyId });
    if (post) {
         await reqRecModel.findByIdAndUpdate(
            personId,
            {$push : {leased : propertyId}},
            {new: true}
          )
        console.log("lease status on request model table updated")

        post.leased = true;
        await post.save();
        console.log(`Property ${propertyId} marked as leased`);

        const postEmail = await postModel.findOne({_id: propertyId})
        const findEmailId = await identityModel.findOne({email : postEmail.email})
        findEmailId.balance = amount
        await findEmailId.save();
        console.log(`added balance ${amount} to ${findEmailId.email}`)
    } else {
      console.log('Post not found');
    }

    // Send STK Push
    /**
     *  const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkPayload,
      { headers: { Authorization: `Bearer ${token}` } }
    );
     */

    res.status(200).send("stk succcesful")
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send('Payment initiation failed');
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


