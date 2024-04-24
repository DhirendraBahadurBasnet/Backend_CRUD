import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import  jwt  from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async(userId)=>{
   try {
      const user = await User.findById(userId)
      const accessToken = user.generateAccessToken()
      const refreshToken = user.generateRefreshToken()

      //save in db
      user.refreshToken = refreshToken
      await user.save({validateBeforeSave: false})

      return{accessToken, refreshToken}


   } catch (error) {
      throw new ApiError(500, "Something went wrong while generating refresh and access token")
      
   }
}

const registerUser = asyncHandler(async (req, res) => {
  //get user details from frontend
  //validation - not empty
  //check if user already exists:usrname, email
  //check for images, check for avatar
  //upload them to cloudinary ,avatar
  //create user object -create entry in db
  //remmove password and refresh token field from response
  //check for user creation
  //return response

  const {fullname,  email, username, password } = req.body;
//   console.log("email:", email);
//   console.log("username:", username);


  if (
    [ fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    //some returns true
    throw new ApiError(400, "All fields  are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
});

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

 const avatarLocalPath = req.files?.avatar[0]?.path
// const coverImageLocalPath = req.files?.coverImage[0]?.path
// const coverImageLocalPath = req.files?.coverImage.map(file => file.path)
let coverImageLocalPath
if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0 ){
   coverImageLocalPath =req.files.coverImage[0].path
}

if(!avatarLocalPath){
   throw new ApiError(400, "Avatar file is required")
}
const avatar = await uploadOnCloudinary(avatarLocalPath)
 const coverImage = await uploadOnCloudinary(coverImageLocalPath)
 //upload multiple coverImage
// const coverImage = await Promise.all(coverImageLocalPath.map(async (path) => {
//    return await uploadOnCloudinary(path);
// }));

 if(!avatar){
    throw new ApiError(400, "Avatar file is required")
 }

 const user = await User.create({
    fullname,
    avatar:avatar.url,
    coverImage:coverImage?.url || "",
   // coverImage: coverImage.map(image => image.url),
    email,
    password,
    username:username.toLowerCase()
 })
console.log(user)
 const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
 )
 if(!createdUser){
    throw new ApiError(500, 'Something went wrong while registering the user')
 }
 return res.status(201).json(
    new ApiResponse(200, createdUser, "user registered successfully")
 )

});

const loginUser = asyncHandler(async (req, res)=>{
   // req.body -> data
   // username or email
   //find the user
   //password check
   //access and refresh token 
   //send cookie

   const {email, username, password} = req.body
   if(!(username || email)){
      throw new ApiError(400, "username or email is required")
   }
   // if(!(username && email)){
   //    throw new ApiError(400, "username and email is required")
   // }
   const user = await User.findOne({
      $or:[{username}, {email}]
   })

   if(!user){
      throw new ApiError(404, 'User does not exist')
   }
   const isPasswordValid = await user.isPasswordCorrect(password)
   if(!isPasswordValid){
      throw new ApiError(401, "Password is incorrect")
   }

   const {accessToken, refreshToken} =await generateAccessAndRefreshTokens(user._id)
   const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

   //setting cookies
   const options ={
      httpOnly: true,
      secure: true
   }
   return res.status(200)
   .cookie("accessToken", accessToken, options)
   .cookie("refreshToken", refreshToken, options)
   .json(
      new ApiResponse(
         200,
         {
            user:loggedInUser, accessToken, refreshToken
         },
         "User logged in Successfully"
      )
   )
})
const logoutUser = asyncHandler(async(req,res)=>{
   await User.findByIdAndUpdate(
      req.user._id,
      {
         $set:{
            refreshToken:undefined
         }
      },
      {
         new: true
      }
   )
   const options ={
      httpOnly: true,
      secure: true
   }
   return res.status(200)
   .clearCookie("accessToken", options)
   .clearCookie("refreshToken", options)
   .json(
      new ApiResponse(200, {}, "User logged Out")
   )
})

const refreshAccessToken = asyncHandler(async (req, res)=>{
   const incomingRefreshToken= req.cookies.refreshToken || req.body.refreshToken

   if(!incomingRefreshToken){
      throw new ApiError(401, "unauthorized request")
   }
   try {
      const decodedToken = jwt.verify(
         incomingRefreshToken,
         process.env.REFRESH_TOKEN_SECRECT
      )
      const user = await User.findById(decodedToken?._id)
      
      if(!user){
         throw new ApiError(401, "Invalid refresh token")
      }
   
      if(incomingRefreshToken !== user?.refreshToken){ //req ma akko token ra user ma bako token 
         throw new ApiError(401, "Refresh token is expired or used")
      }
   
      const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
      const options =
      {
         httpOnly:true,
         secure:true
      }
   
      return res.status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
         new ApiResponse(
            200,
            {accessToken, newRefreshToken},
            "Access token refreshed"
         )
      )
   } catch (error) {
      throw new ApiError(401, error?.message || "Invalid refresh token")
      
   }

})

