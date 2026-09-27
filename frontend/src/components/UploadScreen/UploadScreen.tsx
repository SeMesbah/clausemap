import type { GraphData } from '../../App'
import styles from './UploadScreen.module.css'

interface Props {
  onProcessingStart: () => void
  onProcessingComplete: (data: GraphData) => void
}

const STAGES = [
  'Reading document...',
  'Splitting into chunks...',
  'Extracting entities & relationships...',
  'Building knowledge graph...',
  'Generating embeddings...',
]

export default function UploadScreen({ onProcessingStart, onProcessingComplete }: Props) {
  const handleFile = async (file: File) => {
    onProcessingStart()
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('http://localhost:8000/api/upload', { method: 'POST', body: form })
    const data = await res.json()
    onProcessingComplete(data)
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>🧩 DocVerse</h1>
      <p className={styles.subtitle}>Turn your documents into worlds.</p>
      <label className={styles.uploadBox}>
        <input
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
        <span className={styles.uploadIcon}>📄</span>
        <span>Upload a PDF to begin</span>
        <span className={styles.hint}>5–30 pages recommended</span>
      </label>
    </div>
  )
}
