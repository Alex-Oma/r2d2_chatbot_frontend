import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, Sparkles, Terminal, Settings, Radio, Plus, Trash2, Edit3, 
  Wifi, WifiOff, Database, User, Check, Send, Cpu, AlertTriangle, 
  HelpCircle, RefreshCw, Volume2, VolumeX, Shield, Heart, Code,
  Lock, Mail, Eye, EyeOff, LogOut, UserPlus
} from "lucide-react";
import { api } from "./lib/api";
import { STAR_WARS_CHARACTERS } from "./data/characters";
import { Chat, Message, User as SwUser, StarWarsCharacter, ConnectionMode } from "./types";

export default function App() {
  // Connection and system states
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("target");
  const [targetUrl, setTargetUrl] = useState("http://localhost:8000/api/v1");
  const [targetToken, setTargetToken] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected">("connected");
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Authentication & Profile states
  const [currentUser, setCurrentUser] = useState<SwUser | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [bioInput, setBioInput] = useState("");
  const [preferredModel, setPreferredModel] = useState("gemini-3.5-flash");

  // Registration & Access states
  const [authEmail, setAuthEmail] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);

  // Chat parameters
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<StarWarsCharacter>(STAR_WARS_CHARACTERS[0]);
  const [chatTitleInput, setChatTitleInput] = useState("Astromech Diagnostics");

  // Interactive message state
  const [inputText, setInputText] = useState("");
  const [useStreaming, setUseStreaming] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingTokenAcc, setStreamingTokenAcc] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Interface view customization
  const [activeTab, setActiveTab] = useState<"chat" | "endpoints" | "schemas">("chat");
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editChatTitleText, setEditChatTitleText] = useState("");

  // Telemetry Log history to display live-updating JSON specs of API calls
  const [telemetryLogs, setTelemetryLogs] = useState<Array<{
    timestamp: string;
    endpoint: string;
    method: "GET" | "POST" | "PATCH" | "DELETE";
    requestPayload?: any;
    responsePayload?: any;
    status: number;
    type: "auth" | "chat" | "message" | "health";
  }>>([
    {
      timestamp: new Date().toLocaleTimeString(),
      endpoint: "/api/v1/health",
      method: "GET",
      responsePayload: { status: "ok", app: "R2D2 Chatbot Simulator", environment: "development-sandbox" },
      status: 200,
      type: "health"
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Log API events to telemetry
  const logTelemetry = (
    endpoint: string, 
    method: "GET" | "POST" | "PATCH" | "DELETE", 
    requestPayload?: any, 
    responsePayload?: any, 
    status: number = 200,
    type: "auth" | "chat" | "message" | "health" = "chat"
  ) => {
    setTelemetryLogs(prev => [
      {
        timestamp: new Date().toLocaleTimeString(),
        endpoint,
        method,
        requestPayload,
        responsePayload,
        status,
        type
      },
      ...prev.slice(0, 24) // Cap at 25 log traces
    ]);
  };

  // Sync state initially
  useEffect(() => {
    const config = api.getConfig();
    setConnectionMode(config.mode);
    setTargetUrl(config.targetUrl);
    setTargetToken(config.token);

    // Initial load sequence
    loadUserAndChats();
  }, []);

  // Scroll to bottom when messages or active chat shifts
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingTokenAcc, isGenerating]);

  // Audio oscillator sound effect builder
  const playBeep = (freq = 440, duration = 0.1, type: "sine" | "square" | "triangle" | "sawtooth" = "sine") => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = type;
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio context permissions might block sound which is safe to ignore
    }
  };

  // Sound triggers based on character actions
  const triggerCharacterThemeBeeps = (key: string) => {
    if (key === "r2d2") {
      playBeep(880, 0.08, "triangle");
      setTimeout(() => playBeep(1200, 0.05, "triangle"), 90);
      setTimeout(() => playBeep(600, 0.12, "sine"), 150);
    } else if (key === "c3po") {
      playBeep(520, 0.15, "triangle");
      setTimeout(() => playBeep(780, 0.1, "triangle"), 150);
    } else if (key === "yoda") {
      playBeep(330, 0.2, "sine");
      setTimeout(() => playBeep(440, 0.25, "sine"), 200);
    } else if (key === "vader") {
      playBeep(110, 0.3, "square");
      setTimeout(() => playBeep(90, 0.35, "square"), 250);
    }
  };

  // Unified loader routine
  const loadUserAndChats = async () => {
    try {
      setIsConnecting(true);
      setErrorBanner(null);

      // 1. Fetch user (or simulation default account)
      const userRes = await api.getMe();
      setCurrentUser(userRes);
      setDisplayNameInput(userRes.profile.display_name || userRes.username);
      setBioInput(userRes.profile.bio || "");
      setPreferredModel(userRes.profile.preferred_model || "gemini-3.5-flash");

      logTelemetry("/api/v1/users/me", "GET", undefined, userRes, 200, "auth");

      // 2. Fetch all chats
      const retrievedChats = await api.listChats();
      setChats(retrievedChats);

      logTelemetry("/api/v1/chats", "GET", undefined, { items: retrievedChats }, 200, "chat");

      // Auto-focus the first chat if available
      if (retrievedChats.length > 0) {
        selectChatSession(retrievedChats[0].id);
      } else {
        // Build a starter chat for them
        createStarterChat();
      }

      setConnectionStatus("connected");
    } catch (err: any) {
      setConnectionStatus("disconnected");
      // Keep currentUser null so they see the authenticated gate screen cleanly
      setCurrentUser(null);
      setErrorBanner(`Authentication check response: ${err.message}. Please sign in to verify access coordinates.`);
    } finally {
      setIsConnecting(false);
    }
  };

  // Perform login transaction to /api/v1/auth/login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError("Credentials cannot be blank.");
      return;
    }

    try {
      setIsConnecting(true);
      setAuthError(null);
      setAuthSuccessMsg(null);

      logTelemetry("/api/v1/auth/login", "POST", { email: authEmail, password: "[MASKED]" }, undefined, 200, "auth");
      
      const loginRes = await api.login(authEmail, authPassword);
      logTelemetry("/api/v1/auth/login", "POST", undefined, { status: "success", access_token: loginRes.access_token.substring(0, 10) + "..." }, 200, "auth");

      setAuthSuccessMsg("Identity verified. Engaging sublight systems!");
      
      // Star Wars success sound
      playBeep(600, 0.08, "triangle");
      setTimeout(() => playBeep(800, 0.08, "triangle"), 80);
      setTimeout(() => playBeep(1200, 0.15, "sine"), 160);

      // Load user & core chat configuration
      await loadUserAndChats();
    } catch (err: any) {
      setAuthError(`Verification failed: ${err.message}`);
      playBeep(140, 0.3, "sawtooth");
    } finally {
      setIsConnecting(false);
    }
  };

  // Perform register transaction to /api/v1/auth/register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authUsername.trim() || !authPassword.trim()) {
      setAuthError("All registry coordinate parameters required.");
      return;
    }

    try {
      setIsConnecting(true);
      setAuthError(null);
      setAuthSuccessMsg(null);

      logTelemetry("/api/v1/auth/register", "POST", { email: authEmail, username: authUsername }, undefined, 201, "auth");
      
      const regRes = await api.register(authEmail, authUsername, authPassword);
      logTelemetry("/api/v1/auth/register", "POST", undefined, regRes, 201, "auth");

      setAuthSuccessMsg("Registry completed successfully! Auto-authenticating credentials...");
      playBeep(520, 0.1, "triangle");
      setTimeout(() => playBeep(650, 0.1, "triangle"), 100);

      // Auto login immediately
      const loginRes = await api.login(authEmail, authPassword);
      logTelemetry("/api/v1/auth/login", "POST", undefined, { status: "success", access_token: loginRes.access_token.substring(0, 10) + "..." }, 200, "auth");

      // Load user & chats
      await loadUserAndChats();
    } catch (err: any) {
      setAuthError(`Registry failed: ${err.message}`);
      playBeep(140, 0.3, "sawtooth");
    } finally {
      setIsConnecting(false);
    }
  };

  // Perform token refresh transaction to /api/v1/auth/refresh
  const handleTokenRefresh = async () => {
    try {
      setIsConnecting(true);
      setErrorBanner(null);

      const key = connectionMode === "simulator" ? "sw_simulated_refresh_token" : "sw_target_refresh_token";
      const existingRefreshToken = localStorage.getItem(key) || "pilot-refresh";

      logTelemetry("/api/v1/auth/refresh", "POST", { refresh_token: existingRefreshToken ? existingRefreshToken.substring(0, 10) + "..." : "none" }, undefined, 200, "auth");
      
      const refreshRes = await api.refreshToken();
      logTelemetry("/api/v1/auth/refresh", "POST", undefined, { status: "token refreshed", access_token: refreshRes.access_token.substring(0, 10) + "..." }, 200, "auth");

      // High-register pinging success sound
      playBeep(880, 0.05, "sine");
      setTimeout(() => playBeep(1100, 0.1, "sine"), 60);

      // Reload profile context using new token
      await loadUserAndChats();
      setAuthSuccessMsg("Subspace security key rotated and updated.");
      setTimeout(() => setAuthSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorBanner(`Security handshake refresh rejected: ${err.message}`);
      playBeep(150, 0.35, "sawtooth");
    } finally {
      setIsConnecting(false);
    }
  };

  // Logout/clear session
  const handleLogout = () => {
    localStorage.removeItem("sw_target_token");
    localStorage.removeItem("sw_simulated_token");
    localStorage.removeItem("sw_target_refresh_token");
    localStorage.removeItem("sw_simulated_refresh_token");
    
    api.setTargetToken("");
    setCurrentUser(null);
    setChats([]);
    setMessages([]);
    setActiveChatId(null);
    setAuthEmail("");
    setAuthUsername("");
    setAuthPassword("");
    setAuthSuccessMsg("Security clearance revoked. Transmitter silenced.");
    
    playBeep(330, 0.2, "sawtooth");
    setTimeout(() => playBeep(220, 0.3, "sawtooth"), 150);
    logTelemetry("/api/v1/auth/logout", "POST", undefined, { status: "tokens purged" }, 200, "auth");
  };

  // Developer bypass guest login to allow test drive without active backend configuration
  const handleDeveloperBypass = () => {
    try {
      setIsConnecting(true);
      setErrorBanner(null);
      setAuthError(null);
      setAuthSuccessMsg(null);
      
      logTelemetry("/api/v1/auth/bypass", "POST", { mode: "simulation-guest" }, undefined, 200, "auth");
      
      const mockUserRes: SwUser = {
        id: "pilot-user",
        email: "skywalker@rebels.org",
        username: "Luke Skywalker",
        profile: {
          display_name: "Luke Skywalker",
          avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop",
          bio: "Jedi Commander. Operating imperial console via sandbox bypass mode.",
          preferred_model: "gemini-3.5-flash"
        }
      };
      
      setCurrentUser(mockUserRes);
      setDisplayNameInput(mockUserRes.profile.display_name || mockUserRes.username);
      setBioInput(mockUserRes.profile.bio || "");
      setPreferredModel(mockUserRes.profile.preferred_model || "gemini-3.5-flash");

      setChats([
        {
          id: "chat-sim-1",
          title: "Galactic Transmitter Offline",
          system_prompt: "Standard backup beacon mode.",
          character_key: "r2d2",
          model: "gemini-3.5-flash",
          created_at: new Date().toISOString()
        }
      ]);
      setActiveChatId("chat-sim-1");
      setMessages([
        {
          id: "msg-sim-1",
          chat_id: "chat-sim-1",
          role: "assistant",
          content: "*screech beep warning* [The system is operating in off-grid simulation mode. Use the endpoints tab and telemetry dashboard to inspect HTTP payloads.]",
          character_key: "r2d2",
          model: "gemini-3.5-flash",
          created_at: new Date().toISOString()
        }
      ]);
      setConnectionStatus("connected");
      playBeep(900, 0.08, "sine");
      setTimeout(() => playBeep(1100, 0.08, "sine"), 80);
    } catch (err: any) {
      setErrorBanner(err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  // Change backend mode and re-engage
  const handleConfigUpdate = async (mode: ConnectionMode, url: string, token: string) => {
    api.setMode(mode);
    api.setTargetUrl(url);
    if (token) api.setTargetToken(token);
    
    setConnectionMode(mode);
    setTargetUrl(url);
    setTargetToken(token);

    playBeep(440, 0.1, "sine");
    setTimeout(() => playBeep(554, 0.1, "sine"), 100);
    setTimeout(() => playBeep(659, 0.15, "sine"), 200);

    logTelemetry(`${url}/health`, "GET", undefined, { message: `Reconfigured connection client to ${mode}` }, 200, "health");
    loadUserAndChats();
  };

  const createStarterChat = async () => {
    try {
      const defaultCharacter = STAR_WARS_CHARACTERS[0]; // R2-D2
      const newChat = await api.createChat(
        "Astromech Diagnostics",
        defaultCharacter.key,
        `You are ${defaultCharacter.name}. Speak consistently inside your character style with full translations.`
      );

      logTelemetry("/api/v1/chats", "POST", { title: "Astromech Diagnostics", character_key: defaultCharacter.key }, newChat, 201, "chat");

      setChats(prev => [newChat, ...prev]);
      setActiveChatId(newChat.id);
      setSelectedCharacter(defaultCharacter);
      
      // Load its welcome messages
      const fullChat = await api.getChat(newChat.id);
      setMessages(fullChat.messages || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const selectChatSession = async (chatId: string) => {
    setActiveChatId(chatId);
    setStreamingTokenAcc("");
    try {
      const fullChat = await api.getChat(chatId);
      setMessages(fullChat.messages || []);
      
      // Determine selected character key
      const activeChar = STAR_WARS_CHARACTERS.find(c => c.key === fullChat.character_key) || STAR_WARS_CHARACTERS[0];
      setSelectedCharacter(activeChar);
      
      triggerCharacterThemeBeeps(activeChar.key);
      logTelemetry(`/api/v1/chats/${chatId}`, "GET", undefined, fullChat, 200, "chat");
    } catch (e: any) {
      setErrorBanner(`Failed to load chat history: ${e.message}`);
    }
  };

  const handleCreateNewChat = async (character: StarWarsCharacter) => {
    try {
      const defaultTitle = `${character.name} Consultation`;
      const systemPrompt = `You are ${character.name}. Key Directive: Always maintain your exact Star Wars tone, sound effects, and behavioral nuances under any prompt. Check your training file context to verify exact dialogue structures.`;
      
      const newChat = await api.createChat(defaultTitle, character.key, systemPrompt);
      logTelemetry("/api/v1/chats", "POST", { title: defaultTitle, character_key: character.key, system_prompt: systemPrompt }, newChat, 201, "chat");

      setChats(prev => [newChat, ...prev]);
      setActiveChatId(newChat.id);
      setSelectedCharacter(character);
      
      // Open instant signal
      const fullChat = await api.getChat(newChat.id);
      setMessages(fullChat.messages || []);
      triggerCharacterThemeBeeps(character.key);
    } catch (err: any) {
      setErrorBanner(`Failed to manufacture terminal session: ${err.message}`);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!confirm("Are you sure you want to delete this transmission record? It will be archived on the galactic servers.")) return;
    try {
      await api.deleteChat(chatId);
      logTelemetry(`/api/v1/chats/${chatId}`, "DELETE", undefined, { status: "deleted" }, 204, "chat");
      
      const remaining = chats.filter(c => c.id !== chatId);
      setChats(remaining);
      playBeep(220, 0.2, "sawtooth");

      if (activeChatId === chatId) {
        if (remaining.length > 0) {
          selectChatSession(remaining[0].id);
        } else {
          setActiveChatId(null);
          setMessages([]);
        }
      }
    } catch (err: any) {
      setErrorBanner(`Could not erase terminal coordinates: ${err.message}`);
    }
  };

  const handleStartRenameChat = (chat: Chat) => {
    setEditingChatId(chat.id);
    setEditChatTitleText(chat.title);
  };

  const handleSaveChatTitle = async (chatId: string) => {
    if (!editChatTitleText.trim()) return;
    try {
      const updatedChat = await api.patchChat(chatId, editChatTitleText);
      logTelemetry(`/api/v1/chats/${chatId}`, "PATCH", { title: editChatTitleText }, updatedChat, 200, "chat");

      setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: editChatTitleText } : c));
      setEditingChatId(null);
      playBeep(650, 0.08, "sine");
    } catch (err: any) {
      setErrorBanner(`Failed to change title: ${err.message}`);
    }
  };

  // User Profile Modifier
  const handleSaveProfile = async () => {
    if (!currentUser) return;
    try {
      const updatedUser = await api.updateMe(currentUser.email, displayNameInput);
      const updatedProfile = await api.updateProfile({
        display_name: displayNameInput,
        bio: bioInput,
        preferred_model: preferredModel
      });

      logTelemetry("/api/v1/users/me/profile", "PATCH", { display_name: displayNameInput, bio: bioInput, preferred_model: preferredModel }, updatedProfile, 200, "auth");

      setCurrentUser({
        ...currentUser,
        username: displayNameInput,
        profile: updatedProfile
      });

      setShowProfileModal(false);
      
      // Star Wars success whistle sequence
      playBeep(400, 0.05, "sine");
      setTimeout(() => playBeep(600, 0.05, "sine"), 60);
      setTimeout(() => playBeep(800, 0.1, "sine"), 120);
    } catch (err: any) {
      setErrorBanner(`Failed to rewrite profile: ${err.message}`);
    }
  };

  // Main transmission action (Send Message)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChatId || isGenerating) return;

    const userText = inputText;
    setInputText("");
    setIsGenerating(true);
    setStreamingTokenAcc("");

    // Setup user message manually inside the feed so it renders instantly
    const userMsgObj: Message = {
      id: `msg-temp-user-${Date.now()}`,
      chat_id: activeChatId,
      role: "user",
      content: userText,
      character_key: selectedCharacter.key,
      model: preferredModel,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsgObj]);

    // Fast static beep for sending commands
    playBeep(700, 0.05, "sine");

    try {
      if (useStreaming) {
        logTelemetry("/api/v1/messages/stream", "POST", { chat_id: activeChatId, content: userText, character_key: selectedCharacter.key }, { status: "Stream Initialized" }, 200, "message");
        
        let localAccumulator = "";
        
        await api.sendMessageStreaming(
          activeChatId,
          userText,
          selectedCharacter.key,
          // onChunk
          (chunk) => {
            localAccumulator += chunk;
            setStreamingTokenAcc(localAccumulator);
            // Simulate droid noise occasionally while typing!
            if (selectedCharacter.key === "r2d2" && Math.random() < 0.08) {
              playBeep(900 + Math.random() * 400, 0.02, "triangle");
            } else if (Math.random() < 0.05) {
              playBeep(300 + Math.random() * 100, 0.03, "sine");
            }
          },
          // onDone
          async () => {
            setIsGenerating(false);
            setStreamingTokenAcc("");
            // Refresh messages list to get clean persisted logs with final message IDs and backend info
            try {
              const fullChat = await api.getChat(activeChatId);
              setMessages(fullChat.messages || []);
              
              // Triumphant mechanical beep on loaded stream completed
              playBeep(1200, 0.08, "sine");
              setTimeout(() => playBeep(1400, 0.1, "sine"), 80);
              logTelemetry(`/api/v1/chats/${activeChatId}`, "GET", undefined, { messageCount: fullChat.messages.length }, 200, "message");
            } catch (err) {
              // fallback
              const finishedMsgObj: Message = {
                id: `msg-completed-${Date.now()}`,
                chat_id: activeChatId,
                role: "assistant",
                content: localAccumulator,
                character_key: selectedCharacter.key,
                model: preferredModel,
                created_at: new Date().toISOString()
              };
              setMessages(prev => [...prev.filter(m => m.id !== userMsgObj.id), userMsgObj, finishedMsgObj]);
            }
          },
          // onError
          (err) => {
            setIsGenerating(false);
            setErrorBanner(`Transmission corrupted over subspace: ${err.message}`);
            playBeep(150, 0.3, "sawtooth");
          }
        );
      } else {
        // Non-streaming endpoint
        logTelemetry("/api/v1/messages", "POST", { chat_id: activeChatId, content: userText, character_key: selectedCharacter.key }, undefined, 201, "message");
        
        const responseMsg = await api.sendMessageNonStreaming(activeChatId, userText, selectedCharacter.key);
        
        logTelemetry("/api/v1/messages", "POST", undefined, responseMsg, 201, "message");
        
        setMessages(prev => [...prev, responseMsg]);
        setIsGenerating(false);
        triggerCharacterThemeBeeps(selectedCharacter.key);
      }
    } catch (err: any) {
      setIsGenerating(false);
      setErrorBanner(`Core transmitter error: ${err.message}`);
      playBeep(150, 0.35, "sawtooth");
    }
  };

  // Helper component to beautiful color based on character key
  const getCharacterThemeClass = (key: string) => {
    switch (key) {
      case "r2d2":
        return {
          border: "border-blue-500/20",
          bg: "bg-blue-950/20",
          text: "text-blue-400",
          glow: "shadow-blue-500/10 hover:shadow-blue-500/20",
          laser: "bg-blue-500",
          badge: "bg-blue-500/10 text-blue-300 border-blue-500/30"
        };
      case "c3po":
        return {
          border: "border-amber-500/20",
          bg: "bg-amber-950/20",
          text: "text-amber-400",
          glow: "shadow-amber-500/10 hover:shadow-amber-500/20",
          laser: "bg-amber-500",
          badge: "bg-amber-500/10 text-amber-300 border-amber-500/30"
        };
      case "yoda":
        return {
          border: "border-emerald-500/20",
          bg: "bg-emerald-950/20",
          text: "text-emerald-400",
          glow: "shadow-emerald-500/10 hover:shadow-emerald-500/20",
          laser: "bg-emerald-500",
          badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
        };
      case "vader":
        return {
          border: "border-red-500/20",
          bg: "bg-red-950/20",
          text: "text-red-400",
          glow: "shadow-red-500/10 hover:shadow-red-500/20",
          laser: "bg-red-500",
          badge: "bg-red-500/10 text-red-300 border-red-500/30"
        };
      default:
        return {
          border: "border-slate-500/20",
          bg: "bg-slate-950/20",
          text: "text-slate-400",
          glow: "shadow-slate-500/10",
          laser: "bg-slate-500",
          badge: "bg-slate-500/10 text-slate-300 border-slate-500/30"
        };
    }
  };

  const handleManualTestPing = async () => {
    setIsConnecting(true);
    try {
      const pingData = await api.testConnection(targetUrl);
      logTelemetry(`${targetUrl}/health`, "GET", undefined, pingData, 200, "health");
      playBeep(880, 0.15, "sine");
      alert(`Ping connection successful! Status: ${pingData.status}. Ready for orbital transmission.`);
      handleConfigUpdate("target", targetUrl, targetToken);
    } catch (e: any) {
      logTelemetry(`${targetUrl}/health`, "GET", undefined, { error: e.message }, 500, "health");
      playBeep(180, 0.3, "sawtooth");
      alert(`Ping failed to coordinates block at ${targetUrl}/health. Make sure your FastAPI webserver is running!`);
    } finally {
      setIsConnecting(false);
    }
  };

  const activeTheme = getCharacterThemeClass(selectedCharacter.key);

  return (
    <div className="min-h-screen space-bg font-sans text-slate-100 flex flex-col selection:bg-blue-500/30 selection:text-white relative overflow-x-hidden holo-scan" id="root-viewport">
      <div className="holo-line"></div>
      
      {/* Dynamic Star Wars Cockpit Header */}
      <header className="border-b border-slate-800 bg-slate-950/85 backdrop-blur-md px-4 py-3 shrink-0 flex items-center justify-between z-10 shadow-lg relative" id="terminal-header">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-xl shadow-inner relative overflow-hidden">
              <span className="relative z-10 text-2xl">⚡</span>
              <div className="absolute inset-0 bg-blue-500/10 animate-pulse"></div>
            </div>
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center">
              <span className="w-1 h-1 rounded-full bg-white animate-ping"></span>
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-teal-300 to-indigo-400">R2-D2 Holocron</h1>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full border border-blue-500/20 bg-blue-950/40 text-blue-300 animate-pulse">v1.0.0</span>
            </div>
            <p className="text-xs text-slate-400 font-mono tracking-tight hidden sm:block">Tactical Star Wars Chatbot & REST API Ground Control</p>
          </div>
        </div>

        {/* Real-time Telemetry state header widget */}
        <div className="flex items-center space-x-4 max-w-lg">
          {/* Sound toggle button */}
          <button 
            type="button"
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              playBeep(600, 0.05, "sine");
            }}
            className="p-2 rounded-md border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title={soundEnabled ? "Mute audio oscillators" : "Enable sound effects"}
            id="audio-selector-btn"
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          {/* Connection parameters button */}
          <div className="hidden md:flex items-center space-x-2 bg-slate-900 px-3 py-1.5 rounded-md border border-slate-800 text-xs font-mono">
            <span className="text-slate-500">Mode:</span>
            <span className={`px-1.5 py-0.5 rounded font-bold ${connectionMode === "simulator" ? "bg-cyan-950 text-cyan-400 border border-cyan-800/50" : "bg-purple-950 text-purple-400 border border-purple-800/50"}`}>
              {connectionMode === "simulator" ? "LOCAL EMULATOR" : "FASTAPI LIVE TARGET"}
            </span>
            <span className="text-slate-600">|</span>
            {connectionStatus === "connected" ? (
              <span className="text-emerald-400 flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block active-beep"></span>
                <span>Active Link</span>
              </span>
            ) : (
              <span className="text-red-400 flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                <span>Offline Link</span>
              </span>
            )}
          </div>

          {/* Profile Badge */}
          {currentUser && (
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 p-1.5 pr-3 rounded-md border border-slate-800 transition-all text-left"
              title="Access Profile Holocron Settings"
              id="profile-trigger-btn"
            >
              <img 
                src={currentUser.profile.avatar_url || "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=150&h=150&fit=crop"} 
                alt="Avatar" 
                className="w-7 h-7 rounded object-cover border border-slate-700"
              />
              <div className="hidden lg:block">
                <div className="text-xs font-semibold text-slate-200 leading-tight">{currentUser.profile.display_name || currentUser.username}</div>
                <div className="text-[10px] text-slate-500 font-mono leading-tight">{currentUser.email}</div>
              </div>
            </button>
          )}

          {/* Revoke Credentials (Logout) */}
          {currentUser && (
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 bg-red-900/20 hover:bg-red-900/30 text-rose-400 hover:text-rose-300 border border-red-900/40 px-3 py-2 rounded-md transition-all text-xs font-mono font-bold"
              title="Revoke clearance token and sign out"
              id="sign-out-btn"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline font-bold">Sign Out</span>
            </button>
          )}
        </div>
      </header>

      {/* Connection Mode Configurator Sub-bar */}
      <div className="bg-slate-950/70 border-b border-slate-900 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs" id="connection-ribbon">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-mono flex items-center gap-1">
            <Database size={13} className="text-blue-400" />
            <span>Telemetry Link:</span>
          </span>
          <div className="inline-flex rounded border border-slate-800 overflow-hidden bg-slate-900 p-0.5">
            <button
              type="button"
              onClick={() => handleConfigUpdate("simulator", targetUrl, targetToken)}
              className={`px-3 py-1 rounded text-[11px] font-mono transition-all uppercase font-medium ${connectionMode === "simulator" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
              id="mode-sim-btn"
            >
              🌌 Built-in Simulator
            </button>
            <button
              type="button"
              onClick={() => handleConfigUpdate("target", targetUrl, targetToken)}
              className={`px-3 py-1 rounded text-[11px] font-mono transition-all uppercase font-medium ${connectionMode === "target" ? "bg-purple-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
              id="mode-target-btn"
            >
              🛰️ External FastAPI Router
            </button>
          </div>
        </div>

        {connectionMode === "target" && (
          <div className="flex items-center gap-2 w-full sm:w-auto animate-fade-in">
            <input 
              type="text" 
              placeholder="Target API prefix e.g. http://localhost:8000/api/v1"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-200 px-2 py-1 rounded-sm w-56 font-mono text-xs focus:outline-none focus:border-purple-500"
              id="target-url-input"
            />
            <input 
              type="password" 
              placeholder="Authorization Token (Bearer)"
              value={targetToken}
              onChange={(e) => setTargetToken(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-200 px-2 py-1 rounded-sm w-36 font-mono text-xs focus:outline-none focus:border-purple-500"
              title="Leave empty if using simulation token"
              id="target-token-input"
            />
            <button 
              type="button"
              onClick={handleManualTestPing}
              className="bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800/50 px-3 py-1 rounded font-mono font-medium hover:text-white transition-colors flex items-center gap-1 shrink-0"
              id="test-ping-btn"
            >
              <Wifi size={12} />
              <span>Ping & Apply</span>
            </button>
          </div>
        )}

        {connectionMode === "simulator" && (
          <div className="text-slate-400 font-mono text-[11px] text-right flex items-center justify-end gap-1.5 ml-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>Local sandbox handles server-side Gemini generation. Key check ok.</span>
          </div>
        )}
      </div>

      {/* Warning/Error Banner */}
      {errorBanner && (
        <div className="bg-red-950/80 border-b border-red-900 px-4 py-2 flex items-center justify-between text-xs text-red-300 relative z-20" id="error-notification-banner">
          <div className="flex items-center space-x-2">
            <AlertTriangle size={14} className="animate-bounce" />
            <span>{errorBanner}</span>
          </div>
          <button 
            onClick={() => setErrorBanner(null)} 
            className="text-red-400 hover:text-red-200 font-bold px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Structural Layout */}
      <div className="flex-1 flex overflow-hidden relative" id="main-terminal-body">
        
        {!currentUser ? (
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-950/40 relative overflow-y-auto z-10" id="authentication-pane">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(30,41,59,0.5)_0%,rgba(2,6,23,0.9)_100%)]"></div>
            
            <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative z-10 backdrop-blur-md" id="auth-terminal-card">
              <div className="bg-slate-950 p-5 border-b border-slate-800 text-center relative">
                <div className="holo-line"></div>
                
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-blue-950/40 border border-blue-500/30 flex items-center justify-center relative overflow-hidden">
                  <Shield className="text-blue-400 animate-pulse" size={26} />
                  <div className="absolute inset-x-0 h-0.5 bg-blue-400/80 animate-scan"></div>
                </div>

                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300 font-mono">
                  {isRegisterMode ? "Security Beacon Registry" : "Imperial Terminal Access"}
                </h2>
                <p className="text-[10px] text-slate-500 font-mono tracking-tight mt-1">
                  {isRegisterMode ? "Transmit authorization coordinates for new account" : "Enter clearance credentials to decrypt holocron feed"}
                </p>
              </div>

              {authSuccessMsg && (
                <div className="mx-5 mt-4 p-3 bg-emerald-950/50 border border-emerald-900 rounded-lg text-xs leading-relaxed text-emerald-300 font-mono flex items-center gap-2" id="auth-success-alert">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
                  <span>{authSuccessMsg}</span>
                </div>
              )}

              {authError && (
                <div className="mx-5 mt-4 p-3 bg-red-950/50 border border-red-900 rounded-lg text-xs leading-relaxed text-red-300 font-mono flex items-center gap-2" id="auth-error-alert">
                  <AlertTriangle size={14} className="shrink-0 text-red-400 animate-bounce" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={isRegisterMode ? handleRegisterSubmit : handleLoginSubmit} className="p-5 space-y-4 font-mono" id="auth-gate-form">
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Subsector Email Address</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500">
                      <Mail size={14} />
                    </span>
                    <input 
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="comms@alliance.net"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                      id="auth-email-input"
                    />
                  </div>
                </div>

                {isRegisterMode && (
                  <div className="space-y-1 animate-fade-in">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Transmitter Callsign (Username)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-500">
                        <User size={14} />
                      </span>
                      <input 
                        type="text"
                        required={isRegisterMode}
                        value={authUsername}
                        onChange={(e) => setAuthUsername(e.target.value)}
                        placeholder="Commander Solo"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                        id="auth-username-input"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Decryption Pass Key</label>
                    <span className="text-[9px] text-slate-500 font-mono">encrypted lock</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500">
                      <Lock size={14} />
                    </span>
                    <input 
                      type={showPassword ? "text" : "password"}
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-9 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                      id="auth-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowPassword(!showPassword);
                        playBeep(500, 0.04, "sine");
                      }}
                      className="absolute right-3 top-2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isConnecting}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg text-xs tracking-wider uppercase transition-all flex items-center justify-center space-x-1 border border-blue-500 shadow-md shadow-blue-500/15 disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <span className="w-4 h-4 rounded-full border border-slate-300 border-t-white animate-spin"></span>
                    ) : isRegisterMode ? (
                      <>
                        <UserPlus size={13} />
                        <span>Deploy Registry Beacon</span>
                      </>
                    ) : (
                      <>
                        <Shield size={13} />
                        <span>Verify Decryption Clearance</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3 text-xs font-mono text-center">
                <div className="text-[11px] text-slate-400">
                  {isRegisterMode ? (
                    <span>
                      Already registered? {" "}
                      <button
                        type="button"
                        onClick={() => {
                          setIsRegisterMode(false);
                          setAuthError(null);
                          setAuthSuccessMsg(null);
                          playBeep(450, 0.05, "sine");
                        }}
                        className="text-blue-400 hover:text-blue-300 underline"
                      >
                        Scan Access ID
                      </button>
                    </span>
                  ) : (
                    <span>
                      First-time terminal explorer? {" "}
                      <button
                        type="button"
                        onClick={() => {
                          setIsRegisterMode(true);
                          setAuthError(null);
                          setAuthSuccessMsg(null);
                          playBeep(450, 0.05, "sine");
                        }}
                        className="text-blue-400 hover:text-blue-300 underline"
                      >
                        Establish Free Account
                      </button>
                    </span>
                  )}
                </div>

                <div className="text-[10px] text-slate-600 border-t border-slate-900 pt-2.5 flex flex-col space-y-2">
                  <span>OR BYPASS CONNECTION INSTANTLY FOR PREVIEW</span>
                  <div className="flex gap-1.5 justify-center">
                    <button
                      type="button"
                      onClick={handleDeveloperBypass}
                      className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-slate-200 rounded text-[9px] text-slate-400 uppercase tracking-widest transition-colors font-bold"
                      title="Open terminal mock offline environment"
                    >
                      🛸 Simulation Guest Access
                    </button>
                    <button
                      type="button"
                      onClick={handleTokenRefresh}
                      className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-purple-300 rounded text-[9px] text-slate-400 uppercase tracking-widest transition-colors flex items-center gap-1 font-bold"
                      title="Step 3: Trigger OAuth POST /api/v1/auth/refresh to cycle token"
                    >
                      <RefreshCw size={10} className="animate-spin" />
                      <span>Rotate Key</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* SIDEBAR: Transmissions Scanner List & Character Recruiter */}
        <aside className="w-72 bg-slate-950/90 border-r border-slate-900 flex flex-col shrink-0 hidden md:flex z-10" id="sidebar-transmissions">
          
          {/* Create Chat Quick Character Selection Grid */}
          <div className="p-4 border-b border-slate-900 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase font-mono flex items-center gap-1.5">
                <Bot size={13} className="text-blue-400" />
                <span>Initialize Droid</span>
              </h2>
              <span className="text-[10px] text-slate-500 font-mono">Select Key</span>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {STAR_WARS_CHARACTERS.map((char) => {
                const isCurrent = selectedCharacter.key === char.key;
                return (
                  <button
                    key={char.key}
                    onClick={() => handleCreateNewChat(char)}
                    className={`h-11 rounded-md border flex flex-col items-center justify-center transition-all relative group overflow-hidden ${
                      isCurrent 
                        ? "bg-slate-900 border-slate-700 shadow-md ring-1 ring-blue-500/30" 
                        : "bg-slate-950 hover:bg-slate-900 border-slate-800/80"
                    }`}
                    title={`Recruit ${char.name} under ${char.faction}`}
                    id={`droid-recruit-${char.key}`}
                  >
                    <span className="text-xl relative z-10">{char.avatarImg}</span>
                    <span className="text-[9px] font-mono leading-tight uppercase font-medium tracking-tight mt-0.5 relative z-10 text-slate-400 group-hover:text-slate-200">
                      {char.key}
                    </span>
                    <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity bg-gradient-to-t from-blue-500" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Chats list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className="flex items-center justify-between px-2 pb-1 text-xs text-slate-500 font-mono">
              <span className="uppercase tracking-wider">Historical Logs</span>
              <span>({chats.length} found)</span>
            </div>

            {chats.length === 0 ? (
              <div className="text-center py-8 px-4 text-slate-600 border border-dashed border-slate-900 rounded-md">
                <Radio className="mx-auto text-slate-700 animate-pulse mb-2" size={20} />
                <p className="text-xs font-mono">No communication telemetry logs found. Tap active droids to write new transmissions.</p>
              </div>
            ) : (
              chats.map((c) => {
                const isActive = activeChatId === c.id;
                const charDetails = STAR_WARS_CHARACTERS.find(char => char.key === c.character_key) || STAR_WARS_CHARACTERS[0];
                const theme = getCharacterThemeClass(c.character_key);

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (editingChatId !== c.id) selectChatSession(c.id);
                    }}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all relative group ${
                      isActive 
                        ? `bg-slate-900/90 ${theme.border} border-l-4 shadow-sm pl-2` 
                        : "bg-slate-950 hover:bg-slate-900/60 border-slate-900/70"
                    }`}
                    id={`chat-item-${c.id}`}
                  >
                    {/* Tiny laser left bar */}
                    {isActive && (
                      <div className={`absolute top-0 bottom-0 left-0 w-1 ${theme.laser}`} />
                    )}

                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        {editingChatId === c.id ? (
                          <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="text" 
                              value={editChatTitleText}
                              onChange={(e) => setEditChatTitleText(e.target.value)}
                              className="bg-slate-900 text-xs text-slate-100 border border-slate-700 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveChatTitle(c.id);
                                if (e.key === "Escape") setEditingChatId(null);
                              }}
                              autoFocus
                              id={`chat-rename-input-${c.id}`}
                            />
                            <button 
                              onClick={() => handleSaveChatTitle(c.id)}
                              className="p-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800"
                            >
                              <Check size={11} />
                            </button>
                          </div>
                        ) : (
                          <p className={`text-xs font-semibold truncate ${isActive ? theme.text : "text-slate-300"}`}>
                            {c.title}
                          </p>
                        )}
                        <div className="flex items-center space-x-1.5 mt-1 font-mono text-[10px] text-slate-500">
                          <span>{charDetails.avatarImg} {charDetails.name}</span>
                          <span>•</span>
                          <span className="uppercase">{c.model.replace("gemini-", "")}</span>
                        </div>
                      </div>

                      {/* Action Hover Controls */}
                      <div className="flex items-center space-x-1 bg-slate-950/80 rounded px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleStartRenameChat(c)}
                          className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                          title="Rename log coordinate"
                          id={`chat-rename-btn-${c.id}`}
                        >
                          <Edit3 size={11} />
                        </button>
                        <button
                          onClick={() => handleDeleteChat(c.id)}
                          className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                          title="Format transmission history"
                          id={`chat-delete-btn-${c.id}`}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Stats sidebar footer with health coordinate link */}
          <div className="p-3 bg-slate-950 border-t border-slate-900 text-[11px] font-mono text-slate-400 shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <span>DB Integrity:</span>
              <span className="text-emerald-400 flex items-center gap-0.5">
                <Check size={11} />
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Streaming engine:</span>
              <span className="text-blue-400">SSE Enlisted</span>
            </div>
          </div>
        </aside>

        {/* MIDDLE BAR: Complete interactive chat terminal */}
        <main className="flex-1 flex flex-col bg-slate-950/50 relative overflow-hidden" id="chat-stage">
          
          {/* Active Droid Hologram Intro */}
          <div className={`p-4 border-b border-slate-900 bg-slate-950/80 backdrop-blur shrink-0 flex items-center justify-between ${activeTheme.border}`} id="chat-stage-header">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-3xl shadow-lg holo-scan">
                  <span>{selectedCharacter.avatarImg}</span>
                  {isGenerating && (
                    <div className="absolute inset-0 rounded-full border-2 border-dashed border-blue-500 animate-spin opacity-40"></div>
                  )}
                </div>
                <div className={`absolute -bottom-1 -right-0.5 w-4 h-4 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${isGenerating ? "bg-red-500 animate-ping" : "bg-emerald-500"}`}></div>
                </div>
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase">{selectedCharacter.name}</h3>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-mono tracking-wider ${activeTheme.badge}`}>
                    {selectedCharacter.faction}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono italic mt-0.5">
                  &quot;{selectedCharacter.motto}&quot;
                </p>
              </div>
            </div>

            {/* Quick configuration toggle panel */}
            <div className="flex items-center space-x-3 text-xs">
              <label 
                className="flex items-center space-x-1.5 cursor-pointer text-slate-400 hover:text-slate-200 select-none font-mono"
                title="Toggles between SSE (chunks) or regular response body payload."
              >
                <input 
                  type="checkbox" 
                  checked={useStreaming}
                  onChange={(e) => {
                    setUseStreaming(e.target.checked);
                    playBeep(500, 0.05, "sine");
                  }}
                  className="rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-0"
                  id="streaming-mode-toggle"
                />
                <span className="text-[11px] uppercase tracking-tighter">Event-Stream (SSE)</span>
              </label>

              {/* Reset active droid session */}
              <button
                type="button"
                onClick={() => {
                  if (activeChatId) selectChatSession(activeChatId);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-800 flex items-center space-x-1 font-mono"
                title="Reset local dialogue cycle"
                id="reset-chat-btn"
              >
                <RefreshCw size={12} className={isGenerating ? "animate-spin" : ""} />
                <span className="text-[10px] uppercase">Re-sync</span>
              </button>
            </div>
          </div>

          {/* Interactive Messages Stream List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" id="messages-container">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
                <Radio size={40} className="text-slate-700 mb-3 animate-pulse" />
                <h4 className="text-base font-semibold text-slate-400 uppercase tracking-widest font-mono">Satellite Signals Scanning...</h4>
                <p className="text-xs max-w-sm mt-1 font-mono">The subspace radio is open. Give your mechanical droid coordinate instructions to begin transmission.</p>
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.role === "user";
                const mCharKey = m.character_key || selectedCharacter.key;
                const mChar = STAR_WARS_CHARACTERS.find(c => c.key === mCharKey) || selectedCharacter;
                const mTheme = getCharacterThemeClass(mCharKey);

                return (
                  <div
                    key={m.id}
                    className={`flex items-start tracking-tight ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}
                    id={`message-bubble-${m.id}`}
                  >
                    <div className={`flex items-start max-w-2xl space-x-3 ${isUser ? "flex-row-reverse space-x-reverse" : "flex-row"}`}>
                      
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full border shrink-0 flex items-center justify-center text-lg relative z-10 select-none ${
                        isUser 
                          ? "bg-slate-900 border-slate-700" 
                          : `bg-slate-950 ${mTheme.border}`
                      }`}>
                        <span>{isUser ? "👤" : mChar.avatarImg}</span>
                      </div>

                      {/* Content panel bubble */}
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 px-1">
                          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                            {isUser ? "Rebel Commander" : mChar.name}
                          </span>
                          <span className="text-[9px] font-mono text-slate-600">
                            {m.created_at ? new Date(m.created_at).toLocaleTimeString() : ""}
                          </span>
                        </div>

                        <div className={`px-4 py-2.5 rounded-xl border text-sm ${
                          isUser 
                            ? "bg-slate-900/90 border-slate-700/60 text-slate-200 rounded-tr-none" 
                            : `bg-slate-950/80 ${mTheme.border} text-slate-100 rounded-tl-none ${mTheme.glow}`
                        }`}>
                          {/* Parse the bracket translations dynamically for extra flavor */}
                          <div className="whitespace-pre-wrap leading-relaxed">
                            {m.content}
                          </div>
                        </div>

                        {/* Extra developer-friendly metrics like model and token counts */}
                        {!isUser && (
                          <div className="flex items-center space-x-2 px-1 text-[9px] font-mono text-slate-600">
                            <span>Route: {useStreaming ? "/messages/stream" : "/messages"}</span>
                            <span>•</span>
                            <span>Model: {m.model || preferredModel}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Simulated Live Token Streaming chunk display */}
            {isGenerating && streamingTokenAcc && (
              <div className="flex items-start justify-start animate-pulse" id="streaming-accumulator-bubble">
                <div className="flex items-start max-w-2xl space-x-3">
                  <div className={`w-8 h-8 rounded-full border border-blue-500/20 bg-slate-950 shrink-0 flex items-center justify-center text-lg`}>
                    <span>{selectedCharacter.avatarImg}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase px-1">
                      {selectedCharacter.name} <span className="text-cyan-400 text-[8px] animate-pulse">(STREAMING...)</span>
                    </div>
                    <div className={`px-4 py-2.5 rounded-xl border border-blue-500/30 bg-slate-950/95 text-slate-100 rounded-tl-none shadow-md shadow-blue-500/5`}>
                      <span className="whitespace-pre-wrap leading-relaxed">
                        {streamingTokenAcc}
                      </span>
                      <span className="w-1.5 h-3.5 bg-blue-400 ml-1 inline-block animate-ping"></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Simple Loading Placeholder spinner when waiting first tokens */}
            {isGenerating && !streamingTokenAcc && (
              <div className="flex items-center space-x-2 text-slate-500 font-mono text-xs pl-12 py-2" id="droid-processing-spinner">
                <div className="w-4 h-4 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin"></div>
                <span>
                  {selectedCharacter.key === "r2d2" && "R2-D2 is revolving binary converters..."}
                  {selectedCharacter.key === "c3po" && "C-3PO is assessing existential odds of answers..."}
                  {selectedCharacter.key === "yoda" && "Yoda is focusing inner living Force flow..."}
                  {selectedCharacter.key === "vader" && "Darth Vader is calculating the dark strategy..."}
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Message Input Area */}
          <div className="p-4 border-t border-slate-900 bg-slate-950/80 backdrop-blur shrink-0" id="chat-stage-footer">
            <form onSubmit={handleSendMessage} className="flex items-center space-x-2" id="chat-input-form">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isGenerating ? "Transmitting state..." : `Send a signal transmission to ${selectedCharacter.name}...`}
                disabled={isGenerating || !activeChatId}
                className="flex-1 bg-slate-900/90 text-slate-100 border border-slate-800 placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm font-sans focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                id="message-text-input"
              />
              <button
                type="submit"
                disabled={isGenerating || !inputText.trim() || !activeChatId}
                className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-lg border border-blue-500 shadow-lg shadow-blue-500/10 disabled:opacity-30 disabled:hover:bg-blue-600 transition-all flex items-center justify-center shrink-0"
                title="Send Command"
                id="message-submit-btn"
              >
                <Send size={16} />
              </button>
            </form>
            
            <div className="flex flex-wrap items-center justify-between mt-2 font-mono text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <Shield size={10} className="text-slate-500" />
                <span>Authorization Status: Bearer validated.</span>
              </span>
              <span>Submit with [ENTER]</span>
            </div>
          </div>
        </main>

        {/* RIGHT PANEL: Live REST API Diagnostics Workbench Dashboard */}
        <section className="w-80 border-l border-slate-900 bg-slate-950/90 hidden lg:flex flex-col shrink-0 overflow-hidden text-slate-300 z-10" id="sidebar-telemetry">
          {/* Header tabs tab selectors */}
          <div className="border-b border-slate-900 bg-slate-950 p-2 grid grid-cols-3 gap-1" id="telemetry-views-header">
            <button
              onClick={() => setActiveTab("chat")}
              className={`py-1 rounded text-center text-[10px] font-mono uppercase tracking-wider ${activeTab === "chat" ? "bg-slate-900 text-white border border-slate-800 font-bold" : "text-slate-400 hover:text-slate-300"}`}
              id="tab-btn-telemetry"
            >
              Telemetry
            </button>
            <button
              onClick={() => setActiveTab("endpoints")}
              className={`py-1 rounded text-center text-[10px] font-mono uppercase tracking-wider ${activeTab === "endpoints" ? "bg-slate-900 text-white border border-slate-800 font-bold" : "text-slate-400 hover:text-slate-300"}`}
              id="tab-btn-endpoints"
            >
              Endpoints
            </button>
            <button
              onClick={() => setActiveTab("schemas")}
              className={`py-1 rounded text-center text-[10px] font-mono uppercase tracking-wider ${activeTab === "schemas" ? "bg-slate-900 text-white border border-slate-850 font-bold" : "text-slate-400 hover:text-slate-300"}`}
              id="tab-btn-schemas"
            >
              Schema Model
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === "chat" && (
              <div className="p-4 space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                    📡 Transmission Feed
                  </h3>
                  <button
                    onClick={() => {
                      setTelemetryLogs([]);
                      playBeep(220, 0.05, "sine");
                    }}
                    className="text-[10px] text-slate-500 hover:text-slate-300 underline"
                  >
                    Clear logs
                  </button>
                </div>
                
                <p className="text-[11px] text-slate-400 leading-normal">
                  This interactive monitor displays real-time HTTP payloads sent by this client interface directly mapping to the fastapi endpoints backend of R2D2.
                </p>

                <div className="space-y-3">
                  {telemetryLogs.map((log, index) => {
                    const statusColor = log.status < 300 ? "text-emerald-400" : "text-red-400";
                    const methodColor = log.method === "POST" ? "text-purple-400" : log.method === "PATCH" ? "text-yellow-400" : log.method === "DELETE" ? "text-red-400" : "text-cyan-400";
                    
                    return (
                      <div key={index} className="p-2 bg-slate-900 rounded border border-slate-850 space-y-1.5" id={`telemetry-item-${index}`}>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`font-bold ${methodColor}`}>
                            [{log.method}] <span className="text-slate-300">{log.endpoint}</span>
                          </span>
                          <span className="text-slate-500">{log.timestamp}</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-[10px] bg-slate-950 p-1 rounded">
                          <span className="text-slate-500">Status Code:</span>
                          <span className={`font-bold ${statusColor}`}>{log.status}</span>
                        </div>

                        {log.requestPayload && (
                          <div className="space-y-0.5">
                            <span className="text-slate-500 text-[9px] uppercase">Request Body:</span>
                            <pre className="bg-slate-950 p-1.5 rounded overflow-x-auto text-[10px] max-h-24 font-mono text-blue-300">
                              {JSON.stringify(log.requestPayload, null, 2)}
                            </pre>
                          </div>
                        )}

                        {log.responsePayload && (
                          <div className="space-y-0.5">
                            <span className="text-slate-500 text-[9px] uppercase">Response Body:</span>
                            <pre className="bg-slate-950 p-1.5 rounded overflow-x-auto text-[10px] max-h-32 font-mono text-green-300">
                              {JSON.stringify(log.responsePayload, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "endpoints" && (
              <div className="p-4 space-y-4 font-mono text-xs">
                <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                  🪐 Rest API Catalog
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  FastAPI endpoints documented in the API specifications mapping layout.
                </p>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-1">
                      <span className="bg-cyan-950 text-cyan-400 px-1 py-0.5 rounded text-[9px] font-bold">GET</span>
                      <span className="font-semibold text-slate-200">/api/v1/health</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">Returns health diagnostic coordinate mapping parameters.</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center space-x-1">
                      <span className="bg-purple-950 text-purple-400 px-1 py-0.5 rounded text-[9px] font-bold">POST</span>
                      <span className="font-semibold text-slate-200">/api/v1/auth/login</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">Requests token for access credentials.</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center space-x-1">
                      <span className="bg-purple-950 text-purple-400 px-1 py-0.5 rounded text-[9px] font-bold">POST</span>
                      <span className="font-semibold text-slate-200">/api/v1/chats</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">Initialize new session. Parameters: `title`, `character_key`, `model`.</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center space-x-1">
                      <span className="bg-purple-950 text-purple-400 px-1 py-0.5 rounded text-[9px] font-bold">POST</span>
                      <span className="font-semibold text-slate-200">/api/v1/messages</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">Returns user query feedback using discrete prompt parameters (non-streaming).</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center space-x-1">
                      <span className="bg-purple-950 text-purple-400 px-1 py-0.5 rounded text-[9px] font-bold">POST</span>
                      <span className="font-semibold text-slate-200">/api/v1/messages/stream</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">Returns server-sent event stream chunk loops. Highly persistent for responsive interfaces.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "schemas" && (
              <div className="p-4 space-y-4 font-mono text-xs">
                <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                  📦 Payload Models
                </h3>
                <p className="text-[11px] text-slate-400">
                  Schemas expected by the REST API validators.
                </p>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <span className="text-slate-200 font-bold block">ChatCreate:</span>
                    <pre className="bg-slate-900 p-2 rounded text-[10px] leading-tight text-yellow-300">
{`{
  "title": "string",
  "system_prompt": "string",
  "character_key": "r2d2" | "c3po" | "yoda" | "vader",
  "model": "string"
}`}
                    </pre>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-200 font-bold block">MessageCreate:</span>
                    <pre className="bg-slate-900 p-2 rounded text-[10px] leading-tight text-blue-300">
{`{
  "chat_id": "uuid",
  "content": "string",
  "character_key": "string"
}`}
                    </pre>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-200 font-bold block">StreamMessageRequest:</span>
                    <pre className="bg-slate-900 p-2 rounded text-[10px] leading-tight text-cyan-300">
{`{
  "chat_id": "uuid",
  "content": "string",
  "character_key": "string"
}`}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
          </>
        )}
      </div>

      {/* MODAL: Edit Profile and Custom Configuration settings */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="profile-modal">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-wider uppercase text-blue-400 flex items-center gap-1.5">
                <User size={15} />
                <span>Command Center Profile Settings</span>
              </h3>
              <button 
                onClick={() => {
                  setShowProfileModal(false);
                  playBeep(400, 0.05, "sine");
                }}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Commander Display Name</label>
                <input 
                  type="text" 
                  value={displayNameInput} 
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  id="profile-display-name-input"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Subsector Bio Description</label>
                <textarea 
                  value={bioInput} 
                  onChange={(e) => setBioInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 font-mono h-20"
                  id="profile-bio-input"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Preferred Translation Model</label>
                <select
                  value={preferredModel}
                  onChange={(e) => setPreferredModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  id="profile-model-selector"
                >
                  <option value="gemini-3.5-flash">gemini-3.5-flash (Standard Holocron)</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro (High intelligence)</option>
                </select>
                <p className="text-[10px] text-slate-500 font-mono mt-1">This feeds into the `model` request schema field inside `ChatCreate` queries.</p>
              </div>

              {currentUser && (
                <div className="border border-slate-800 bg-slate-950/60 p-3 rounded text-[11px] font-mono text-slate-400 flex items-center space-x-3">
                  <img 
                    src={currentUser.profile.avatar_url} 
                    alt="Space Explorer avatar icon representation"
                    className="w-12 h-12 rounded object-cover border border-slate-700" 
                  />
                  <div>
                    <div className="text-slate-200">Account Username: {currentUser.username}</div>
                    <div>Email: {currentUser.email}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-950/60 p-4 border-t border-slate-800 flex items-center justify-end space-x-2">
              <button 
                onClick={() => {
                  setShowProfileModal(false);
                  playBeep(400, 0.05, "sine");
                }}
                className="px-4 py-2 border border-slate-800 hover:bg-slate-900 rounded-lg text-xs font-mono text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveProfile}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-mono font-bold hover:shadow-lg hover:shadow-blue-500/10 transition-all"
              >
                Save Protocol
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
