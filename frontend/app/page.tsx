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

  function parseVCD(vcd: string) {
    const rows: any[] = []

    const lines = vcd.split("\n")

    let time = 0

    let signals = {
      a: 0,
      b: 0,
      y: 0,
    }

    for (const line of lines) {
      if (line.startsWith("#")) {
        time = parseInt(line.substring(1))

        rows.push({
          time,
          a: signals.a,
          b: signals.b,
          y: signals.y,
        })
      }

      if (line === '0"') signals.a = 0
      if (line === '1"') signals.a = 1

      if (line === "0#") signals.b = 0
      if (line === "1#") signals.b = 1

      if (line === "0!") signals.y = 0
      if (line === "1!") signals.y = 1
    }

    return rows
  }

  const generate = async () => {
    setLoading(true)
    setError("")

    try {
      const res = await axios.post(
        "http://localhost:5001/generate",
        { prompt }
      )

      setVerilog(res.data.verilog)

      const waveformText = res.data.waveform || ""

      setWaveform(waveformText)

      const parsed = parseVCD(waveformText)

      setParsedWaveform(parsed)

      if (res.data.error) {
        setError(res.data.error)
      }
    } catch (e) {
      setError("Server error")
    }

    setLoading(false)
  }

  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-medium mb-2">
        ChipStart
      </h1>

      <p className="text-gray-500 mb-8">
        Describe a circuit. Get working Verilog.
      </p>

      <textarea
        className="w-full border rounded-lg p-4 h-28 text-sm"
        placeholder="e.g. a 4-bit synchronous counter with active-high reset"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <button
        onClick={generate}
        disabled={loading}
        className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg"
      >
        {loading ? "Generating..." : "Generate Verilog"}
      </button>

      {error && (
        <div className="mt-4 text-red-500 text-sm">
          {error}
        </div>
      )}

      {verilog && (
        <pre className="mt-6 bg-gray-50 p-4 rounded-lg text-xs overflow-auto">
          {verilog}
        </pre>
      )}

      {waveform && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium mb-2">
            Simulation waveform
          </p>

          <pre className="text-xs overflow-auto max-h-96 whitespace-pre-wrap">
            {waveform}
          </pre>
        </div>
      )}

      {parsedWaveform.length > 0 && (
        <div className="mt-6 p-4 bg-white border rounded-lg">
          <h2 className="font-bold mb-3">
            Parsed Waveform
          </h2>

          <table className="border-collapse border mb-8">
            <thead>
              <tr>
                <th className="border p-2">Time</th>
                <th className="border p-2">A</th>
                <th className="border p-2">B</th>
                <th className="border p-2">Y</th>
              </tr>
            </thead>

            <tbody>
              {parsedWaveform.map((row, i) => (
                <tr key={i}>
                  <td className="border p-2">{row.time}</td>
                  <td className="border p-2">{row.a}</td>
                  <td className="border p-2">{row.b}</td>
                  <td className="border p-2">{row.y}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="font-bold mb-3">
            Waveform Preview
          </h2>

          <svg width="700" height="220" className="border">

            <text x="10" y="40">A</text>

            {parsedWaveform.map((row, i) => (
              <line
                key={`a-${i}`}
                x1={60 + i * 120}
                y1={row.a ? 20 : 60}
                x2={180 + i * 120}
                y2={row.a ? 20 : 60}
                stroke="blue"
                strokeWidth="3"
              />
            ))}

            <text x="10" y="110">B</text>

            {parsedWaveform.map((row, i) => (
              <line
                key={`b-${i}`}
                x1={60 + i * 120}
                y1={row.b ? 90 : 130}
                x2={180 + i * 120}
                y2={row.b ? 90 : 130}
                stroke="green"
                strokeWidth="3"
              />
            ))}

            <text x="10" y="180">Y</text>

            {parsedWaveform.map((row, i) => (
              <line
                key={`y-${i}`}
                x1={60 + i * 120}
                y1={row.y ? 160 : 200}
                x2={180 + i * 120}
                y2={row.y ? 160 : 200}
                stroke="red"
                strokeWidth="3"
              />
            ))}
          </svg>
        </div>
      )}
    </main>
  )
}