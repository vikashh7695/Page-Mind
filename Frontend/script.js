const BACKEND_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:5000"
  : "https://page-mind-production.up.railway.app"; // 🔁 Replace this after Railway deployment

// Elements
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const removeFile = document.getElementById("removeFile");
const summarizeBtn = document.getElementById("summarizeBtn");
const btnText = document.getElementById("btnText");
const resultSection = document.getElementById("resultSection");
const resultBox = document.getElementById("resultBox");
const resultMeta = document.getElementById("resultMeta");
const loadingSection = document.getElementById("loadingSection");
const errorSection = document.getElementById("errorSection");
const errorText = document.getElementById("errorText");
const copyBtn = document.getElementById("copyBtn");
const newBtn = document.getElementById("newBtn");
const retryBtn = document.getElementById("retryBtn");

let selectedFile = null;

// --- Drag & Drop ---
dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  if (!file.name.endsWith(".pdf")) {
    showError("Only PDF files are supported. Please upload a .pdf file.");
    return;
  }

  selectedFile = file;
  fileName.textContent = file.name;
  fileInfo.style.display = "flex";
  dropZone.style.display = "none";
  summarizeBtn.disabled = false;

  hideAll();
}

removeFile.addEventListener("click", () => {
  selectedFile = null;
  fileInput.value = "";
  fileInfo.style.display = "none";
  dropZone.style.display = "block";
  summarizeBtn.disabled = true;
  hideAll();
});

// --- Summarize ---
summarizeBtn.addEventListener("click", summarize);

function formatSummary(text) {
  return text
    // Remove ** bold markers but keep the text
    .replace(/\*\*(.*?)\*\*/g, '<span class="summary-heading">$1</span>')
    // Remove single * italic markers
    .replace(/\*(.*?)\*/g, '$1')
    // Handle bullet points with *
    .replace(/^\* (.+)/gm, '<li>$1</li>')
    // Handle bullet points with -
    .replace(/^- (.+)/gm, '<li>$1</li>')
    // Wrap consecutive li items in ul
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Handle # headings
    .replace(/^### (.+)/gm, '<h3>$1</h3>')
    .replace(/^## (.+)/gm, '<h2>$1</h2>')
    .replace(/^# (.+)/gm, '<h1>$1</h1>')
    // Convert line breaks to paragraphs
    .split('\n\n')
    .map(para => para.trim() ? `<p>${para.replace(/\n/g, '<br>')}</p>` : '')
    .join('');
}

async function summarize() {
  if (!selectedFile) return;

  hideAll();
  loadingSection.style.display = "flex";
  summarizeBtn.disabled = true;
  btnText.textContent = "Summarizing...";

  const formData = new FormData();
  formData.append("pdf", selectedFile);

  try {
    const response = await fetch(`${BACKEND_URL}/summarize`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong");
    }

    loadingSection.style.display = "none";
    resultSection.style.display = "block";
    resultBox.innerHTML = formatSummary(data.summary);
    resultMeta.textContent = `✦ ${data.characters_extracted.toLocaleString()} characters extracted from "${selectedFile.name}"`;

  } catch (err) {
    loadingSection.style.display = "none";
    showError(err.message);
  } finally {
    summarizeBtn.disabled = false;
    btnText.textContent = "Summarize PDF";
  }
}

// --- Copy ---
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(resultBox.textContent).then(() => {
    copyBtn.textContent = "Copied!";
    setTimeout(() => copyBtn.textContent = "Copy", 2000);
  });
});

// --- New PDF ---
newBtn.addEventListener("click", resetAll);
retryBtn.addEventListener("click", () => {
  hideAll();
  dropZone.style.display = "block";
  fileInfo.style.display = "none";
  selectedFile = null;
  fileInput.value = "";
  summarizeBtn.disabled = true;
});

function showError(message) {
  errorSection.style.display = "flex";
  errorText.textContent = message;
}

function hideAll() {
  resultSection.style.display = "none";
  loadingSection.style.display = "none";
  errorSection.style.display = "none";
}

function resetAll() {
  hideAll();
  selectedFile = null;
  fileInput.value = "";
  fileInfo.style.display = "none";
  dropZone.style.display = "block";
  summarizeBtn.disabled = true;
  btnText.textContent = "Summarize PDF";
}