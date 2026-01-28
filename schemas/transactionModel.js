const mongoose = require("mongoose");

const transactionSchema = mongoose.Schema({
    propertyId : {type: mongoose.Schema.Types.ObjectId},
    personId : {type: mongoose.Schema.Types.ObjectId},
    phone : {type: String},
    amount : {type: Number}
})


const transaction = mongoose.model("transaction", transactionSchema);

module.exports = transaction;