
import { useState, useEffect } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

function App() {
    const [pseudo, setPseudo] = useState("");
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        function recevoirMessage(donnees) {
            setMessages((anciens) => [...anciens, donnees]);
        }

        socket.on("message", recevoirMessage);

        return () => {
            socket.off("message", recevoirMessage);
        };
    }, []);

    function envoyerMessage(e) {
        e.preventDefault();

        if (pseudo.trim() === "" || message.trim() === "") {
            return;
        }

        socket.emit("message", {
            pseudo: pseudo.trim(),
            texte: message.trim()
        });

        setMessage("");
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white flex justify-center items-center p-4">

            <div className="w-full max-w-xl bg-slate-900 p-5 rounded-2xl">

                <h1 className="text-3xl font-bold text-center mb-5">
                    InspireChat
                </h1>

                <input
                    type="text"
                    placeholder="Ton pseudo"
                    value={pseudo}
                    onChange={(e) => setPseudo(e.target.value)}
                    className="w-full p-3 mb-4 bg-slate-800 rounded-lg"
                />

                <div className="h-80 overflow-y-auto bg-slate-800 p-4 rounded-lg mb-4">

                    {messages.map((element, index) => (
                        <div
                            key={index}
                            className={`mb-3 p-3 rounded-lg ${
                                element.expediteurId === socket.id
                                    ? "bg-blue-600 ml-auto"
                                    : "bg-slate-700 mr-auto"
                            } max-w-[85%]`}
                        >
                            <p className="font-bold text-sm">
                                {element.pseudo}
                            </p>

                            <p>{element.texte}</p>
                        </div>
                    ))}

                </div>

                <form onSubmit={envoyerMessage} className="flex gap-2">

                    <input
                        type="text"
                        placeholder="Écris ton message..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="flex-1 min-w-0 p-3 bg-slate-800 rounded-lg"
                    />

                    <button
                        type="submit"
                        className="bg-blue-600 px-4 rounded-lg"
                    >
                        Envoyer
                    </button>

                </form>

            </div>
        </div>
    );
}

export default App;
