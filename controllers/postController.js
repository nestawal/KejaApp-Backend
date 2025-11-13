const express= require('express')
const app = express();
app.use('/uploads',express.static("uploads"));
const { GridFSBucket } = require('mongodb');
const multer = require('multer');
const path = require('path');
const postModel = require("../schemas/postModel.js");
const mongoose = require('mongoose');
const fs = require('fs');
const request = require("../schemas/requestModels.js");
//const aws = require('aws-sdk');


/**
 * trying to ditch the gridfs/mongodb file storage to sdk 
 * then when posted return the id of the file for later use
 */

// Initialize GridFS
let gfs;
const conn = mongoose.connection;
conn.once('open', () => {
    gfs = new GridFSBucket(conn.db, { bucketName: 'uploads' });
});

// Set up multer to store files in memory
const upload = multer({ storage: multer.memoryStorage() });


const createPost = async (req, res) => {
  console.log("File received:", req.file);
  
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    // Check if GridFS is initialized
    if (!gfs) {
      return res.status(500).json({ message: 'Storage system not initialized.' });
    }

    const filename = Date.now() + path.extname(req.file.originalname);
    const writeStream = gfs.openUploadStream(filename, {
      contentType: req.file.mimetype,
    });

    // Handle stream errors
    writeStream.on('error', (error) => {
      console.error("GridFS write error:", error);
      if (!res.headersSent) {
        return res.status(500).json({ message: 'Error uploading file to GridFS.' });
      }
    });

    // Handle stream finish
    writeStream.on('finish', async () => {
      try {
        const { email, name, description, location, rooms, price } = req.body;
        console.log("Request body:", req.body);

        // Validate required fields
        if (!email || !name || !description || !location || !rooms || !price) {
          // Clean up the uploaded file if validation fails
          await gfs.delete(writeStream.id);
          return res.status(400).json({ message: 'Missing required fields.' });
        }

        const newPost = new postModel({
          email,
          imageId: writeStream.id,
          posts: {
            name,
            description,
            location,
            rooms: parseInt(rooms),
            price: parseFloat(price)
          }
        });

        await newPost.save();

        const newReqsec = await request.create({
          postId : newPost._id
        })
        
        if (!res.headersSent) {
          res.status(201).json({
            message: 'Post created successfully',
            post: newPost,
            reqSec: newReqsec
          });
        }
      } catch (err) {
        console.error("Error saving post:", err);
        // Clean up the uploaded file if post creation fails
        await gfs.delete(writeStream.id);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error saving post.', error: err.message });
        }
      }
    });

    // Start writing the file buffer
    writeStream.end(req.file.buffer);

  } catch (error) {
    console.error("Unhandled error in createPost:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error creating post.', error: error.message });
    }
  }
};




// Get an image by ID
const getImage = async (req, res) => {
    try {
        const fileId = new mongoose.Types.ObjectId(req.params.id);

        // Find the file in GridFS
        const file = await gfs.find({ _id: fileId }).toArray();
        if (!file || file.length === 0) {
            return res.status(404).json({ message: 'File not found.' });
        }

        // Stream the file to the response
        const readStream = gfs.openDownloadStream(fileId);
        readStream.pipe(res);
    } catch (error) {
        console.error(error);
        console.log("Request body at error:", JSON.stringify(req.body, null, 2));
        res.status(500).json({ message: 'Error retrieving file.' });
    }
};


const getPostFeed = async (req,res) => {
    try{
        const conn = mongoose.connection;
        const bucket = new GridFSBucket(conn.db,{
            bucketName : 'uploads'
        });

        const posts = await postModel.find({});
        console.log(typeof postModel);
        console.log(postModel);
        const enrPosts = await Promise.all(posts.map(async (post) =>{
            if (!post.imageId) return post;

            const chunks = [];
            const stream = bucket.openDownloadStream(post.imageId);

            return new Promise((resolve,reject) => {
                stream.on('data',(chunk) => chunks.push(chunk));
                stream.on('error',(err) => reject(err));
                stream.on('end',() =>{
                    const fileBuffer = Buffer.concat(chunks);
                    const fileBase64 = fileBuffer.toString('base64');

                    resolve({
                        ...post.toObject(),
                        file : fileBase64
                    });
                });
            });
        }));
        res.status(200).json(enrPosts);
    } catch (error){
        console.log("error retrieving posts:",error);
        res.status(500).json({message:"server error",error:error.message})
    };

};

const getMyPosts = async (req,res) => {
  try{
    const conn = mongoose.connection;
    const bucket = new GridFSBucket(conn.db,{
       bucketName : 'uploads'
    });

    const {email} = req.body
    console.log(email);

    const posts = await postModel.find({email: email })

    const enrPosts = await Promise.all(posts.map(async (post) =>{
            if (!post.imageId) return post;

            const chunks = [];
            const stream = bucket.openDownloadStream(post.imageId);

            return new Promise((resolve,reject) => {
                stream.on('data',(chunk) => chunks.push(chunk));
                stream.on('error',(err) => reject(err));
                stream.on('end',() =>{
                    const fileBuffer = Buffer.concat(chunks);
                    const fileBase64 = fileBuffer.toString('base64');

                    resolve({
                        ...post.toObject(),
                        file : fileBase64
                    });
                });
            });
        }));
        res.status(200).json(enrPosts);


  } catch (error){
    console.log("error retrieving your posts:",error);
    res.status(500).json({message:"server error",error:error.message})
  };

};

const getPostwithId=async(req,res)=>{
  try {
  const conn = mongoose.connection;
  const bucket = new GridFSBucket(conn.db, {
    bucketName: 'uploads'
  });

  const { id } = req.params;
  console.log(id);
  const post = await postModel.findOne({ _id: id });

  if (!post || !post.imageId) {
    return res.status(200).json(post);
  }

  const chunks = [];
  const stream = bucket.openDownloadStream(post.imageId);

  stream.on('data', (chunk) => chunks.push(chunk));
  stream.on('error', (err) => {
    console.error("Stream error:", err);
    return res.status(500).json({ message: "Error reading file from GridFS", error: err.message });
  });

  stream.on('end', () => {
    const fileBuffer = Buffer.concat(chunks);
    const fileBase64 = fileBuffer.toString('base64');

    const enrichedPost = {
      ...(typeof post.toObject === 'function' ? post.toObject() : post),
      file: fileBase64
    };

    res.status(200).json(enrichedPost);
  });

} catch (error) {
  console.error("Error retrieving your post:", error);
  res.status(500).json({ message: "Server error", error: error.message });
}

}

module.exports = { upload, createPost, getImage ,getPostFeed,getMyPosts,getPostwithId};