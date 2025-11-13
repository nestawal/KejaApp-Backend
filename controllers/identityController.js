const idmodel = "../schemas/identityModel";
const Identitymodel = require(idmodel);
const Cart = require("../schemas/cartModel");
const reqRec = require("../schemas/reqRecModel")



const createIdentity = async(req,res) =>{
    try{
        //create new identity
        const newId = await Identitymodel.create(req.body)

        //create identity cart
        const newCart = await Cart.create({
            email: newId.email,
            items: []
        })

        const newReqRec = await reqRec.create({
            personId : newId._id,
            personName : newId.name,
            requests: []
        })

        await newReqRec.save();

        res.json({
            user: newId,
            cart: newCart
        })

        
    }
    catch(err){  res.status(500).json({ error: err.message });}
};

const checkIdentity =(req,res)=>{
    const{email,password}= req.body
    Identitymodel.findOne({email: email})
    .then(person=>{
       if(person){
        if(person.password === password){
            res.json({status:"found",person})
        }else{
            res.json("wrong password")
        }
       }else{
        res.json("nowhere to be found")
       }
    })
    .catch(err => res.json(err))
};

const isAdmin=(req,res)=>{
    const{email} = req.body
    Identitymodel.findOne({email : email})
    .then(person=>{
        if(person){
            if(person.agent === true){
                res.json("user is registered as agent")
            }else{
                res.json("Do U want to sign is as an agent?")
            }
        }else{
            res.json("person not in the system")
        }
    })
    .catch(err => res.json(err))
};

//useless function,ignore
const getNameForId = async(req,res)=>{
    try{
        const {id} = req.params

        await Identitymodel.findOne({_id: id})
            .then(data=>{
                res.status(200).json(data.name)
            })
    }catch(err){
        console.error("this error occured:",err);
        res.status(500).json({error:"failed to get request "})
    }
}



module.exports = {
    createIdentity,
    checkIdentity,
    isAdmin,
    getNameForId
};