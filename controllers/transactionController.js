const mongoose = require('mongoose');
const transaction = require('../schemas/transactionModel');
const identities = require('../schemas/identityModel')


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
        
        // Extract unique personIds from transactions
        const personIds = transactions
            .filter(txn => txn.personId && mongoose.Types.ObjectId.isValid(txn.personId))
            .map(txn => new mongoose.Types.ObjectId(txn.personId));
        
        // Fetch ONLY name and email from identities (but keep _id for mapping)
        let identityMap = {};
        if (personIds.length > 0) {
            const identitiesList = await identities.find(
                { _id: { $in: personIds } },
                { name: 1, email: 1 }  // Keep _id for mapping (it's included by default)
            ).lean();
            
            // Create a map for quick lookup
            identitiesList.forEach(identity => {
                identityMap[identity._id.toString()] = {
                    name: identity.name,
                    email: identity.email
                };
            });
        }
        
        // Combine transaction data with ONLY name and email from identities
        const enrichedTransactions = transactions.map(txn => {
            const result = { ...txn }; // All original transaction fields
            
            if (txn.personId && identityMap[txn.personId.toString()]) {
                const identity = identityMap[txn.personId.toString()];
                result.personName = identity.name;
                result.personEmail = identity.email;
            } else {
                result.personName = null;
                result.personEmail = null;
            }
            
            return result;
        });
        
        res.status(200).json({
            message: `Found ${enrichedTransactions.length} transactions`,
            count: enrichedTransactions.length,
            transactions: enrichedTransactions
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