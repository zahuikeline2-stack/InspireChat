
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();

app.use(cors({
    origin: "http://localhost:5174"
}));

app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
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

        // Diffuser le message à tous
        io.emit("message", message);

        console.log(message.pseudo, ":", message.texte);
    });

    // Déconnexion
    socket.on("disconnect", () => {
        console.log("Utilisateur déconnecté :", socket.id);
    });

});

// Démarrage du serveur
server.listen(3000, () => {
    console.log("Serveur InspireChat démarré sur le port 3000");
});
