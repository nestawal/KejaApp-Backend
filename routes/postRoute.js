const express = require("express");
const app = express();
app.use('/uploads',express.static("uploads"));
const Controller = "../controllers/postController.js"
const router = express.Router();
const { upload, createPost, getImage  ,getPostFeed,getMyPosts,getPostwithId } = require(Controller); // Adjust the path if necessary



router.post("/publish",upload.single("image"),createPost);

router.get('/image/:id', getImage);

router.get('/feed',getPostFeed);

router.post('/yourPosts',getMyPosts);

router.get('/:id',getPostwithId);

//write get post

module.exports = router;