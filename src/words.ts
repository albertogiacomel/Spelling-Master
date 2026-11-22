export type Difficulty = 'principiante' | 'intermedio' | 'avanzato';
export type WordPool = Difficulty | 'tutti';
export type Category =
  | 'animals'
  | 'colors'
  | 'numbers'
  | 'school'
  | 'food'
  | 'nature'
  | 'sky'
  | 'home'
  | 'transport'
  | 'drinks'
  | 'emotions'
  | 'people';

export interface WordEntry {
  readonly word: string;
  readonly it: string;
  readonly category: Category;
  readonly sentence: string;
}

export const WORD_DATABASE: Readonly<Record<Difficulty, readonly WordEntry[]>> = {
  principiante: [
    { word: 'CAT', it: 'Gatto', category: 'animals', sentence: 'The small cat drinks milk.' },
    { word: 'DOG', it: 'Cane', category: 'animals', sentence: 'My brown dog likes to play.' },
    { word: 'RED', it: 'Rosso', category: 'colors', sentence: 'I have a red toy car.' },
    { word: 'BLUE', it: 'Blu', category: 'colors', sentence: 'The sky is bright blue today.' },
    { word: 'SUN', it: 'Sole', category: 'sky', sentence: 'The yellow sun is in the sky.' },
    { word: 'PEN', it: 'Penna', category: 'school', sentence: 'Write your name with a blue pen.' },
    { word: 'BOOK', it: 'Libro', category: 'school', sentence: 'Open your English book on the desk.' },
    { word: 'FISH', it: 'Pesce', category: 'animals', sentence: 'An orange fish swims in the water.' },
    { word: 'STAR', it: 'Stella', category: 'sky', sentence: 'Look at the bright star at night.' },
    { word: 'CAKE', it: 'Torta', category: 'food', sentence: 'We eat a sweet cake at the party.' },
    { word: 'FIVE', it: 'Cinque', category: 'numbers', sentence: 'I have five fingers on my hand.' },
    { word: 'BEAR', it: 'Orso', category: 'animals', sentence: 'The big bear sleeps in the forest.' },
    { word: 'BIRD', it: 'Uccello', category: 'animals', sentence: 'A little bird sings in the tree.' },
    { word: 'MILK', it: 'Latte', category: 'drinks', sentence: 'I drink milk for breakfast.' },
    { word: 'TREE', it: 'Albero', category: 'nature', sentence: 'The green tree is very tall.' },
    { word: 'RAIN', it: 'Pioggia', category: 'nature', sentence: 'The rain falls on the roof.' },
  ],
  intermedio: [
    { word: 'APPLE', it: 'Mela', category: 'food', sentence: 'She eats a sweet red apple.' },
    { word: 'TIGER', it: 'Tigre', category: 'animals', sentence: 'The orange tiger runs very fast.' },
    { word: 'GREEN', it: 'Verde', category: 'colors', sentence: 'The grass in the park is green.' },
    { word: 'HAPPY', it: 'Felice', category: 'emotions', sentence: 'The children are very happy today.' },
    { word: 'HOUSE', it: 'Casa', category: 'home', sentence: 'My family lives in a nice house.' },
    { word: 'TRAIN', it: 'Treno', category: 'transport', sentence: 'The toy train goes choo choo.' },
    { word: 'WATER', it: 'Acqua', category: 'drinks', sentence: 'Drink a glass of fresh water.' },
    { word: 'PIZZA', it: 'Pizza', category: 'food', sentence: 'We love eating warm pizza on Friday.' },
    { word: 'HORSE', it: 'Cavallo', category: 'animals', sentence: 'The white horse jumps over the fence.' },
    { word: 'SMILE', it: 'Sorriso', category: 'emotions', sentence: 'She has a big happy smile.' },
    { word: 'SEVEN', it: 'Sette', category: 'numbers', sentence: 'I am seven years old.' },
    { word: 'MOUSE', it: 'Topo', category: 'animals', sentence: 'A little grey mouse likes cheese.' },
    { word: 'BREAD', it: 'Pane', category: 'food', sentence: 'We buy fresh bread every morning.' },
    { word: 'CLOCK', it: 'Orologio', category: 'home', sentence: 'The clock on the wall shows three.' },
    { word: 'PLANT', it: 'Pianta', category: 'nature', sentence: 'A small plant grows by the window.' },
    { word: 'GRAPE', it: 'Uva', category: 'food', sentence: 'I eat a sweet green grape.' },
    { word: 'SHEEP', it: 'Pecora', category: 'animals', sentence: 'The white sheep eats grass in the field.' },
  ],
  avanzato: [
    { word: 'RABBIT', it: 'Coniglio', category: 'animals', sentence: 'The white rabbit has long ears.' },
    { word: 'SCHOOL', it: 'Scuola', category: 'school', sentence: 'I go to school with my backpack.' },
    { word: 'YELLOW', it: 'Giallo', category: 'colors', sentence: 'A banana is sweet and yellow.' },
    { word: 'MONKEY', it: 'Scimmia', category: 'animals', sentence: 'The funny monkey climbs the tree.' },
    { word: 'FRIEND', it: 'Amico', category: 'people', sentence: 'My best friend plays with me at school.' },
    { word: 'BANANA', it: 'Banana', category: 'food', sentence: 'I eat a yellow banana for snack.' },
    { word: 'ORANGE', it: 'Arancia', category: 'food', sentence: 'I eat a sweet orange after lunch.' },
    { word: 'PENCIL', it: 'Matita', category: 'school', sentence: 'Draw a picture with your pencil.' },
    { word: 'FAMILY', it: 'Famiglia', category: 'people', sentence: 'I love my mother, father and family.' },
    { word: 'GARDEN', it: 'Giardino', category: 'nature', sentence: 'Pretty flowers grow in the garden.' },
    { word: 'FLOWER', it: 'Fiore', category: 'nature', sentence: 'This flower smells very sweet.' },
    { word: 'WINTER', it: 'Inverno', category: 'nature', sentence: 'In winter we wear a warm coat.' },
    { word: 'PIRATE', it: 'Pirata', category: 'people', sentence: 'The pirate sails on a big ship.' },
    { word: 'ROCKET', it: 'Razzo', category: 'transport', sentence: 'The rocket flies up into space.' },
    { word: 'TURTLE', it: 'Tartaruga', category: 'animals', sentence: 'The slow turtle walks on the sand.' },
    { word: 'SUMMER', it: 'Estate', category: 'nature', sentence: 'In summer we swim in the sea.' },
  ],
};

