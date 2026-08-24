import type { ChatMessage } from '../lib/chat'
import type { Case } from '../types/case'
import { formatStamp } from '../lib/timer'
import { ExhibitView } from './Exhibit'

function Exhibits({ caseData, ids }: { caseData: Case; ids?: string[] }) {
  const found = (ids ?? [])
    .map((id) => caseData.exhibits.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
  if (found.length === 0) return null
  return (
    <>
      {found.map((ex) => (
        <ExhibitView key={ex.id} exhibit={ex} />
      ))}
    </>
  )
}

export function MessageList({
  caseData,
  messages,
}: {
  caseData: Case
  messages: ChatMessage[]
}) {
  return (
    <div className="messages">
      {messages.map((m) =>
        m.kind === 'bot' ? (
          <div className="msg msg-bot" key={m.id}>
            <div className="bubble bubble-bot">
              {m.preamble ? <p className="prompt-block">{m.preamble}</p> : null}
              {m.label ? <p className="q-label">{m.label}</p> : null}
              <p className="prompt-block last">{m.text}</p>
              <Exhibits caseData={caseData} ids={m.exhibitIds} />
            </div>
          </div>
        ) : (
          <div className="msg msg-user" key={m.id}>
            <div className="bubble bubble-user">
              <p className="prompt-block last">{m.text}</p>
            </div>
            <span className="stamp">{formatStamp(m.at)}</span>
          </div>
        ),
      )}
    </div>
  )
}
