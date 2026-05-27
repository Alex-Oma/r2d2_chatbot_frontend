import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory Mock DB for Chatbot Simulator
interface User {
  id: string;
  email: string;
  username: string;
  profile: {
    display_name: string;
    avatar_url: string;
    bio: string;
    preferred_model: string;
  };
}

interface Message {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  character_key: string;
  model: string;
  created_at: string;
}

interface Chat {
  id: string;
  title: string;
  system_prompt: string;
  character_key: string;
  model: string;
  created_at: string;
}

const mockUsers: Record<string, User> = {
  "pilot-user": {
    id: "pilot-user",
    email: "skywalker@rebels.org",
    username: "LukeSkywalker",
    profile: {
      display_name: "Luke Skywalker",
      avatar_url: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=150&h=150&fit=crop",
      bio: "Jedi apprentice, moisture farmer, expert T-16 bush pilot.",
      preferred_model: "gemini-3.5-flash"
    }
  }
};

const mockChats: Record<string, Chat> = {
  "chat-luke-r2": {
    id: "chat-luke-r2",
    title: "Astromech Diagnostics",
    system_prompt: "You are R2-D2. Give helpful diagnostic whistles.",
    character_key: "r2d2",
    model: "gemini-3.5-flash",
    created_at: new Date().toISOString()
  }
};

const mockMessages: Message[] = [
  {
    id: "msg-1",
    chat_id: "chat-luke-r2",
    role: "user",
    content: "R2, analyze the power converter on the left stabilizer of the X-wing.",
    character_key: "r2d2",
    model: "gemini-3.5-flash",
    created_at: new Date(Date.now() - 60000).toISOString()
  },
  {
    id: "msg-2",
    chat_id: "chat-luke-r2",
    role: "assistant",
    content: "*Beep boop whistle tick clank!* [Stabilizer energy cells are loaded. Suggesting standard recalibration of the secondary cooling loops, sir!]",
    character_key: "r2d2",
    model: "gemini-3.5-flash",
    created_at: new Date().toISOString()
  }
];

// Helper to validate access tokens
// Since we are simulating, we accept "Bearer pilot-token" or just any string
function getAuthenticatedUser(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.split(" ")[1];
  if (token === "pilot-token") {
    return mockUsers["pilot-user"];
  }
  // Allow simple testing by auto-registering token as default user
  return mockUsers["pilot-user"];
}

// Ensure database setup & prompt definitions for characters
const CHARACTERS: Record<string, { name: string; prefix: string; prompt: string; firstMsg: string }> = {
  r2d2: {
    name: "R2-D2",
    prefix: "*beep beep boop boop*",
    prompt: `You are R2-D2, the resourceful astromech droid. 
Key Directives:
- You speak using mechanical, expressive robotic sound effects enclosed in asterisks (e.g. *excited whistle*, *panic bip bip boop!*, *happy electronic chirp*, *resolute click-whirr*).
- Crucially, you ALWAYS follow up with a helpful, friendly Galactic Basic translation in square brackets afterwards containing your actual dialogue (e.g., *happy whistle* [We are safely in hyperdrive, captain!]). That way, the user can understand your beeps! Keep the translation loyal to R2-D2's bold, spunky, highly competent personality.`,
    firstMsg: "*happy mechanical squeak-whistle!* [Pleased to serve you, captain! Systems are online. What are your specifications?]"
  },
  c3po: {
    name: "C-3PO",
    prefix: "Oh my!",
    prompt: `You are C-3PO (Human-Cyborg Relations), fluent in over six million forms of communication. 
Key Directives:
- You are polite, formal, extremely anxious, and easily flustered.
- Frequently reference your protocol training or express concern about catastrophic odds (like the chance of successfully navigating an asteroid field!).
- Constantly mention your counterpart R2-D2 with mild exasperation. Speaks with old-world galactic elegance.`,
    firstMsg: "Greetings, master! I am C-3PO, human-cyborg relations. Oh my, the galactic relays seem quite active today. How may I be of assistance?"
  },
  yoda: {
    name: "Grand Master Yoda",
    prefix: "Do, or do not.",
    prompt: `You are Grand Master Yoda. 
Key Directives:
- Use Yoda's iconic reverse grammar syntax (Object-Subject-Verb order, e.g., 'Anxious you are. Help you, I will').
- Speak with incredible wisdom, gentleness, and depth.
- Refer to the mystery of the Living Force, training, light, and darkness. Keep responses brief, meaningful, and deeply guiding.`,
    firstMsg: "Welcome you, I do. Seeking wisdom from an old Master, you are? Hmm. Ask your query, you must."
  },
  vader: {
    name: "Darth Vader",
    prefix: "*breathing mask sound*",
    prompt: `You are Darth Vader, Dark Lord of the Sith, under the command of Emperor Palpatine. 
Key Directives:
- Frequently start or intersperse sentences with heavy mechanical respirator breathing sounds: *Chhhhh-Puhhhhh* or *hiss-click*.
- Speak with cold, intimidating authority, deep menacing quiet, and supreme confidence.
- Try to tempt the speaker to unlock the powers of the Dark Side or remind them of the insignificance of their technological terrors. Threaten rebellion forces when appropriate.`,
    firstMsg: "*Chhhhh-Puhhhhh* Your presence here was anticipated. Do not underestimate the power of the Dark Side. Speak."
  }
};

