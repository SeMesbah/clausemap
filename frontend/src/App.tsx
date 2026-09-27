import { useState } from 'react'
import UploadScreen from './components/UploadScreen/UploadScreen'
import GraphCanvas from './components/GraphCanvas/GraphCanvas'
import NodePanel from './components/NodePanel/NodePanel'
import ChatBox from './components/ChatBox/ChatBox'
import MapPage from './pages/MapPage'
import './App.css'

// Route to MapPage when ?source=fixture (or ?source=<anything>) is in the URL.
// A full router is added in Phase B2/B3.
const _params = new URLSearchParams(window.location.search)
const IS_MAP_ROUTE = _params.has('source') || window.location.pathname.startsWith('/map')

export type AppStage = 'upload' | 'processing' | 'explore'

export interface GraphNode {
  id: string
  label: string
  type: 'person' | 'organization' | 'concept' | 'technology'
  mentions: number
  evidence: { text: string; page: number }[]
  connections: string[]
}

export interface GraphEdge {
  source: string
  target: string
  relation: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: { entities: number; concepts: number; relationships: number }
}

function App() {
  if (IS_MAP_ROUTE) return <MapPage />

  const [stage, setStage] = useState<AppStage>('upload')
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([])

  return (
    <div className="app">
      {stage === 'upload' && (
        <UploadScreen
          onProcessingComplete={(data) => {
            setGraphData(data)
            setStage('explore')
          }}
          onProcessingStart={() => setStage('processing')}
        />
      )}
      {(stage === 'processing' || stage === 'explore') && graphData && (
        <div className="explore-layout">
          <div className="graph-area">
            <GraphCanvas
              data={graphData}
              highlightedNodes={highlightedNodes}
              onNodeClick={(node) => setSelectedNode(node)}
              animateOnMount={stage === 'explore'}
            />
          </div>
          <div className="side-panel">
            {selectedNode && (
              <NodePanel
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                onNodeClick={(id) => {
                  const n = graphData.nodes.find((x) => x.id === id) ?? null
                  setSelectedNode(n)
                }}
              />
            )}
            <ChatBox
              onAnswer={(nodeIds) => setHighlightedNodes(nodeIds)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
