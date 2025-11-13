const express = require("express");
const router = express.Router();
const Controller = "../controllers/cartControler"
const {addToCart} = require(Controller);

router.post("/addToCart",addToCart);

module.exports = router;

