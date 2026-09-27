import type { GraphNode } from '../../App'
import styles from './NodePanel.module.css'

interface Props {
  node: GraphNode
  onClose: () => void
  onNodeClick: (id: string) => void
}

const TYPE_EMOJI: Record<string, string> = {
  person: '👤',
  organization: '🏢',
  concept: '💡',
  technology: '🛠️',
}

export default function NodePanel({ node, onClose, onNodeClick }: Props) {
  return (
    <div className={styles.panel}>
      <button className={styles.close} onClick={onClose}>✕</button>
      <div className={styles.header}>
        <span className={styles.emoji}>{TYPE_EMOJI[node.type] ?? '●'}</span>
        <div>
          <h2 className={styles.label}>{node.label}</h2>
          <span className={styles.type}>{node.type}</span>
        </div>
      </div>

      <div className={styles.meta}>
        Mentioned <strong>{node.mentions}</strong> time{node.mentions !== 1 ? 's' : ''}
      </div>

      {node.connections.length > 0 && (
        <section>
          <h3 className={styles.sectionTitle}>Connected to</h3>
          <div className={styles.connections}>
            {node.connections.map((id) => (
              <button key={id} className={styles.connBtn} onClick={() => onNodeClick(id)}>
                {id}
              </button>
            ))}
          </div>
        </section>
      )}

      {node.evidence.length > 0 && (
        <section>
          <h3 className={styles.sectionTitle}>Document Evidence</h3>
          <div className={styles.evidenceList}>
            {node.evidence.map((e, i) => (
              <blockquote key={i} className={styles.evidence}>
                <p>"{e.text}"</p>
                <cite>Page {e.page}</cite>
              </blockquote>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
