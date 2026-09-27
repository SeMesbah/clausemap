import { useState } from 'react'
import styles from './ChatBox.module.css'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: number[]
}

interface Props {
  onAnswer: (highlightedNodeIds: string[]) => void
}

export default function ChatBox({ onAnswer }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const send = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: q }])
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer, sources: data.sources },
      ])
      onAnswer(data.highlighted_nodes ?? [])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.chatbox}>
      <h3 className={styles.title}>Ask your Memory Palace</h3>
      <div className={styles.messages}>
        {messages.map((m, i) => (
          <div key={i} className={`${styles.message} ${styles[m.role]}`}>
            <p>{m.content}</p>
            {m.sources && m.sources.length > 0 && (
              <div className={styles.sources}>
                Sources: {m.sources.map((p) => `p.${p}`).join(', ')}
              </div>
            )}
          </div>
        ))}
        {loading && <div className={`${styles.message} ${styles.assistant}`}>Thinking…</div>}
      </div>
      <div className={styles.inputRow}>
        <input
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="How are these concepts related?"
        />
        <button className={styles.sendBtn} onClick={send} disabled={loading}>
          →
        </button>
      </div>
    </div>
  )
}
