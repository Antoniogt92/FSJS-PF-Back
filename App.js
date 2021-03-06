//Requires
const express  = require("express");
const multer   = require("multer");
const cors     = require("cors");
const mongoose = require("mongoose");
const bcrypt   = require("bcrypt");
const jwt      = require("jsonwebtoken");
const path     = require("path");

//CONFIGURAR MONGOOSE ------------------------------------------------------------------------------------------------------

mongoose.connect (
    "mongodb+srv://antoniogt92:4815162342@critic-film-mlbrx.mongodb.net/CRITIC-FILM?retryWrites=true&w=majority", {
        useNewUrlParser    : true,
        useUnifiedTopology : true
    }
);
mongoose.set('useCreateIndex', true);

const Pelicula = require("./models/pelicula");
const User = require("./models/user");

//CONFIGURAR EXPRESS ------------------------------------------------------------------------------------------------------

const app  = express(); // Crear una app de express (app = server = API)

const port = process.env.PORT || 8000; // Definir puerto

app.options("*", cors());
app.use(cors());

app.use(express.json());

app.use("/uploads", express.static("uploads"));

//CONFIGURAR MULTER ------------------------------------------------------------------------------------------------------

function filtro(req, file, cb) {
    if(file.mimetype.slice(0,5)==="image") {
        console.log("el archivo es una imagen");
        cb(null, true);
    }else {
        console.log("el archivo NO es una imagen");
        cb(null, false);
    }
}

const storage = multer.diskStorage({
    "destination" : function(req, file, cb) {
        cb(null, "./uploads");
    },
    "filename" : function(req, file, cb) {
        cb(null, new Date().toISOString() + file.originalname);
    }
});

const maximos = {
    "fileSize" : 5 * 1024 * 1024
};

const upload = multer({
    "storage" : storage,
    "fileFilter" : filtro,
    "limits" : maximos
});

//CONFIGURAR AUTH ----------------------------------------------------------------------------------------------------------------------

const checkAuth = require("./auth/auth");

const jwtKey = (process.env.JWT || "lalala");

const saltRounds = 10;

//ENDPOINTS ----------------------------------------------------------------------------------------------------------------------------

app.post ("/criticfilm", checkAuth, upload.single("poster"), async (req, res) => { //POST subir pelicula

    const pelicula_document = new Pelicula({
        "_id"            : new mongoose.Types.ObjectId(),
        "title"          : req.body.title,
        "year"           : req.body.year,
        "runtime"        : req.body.runtime,
        "country"        : req.body.country,
        "director"       : req.body.director,
        "screenwriter"   : req.body.screenwriter,
        "cinematography" : req.body.cinematography,
        "music"          : req.body.music,
        "cast"           : req.body.cast,
        "genre"          : req.body.genre,
        "synopsis"       : req.body.synopsis,
        "poster"         : path.basename(req.file.path),
        "trailer"        : req.body.trailer
    });

    try {
        const result = await pelicula_document.save();
        console.log("POST OK");
        res.status(200).json({"result" :result });
    }catch(err) {
        console.error(err.stack);
        res.status(500).send("API Error");
    }
});

app.delete("/criticfilm/:id", checkAuth,  async (req, res) => {//DELETE borrar película

    const id = req.params.id;

    try {
        const result = await Pelicula.deleteOne({"_id":id});
        res.status(200).json({"result":"DELETE OK."});
    }catch(err) {
        console.error(err.stack);
        res.status(500).json({"result":"Database Error."});
    }
});

app.get("/criticfilm", async (req, res) => {//GET multiple
    
    try{
        const result = await Pelicula.find({} , "-__v");
        if(result.length>0) {
            console.log("Todo bien!");
            res.status(200).json({"result":result});
        }else {
            console.log("No hay peliculas");
            res.status(500),json({"result":"No hay películas."});
        }
    }catch(err){
        console.error(err.stack);
        res.status(500),json({"result":"Database Error."});
    }
});

app.get("/criticfilm/:id", async (req, res) => {//GET sencillo

    const id = req.params.id;
    
    try{
        const result = await Pelicula.findOne({"_id" : id}, "-__v");
        if(result) {
            console.log("Todo bien!");
            res.status(200).json({"result":result});
        }else {
            console.log("No hay peliculas");
            res.status(500),json({"result":"No hay películas."});
        }
    }catch(err){
        console.error(err.stack);
        res.status(500).json({"result" : "Nelpas, no está"});
    }
});

