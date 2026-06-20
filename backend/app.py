import os
import subprocess
import tempfile
from PIL import Image

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

app = Flask(__name__)
CORS(app)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

MODEL = genai.GenerativeModel("gemini-3.5-flash")

with open("../prompts/verilog_system_prompt.txt", "r") as f:
    SYSTEM_PROMPT = f.read()


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
            f"{SYSTEM_PROMPT}\n\nUser Request:\n{user_input}"
        )

        verilog_code = response.text
        verilog_code = verilog_code.replace("```verilog", "").replace("```", "").strip()
        print(repr(verilog_code[:100]))


        print("Gemini responded!")
        print(verilog_code)
        with tempfile.TemporaryDirectory() as tmpdir:

            v_path = os.path.join(tmpdir, "design.v")

            with open(v_path, "w") as f:
                  f.write(verilog_code)

            print("Saved file:", v_path)

            print("FIRST 20 BYTES OF FILE:")
            with open(v_path, "rb") as f:
                print(f.read(20))

            sim_path = os.path.join(tmpdir, "sim")

            compile_result = subprocess.run(
                ["iverilog", "-o", sim_path, v_path],
                capture_output=True,
                text=True
            )

            if compile_result.returncode != 0:
                print("COMPILE ERROR:")
                print(compile_result.stderr)

                return jsonify({
                    "verilog": verilog_code,
                    "waveform": None,
                    "error": compile_result.stderr
                })


            run_result = subprocess.run(
                ["vvp", sim_path],
                capture_output=True,
                text=True,
                cwd=tmpdir
            )


            vcd_path = os.path.join(tmpdir, "output.vcd")

            waveform_data = ""

            if os.path.exists(vcd_path):
                with open(vcd_path, "r") as f:
                    waveform_data = f.read()
            print("VCD size:", len(waveform_data))


            return jsonify({
                "verilog": verilog_code,
                "waveform": waveform_data,
                "error": None
            })

    except Exception as e:
        return jsonify({
            "verilog": None,
            "waveform": None,

            "error": str(e)
        })
    
@app.route("/upload-image", methods=["POST"])
def upload_image():

    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]

    filepath = os.path.join("uploads", file.filename)

    file.save(filepath)

    return jsonify({
        "success": True,
        "filename": file.filename
    })

@app.route("/image-to-verilog", methods=["POST"])
def image_to_verilog():

    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]

    image = Image.open(file)

    prompt = """
    You are a Verilog HDL expert.

    Analyze the uploaded circuit diagram.

    The image may contain:
    - Logic gates
    - Digital circuits
    - Hand-drawn gate diagrams

    Generate synthesizable Verilog code that matches the circuit.

    Return ONLY Verilog code.
    Do not use markdown.
    Do not explain anything.
    """

    response = MODEL.generate_content(
        [prompt, image]
    )

    verilog_code = response.text
    verilog_code = verilog_code.replace("```verilog", "").replace("```", "").strip()

    return jsonify({
        "verilog": verilog_code
    })


if __name__ == "__main__":
    app.run(debug=True, port=5001)


