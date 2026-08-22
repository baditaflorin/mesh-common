/**
 * Canonical product taxonomy for the recorded mesh app fleet.
 *
 * The catalog generator writes a resolved entry for every scenario to
 * `docs/demos/taxonomy.json`; apps may carry the same shape in
 * `mesh-service.json` when scaffolded. Keep the controlled vocabulary small
 * so people can actually filter it.
 */
const rules = [
  [/rating-board/, "Decisions", "Voting & consensus", ["feedback", "workshops", "teams"]],
  [/word-cloud/, "Creative", "Writing & storytelling", ["reflection", "workshops", "teams"]],
  [/lucky-draw/, "Games", "Party & tabletop", ["icebreakers", "game night", "events"]],
  [/milestone-map/, "Productivity", "Coordination & planning", ["roadmaps", "teams", "planning"]],
  [/playlist-pass/, "Creative", "Performance & sound", ["music", "parties", "shared media"]],
  [
    /pair-mixer/,
    "Coordination",
    "Check-in & assignments",
    ["breakouts", "workshops", "teams"],
  ],
  [
    /turn-taker/,
    "Games",
    "Party & tabletop",
    ["turn taking", "game night", "facilitation"],
  ],
  [
    /budget-pot/,
    "Coordination",
    "Planning & logistics",
    ["shared costs", "events", "teams"],
  ],
  [
    /card-sorter/,
    "Decisions",
    "Selection & ranking",
    ["prioritization", "workshops", "team decisions"],
  ],
  [
    /host-handoff/,
    "Work & learning",
    "Facilitation & reflection",
    ["facilitation", "meetings", "teams"],
  ],
  [
    /lightning-poll/,
    "Decisions",
    "Voting & consensus",
    ["quick decisions", "meetings", "community input"],
  ],
  [
    /role-draw/,
    "Coordination",
    "Check-in & assignments",
    ["facilitation", "teams", "workshops"],
  ],
  [
    /note-pile/,
    "Work & learning",
    "Facilitation & reflection",
    ["retrospectives", "workshops", "brainstorming"],
  ],
  [
    /round-counter/,
    "Games",
    "Party & tabletop",
    ["quick rounds", "facilitation", "game night"],
  ],
  [
    /reaction-wall/,
    "Social",
    "Celebration & support",
    ["community feedback", "celebrations", "teams"],
  ],
  [
    /open-house/,
    "Community",
    "Events & volunteering",
    ["events", "rsvp", "hosting"],
  ],
  [
    /agenda-runner/,
    "Productivity",
    "Coordination & planning",
    ["meetings", "facilitation", "planning"],
  ],
  [
    /scoreboard/,
    "Games",
    "Party & tabletop",
    ["party games", "challenges", "score keeping"],
  ],
  [
    /prompt-deck/,
    "Social",
    "Conversation & connection",
    ["friends", "icebreakers", "facilitation"],
  ],
  [
    /one-word-wall/,
    "Wellbeing",
    "Social energy & check-ins",
    ["check-ins", "reflection", "teams"],
  ],
  [
    /(focus-sprint)/,
    "Productivity",
    "Focus & routines",
    ["study", "coworking", "pomodoro"],
  ],
  [
    /(cohort-scheduler)/,
    "Productivity",
    "Coordination & planning",
    ["study groups", "meetings", "planning"],
  ],
  [
    /(volunteer-desk)/,
    "Community",
    "Events & volunteering",
    ["events", "volunteers", "check-in"],
  ],
  [
    /(decision-room)/,
    "Productivity",
    "Decision making",
    ["team decisions", "prioritization", "meetings"],
  ],
  [
    /(exit-ticket)/,
    "Education",
    "Session feedback",
    ["workshops", "classes", "retrospectives"],
  ],
  [
    /(borrow|lost-found|crowd-map|carpool|potluck|favor-bank)/,
    "Community",
    "Neighbours & mutual aid",
    ["neighbourhoods", "sharing", "local groups"],
  ],
  [
    /(flashcard|skill-tree|skill-swap|skill-challenge)/,
    "Education",
    "Study & practice",
    ["study groups", "classes", "practice"],
  ],
  [
    /(icebreaker|conversation-cards|compliment-roulette|blind-date|name-game|six-degrees|mind-meld|questions-only)/,
    "Social",
    "Conversation & connection",
    ["friends", "icebreakers", "small groups"],
  ],
  [
    /(new-year|thank-you-token|toast-stack|fundraiser-bar|applause-bracket)/,
    "Social",
    "Celebration & support",
    ["celebrations", "communities", "small groups"],
  ],
  // Devices & spaces: keep physical capabilities discoverable independently.
  [
    /(camera|mirror|face-grid|pulse-photo|attendance-stamp|eye-contact)/,
    "Devices & spaces",
    "Camera & vision",
    ["mobile devices", "co-located groups", "capture"],
  ],
  [
    /(orientation|tilt|step|shake|direction|wave|tremor)/,
    "Devices & spaces",
    "Motion & orientation",
    ["mobile devices", "movement", "sensors"],
  ],
  [
    /(doorbell|clap-track|tap-symphony|room-soundtrack|dj-deck|mic-drop|metronome)/,
    "Devices & spaces",
    "Audio & haptics",
    ["sound", "performances", "co-located groups"],
  ],
  [
    /(find-my-family|route-share|treasure-hunt|crowd-map)/,
    "Devices & spaces",
    "Location & field tools",
    ["outdoors", "neighbourhoods", "events"],
  ],
  [
    /(kiosk|watch-party|shared-window|lightning|firefly)/,
    "Devices & spaces",
    "Shared displays & installations",
    ["installations", "shared screens", "co-located groups"],
  ],
  // Games split by the actual interaction rather than one catch-all bucket.
  [
    /(mafia|werewolf|spyfall|codenames|taboo|heads-up|truths|would-rather|never-have|fortune-cookie|questions-only|name-game)/,
    "Games",
    "Conversation & bluffing",
    ["icebreakers", "game night", "small groups"],
  ],
  [
    /(rps|tic-tac|snake|laser-tag|marble|tug-of-war|spot-it|memory-match|quick-draw|speed-type)/,
    "Games",
    "Arcade & reaction",
    ["game night", "two players", "quick rounds"],
  ],
  [
    /(bingo|trivia|quiz|pictionary|hot-potato|five-second|word-chain|dice|jellybean|dare-wheel|pass-the-phone|sound-guess)/,
    "Games",
    "Party & tabletop",
    ["icebreakers", "game night", "small groups"],
  ],
  [
    /(poll|vote|ballot|petition|fist-of-five|show-of-hands|idea-market|ranked-vote|prediction|overrated|debate|applause)/,
    "Decisions",
    "Voting & consensus",
    ["team decisions", "community input", "prioritization"],
  ],
  [
    /(decision-room|picker|lunch-roulette|book-club-lottery)/,
    "Decisions",
    "Selection & ranking",
    ["team decisions", "choices", "small groups"],
  ],
  [
    /(queue|rsvp|when2meet|availability|breakout|pair-rotation|volunteer|carpool|potluck|borrow|lost-found|route-share|split-the-bill|meeting-cost|deadline-pact|shared-checklist)/,
    "Coordination",
    "Planning & logistics",
    ["events", "teams", "neighbourhoods"],
  ],
  [
    /(attendance|class-checkin|chore-rotation|volunteer-desk|volunteer-shift)/,
    "Coordination",
    "Check-in & assignments",
    ["events", "volunteers", "teams"],
  ],
  [
    /(flashcard|skill-tree|skill-swap|focus-sprint|cohort-scheduler|standup|retro|brain-write|prompt-ladder|improv-director|recipe-relay|business-card|bus-factor|pitch-pong|exit-ticket)/,
    "Work & learning",
    "Collaboration & practice",
    ["workshops", "retrospectives", "study groups"],
  ],
  [
    /(mind-meld|conversation-cards|room-norms|compliment|shower-thoughts)/,
    "Work & learning",
    "Facilitation & reflection",
    ["facilitation", "workshops", "teams"],
  ],
  [
    /(mood|vibe|energy|social-battery)/,
    "Wellbeing",
    "Social energy & check-ins",
    ["wellbeing", "teams", "self-reflection"],
  ],
  [
    /(silence|shhh|stretch|pomodoro|habit|quiet|tremor)/,
    "Wellbeing",
    "Mindfulness & focus",
    ["wellbeing", "facilitation", "self-reflection"],
  ],
  [
    /(paint|canvas|light-paint|shadow-paint|exquisite|meme|wave-canvas|emoji-rain|pulse-photo)/,
    "Creative",
    "Visual making",
    ["creative sessions", "shared media", "performances"],
  ],
  [
    /(mad-libs|storyworm|roast|toast|time-capsule)/,
    "Creative",
    "Writing & storytelling",
    ["creative sessions", "writing", "small groups"],
  ],
  [
    /(flash-mob|firefly|room-soundtrack|dj-deck|tap-symphony|clap-track)/,
    "Creative",
    "Performance & sound",
    ["performances", "co-located groups", "shared media"],
  ],
  [
    /(privacy|2fa|passport|secret|anonymous|handshake|gift-exchange|trade-cards|favor-bank|allowance)/,
    "Privacy & utilities",
    "Identity & private exchange",
    ["private exchange", "onboarding", "personal tools"],
  ],
  [
    /(clipboard|link-share|network-builder|qr)/,
    "Privacy & utilities",
    "Links, QR & transfer",
    ["sharing", "onboarding", "personal tools"],
  ],
];

export function taxonomyFor(id) {
  const slug = id.replace(/^mesh-/, "");
  const match = rules.find(([pattern]) => pattern.test(slug));
  const [, category, subcategory, useCases] = match ?? [
    null,
    "Social",
    "Conversation & connection",
    ["friends", "communities", "small groups"],
  ];
  return { category, subcategory, useCases };
}

export const taxonomyVocabulary = {
  categories: [
    ...new Set(rules.map(([, category]) => category).concat("Social")),
  ].sort(),
};

/** Reject a catalog taxonomy where a visible category has only one child. */
export function assertCategoryDiversity(ids) {
  const subcategories = new Map();
  for (const id of ids) {
    const { category, subcategory } = taxonomyFor(id);
    const values = subcategories.get(category) ?? new Set();
    values.add(subcategory);
    subcategories.set(category, values);
  }
  const flat = [...subcategories.entries()]
    .filter(([, values]) => values.size < 2)
    .map(([category]) => category);
  if (flat.length)
    throw new Error(
      `taxonomy categories need at least two subcategories: ${flat.join(", ")}`,
    );
}
