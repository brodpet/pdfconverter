import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const RENDERER_HTML_PATH = fileURLToPath(new URL("./_renderer.html", import.meta.url));

function baseName(fileName) {
  const withoutExt = (fileName || "").replace(/\.pdf$/i, "");
  const safe = withoutExt.replace(/["\r\n]/g, "").trim();
  return safe || "converted";
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return Response.json({ error: "Use POST" }, { status: 405 });
    }

    let formData;
    try {
      formData = await request.formData();
    } catch (err) {
      return Response.json({ error: "Could not parse multipart form data" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return Response.json({ error: "Missing 'file' field with a PDF upload" }, { status: 400 });
    }
    if (file.type && file.type !== "application/pdf") {
      return Response.json({ error: "File must be a PDF" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: "PDF too large (max 20MB)" }, { status: 400 });
    }

    const format = (formData.get("format") || "jpeg").toString().toLowerCase();
    if (format !== "jpeg" && format !== "png") {
      return Response.json({ error: "format must be 'jpeg' or 'png'" }, { status: 400 });
    }

    let browser;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = Array.from(new Uint8Array(arrayBuffer));

      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });

      const page = await browser.newPage();
      await page.goto("file://" + RENDERER_HTML_PATH);
      await page.waitForFunction("window.rendererReady === true");

      const mimeType = format === "png" ? "image/png" : "image/jpeg";
      const quality = format === "png" ? undefined : 1.0;

      const dataUrl = await page.evaluate(
        (bytes, mimeType, quality) => window.renderPdfToDataUrl(new Uint8Array(bytes), mimeType, quality),
        bytes,
        mimeType,
        quality
      );

      const base64 = dataUrl.split(",")[1];
      const buffer = Buffer.from(base64, "base64");

      const ext = format === "png" ? "png" : "jpg";
      const outputName = `${baseName(file.name)}.${ext}`;

      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `inline; filename="${outputName}"`,
        },
      });
    } catch (err) {
      return Response.json({ error: "Conversion failed", detail: err.message }, { status: 500 });
    } finally {
      if (browser) await browser.close();
    }
  },
};
