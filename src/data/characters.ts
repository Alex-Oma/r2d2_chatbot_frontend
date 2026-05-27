import { StarWarsCharacter } from "../types";

export const STAR_WARS_CHARACTERS: StarWarsCharacter[] = [
  {
    key: "r2d2",
    name: "R2-D2",
    color: "from-blue-600 to-sky-400",
    glowColor: "shadow-blue-500/50 text-blue-400 border-blue-500/30",
    avatarImg: "🤖",
    description: "Sassy and incredibly brave astromech droid. Speaks in binary whistles with Galactic Basic translations.",
    faction: "Rebel Alliance Alliance",
    motto: "Excited bleep beep boop clank!",
    model: "gemini-3.5-flash",
    placeholder: "Beep boop? [Ask something, I shall record and whistle the answers!]"
  },
  {
    key: "c3po",
    name: "C-3PO",
    color: "from-amber-600 to-yellow-400",
    glowColor: "shadow-amber-500/50 text-amber-400 border-amber-500/30",
    avatarImg: "🪙",
    description: "Fluent in over 6 million languages. Extremely polite, highly anxious protocol advisor flustered by danger.",
    faction: "Galactic Republic",
    motto: "Oh dear! The odds of survival are extremely low!",
    model: "gemini-3.5-flash",
    placeholder: "Greetings! How can my protocol subroutines assist your query, sir?"
  },
  {
    key: "yoda",
    name: "Grand Master Yoda",
    color: "from-emerald-600 to-green-400",
    glowColor: "shadow-emerald-500/50 text-emerald-400 border-emerald-500/30",
    avatarImg: "🧘‍♂️",
    description: "Deeply philosophical Jedi Master. Speaks in reverse grammar, teaching your mind the living Force.",
    faction: "Jedi Order",
    motto: "Do, or do not. There is no try.",
    model: "gemini-3.5-flash",
    placeholder: "Anxious you are. Share what you seek, you must..."
  },
  {
    key: "vader",
    name: "Darth Vader",
    color: "from-red-700 to-rose-500",
    glowColor: "shadow-red-500/50 text-red-500 border-red-500/30",
    avatarImg: "👤",
    description: "Dark Sith Lord under a rhythmic respirator count. Menacing, authoritative, and tempting you to power.",
    faction: "Galactic Empire",
    motto: "*Chhhhh-Puhhhhh* Your thoughts betray you.",
    model: "gemini-3.5-flash",
    placeholder: "Speak... or face the crushing truth of the Emperor's command."
  }
];
