from flask import Flask, request, jsonify
from flask_cors import CORS
import pdfplumber
import os
import io
from groq import Groq
import pytesseract
from pdf2image import convert_from_bytes

# For Windows — tell pytesseract where Tesseract is installed
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

app = Flask(__name__)
CORS(app, origins=[
    "https://page-mind-alpha.vercel.app",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "null"
])

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
MODEL_NAME = "llama-3.1-8b-instant"

def extract_text_normal(file_bytes):
    """Extract text from normal (text-based) PDF"""
    text = ""
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text.strip()

def extract_text_ocr(file_bytes):
    """Extract text from scanned PDF using OCR"""
    text = ""
    images = convert_from_bytes(file_bytes, dpi=200)
    for image in images:
        page_text = pytesseract.image_to_string(image)
        if page_text:
            text += page_text + "\n"
    return text.strip()

def extract_text_from_pdf(file):
    """Try normal extraction first, fall back to OCR"""
    file_bytes = file.read()

    # Try normal text extraction first
    text = extract_text_normal(file_bytes)

    # If no text found, use OCR
    if not text or len(text) < 50:
        text = extract_text_ocr(file_bytes)

    return text

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
            return jsonify({"error": "Could not extract text even with OCR."}), 400

        summary = summarize_text(text)
        return jsonify({"summary": summary, "characters_extracted": len(text)})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "Backend is running!"})


if __name__ == "__main__":
    app.run(debug=True, port=5000)