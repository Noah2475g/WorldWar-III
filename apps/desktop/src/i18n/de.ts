/**
 * Every word the interface says (T-M11-04, R-UI-07).
 *
 * One file, one language, no strings anywhere else. Not because a second language is
 * planned — it is not — but because a text that lives in a component is a text nobody
 * can review: you cannot read the game's voice, spot the one message that shouts at
 * the player, or find out whether a term is used consistently, if the words are
 * scattered across forty files.
 *
 * The rejection texts (T-M10-08) sit here too, and they follow one rule: say what
 * went wrong *and* what would fix it. "Nicht genug Rohstoffe" is an error message;
 * "Es fehlen 400 Eisen" is help.
 */

export const de = {
  app: {
    title: 'WorldWar',
    loading: 'Die Welt wird aufgebaut …',
  },

  header: {
    day: 'Tag',
    speed: 'Geschwindigkeit',
    pause: 'Pause',
    fastForward: 'Vorspulen',
    fastForwardRunning: 'Spult vor …',
    abort: 'Abbrechen',
    balance: 'Bilanz',
    perDay: 'je Tag',
    menu: 'Menü',
    diplomacy: 'Diplomatie',
    market: 'Markt',
  },

  economy: {
    title: 'Wirtschaft',
    resource: 'Rohstoff',
    stock: 'Bestand',
    production: 'Produktion',
    consumption: 'Verbrauch',
    balance: 'Bilanz',
    perDay: 'je Tag',
    shortage: 'Mangel',
  },

  resources: {
    food: 'Nahrung',
    wood: 'Material',
    iron: 'Eisen',
    coal: 'Kohle',
    oil: 'Öl',
    rare: 'Seltene Erden',
    money: 'Geld',
  },

  terrain: {
    plains: 'Ebene',
    forest: 'Wald',
    mountain: 'Gebirge',
    desert: 'Wüste',
    urban: 'Stadtland',
  },

  /** The rules name their buildings and units in data; the interface says them in German. */
  buildings: {
    barracks: 'Kaserne',
    fortress: 'Festung',
    factory: 'Fabrik',
    harbour: 'Hafen',
    shipyard: 'Werft',
    airfield: 'Flugplatz',
    railway: 'Eisenbahn',
  },

  units: {
    infantry: 'Infanterie',
    motorized: 'Motorisierte Infanterie',
    tank: 'Kampfpanzer',
    heavy_tank: 'Schwerer Kampfpanzer',
    artillery: 'Artillerie',
    rocket_artillery: 'Raketenartillerie',
    fighter: 'Jagdflugzeug',
    bomber: 'Bomber',
    destroyer: 'Zerstörer',
    transport: 'Transportschiff',
  },

  /**
   * The same refusals as `errors`, in three words for the log. A log line has no room
   * for "es fehlen 400 Eisen" — and no number to put there, because the event that
   * records a refusal carries only its code.
   */
  rejections: {
    UNKNOWN_PLAYER: 'unbekannter Spieler',
    PLAYER_ELIMINATED: 'diese Macht ist ausgeschieden',
    UNKNOWN_COMMAND: 'unbekannter Befehl',
    NOT_OWNER: 'die Provinz gehört Ihnen nicht',
    INSUFFICIENT_RESOURCES: 'zu wenig Rohstoffe',
    MISSING_BUILDING: 'das nötige Gebäude fehlt',
    BUILDING_MAX_LEVEL: 'das Gebäude ist voll ausgebaut',
    NO_PATH: 'dorthin führt kein Weg',
    ARMY_BUSY: 'die Armee ist noch gebunden',
    ARMY_NOT_FOUND: 'diese Armee gibt es nicht mehr',
    PROVINCE_NOT_FOUND: 'diese Provinz gibt es nicht',
    AT_WAR_REQUIRED: 'das geht nur im Krieg',
    OUT_OF_RANGE: 'außer Reichweite',
    QUEUE_FULL: 'alle Bauplätze sind belegt',
    INVALID_TARGET: 'unzulässiges Ziel',
    ON_COOLDOWN: 'noch gesperrt',
  } as const,

  province: {
    kindCity: 'Großstadt',
    kindRural: 'Landprovinz',
    morale: 'Moral',
    population: 'Bevölkerung',
    owner: 'Eigentümer',
    neutral: 'neutral',
    coastal: 'mit Küste',
    landlocked: 'Binnenland',
    deposits: 'Vorkommen',
    buildings: 'Gebäude',
    buildQueue: 'Im Bau',
    buildSlots: 'Bauplätze',
    noBuildings: 'Keine Gebäude',
    unknown: 'Nicht aufgeklärt',
    lastSeen: 'Stand von Tag {{day}}',
    pick: 'Provinz',
    pickNone: '— keine —',
    pickOwn: 'Eigene Provinzen',
    pickOthers: 'Aufgeklärte Provinzen',
    level: 'Stufe {{level}}',
    capital: 'Hauptstadt',
  },

  army: {
    title: 'Armee',
    strength: 'Stärke',
    stance: 'Haltung',
    stanceAggressive: 'Angriff',
    stanceDefensive: 'Verteidigung',
    stanceRetreat: 'Rückzug',
    moving: 'Auf dem Marsch',
    arrivesIn: 'Ankunft in {{hours}} h',
    arrivesAt: 'Ankunft Tag {{day}}, {{hour}}:00',
    idle: 'Steht',
    split: 'Teilen',
    merge: 'Zusammenlegen',
    move: 'Marschieren',
    stop: 'Anhalten',
    bombard: 'Beschießen',
    here: 'Armeen hier',
    select: 'Auswählen',
    units: 'Einheiten',
    unitCount: '{{count}} × {{unit}}',
    chooseTarget: 'Ziel auf der Karte anklicken — oder hier wählen:',
    targetLabel: 'Ziel',
    arrivalPreview: '{{target}}: {{arrival}}',
    confirmMove: 'Marsch befehlen',
    confirmBombard: 'Beschuss befehlen',
    cancel: 'Abbrechen',
    notMoving: 'Die Armee steht bereits.',
    alreadyStance: 'Die Armee hat diese Haltung schon.',
    noPartner: 'Keine zweite eigene Armee an diesem Ort.',
    tooSmall: 'Zu klein zum Teilen.',
    noRanged: 'Keine Einheit mit Reichweite dabei.',
    empty: 'Die Armee hat keine Einheiten.',
    noRoute: 'Dorthin führt kein Weg.',
  },

  actions: {
    build: 'Bauen',
    cancelBuild: 'Bau abbrechen',
    recruit: 'Rekrutieren',
    setCapital: 'Hauptstadt verlegen',
    trade: 'Handeln',
    declareWar: 'Krieg erklären',
    offerPeace: 'Frieden anbieten',
    cost: 'Kosten',
    duration: 'Dauer',
    hours: '{{count}} h',
    day: '{{count}} Tag',
    days: '{{count}} Tage',
    expectedStrength: 'Erwartete Stärke: {{strength}} statt {{ordered}} — die Provinzmoral senkt sie.',
    startStrength: 'Anfangsstärke {{percent}} % (Provinzmoral)',
    buildGroup: 'Bauen',
    recruitGroup: 'Ausheben',
    acceptPeace: 'Frieden annehmen',
    offerAlliance: 'Bündnis anbieten',
    acceptAlliance: 'Bündnis annehmen',
    breakAlliance: 'Bündnis aufkündigen',
    grantRightOfWay: 'Durchmarsch gewähren',
    shareMap: 'Karte teilen',
    reasonDetail: '{{text}} ({{reason}})',
  },

  /**
   * Why an action was refused. Each one names the obstacle, and where a number would
   * help, it names the number — a player who is told "es fehlen 400 Eisen" knows what
   * to do next, one who is told "nicht genug Rohstoffe" has to go and count.
   */
  errors: {
    UNKNOWN_PLAYER: 'Diesen Spieler gibt es nicht.',
    PLAYER_ELIMINATED: 'Diese Macht ist ausgeschieden und kann nichts mehr befehlen.',
    UNKNOWN_COMMAND: 'Diesen Befehl kennt das Spiel nicht.',
    NOT_OWNER: 'Die Provinz gehört Ihnen nicht.',
    INSUFFICIENT_RESOURCES: 'Es fehlt an Rohstoffen: {{missing}}.',
    MISSING_BUILDING: 'Dafür fehlt das Gebäude: {{building}}.',
    BUILDING_MAX_LEVEL: 'Dieses Gebäude ist bereits voll ausgebaut.',
    NO_PATH: 'Dorthin führt kein Weg — feindliches Gebiet oder offenes Meer liegt dazwischen.',
    ARMY_BUSY: 'Die Armee ist noch gebunden und kann jetzt keinen neuen Befehl annehmen.',
    ARMY_NOT_FOUND: 'Diese Armee gibt es nicht mehr.',
    PROVINCE_NOT_FOUND: 'Diese Provinz gibt es nicht.',
    AT_WAR_REQUIRED: 'Das geht nur im Krieg. Erklären Sie zuerst den Krieg.',
    OUT_OF_RANGE: 'Das Ziel liegt außer Reichweite.',
    QUEUE_FULL: 'Alle Bauplätze dieser Provinz sind belegt.',
    INVALID_TARGET: 'Dieses Ziel ist für den Befehl nicht zulässig.',
    ON_COOLDOWN: 'Das geht erst wieder in {{days}} Tagen.',
  } as const,

  /** What happened, in the log and in the ticker. */
  events: {
    GAME_STARTED: 'Die Partie beginnt.',
    COMMAND_REJECTED: 'Befehl abgelehnt: {{reason}}.',
    BUILD_STARTED: '{{province}}: Bau von {{building}} begonnen.',
    BUILD_COMPLETED: '{{province}}: {{building}} fertiggestellt.',
    BUILD_CANCELLED: '{{province}}: Bau abgebrochen, halbe Kosten erstattet.',
    UNIT_RECRUITED: '{{province}}: {{count}} {{unit}} ausgehoben.',
    ARMY_DEPARTED: '{{army}} marschiert nach {{province}}.',
    ARMY_ARRIVED: '{{army}} hat {{province}} erreicht.',
    ARMY_DESTROYED: '{{army}} ist vernichtet.',
    ARMY_RETREATED: '{{army}} hat sich nach {{province}} zurückgezogen.',
    BATTLE_STARTED: 'Gefecht bei {{province}}.',
    BATTLE_RESOLVED: '{{province}}: Gefecht entschieden — {{winner}} behauptet das Feld.',
    BOMBARDMENT: '{{province}} wird beschossen.',
    PROVINCE_CAPTURED: '{{province}} ist gefallen und gehört jetzt {{player}}.',
    PROVINCE_REVOLTED: '{{province}} hat sich erhoben.',
    RESOURCE_SHORTAGE: 'Mangel an {{resource}}. Der Nachschub reicht nicht.',
    STORAGE_OVERFLOW: 'Die Lager für {{resource}} sind voll — der Überschuss verfällt.',
    TRADE_EXECUTED: '{{giveAmount}} {{give}} gegen {{wantAmount}} {{want}} getauscht.',
    WAR_DECLARED: '{{player}} erklärt {{target}} den Krieg. Wirksam ab Tag {{day}}.',
    DIPLOMACY_CHANGED: 'Verhältnis zu {{player}}: {{state}}.',
    CAPITAL_LOST: 'Die Hauptstadt {{province}} ist verloren.',
    CAPITAL_MOVED: 'Die Hauptstadt liegt jetzt in {{province}}.',
    PLAYER_ELIMINATED: '{{player}} ist ausgeschieden.',
    GAME_ENDED: 'Die Partie ist entschieden: {{winner}} hat gewonnen.',
    DAY_REPORT: 'Tagesbericht für Tag {{day}}.',
  } as const,

  diplomacy: {
    title: 'Diplomatie',
    peace: 'Frieden',
    war: 'Krieg',
    truce: 'Waffenstillstand',
    alliance: 'Bündnis',
    rightOfWay: 'Durchmarschrecht',
    sharedMap: 'Kartenaustausch',
    reputation: 'Ansehen',
    noRelations: 'Noch keine Beziehungen.',
    choose: 'Macht wählen',
    with: 'Verhältnis zu {{nation}}',
    truceBlocks: 'Das geht erst, wenn der Waffenstillstand abgelaufen ist.',
    offerPending: 'Angebot liegt vor',
  },

  market: {
    title: 'Markt',
    give: 'Abgeben',
    want: 'Erhalten',
    amount: 'Menge',
    price: 'Kurs',
    preview: 'Ergibt etwa {{amount}} {{resource}}.',
    previewNone: 'Dafür gibt es nichts.',
    trade: 'Handeln',
    hint: 'Der Kurs gilt für den ganzen Spielstunden-Tick und für alle Mächte gleich; Nachfrage bewegt ihn danach.',
  },

  mapModes: {
    title: 'Kartenmodus',
    political: 'Besitz',
    resources: 'Rohstoffe',
    morale: 'Moral',
    threat: 'Bedrohung',
  },

  newGame: {
    title: 'Neue Partie',
    nation: 'Macht',
    seed: 'Startzahl',
    seedHint: 'Dieselbe Startzahl ergibt dieselbe Partie.',
    difficulty: 'Schwierigkeit',
    easy: 'leicht',
    normal: 'normal',
    hard: 'schwer',
    opponents: 'Gegner',
    victory: 'Siegbedingung',
    victoryPoints: 'Punkte',
    victoryConquest: 'Eroberung',
    map: 'Karte',
    start: 'Partie beginnen',
    aiBonus: 'KI-Bonus: {{percent}} %',
    aiBonusNone: 'Die KI spielt ohne Bonus — sie sieht dieselbe Karte wie Sie.',
  },

  saves: {
    title: 'Spielstände',
    save: 'Speichern',
    load: 'Laden',
    autosave: 'Automatisch gespeichert',
    slot: 'Stand {{number}}',
    empty: 'leer',
    saved: 'Gespeichert.',
    loaded: 'Geladen.',
    corrupt: 'Dieser Spielstand ist beschädigt und wurde nicht geladen.',
    wrongVersion: 'Dieser Spielstand stammt aus einer anderen Fassung des Spiels.',
    confirmOverwrite: 'Diesen Stand überschreiben?',
  },

  settings: {
    title: 'Einstellungen',
    autosaveInterval: 'Automatisch speichern alle',
    minutes: '{{count}} Minuten',
    sound: 'Ton',
    soundOn: 'an',
    soundOff: 'aus',
    maxSpeed: 'Höchstgeschwindigkeit',
    fontSize: 'Schriftgröße',
    fontSmall: 'klein',
    fontNormal: 'normal',
    fontLarge: 'groß',
    debug: 'Debug-Ansicht',
    reset: 'Auf Vorgabe zurücksetzen',
  },

  debug: {
    title: 'Debug',
    hash: 'Zustands-Hash',
    tick: 'Tick',
    aiGoal: 'Ziel',
    aiUtility: 'Nutzen',
    aiAlternatives: 'Verworfen',
    commandLog: 'Kommandolog',
    hidden: 'Die Debug-Ansicht ist ausgeschaltet.',
  },

  events_ui: {
    title: 'Ereignisse',
    empty: 'Noch nichts geschehen.',
    jumpTo: 'Zur Provinz springen',
    battleReport: 'Kampfbericht',
    attacker: 'Angreifer',
    defender: 'Verteidiger',
    losses: 'Verluste',
    outcome: 'Ausgang',
    nobody: 'niemand',
  },

  a11y: {
    map: 'Weltkarte',
    selectProvince: 'Provinz {{name}} auswählen',
    skipToMap: 'Zur Karte springen',
    keyboardHelp: 'Tastaturkürzel anzeigen',
  },

  keys: {
    title: 'Tastatur',
    pause: 'Leertaste — Pause',
    speedUp: '+ — schneller',
    speedDown: '− — langsamer',
    fastForward: 'F — vorspulen',
    save: 'Strg+S — speichern',
    load: 'Strg+L — laden',
    mapMode: 'M — Kartenmodus wechseln',
    diplomacy: 'D — Diplomatie',
    market: 'H — Markt (Handel)',
    escape: 'Escape — Dialog, Panel oder Zielwahl abbrechen',
    help: 'F1 — diese Übersicht',
  },

  tutorial: {
    title: 'Einstieg',
    dismiss: 'Nicht mehr zeigen',
  },
} as const

export type Catalog = typeof de
