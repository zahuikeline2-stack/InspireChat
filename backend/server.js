
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();

// Adresse du frontend
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(cors({
    origin: FRONTEND_URL
}));

app.use(express.json());

const server = http.createServer(app);

// Configuration Socket.IO
const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL,
        methods: ["GET", "POST"]
    }
});

// Accueil du serveur
app.get("/", (req, res) => {
    res.send("Bienvenue sur InspireChat !");
});

// Connexion des utilisateurs
io.on("connection", (socket) => {

    console.log("Utilisateur connecté :", socket.id);

    // Recevoir un message
    socket.on("message", (donnees) => {

        if (!donnees.pseudo || !donnees.texte) {
            return;
        }

        const message = {
            id: Date.now() + Math.random(),
            pseudo: donnees.pseudo,
            texte: donnees.texte,
            date: new Date().toISOString()
        };

        // Diffuser le message à tous les utilisateurs
        io.emit("message", message);

        console.log(message.pseudo, ":", message.texte);
    });

    // Déconnexion
    socket.on("disconnect", () => {
        console.log("Utilisateur déconnecté :", socket.id);
    });

});

// Démarrage du serveur compatible avec Render
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Serveur InspireChat démarré sur le port ${PORT}`);
});
