export const SCHEMA_VERSION = 2

/** Casey gives you one clock for the whole assessment, not one per question. */
export const DEFAULT_TOTAL_TIME_SECONDS = 35 * 60

export type Difficulty = 'easy' | 'medium' | 'hard'

export type QuestionType =
  | 'structuring'
  | 'math'
  | 'exhibit'
  | 'brainstorming'
  | 'synthesis'

export const QUESTION_TYPES: QuestionType[] = [
  'structuring',
  'math',
  'exhibit',
  'brainstorming',
  'synthesis',
]

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  structuring: 'Structuring',
  math: 'Quantitative',
  exhibit: 'Exhibit interpretation',
  brainstorming: 'Brainstorming',
  synthesis: 'Synthesis',
}

/**
 * How the candidate answers. `choice` is the format the real assessment leans on
 * hardest -- "select the two most relevant" against a button list.
 */
export type ResponseFormat = 'choice' | 'number' | 'text'

export const RESPONSE_FORMATS: ResponseFormat[] = ['choice', 'number', 'text']

export interface ExhibitTable {
  columns: string[]
  rows: (string | number)[][]
}

export type ExhibitChartSeries = {
  label: string
  values: number[]
}

export interface ExhibitChart {
  kind: 'bar' | 'stacked-bar'
  categories: string[]
  series: ExhibitChartSeries[]
  valueSuffix?: string
}

export interface Exhibit {
  id: string
  title: string
  type: 'table' | 'chart' | 'image' | 'text'
  table?: ExhibitTable
  chart?: ExhibitChart
  /** data: URI so a case file stays portable */
  src?: string
  text?: string
  unitsNote?: string
  source?: string
}

export interface IdealAnswer {
  /** required for responseFormat "number" */
  value?: number
  /** indices into Question.options; required for responseFormat "choice" */
  correctOptions?: number[]
  /** why each option is or is not one of the picks, indexed like options */
  optionRationale?: string[]
  workedSolution?: string
  keyPoints?: string[]
  commonMistakes?: string[]
}

export interface ScoringWeights {
  structure?: number
  accuracy?: number
  communication?: number
  creativity?: number
  [dimension: string]: number | undefined
}

export interface Question {
  id: string
  type: QuestionType
  /** advisory pacing budget -- the hard constraint is the case-level clock */
  timeLimitSeconds: number
  prompt: string
  exhibitIds?: string[]
  responseFormat: ResponseFormat

  /** responseFormat "choice" */
  options?: string[]
  /**
   * How many options the candidate must pick. `0` means "select all that apply" -- the
   * count is withheld, which is what the real assessment does on its judgement questions:
   * being told "pick exactly two" is half the answer.
   */
  selectCount?: number

  /** responseFormat "number" */
  unit?: string
  tolerancePct?: number
  /** e.g. "Round to the nearest billion: for $20.3B, type 20." */
  answerFormatNote?: string

  /** responseFormat "text" */
  maxLines?: number

  idealAnswer: IdealAnswer

  /**
   * What the interviewer says once the answer is in: the model answer's context plus
   * any NEW case information. Always shown -- later questions depend on it. The
   * rubric in `idealAnswer` is what stays hidden behind the answer key.
   */
  followUp?: string
  followUpExhibitIds?: string[]

  scoringWeights?: ScoringWeights
}

export interface Authoring {
  model?: string
  generatedAt?: string
  mathVerifiedWith?: string
  verificationLog?: string
}

export interface Case {
  schemaVersion: number
  id: string
  title: string
  industry: string
  /** the BCG functional practice the case leans on, e.g. "Marketing, Sales & Pricing" */
  functionalPractice?: string
  difficulty: Difficulty
  estimatedMinutes: number
  /** the single clock for the whole case; defaults to 35 minutes */
  totalTimeSeconds?: number
  prompt: string
  exhibits: Exhibit[]
  questions: Question[]
  /** the interviewer's closing line once every question is answered */
  closing?: string
  authoring?: Authoring
}

export interface AnswerRecord {
  questionId: string
  /** raw text the candidate typed; numbers arrive as strings too */
  answer: string
  /** indices into Question.options for responseFormat "choice" */
  selected?: number[]
  /** optional working the candidate showed; the grader needs it to diagnose slips */
  scratch?: string
  secondsUsed: number
  /** wall-clock moment the answer was sent, for chat timestamps */
  at: string
  /** true when the case-level clock ran out and the answer was taken as-is */
  autoSubmitted: boolean
  /** the candidate opened the answer key for this question before moving on */
  peeked?: boolean
}

export type Phase = 'library' | 'intro' | 'running' | 'transcript'

export interface Session {
  caseId: string
  caseTitle: string
  startedAt: string
  practiceMode: boolean
  questionIndex: number
  answers: AnswerRecord[]
  /** question ids whose answer key the candidate opened */
  peeked: string[]
}

export function totalTimeFor(c: Case): number {
  return c.totalTimeSeconds ?? DEFAULT_TOTAL_TIME_SECONDS
}
