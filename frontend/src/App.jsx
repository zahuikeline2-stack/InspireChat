
import { useState, useEffect } from "react";
import { io } from "socket.io-client";

// Connexion au serveur
const socket = io("http://localhost:3000");

function App() {

    const [pseudo, setPseudo] = useState("");
    const [texte, setTexte] = useState("");
    const [messages, setMessages] = useState([]);

    const [connecte, setConnecte] = useState(false);

    // Recevoir les messages
    useEffect(() => {

        function recevoirMessage(message) {
            setMessages((anciensMessages) => [
                ...anciensMessages,
                message
            ]);
        }

        socket.on("message", recevoirMessage);

        return () => {
            socket.off("message", recevoirMessage);
        };

    }, []);

    // Se connecter avec un pseudo
    function rejoindreChat(e) {
        e.preventDefault();

        if (pseudo.trim() === "") {
            return;
        }

        setPseudo(pseudo.trim());
        setConnecte(true);
    }

    // Envoyer un message
    function envoyerMessage(e) {
        e.preventDefault();

        if (texte.trim() === "") {
            return;
        }

        socket.emit("message", {
            pseudo: pseudo,
            texte: texte.trim()
        });

        setTexte("");
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">

            <div className="w-full max-w-2xl bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800">

                {/* En-tête */}
                <div className="bg-indigo-600 p-5">
                    <h1 className="text-3xl font-bold">
                        InspireChat
                    </h1>

                    <p className="text-indigo-100 text-sm mt-1">
                        Connecte-toi et partage tes idées.
                    </p>
                </div>

                {!connecte ? (

                    /* Connexion */
                    <form
                        onSubmit={rejoindreChat}
                        className="p-8 flex flex-col gap-5"
                    >

                        <h2 className="text-xl font-semibold">
                            Bienvenue sur InspireChat
                        </h2>

                        <p className="text-slate-400">
                            Choisis un pseudo pour rejoindre la discussion.
                        </p>

                        <input
                            type="text"
                            placeholder="Ton pseudo..."
                            value={pseudo}
                            onChange={(e) => setPseudo(e.target.value)}
                            className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 outline-none focus:border-indigo-500"
                        />

                        <button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-700 p-3 rounded-lg font-semibold transition"
                        >
                            Rejoindre le chat
                        </button>

                    </form>

                ) : (

                    /* Messagerie */
                    <div className="p-5">

                        <div className="flex justify-between items-center mb-5">

                            <div>
                                <h2 className="text-xl font-bold">
                                    Salon général
                                </h2>

                                <p className="text-sm text-green-400">
                                    Connecté en tant que {pseudo}
                                </p>
                            </div>

                            <span className="text-xs bg-green-500/20 text-green-400 px-3 py-2 rounded-full">
                                En ligne
                            </span>

                        </div>

                        {/* Liste des messages */}
                        <div className="h-96 overflow-y-auto bg-slate-950 rounded-xl p-4 space-y-4">

                            {messages.length === 0 ? (

                                <p className="text-center text-slate-500 mt-32">
                                    Aucun message pour le moment.
                                    <br />
                                    Lance la discussion !
                                </p>

                            ) : (

                                messages.map((message) => (

                                    <div
                                        key={message.id}
                                        className={`flex ${
                                            message.pseudo === pseudo
                                                ? "justify-end"
                                                : "justify-start"
                                        }`}
                                    >

                                        <div className={`max-w-[80%] p-3 rounded-xl ${
                                            message.pseudo === pseudo
                                                ? "bg-indigo-600"
                                                : "bg-slate-800"
                                        }`}>

                                            <p className="text-xs font-bold mb-1 text-indigo-200">
                                                {message.pseudo}
                                            </p>

                                            <p className="break-words">
                                                {message.texte}
                                            </p>

                                            <p className="text-xs text-slate-300 mt-2 text-right">
                                                {new Date(message.date).toLocaleTimeString(
                                                    "fr-FR",
                                                    {
                                                        hour: "2-digit",
                                                        minute: "2-digit"
                                                    }
                                                )}
                                            </p>

                                        </div>

                                    </div>

                                ))

                            )}

                        </div>

                        {/* Formulaire d'envoi */}
                        <form
                            onSubmit={envoyerMessage}
                            className="flex gap-2 mt-4"
                        >

                            <input
                                type="text"
                                placeholder="Écris ton message..."
                                value={texte}
                                onChange={(e) => setTexte(e.target.value)}
                                className="flex-1 min-w-0 p-3 rounded-lg bg-slate-800 border border-slate-700 outline-none focus:border-indigo-500"
                            />

                            <button
                                type="submit"
                                className="bg-indigo-600 hover:bg-indigo-700 px-5 rounded-lg font-semibold transition"
                            >
                                Envoyer
                            </button>

                        </form>

                    </div>

                )}

            </div>

        </div>
    );
}

export default App;
