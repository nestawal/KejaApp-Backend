const mongoose = require("mongoose");

const CartSchema = mongoose.Schema({
   email: { 
        type: String, 
        required: true,  
        unique: true,
        trim: true,
        lowercase: true,   
    },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        addedAt: {type: Date,default: Date.now}
    }],
    createdAt: { type: Date, default: Date.now }
});

const Cart = mongoose.model("Cart",CartSchema);

module.exports = Cart;