export const ALL_WORDS: readonly WordEntry[] = [
  ...WORD_DATABASE.principiante,
  ...WORD_DATABASE.intermedio,
  ...WORD_DATABASE.avanzato,
];

export function getPool(difficulty: WordPool): readonly WordEntry[] {
  return difficulty === 'tutti' ? ALL_WORDS : WORD_DATABASE[difficulty];
}

export function pickWord(
  pool: readonly WordEntry[],
  used: ReadonlySet<string>,
  random: () => number = Math.random,
): WordEntry {
  if (pool.length === 0) throw new RangeError('Empty word pool');
  const available = pool.filter((entry) => !used.has(entry.word));
  const source = available.length > 0 ? available : pool;
  const index = Math.min(source.length - 1, Math.max(0, Math.floor(random() * source.length)));
  const entry = source[index];
  if (!entry) throw new Error('Word selection failed');
  return entry;
}

export function normalizeAnswer(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '');
}

export interface SentencePart {
  readonly text: string;
  readonly blank: boolean;
}

export function sentenceParts(sentence: string, word: string, reveal = false): SentencePart[] {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
  const parts: SentencePart[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sentence)) !== null) {
    if (match.index > last) parts.push({ text: sentence.slice(last, match.index), blank: false });
    parts.push({ text: reveal ? match[0] : '_'.repeat(word.length), blank: true });
    last = match.index + match[0].length;
  }
  if (last < sentence.length) parts.push({ text: sentence.slice(last), blank: false });
  if (parts.length === 0) parts.push({ text: sentence, blank: false });
  return parts;
}

export function scoreFor(length: number, streak: number, hintUsed: boolean): number {
  const base = length <= 4 ? 5 : length === 5 ? 10 : 15;
  const bonus = Math.min(Math.max(streak, 0), 5);
  const penalty = hintUsed ? 2 : 0;
  return Math.max(3, base - penalty + bonus);
}

export interface AlphabetEntry {
  readonly letter: string;
  readonly ipa: string;
  readonly tricky: boolean;
}

export const ALPHABET: readonly AlphabetEntry[] = [
  { letter: 'A', ipa: '/eɪ/ “ei”', tricky: true },
  { letter: 'B', ipa: '/biː/ “bee”', tricky: false },
  { letter: 'C', ipa: '/siː/ “see”', tricky: false },
  { letter: 'D', ipa: '/diː/ “dee”', tricky: false },
  { letter: 'E', ipa: '/iː/ “ee”', tricky: true },
  { letter: 'F', ipa: '/ef/ “eff”', tricky: false },
  { letter: 'G', ipa: '/dʒiː/ “gee”', tricky: true },
  { letter: 'H', ipa: '/eɪtʃ/ “aitch”', tricky: true },
  { letter: 'I', ipa: '/aɪ/ “eye”', tricky: true },
  { letter: 'J', ipa: '/dʒeɪ/ “jay”', tricky: true },
  { letter: 'K', ipa: '/keɪ/ “kay”', tricky: true },
  { letter: 'L', ipa: '/el/ “ell”', tricky: false },
  { letter: 'M', ipa: '/em/ “em”', tricky: false },
  { letter: 'N', ipa: '/en/ “en”', tricky: false },
  { letter: 'O', ipa: '/əʊ/ “oh”', tricky: false },
  { letter: 'P', ipa: '/piː/ “pee”', tricky: false },
  { letter: 'Q', ipa: '/kjuː/ “cue”', tricky: true },
  { letter: 'R', ipa: '/ɑːr/ “are”', tricky: true },
  { letter: 'S', ipa: '/es/ “ess”', tricky: false },
  { letter: 'T', ipa: '/tiː/ “tee”', tricky: false },
  { letter: 'U', ipa: '/juː/ “you”', tricky: true },
  { letter: 'V', ipa: '/viː/ “vee”', tricky: false },
  { letter: 'W', ipa: 'double-u', tricky: true },
  { letter: 'X', ipa: '/eks/ “ex”', tricky: false },
  { letter: 'Y', ipa: '/waɪ/ “why”', tricky: true },
  { letter: 'Z', ipa: 'zee / zed', tricky: false },
];

export const TRICKY_LETTERS = ALPHABET.filter((entry) => entry.tricky).map((entry) => entry.letter);
