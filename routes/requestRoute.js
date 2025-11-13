const express = require("express");
const router = express.Router();
const {givePostrequest,createNewReq,acceptReq,getRequestById,returnReqRec,returnLeased} = require("../controllers/requestController")

router.post("/giverequestSec",givePostrequest);
router.patch("/addNewreq",createNewReq);
router.patch("/acceptReq",acceptReq)
router.get("/getRequest/:id",getRequestById);
router.get("/returnReq/:id",returnReqRec);
router.get("/returnLeased/:id",returnLeased);

module.exports = router;
