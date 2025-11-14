import "./ArticleChatBox.scss";
import React, { useState, useRef, useEffect } from "react";
import Article from "/src/components/articles/base/Article.jsx";

/**
 * Chat Box Article Component
 * @param {ArticleDataWrapper} dataWrapper
 * @returns {JSX.Element}
 */
function ArticleChatBox({ dataWrapper }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const chatMessagesRef = useRef(null);

  // Scroll to bottom ONLY if user is near bottom already
  const scrollToBottom = () => {
    if (!chatMessagesRef.current) return;
    const { scrollHeight, clientHeight, scrollTop } = chatMessagesRef.current;
    const isNearBottom = scrollHeight - (scrollTop + clientHeight) < 150;
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle sending message
  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: input,
      sender: "user",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Simulated bot reply
    setTimeout(() => {
      const botMessage = {
        id: Date.now() + 1,
        text: "Hello!",
        sender: "bot",
      };
      setMessages((prev) => [...prev, botMessage]);
    }, 500);
  };

  return (
    <Article
      id={dataWrapper.uniqueId}
      type={Article.Types.SPACING_DEFAULT}
      dataWrapper={dataWrapper}
      className="article-chat-box"
    >
      <div className="chat-container">
        <div className="chat-messages" ref={chatMessagesRef}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-message ${
                msg.sender === "user" ? "from-user" : "from-bot"
              }`}
            >
              {msg.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <input
            type="text"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button onClick={handleSend}>Send</button>
        </div>
      </div>
    </Article>
  );
}

export default ArticleChatBox;
