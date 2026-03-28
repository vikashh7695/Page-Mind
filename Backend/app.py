from flask import Flask, request, jsonify
from flask_cors import CORS
import pdfplumber
import os
from groq import Groq

app = Flask(__name__)
CORS(app)

# Groq client — reads GROQ_API_KEY from environment variable
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
MODEL_NAME = "llama-3.1-8b-instant"

def extract_text_from_pdf(file):
    text = ""
    with pdfplumber.open(file) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text.strip()

def summarize_text(text):
    max_chars = 8000
    if len(text) > max_chars:
        text = text[:max_chars] + "...[truncated]"

    prompt = f"""You are an expert document summarizer.
Summarize the following document clearly and concisely.
Structure your summary with:
- A brief overview (2-3 sentences)
- Key points (bullet points)
- Main conclusion

Document:
{text}
"""

    chat_completion = client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model=MODEL_NAME,
        temperature=0.5,
        max_tokens=1024
    )

    return chat_completion.choices[0].message.content


@app.route("/summarize", methods=["POST"])
def summarize():
    if "pdf" not in request.files:
        return jsonify({"error": "No PDF file uploaded"}), 400

    file = request.files["pdf"]

    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not file.filename.endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported"}), 400

    try:
        text = extract_text_from_pdf(file)

        if not text:
            return jsonify({"error": "Could not extract text from PDF. It may be scanned or image-based."}), 400

        summary = summarize_text(text)
        return jsonify({"summary": summary, "characters_extracted": len(text)})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "Backend is running!"})


if __name__ == "__main__":
    app.run(debug=True, port=5000)