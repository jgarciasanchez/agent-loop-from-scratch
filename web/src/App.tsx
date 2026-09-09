import { useRef, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type ChatEvent =
  | { role: string; type: "text"; text: string }
  | { role: string; type: "tool_use"; name: string; input: unknown }
  | { role: string; type: "tool_result"; content: string; isError: boolean };

type ChatItem =
  | { kind: "user"; text: string }
  | { kind: "agent-text"; text: string }
  | { kind: "tool-use"; name: string; input: unknown }
  | { kind: "tool-result"; content: string; isError: boolean }
  | { kind: "error"; text: string };

const eventsToItems = (events: ChatEvent[]): ChatItem[] =>
  events.map((event) => {
    if (event.type === "text") return { kind: "agent-text", text: event.text };
    if (event.type === "tool_use")
      return { kind: "tool-use", name: event.name, input: event.input };
    return {
      kind: "tool-result",
      content: event.content,
      isError: event.isError,
    };
  });

function App() {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sendMessage = async () => {
    const message = input.trim();
    if (!message || isLoading) return;

    setItems((prev) => [...prev, { kind: "user", text: message }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");

      setItems((prev) => [...prev, ...eventsToItems(data.events)]);
    } catch (error) {
      setItems((prev) => [
        ...prev,
        {
          kind: "error",
          text: error instanceof Error ? error.message : String(error),
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
    }
  };

  return (
    <div className="chat">
      <header className="chat-header">
        <h1>agent-loop-from-scratch</h1>
        <p>mini chat interface</p>
      </header>

      <div className="chat-log">
        {items.length === 0 && (
          <p className="chat-empty">Escribe un mensaje para empezar.</p>
        )}
        {items.map((item, i) => (
          <ChatBubble key={i} item={item} />
        ))}
        {isLoading && <div className="chat-bubble agent pending">…</div>}
        <div ref={bottomRef} />
      </div>

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="En que te puedo ayudar?"
          disabled={isLoading}
          autoFocus
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}

const ChatBubble = ({ item }: { item: ChatItem }) => {
  switch (item.kind) {
    case "user":
      return <div className="chat-bubble user">{item.text}</div>;
    case "agent-text":
      return <div className="chat-bubble agent">{item.text}</div>;
    case "tool-use":
      return (
        <div className="chat-bubble tool">
          🔧 {item.name}({JSON.stringify(item.input)})
        </div>
      );
    case "tool-result":
      return (
        <div className={`chat-bubble tool-result ${item.isError ? "error" : ""}`}>
          {item.content}
        </div>
      );
    case "error":
      return <div className="chat-bubble error">⚠️ {item.text}</div>;
  }
};

export default App;
