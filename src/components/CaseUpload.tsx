import { useState } from 'react'
import { parseAndValidate } from '../lib/validateCase'
import { copyToClipboard } from '../lib/transcript'
import { AUTHORING_PROMPT } from '../lib/authoringPrompt'
import type { Case } from '../types/case'

export function CaseUpload({
  onAdd,
  notify,
}: {
  onAdd: (c: Case) => void
  notify: (msg: string) => void
}) {
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [promptOpen, setPromptOpen] = useState(false)

  const ingest = (raw: string) => {
    const result = parseAndValidate(raw)
    if (!result.ok) {
      setErrors(result.errors)
      setWarnings([])
      return
    }
    setErrors([])
    setWarnings(result.warnings)
    onAdd(result.case)
    setText('')
    notify(`Added “${result.case.title}”`)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    ingest(await file.text())
  }

  const copyPrompt = async () => {
    const ok = await copyToClipboard(AUTHORING_PROMPT)
    notify(ok ? 'Prompt copied — paste it into your LLM' : 'Could not access the clipboard')
  }

  const lines = AUTHORING_PROMPT.split('\n').length

  return (
    <section className="panel build">
      <div className="build-head">
        <h2>Write your own case</h2>
        <p>
          Any subject you like — your target office's sector, the industry you keep getting cased
          on. An LLM writes it; this app checks it against the schema before it runs.
        </p>
      </div>

      <div className="steps-grid">
        <div className="build-step">
          <b>1</b>
          <h4>Copy the prompt</h4>
          <p>
            It carries the full schema and the rules that make a case feel like the real
            assessment.
          </p>
          <div className="row">
            <button className="primary" onClick={() => void copyPrompt()}>
              Copy the prompt
            </button>
          </div>
        </div>

        <div className="build-step">
          <b>2</b>
          <h4>Run it with code execution on</h4>
          <p>
            Claude, ChatGPT or Gemini, with its Python tool enabled. Add one line saying what case
            you want. The prompt forces the model to compute every figure with the tool and paste
            the output into <code>authoring.verificationLog</code>, so the arithmetic is
            machine-checked rather than guessed.
          </p>
        </div>

        <div className="build-step">
          <b>3</b>
          <h4>Paste the JSON back</h4>
          <p>
            It is validated, stored in this browser only, and appears in the library above
            alongside the bundled cases.
          </p>
          <div className="row">
            <label className="file-drop">
              Load a .json file
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
            </label>
          </div>
        </div>
      </div>

      <div className={`prompt-view ${promptOpen ? '' : 'is-collapsed'}`}>
        <div className="spread">
          <h4>The prompt</h4>
          <div className="row">
            <span className="muted small">{lines} lines</span>
            <button className="link" onClick={() => setPromptOpen((v) => !v)}>
              {promptOpen ? 'Collapse' : 'Read it in full'}
            </button>
            <button onClick={() => void copyPrompt()}>Copy</button>
          </div>
        </div>
        <pre className="prompt-scroll">{AUTHORING_PROMPT}</pre>
      </div>

      <div className="paste-area">
        <h4>Paste the case JSON</h4>
        <textarea
          value={text}
          placeholder='{ "schemaVersion": 2, "id": "...", "title": "...", "questions": [ ... ] }'
          onChange={(e) => setText(e.target.value)}
        />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" disabled={!text.trim()} onClick={() => ingest(text)}>
            Validate and add
          </button>
          {text.trim() ? (
            <button className="ghost" onClick={() => setText('')}>
              Clear
            </button>
          ) : null}
        </div>

        {errors.length > 0 ? (
          <div className="errors" style={{ marginTop: 16 }}>
            <strong>This case was not added:</strong>
            <ul>
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {warnings.length > 0 ? (
          <div className="warnings" style={{ marginTop: 16 }}>
            <strong>Added, with warnings:</strong>
            <ul>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}
