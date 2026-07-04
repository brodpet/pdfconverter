import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const controls = document.getElementById("controls");
const formatSelect = document.getElementById("format");
const formatChoices = document.querySelectorAll('input[name="formatChoice"]');
const convertBtn = document.getElementById("convertBtn");
const errorEl = document.getElementById("error");
const canvas = document.getElementById("canvas");
const downloadLink = document.getElementById("downloadLink");
const fileNameEl = document.getElementById("fileName");
const statusEl = document.getElementById("status");

let currentFile = null;

dropzone.addEventListener("click", () => fileInput.click());

dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

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
  syncFormatUi(formatSelect.value);
});

formatChoices.forEach((choice) => {
  choice.addEventListener("change", () => {
    formatSelect.value = choice.value;
    syncFormatUi(choice.value);
  });
});

convertBtn.addEventListener("click", () => {
  if (currentFile) convertFile(currentFile);
});

function handleFile(file) {
  hideError();
  downloadLink.hidden = true;
  setStatus("Waiting for a PDF");
  fileNameEl.hidden = true;

  if (file.type !== "application/pdf") {
    showError("Please select a PDF file.");
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    showError("File is too large. Please use a PDF under 20MB.");
    return;
  }

  currentFile = file;
  fileNameEl.innerHTML = `<strong>${escapeHtml(file.name)}</strong> <span class="file-meta">${formatFileSize(file.size)}</span>`;
  fileNameEl.hidden = false;
  controls.hidden = false;
  setStatus("PDF loaded. Choose an output and convert.");
}

async function convertFile(file) {
  hideError();
  downloadLink.hidden = true;
  setStatus("Rendering the first page...", "working");
  convertBtn.disabled = true;
  convertBtn.textContent = "Converting...";

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
    const blob = await canvasToBlob(canvas, format, 1.0);

    const url = URL.createObjectURL(blob);
    const ext = format === "image/png" ? "png" : "jpg";
    downloadLink.href = url;
    downloadLink.download = `${baseName(file.name)}.${ext}`;
    downloadLink.hidden = false;
    setStatus(`Ready as ${ext.toUpperCase()}.`, "ready");
  } catch (err) {
    showError("Couldn't convert this PDF. It may be corrupt or unsupported.");
    setStatus("Conversion stopped. Check the file and try again.");
  } finally {
    convertBtn.disabled = false;
    convertBtn.textContent = "Convert page";
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

function syncFormatUi(format) {
  formatChoices.forEach((choice) => {
    choice.checked = choice.value === format;
  });
}

function setStatus(message, state = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${state}`.trim();
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(value) {
  const span = document.createElement("span");
  span.textContent = value;
  return span.innerHTML;
}

function baseName(fileName) {
  const withoutExt = fileName.replace(/\.pdf$/i, "");
  return withoutExt || "converted";
}
