const mongoose = require("mongoose")

const IdentitySchema = mongoose.Schema(
    {
        name:{
            type : String,
            required : false
        },
        email:{
            type : String,
            required : true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        agent:{
            type: Boolean,
            default: true
        },
        password:{
            type : String,
            required : true
        },
        balance:{
            type : Number,
            default : 0
        }
    }
)

const Identitymodel = mongoose.model("Identity",IdentitySchema);

module.exports = Identitymodel;