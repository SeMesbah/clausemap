// GraphCanvas — force-directed knowledge graph
// Requires: npm install react-force-graph
// TODO: wire up react-force-graph with node colour by type, click handler, highlight support

import type { GraphData, GraphNode } from '../../App'
import styles from './GraphCanvas.module.css'

interface Props {
  data: GraphData
  highlightedNodes: string[]
  onNodeClick: (node: GraphNode) => void
  animateOnMount: boolean
}

const TYPE_COLORS: Record<string, string> = {
  person: '#f472b6',
  organization: '#60a5fa',
  concept: '#a78bfa',
  technology: '#34d399',
}

export default function GraphCanvas({ data, highlightedNodes, onNodeClick }: Props) {
  // Placeholder — replace with ForceGraph2D from react-force-graph
  return (
    <div className={styles.canvas}>
      <div className={styles.placeholder}>
        <p style={{ color: '#8888aa' }}>
          Graph canvas — install <code>react-force-graph</code> and replace this stub
        </p>
        <p style={{ color: '#55556a', fontSize: '0.85rem' }}>
          {data.stats.entities} entities · {data.stats.relationships} relationships
        </p>
        <div className={styles.legend}>
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <span key={type} className={styles.legendItem}>
              <span className={styles.dot} style={{ background: color }} />
              {type}
            </span>
          ))}
        </div>
        {/* Sample node list for development */}
        <div className={styles.nodeList}>
          {data.nodes.map((n) => (
            <button
              key={n.id}
              className={`${styles.nodeBtn} ${highlightedNodes.includes(n.id) ? styles.highlighted : ''}`}
              style={{ borderColor: TYPE_COLORS[n.type] ?? '#888' }}
              onClick={() => onNodeClick(n)}
            >
              {n.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
