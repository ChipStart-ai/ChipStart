import os
import subprocess
import tempfile

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

app = Flask(__name__)
CORS(app)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

MODEL = genai.GenerativeModel("gemini-3.5-flash")

@app.route("/")
def home():
    return {
        "message": "ChipStart Backend Running"
    }

@app.route("/generate", methods=["POST"])
def generate_verilog():
    data = request.json
    user_input = data.get("prompt", "")
    print("Received prompt:", user_input)

    try:
        print("Calling Gemini...")
        response = MODEL.generate_content(
            f"Generate Verilog HDL code for: {user_input}. Return only Verilog code."
        )

        verilog_code = response.text
        verilog_code = verilog_code.replace("```verilog", "").replace("```", "").strip()
        print("Gemini responded!")

        with tempfile.TemporaryDirectory() as tmpdir:

            v_path = os.path.join(tmpdir, "design.v")

            with open(v_path, "w") as f:
                f.write(verilog_code)

            sim_path = os.path.join(tmpdir, "sim")

            compile_result = subprocess.run(
                ["iverilog", "-o", sim_path, v_path],
                capture_output=True,
                text=True
            )

            if compile_result.returncode != 0:
                return jsonify({
                    "verilog": verilog_code,
                    "waveform": None,
                    "error": compile_result.stderr
                })

            subprocess.run(
                ["vvp", sim_path],
                capture_output=True,
                text=True
            )

            return jsonify({
                "verilog": verilog_code,
                "waveform": "Simulation completed",
                "error": None
            })

    except Exception as e:
        return jsonify({
            "verilog": None,
            "waveform": None,
            "error": str(e)
        })

if __name__ == "__main__":
    app.run(debug=True, port=5001)