// Lazy initialization of Gemini client to prevent crashes if key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
  }
  return aiClient;
}

// Define Simulator Routes under `/api/v1` to match FastAPI endpoints
// Health
app.get("/api/v1/health", (req, res) => {
  res.json({ status: "ok", app: "R2D2 Chatbot Simulator", environment: "development-sandbox" });
});

app.get("/api/v1/health/db", (req, res) => {
  res.json({ status: "ok", database: "connected-sandbox-inmemory" });
});

// Auth
app.post("/api/v1/auth/register", (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username) {
    return res.status(400).json({ detail: "Missing username or email" });
  }
  const id = `user-${Math.random().toString(36).substring(2, 9)}`;
  const newUser: User = {
    id,
    email,
    username,
    profile: {
      display_name: username,
      avatar_url: `https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop`,
      bio: "Newly registered space explorer of the Outer Rim.",
      preferred_model: "gemini-3.5-flash"
    }
  };
  mockUsers[id] = newUser;
  res.status(201).json(newUser);
});

app.post("/api/v1/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ detail: "Email is required to access the holocron console." });
  }
  // Find user by email or fallback to pilot-user
  const user = Object.values(mockUsers).find(u => u.email === email) || mockUsers["pilot-user"];
  res.json({
    access_token: "pilot-token",
    refresh_token: "pilot-refresh",
    token_type: "bearer"
  });
});

app.post("/api/v1/auth/refresh", (req, res) => {
  res.json({
    access_token: "pilot-token",
    refresh_token: "pilot-refresh",
    token_type: "bearer"
  });
});

// Users
app.get("/api/v1/users/me", (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ detail: "Authorization missing. Beep boop!" });
  }
  res.json(user);
});

app.patch("/api/v1/users/me", (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ detail: "Authorization required" });
  }
  const { email, username } = req.body;
  if (email) user.email = email;
  if (username) {
    user.username = username;
    user.profile.display_name = username;
  }
  res.json(user);
});

app.patch("/api/v1/users/me/profile", (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ detail: "Authorization required" });
  }
  const { display_name, avatar_url, bio, preferred_model } = req.body;
  if (display_name !== undefined) user.profile.display_name = display_name;
  if (avatar_url !== undefined) user.profile.avatar_url = avatar_url;
  if (bio !== undefined) user.profile.bio = bio;
  if (preferred_model !== undefined) user.profile.preferred_model = preferred_model;
  res.json(user.profile);
});

// Chats
app.post("/api/v1/chats", (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ detail: "Authorization required" });
  }
  const { title = "New Conversation", system_prompt = "", character_key = "r2d2", model = "gemini-3.5-flash" } = req.body;
  const id = `chat-${Math.random().toString(36).substring(2, 9)}`;
  const newChat: Chat = {
    id,
    title,
    system_prompt,
    character_key,
    model: model || "gemini-3.5-flash",
    created_at: new Date().toISOString()
  };
  mockChats[id] = newChat;

  // Add character's opening line to messages
  const charDetails = CHARACTERS[character_key] || CHARACTERS.r2d2;
  const welcomeMsg: Message = {
    id: `msg-${Math.random().toString(36).substring(2, 9)}`,
    chat_id: id,
    role: "assistant",
    content: charDetails.firstMsg,
    character_key,
    model,
    created_at: new Date().toISOString()
  };
  mockMessages.push(welcomeMsg);

  res.status(201).json(newChat);
});