app.patch("/criticfilm/:id", checkAuth, upload.single("poster"), async (req, res) => {//PATCH Modificar
    const id = req.params.id;

    req.body.poster = path.basename(req.file.path); //agregar el path de la imagen al body

    try{
        const result = await Pelicula.updateOne({"_id" : id}, { $set: req.body });
        if(result) {
            console.log("Todo bien!");
            res.status(200).json({"result":result});
        }else {
            console.log("No se pudo :(");
            res.status(500).json({"result":"No se pudo"});
        }
    }catch(err){
        console.error(err.stack);
        res.status(500).json({"result" : "No se pudo"});
    }
});

//AUTH ----------------------------------------------------------------------------------------------------------------------------

async function findDupUser(email) {

    const userfound = {};

    try {

        userfound["user"] = await User.findOne({ "email": email });

        if(!userfound["user"]) {

            userfound["success"] = true;

            console.log("El email es válido.");
        } else {

            userfound["user"] = `Un usuario con el email ${email} ya existe.`;
            userfound["success"] = false;

            console.log(userfound["user"]);
        }
    }catch (err) {

        userfound["user"] = "Signup failed";
        userfound["success"] = false;

        console.error(err.stack);
        //console.error("Algo tronó al validar el email...");
    }

    return userfound;
}

async function hashAndSalt(pass) {

    const hashedpass = {};

    try {

        hashedpass["pass"] = await bcrypt.hash(pass, saltRounds);
        hashedpass["success"] = true;

        console.log("Contraseña hasheada exitosamente.");
    }catch(err) {

        hashedpass["pass"] = "Signup failed";
        hashedpass["success"] = false;

        console.error(err.stack);
        //console.error("Algo tronó al hashear la contraseña...");
    }

    return hashedpass;
}

async function postNewUser(email, pass) {

    const postresult = {};

    const user = new User({
        "_id"   : new mongoose.Types.ObjectId(),
        "email" : email,
        "pass"  : pass
    });

    try {

        postresult["result"] = await user.save();
        postresult["success"] = true;

        console.log(postresult["result"]);
    }catch(err) {

        postresult["result"] = "Signup failed";
        postresult["success"] = false;

        console.error(err.stack);
        //console.error("Algo tronó al insertar el usuario...");
    }

    return postresult;
}

async function signupHandler(req, res) {

    //Validar si un usuario con el mismo email no existe ya

    const valid_email = await findDupUser(req.body.email);

    if(!valid_email.success) {
        res.status(409).json({ "error": valid_email.user });
        return;
    }

    //Hashear y salar la contraseña

    const securePass = await hashAndSalt(req.body.pass);

    if(!securePass.success) {
        res.status(409).json({ "error": securePass.pass });
        return;
    }

    //Guardar el usuario en la DB

    const postResult = await postNewUser(req.body.email, securePass.pass);

    if(!postResult.success) {
        res.status(409).json({ "error": postResult.result });
        return;
    }

    //Sólo si todo lo anterior salió bien, llegamos aquí.

    console.log("Nuevo usuario guardado.");
    res.status(201).json({ "result": "POST OK." });
    return;
}

app.post("/signup", signupHandler);

//----------------------------------------

app.post("/login", async (req, res) => { //loginx|x|

    try {

        const user = await User.findOne({ "email": req.body.email });

        if(user) {

            try {

                const result = await bcrypt.compare(req.body.pass, user.pass);

                if (result) {

                    const jwtPayload = {
                        "email": user.email,
                        "id": user._id
                    }

                    const jwtConfig = { "expiresIn": "1h" };

                    jwt.sign(jwtPayload, jwtKey, jwtConfig, (err, token) => {

                        if(!err) {
                            console.log("Login exitoso.");
                            res.status(200).json({ "result": "Login Exitoso.", "token": token });
                            return;
                        }else {
                            console.error(err.stack);
                            res.status(401).json({ "error": "Auth failed." }); //en realidad es error 500
                            return;
                        }
                    });
                }else {
                    console.log("Contraseña incorrecta.");
                    res.status(401).json({ "error": "Wrong password." });
                    return;
                }
            }catch(err) {
                console.error(err.stack);
                res.status(401).json({ "error": "Auth failed." }); //en realidad es error 500
                return;
            }
        }else {
            console.log("No hay usuarios con ese email.");
            res.status(401).json({ "error": "User not found." });
            return;
        }
    }catch(err) {
        console.error(err.stack);
        res.status(401).json({ "error": "Auth failed." }); //en realidad es error 500
        return;
    }
});

app.get("/testauth", checkAuth, (req, res) =>{
    res.status(200).json({"result" : "¡Bienvenid@!"});
});

//GENERIC ----------------------------------------------------------------------------------------------------------------------------

app.all("*", (req, res) => {
    res.status(200).send("Holamundo!\n");
});

app.listen (port, () => {
    console.log (`Escúchame we ${port}`);
});

//eof
