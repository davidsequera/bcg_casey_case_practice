import {
  QUESTION_TYPES,
  RESPONSE_FORMATS,
  SCHEMA_VERSION,
  type Case,
  type Difficulty,
  type Question,
  type QuestionType,
  type ResponseFormat,
} from '../types/case'

export type ValidationResult =
  | { ok: true; case: Case; warnings: string[] }
  | { ok: false; errors: string[] }

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

/**
 * Structural validation only. Declared answers and exhibit figures are trusted --
 * math correctness is enforced upstream by AUTHORING_PROMPT.md.
 */
export function validateCase(input: unknown): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isRecord(input)) {
    return { ok: false, errors: ['Top level value must be a JSON object.'] }
  }

  const req = (key: string, type: 'string' | 'number') => {
    const v = input[key]
    if (typeof v !== type || (type === 'string' && (v as string).trim() === '')) {
      errors.push(`"${key}" is required and must be a non-empty ${type}.`)
    }
  }

  req('id', 'string')
  req('title', 'string')
  req('industry', 'string')
  req('prompt', 'string')
  req('estimatedMinutes', 'number')

  if (
    input.functionalPractice !== undefined &&
    (typeof input.functionalPractice !== 'string' || input.functionalPractice.trim() === '')
  ) {
    errors.push('"functionalPractice" must be a non-empty string when present.')
  }

  if (typeof input.schemaVersion !== 'number') {
    errors.push('"schemaVersion" is required and must be a number.')
  } else if (input.schemaVersion !== SCHEMA_VERSION) {
    warnings.push(
      `Case declares schemaVersion ${input.schemaVersion}; this app expects ${SCHEMA_VERSION}.`,
    )
  }

  if (input.totalTimeSeconds !== undefined) {
    if (typeof input.totalTimeSeconds !== 'number' || input.totalTimeSeconds <= 0) {
      errors.push('"totalTimeSeconds" must be a positive number when present.')
    }
  }

  if (!DIFFICULTIES.includes(input.difficulty as Difficulty)) {
    errors.push(`"difficulty" must be one of: ${DIFFICULTIES.join(', ')}.`)
  }

  // ---- exhibits ----
  const exhibitIds = new Set<string>()
  if (input.exhibits !== undefined && !Array.isArray(input.exhibits)) {
    errors.push('"exhibits" must be an array (use [] when the case has none).')
  } else {
    const exhibits = (input.exhibits ?? []) as unknown[]
    exhibits.forEach((raw, i) => {
      const where = `exhibits[${i}]`
      if (!isRecord(raw)) {
        errors.push(`${where} must be an object.`)
        return
      }
      if (typeof raw.id !== 'string' || raw.id.trim() === '') {
        errors.push(`${where}.id is required.`)
      } else if (exhibitIds.has(raw.id)) {
        errors.push(`${where}.id "${raw.id}" is duplicated.`)
      } else {
        exhibitIds.add(raw.id)
      }
      if (typeof raw.title !== 'string') errors.push(`${where}.title is required.`)

      if (raw.type === 'table') {
        const t = raw.table
        if (!isRecord(t) || !Array.isArray(t.columns) || !Array.isArray(t.rows)) {
          errors.push(`${where}.table must have "columns" and "rows" arrays.`)
        } else {
          const width = t.columns.length
          const rows = t.rows as unknown[]
          rows.forEach((row, r) => {
            if (!Array.isArray(row)) {
              errors.push(`${where}.table.rows[${r}] must be an array.`)
            } else if (row.length !== width) {
              errors.push(
                `${where}.table.rows[${r}] has ${row.length} cells but there are ${width} columns.`,
              )
            }
          })
        }
      } else if (raw.type === 'chart') {
        const ch = raw.chart
        if (!isRecord(ch)) {
          errors.push(`${where}.chart is required for chart exhibits.`)
        } else {
          if (ch.kind !== 'bar' && ch.kind !== 'stacked-bar') {
            errors.push(`${where}.chart.kind must be "bar" or "stacked-bar".`)
          }
          if (!isStringArray(ch.categories) || ch.categories.length === 0) {
            errors.push(`${where}.chart.categories must be a non-empty array of strings.`)
          }
          if (!Array.isArray(ch.series) || ch.series.length === 0) {
            errors.push(`${where}.chart.series must be a non-empty array.`)
          } else {
            const catCount = isStringArray(ch.categories) ? ch.categories.length : -1
            ch.series.forEach((s, si) => {
              if (
                !isRecord(s) ||
                typeof s.label !== 'string' ||
                !Array.isArray(s.values) ||
                !s.values.every((v) => typeof v === 'number')
              ) {
                errors.push(
                  `${where}.chart.series[${si}] needs a string "label" and numeric "values".`,
                )
              } else if (catCount >= 0 && s.values.length !== catCount) {
                errors.push(
                  `${where}.chart.series[${si}] has ${s.values.length} values but there are ${catCount} categories.`,
                )
              }
            })
          }
        }
      } else if (raw.type === 'image') {
        if (typeof raw.src !== 'string' || raw.src.trim() === '') {
          errors.push(`${where}.src is required for image exhibits (use a data: URI).`)
        }
      } else if (raw.type === 'text') {
        if (typeof raw.text !== 'string' || raw.text.trim() === '') {
          errors.push(`${where}.text is required for text exhibits.`)
        }
      } else {
        errors.push(`${where}.type must be one of: table, chart, image, text.`)
      }
    })
  }

  // ---- questions ----
  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    errors.push('"questions" is required and must be a non-empty array.')
  } else {
    const questionIds = new Set<string>()
    input.questions.forEach((raw, i) => {
      const where = `questions[${i}]`
      if (!isRecord(raw)) {
        errors.push(`${where} must be an object.`)
        return
      }
      if (typeof raw.id !== 'string' || raw.id.trim() === '') {
        errors.push(`${where}.id is required.`)
      } else if (questionIds.has(raw.id)) {
        errors.push(`${where}.id "${raw.id}" is duplicated.`)
      } else {
        questionIds.add(raw.id)
      }

      if (!QUESTION_TYPES.includes(raw.type as QuestionType)) {
        errors.push(`${where}.type must be one of: ${QUESTION_TYPES.join(', ')}.`)
      }
      if (typeof raw.prompt !== 'string' || raw.prompt.trim() === '') {
        errors.push(`${where}.prompt is required.`)
      }
      if (typeof raw.timeLimitSeconds !== 'number' || raw.timeLimitSeconds <= 0) {
        errors.push(`${where}.timeLimitSeconds must be a positive number.`)
      }
      const format = raw.responseFormat as ResponseFormat
      if (!RESPONSE_FORMATS.includes(format)) {
        errors.push(`${where}.responseFormat must be one of: ${RESPONSE_FORMATS.join(', ')}.`)
      }

      const optionCount = isStringArray(raw.options) ? raw.options.length : -1
      if (format === 'choice') {
        if (optionCount < 2) {
          errors.push(`${where}.options must be an array of at least two strings.`)
        }
        if (
          typeof raw.selectCount !== 'number' ||
          !Number.isInteger(raw.selectCount) ||
          raw.selectCount < 0
        ) {
          errors.push(
            `${where}.selectCount must be a non-negative integer (0 = "select all that apply").`,
          )
        } else if (optionCount >= 0 && raw.selectCount > optionCount) {
          errors.push(
            `${where}.selectCount is ${raw.selectCount} but only ${optionCount} options exist.`,
          )
        }
      } else if (raw.options !== undefined) {
        errors.push(`${where}.options only applies to responseFormat "choice".`)
      }

      const ignorable: [string, boolean][] = [
        ['unit', format === 'number'],
        ['tolerancePct', format === 'number'],
        ['answerFormatNote', format === 'number'],
        ['maxLines', format === 'text'],
      ]
      for (const [key, applies] of ignorable) {
        if (raw[key] !== undefined && !applies) {
          warnings.push(
            `${where}.${key} is ignored for responseFormat "${String(raw.responseFormat)}".`,
          )
        }
      }

      for (const key of ['exhibitIds', 'followUpExhibitIds'] as const) {
        const ids = raw[key]
        if (ids === undefined) continue
        if (!Array.isArray(ids)) {
          errors.push(`${where}.${key} must be an array of exhibit ids.`)
        } else {
          ids.forEach((id) => {
            if (typeof id !== 'string' || !exhibitIds.has(id)) {
              errors.push(`${where}.${key} references unknown exhibit "${String(id)}".`)
            }
          })
        }
      }

      if (raw.followUp !== undefined && typeof raw.followUp !== 'string') {
        errors.push(`${where}.followUp must be a string.`)
      }

      if (!isRecord(raw.idealAnswer)) {
        errors.push(`${where}.idealAnswer is required.`)
      } else {
        const ideal = raw.idealAnswer
        if (format === 'number' && typeof ideal.value !== 'number') {
          errors.push(`${where}.idealAnswer.value is required for numeric questions.`)
        }
        if (format === 'choice') {
          const picks = ideal.correctOptions
          if (!Array.isArray(picks) || picks.some((n) => typeof n !== 'number')) {
            errors.push(
              `${where}.idealAnswer.correctOptions is required for choice questions (indices into options).`,
            )
          } else {
            if (optionCount >= 0) {
              picks.forEach((n) => {
                if (!Number.isInteger(n) || n < 0 || n >= optionCount) {
                  errors.push(`${where}.idealAnswer.correctOptions has out-of-range index ${n}.`)
                }
              })
            }
            if (new Set(picks).size !== picks.length) {
              errors.push(`${where}.idealAnswer.correctOptions contains a duplicate index.`)
            }
            if (picks.length === 0) {
              errors.push(`${where}.idealAnswer.correctOptions declares no correct option.`)
            }
            if (
              typeof raw.selectCount === 'number' &&
              raw.selectCount > 0 &&
              picks.length !== raw.selectCount
            ) {
              errors.push(
                `${where} asks for ${raw.selectCount} option(s) but declares ${picks.length} correct.`,
              )
            }
          }
          if (ideal.optionRationale !== undefined) {
            if (!isStringArray(ideal.optionRationale)) {
              errors.push(`${where}.idealAnswer.optionRationale must be an array of strings.`)
            } else if (optionCount >= 0 && ideal.optionRationale.length !== optionCount) {
              errors.push(
                `${where}.idealAnswer.optionRationale must have one entry per option (${optionCount}).`,
              )
            }
          } else {
            warnings.push(
              `${where} gives no optionRationale, so the answer key cannot explain the distractors.`,
            )
          }
        }
        if (
          typeof ideal.workedSolution !== 'string' &&
          !Array.isArray(ideal.keyPoints) &&
          format !== 'choice'
        ) {
          errors.push(
            `${where}.idealAnswer needs a "workedSolution" or "keyPoints" for the grader to score against.`,
          )
        }
        for (const key of ['keyPoints', 'commonMistakes'] as const) {
          const v = ideal[key]
          if (v !== undefined && !Array.isArray(v)) {
            errors.push(`${where}.idealAnswer.${key} must be an array of strings.`)
          }
        }
      }

      if (
        raw.type === 'exhibit' &&
        (!Array.isArray(raw.exhibitIds) || raw.exhibitIds.length === 0)
      ) {
        warnings.push(`${where} is an exhibit question but references no exhibit.`)
      }
    })
  }

  if (input.closing !== undefined && typeof input.closing !== 'string') {
    errors.push('"closing" must be a string when present.')
  }

  if (input.authoring !== undefined && !isRecord(input.authoring)) {
    errors.push('"authoring" must be an object when present.')
  } else if (isRecord(input.authoring) && !input.authoring.verificationLog) {
    warnings.push(
      'No authoring.verificationLog — the figures in this case were not shown to be tool-verified.',
    )
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, case: input as unknown as Case, warnings }
}

export function parseAndValidate(text: string): ValidationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] }
  }
  return validateCase(parsed)
}

/** True when the question expects a single numeric answer. */
export function isNumeric(q: Question): boolean {
  return q.responseFormat === 'number'
}
