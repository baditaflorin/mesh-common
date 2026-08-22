/**
 * Canonical product taxonomy for the recorded mesh app fleet.
 *
 * The catalog generator writes a resolved entry for every scenario to
 * `docs/demos/taxonomy.json`; apps may carry the same shape in
 * `mesh-service.json` when scaffolded. Keep the controlled vocabulary small
 * so people can actually filter it.
 */
const rules = [
  [/(mafia|werewolf|spyfall|codenames|rps|tic-tac|snake|bingo|trivia|quiz|pictionary|heads-up|taboo|spot-it|memory-match|hot-potato|five-second|word-chain|truths|would-rather|never-have|dare-wheel|jellybean|fortune-cookie|quick-draw|pass-the-phone|laser-tag|marble|dice|tug-of-war|sound-guess)/, "Games", "Party & tabletop", ["icebreakers", "game night", "small groups"]],
  [/(poll|vote|ballot|petition|fist-of-five|show-of-hands|idea-market|ranked-vote|prediction|overrated|debate|applause)/, "Decisions", "Voting & consensus", ["team decisions", "community input", "prioritization"]],
  [/(queue|rsvp|when2meet|availability|breakout|pair-rotation|volunteer|carpool|potluck|borrow|lost-found|route-share|split-the-bill|meeting-cost|deadline-pact)/, "Coordination", "Planning & logistics", ["events", "teams", "neighbourhoods"]],
  [/(flashcard|skill-tree|skill-swap|standup|retro|brain-write|prompt-ladder|improv-director|recipe-relay|business-card|bus-factor|pitch-pong)/, "Work & learning", "Collaboration & practice", ["workshops", "retrospectives", "study groups"]],
  [/(mood|vibe|energy|silence|shhh|stretch|pomodoro|eye-contact|habit|social-battery|quiet|tremor)/, "Wellbeing", "Mindfulness & focus", ["wellbeing", "facilitation", "self-reflection"]],
  [/(paint|canvas|light-paint|shadow-paint|exquisite|mad-libs|meme|storyworm|roast|toast|room-soundtrack|dj-deck|tap-symphony|clap-track|firefly|emoji-rain|flash-mob|pulse-photo|time-capsule)/, "Creative", "Making & performance", ["creative sessions", "performances", "shared media"]],
  [/(camera|mirror|orientation|tilt|step|shake|direction|lightning|wave|face-grid|find-my-family|attendance-stamp|kiosk|watch-party)/, "Devices & spaces", "Sensors & shared displays", ["co-located groups", "mobile devices", "installations"]],
  [/(privacy|2fa|clipboard|link-share|network-builder|passport|gift-exchange|secret|anonymous|qr|handshake|trade-cards|favor-bank|allowance)/, "Privacy & utilities", "Secure sharing & identity", ["private exchange", "onboarding", "personal tools"]],
];

export function taxonomyFor(id) {
  const slug = id.replace(/^mesh-/, "");
  const match = rules.find(([pattern]) => pattern.test(slug));
  const [, category, subcategory, useCases] = match ?? [null, "Social", "Conversation & connection", ["friends", "communities", "small groups"]];
  return { category, subcategory, useCases };
}

export const taxonomyVocabulary = {
  categories: [...new Set(rules.map(([, category]) => category).concat("Social"))].sort(),
};
