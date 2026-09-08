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
    // Die Titelzeile des Startdialogs (T-M22-04, Befund V2-03): der erste Eindruck
    // sagte "Formular", nicht "Strategiespiel".
    subtitle: 'Große Strategie, Stunde um Stunde',
    version: 'Fassung {{version}}',
    loading: 'Die Welt wird aufgebaut …',
  },

  menu: {
    title: 'Menü',
  },

  header: {
    day: 'Tag',
    speed: 'Geschwindigkeit',
    pause: 'Pause',
    fastForward: 'Vorspulen',
    fastForwardRunning: 'Spult vor …',
    // Warum das Vorspulen anhaelt (T-M12-10, R-TIME-03). Der Kern fuehrt den Grund seit
    // M15 mit und gab ihn zurueck; die Oberflaeche hat ihn weggeworfen, und der Spieler
    // sah die Uhr stehenbleiben, ohne zu erfahren warum.
    stoppedTarget: 'Angehalten nach {{time}}: ein Spieltag ist vorbei.',
    stoppedAlert: 'Angehalten nach {{time}}: {{event}}',
    stoppedAlertPlain: 'Angehalten nach {{time}}: etwas ist geschehen, das Sie sehen sollten.',
    stoppedLimit: 'Angehalten nach {{time}}: die Obergrenze ist erreicht, das Ziel trat nicht ein.',
    stoppedAborted: 'Abgebrochen nach {{time}}.',
    // Die ehrliche Uhr (T-M22-05, Befund V2-09): trotz eingestelltem Tempo laeuft kein
    // Tick — verdecktes Fenster, stehendes requestAnimationFrame.
    paused: 'Pausiert',
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
    // „Verbrauch“ hiess immer nur der Armeeunterhalt, und ohne Armee stand die Spalte
    // auf null — der Playtest las das als „die Spalte tut nichts“. Der Name sagt es
    // jetzt, und daneben steht, was in laufenden Auftraegen gebunden ist (T-M12-10).
    consumption: 'Unterhalt',
    balance: 'Bilanz',
    committed: 'In Auftrag',
    // Die Textfassung des Auftragszeichens hinter dem Bestand (T-M22-02): die Spalte
    // "In Auftrag" schob die Tabelle aus der Leiste, die Auskunft selbst bleibt.
    committedTitle: 'In Auftrag: {{amount}}',
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
   * Genus und Numerus, damit Sätze sich beugen können (T-M23-02, R-UI-07, V2-11).
   *
   * „Sie können **es** jetzt bauen" über der Kaserne und „Vereinigte Staaten
   * **erklärt**" waren derselbe Fehler: ein Satz, der sich nach seinem Gegenstand
   * richten muss, kannte den Gegenstand nicht. Die Tabellen stehen hier und nicht im
   * Code, weil sie Sprache sind — ein neues Gebäude bekommt seinen Artikel dort, wo es
   * seinen Namen bekommt. `grammar.test.ts` hält beide Tabellen vollständig.
   */
  grammar: {
    /** Akkusativpronomen je Genus: „Sie können sie/ihn/es jetzt bauen." */
    pronoun: { f: 'sie', m: 'ihn', n: 'es' },
    /** Die Kaserne, der Hafen — das Genus je Gebäude. */
    buildings: {
      barracks: 'f',
      fortress: 'f',
      factory: 'f',
      harbour: 'm',
      shipyard: 'f',
      airfield: 'm',
      railway: 'f',
    },
    /** Die Infanterie, der Kampfpanzer, das Jagdflugzeug — das Genus je Einheit. */
    units: {
      infantry: 'f',
      motorized: 'f',
      tank: 'm',
      heavy_tank: 'm',
      artillery: 'f',
      rocket_artillery: 'f',
      fighter: 'n',
      bomber: 'm',
      destroyer: 'm',
      transport: 'n',
    },
    /** Machtnamen in grammatischer Mehrzahl: „Vereinigte Staaten erklären". */
    pluralNations: ['Vereinigte Staaten'],
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
    NOT_YET_AVAILABLE: 'das gibt es noch nicht',
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
    holdFire: 'Feuer halten',
    resumeFire: 'Feuer frei',
    // Hoerbare Namen mit Verb (T-M22-06): "Angriff" und "Feuer frei" sind Zustaende,
    // die Handlung dahinter braucht ein Verb.
    stanceAria: 'Haltung {{stance}} einnehmen',
    resumeFireAria: 'Feuer freigeben',
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
    // Was ein Befehl kostet, bevor er gegeben wird (T-M12-10, R-UI-05, Playtest 25a).
    // Die Bauknoepfe machten es seit M10 vor ("333 Material, 250 Geld · 1 Tag"); die
    // Armeebefehle trugen ueberhaupt keinen Hinweis, obwohl Rueckzug und Marsch die
    // teuersten Entscheidungen des Spiels sind. Die Zahlen kommen aus den Regeln, nie
    // aus dem Text — sonst hat das Spiel zwei Wahrheiten.
    moveHint: 'Beim Abmarsch {{time}} lang halbe Kampfkraft.',
    stopHint: 'Die Armee hält an, wo sie gerade steht.',
    stanceAggressiveHint: 'Greift von sich aus an, was in Reichweite kommt.',
    stanceDefensiveHint: 'Hält die Stellung und greift nicht von sich aus an.',
    stanceRetreatHint: 'Kostet {{loss}} % der Stärke, danach {{cooldown}} kein Angriff und {{deploy}} halbe Kampfkraft.',
    mergeHint: 'Fasst alle eigenen Armeen an diesem Ort zu einer zusammen.',
    splitHint: 'Teilt die Hälfte ab: {{units}}.',
    splitHintNone: 'Teilt die Hälfte ab — dafür braucht es mindestens zwei Einheiten.',
    bombardHint: 'Reichweite {{range}}, danach eine Stunde keine Bewegung.',
    holdFireHint: 'Steht die Armee und ist ein Kriegsgegner in Reichweite, feuert sie von selbst.',
    empty: 'Die Armee hat keine Einheiten.',
    noRoute: 'Dorthin führt kein Weg.',
  },

  actions: {
    build: 'Bauen',
    // Hoerbare Namen mit Verb (T-M22-06, Befund V2-13): sichtbar bleibt die kurze
    // Beschriftung, ein Vorleseprogramm hoert die Handlung.
    buildAria: '{{thing}} bauen',
    recruitAria: '{{thing}} ausheben',
    cancelBuild: '{{building}} abbrechen',
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
    // Nach „nach", „in", „seit" steht die Dauer im Dativ: „nach 2 Tagen" (T-M23-02).
    daysDative: '{{count}} Tagen',
    expectedStrength: 'Erwartete Stärke: {{strength}} statt {{ordered}} — die Provinzmoral senkt sie.',
    startStrength: 'Anfangsstärke {{percent}} % (Provinzmoral)',
    availableFrom: 'ab Spieltag {{day}}',
    // Die Befehls-Quittung (T-M22-05, Befund V2-08): abgeschickt, noch nicht
    // angewendet — und bei stehender Uhr sagt der Satz dazu, wann es so weit ist.
    ordered: '✓ befohlen — wirkt im nächsten Tick.',
    orderedPaused: '✓ befohlen — wirkt beim Weiterlaufen.',
    cancelGroup: 'Im Bau',
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
    NOT_YET_AVAILABLE: 'Das gibt es erst ab Spieltag {{availableFromDay}}.',
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
    BATTLE_RESOLVED:
      '{{province}}: Gefecht entschieden — {{winner}} behauptet das Feld. Verluste: {{losses}}.',
    BOMBARDMENT: '{{province}} wird beschossen.',
    PROVINCE_CAPTURED: '{{province}} ist gefallen und gehört jetzt {{player}}.',
    PROVINCE_REVOLTED: '{{province}} hat sich erhoben.',
    RESOURCE_SHORTAGE: 'Mangel an {{resource}}. Der Nachschub reicht nicht.',
    STORAGE_OVERFLOW: 'Die Lager für {{resource}} sind voll — der Überschuss verfällt.',
    TRADE_EXECUTED: '{{giveAmount}} {{give}} gegen {{wantAmount}} {{want}} getauscht.',
    WAR_DECLARED: '{{player}} erklärt {{target}} den Krieg. Wirksam ab Tag {{day}}.',
    // Numerus-Fassungen (T-M23-02, V2-11): gewählt, wenn der Satzgegenstand eine
    // Mehrzahl-Macht ist (grammar.pluralNations) — „Vereinigte Staaten erklären".
    WAR_DECLARED_PLURAL: '{{player}} erklären {{target}} den Krieg. Wirksam ab Tag {{day}}.',
    DIPLOMACY_CHANGED: 'Verhältnis zu {{player}}: {{state}}.',
    CAPITAL_LOST: 'Die Hauptstadt {{province}} ist verloren.',
    CAPITAL_MOVED: 'Die Hauptstadt liegt jetzt in {{province}}.',
    // Fassungen aus fremder Sicht (T-M15-09, R-DIP-04). Drei der Sätze oben tragen ein
    // stillschweigendes „ich" — „Verhältnis zu X", „Die Hauptstadt ist verloren" — und
    // wären im Weltgeschehen schlicht falsch. Und keiner nennt Zahlen: was zwischen zwei
    // fremden Mächten geschieht, erfährt man dem Wesen nach, nicht der Menge nach.
    DIPLOMACY_CHANGED_FOREIGN: '{{player}} und {{target}}: {{state}}.',
    CAPITAL_LOST_FOREIGN: 'Die Hauptstadt {{province}} von {{player}} ist gefallen.',
    BATTLE_RESOLVED_FOREIGN: '{{province}}: Gefecht entschieden — {{winner}} behauptet das Feld.',
    WAR_DECLARED_FOREIGN: '{{player}} erklärt {{target}} den Krieg.',
    WAR_DECLARED_FOREIGN_PLURAL: '{{player}} erklären {{target}} den Krieg.',
    PLAYER_ELIMINATED: '{{player}} ist ausgeschieden.',
    PLAYER_ELIMINATED_PLURAL: '{{player}} sind ausgeschieden.',
    GAME_ENDED: 'Die Partie ist entschieden: {{winner}} hat gewonnen.',
    GAME_ENDED_PLURAL: 'Die Partie ist entschieden: {{winner}} haben gewonnen.',
    DAY_REPORT: 'Tagesbericht für Tag {{day}}.',
  } as const,

  /**
   * Der Körper des Tagesberichts (T-M24-01, R-TIME-06, Befund V2-06).
   *
   * „Tagesbericht für Tag 8." war eine Überschrift ohne Körper. Die Zeilen hier füllen
   * ihn: Bilanz je Rohstoff (nur die von null verschiedenen), Moral je eigener Provinz
   * mit Richtung, fertige und laufende Aufträge, „morgen neu: X". Die Zahlen kommen aus
   * dem Zustand am Tageswechsel (D24.4), nie aus diesem Text.
   */
  dayReport: {
    // Seit T-M25-04 die Überschrift der Balkenliste, kein Satz mit Aufzählung mehr:
    // die Bilanzen zeichnet der DeltaBar, die Zahl steht daneben.
    balance: 'Bilanz je Tag',
    morale: 'Moral: {{list}}',
    moraleRising: '{{province}} {{percent}} % ↗',
    moraleFalling: '{{province}} {{percent}} % ↘',
    moraleSteady: '{{province}} {{percent}} % →',
    completed: 'Fertig geworden: {{list}}',
    running: 'In Arbeit: {{list}}',
    completedEntry: '{{thing}} in {{province}}',
    orderEntry: '{{thing}} in {{province}} — fertig Tag {{day}}',
    tomorrow: 'Morgen neu: {{list}}',
    quiet: 'Ein ruhiger Tag: nichts fertig, nichts in Arbeit, die Bilanz hält.',
  },

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
    strength: 'Truppenstärke',
    relations: 'Beziehungen',
  },

  newGame: {
    title: 'Neue Partie',
    // Der erste Knopf, wenn ein Stand existiert (T-M22-04, Befund V2-04): wer
    // wiederkommt, will weiterspielen — nicht suchen.
    resume: 'Weiterspielen (Tag {{day}})',
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
    // Die Zahlen stammen aus newGame.ts: Punkte 700 von 1000, Eroberung 1000 von 1000.
    // Sie stehen hier ausgeschrieben, weil eine Wahl, die den Ausgang der Partie
    // bestimmt, nicht unerklaerter dastehen darf als die Startzahl darueber.
    victoryPointsHint: 'Sie gewinnen, sobald Ihnen 70 % aller Siegpunkte gehören.',
    victoryConquestHint: 'Sie gewinnen erst, wenn Ihnen alles gehört — 100 % der Siegpunkte.',
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
    autosaved: 'Automatisch gespeichert.',
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
    noGoals: 'Noch keine Entscheidung der KI in diesem Lauf.',
    noCommands: 'Noch kein Befehl in diesem Lauf.',
    commandLog: 'Kommandolog',
    hidden: 'Die Debug-Ansicht ist ausgeschaltet.',
  },

  events_ui: {
    title: 'Ereignisse',
    empty: 'Noch nichts geschehen.',
    noLosses: 'keine',
    jumpTo: 'Zur Provinz springen',
    battleReport: 'Kampfbericht',
    attacker: 'Angreifer',
    defender: 'Verteidiger',
    losses: 'Verluste',
    outcome: 'Ausgang',
    nobody: 'niemand',
    // Der Kampfbericht als Bild (T-M27-02, R-BAT-05, D25.6): je Seite ein
    // Stärkebalken, die Umstände als Zeichen — und fürs Ohr die Satzfassung.
    battleSide: '{{name}}: Stärke {{before}} auf {{after}}, Verluste {{losses}}.',
    battleEntrenched: 'Eingegraben',
    battleBlocked: 'Rückzugssperre',
    battleTerrain: 'Gelände: {{terrain}}.',
    battleFortress: 'Festung Stufe {{level}}',
    battleFortressSentence: 'Festung Stufe {{level}}.',
    battleEntrenchedSentence: '{{name}} kämpft eingegraben.',
    battleBlockedSentence: '{{name}} steht unter Rückzugssperre.',
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
    standings: 'L — Lage der Mächte',
    escape: 'Escape — Dialog, Panel oder Zielwahl abbrechen',
    help: 'F1 — diese Übersicht',
  },

  tutorial: {
    title: 'Einstieg',
    dismiss: 'Nicht mehr zeigen',
    /** "Schritt 2 von 5" — damit der Spieler weiss, wie viel noch kommt. */
    progress: 'Schritt {{step}} von {{total}}',
    /**
     * Jeder Schritt trägt drei Sätze (T-M24-02): `title` sagt, worum es geht, `text`
     * sagt, was zu tun ist — und `why` sagt, **wozu**. Frage 50 des Abnahmebogens,
     * ehrlich beantwortet: das Was war geführt, das Wozu fehlte. Der Wächter
     * `unlocks-explained` verlangt das dritte Feld für jeden Schritt.
     */
    steps: {
      select: {
        title: 'Ihre Provinzen',
        text: 'Klicken Sie eine Ihrer Provinzen an. Rechts stehen Moral, Bevölkerung und was im Boden liegt.',
        why: 'Alles in diesem Spiel — Bau, Aushebung, Moral, Punkte — geschieht in Provinzen. Wer seine kennt, kennt seine Lage.',
      },
      build: {
        title: 'Etwas bauen',
        text: 'Jeder Knopf nennt vorher Kosten und Dauer. Was Sie sich nicht leisten können, ist ausgegraut — mit dem Grund daneben.',
        why: 'Gebäude kommen vor Einheiten: erst die Kaserne macht das Ausheben möglich, und dieselbe Kaserne macht jedes weitere schneller.',
      },
      speed: {
        title: 'Die Zeit läuft',
        text: 'Die Leertaste startet und stoppt. Die Zahlen sind Spielstunden je Sekunde — bei 10 vergeht ein Spieltag in gut zwei Sekunden.',
        why: 'Das Spiel rechnet in Spielstunden von selbst weiter; das Tempo bestimmt nur, wie schnell Sie zusehen.',
      },
      score: {
        title: 'Woher die Punkte kommen',
        // Der eine Satz, der die Frühphase vom Kopf auf die Füße stellt (T-M24-02,
        // gemessen in PROBLEME.md): die Bevölkerung stellt fast alle Startpunkte, eine
        // Eroberung wiegt hunderte Bauwerke. Die Größenordnung steht bewusst als
        // Verhältnis im Satz, nicht als Zahl — sie hängt an der Karte, nicht an den
        // Regeln, und eine Zahl an zwei Orten wäre beim nächsten Kartenbau falsch.
        text:
          'Drücken Sie L: die Lage der Mächte zeigt die Punkte, um die gespielt wird. Fast alle ' +
          'stecken in der Bevölkerung — eine eroberte Provinz bringt deshalb mehr Punkte als ' +
          'jeder Ausbau daheim.',
        why: 'Wer nur baut, fällt zurück: der Sieg wird in Menschen gerechnet, und Menschen gewinnt man mit Land.',
      },
      dayPassed: {
        title: 'Jetzt heißt es warten',
        // Die Dauer kommt aus den Regeln (T-M21-03) — sie steht hier bewusst nicht als
        // Zahl, sonst waere sie beim ersten Balancing falsch und niemand merkte es.
        text:
          'Ihr Startvorrat trägt genau ein Gebäude, und bis Ihre erste Einheit steht, vergehen ' +
          '{{wait}} — Spieltag {{day}}. Bis dahin gibt es nichts zu klicken, was voranbringt: ' +
          'alles rechnet stündlich von selbst weiter. Stellen Sie das Tempo höher oder spulen ' +
          'Sie vor. Das Warten ist kein Fehler, es ist das Spiel.',
        why: 'Ihre Befehle wirken über Tage, nicht über Klicks — das Spiel belohnt Planung, nicht die schnellere Hand.',
      },
      buildCompleted: {
        title: 'Das erste Gebäude steht',
        text: 'Eine Kaserne macht aus Rohstoffen Soldaten. Wählen Sie die Provinz und heben Sie aus — die Einheit braucht danach noch ihre Zeit.',
        why: 'Darum kam die Kaserne vor der Infanterie: jede Einheit braucht ihr Gebäude, keine entsteht auf freiem Feld.',
      },
      unitRecruited: {
        title: 'Ihre erste Einheit',
        text: 'Klicken Sie die Armee an, dann ein Ziel auf der Karte. Die Ankunft steht am Knopf, bevor Sie ihn drücken.',
        why: 'Nur Armeen verändern die Karte — und nur die Karte bringt die Punkte, die den Sieg entscheiden.',
      },
      fastForward: {
        title: 'Vorspulen',
        text: 'Für längere Strecken: läuft, bis etwas passiert, das Sie sehen müssen — und sagt dann, was es war.',
        why: 'Märsche dauern Tage. Vorspulen überspringt nichts Wichtiges: es hält an, sobald etwas geschieht.',
      },
      events: {
        title: 'Was geschieht',
        text: 'Unten stehen die Ereignisse. Rot heißt hinsehen; ein Klick springt zu der Provinz, um die es geht.',
        why: 'Was Sie hier übersehen, meldet niemand ein zweites Mal — das Protokoll ist das Gedächtnis der Partie.',
      },
      expansion: {
        title: 'Ausdehnung kostet Moral',
        // Die Zahlen kommen aus den Regeln der laufenden Partie (Tutorial.tsx setzt sie
        // ein) — dieselbe Regel wie beim Wartschritt: eine Zahl steht nicht an zwei Orten.
        text:
          'Ab der {{third}}. Provinz drückt jede weitere die Zielmoral in allen Ihren Provinzen ' +
          'um {{penalty}} Punkte. Sinkt die Moral zu tief, stockt die Produktion und es drohen ' +
          'Aufstände.',
        why: 'Erobern Sie, was Sie halten können, nicht alles, was erreichbar ist: wer schneller wächst, als seine Moral trägt, verliert das Reich von innen.',
      },
    },
  },

  /**
   * Was ein Ding ist, in höchstens zwei Sätzen (T-M13-11, R-UI-11).
   *
   * Die Regel für jeden dieser Texte: er sagt, wofür man das Ding *nimmt*, nicht was in
   * den Regeln steht. Zahlen gehören nicht hierher — Kosten, Dauer und Werte kommen aus
   * den Regeldateien und stünden hier nur ein zweites Mal, wo sie beim nächsten
   * Balancing-Lauf falsch werden.
   */
  explain: {
    buildings: {
      barracks: 'Hebt Infanterie aus und beschleunigt jede weitere Aushebung in dieser Provinz.',
      fortress: 'Verstärkt die Verteidiger der Provinz erheblich und hebt die Moral. Die einzige Antwort auf einen stärkeren Gegner.',
      factory: 'Erlaubt Panzer und Artillerie und steigert die Rohstoffproduktion der Provinz.',
      harbour: 'Braucht Küste. Schiffe legen hier deutlich schneller an und ab, und die Provinz ist zufriedener.',
      shipyard: 'Braucht Küste und einen Hafen. Erst hier entstehen Kriegsschiffe.',
      airfield: 'Erlaubt Flugzeuge und bestimmt, wie weit sie über die Grenze hinaus wirken.',
      railway: 'Truppen marschieren im eigenen Gebiet schneller, und die Provinz ist merklich zufriedener.',
    },
    units: {
      infantry: 'Billig, langsam und zäh — das Rückgrat jeder Front. Hält Gelände, das sonst niemand hält.',
      motorized: 'Infanterie auf Rädern: fast dreimal so schnell, entsprechend teurer. Für Lücken und Gegenstöße.',
      tank: 'Bricht Stellungen, gegen die Infanterie anrennt. Braucht eine Fabrik und viel Öl.',
      heavy_tank: 'Der schwerste Stoß, den das Spiel kennt, und der langsamste. Gegen Befestigungen unersetzlich.',
      artillery: 'Schießt in die Nachbarprovinz, ohne selbst hineinzugehen. Gegen Infanterie verheerend, allein schutzlos.',
      rocket_artillery: 'Artillerie mit doppelter Reichweite und höherem Tempo. Trifft, was zwei Provinzen entfernt steht.',
      fighter: 'Herrscht über die Luft und macht gegnerische Flugzeuge nieder. Am Boden richtet er wenig aus.',
      bomber: 'Trägt den Krieg drei Provinzen weit. Gegen Erdziele hart, gegen Jäger wehrlos.',
      destroyer: 'Beherrscht die See, deckt Transporte und beschießt die Küste.',
      transport: 'Bringt Landtruppen über See. Wehrlos — niemals ohne Geleit.',
    },
    resources: {
      food: 'Ernährt Bevölkerung und Truppen. Fehlt sie, sinkt die Moral in jeder Provinz.',
      wood: 'Baustoff für alles, was errichtet wird. Der erste Engpass jeder jungen Macht.',
      iron: 'Panzerung und Geschütze. Ohne Eisen keine schweren Verbände.',
      coal: 'Treibt Fabriken und Eisenbahnen an.',
      oil: 'Alles, was fährt und fliegt, verbraucht es — im Frieden wenig, im Feldzug viel.',
      rare: 'Selten und teuer; die modernsten Waffen kommen ohne sie nicht aus.',
      money: 'Bezahlt Bau, Aushebung und Unterhalt. Am Markt in jeden anderen Rohstoff tauschbar.',
    },
    mapModes: {
      political: 'Wem gehört was. Jede Macht hat ihre eigene Farbe, herrenloses Land bleibt grau.',
      resources: 'Wo etwas im Boden liegt. Je kräftiger das Grün, desto reicher die Provinz.',
      morale: 'Wie treu eine Provinz ist. Rot heißt aufstandsgefährdet, grün heißt ruhig.',
      strength: 'Wo Truppen stehen — so weit Sie sehen können. Je dunkler, desto stärker besetzt.',
      relations:
        'Wie Sie zu den Mächten stehen. Gold ist Ihres, Grün verbündet, Leinen in Frieden, der rote Ton im Krieg — und Grau bedeutet: Sie wissen es nicht.',
    },
    terrain: {
      plains: 'Offenes Land: schneller Marsch, wenig Deckung.',
      forest: 'Bremst den Vormarsch und begünstigt den Verteidiger.',
      mountain: 'Der langsamste Grund und der beste Schutz. Ein Gebirge hält kleine Verbände lange auf.',
      desert: 'Weite Wege, karge Erträge.',
      urban: 'Dichte Bebauung: viele Menschen, hohe Erträge, schwer zu nehmen.',
    },
    diplomacy: {
      peace:
        'Kein Krieg, kein Bündnis. Fremde Truppen dürfen einmarschieren — behalten lässt sich ' +
        'das Gebiet aber erst im Krieg. Ihre Grenze ist nicht bewacht, nur unantastbar.',
      war: 'Offener Krieg: beide Seiten dürfen angreifen und erobern.',
      truce: 'Kampfpause auf Zeit. Vor ihrem Ablauf ist kein neuer Krieg möglich.',
      alliance: 'Gemeinsame Sache: Durchmarsch und Kartenwissen inbegriffen.',
      rightOfWay: 'Erlaubt fremden Truppen den Marsch durch das eigene Gebiet — ohne Kriegserklärung.',
      sharedMap: 'Beide sehen, was der andere sieht.',
    },
  },

  alerts: {
    title: 'Meldungen',
    // Was heute neu dazugekommen ist (T-M21-04). Der Tag steht nicht im Satz: er ist
    // heute, sonst stuende die Meldung nicht da.
    // Das Pronomen kommt aus der Genus-Tabelle (grammar, T-M23-02, V2-11): die
    // Kaserne → sie, der Hafen → ihn, das Jagdflugzeug → es.
    unlockBuilding: 'Neu ab heute: {{building}}. Sie können {{pronoun}} jetzt bauen.',
    unlockUnit: 'Neu ab heute: {{unit}}. Sie können {{pronoun}} jetzt ausheben.',
    battle: 'Kampf in {{province}}',
    // Ueberrannt statt umkaempft: eine unverteidigte Provinz wechselt ohne Gefecht den
    // Besitzer, und genau das erschien vorher nirgends (T-M12-09).
    overrun: 'Feindliche Truppen in {{province}}',
    capitalLost: 'Die Hauptstadt ist verloren',
    completionBuilding: '{{building}} in {{province}} ist fertig',
    completionUnit: '{{unit}} in {{province}} ist ausgehoben',
    shortage: '{{resource}} wird knapp',
    unrest: '{{province}} steht vor dem Aufstand',
    world: 'Weltgeschehen',
    filter: 'Filter',
    // Eigene Woerter, nicht die der Kopfleiste: zwei Knoepfe namens "Diplomatie" sind
    // fuer eine Vorleseansage (und fuer einen Test) nicht auseinanderzuhalten.
    all: 'alles',
    combat: 'Kämpfe',
    economy: 'Aufbau',
    diplomacy: 'Verträge',
  },

  error: {
    title: 'Das Spiel ist auf einen Fehler gelaufen',
    body: 'Etwas in der Oberfläche hat aufgegeben. Die Partie selbst ist davon nicht betroffen — der letzte automatische Spielstand liegt weiterhin in der Liste.',
    hint: 'Bitte den Text oben weitergeben, wenn der Fehler wiederkehrt. Er wird nirgendwohin gesendet.',
    reload: 'Neu laden',
  },
  standings: {
    title: 'Lage',
    // Der Machtverlauf als Kurve (T-M25-02, R-UI-13): die Beschreibung nennt dem Ohr
    // die Endwerte, der Leerzustand sagt ehrlich, warum noch keine Kurve da ist.
    historyAria: 'Punkteverlauf — Stand: {{list}}',
    historyEmpty: 'Noch keine Aufzeichnung: Die Kurve beginnt mit dem nächsten Tageswechsel.',
    // Der ehrliche Wartesatz unter drei Aufzeichnungspunkten (T-M28-01): zwei Punkte
    // wären eine Gerade, die einen Verlauf nur vortäuscht.
    historyWaiting: 'Erst {{days}} von 3 Tagen aufgezeichnet — die Kurve kommt mit dem dritten Tageswechsel.',
    points: 'Punkte',
    relation: 'Verhältnis',
    seenStrength: 'Gesehene Stärke',
    you: 'Sie',
    open: 'Lage',
    victoryTitle: 'Die Partie ist entschieden',
    won: 'Sie haben gewonnen.',
    newGame: 'Neue Partie',
    lost: '{{nation}} hat gewonnen.',
    lostPlural: '{{nation}} haben gewonnen.',
    eliminated: 'Sie sind ausgeschieden. Ihre letzte Provinz ist gefallen — die Partie läuft ohne Sie weiter.',
    // Vier Zeilen statt einer, weil in dem einen Satz zwei Zahlen stehen, die beide bei
    // eins in die Einzahl gehen (T-M12-10). "1 Provinzen" war der gemeldete Befund,
    // "1 Punkte" derselbe Fehler daneben.
    summaryHead: 'Tag {{day}}',
    summaryPointsOne: '1 Punkt',
    summaryPointsMany: '{{count}} Punkte',
    summaryProvincesOne: '1 Provinz',
    summaryProvincesMany: '{{count}} Provinzen',
    close: 'Karte ansehen',
  },

  explainUi: {
    about: 'Was ist {{subject}}?',
  },

  meter: {
    progress: '{{percent}} %',
    remaining: 'noch {{time}}',
    done: 'fertig',
    march: 'Marsch',
    victoryGoal: 'Siegziel',
    victoryShare: '{{percent}} % von {{goal}} %',
  },

  time: {
    hours: '{{hours}} h',
    days: '{{days}} Tage',
  },
} as const

export type Catalog = typeof de
