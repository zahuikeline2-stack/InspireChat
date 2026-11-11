
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();

const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5173";

app.use(cors({
  origin: FRONTEND_URL,
  methods: ["GET", "POST"]
}));

app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

const utilisateurs = new Map();

function actualiserUtilisateurs() {
  const liste = Array.from(utilisateurs.entries()).map(
    ([id, utilisateur]) => ({
      id,
      pseudo: utilisateur.pseudo
    })
  );

  io.emit("utilisateurs", liste);
}

app.get("/", (req, res) => {
  res.send("Bienvenue sur InspireChat !");
});

// Vérifier et préparer un message
function preparerMessage(socket, donnees) {
  const utilisateur = utilisateurs.get(socket.id);

  if (!utilisateur || !donnees) return null;

  const typesAutorises = ["text", "image", "video", "audio"];
  const type = donnees.type || "text";

  if (!typesAutorises.includes(type)) return null;

  const texte =
    typeof donnees.texte === "string"
      ? donnees.texte.trim().slice(0, 5000)
      : "";

  const mediaUrl =
    typeof donnees.mediaUrl === "string"
      ? donnees.mediaUrl
      : "";

  if (type === "text" && !texte) return null;

  if (type !== "text") {
    if (!mediaUrl || mediaUrl.length > 2000) return null;

    try {
      const url = new URL(mediaUrl);
      if (url.protocol !== "https:") return null;
    } catch {
      return null;
    }
  }

  return {
    id: Date.now() + Math.random(),
    pseudo: utilisateur.pseudo,
    texte,
    type,
    mediaUrl: type === "text" ? null : mediaUrl,
    fileName:
      typeof donnees.fileName === "string"
        ? donnees.fileName.slice(0, 150)
        : "",
    date: new Date().toISOString()
  };
}

io.on("connection", (socket) => {
  console.log("Utilisateur connecté :", socket.id);

  socket.on("rejoindre", (pseudo) => {
    if (typeof pseudo !== "string" || !pseudo.trim()) return;

    utilisateurs.set(socket.id, {
      pseudo: pseudo.trim().slice(0, 30)
    });

    actualiserUtilisateurs();
  });

  // Messages publics
  socket.on("message", (donnees) => {
    const message = preparerMessage(socket, donnees);

    if (!message) return;

    io.emit("message", message);

    console.log(
      `${message.pseudo} : ${message.texte || message.type}`
    );
  });

  // Messages privés
  socket.on("message-prive", (donnees) => {
    const expediteur = utilisateurs.get(socket.id);

    if (
      !expediteur ||
      !donnees ||
      typeof donnees.vers !== "string" ||
      !utilisateurs.has(donnees.vers) ||
      donnees.vers === socket.id
    ) {
      socket.emit(
        "erreur-message-prive",
        "Destinataire introuvable."
      );
      return;
    }

    const message = preparerMessage(socket, donnees);

    if (!message) return;

    message.de = socket.id;
    message.vers = donnees.vers;

    socket.emit("message-prive", message);
    io.to(donnees.vers).emit("message-prive", message);
  });

  socket.on("disconnect", () => {
    utilisateurs.delete(socket.id);
    actualiserUtilisateurs();

    console.log("Utilisateur déconnecté :", socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Serveur InspireChat démarré sur le port ${PORT}`);
});
