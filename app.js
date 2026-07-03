import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const controls = document.getElementById("controls");
const formatSelect = document.getElementById("format");
const qualityLabel = document.getElementById("qualityLabel");
const qualityInput = document.getElementById("quality");
const convertBtn = document.getElementById("convertBtn");
const errorEl = document.getElementById("error");
const canvas = document.getElementById("canvas");
const downloadLink = document.getElementById("downloadLink");
const fileNameEl = document.getElementById("fileName");
const statusEl = document.getElementById("status");

let currentFile = null;

dropzone.addEventListener("click", () => fileInput.click());

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});

dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

formatSelect.addEventListener("change", () => {
  qualityLabel.hidden = formatSelect.value !== "image/jpeg";
});

convertBtn.addEventListener("click", () => {
  if (currentFile) convertFile(currentFile);
});

function handleFile(file) {
  hideError();
  downloadLink.hidden = true;
  statusEl.hidden = true;
  fileNameEl.hidden = true;

  if (file.type !== "application/pdf") {
    showError("Please select a PDF file.");
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    showError("File is too large. Please use a PDF under 50MB.");
    return;
  }

  currentFile = file;
  fileNameEl.textContent = `Selected: ${file.name}`;
  fileNameEl.hidden = false;
  controls.hidden = false;
}

async function convertFile(file) {
  hideError();
  downloadLink.hidden = true;
  statusEl.hidden = true;
  convertBtn.disabled = true;
  convertBtn.textContent = "Converting…";

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 2 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");

    await page.render({ canvasContext: ctx, viewport }).promise;

    const format = formatSelect.value;
    const quality = parseFloat(qualityInput.value);
    const blob = await canvasToBlob(canvas, format, quality);

    const url = URL.createObjectURL(blob);
    const ext = format === "image/png" ? "png" : "jpg";
    downloadLink.href = url;
    downloadLink.download = `converted.${ext}`;
    downloadLink.hidden = false;
    statusEl.hidden = false;
  } catch (err) {
    showError("Couldn't convert this PDF. It may be corrupt or unsupported.");
  } finally {
    convertBtn.disabled = false;
    convertBtn.textContent = "Convert";
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      type,
      quality
    );
  });
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function hideError() {
  errorEl.hidden = true;
}
