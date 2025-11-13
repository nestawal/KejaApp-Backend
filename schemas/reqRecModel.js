const mongoose = require("mongoose");

const reqRecSchema = mongoose.Schema({
    personId : {type: mongoose.Schema.Types.ObjectId},
    personName : {type: String},
    requests : [{
        reqPost : {type: mongoose.Schema.Types.ObjectId,ref : 'Posts'}
    }],
    leased : [{
        reqPost : {type: mongoose.Schema.Types.ObjectId,ref : 'Posts'}
    }]
})

const reqRec = mongoose.model("ReqRec",reqRecSchema);

module.exports = reqRec;