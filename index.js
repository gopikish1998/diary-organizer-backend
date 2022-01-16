const express = require("express");
const app = express();
const cors = require('cors');
const mongodb = require("mongodb");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoClient = mongodb.MongoClient;
const dotenv = require("dotenv")
dotenv.config();
const url = process.env.DB;
const PORT = process.env.PORT || 4000;
const nodemailer=require("nodemailer")
app.use(cors({
    origin: "*"
}))

app.use(express.json());

function authenticate(req, res, next) {
    try {
    // Check if the token is present
    // if present -> check if it is valid
    if(req.headers.authorization){
        jwt.verify(req.headers.authorization,process.env.JWT2,function(error,decoded){
            if(error){
                res.status(500).json({
                    message: "Unauthorized"
                })
            }else{
                console.log(decoded)
                req.userid = decoded.id;
                next()
            }
            
        });
      
    }else{
        res.status(401).json({
            message: "No Token Present"
        })
    }
    } catch (error) {
        console.log(error)
        res.status(500).json({
            message: "Internal Server Error"
        })
    }
    
}
app.put('/setpassword',async function(req,res){
    try {
        let client=await mongoClient.connect(url);
        let db = await client.db("diary");
        let salt = bcryptjs.genSaltSync(10);
        let hash = bcryptjs.hashSync(req.body.password, salt)
        req.body.password = hash;
        let user = await db.collection("users").findOne({email:req.body.email,forgot:true});
        console.log(user)
        if(user){
        await db.collection("users").findOneAndUpdate({email:req.body.email,forgot:true},{$set:{password:req.body.password,forgot:false}});
        client.close();
        res.json({
            message:true
        })
        }
        else{
            res.json({
                message:false
            })
        }
        
        
    } catch (error) {
        res.json("Either reset email not verified or user not found")
    }
})
app.get('/reset/:token',async function(req,res){
    try {
        jwt.verify(req.params.token,process.env.JWT_SECRET,async function(error,decoded){
            let client = await mongoClient.connect(url)
            let db = client.db("diary");
            let user = await db.collection("users").findOne({_id:mongodb.ObjectId(decoded.id)});
           
            if(user){
                await db.collection("users").findOneAndUpdate({_id:mongodb.ObjectId(decoded.id)},{$set:{forgot:true}});
                res.redirect(`${process.env.fronthost}/reset`)
            }            
            else{
                res.json({
                    message:"Wrong token"
                })
            }
        })
    } catch (error) {
        console.log(error)
    }
})
app.post('/forgot',async function(req,res){
    try {
        let client = await mongoClient.connect(url)

        // Select the DB
        let db = client.db("diary");
        let email = await db.collection("users").findOne({email:req.body.email});
        if(!email){
            console.log(req.body.email)
            await client.close();
            // console.log("User not Exists")
            res.json({
                message:false
            })
        }
        else{
            console.log(email)
            let token = jwt.sign({ id: email._id }, process.env.JWT_SECRET)
        let data = await db.collection("users").findOneAndUpdate({email:req.body.email},{$set:{token,forgot:false}})
        // Close the Connection
        await client.close();
        
        // console.log(data.insertedId)
        let transporter = nodemailer.createTransport({
            service:"hotmail",
            auth: {
              user: process.env.user, 
              pass: process.env.pass,
            }})
            let url = `${process.env.host}/reset/${token}`
            await transporter.sendMail({
            from:process.env.user,
            to:req.body.email,
            subject:"Reset Password!",
            html:`<h1>Hey there!</h1>
            Forgot password? Reset here: <a href=${url}>${url}</a>`
        })
        console.log("Email sent")
        res.json({
            message: true
        })}
    } catch (error) {
        console.log(error)
    }
})
app.post('/addevent',[authenticate],async function(req,res){
    try {
        let client = await mongoClient.connect(url);
        let db = client.db("diary");
        await db.collection("events").insertOne({event:req.body.event,description:req.body.description,date:req.body.date,userid:req.userid})
        client.close();
        res.json({
            message:"Event Added"
        })
    } catch (error) {
        res.status(500).json({
            message:"Server Error"
        })  
    }
})
app.post('/addnote',[authenticate],async function(req,res){
    try {
        let client = await mongoClient.connect(url);
        let db = client.db("diary");
        await db.collection("notes").insertOne({date:req.body.date,description:req.body.description,userid:req.userid,title:req.body.title})
        client.close();
        res.json({
            message:"note Added"
        })
    } catch (error) {
        res.status(500).json({
            message:"Server Error"
        })  
    }
})
app.get('/notes',[authenticate],async function(req,res){
    try {
        let client = await mongoClient.connect(url);
        let db = client.db("diary");
        let data = await db.collection("notes").find({userid:req.userid}).toArray()
        client.close();
        res.json(data)
    } catch (error) {
        console.log(error)
    }
})
app.get('/note/:id',[authenticate],async function(req,res){
    try {
        let client = await mongoClient.connect(url);
        let db = client.db("diary");
        let data = await db.collection("notes").findOne({userid:req.userid,_id:mongodb.ObjectId(req.params.id)}) 
        client.close();
        res.json(data)
    } catch (error) {
        console.log(error)
    }
})
app.get('/event/:id',[authenticate],async function(req,res){
    try {
        let client = await mongoClient.connect(url);
        let db = client.db("diary");
        let data = await db.collection("events").findOne({userid:req.userid,_id:mongodb.ObjectId(req.params.id)}) 
        client.close();
        res.json(data)
    } catch (error) {
        console.log(error)
    }
})
app.get('/events',[authenticate],async function(req,res){
    try {
        let client = await mongoClient.connect(url);
        let db = client.db("diary");
        let data = await db.collection("events").find({userid:req.userid}).toArray()
        console.log(data)
        client.close();
        res.json(data)
    } catch (error) {
        console.log(error)
    }
})

