import { Router } from "express";
import { registerUser, loginUser, logoutUser, refreshAccessToken, getUser, changePassword, updateUser, updateUserAvatar, updateUserCoverImage  } from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
    upload.fields([
        {name:"avatar",maxCount:1},
        {name:"coverImage",maxCount:1}
    ]),
    registerUser
)
router.route("/login").post(loginUser);
//secured routes

router.route("/logout").post(verifyJWT,logoutUser);
router.route("/refresh-token").get(verifyJWT,refreshAccessToken);
router.route("/me").get(verifyJWT,getUser);
router.route("/change-password").post(verifyJWT,changePassword);
router.route("/update").put(verifyJWT,updateUser);
router.route("/update-avatar").put(verifyJWT,upload.single("avatar"),updateUserAvatar);
router.route("/update-cover-image").put(verifyJWT,upload.single("coverImage"),updateUserCoverImage);


export default router;