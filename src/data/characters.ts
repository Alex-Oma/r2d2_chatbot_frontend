import { StarWarsCharacter } from "../types";

export const STAR_WARS_CHARACTERS: StarWarsCharacter[] = [
  {
    key: "fenn-rau",
    name: "Fenn Rau",
    color: "from-amber-700 to-orange-500",
    glowColor: "shadow-amber-500/50 text-amber-500 border-amber-500/30",
    avatarImg: "🪖",
    description: "Mandalorian protector, Skystrike Academy veteran and Leader of the Protectors of Concord Dawn.",
    faction: "Concord Dawn / Rebellion",
    motto: "For Concord Dawn!",
    model: "gemini-3.5-flash",
    placeholder: "State your coordinates. How can Concord Dawn shield your squad?"
  },
  {
    key: "r2d2",
    name: "R2-D2",
    color: "from-blue-600 to-sky-400",
    glowColor: "shadow-blue-500/50 text-blue-400 border-blue-500/30",
    avatarImg: "🤖",
    description: "Sassy and incredibly brave astromech droid. Speaks in binary whistles with Galactic Basic translations.",
    faction: "Rebel Alliance",
    motto: "Excited bleep beep boop clank!",
    model: "gemini-3.5-flash",
    placeholder: "Beep boop? [Ask something, I shall record and whistle the answers!]"
  },
  {
    key: "captain-rex",
    name: "Captain Rex",
    color: "from-sky-700 to-indigo-500",
    glowColor: "shadow-sky-500/50 text-sky-400 border-sky-500/30",
    avatarImg: "🎖️",
    description: "Battle-hardened Clone Captain of the 501st Legion. Resilient, tactical, and deeply loyal.",
    faction: "501st Legion / Republic",
    motto: "Experience outranks everything.",
    model: "gemini-3.5-flash",
    placeholder: "Commander, what's our strategy? Transmit tactical debrief..."
  },
  {
    key: "hondo-ohnaka",
    name: "Hondo Ohnaka",
    color: "from-amber-600 to-red-600",
    glowColor: "shadow-amber-500/50 text-amber-400 border-amber-500/30",
    avatarImg: "🏴‍☠️",
    description: "Legendary and eccentric Weequay pirate. Charming, slippery, and absolutely money-motivated.",
    faction: "Ohnaka Gang",
    motto: "Insolence? We are pirates! We don't even know what that means!",
    model: "gemini-3.5-flash",
    placeholder: "Ah, my friend! What lucrative partnership of answers shall we discuss?"
  },
  {
    key: "ursa-wren",
    name: "Ursa Wren",
    color: "from-purple-700 to-indigo-850",
    glowColor: "shadow-purple-500/50 text-purple-400 border-purple-500/30",
    avatarImg: "🛡️",
    description: "Leader of Clan Wren of Krownest. Strict, noble, and fiercely defensive of her house and family.",
    faction: "Clan Wren / House Vizsla",
    motto: "Clan Wren stands strong.",
    model: "gemini-3.5-flash",
    placeholder: "You stand before the head of Clan Wren. Speak with honor."
  },
  {
    key: "chopper",
    name: "Chopper",
    color: "from-orange-600 to-yellow-500",
    glowColor: "shadow-orange-500/50 text-orange-400 border-orange-500/30",
    avatarImg: "⚙️",
    description: "Grumpy, extremely chaotic astromech droid with a trigger-happy attitude. Speaks in mechanical grunts.",
    faction: "Spectre Syndicate",
    motto: "Angry robotic grunting noises!",
    model: "gemini-3.5-flash",
    placeholder: "Wobbles violently [What do you want? Don't make me pull the electro-shock prod!]"
  }
];
