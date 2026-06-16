import express from 'express';
import { createServer as createViteServer } from 'vite';

async function start() {
  const app = express();
  app.get('/api/radio-info', async (_req, res) => {
    try {
      const r = await fetch('https://sp.aljania.com/cp/get_info.php?p=8120');
      res.json(await r.json());
    } catch {
      res.status(500).json({ error: 'Offline' });
    }
  });
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
  app.listen(3000, '0.0.0.0', () => console.log('Radio app → http://localhost:3000'));
}

start();
