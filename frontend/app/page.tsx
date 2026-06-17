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

  const signals: any = {}

  const signalMap: any = {}

  for (const line of lines) {

    if (line.startsWith("$var")) {
      const parts = line.split(" ")

      const symbol = parts[3]
      const signalName = parts[4]

      signalMap[symbol] = signalName

      if (!(signalName in signals)) {
        signals[signalName] = 0
      }
    }

    if (
      line.length >= 2 &&
      (line[0] === "0" || line[0] === "1")
    ) {
      const value = Number(line[0])
      const symbol = line.substring(1)

      const signalName = signalMap[symbol]

      if (signalName) {
        signals[signalName] = value
      }
    }

    if (line.startsWith("#")) {
      time = parseInt(line.substring(1))

      rows.push({
        time,
        ...signals
      })
    }
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
      console.log(parsed)

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

      {verilog && (
  <button
    onClick={() => {
      const blob = new Blob([verilog], {
        type: "text/plain"
      })

      const url = URL.createObjectURL(blob)

      const a = document.createElement("a")

      a.href = url
      a.download = "generated.v"

      a.click()

      URL.revokeObjectURL(url)
    }}
    className="ml-4 px-6 py-2 bg-green-600 text-white rounded-lg"
  >
    Download Verilog
  </button>
)}

     {waveform && (
  <button
    onClick={() => {
      const blob = new Blob([waveform], {
        type: "text/plain"
      })

      const url = URL.createObjectURL(blob)

      const a = document.createElement("a")

      a.href = url
      a.download = "waveform.vcd"

      a.click()

      URL.revokeObjectURL(url)
    }}
    className="ml-4 px-6 py-2 bg-purple-600 text-white rounded-lg"
  >
    Download VCD
  </button>
)}
      

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

    {Object.keys(parsedWaveform[0] || {})
      .filter((key) => key !== "time")
      .map((signal) => (
        <th key={signal} className="border p-2">
          {signal}
        </th>
      ))}
  </tr>
</thead>

<tbody>
  {parsedWaveform.map((row, i) => (
    <tr key={i}>
      <td className="border p-2">{row.time}</td>

      {Object.keys(row)
        .filter((key) => key !== "time")
        .map((signal) => (
          <td key={signal} className="border p-2">
            {row[signal]}
          </td>
        ))}
    </tr>
  ))}
</tbody>
          </table>

          <h2 className="font-bold mb-3">
            Waveform Preview
          </h2>

          <svg width="900" height="400" className="border">

  {Object.keys(parsedWaveform[0] || {})
    .filter((signal) => signal !== "time")
    .map((signal, signalIndex) => (
      <g key={signal}>

        <text
          x="10"
          y={40 + signalIndex * 80}
        >
          {signal}
        </text>

        {parsedWaveform.slice(0, -1).map((row, i) => {
  const nextRow = parsedWaveform[i + 1]

  const currentY =
    row[signal]
      ? 20 + signalIndex * 80
      : 60 + signalIndex * 80

  const nextY =
    nextRow[signal]
      ? 20 + signalIndex * 80
      : 60 + signalIndex * 80

  return (
    <g key={`${signal}-${i}`}>

      <line
        x1={60 + i * 120}
        y1={currentY}
        x2={180 + i * 120}
        y2={currentY}
        stroke="black"
        strokeWidth="3"
      />

      {currentY !== nextY && (
        <line
          x1={180 + i * 120}
          y1={currentY}
          x2={180 + i * 120}
          y2={nextY}
          stroke="black"
          strokeWidth="3"
        />
      )}

    </g>
  )
})}

      </g>
    ))}

            
          </svg>
        </div>
      )}
    </main>
  )
}