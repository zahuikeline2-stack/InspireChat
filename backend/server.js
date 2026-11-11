
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();

// Adresse du frontend
const FRONTEND_URL =
    process.env.FRONTEND_URL || "http://localhost:5173";

// Configuration CORS pour Express
app.use(cors({
    origin: FRONTEND_URL,
    methods: ["GET", "POST"]
}));

app.use(express.json());

// Création du serveur HTTP
const server = http.createServer(app);

// Configuration de Socket.IO
const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL,
        methods: ["GET", "POST"]
    }
});

// Route d'accueil
app.get("/", (req, res) => {
    res.send("Bienvenue sur InspireChat !");
});

// Connexion des utilisateurs
io.on("connection", (socket) => {

    console.log("Utilisateur connecté :", socket.id);

    // Réception et diffusion des messages
    socket.on("message", (donnees) => {

        // Vérification des données reçues
        if (
            !donnees ||
            typeof donnees.pseudo !== "string" ||
            typeof donnees.texte !== "string" ||
            !donnees.pseudo.trim() ||
            !donnees.texte.trim()
        ) {
            return;
        }

        const message = {
            id: Date.now() + Math.random(),
            pseudo: donnees.pseudo.trim(),
            texte: donnees.texte.trim(),
            date: new Date().toISOString()
        };

        // Envoyer le message à tous les utilisateurs
        io.emit("message", message);

        console.log(`${message.pseudo} : ${message.texte}`);
    });

    // Déconnexion d'un utilisateur
    socket.on("disconnect", () => {
        console.log("Utilisateur déconnecté :", socket.id);
    });

});

// Port fourni par Railway ou port 3000 en local
const PORT = process.env.PORT || 3000;

// Démarrage du serveur
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Serveur InspireChat démarré sur le port ${PORT}`);
});
