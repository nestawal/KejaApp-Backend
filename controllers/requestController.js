const express = require("express");
const reqModel = require("../schemas/requestModels.js");
const postModel = require("../schemas/postModel.js");
const idModel = require("../schemas/identityModel.js")
const reqRecModel = require("../schemas/reqRecModel.js")
const mongoose = require("mongoose")
const { GridFSBucket } = require('mongodb');


async function givePostrequest(req,res){
    //this is to update already posted posts to have a request section
    try{
        const posts = await postModel.find({},'_id');

        const newRequests = posts.map(post=>({
            postId : post._id
        }))

        await reqModel.insertMany(newRequests);
        console.log("requests succesfully made")
         res.status(201).json(newRequests);
    }catch(err){
        console.log("following error caught:",err);
        res.status(500).json({error:"failed:",details:err});
    }
}

const createNewReq = async(req, res) => {
    try {
        const { postId, personId, months, name } = req.body;
        
        // Validate input
        if (!postId || !personId || !months || !name) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        
        // Check if user already requested this property
        const existingRequest = await reqModel.findOne({
            postId: postId,
            "pending.pendingUserId": personId
        });
        
        if (existingRequest) {
            return res.status(400).json({ 
                error: "You have already requested this property" 
            });
        }
        
        // Create pending request object
        const newPending = {
            pendingUserId: personId,
            months: months,
            name: name,
            date: Date.now()  // Add timestamp
        };
        
        // Add to property's pending requests
        const updateResult = await reqModel.updateOne(
            { postId: postId },
            { $push: { pending: newPending } },
            { upsert: true }  // Create if doesn't exist
        );
        
        // Record in user's request history
        const reqPost = new mongoose.Types.ObjectId(postId);
        
        await reqRecModel.findOneAndUpdate(
            { personId: personId },
            { 
                $push: { requests: { reqPost: reqPost } },
                $setOnInsert: { 
                    personId: personId,
                    name: name  // Better field name than personEmail
                }
            },
            { upsert: true, new: true }
        );
        
        if (updateResult.modifiedCount > 0 || updateResult.upsertedCount > 0) {
            console.log("Successfully added request for property:", postId);
            return res.status(200).json({ 
                message: "Request submitted successfully",
                requestId: postId
            });
        } else {
            console.log("Failed to update request");
            return res.status(500).json({ error: "Failed to submit request" });
        }
        
    } catch (err) {
        console.error("Error creating request:", err);
        res.status(500).json({ error: "Failed to create request" });
    }
};

