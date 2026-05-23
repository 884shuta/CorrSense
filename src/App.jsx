import { useMemo, useRef, useState } from 'react'
import './App.css'

const CHART_WIDTH = 760
const CHART_HEIGHT = 520
const CHART_PADDING = 40
const MIN_POINTS = 1
const MAX_POINTS = 100
const INITIAL_POINT_COUNT = 30
const INITIAL_PRESET = 'strongPositive'

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const toChartSpace = (point) => ({
  x: CHART_PADDING + (point.x / 100) * (CHART_WIDTH - CHART_PADDING * 2),
  y:
    CHART_HEIGHT -
    CHART_PADDING -
    (point.y / 100) * (CHART_HEIGHT - CHART_PADDING * 2),
})

const fromChartSpace = (x, y) => ({
  x: clamp(((x - CHART_PADDING) / (CHART_WIDTH - CHART_PADDING * 2)) * 100, 0, 100),
  y: clamp(
    ((CHART_HEIGHT - CHART_PADDING - y) / (CHART_HEIGHT - CHART_PADDING * 2)) * 100,
    0,
    100,
  ),
})

const randomPoint = () => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
})

const gaussianNoise = (scale) => {
  const u = 1 - Math.random()
  const v = 1 - Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * scale
}

const generateLinearPoints = (count, slope, noise) =>
  Array.from({ length: count }, () => {
    const x = Math.random() * 100
    const y = clamp(50 + slope * (x - 50) + gaussianNoise(noise), 0, 100)
    return { x, y }
  })

const generatePresetPoints = (name, count) => {
  switch (name) {
    case 'strongPositive':
      return generateLinearPoints(count, 0.95, 5)
    case 'weakPositive':
      return generateLinearPoints(count, 0.6, 14)
    case 'noCorrelation':
      return Array.from({ length: count }, randomPoint)
    case 'weakNegative':
      return generateLinearPoints(count, -0.6, 14)
    case 'strongNegative':
      return generateLinearPoints(count, -0.95, 5)
    case 'outlier': {
      const points = generateLinearPoints(Math.max(count - 1, 4), 0.85, 5)
      points.push({ x: 95, y: 5 })
      return points.slice(0, count)
    }
    case 'curvedLowR':
      return Array.from({ length: count }, () => {
        const x = Math.random() * 100
        const centered = x - 50
        const y = clamp(10 + (centered * centered) / 28 + gaussianNoise(6), 0, 100)
        return { x, y }
      })
    default:
      return Array.from({ length: count }, randomPoint)
  }
}

const calculateCorrelation = (points) => {
  if (points.length < 2) {
    return 0
  }

  const xMean = points.reduce((sum, point) => sum + point.x, 0) / points.length
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / points.length

  let numerator = 0
  let xSquareSum = 0
  let ySquareSum = 0

  for (const point of points) {
    const xDiff = point.x - xMean
    const yDiff = point.y - yMean
    numerator += xDiff * yDiff
    xSquareSum += xDiff ** 2
    ySquareSum += yDiff ** 2
  }

  if (xSquareSum === 0 || ySquareSum === 0) {
    return 0
  }

  return numerator / Math.sqrt(xSquareSum * ySquareSum)
}

const getCorrelationLabel = (r) => {
  if (r >= 0.85) return '強い正の相関'
  if (r >= 0.55) return 'やや強い正の相関'
  if (r >= 0.25) return '弱い正の相関'
  if (r > -0.25) return 'ほぼ無相関'
  if (r > -0.55) return '弱い負の相関'
  if (r > -0.85) return 'やや強い負の相関'
  return '強い負の相関'
}

