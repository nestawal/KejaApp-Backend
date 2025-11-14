const express =  require("express");
const { isAdmin } = require("../controllers/identityController");
const Controller = "../controllers/identityController"
const router = express.Router();
const {createIdentity,checkIdentity,getNameForId} = require(Controller)


router.post("/signup",createIdentity);
router.post("/login",checkIdentity);
router.post("/isAdmin",isAdmin);
router.get("/:id",getNameForId);

module.exports = router;