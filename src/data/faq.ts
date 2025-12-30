export const FAQ = {
  state: {
    title: "What is a State?",
    body:
      "A State is your current mode: how you’re processing, deciding, and reacting today. It’s not a personality label — it changes.",
  },
  focus: {
    title: "What is a Focus?",
    body:
      "A Focus is the area of life you’re aiming at right now. Your State describes how to approach the Focus today.",
  },
  connect: {
    title: "How do State + Focus work together?",
    body:
      "State is the ‘how’. Focus is the ‘where’. Your recommendation is simply: State + Focus = what kind of action (or reflection) fits right now.",
  },
};

// Optional: mini descriptions per option (use only if you want)
export const STATE_BLURBS: Record<string, string> = {
  destructivist: "Pruning mode. Cut noise. Simplify. Remove what isn’t working.",
  constructivist: "Building mode. Structure. Routines. Skill-stacking.",
  reflectivist: "Meaning mode. Integrate lessons. Observe patterns. Clarify values.",
  explorivist: "Curiosity mode. Try things. Sample widely. Follow resonance.",
};

export const FOCUS_BLURBS: Record<string, string> = {
  music: "Sound, creativity, expression, practice.",
  art: "Visual inspiration, taste-making, aesthetic clarity.",
  life: "Identity, routines, relationships, direction.",
  business: "Strategy, systems, momentum, execution.",
};