const returnReqRec = async(req, res) => {
    try {
        const { id } = req.params; // User ID from URL
        
        console.log("=== START: Processing requests for user ===");
        console.log("User ID:", id);
        
        // 1. Find user's request record
        const myReqRec = await reqRecModel.findOne({ personId: id });
        
        if (!myReqRec) {
            console.log("No request record found for user");
            return res.status(200).json([]);
        }
        
        console.log(`User has ${myReqRec.requests?.length || 0} requests`);
        
        // 2. Extract post IDs from requests
        const postIds = myReqRec.requests
            .map(req => req.reqPost)
            .filter(postId => postId && mongoose.Types.ObjectId.isValid(postId));
        
        if (postIds.length === 0) {
            return res.status(200).json([]);
        }
        
        console.log("Post IDs to fetch:", postIds.map(id => id.toString()));
        
        // 3. Fetch posts
        const posts = await postModel.find({ 
            _id: { $in: postIds }
        }).lean();
        
        console.log(`Found ${posts.length} posts`);
        
        if (posts.length === 0) {
            return res.status(200).json([]);
        }
        
        // 4. Transform posts (flatten nested structure)
        const transformedPosts = posts.map(doc => ({
            _id: doc._id,
            email: doc.email,
            imageId: doc.imageId,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            ...doc.posts
        }));
        
        // 5. Get request records for these posts
        const postIdStrings = postIds.map(id => id.toString());
        const postReqs = await reqModel.find({ 
            postId: { $in: postIdStrings }
        }).lean();
        
        console.log(`Found ${postReqs.length} request records`);
        
        // 6. Create lookup map - FIXED VERSION
        const reqMap = new Map();
        postReqs.forEach(req => {
            // Convert postId to string for consistent lookup
            const postIdKey = req.postId ? req.postId.toString() : null;
            if (postIdKey) {
                reqMap.set(postIdKey, req);
                console.log(`Added to map: "${postIdKey}" ->`, {
                    acceptedUserId: req.accepted?.acceptedUserId,
                    type: typeof req.accepted?.acceptedUserId
                });
            }
        });
        
        // Debug: Check what's in the map
        console.log("Map contents:");
        reqMap.forEach((value, key) => {
            console.log(`Key: "${key}" (type: ${typeof key})`);
            console.log(`Value acceptedUserId:`, value.accepted?.acceptedUserId);
        });
        
        // 7. Get images (optional - can be skipped if causing timeout)
        const imageMap = new Map();
        const imageIds = transformedPosts
            .map(post => post.imageId)
            .filter(imgId => imgId && mongoose.Types.ObjectId.isValid(imgId));
        
        if (imageIds.length > 0) {
            console.log(`Downloading ${imageIds.length} images`);
            try {
                const conn = mongoose.connection;
                const bucket = new GridFSBucket(conn.db, { bucketName: 'uploads' });
                
                // Download images in parallel with timeout
                const imagePromises = imageIds.map(async (imageId) => {
                    return new Promise((resolve) => {
                        const chunks = [];
                        const stream = bucket.openDownloadStream(imageId);
                        
                        // Set timeout
                        const timeout = setTimeout(() => {
                            stream.destroy();
                            console.log(`Timeout downloading image ${imageId}`);
                            resolve(null);
                        }, 10000);
                        
                        stream.on('data', (chunk) => chunks.push(chunk));
                        stream.on('error', (err) => {
                            clearTimeout(timeout);
                            console.log(`Error downloading image ${imageId}:`, err.message);
                            resolve(null);
                        });
                        stream.on('end', () => {
                            clearTimeout(timeout);
                            if (chunks.length === 0) {
                                resolve(null);
                                return;
                            }
                            try {
                                const fileBuffer = Buffer.concat(chunks);
                                const fileBase64 = fileBuffer.toString('base64');
                                resolve({ imageId, fileBase64 });
                            } catch (err) {
                                console.log(`Error processing image ${imageId}:`, err);
                                resolve(null);
                            }
                        });
                    });
                });
                
                const imageResults = await Promise.all(imagePromises);
                imageResults.forEach(result => {
                    if (result) {
                        imageMap.set(result.imageId.toString(), result.fileBase64);
                    }
                });
            } catch (imageErr) {
                console.error("Error in image download:", imageErr);
                // Continue without images
            }
        }
        
        // 8. Build response with correct payment logic
        const enrPosts = transformedPosts.map(post => {
            const postIdStr = post._id.toString();
            const postReq = reqMap.get(postIdStr);
            
            console.log(`\n=== Processing post ${postIdStr} ===`);
            console.log(`Found in reqMap:`, !!postReq);
            console.log(`Looking for key: "${postIdStr}"`);
            
            let acceptStatus = false;
            if (postReq?.accepted?.acceptedUserId) {
                // Handle both ObjectId and string cases
                const acceptedUserId = postReq.accepted.acceptedUserId;
                const acceptedUserIdStr = acceptedUserId.toString ? acceptedUserId.toString() : String(acceptedUserId);
                
                console.log(`Accepted user ID: "${acceptedUserIdStr}" (original type: ${typeof acceptedUserId})`);
                console.log(`Current user ID: "${id}" (type: ${typeof id})`);
                
                acceptStatus = acceptedUserIdStr === id;
                console.log(`Match result: ${acceptStatus}`);
                
                // Additional debug: character by character comparison
                if (!acceptStatus) {
                    console.log("Character comparison:");
                    for (let i = 0; i < Math.max(acceptedUserIdStr.length, id.length); i++) {
                        const dbChar = acceptedUserIdStr[i];
                        const paramChar = id[i];
                        console.log(`  Pos ${i}: DB="${dbChar}" vs Param="${paramChar}" - ${dbChar === paramChar ? '✓' : '✗'}`);
                    }
                }
            } else {
                console.log("No acceptedUserId found or postReq not found");
            }
            
            // Build post object
            const postObj = { ...post };
            
            // Add image if available
            if (post.imageId && imageMap.has(post.imageId.toString())) {
                postObj.file = imageMap.get(post.imageId.toString());
            }
            
            // Check if user is in pending requests
            const isPending = postReq?.pending?.some(
                pendingReq => {
                    const pendingUserId = pendingReq.pendingUserId;
                    const pendingUserIdStr = pendingUserId?.toString ? pendingUserId.toString() : String(pendingUserId);
                    return pendingUserIdStr === id;
                }
            );
            
            return {
                newPost: postObj,
                acceptStatus,  // true if this user was accepted
                canIpay: acceptStatus,  // can pay if accepted
                requestStatus: acceptStatus ? 'accepted' : (isPending ? 'pending' : 'not_requested'),
                debug: {
                    postId: postIdStr,
                    userId: id,
                    acceptedUserId: postReq?.accepted?.acceptedUserId,
                    isMatch: acceptStatus,
                    foundRequest: !!postReq
                }
            };
        });
        
        console.log("\n=== FINAL SUMMARY ===");
        console.log(`Processed ${enrPosts.length} posts`);
        
        // Show which posts user can pay for
        enrPosts.forEach((item, index) => {
            console.log(`Post ${index} (${item.newPost.name}):`);
            console.log(`  acceptStatus: ${item.acceptStatus}`);
            console.log(`  canIpay: ${item.canIpay}`);
            console.log(`  requestStatus: ${item.requestStatus}`);
        });
        
        res.status(200).json(enrPosts);
        
    } catch (err) {
        console.error("Error in returnReqRec:", err);
        res.status(500).json({ 
            error: "Failed to get request records",
            message: err.message 
        });
    }
};

