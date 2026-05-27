export interface UserProfile {
  display_name: string;
  avatar_url: string;
  bio: string;
  preferred_model: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  profile: UserProfile;
}

export interface Chat {
  id: string;
  title: string;
  system_prompt: string;
  character_key: string;
  model: string;
  created_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  character_key: string;
  model: string;
  created_at: string;
}

export type ConnectionMode = "simulator" | "target";

export interface ApiConfig {
  mode: ConnectionMode;
  targetUrl: string; // e.g. "http://localhost:8000/api/v1" or similar
  token: string;
  simulatedToken: string;
  activeChatId: string | null;
}

export interface StarWarsCharacter {
  key: string;
  name: string;
  color: string; // custom hex or tailwind class color
  glowColor: string; // cyan, amber, red, etc.
  avatarImg: string;
  description: string;
  faction: string;
  motto: string;
  model: string;
  placeholder: string;
}
