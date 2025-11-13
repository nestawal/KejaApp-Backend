const mongoose = require("mongoose")

const PostSchema = mongoose.Schema(
    {
         email: {
            type : String,
            required: true},
         imageId: mongoose.Schema.Types.ObjectId,
         
        posts:{
            
            name: {
                type : String,
                required: true},
            description: {
                type : String, 
                required: true},
            price: {
                type : String,
                required: true},
            rooms: {
                type: String,
                required: true},
            location: {
                type: String,
                required: true
            },
            status: {
                type: Boolean,
                default: false
            }
             
        }
    },
        {
            timestamps: true
        }

);

const Post = mongoose.model("Post",PostSchema);

module.exports = Post;