const changeCurrentPassword = asyncHandler (async(req, res)=>{
   const { oldPassword, newPassword} = req.body
   // const { oldPassword, confPassword newPassword} = req.body
   // if(!(newPassword == confPassword)){
   //    throw new ApiError(400, "pass invalid")
   // }

   const user= await User.findById(req.user?._id)
    isPasswordCorrect= await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
      throw new ApiError(400, "Invalid old password")
    }
    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res.status(200).json(new ApiResponse(200, {}, "Password changed succesfully"))
})

const getCurrentUser = asyncHandler(async(req, res)=>{
   return res.status(200).json(new ApiResponse(200, req.user, "current user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req, res)=>{
   const {email, fullname} = req.body

   // if(!fullname || !email){
   //    throw new ApiError(400, "all fileds are required")
   // }
   if(!(fullname || email)){
      throw new ApiError(400, "fullname or email  is required required")
   }
  const user = await User.findByIdAndUpdate(
   req.user?._id,
      {
         $set:{
            fullname,
            email:email
         }
      },
      {new:true}
   ).select("-password")

   return res.status(200).json(new ApiResponse(200, user, "Account details updated succesfully"))
})

const updateUserAvatar = asyncHandler(async(req,res)=>{
   const avatarLocalPath = req.file?.path

   if(!avatarLocalPath){
      throw new ApiError(400,"Avatar fie is missing")
   }
   //delete old image- garna baki

   const avatar = await uploadOnCloudinary(avatarLocalPath)
   if(!avatar.url){
      throw new ApiError(400,"Error while uploading on avatar")
   }

   const user = await User.findByIdAndUpdate(req.user?._id,
      {
         $set:{
            avatar:avatar.url
         }
      },
      {new:true}
   ).select("-password")
   return res.status(200).json(new ApiResponse(2200, user, "avatar updated successfully"))

})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
   const coverImageLocalPath = req.file?.path

   if(!coverImageLocalPath){
      throw new ApiError(400,"Cover Image fie is missing")
   }

   const cover = await uploadOnCloudinary(avatarLocalPath)
   if(!coverImage.url){
      throw new ApiError(400,"Error while uploading on cover Image")
   }

   const user = await User.findByIdAndUpdate(req.user?._id,
      {
         $set:{
            coverImage:coverImage.url
         }
      },
      {new:true}
   ).select("-password")
   return res.status(200).json(new ApiResponse(2200, user, "coverimage updated successfully"))
})

const getUserChannelProfile = asyncHandler(async(req, res)=>{
const {username} = req.params
if(!username?.trim()){
   throw new ApiError(400, "username is missing")}

   const channel = await User.aggregate([
      {
         $match:{
            username:username?.toLowerCase()
         }
      },
      {
         // channel ma kati jana subscriber xa 
         $lookup:{
            from:"subscriptions",
            localField:"_id",
            foreignField:"channel",
            as:"subscribers"
         }
      },
      {
         //channel le kati jana subscribe gareko xa
         $lookup:{
            from:"subscriptions",
            localField:"_id",
            foreignField:"subscriber",
            as:"subscribedTo"
         }
      },
      {
         $addFields:{
            subscribersCount:{
               $size:"$subscribers"
            },
            channelSubscribedToCount:{
               $size:"$subscribedTo"
            },
            isSubscribed:{
              $cond:{ if:{$in:[req.user?._id, "$subscribers.subscriber"]},  //goto subscriber and checks if user is present or not
              then:true,
              else:false
            }
         }
         }
      },
      {
         $project:{
            fullname:1,
            username:1,
            subscribersCount:1,
            channelSubscribedToCount:1,
            isSubscribed:1,
            avatar:1,
            coverImage:1,
            email:1

         }
      }
   ])
   if(!channel?.length>0){
      throw new ApiError(404, "channel doesnot exists")
   }
   return res.status(200).json(new ApiResponse(200, channel[0], "User channel fetched successfully"))


})

const getWatchHistory = asyncHandler(async(req, res)=>{
   const user = await User.aggregate([
      {
         $match:{
            _id:new mongoose.Types.ObjectId(req.user._id),//when using aggregate mongoose doesnot directly change objectid string so we use this
         }
      },
      {
         $lookup:{
            from:"videos",
            localField:"watchHistory",
            foreignField:"_id",
            as:"watchHistory",
            pipeline:[
               {
                  $lookup:{
                     from:"users",
                     localField:"owner",
                     foreignField:"_id",
                     as:"owner",
                     pipeline:[
                        {
                           $project:{
                              fullname:1,
                              username:1,
                              avatar:1,

                           }
                        }
                     ]
                  }
               },
               {
                  $addFields:{
                     owner:{
                        $first:"$owner"
                     }
                  }
               }
            ]

         }
      }
   ])

return res.status(200).json(new ApiResponse(200, user[0].getWatchHistory,"Watch history fetched successsfully"))
})
export { registerUser,
    loginUser,
     logoutUser,
      refreshAccessToken,
      changeCurrentPassword,
       getCurrentUser,
       updateAccountDetails,
       updateUserAvatar,
       updateUserCoverImage, 
       getUserChannelProfile,
      getWatchHistory };
