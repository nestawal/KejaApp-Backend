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


const createNewReq = async(req,res)=>{
    
    try{
        const postId =req.body.postId
        const personId =req.body.personId
        const months = req.body.months
        const name = req.body.name
        console.log('postId:', postId, 'Length:', postId?.length);


        const doc = await reqModel.findOne({ postId: postId });
        console.log("Matched doc:", doc);

        

        const newPending ={
            pendingUserId : personId,
            months : months,
            name: name
        }

        const result = await reqModel.updateOne(
            {postId: postId},
            {$push : {pending: newPending}}
        );

        const reqPost = new mongoose.Types.ObjectId(postId)

        let reqRec = await reqRecModel.findOne({personId : personId})

        if(!reqRec){
            reqRec = await reqRecModel.create({
            personId : personId,
            personEmail : name,
            requests : [{reqPost}]
        })
        }
        else{
            reqRec = await reqRecModel.findByIdAndUpdate(
            personId,
            {$push : {requests : reqPost }},
            {new: true}
        )
        }
        

        res.status(200).json({message:"succesful update",result});
        if(result.modifiedCount > 0){
            console.log("Succesfully updated")
        }else{
            console.log("failed update")
        }
        
    }catch(err){
        console.error("this error occured:",err);
        res.status(500).json({error:"failed to update pending "})
    }
}

const returnReqRec = async(req,res)=>{
    try{
        const conn = mongoose.connection;
        const bucket = new GridFSBucket(conn.db,{
            bucketName : 'uploads'
        });
        
        const {id} = req.params
        

        const myReqRec = await reqRecModel.findOne({personId : id})
        console.log(myReqRec.requests)

        let reqPosts = myReqRec.requests
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
