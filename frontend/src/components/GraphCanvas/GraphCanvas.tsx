// GraphCanvas — force-directed knowledge graph
// Requires: npm install react-force-graph
// TODO: wire up react-force-graph with node colour by type, click handler, highlight support

import styles from './GraphCanvas.module.css'

interface _GraphNode { id: string; label: string; type: string; mentions: number; evidence: { text: string; page: number }[]; connections: string[] }
interface _GraphData { nodes: _GraphNode[]; edges: { source: string; target: string; relation: string }[]; stats: { entities: number; concepts: number; relationships: number } }

interface Props {
  data: _GraphData
  highlightedNodes: string[]
  onNodeClick: (node: _GraphNode) => void
  animateOnMount: boolean
}

const TYPE_COLORS: Record<string, string> = {
  person: '#f472b6',
  organization: '#60a5fa',
  concept: '#a78bfa',
  technology: '#34d399',
}

export default function GraphCanvas({ data, highlightedNodes, onNodeClick: _onNodeClick }: Props) {
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
          {data.nodes.map((n: _GraphNode) => (
            <button
              key={n.id}
              className={`${styles.nodeBtn} ${highlightedNodes.includes(n.id) ? styles.highlighted : ''}`}
              style={{ borderColor: TYPE_COLORS[n.type] ?? '#888' }}
              onClick={() => _onNodeClick(n)}
            >
              {n.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