// app.get('/search/:search', async function(req,res){
//     try {
//         let client = await mongoClient.connect(url);
//         let db = client.db("diary");
//         let data = await db.collection("recipes").find({recipe:{$regex:req.params.search,$options: "xi"}}).toArray()
//         client.close();
//         res.json(data)
//     } catch (error) {
//         console.log(error)
//     }
// })
// app.get('/recipe/:id',[authenticate],async function(req,res){
//     try {
//         let client = await mongoClient.connect(url);
//         let db = client.db("diary");
//         let data = await db.collection("recipes").findOne({_id:mongodb.ObjectId(req.params.id)})
//         client.close();
//         res.json(data)
//     } catch (error) {
//         console.log(error)
//     }
// })
// app.delete('/deleterecipe/:id',[authenticate],async function(req,res){
//     try {
//         let client = await mongoClient.connect(url)
//         let db = client.db("diary");
//         let data=await db.collection("recipes").deleteOne({userid:req.userid,_id:mongodb.ObjectId(req.params.id)});
//         res.json({
//             message:"recipe Deleted"
//         })
//     } catch (error) {   
//         console.log(error)

//     }
// })
app.put('/editnote/:id',[authenticate],async function(req,res){
    try {
        let client = await mongoClient.connect(url);
        let db = client.db("diary");
        console.log(req.body.description)
        const data= await db.collection("notes").findOneAndUpdate({_id:mongodb.ObjectId(req.params.id)},{$set:{date:req.body.date,description:req.body.description,title:req.body.title}})
        client.close();
        console.log(data)
        res.json({
            message:"Updated"
        })
    } catch (error) {
        res.status(500).json({
            message:"Server Error"
        })  
    }
})
app.put('/editevent/:id',[authenticate],async function(req,res){
    try {
        let client = await mongoClient.connect(url);
        let db = client.db("diary");
        await db.collection("notes").findOneAndUpdate({_id:mongodb.ObjectId(req.params.id),userid:req.userid},{$set:{event:req.body.event,description:req.body.description,date:req.body.date}})
        client.close();
        res.json({
            message:"Updated"
        })
    } catch (error) {
        res.status(500).json({
            message:"Server Error"
        })  
    }
})
// app.post('/additem',[authenticate],async function(req,res){
//     try {
//         let client = await mongoClient.connect(url);
//         let db = client.db("diary");
//         await db.collection("items").insertOne({item:req.body.item,qty:req.body.qty,unit:req.body.unit,userid:req.userid})
//         client.close();
//         res.json({
//             message:"Added"
//         })
//     } catch (error) {
//         res.status(500).json({
//             message:"Server Error"
//         })  
//     }
// })
app.delete('/deleteevent/:id',[authenticate],async function(req,res){
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("diary");
        let data=await db.collection("events").deleteOne({userid:req.userid,_id:mongodb.ObjectId(req.params.id)});
        res.json({
            message:"item Deleted"
        })
    } catch (error) {
        console.log(error)
    }
})
app.delete('/deletenote/:id',[authenticate],async function(req,res){
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("diary");
        console.log(req.params.id)
        let data=await db.collection("notes").deleteOne({_id:mongodb.ObjectId(req.params.id)});
        console.log(data)
        res.json({
            message:"item Deleted"
        })
    } catch (error) {
        console.log(error)
    }
})
// app.get('/items',[authenticate],async function(req,res){
//     try {
//         let client = await mongoClient.connect(url)

//         // Select the DB
//         let db = client.db("diary");

