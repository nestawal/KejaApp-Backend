const mongoose = require("mongoose")

const requestSchema = mongoose.Schema(
    {
        
        postId: {type: mongoose.Schema.Types.ObjectId,ref : 'Posts'},
         
        pending:[{
            pendingUserId : {type: mongoose.Schema.Types.ObjectId},
            months: {type: Number},
            date :{type: Date, default:Date.now},
            name:{type: String}
        }],

        accepted: {

            acceptedUserId: {type: mongoose.Schema.Types.ObjectId},
            acceptedUserName:{type: String},
            months: {type: Number},
            date :{type: Date}
        },
        leased: {
            type:  Boolean,
            default : false
        }
    }
);

const request = mongoose.model("Request",requestSchema);

module.exports = request;