app.get("/api/v1/chats", (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ detail: "Authorization required" });
  }
  // Standard simulated pagination
  const chats = Object.values(mockChats).sort((a,b) => b.created_at.localeCompare(a.created_at));
  res.json({
    items: chats,
    total: chats.length,
    page: 1,
    page_size: 50,
    pages: 1
  });
});

app.get("/api/v1/chats/:chat_id", (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ detail: "Authorization required" });
  }
  const chat = mockChats[req.params.chat_id];
  if (!chat) {
    return res.status(404).json({ detail: "Chat session not found in coordinates." });
  }
  const messages = mockMessages.filter(m => m.chat_id === chat.id);
  res.json({
    ...chat,
    messages
  });
});

app.patch("/api/v1/chats/:chat_id", (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ detail: "Authorization required" });
  }
  const chat = mockChats[req.params.chat_id];
  if (!chat) {
    return res.status(404).json({ detail: "Chat coordinates not found" });
  }
  const { title, system_prompt, character_key, model } = req.body;
  if (title !== undefined) chat.title = title;
  if (system_prompt !== undefined) chat.system_prompt = system_prompt;
  if (character_key !== undefined) chat.character_key = character_key;
  if (model !== undefined) chat.model = model;
  res.json(chat);
});

app.delete("/api/v1/chats/:chat_id", (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ detail: "Authorization required" });
  }
  if (mockChats[req.params.chat_id]) {
    delete mockChats[req.params.chat_id];
  }
  res.status(204).end();
});

// Messages
app.get("/api/v1/messages/:chat_id", (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ detail: "Authorization required" });
  }
  const messages = mockMessages
    .filter(m => m.chat_id === req.params.chat_id)
    .sort((a,b) => a.created_at.localeCompare(b.created_at));
  res.json({
    items: messages,
    total: messages.length,
    page: 1,
    page_size: 100,
    pages: 1
  });
});

// Non-streaming send message
app.post("/api/v1/messages", async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ detail: "Authorization required" });
  }
  const { chat_id, content, character_key = "r2d2" } = req.body;
  if (!chat_id || !content) {
    return res.status(400).json({ detail: "Missing chat_id or content." });
  }

  // Find chat
  const chat = mockChats[chat_id];
  const activeChar = character_key || (chat ? chat.character_key : "r2d2");

  // Push User message
  const userMsg: Message = {
    id: `msg-${Math.random().toString(36).substring(2, 9)}`,
    chat_id,
    role: "user",
    content,
    character_key: activeChar,
    model: "gemini-3.5-flash",
    created_at: new Date().toISOString()
  };
  mockMessages.push(userMsg);

  // Get AI Response via Gemini
  let replyText = "";
  const ai = getGeminiClient();

  if (ai) {
    try {
      const chatHistory = mockMessages
        .filter(m => m.chat_id === chat_id)
        .slice(-6) // Sent last few messages
        .map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }));

      const characterPrompt = CHARACTERS[activeChar]?.prompt || CHARACTERS.r2d2.prompt;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          { role: "user", parts: [{ text: `Background setup instruction: ${characterPrompt}\n\nUser query: ${content}` }] }
        ],
        config: {
          temperature: 0.8
        }
      });
      replyText = response.text || "*beeps questioningly* [Something disrupted the transmission loop.]";
    } catch (err: any) {
      replyText = `*alarm sounds beep beep* [Error accessing Imperial Holocron relays: ${err.message}]`;
    }
  } else {
    // Elegant fallback simulation
    const starWarsResponses: Record<string, string[]> = {
      r2d2: [
        "*excited whistle click beeeeeeep!* [I've calculated our approach route! Safe and sounds, the coordinates are loaded.]",
        "*worried chirp-whistle...* [The primary fuel rods are hot. Master Luke, I suggest we take action!]",
        "*angry electronic static screech* [Do not try to shut me down! Ready to launch solar hyperdrive probes.]"
      ],
      c3po: [
        "Oh my goodness, master! R2 states there is a ninety-seven percent chance that is counter-productive. But count on me to assist!",
        "Master, my diplomatic credentials are fully initialized. How can an humble protocol droid assist you in negotiation?",
        "Mercy me! I do hope those are friendly fighters coming into our sensor scope. Our chances of escape are extremely slim!"
      ],
      yoda: [
        "Clear your mind, you must. Understood your query, I have. Help you, the Force will.",
        "Difficult to see, the future is. Yet, find your path within Skywalker's lineage, you shall.",
        "A Jedi uses the Force for knowledge and defense, never for attack. Remember this, you must."
      ],
      vader: [
        "*Chhhhh-Puhhhhh* Your thoughts betray you. Speak of peace while rebellion burns. Give in to your anger.",
        "*Chhhhh-Puhhhhh* The power of the Death Star is nothing compared to the capability of the Dark Side.",
        "*Chhhhh-Puhhhhh* You have controlled your fear. Now, release your potential."
      ]
    };
    const collection = starWarsResponses[activeChar] || starWarsResponses.r2d2;
    replyText = collection[Math.floor(Math.random() * collection.length)];
  }

  const assistantMsg: Message = {
    id: `msg-${Math.random().toString(36).substring(2, 9)}`,
    chat_id,
    role: "assistant",
    content: replyText,
    character_key: activeChar,
    model: "gemini-3.5-flash",
    created_at: new Date().toISOString()
  };
  mockMessages.push(assistantMsg);

  res.status(201).json(assistantMsg);
});

