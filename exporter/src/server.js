import cors from 'cors';
import express from 'express';
import { chromium } from 'playwright';
import { renderExportHtml } from './template.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '3mb' }));

let browserPromise;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
  }
  return browserPromise;
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/export', async (req, res) => {
  try {
    const payload = req.body ?? {};
    const format = payload.format === 'jpeg' || payload.format === 'jpg' ? 'jpeg' : 'png';

    const browser = await getBrowser();
    const context = await browser.newContext({
      viewport: { width: 1520, height: 980 },
      deviceScaleFactor: 2
    });
    const page = await context.newPage();
    await page.setContent(renderExportHtml(payload), { waitUntil: 'networkidle' });

    const image = await page.screenshot({
      type: format,
      quality: format === 'jpeg' ? 92 : undefined,
      fullPage: true
    });

    await context.close();

    res.setHeader('Content-Type', format === 'jpeg' ? 'image/jpeg' : 'image/png');
    res.send(image);
  } catch (error) {
    console.error('Export failed', error);
    res.status(500).json({ error: 'Failed to export image' });
  }
});

const port = 8787;
const host = '0.0.0.0';
app.listen(port, host, () => {
  console.log(`Exporter listening on ${host}:${port}`);
});

process.on('SIGINT', async () => {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
  }
  process.exit(0);
});