function App() {
  const [pointCount, setPointCount] = useState(INITIAL_POINT_COUNT)
  const [preset, setPreset] = useState(INITIAL_PRESET)
  const [points, setPoints] = useState(() =>
    generatePresetPoints(INITIAL_PRESET, INITIAL_POINT_COUNT).map((point, index) => ({
      ...point,
      id: index + 1,
    })),
  )
  const [addMode, setAddMode] = useState(false)
  const [selectedPointId, setSelectedPointId] = useState(null)
  const [dragPointId, setDragPointId] = useState(null)
  const [quizMode, setQuizMode] = useState(false)
  const [quizGuess, setQuizGuess] = useState(0)
  const [quizAnswered, setQuizAnswered] = useState(false)

  const nextIdRef = useRef(INITIAL_POINT_COUNT + 1)
  const svgRef = useRef(null)

  const correlation = useMemo(() => calculateCorrelation(points), [points])
  const selectedPoint = points.find((point) => point.id === selectedPointId)

  const withIds = (rawPoints) =>
    rawPoints.map((point) => ({ ...point, id: nextIdRef.current++ }))

  const applyPreset = (name, count = pointCount) => {
    setPreset(name)
    const generated = withIds(generatePresetPoints(name, count))
    setPoints(generated)
    setSelectedPointId(null)
    setQuizAnswered(false)
  }

  const resizePointSet = (count) => {
    setPoints((prev) => {
      if (prev.length === count) {
        return prev
      }
      if (prev.length > count) {
        return prev.slice(0, count)
      }
      const extra = withIds(Array.from({ length: count - prev.length }, randomPoint))
      return [...prev, ...extra]
    })
  }

  const updatePointCount = (value) => {
    const count = Number(value)
    setPointCount(count)
    resizePointSet(count)
    setSelectedPointId(null)
  }

  const getPointerPoint = (event) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return null
    const scaleX = CHART_WIDTH / rect.width
    const scaleY = CHART_HEIGHT / rect.height
    const x = (event.clientX - rect.left) * scaleX
    const y = (event.clientY - rect.top) * scaleY
    return fromChartSpace(x, y)
  }

  const handleBoardClick = (event) => {
    if (!addMode) {
      setSelectedPointId(null)
      return
    }

    const newPoint = getPointerPoint(event)
    if (!newPoint) return

    if (points.length >= MAX_POINTS) {
      return
    }

    const next = { ...newPoint, id: nextIdRef.current++ }
    setPoints((prev) => [...prev, next])
    setPointCount((prev) => clamp(prev + 1, MIN_POINTS, MAX_POINTS))
  }

  const deleteSelectedPoint = () => {
    if (!selectedPointId) return

    setPoints((prev) => prev.filter((point) => point.id !== selectedPointId))
    setPointCount((prev) => clamp(prev - 1, MIN_POINTS, MAX_POINTS))
    setSelectedPointId(null)
  }

  const startQuiz = () => {
    const presets = [
      'strongPositive',
      'weakPositive',
      'noCorrelation',
      'weakNegative',
      'strongNegative',
      'outlier',
      'curvedLowR',
    ]
    const randomPreset = presets[Math.floor(Math.random() * presets.length)]
    applyPreset(randomPreset, pointCount)
    setQuizMode(true)
    setQuizGuess(0)
    setQuizAnswered(false)
  }

  const relationHint = getCorrelationLabel(correlation)

  return (
    <main className="app-shell">
      <header className="title-area">
        <h1>CorrSense</h1>
        <p>点の配置を動かしながら、相関係数 r の感覚を直感的に掴む学習アプリ</p>
      </header>

      <section className="workspace">
        <div className="chart-area">
          <svg
            ref={svgRef}
            className={`scatter-board ${addMode ? 'add-mode' : ''}`}
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-label="散布図"
            onClick={handleBoardClick}
            onPointerMove={(event) => {
              if (!dragPointId) return
              const movedPoint = getPointerPoint(event)
              if (!movedPoint) return
              setPoints((prev) =>
                prev.map((point) =>
                  point.id === dragPointId ? { ...point, ...movedPoint } : point,
                ),
              )
            }}
            onPointerUp={() => setDragPointId(null)}
            onPointerLeave={() => setDragPointId(null)}
          >
            <rect
              x={CHART_PADDING}
              y={CHART_PADDING}
              width={CHART_WIDTH - CHART_PADDING * 2}
              height={CHART_HEIGHT - CHART_PADDING * 2}
              className="board-bg"
            />
            <line
              x1={CHART_PADDING}
              y1={CHART_HEIGHT / 2}
              x2={CHART_WIDTH - CHART_PADDING}
              y2={CHART_HEIGHT / 2}
              className="axis"
            />
            <line
              x1={CHART_WIDTH / 2}
              y1={CHART_PADDING}
              x2={CHART_WIDTH / 2}
              y2={CHART_HEIGHT - CHART_PADDING}
              className="axis"
            />

            {points.map((point) => {
              const plot = toChartSpace(point)
              const isSelected = selectedPointId === point.id
              return (
                <circle
                  key={point.id}
                  cx={plot.x}
                  cy={plot.y}
                  r={isSelected ? 8 : 6}
                  className={`point ${isSelected ? 'selected' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSelectedPointId(point.id)
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    setDragPointId(point.id)
                    setSelectedPointId(point.id)
                  }}
                />
              )
            })}

            <text x={CHART_WIDTH - 16} y={CHART_HEIGHT / 2 - 8} className="axis-label">
              x
            </text>
            <text x={CHART_WIDTH / 2 + 8} y={16} className="axis-label">
              y
            </text>
          </svg>
        </div>

        <aside className="panel-area">
          {!quizMode || quizAnswered ? (
            <section className="score-card">
              <p className="score-label">相関係数 (Pearson r)</p>
              <p className="score-value">{correlation.toFixed(3)}</p>
              <p className="score-meaning">{relationHint}</p>
              <div className="gauge">
                <span className="gauge-midline" />
                <div className="gauge-fill" style={{ width: `${((correlation + 1) / 2) * 100}%` }} />
              </div>
              <p className="gauge-scale">-1（負） / 0（弱い） / +1（正）</p>
            </section>
          ) : (
            <section className="score-card quiz-blind">
              <p className="score-label">クイズモード</p>
              <p className="score-value">?</p>
              <p className="score-meaning">散布図を見て r を予想してください</p>
            </section>
          )}

          <section className="control-card">
            <h2>操作</h2>
            <label className="slider-row">
              点の数: <strong>{points.length}</strong>
              <input
                type="range"
                min={MIN_POINTS}
                max={MAX_POINTS}
                value={pointCount}
                onChange={(event) => updatePointCount(event.target.value)}
              />
            </label>

            <div className="button-grid">
              <button type="button" onClick={() => applyPreset(preset)}>
                ランダム再生成
              </button>
              <button type="button" onClick={() => setAddMode((prev) => !prev)}>
                {addMode ? '追加モード終了' : '手動追加モード'}
              </button>
              <button type="button" onClick={deleteSelectedPoint} disabled={!selectedPoint}>
                選択点を削除
              </button>
            </div>

            <h3>プリセット</h3>
            <div className="preset-grid">
              <button type="button" onClick={() => applyPreset('strongPositive')}>
                強い正
              </button>
              <button type="button" onClick={() => applyPreset('weakPositive')}>
                弱い正
              </button>
              <button type="button" onClick={() => applyPreset('noCorrelation')}>
                無相関
              </button>
              <button type="button" onClick={() => applyPreset('weakNegative')}>
                弱い負
              </button>
              <button type="button" onClick={() => applyPreset('strongNegative')}>
                強い負
              </button>
              <button type="button" onClick={() => applyPreset('outlier')}>
                外れ値あり
              </button>
              <button type="button" onClick={() => applyPreset('curvedLowR')}>
                曲線（低 r）
              </button>
            </div>
          </section>

          <section className="control-card">
            <h2>相関係数クイズ</h2>
            <p>散布図だけを見て r を予想し、実際の値との差を確認できます。</p>
            <label className="slider-row">
              予想値: <strong>{quizGuess.toFixed(2)}</strong>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={quizGuess}
                onChange={(event) => setQuizGuess(Number(event.target.value))}
              />
            </label>
            <div className="button-grid">
              <button type="button" onClick={startQuiz}>
                新しい問題を出す
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuizMode(true)
                  setQuizAnswered(true)
                }}
              >
                回答する
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuizMode(false)
                  setQuizAnswered(false)
                }}
              >
                通常モードへ戻る
              </button>
            </div>

            {quizMode && quizAnswered ? (
              <p className="quiz-result">
                実際の r: <strong>{correlation.toFixed(3)}</strong> / 差: <strong>{Math.abs(correlation - quizGuess).toFixed(3)}</strong>
              </p>
            ) : null}
          </section>

          <section className="control-card learn-card">
            <h2>学習ポイント</h2>
            <ul>
              <li>相関係数は「直線的な関係の強さ」を表します。</li>
              <li>r が高くても、因果関係があるとは限りません。</li>
              <li>外れ値が 1 点あるだけで r は大きく変化します。</li>
              <li>曲線的な関係では、見た目に関係があっても r は低くなり得ます。</li>
            </ul>
          </section>
        </aside>
      </section>
    </main>
  )
}

export default App