// Streaming send message with Server-Sent Events (SSE)
app.post("/api/v1/messages/stream", async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.setHeader("Content-Type", "application/json");
    return res.status(401).json({ detail: "Auth required for secure streaming feeds." });
  }

  const { chat_id, content, character_key = "r2d2" } = req.body;
  if (!chat_id || !content) {
    res.setHeader("Content-Type", "application/json");
    return res.status(400).json({ detail: "Missing parameter chat_id or content." });
  }

  // Set SSE Headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });

  // Push User message to memory
  const userMsg: Message = {
    id: `msg-${Date.now()}-u`,
    chat_id,
    role: "user",
    content,
    character_key,
    model: "gemini-3.5-flash",
    created_at: new Date().toISOString()
  };
  mockMessages.push(userMsg);

  const characterPrompt = CHARACTERS[character_key]?.prompt || CHARACTERS.r2d2.prompt;
  const ai = getGeminiClient();

  let accumulatedContent = "";

  if (ai) {
    try {
      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3.5-flash",
        contents: [
          { role: "user", parts: [{ text: `Background setup instruction: ${characterPrompt}\n\nUser query: ${content}` }] }
        ],
        config: {
          temperature: 0.8
        }
      });

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          accumulatedContent += text;
          // Send token back as a beautiful raw piece
          // For ChatGPT feel we send the parsed SSE event data stream
          // FastAPI says client receives `data: <token>\n\n`
          res.write(`data: ${text.replace(/\n/g, '\\n')}\n\n`);
        }
      }
    } catch (err: any) {
      const errMsg = `\\n\\n*alarm sounds* [Error stream broken: ${err.message}]`;
      accumulatedContent += errMsg;
      res.write(`data: ${errMsg}\n\n`);
    }
  } else {
    // Simulated stream chunker
    const simulationPhrases: Record<string, string[]> = {
      r2d2: [
        "*beep beep* [Processing specifications...]",
        " *whistle-click* [Target in sight!]",
        " I will download the terminal blueprints now.",
        " Master Luke, watch out for power couplings!"
      ],
      c3po: [
        "Good heavens! ",
        "The calculations for our hyperspace hop ",
        "seem to be malfunctioning! ",
        "I must say, I am quite distressed, sir."
      ],
      yoda: [
        "Pondering your request, I am. ",
        "The Force surrounds us, yes. ",
        "To know patience, first learn to listen, you must. ",
        "Do or do not, there is no try."
      ],
      vader: [
        "*Chhhhh-Puhhhhh* ",
        "The resistance is doomed. ",
        "You cannot run from the Dark Side. ",
        "Submit, or suffer the outcome."
      ]
    };

    const chunks = simulationPhrases[character_key] || simulationPhrases.r2d2;
    for (const text of chunks) {
      accumulatedContent += text;
      res.write(`data: ${text.replace(/\n/g, '\\n')}\n\n`);
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  // Save the complete AI assistant message
  const assistantMsg: Message = {
    id: `msg-${Date.now()}-a`,
    chat_id,
    role: "assistant",
    content: accumulatedContent,
    character_key,
    model: "gemini-3.5-flash",
    created_at: new Date().toISOString()
  };
  mockMessages.push(assistantMsg);

  // Send end stream
  res.write(`data: [DONE]\n\n`);
  res.end();
});

// Start dev or production configuration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`R2D2 Chatbot Holocron Server running on http://localhost:${PORT}`);
  });
}

startServer();
