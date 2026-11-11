
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { supabase } from "./supabase";

const socket = io(
  import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"
);

function App() {
  const [pseudo, setPseudo] = useState("");
  const [texte, setTexte] = useState("");
  const [connecte, setConnecte] = useState(false);
  const [serveurEnLigne, setServeurEnLigne] = useState(socket.connected);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messagesPrives, setMessagesPrives] = useState({});
  const [conversation, setConversation] = useState("general");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState("");

  const photoRef = useRef(null);
  const videoRef = useRef(null);
  const recorderRef = useRef(null);
  const morceauxRef = useRef([]);

  useEffect(() => {
    function connexion() {
      setServeurEnLigne(true);
      if (connecte && pseudo) socket.emit("rejoindre", pseudo);
    }

    function deconnexion() {
      setServeurEnLigne(false);
    }

    function recevoirUtilisateurs(liste) {
      setUtilisateurs(liste);
    }

    function recevoirMessage(message) {
      setMessages((anciens) => [...anciens, message]);
    }

    function recevoirMessagePrive(message) {
      const autre =
        message.de === socket.id ? message.vers : message.de;

      setMessagesPrives((anciens) => ({
        ...anciens,
        [autre]: [...(anciens[autre] || []), message]
      }));
    }

    function recevoirErreur(message) {
      setErreur(message);
    }

    socket.on("connect", connexion);
    socket.on("disconnect", deconnexion);
    socket.on("utilisateurs", recevoirUtilisateurs);
    socket.on("message", recevoirMessage);
    socket.on("message-prive", recevoirMessagePrive);
    socket.on("erreur-message-prive", recevoirErreur);

    if (socket.connected) {
      setServeurEnLigne(true);
      if (connecte && pseudo) socket.emit("rejoindre", pseudo);
    }

    return () => {
      socket.off("connect", connexion);
      socket.off("disconnect", deconnexion);
      socket.off("utilisateurs", recevoirUtilisateurs);
      socket.off("message", recevoirMessage);
      socket.off("message-prive", recevoirMessagePrive);
      socket.off("erreur-message-prive", recevoirErreur);
    };
  }, [connecte, pseudo]);

  function rejoindreChat(e) {
    e.preventDefault();
    const nom = pseudo.trim();

    if (!nom || !serveurEnLigne) return;

    setPseudo(nom);
    setConnecte(true);
    socket.emit("rejoindre", nom);
  }

  function envoyerDonnees(donnees) {
    if (conversation === "general") {
      socket.emit("message", {
        pseudo,
        ...donnees
      });
    } else {
      socket.emit("message-prive", {
        vers: conversation,
        ...donnees
      });
    }
  }

  function envoyerMessage(e) {
    e.preventDefault();

    if (!texte.trim() || !serveurEnLigne) return;

    envoyerDonnees({
      type: "text",
      texte: texte.trim()
    });

    setTexte("");
  }

  // Envoyer une photo, une vidéo ou un audio vers Supabase
  async function envoyerMedia(fichier, type) {
    if (!fichier || !supabase) {
      setErreur(
        "Configure d'abord Supabase dans le fichier .env."
      );
      return;
    }

    const limites = {
      image: 10 * 1024 * 1024,
      video: 50 * 1024 * 1024,
      audio: 10 * 1024 * 1024
    };

    if (fichier.size > limites[type]) {
      setErreur("Fichier trop volumineux pour cette version.");
      return;
    }

    setErreur("");
    setEnvoiEnCours(true);

    try {
      const extension =
        fichier.name.split(".").pop() || type;

      const chemin =
        `${socket.id}/${Date.now()}-${Math.random()
          .toString(36).slice(2)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("inspirechat-media")
        .upload(chemin, fichier, {
          contentType: fichier.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("inspirechat-media")
        .getPublicUrl(chemin);

      envoyerDonnees({
        type,
        texte: "",
        mediaUrl: data.publicUrl,
        fileName: fichier.name
      });
    } catch (error) {
      console.error(error);
      setErreur("Impossible d'envoyer ce fichier. Vérifie Supabase.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  function choisirFichier(e, type) {
    const fichier = e.target.files?.[0];
    if (fichier) envoyerMedia(fichier, type);
    e.target.value = "";
  }

  // Enregistrement d'un message vocal
  async function commencerVocal() {
    setErreur("");

    if (!navigator.mediaDevices?.getUserMedia ||
        !window.MediaRecorder) {
      setErreur("Ton navigateur ne permet pas l'enregistrement vocal.");
      return;
    }

    try {
      const flux = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      const recorder = new MediaRecorder(flux);
      recorderRef.current = recorder;
      morceauxRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          morceauxRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audio = new Blob(morceauxRef.current, {
          type: recorder.mimeType || "audio/webm"
        });

        flux.getTracks().forEach((track) => track.stop());

        if (audio.size > 0) {
          const fichier = new File(
            [audio],
            `vocal-${Date.now()}.webm`,
            { type: audio.type }
          );

          await envoyerMedia(fichier, "audio");
        }
      };

      recorder.start();
      setEnregistrement(true);
    } catch (error) {
      console.error(error);
      setErreur("Autorise l'accès au microphone pour enregistrer.");
    }
  }

  function terminerVocal() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      setEnregistrement(false);
    }
  }

  const utilisateursDisponibles = utilisateurs.filter(
    (u) => u.id !== socket.id
  );

  const messagesAffiches =
    conversation === "general"
      ? messages
      : messagesPrives[conversation] || [];

  const contact = utilisateurs.find(
    (u) => u.id === conversation
  );

  const titre =
    conversation === "general"
      ? "Salon général"
      : contact?.pseudo || "Conversation privée";

  function afficherContenu(message) {
    if (message.type === "image" && message.mediaUrl) {
      return (
        <img
          src={message.mediaUrl}
          alt="Photo envoyée"
          className="max-w-full max-h-80 rounded-xl object-contain"
        />
      );
    }

    if (message.type === "video" && message.mediaUrl) {
      return (
        <video
          src={message.mediaUrl}
          controls
          className="max-w-full max-h-80 rounded-xl"
        />
      );
    }

    if (message.type === "audio" && message.mediaUrl) {
      return (
        <audio
          src={message.mediaUrl}
          controls
          className="max-w-full"
        />
      );
    }

    return <p className="break-words">{message.texte}</p>;
  }

  if (!connecte) {
    return (
      <div className="min-h-screen bg-[#17121A] flex items-center justify-center p-5 text-white">
        <form
          onSubmit={rejoindreChat}
          className="w-full max-w-md bg-[#241522] border border-pink-900/40 rounded-3xl p-8 shadow-2xl"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#F06CBA] flex items-center justify-center text-3xl mb-6">
            💬
          </div>

          <h1 className="text-4xl font-bold mb-2">
            Inspire<span className="text-[#F06CBA]">Chat</span>
          </h1>

          <p className="text-gray-400 mb-8">
            Connecte-toi et partage tes idées.
          </p>

          <label className="block text-sm mb-2 text-gray-300">
            Ton pseudo
          </label>

          <input
            type="text"
            placeholder="Entre ton pseudo..."
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            maxLength={30}
            className="w-full bg-[#17121A] border border-gray-700 rounded-xl p-4 outline-none focus:border-[#F06CBA] mb-5"
          />

          <button
            type="submit"
            disabled={!serveurEnLigne || !pseudo.trim()}
            className="w-full bg-[#F06CBA] hover:bg-pink-400 disabled:opacity-40 text-[#241522] font-bold p-4 rounded-xl"
          >
            Rejoindre InspireChat →
          </button>

          <p className="text-center text-xs text-gray-500 mt-6">
            {serveurEnLigne ? "● Serveur connecté" : "● Connexion au serveur..."}
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#17121A] text-white flex">
      <aside className="w-20 md:w-80 bg-[#241522] border-r border-pink-900/30 flex flex-col shrink-0">
        <div className="p-4 md:p-6 border-b border-pink-900/30">
          <h1 className="text-xl md:text-3xl font-bold">
            <span className="hidden md:inline">Inspire</span>
            <span className="text-[#F06CBA]">Chat</span>
          </h1>
          <p className="hidden md:block text-gray-400 text-sm mt-2">
            Partage tes idées librement.
          </p>
        </div>

        <div className="p-2 md:p-5 flex-1 overflow-y-auto">
          <p className="hidden md:block text-xs uppercase tracking-widest text-gray-500 mb-4">
            Conversations
          </p>

          <button
            onClick={() => setConversation("general")}
            className={`w-full flex items-center gap-3 p-2 md:p-3 rounded-xl mb-3 text-left ${
              conversation === "general"
                ? "bg-[#F06CBA]/15 border border-[#F06CBA]/30"
                : "hover:bg-white/5"
            }`}
          >
            <div className="w-10 h-10 shrink-0 rounded-full bg-[#F06CBA] flex items-center justify-center text-xl">
              💬
            </div>
            <div className="hidden md:block">
              <p className="font-semibold">Salon général</p>
              <p className="text-xs text-gray-400">Discussion publique</p>
            </div>
          </button>

          <p className="hidden md:block text-xs uppercase tracking-widest text-gray-500 mb-3 mt-6">
            Utilisateurs en ligne ({utilisateursDisponibles.length})
          </p>

          <p className="md:hidden text-center text-xs text-gray-500 mb-3">
            En ligne
          </p>

          {utilisateursDisponibles.map((u) => (
            <button
              key={u.id}
              onClick={() => setConversation(u.id)}
              title={u.pseudo}
              className={`w-full flex items-center gap-3 p-2 md:p-3 rounded-xl mb-2 text-left ${
                conversation === u.id
                  ? "bg-[#F06CBA]/15 border border-[#F06CBA]/30"
                  : "hover:bg-white/5"
              }`}
            >
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-[#302631] border border-[#F06CBA]/40 flex items-center justify-center font-bold text-[#F06CBA]">
                  {u.pseudo.charAt(0).toUpperCase()}
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-[#241522] rounded-full" />
              </div>
              <div className="hidden md:block min-w-0">
                <p className="font-semibold truncate">{u.pseudo}</p>
                <p className="text-xs text-green-400">En ligne</p>
              </div>
            </button>
          ))}
        </div>

        <div className="p-3 md:p-5 border-t border-pink-900/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0 rounded-full bg-[#F06CBA] text-[#241522] flex items-center justify-center font-bold">
              {pseudo.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block min-w-0">
              <p className="font-semibold truncate">{pseudo}</p>
              <p className="text-xs text-green-400">
                {serveurEnLigne ? "En ligne" : "Déconnecté"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="bg-[#241522] border-b border-pink-900/30 p-4 md:p-6 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg md:text-xl font-bold truncate">{titre}</h2>
            <p className="text-xs text-gray-400 mt-1">
              {conversation === "general" ? "Discussion publique" : "🔒 Conversation privée"}
              {" · "}
              {serveurEnLigne ? "Connecté" : "Connexion perdue"}
            </p>
          </div>
          <div className="hidden sm:block bg-[#F06CBA]/15 text-[#F06CBA] px-3 py-2 rounded-full text-xs">
            ✨ InspireChat
          </div>
        </header>

        <section className="flex-1 p-4 md:p-8 overflow-y-auto space-y-5">
          <div className="text-center mb-8">
            <span className="text-xs bg-[#241522] text-gray-400 px-4 py-2 rounded-full">
              {conversation === "general"
                ? "Bienvenue dans le salon général ❤️"
                : `Conversation privée avec ${titre} 🔒`}
            </span>
          </div>

          {messagesAffiches.length === 0 ? (
            <div className="text-center mt-20">
              <div className="text-5xl mb-4">💌</div>
              <h3 className="text-lg font-semibold">Aucun message pour le moment</h3>
              <p className="text-sm text-gray-500 mt-2">Lance la discussion !</p>
            </div>
          ) : (
            messagesAffiches.map((message) => {
              const estMonMessage =
                conversation === "general"
                  ? message.pseudo === pseudo
                  : message.de === socket.id;

              return (
                <div
                  key={message.id}
                  className={`flex ${estMonMessage ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] md:max-w-[65%] p-4 rounded-2xl space-y-2 ${
                      estMonMessage
                        ? "bg-[#F06CBA] text-[#241522] rounded-br-sm"
                        : "bg-[#302631] text-white rounded-bl-sm"
                    }`}
                  >
                    <p className={`text-xs font-bold ${
                      estMonMessage ? "text-[#6E254F]" : "text-[#F06CBA]"
                    }`}>
                      {estMonMessage ? "Toi" : message.pseudo}
                    </p>

                    {afficherContenu(message)}

                    <p className="text-[10px] opacity-70 text-right">
                      {new Date(message.date).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </section>

        <footer className="p-3 md:p-6 bg-[#241522] border-t border-pink-900/30">
          {erreur && (
            <p className="text-sm text-red-400 mb-3 text-center">{erreur}</p>
          )}

          <div className="flex items-center gap-2 max-w-5xl mx-auto">
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => choisirFichier(e, "image")}
            />

            <input
              ref={videoRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => choisirFichier(e, "video")}
            />

            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              disabled={envoiEnCours}
              title="Envoyer une photo"
              className="bg-[#302631] hover:bg-[#F06CBA]/20 p-3 rounded-xl text-xl disabled:opacity-40"
            >
              📷
            </button>

            <button
              type="button"
              onClick={() => videoRef.current?.click()}
              disabled={envoiEnCours}
              title="Envoyer une vidéo"
              className="bg-[#302631] hover:bg-[#F06CBA]/20 p-3 rounded-xl text-xl disabled:opacity-40"
            >
              🎥
            </button>

            <button
              type="button"
              onClick={enregistrement ? terminerVocal : commencerVocal}
              disabled={envoiEnCours}
              title={enregistrement ? "Arrêter le vocal" : "Enregistrer un vocal"}
              className={`p-3 rounded-xl text-xl ${
                enregistrement
                  ? "bg-red-600 animate-pulse"
                  : "bg-[#302631] hover:bg-[#F06CBA]/20"
              }`}
            >
              {enregistrement ? "⏹️" : "🎙️"}
            </button>

            <form onSubmit={envoyerMessage} className="flex gap-2 flex-1 min-w-0">
              <input
                type="text"
                placeholder="Écris ton message..."
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                className="flex-1 min-w-0 bg-[#17121A] border border-gray-700 rounded-xl p-3 md:p-4 outline-none focus:border-[#F06CBA]"
              />

              <button
                type="submit"
                disabled={!serveurEnLigne || !texte.trim() || envoiEnCours}
                className="bg-[#F06CBA] hover:bg-pink-400 disabled:opacity-40 text-[#241522] font-bold px-4 md:px-6 rounded-xl"
              >
                ➤
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] text-gray-500 mt-3">
            {envoiEnCours
              ? "Envoi du média en cours..."
              : enregistrement
                ? "Enregistrement vocal en cours — appuie sur ⏹️ pour terminer"
                : "InspireChat · Partage tes idées ❤️"}
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;
