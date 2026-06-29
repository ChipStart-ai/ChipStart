"use client"

import { useState } from "react"
import axios from "axios"

export default function Home() {
  const [prompt, setPrompt] = useState("")
  const [verilog, setVerilog] = useState("")
  const [waveform, setWaveform] = useState("")
  const [parsedWaveform, setParsedWaveform] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [image, setImage] = useState<File | null>(null)

  const signalColors = [
    "#00FF00", // green
    "#00FFFF", // cyan
    "#FFD700", // yellow
    "#FF69B4", // pink
    "#FF4500", // orange
    "#9370DB", // purple
  ]

  // ─────────────────────────────────────────────────────────────
  // FIX 1 — Correct VCD parser
  // Old bug: signals were only updated AFTER a timestamp line,
  // so multiple value changes between two timestamps were lost.
  // Fix: update signals immediately when we see a value change,
  // then snapshot ALL signals when we hit a timestamp.
  // ─────────────────────────────────────────────────────────────
  function parseVCD(vcd: string) {
    const rows: any[] = []
    const lines = vcd.split("\n")
    const signals: Record<string, number> = {}   // signalName → current value
    const signalMap: Record<string, string> = {} // VCD symbol → signalName
    let pendingTime: number | null = null

    for (const line of lines) {
      const trimmed = line.trim()

      // 1. Register all declared signals
      if (trimmed.startsWith("$var")) {
        const parts = trimmed.split(/\s+/)
        // $var <type> <width> <symbol> <name> $end
        const symbol = parts[3]
        const signalName = parts[4]
        signalMap[symbol] = signalName
        if (!(signalName in signals)) {
          signals[signalName] = 0
        }
        continue
      }

      // 2. Snapshot the current state when we hit a new timestamp
      if (trimmed.startsWith("#")) {
        const newTime = parseInt(trimmed.substring(1))
        // Save previous timestamp row before moving to the new time
        if (pendingTime !== null) {
          rows.push({ time: pendingTime, ...signals })
        }
        pendingTime = newTime
        continue
      }

      // 3. Scalar value change:  0! or 1! (single-bit)
      if (trimmed.length >= 2 && (trimmed[0] === "0" || trimmed[0] === "1")) {
        const value = Number(trimmed[0])
        const symbol = trimmed.substring(1).trim()
        const signalName = signalMap[symbol]
        if (signalName !== undefined) {
          signals[signalName] = value
        }
        continue
      }

      // 4. Vector value change:  b0101 ! (multi-bit — store as numeric)
      if (trimmed.startsWith("b") || trimmed.startsWith("B")) {
        const parts = trimmed.split(/\s+/)
        const binStr = parts[0].substring(1)
        const symbol = parts[1]
        const signalName = signalMap[symbol]
        if (signalName !== undefined) {
          signals[signalName] = parseInt(binStr, 2)
        }
        continue
      }
    }

    // Push the very last pending timestamp
    if (pendingTime !== null) {
      rows.push({ time: pendingTime, ...signals })
    }

    return rows
  }

  // ─── API calls ────────────────────────────────────────────────

  const generate = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await axios.post("http://localhost:5001/generate", { prompt })
      setVerilog(res.data.verilog)
      const waveformText = res.data.waveform || ""
      setWaveform(waveformText)
      setParsedWaveform(parseVCD(waveformText))
      if (res.data.error) setError(res.data.error)
    } catch (e) {
      setError("Server error")
    }
    setLoading(false)
  }

  const generateFromImage = async () => {
    if (!image) { setError("Please select an image"); return }
    setLoading(true)
    setError("")
    const formData = new FormData()
    formData.append("image", image)
    try {
      const res = await axios.post("http://localhost:5001/image-to-verilog", formData)
      setVerilog(res.data.verilog)
      const waveformText = res.data.waveform || ""
      setWaveform(waveformText)
      setParsedWaveform(parseVCD(waveformText))
      if (res.data.error) setError(res.data.error)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Image upload failed")
    }
    setLoading(false)
  }

  // ─── Download helpers ─────────────────────────────────────────

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Waveform SVG constants ───────────────────────────────────
  const LABEL_WIDTH  = 80   // px reserved for signal name + HIGH/LOW labels
  const ROW_HEIGHT   = 80   // px per signal row
  const COL_WIDTH    = 120  // px per time step
  const WAVE_TOP     = 15   // y offset for HIGH line within a row
  const WAVE_BOT     = 55   // y offset for LOW  line within a row
  const GRID_COLOR   = "#374151" // gray-700
  const TICK_COLOR   = "#6B7280" // gray-500

  const signals      = parsedWaveform.length > 0
    ? Object.keys(parsedWaveform[0]).filter((k) => k !== "time")
    : []
  const svgWidth     = Math.max(900, LABEL_WIDTH + signals.length > 0
    ? LABEL_WIDTH + (parsedWaveform.length) * COL_WIDTH
    : 900)
  const svgHeight    = Math.max(200, signals.length * ROW_HEIGHT + 40)

  // ─── JSX ─────────────────────────────────────────────────────

  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-medium mb-1">ChipStart</h1>
      <p className="text-gray-500 mb-8">Describe a circuit. Get working Verilog.</p>

      {/* Text prompt */}
      <textarea
        className="w-full border rounded-lg p-4 h-28 text-sm"
        placeholder="e.g. a 4-bit synchronous counter with active-high reset"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      {/* Image upload */}
      <div className="mt-4">
        <input
          id="image-upload"
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files?.[0]) setImage(e.target.files[0]) }}
        />
        <label
          htmlFor="image-upload"
          className="inline-block cursor-pointer px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800"
        >
          Choose Image
        </label>
        {image && <span className="ml-3 text-sm text-green-500">{image.name}</span>}
      </div>

      {/* Buttons */}
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={generate} disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
          {loading ? "Generating..." : "Generate Verilog"}
        </button>

        <button onClick={generateFromImage} disabled={loading}
          className="px-6 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50">
          {loading ? "Generating..." : "Generate From Image"}
        </button>

        {verilog && (
          <button onClick={() => downloadFile(verilog, "generated.v", "text/plain")}
            className="px-6 py-2 bg-green-700 text-white rounded-lg">
            Download Verilog
          </button>
        )}

        {waveform && (
          <button onClick={() => downloadFile(waveform, "waveform.vcd", "text/plain")}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg">
            Download VCD
          </button>
        )}
      </div>

      {/* Error */}
      {error && <div className="mt-4 text-red-500 text-sm">{error}</div>}

      {/* Verilog code block */}
      {verilog && (
        <pre className="mt-6 bg-black text-green-400 p-4 rounded-lg text-xs overflow-auto border border-gray-700 leading-relaxed">
          {verilog}
        </pre>
      )}

      {/* Raw VCD (collapsible feel via max-h) */}
      {waveform && (
        <div className="mt-6 p-4 bg-black text-white rounded-lg border border-gray-700">
          <p className="text-sm font-medium mb-2 text-gray-400">Raw VCD Output</p>
          <pre className="text-xs overflow-auto max-h-48 whitespace-pre-wrap text-gray-300">
            {waveform}
          </pre>
        </div>
      )}

      {/* ── Parsed waveform section ── */}
      {parsedWaveform.length > 0 && (
        <div className="mt-6 border border-gray-700 rounded-lg overflow-hidden">

          {/* Table */}
          <div className="p-4 bg-gray-950">
            <h2 className="font-bold text-white mb-3">Signal Table</h2>
            <div className="overflow-x-auto">
              <table className="border-collapse text-white text-sm">
                <thead>
                  <tr>
                    <th className="border border-gray-700 px-3 py-2 bg-gray-900 text-left">Time (ns)</th>
                    {signals.map((sig) => (
                      <th key={sig} className="border border-gray-700 px-3 py-2 bg-gray-900 text-left">
                        {sig}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedWaveform.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-gray-950" : "bg-gray-900"}>
                      <td className="border border-gray-700 px-3 py-1">{row.time} ns</td>
                      {signals.map((sig) => (
                        <td key={sig} className="border border-gray-700 px-3 py-1 font-mono">
                          {row[sig]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── SVG Waveform viewer ── */}
          <div className="p-4 bg-black border-t border-gray-700">
            <h2 className="font-bold text-white mb-3">Waveform Viewer</h2>
            <div className="overflow-x-auto">
              <svg
                width={svgWidth}
                height={svgHeight + 30}
                className="bg-black"
                style={{ display: "block" }}
              >
                {/* ── FIX 2: Timing grid — vertical lines + time labels ── */}
                {parsedWaveform.map((row, i) => {
                  const x = LABEL_WIDTH + i * COL_WIDTH
                  return (
                    <g key={`grid-${i}`}>
                      {/* Vertical grid line */}
                      <line
                        x1={x} y1={20}
                        x2={x} y2={svgHeight + 20}
                        stroke={GRID_COLOR}
                        strokeWidth="1"
                        strokeDasharray="4 3"
                      />
                      {/* Time label at top */}
                      <text
                        x={x + 3} y={14}
                        fill={TICK_COLOR}
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        {row.time}ns
                      </text>
                    </g>
                  )
                })}

                {/* Closing grid line at the end */}
                {parsedWaveform.length > 0 && (
                  <line
                    x1={LABEL_WIDTH + parsedWaveform.length * COL_WIDTH} y1={20}
                    x2={LABEL_WIDTH + parsedWaveform.length * COL_WIDTH} y2={svgHeight + 20}
                    stroke={GRID_COLOR}
                    strokeWidth="1"
                    strokeDasharray="4 3"
                  />
                )}

                {/* ── Per-signal rows ── */}
                {signals.map((signal, signalIndex) => {
                  const color  = signalColors[signalIndex % signalColors.length]
                  const rowY   = 20 + signalIndex * ROW_HEIGHT
                  const highY  = rowY + WAVE_TOP
                  const lowY   = rowY + WAVE_BOT

                  return (
                    <g key={signal}>
                      {/* Horizontal separator between signal rows */}
                      <line
                        x1={0} y1={rowY + ROW_HEIGHT}
                        x2={svgWidth} y2={rowY + ROW_HEIGHT}
                        stroke={GRID_COLOR}
                        strokeWidth="0.5"
                      />

                      {/* Signal name */}
                      <text
                        x={4} y={rowY + 30}
                        fill="white"
                        fontSize="11"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {signal}
                      </text>

                      {/* ── FIX 3: HIGH / LOW labels ── */}
                      <text
                        x={4} y={highY + 4}
                        fill={color}
                        fontSize="8"
                        fontFamily="monospace"
                        opacity="0.7"
                      >
                        HIGH
                      </text>
                      <text
                        x={4} y={lowY + 4}
                        fill={color}
                        fontSize="8"
                        fontFamily="monospace"
                        opacity="0.7"
                      >
                        LOW
                      </text>

                      {/* Waveform segments */}
                      {parsedWaveform.map((row, i) => {
                        const nextRow  = parsedWaveform[i + 1]
                        const x1       = LABEL_WIDTH + i * COL_WIDTH
                        const x2       = LABEL_WIDTH + (i + 1) * COL_WIDTH
                        const curVal   = row[signal] ?? 0
                        const curY     = curVal ? highY : lowY
                        const nextVal  = nextRow ? (nextRow[signal] ?? 0) : curVal
                        const nextY    = nextVal ? highY : lowY

                        return (
                          <g key={`${signal}-${i}`}>
                            {/* Horizontal line for this time slot */}
                            <line
                              x1={x1} y1={curY}
                              x2={x2} y2={curY}
                              stroke={color}
                              strokeWidth="2.5"
                              strokeLinecap="square"
                            />
                            {/* Vertical transition at end of slot */}
                            {nextRow && curY !== nextY && (
                              <line
                                x1={x2} y1={curY}
                                x2={x2} y2={nextY}
                                stroke={color}
                                strokeWidth="2.5"
                              />
                            )}
                          </g>
                        )
                      })}
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
