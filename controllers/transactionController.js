const mongoose = require('mongoose');
const transaction = require('../schemas/transactionModel');

// Get transactions by propertyId
const getTransactionsByPropertyId = async (req, res) => {
    try {
        const { propertyId } = req.params;
        
        if (!propertyId || !mongoose.Types.ObjectId.isValid(propertyId)) {
            return res.status(400).json({
                error: "Invalid or missing propertyId"
            });
        }
        
        const transactions = await transaction.find({ 
            propertyId: new mongoose.Types.ObjectId(propertyId) 
        }).sort({ createdAt: -1 }).lean();
        
        console.log(`Found ${transactions.length} transactions for property ${propertyId}`);
        
        res.status(200).json({
            message: `Found ${transactions.length} transactions`,
            count: transactions.length,
            transactions: transactions
        });
        
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ error: "Failed to fetch transactions" });
    }
};

// Get transactions by personId (THIS IS THE FUNCTION YOU ASKED FOR)
const getTransactionsByPersonId = async (req, res) => {
    try {
        const { personId } = req.params;
        
        if (!personId || !mongoose.Types.ObjectId.isValid(personId)) {
            return res.status(400).json({
                error: "Invalid or missing personId"
            });
        }
        
        const transactions = await transaction.find({ 
            personId: new mongoose.Types.ObjectId(personId) 
        }).sort({ createdAt: -1 }).lean();
        
        console.log(`Found ${transactions.length} transactions for person ${personId}`);
        
        res.status(200).json({
            message: `Found ${transactions.length} transactions`,
            count: transactions.length,
            transactions: transactions
        });
        
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ error: "Failed to fetch transactions" });
    }
};

// Export both functions
module.exports = {
    getTransactionsByPropertyId,
    getTransactionsByPersonId
};