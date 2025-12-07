import {User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";   
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";




const generateAccessAndRefreshToken = async(userId)=>{
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave:false});
        return {accessToken,refreshToken};
    }
    catch(error){
        throw new ApiError(500,"Token generation failed")
    }

}

const registerUser = asyncHandler(async(req,res)=>{
    //get user details from frontend
    //validation - not empty
    //check if user already exits
    //check for images, check for avatar
    //upload them to cloudinary,avatar
    //create user object- create a new user in db
    //remove password and refresh token from response
    //check for user created successfully
    //send response
// console.log("headers:", req.headers);
    const { fullName, email, password, username } = req.body;
    console.log("Email from body:", email);

    if([fullName,email,password,username].some((field)=>!field || field.trim()==="")){
        throw new ApiError(400,"All fields are required")
    }

    const existedUser = await User.findOne({
        $or:[{username},{email}]
    })

    if(existedUser){
        throw new ApiError(409,"User already exists with this email or username")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
   // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }   

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = coverImageLocalPath ? await uploadOnCloudinary(coverImageLocalPath) : null;

    if(!avatar){
        throw new ApiError(500,"Avatar upload failed")
    }

    const user = await User.create({
        fullName,
        avatar:avatar.url,
        coverImage: coverImage?.url || "",
        email,
        username:username.toLowerCase(),
        password
    })
    
    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if(!createdUser){
        throw new ApiError(500,"User creation failed")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered successfully")
    )

})

const loginUser = asyncHandler(async(req,res)=>{
    const {username,email,password} = req.body;

    if(!username && !email){
        throw new ApiError(400,"Username or Email is required")
    }
    if(!password || password.trim()===""){
        throw new ApiError(400,"Password is required")
    }

    const user = await User.findOne({
        $or : [{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"User not found")
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid credentials")
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const cookieOptions = {
        httpOnly:true,
        secure:true
    }

    return res.status(200)
    .cookie("refreshToken",refreshToken,cookieOptions)
    .cookie("accessToken",accessToken,cookieOptions)
    .json(
        new ApiResponse(200, {user:loggedInUser,accessToken,refreshToken}, "User logged in successfully")
    )

})

const logoutUser = asyncHandler(async(req,res)=>{
    const userId = req.user._id;

    const user = await User.findByIdAndUpdate(userId,
        {
            $set : {
                refreshToken : undefined
            }
        },
        {
            new:true
        }
    );

    const cookieOptions = {
        httpOnly:true,
        secure:true
    }

    return res.status(200)
    .clearCookie("accessToken",cookieOptions)
    .clearCookie("refreshToken",cookieOptions)
    .json(new ApiResponse(200, {}, "User logged out successfully"))

})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(400, "Refresh token is required");
    }

    const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (user.refreshToken !== incomingRefreshToken) {
        throw new ApiError(401, "Invalid refresh token");
    }

    const { accessToken, refreshToken: newRefreshToken } =
        await generateAccessAndRefreshToken(user._id);

    // IMPORTANT: Save new refresh token
    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    const cookieOptions = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .cookie("refreshToken", newRefreshToken, cookieOptions)
        .cookie("accessToken", accessToken, cookieOptions)
        .json(
            new ApiResponse(
                200,
                { accessToken, refreshToken: newRefreshToken },
                "Access token refreshed successfully"
            )
        );
});

const getUser = asyncHandler(async(req,res)=>{
    const userId = req.user._id;
    const user = await User.findById(userId).select("-password -refreshToken");

    if(!user){
        throw new ApiError(404,"User not found")
    }

    return res.status(200).json(
        new ApiResponse(200,user,"User fetched successfully")
    )
})

const changePassword = asyncHandler(async(req,res)=>{
    const userId = req.user._id;    
    const {oldPassword,newPassword} = req.body;
    const user = await User.findById(userId);

    if(!user){
        throw new ApiError(404,"User not found")
    }

    const isOldPasswordValid = await user.isPasswordCorrect(oldPassword);

    if(!isOldPasswordValid){
        throw new ApiError(401,"Old password is incorrect")
    }

    user.password = newPassword;
    await user.save({validateBeforeSave:false});

    return res.status(200).json(
        new ApiResponse(200,{},"Password changed successfully")
    )
})


const updateUser = asyncHandler(async(req,res)=>{
    const userId = req.user._id;    
    //get user details from req.body
    const {email,fullName} = req.body;
    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: {email, fullName} },
        { new: true }
    ).select("-password -refreshToken");    
    if(!updatedUser){
        throw new ApiError(500,"User update failed")
    }
    return res.status(200).json(
        new ApiResponse(200,updatedUser,"User updated successfully")
    )
})

const updateUserAvatar = asyncHandler(async(req,res)=>{
    const userId = req.user._id;    
    const avatarLocalPath = req.file?.path; 
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is required")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)    
    if(!avatar){
        throw new ApiError(500,"Avatar upload failed")
    }
    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: { avatar: avatar.url } },
        { new: true }   
    ).select("-password -refreshToken");
    if(!updatedUser){
        throw new ApiError(500,"User update failed")
    }   
    return res.status(200).json(
        new ApiResponse(200,updatedUser,"User avatar updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const userId = req.user._id;    
    const coverImageLocalPath = req.file?.path;     
    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover image is required")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)    
    if(!coverImage){
        throw new ApiError(500,"Cover image upload failed")
    }
    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: { coverImage: coverImage.url } },
        { new: true }   
    ).select("-password -refreshToken");
    if(!updatedUser){
        throw new ApiError(500,"User update failed")
    }       
    return res.status(200).json(
        new ApiResponse(200,updatedUser,"User cover image updated successfully")
    )
})



export {registerUser, loginUser, logoutUser, refreshAccessToken, getUser, changePassword, updateUser, updateUserAvatar, updateUserCoverImage};