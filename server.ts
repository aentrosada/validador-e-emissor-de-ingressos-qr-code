import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { createServer as createViteServer } from 'vite';
import { INITIAL_INGRESSOS } from './src/data/initialData.js';
import { Ingresso } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho do arquivo de persistência local para não perder check-ins e UUIDs mesmo com restart
const DB_FILE = path.join(process.cwd(), 'ingressos_db.json');

function loadDatabase(): Ingresso[] {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`[DB] Carregados ${parsed.length} ingressos do arquivo local ingressos_db.json`);
        return parsed;
      }
    }
  } catch (err) {
    console.error('[DB] Erro ao ler ingressos_db.json:', err);
  }
  return [...INITIAL_INGRESSOS];
}

function saveDatabase(data: Ingresso[]) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Erro ao salvar ingressos_db.json:', err);
  }
}

// In-memory store inicializado com o arquivo persistente
let dbIngressos: Ingresso[] = loadDatabase();

function formatTimestamp(): string {
  // Garante que o horário seja SEMPRE o de Brasília (America/Sao_Paulo / UTC-3), mesmo em servidores no exterior como o Render
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

  const dia = getPart('day');
  const mes = getPart('month');
  const ano = getPart('year');
  const horas = getPart('hour');
  const minutos = getPart('minute');

  return `${dia}/${mes}/${ano} às ${horas}:${minutos}`;
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
  const PORT = Number(process.env.PORT) || 3000;
  const ADMIN_CPF = process.env.ADMIN_CPF || '39784759870';
  const SHEETS_SYNC_URL = (process.env.SHEETS_SYNC_URL || '').trim();

  // Função para sincronizar dados diretamente com a planilha Google via Apps Script Web App
  async function syncCheckinToGoogleSheet(params: {
    cpf: string;
    dia: 1 | 2;
    timestamp: string;
    uuid: string;
    tipo?: number;
  }) {
    if (!SHEETS_SYNC_URL) {
      console.log('[Google Sheets Sync] SHEETS_SYNC_URL não configurada no ambiente.');
      return;
    }
    try {
      console.log(`[Google Sheets Sync] Enviando check-in para Google Sheets: CPF ${params.cpf}...`);
      // O Google Apps Script precisa seguir redirecionamento 302
      const res = await fetch(SHEETS_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'checkin',
          ...params,
        }),
        redirect: 'follow',
      });
      const resText = await res.text();
      console.log(`[Google Sheets Sync] Resposta do Google Sheets: ${resText}`);
    } catch (err) {
      console.error('[Google Sheets Sync Error]:', err);
    }
  }

  // Função para sincronizar/gravar UUIDs gerados de volta na planilha Google
  async function syncUUIDsToGoogleSheet(items: Ingresso[]) {
    if (!SHEETS_SYNC_URL) return;
    try {
      console.log(`[Google Sheets Sync] Enviando ${items.length} UUIDs para Google Sheets...`);
      const res = await fetch(SHEETS_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'sync_uuids',
          ingressos: items.map(x => ({
            cpf: cleanCPF(x.cpf),
            tipo: x.tipo,
            uuid_dia1: x.uuid_dia1 || '',
            uuid_dia2: x.uuid_dia2 || '',
            dia1: x.dia1 || '',
            dia2: x.dia2 || '',
          })),
        }),
        redirect: 'follow',
      });
      const resText = await res.text();
      console.log(`[Google Sheets Sync] Resposta UUIDs do Google Sheets: ${resText}`);
    } catch (err) {
      console.error('[Google Sheets Sync Error]:', err);
    }
  }

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
      // Check if this UUID actually belongs to the OTHER day
      const belongsToOtherDay = dbIngressos.find(item => 
        (eventDay === 1 && item.uuid_dia2 && item.uuid_dia2.trim().toLowerCase() === cleanedUUID) ||
        (eventDay === 2 && item.uuid_dia1 && item.uuid_dia1.trim().toLowerCase() === cleanedUUID)
      );

      if (belongsToOtherDay) {
        const diaCorreto = eventDay === 1 ? 'DOMINGO' : 'SÁBADO';
        return res.status(400).json({
          status: 'erro',
          mensagem: `Esse ingresso é para ${diaCorreto}!`,
          ingresso: belongsToOtherDay,
        });
      }

      return res.status(404).json({
        status: 'erro',
        mensagem: `UUID "${uuid}" não encontrado. Ingresso inválido.`,
      });
    }

    if ((me.situacao || '').toUpperCase() !== 'LIBERADO') {
      return res.status(400).json({
        status: 'erro',
        mensagem: `Ingresso não liberado!\nSituação atual: ${me.situacao}`,
        ingresso: me,
      });
    }

    if (eventDay === 1) {
      if (me.dia1 && me.dia1.trim() !== '') {
        return res.status(400).json({
          status: 'erro',
          mensagem: `Ingresso já utilizado.\nCheck-in realizado em **${me.dia1}**`,
          ingresso: me,
        });
      }
      me.dia1 = currentTimestamp;
      saveDatabase(dbIngressos);
      
      // Sincroniza em segundo plano com a planilha Google
      syncCheckinToGoogleSheet({
        cpf: me.cpf,
        dia: 1,
        timestamp: currentTimestamp,
        uuid: me.uuid_dia1 || cleanedUUID,
        tipo: me.tipo,
      });

      return res.json({ 
        status: 'sucesso', 
        mensagem: `Entrada Liberada no SÁBADO!\nCheck in realizado em **${currentTimestamp}**`, 
        ingresso: me, 
        timestamp: currentTimestamp, 
        diaValidado: 1 
      });
    } else {
      if (me.dia2 && me.dia2.trim() !== '') {
        return res.status(400).json({
          status: 'erro',
          mensagem: `Ingresso já utilizado.\nCheck-in realizado em **${me.dia2}**`,
          ingresso: me,
        });
      }
      me.dia2 = currentTimestamp;
      saveDatabase(dbIngressos);

      // Sincroniza em segundo plano com a planilha Google
      syncCheckinToGoogleSheet({
        cpf: me.cpf,
        dia: 2,
        timestamp: currentTimestamp,
        uuid: me.uuid_dia2 || cleanedUUID,
        tipo: me.tipo,
      });

      return res.json({ 
        status: 'sucesso', 
        mensagem: `Entrada Liberada no DOMINGO!\nCheck in realizado em **${currentTimestamp}**`, 
        ingresso: me, 
        timestamp: currentTimestamp, 
        diaValidado: 2 
      });
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

    // Persiste no arquivo local
    saveDatabase(dbIngressos);

    // Sincroniza os UUIDs gerados de volta com a planilha do Google Sheets (se configurado)
    syncUUIDsToGoogleSheet(dbIngressos);

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
    saveDatabase(dbIngressos);
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
