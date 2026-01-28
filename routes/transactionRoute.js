const express = require('express');
const router = express.Router();
const { 
    getTransactionsByPropertyId, 
    getTransactionsByPersonId 
} = require('../controllers/transactionController');

// Route to get transactions by propertyId
router.get('/property/:propertyId', getTransactionsByPropertyId);

// Route to get transactions by personId
router.get('/person/:personId', getTransactionsByPersonId);

module.exports = router;