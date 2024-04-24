// require('dotenv').config({path:'./.env'})
// import { Mongoose } from "mongoose";
// import { DB_Name } from "./constants";
import dotenv from "dotenv"
import { app } from './app.js'
import connectDB from "./db/index.js";

dotenv.config({
    path:'./.env'
})

connectDB()
.then(()=>{
    app.listen(process.env.PORT || 8000 ,()=>{
        console.log(`Server is running at port: ${process.env.PORT}`)
    })
})
.catch((error)=>{
    console.log('MONGODB connection failed!!', error)
})


























// import express from "express"
// const app = express()
// ( async()=>{
//     try{
//         await Mongoose.connect(`${process.env.MONGODB_URL}/${DB_Name}`)
//         app.on("error",(error)=>{
//             console.log("ERR:", error)
//             throw error
//         })
//         app.listen(process.env.PORT, ()=>{
//             console.log(`APP is listening on port ${process.env.PORT}`)
//         })
//     }
//     catch(error){
//         console.log("ERROR:", error)
//     }
// })()