//         let data=await db.collection("items").find({userid:req.userid}).toArray();
//         await client.close();
//         res.json(data)
//         console.log(data)
//     } catch (error) {
//         console.log(error)
//     }
// })
// app.get('/items/:id',[authenticate],async function(req,res){
//     try {
//         let client = await mongoClient.connect(url)
//         let db = client.db("diary");
//         let data=await db.collection("items").findOne({userid:req.userid,_id:mongodb.ObjectId(req.params.id)});
//         await client.close();
//         res.json(data)
//         console.log(data)
//     } catch (error) {
//         console.log(error)
//     }
// })
app.get('/user',[authenticate],async function(req,res){
    try {
        let client = await mongoClient.connect(url)

        // Select the DB
        let db = client.db("diary");

        let data=await db.collection("users").findOne({_id:mongodb.ObjectId(req.userid)});

        await client.close();
        res.json(data)
        console.log(data)
    } catch (error) {
        console.log(error)
    }
})
app.get("/confirm/:token",async function(req,res){
    try {
        jwt.verify(req.params.token,process.env.JWT_SECRET,async function(error,decoded){
            let client = await mongoClient.connect(url)
            let db = client.db("diary");
            let user = await db.collection("users").findOne({_id:mongodb.ObjectId(decoded.id)});
           
            if(user){
                await db.collection("users").findOneAndUpdate({_id:mongodb.ObjectId(decoded.id)},{$set:{verified:true}});
                res.json({
                    message:"Email confirmed"
                })
            }            
            else{
                res.json({
                    message:"Wrong token"
                })
            }
        })
    } catch (error) {
        
    }
})
app.post('/register', async function (req,res){
    try {
        let client = await mongoClient.connect(url)

        // Select the DB
        let db = client.db("diary");

        // Hash the password
        let salt = bcryptjs.genSaltSync(10);
        let hash = bcryptjs.hashSync(req.body.password, salt)
        req.body.password = hash;
        req.body.verified=false;
        // Select the Collection and perform the action
        let email = await db.collection("users").findOne({email:req.body.email});

        if(email){
            await client.close();
            console.log("User Exists")
            let token = jwt.sign({ id: email._id }, process.env.JWT_SECRET)
        // console.log(data.insertedId)
        let transporter = nodemailer.createTransport({
            service:"hotmail",
            auth: {
              user: process.env.user, 
              pass: process.env.pass,
            }})
            let url = `${process.env.host}/confirm/${token}`
            await transporter.sendMail({
            from:process.env.user,
            to:req.body.email,
            subject:"Confirm Email!",
            html:`<h1>Hey there!</h1>
            Verify your account for Recipe-app: <a href=${url}>${url}</a>`
        })
        console.log("Email sent") 
            res.json({
                message:"User already exists"
            })
        }
        else{
        let data = await db.collection("users").insertOne(req.body)
        // Close the Connection
        await client.close();
        let token = jwt.sign({ id: data.insertedId }, process.env.JWT_SECRET)
        // console.log(data.insertedId)
        let transporter = nodemailer.createTransport({
            service:"hotmail",
            auth: {
              user: process.env.user, 
              pass: process.env.pass,
            }})
            let url = `${process.env.host}/confirm/${token}`
            await transporter.sendMail({
            from:process.env.user,
            to:req.body.email,
            subject:"Confirm Email!",
            html:`<h1>Hey there!</h1>
            Verify your account for Recipe-app: <a href=${url}>${url}</a>`
        })
        console.log("Email sent")
        res.json({
            message: "Confirmation Email Sent",
            id: data._id
        })}
    } catch (error) {
        console.log(error)
    }
})
app.post("/login",async function(req,res){
    try {
        // Connect the Database
        let client = await mongoClient.connect(url)

        // Select the DB
        let db = client.db("diary");

        // Find the user with email_id
        let user = await db.collection("users").findOne({ email: req.body.email });

        if (user.verified) {
            // Hash the incoming password
            // Compare that password with user's password
            // console.log(req.body)
            // console.log(user.password)
            let matchPassword = bcryptjs.compareSync(req.body.password, user.password)
            if (matchPassword) {
                // Generate JWT token
                let token = jwt.sign({ id: user._id }, process.env.JWT2)
                res.json({
                    message: true,
                    token,
                    user
                })
            } else {
                res.status(404).json({
                    message: "Username/Password is incorrect"
                })
            }
            // if both are correct then allow them
        } else {
            res.status(404).json({
                message: "User may not have verified"
            })
        }
    } catch (error) {
        console.log(error)
    }

})
app.listen(PORT, function () {
    console.log(`The app is listening in port ${PORT}`)
})