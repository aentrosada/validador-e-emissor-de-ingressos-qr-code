import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { createServer as createViteServer } from 'vite';
import { INITIAL_INGRESSOS } from './src/data/initialData.js';
import { Ingresso } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory store
let dbIngressos: Ingresso[] = [...INITIAL_INGRESSOS];

function formatTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function cleanCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

function generateUUID(): string {
  return randomUUID();
}

// Ensure every ingresso has the correct UUIDs based on tipo
function ensureUUIDs(item: Ingresso): Ingresso {
  const updated = { ...item };
  if ((updated.tipo === 1 || updated.tipo === 3) && !updated.uuid_dia1) {
    updated.uuid_dia1 = generateUUID();
  }
  if ((updated.tipo === 2 || updated.tipo === 3) && !updated.uuid_dia2) {
    updated.uuid_dia2 = generateUUID();
  }
  return updated;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const ADMIN_CPF = process.env.ADMIN_CPF || '39784759870';

  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: formatTimestamp() });
  });

  // Get all ingressos
  app.get('/api/ingressos', (req, res) => {
    res.json({ total: dbIngressos.length, ingressos: dbIngressos });
  });

  // Login via CPF
  app.post('/api/cpf-login', (req, res) => {
    const { cpf } = req.body;
    if (!cpf) {
      return res.status(400).json({ sucesso: false, mensagem: 'Por favor, informe um CPF valido.' });
    }

    const cleanedSearchCPF = cleanCPF(cpf);
    const isAdmin = cleanedSearchCPF === cleanCPF(ADMIN_CPF);

    if (isAdmin) {
      const adminEntry = dbIngressos.find(item => cleanCPF(item.cpf) === cleanedSearchCPF) || {
        id: 'admin-master',
        nome: 'Administrador da Portaria',
        email: 'admin@evento.com.br',
        telefone: '',
        cpf: ADMIN_CPF,
        tipo: 3 as const,
        situacao: 'LIBERADO',
        uuid_dia1: 'admin-dia1',
        uuid_dia2: 'admin-dia2',
        isAdmin: true,
      };
      return res.json({ sucesso: true, mensagem: 'Acesso de Administrador concedido!', ingresso: { ...adminEntry, isAdmin: true }, isAdmin: true });
    }

    // Find all entries for this CPF
    const allEntries = dbIngressos.filter(item => cleanCPF(item.cpf) === cleanedSearchCPF);
    if (allEntries.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'CPF nao encontrado na lista de ingressos.' });
    }

    // Merge entries: collect uuid_dia1 from LIBERADO tipo-1/3 entries, uuid_dia2 from LIBERADO tipo-2/3 entries
    const base = allEntries[0];
    let uuid_dia1: string | undefined;
    let uuid_dia2: string | undefined;
    let dia1 = '';
    let dia2 = '';

    for (const entry of allEntries) {
      const liberado = (entry.situacao || '').toUpperCase() === 'LIBERADO';
      if (liberado && !uuid_dia1 && (entry.tipo === 1 || entry.tipo === 3) && entry.uuid_dia1) {
        uuid_dia1 = entry.uuid_dia1;
      }
      if (liberado && !uuid_dia2 && (entry.tipo === 2 || entry.tipo === 3) && entry.uuid_dia2) {
        uuid_dia2 = entry.uuid_dia2;
      }
      if ((entry.tipo === 1 || entry.tipo === 3) && entry.dia1) dia1 = entry.dia1;
      if ((entry.tipo === 2 || entry.tipo === 3) && entry.dia2) dia2 = entry.dia2;
    }

    if (!uuid_dia1 && !uuid_dia2) {
      return res.status(403).json({
        sucesso: false,
        mensagem: `Seu ingresso nao esta liberado. Situacao: "${base.situacao}".`,
        ingresso: base,
      });
    }

    const tipo: 1 | 2 | 3 = uuid_dia1 && uuid_dia2 ? 3 : uuid_dia1 ? 1 : 2;

    const merged: Ingresso = {
      ...base,
      tipo,
      situacao: 'LIBERADO',
      uuid_dia1,
      uuid_dia2,
      dia1,
      dia2,
    };

    res.json({ sucesso: true, mensagem: 'Acesso autorizado.', ingresso: merged, isAdmin: false });
  });

  // Validate QR Code UUID
  app.post('/api/validar', (req, res) => {
    const { uuid, dia } = req.body;

    if (!uuid) {
      return res.status(400).json({ status: 'erro', mensagem: 'UUID nao informado.' });
    }

    const eventDay = Number(dia) === 2 ? 2 : 1;
    const cleanedUUID = String(uuid).trim().toLowerCase();
    const currentTimestamp = formatTimestamp();

    let me: Ingresso | undefined;

    if (eventDay === 1) {
      me = dbIngressos.find(item => item.uuid_dia1 && item.uuid_dia1.trim().toLowerCase() === cleanedUUID);
    } else {
      me = dbIngressos.find(item => item.uuid_dia2 && item.uuid_dia2.trim().toLowerCase() === cleanedUUID);
    }

    if (!me) {
      return res.status(404).json({
        status: 'erro',
        mensagem: `UUID "${uuid}" nao encontrado. Ingresso invalido.`,
      });
    }

    if ((me.situacao || '').toUpperCase() !== 'LIBERADO') {
      return res.status(400).json({
        status: 'erro',
        mensagem: `Ingresso nao liberado (Situacao: "${me.situacao}").`,
        ingresso: me,
      });
    }

    if (eventDay === 1) {
      if (me.dia1 && me.dia1.trim() !== '') {
        return res.status(400).json({
          status: 'erro',
          mensagem: `Ingresso ja utilizado no SABADO! Check-in em ${me.dia1}.`,
          ingresso: me,
        });
      }
      me.dia1 = currentTimestamp;
      return res.json({ status: 'sucesso', mensagem: 'Entrada Liberada no SABADO!', ingresso: me, timestamp: currentTimestamp, diaValidado: 1 });
    } else {
      if (me.dia2 && me.dia2.trim() !== '') {
        return res.status(400).json({
          status: 'erro',
          mensagem: `Ingresso ja utilizado no DOMINGO! Check-in em ${me.dia2}.`,
          ingresso: me,
        });
      }
      me.dia2 = currentTimestamp;
      return res.json({ status: 'sucesso', mensagem: 'Entrada Liberada no DOMINGO!', ingresso: me, timestamp: currentTimestamp, diaValidado: 2 });
    }
  });

  // Import / Update Spreadsheet Data
  app.post('/api/ingressos/import', (req, res) => {
    const { ingressos, overwrite } = req.body;
    if (!Array.isArray(ingressos)) {
      return res.status(400).json({ status: 'erro', mensagem: 'Dados invalidos.' });
    }

    // Ensure UUIDs on all incoming entries
    const withUUIDs = ingressos.map(ensureUUIDs);

    if (overwrite) {
      dbIngressos = withUUIDs;
    } else {
      withUUIDs.forEach((newItem: Ingresso) => {
        const existingIdx = dbIngressos.findIndex(
          x => (newItem.uuid_dia1 && x.uuid_dia1 === newItem.uuid_dia1) ||
               (newItem.uuid_dia2 && x.uuid_dia2 === newItem.uuid_dia2) ||
               (x.cpf && cleanCPF(x.cpf) === cleanCPF(newItem.cpf) && x.tipo === newItem.tipo)
        );
        if (existingIdx >= 0) {
          // Keep existing UUIDs, just update other fields
          dbIngressos[existingIdx] = {
            ...dbIngressos[existingIdx],
            ...newItem,
            uuid_dia1: dbIngressos[existingIdx].uuid_dia1 || newItem.uuid_dia1,
            uuid_dia2: dbIngressos[existingIdx].uuid_dia2 || newItem.uuid_dia2,
          };
        } else {
          dbIngressos.push(newItem);
        }
      });
    }

    res.json({ status: 'sucesso', mensagem: `${ingressos.length} ingressos processados.`, total: dbIngressos.length, ingressos: dbIngressos });
  });

  // Reset checkin
  app.post('/api/ingressos/reset', (req, res) => {
    const { id, dia } = req.body;
    if (id) {
      const me = dbIngressos.find(x => x.id === id || x.uuid_dia1 === id || x.uuid_dia2 === id);
      if (me) {
        if (!dia || dia === 1) me.dia1 = '';
        if (!dia || dia === 2) me.dia2 = '';
      }
    } else {
      dbIngressos.forEach(x => { x.dia1 = ''; x.dia2 = ''; });
    }
    res.json({ status: 'sucesso', mensagem: 'Check-ins redefinidos.', ingressos: dbIngressos });
  });

  // Fetch Google Sheets CSV
  app.post('/api/fetch-sheets-csv', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ status: 'erro', mensagem: 'URL nao fornecida.' });

    try {
      let fetchUrl = url.trim();
      if (fetchUrl.includes('docs.google.com/spreadsheets/d/')) {
        if (!fetchUrl.includes('pub?output=csv') && !fetchUrl.includes('/export?format=csv')) {
          const match = fetchUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
          if (match && match[1]) {
            fetchUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
          }
        }
      }
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const csvText = await response.text();
      res.json({ status: 'sucesso', csvText });
    } catch (err: any) {
      res.status(500).json({ status: 'erro', mensagem: `Falha: ${err.message}` });
    }
  });

  // Serve frontend
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
