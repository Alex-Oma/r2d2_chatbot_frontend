import { ApiConfig, ConnectionMode, Chat, Message, User, UserProfile } from "../types";

class StarWarsApiClient {
  private config: ApiConfig = {
    mode: "target",
    targetUrl: "http://localhost:8000/api/v1",
    token: localStorage.getItem("sw_target_token") || "",
    simulatedToken: "pilot-token",
    activeChatId: null
  };

  constructor() {
    // Sync to local storage
    const storedMode = localStorage.getItem("sw_api_mode") as ConnectionMode;
    const storedTargetUrl = localStorage.getItem("sw_target_url");
    if (storedMode) this.config.mode = storedMode;
    if (storedTargetUrl) this.config.targetUrl = storedTargetUrl;
  }

  getConfig(): ApiConfig {
    return { ...this.config };
  }

  setMode(mode: ConnectionMode) {
    this.config.mode = mode;
    localStorage.setItem("sw_api_mode", mode);
  }

  setTargetUrl(url: string) {
    // Remove trailing slash if present
    const sanitized = url.endsWith("/") ? url.slice(0, -1) : url;
    this.config.targetUrl = sanitized;
    localStorage.setItem("sw_target_url", sanitized);
  }

  setTargetToken(token: string) {
    this.config.token = token;
    localStorage.setItem("sw_target_token", token);
  }

  private getBaseUrl(): string {
    if (this.config.mode === "simulator") {
      // Relative path to current node server which is serving the simulator
      return "/api/v1";
    }
    return this.config.targetUrl;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json"
    };
    const token = this.config.mode === "simulator" ? this.config.simulatedToken : this.config.token;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  async register(email: string, username: string, passwordString: string): Promise<User> {
    const url = `${this.getBaseUrl()}/auth/register`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password: passwordString })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Registration failed." }));
      throw new Error(err.detail || "Registration aborted.");
    }
    return response.json();
  }

  async login(email: string, passwordString: string): Promise<{ access_token: string; refresh_token?: string }> {
    const url = `${this.getBaseUrl()}/auth/login`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: passwordString })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Login failed." }));
      throw new Error(err.detail || "Login credentials rejected.");
    }
    const data = await response.json();
    if (this.config.mode === "simulator") {
      this.config.simulatedToken = data.access_token;
      if (data.refresh_token) {
        localStorage.setItem("sw_simulated_refresh_token", data.refresh_token);
      }
    } else {
      this.setTargetToken(data.access_token);
      if (data.refresh_token) {
        localStorage.setItem("sw_target_refresh_token", data.refresh_token);
      }
    }
    return data;
  }

  async refreshToken(): Promise<{ access_token: string; refresh_token: string }> {
    const key = this.config.mode === "simulator" ? "sw_simulated_refresh_token" : "sw_target_refresh_token";
    const refToken = localStorage.getItem(key) || "pilot-refresh";
    
    const url = `${this.getBaseUrl()}/auth/refresh`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refToken })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Token refresh failed." }));
      throw new Error(err.detail || "Subspace token refresh rejected.");
    }
    const data = await response.json();
    if (this.config.mode === "simulator") {
      this.config.simulatedToken = data.access_token;
      if (data.refresh_token) {
        localStorage.setItem("sw_simulated_refresh_token", data.refresh_token);
      }
    } else {
      this.setTargetToken(data.access_token);
      if (data.refresh_token) {
        localStorage.setItem("sw_target_refresh_token", data.refresh_token);
      }
    }
    return data;
  }

  async testConnection(url: string): Promise<{ status: string; app?: string; database?: string }> {
    const response = await fetch(`${url}/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    if (!response.ok) throw new Error("Could not ping health coordinates.");
    return response.json();
  }

  async getMe(): Promise<User> {
    const url = `${this.getBaseUrl()}/users/me`;
    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error("Failed to scan current user logs.");
    return response.json();
  }

  async updateMe(email?: string, username?: string): Promise<User> {
    const url = `${this.getBaseUrl()}/users/me`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify({ email, username })
    });
    if (!response.ok) throw new Error("Failed to update user records.");
    return response.json();
  }

  async updateProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
    const url = `${this.getBaseUrl()}/users/me/profile`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify(profile)
    });
    if (!response.ok) throw new Error("Failed to edit user profile core.");
    return response.json();
  }

  async listChats(): Promise<Chat[]> {
    const url = `${this.getBaseUrl()}/chats`;
    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error("Could not retrieve holocron chat logs.");
    const data = await response.json();
    // Server returns PaginatedResponse: { items: Chat[], total, page, page_size }
    return data.items || data;
  }

  async createChat(title: string, characterKey: string, systemPrompt?: string): Promise<Chat> {
    const url = `${this.getBaseUrl()}/chats`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        title,
        character_key: characterKey,
        system_prompt: systemPrompt || `You are Star Wars character: ${characterKey}`,
        model: "gemini-3.5-flash"
      })
    });
    if (!response.ok) throw new Error("Could not initialize new chat terminal.");
    return response.json();
  }

  async patchChat(chatId: string, title: string): Promise<Chat> {
    const url = `${this.getBaseUrl()}/chats/${chatId}`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify({ title })
    });
    if (!response.ok) throw new Error("Could not update chat parameters.");
    return response.json();
  }

  async deleteChat(chatId: string): Promise<void> {
    const url = `${this.getBaseUrl()}/chats/${chatId}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error("Could not soft-delete selected session.");
  }

  async getChat(chatId: string): Promise<Chat & { messages: Message[] }> {
    const url = `${this.getBaseUrl()}/chats/${chatId}`;
    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error("Coordinate file not found or corrupted.");
    return response.json();
  }

  async listMessages(chatId: string): Promise<Message[]> {
    const url = `${this.getBaseUrl()}/messages/${chatId}`;
    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error("Could not extract signal logs.");
    const data = await response.json();
    return data.items || data;
  }

  async sendMessageNonStreaming(chatId: string, content: string, characterKey: string): Promise<Message> {
    const url = `${this.getBaseUrl()}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        chat_id: chatId,
        content,
        character_key: characterKey
      })
    });
    if (!response.ok) throw new Error("Signal transmission crashed.");
    return response.json();
  }

  // Handle Event-Stream response token by token
  async sendMessageStreaming(
    chatId: string,
    content: string,
    characterKey: string,
    onChunk: (text: string) => void,
    onDone: () => void,
    onError: (err: Error) => void
  ) {
    const url = `${this.getBaseUrl()}/messages/stream`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          chat_id: chatId,
          content,
          character_key: characterKey
        })
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({ detail: "Signal break." }));
        throw new Error(errorJson.detail || `Server warning ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Relay telemetry returned empty stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Maintain the last line if it's incomplete
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("data: ")) {
            const data = trimmed.slice(6).trim();
            if (data === "[DONE]") {
              onDone();
              return;
            } else {
              // Convert escaped newlines back
              const cleanChunk = data.replace(/\\n/g, "\n");
              onChunk(cleanChunk);
            }
          }
        }
      }

      // Final buffer clearance
      if (buffer.startsWith("data: ")) {
        const data = buffer.slice(6).trim();
        if (data !== "[DONE]") {
          onChunk(data.replace(/\\n/g, "\n"));
        }
        onDone();
      }

    } catch (err: any) {
      onError(err);
    }
  }
}

export const api = new StarWarsApiClient();