const returnLeased = async(req,res)=>{
    try{
        const conn = mongoose.connection;
        const bucket = new GridFSBucket(conn.db,{
            bucketName : 'uploads'
        });
        
        const {id} = req.params
        

        const myReqRec = await reqRecModel.findOne({personId : id})
        console.log("this is the leased:",myReqRec.leased)

        let reqPosts = myReqRec.leased
        let posts = []
        for(let i = 0;i<reqPosts.length;i++){
            const postId = reqPosts[i].reqPost
            const post = await postModel.findOne({_id: postId})
            console.log(post)
             if (post) {posts.push(post)}; 
        }

        const enrPosts = await Promise.all(posts.map(async (post) =>{
            if (!post.imageId) return post;
            console.log("post._id",post._id)
            

            const chunks = [];
            const stream = bucket.openDownloadStream(post.imageId);

            let newPost = await new Promise((resolve,reject) => {
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
            })

            let postReq = await reqModel.findOne({postId : post._id})
            const message = postReq ? "found the post request" : "post Request  not available ";
            console.log(message);
            let acceptStatus = postReq.accepted.acceptedUserId.toString() === id ? true : false;
            console.log("the accepted userId id :",postReq.accepted.acceptedUserId)
            console.log("this is the userId :",id)
            console.log("the status is :",acceptStatus)

           let finalPost = ({newPost ,acceptStatus})
           return (finalPost)
        }));
        res.status(200).json(enrPosts);

        
    }catch(err){
        console.error("this error occured:",err);
        res.status(500).json({error:"failed to get request "})
    }
}

const acceptReq=async(req,res)=>{
    try{
        const postId = req.body.postId;
        const months = req.body.months;
        const acceptedUserId = req.body.acceptedUserId;
        const acceptedUserName = req.body.acceptedUserName;
        

        const newUpdate = {
            
            accepted :{
                acceptedUserId : acceptedUserId,
                months : months,
                date : Date.now(),
                acceptedUserName: acceptedUserName
            }
        }
        console.log(newUpdate);

        const result = await reqModel.updateOne({postId:postId},newUpdate);

        res.status(200).json({message:"succesful update",result});
        if(result.modifiedCount > 0){
            console.log("Succesfully updated")
        }else{
            console.log("failed update")
        }
        
    }catch(e){
        console.error("this error occured:",e);
        res.status(500).json({error:"failed to update pending "})
    }
}
//create endpoint to get pending usesrs/accepted users
const getRequestById=async(req,res)=>{
   try{
     const {id} = req.params

    const requestedId = await reqModel.findOne({postId : id});

    res.status(200).json({requestedId});
   }catch(err){
        console.error("this error occured:",err);
        res.status(500).json({error:"failed to get request "})
   }
}
module.exports = {givePostrequest,createNewReq,acceptReq,getRequestById,returnReqRec,returnLeased};
