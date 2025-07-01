import seedrandom, { PRNG } from "seedrandom"

interface RandomStringOptions {
  length?: number,
  charset?: 'all' | 'alpha' | 'alphanum'
}
const rangeToCharset = (min: number, max: number) => [...Array(max-min).keys()].map(i => String.fromCharCode(i+min))
const CHARSETS = {
  'all': rangeToCharset(32, 127),
  'alpha': [...rangeToCharset(65, 91), ...rangeToCharset(97, 123)],
  'alphanum': [...rangeToCharset(48, 58), ...rangeToCharset(65, 91), ...rangeToCharset(97, 123)]
}

export default class Random {
  private rng: PRNG
  private static defaultRandom: Random = new Random()

  constructor(seed?: string) {
    this.rng = seedrandom(seed)
  }

  static get default() {
    return this.defaultRandom
  }

  static seed(seed: string) {
    this.defaultRandom = new Random(seed)
  }

  random() {
    return this.rng()
  }

  static random() {
    return this.defaultRandom.random()
  }

  randomIntLessThan(max: number) {
    return Math.floor(this.random() * max)
  }

  static randomIntLessThan(max: number) {
    return this.defaultRandom.randomIntLessThan(max)
  }

  randRange(min: number, max: number) {
    return this.randomIntLessThan(max - min) + min
  }

  // min: inclusive, max: exclusive
  static randRange(min: number, max: number) {
    return this.defaultRandom.randRange(min, max)
  }
  
  randomChoice<T>(array: T[]) {
    const result = array[this.randomIntLessThan(array.length)]
    if (result == null) {
      throw new Error(`Cannot choose from an empty array`)
    }
    return result
  }

  static randomChoice<T>(array: T[]) {
    return this.defaultRandom.randomChoice(array)
  }

  randomChooseMany<T>(array: T[], amount: number) {
    if (amount > array.length) {
      throw new Error(`Cannot choose ${amount.toString()} items from an array with length ${array.length.toString()}`)
    }
    const chosen: T[] = []
    while(chosen.length < amount) {
      const choice = this.randomChoice(array)
      if (chosen.includes(choice)) continue
      chosen.push(choice)
    }
    return chosen
  }

  static randomChooseMany<T>(array: T[], amount: number) {
    return this.defaultRandom.randomChooseMany(array, amount)
  }

  randomString({ length, charset } : RandomStringOptions = {}) {
    length ??= this.randRange(8, 16)
    charset ??= 'alphanum'
    return Array.from({ length }, () => this.randomChoice(CHARSETS[charset])).join('').trim()
  }

  static randomString(args : RandomStringOptions = {}) {
    return this.defaultRandom.randomString(args)
  }

  randomStringExcluding(exlusions: string[], options : RandomStringOptions = {}) {
    let string = this.randomString(options)
    while(exlusions.includes(string)) {
      string = this.randomString(options)
    }
    return string
  }

  static randomStringExcluding(exlusions: string[], options : RandomStringOptions = {}) {
    return this.defaultRandom.randomStringExcluding(exlusions, options)
  }

  /**
   * Array of random strings with no duplicates
   */
  randomStringArray(length: number, options: RandomStringOptions = {}) {
    const array: string[] = []
    for (let i = 0; i < length; i++) {
      array.push(this.randomStringExcluding(array, options))
    }
    return array
  }

  static randomStringArray(length: number, options: RandomStringOptions = {}) {
    return this.defaultRandom.randomStringArray(length, options)
  }

  randomHex(length: number) {
    return Array.from({ length }, () => this.randomIntLessThan(16).toString(16)).join('')
  }

  static randomHex(length: number) {
    return this.defaultRandom.randomHex(length)
  }

  randomTransactionId() {
    return this.randomHex(64)
  }

  static randomTransactionId() {
    return this.defaultRandom.randomTransactionId()
  }

  randomInscriptionId() {
    const index = this.randomIntLessThan(100)
    return `${this.randomTransactionId()}i${index.toString()}`
  }

  static randomInscriptionId() {
    return this.defaultRandom.randomInscriptionId()
  }

  shuffle<T>(array: T[]) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.randomIntLessThan(i + 1);
      [array[i], array[j]] = [array[j] as T, array[i] as T]
    }
    return array
  }

  static shuffle<T>(array: T[]) {
    return this.defaultRandom.shuffle(array)
  }

  randomUUID() {
    return '00000000-0000-0000-0000-000000000000'.replace(/0/g, () => this.randomHex(1))
  }

  static randomUUID() {
    return this.defaultRandom.randomUUID()
  }
}
