from flask import Flask
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)

@app.route("/")
def home():
    api_key = os.getenv("GEMINI_API_KEY")

    return {
        "message": "ChipStart Backend Running",
        "gemini_key_loaded": bool(api_key)
    }

if __name__ == "__main__":
    app.run(debug=True)
