const mongoose = require("mongoose");

const transactionSchema = mongoose.Schema({
    personId : {type: mongoose.Schema.Types.ObjectId},
    phone : {type: String},
    amount : {type: Number}
})


const transaction = mongoose.model("transaction", transactionSchema);

module.exports = transaction;