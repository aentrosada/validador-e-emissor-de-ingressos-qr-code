import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { INITIAL_INGRESSOS } from './src/data/initialData.js';
import { Ingresso } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory store initialized with seed data
let dbIngressos: Ingresso[] = [...INITIAL_INGRESSOS];

function formatTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function cleanCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: formatTimestamp() });
  });

  // Get all ingressos
  app.get('/api/ingressos', (req, res) => {
    res.json({
      total: dbIngressos.length,
      ingressos: dbIngressos,
    });
  });

  // Login via CPF (for participant portal or admin)
  app.post('/api/cpf-login', (req, res) => {
    const { cpf } = req.body;
    if (!cpf) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Por favor, informe um CPF válido.',
      });
    }

    const cleanedSearchCPF = cleanCPF(cpf);
    const isAdmin = cleanedSearchCPF === '12345678910';

    let matched = dbIngressos.find(
      (item) => cleanCPF(item.cpf) === cleanedSearchCPF
    );

    // If logging in with admin CPF (12345678910), grant admin access
    if (isAdmin) {
      if (!matched) {
        matched = {
          id: 'admin-master',
          nome: 'Administrador da Portaria',
          email: 'admin@evento.com.br',
          telefone: '5511999998888',
          cpf: '12345678910',
          tipo: 3,
          situacao: 'LIBERADO',
          uuid: 'admin-pass-999',
          isAdmin: true,
        };
      } else {
        matched.isAdmin = true;
      }

      return res.json({
        sucesso: true,
        mensagem: 'Acesso de Administrador concedido com sucesso!',
        ingresso: matched,
        isAdmin: true,
      });
    }

    if (!matched) {
      return res.status(404).json({
        sucesso: false,
        mensagem: 'CPF não encontrado na lista de ingressos.',
      });
    }

    if ((matched.situacao || '').trim().toUpperCase() !== 'LIBERADO') {
      return res.status(403).json({
        sucesso: false,
        mensagem: `A situação do seu ingresso é "${matched.situacao}". Apenas ingressos com situação LIBERADO podem visualizar o QR Code.`,
        ingresso: matched,
      });
    }

    res.json({
      sucesso: true,
      mensagem: 'Acesso de participante autorizado.',
      ingresso: matched,
      isAdmin: false,
    });
  });

  // Validate QR Code UUID (API /validar endpoint as specified in prompt)
  app.post('/api/validar', (req, res) => {
    const { uuid, dia } = req.body; // dia: 1 (Sábado) or 2 (Domingo)

    if (!uuid) {
      return res.status(400).json({
        status: 'erro',
        mensagem: 'UUID não informado no escaneamento.',
      });
    }

    const eventDay = Number(dia) === 2 ? 2 : 1; // Default to Day 1 if not specified
    const cleanedUUID = String(uuid).trim();

    // 1. Search for UUID in database
    const me = dbIngressos.find(
      (item) =>
        item.uuid.trim().toLowerCase() === cleanedUUID.toLowerCase() ||
        cleanedUUID.toLowerCase().includes(item.uuid.trim().toLowerCase())
    );

    if (!me) {
      return res.status(404).json({
        status: 'erro',
        mensagem: `Erro: UUID "${cleanedUUID}" não encontrado no sistema. Ingresso inválido.`,
      });
    }

    // 2. Check SITUAÇÃO (must be LIBERADO)
    if ((me.situacao || '').trim().toUpperCase() !== 'LIBERADO') {
      return res.status(400).json({
        status: 'erro',
        mensagem: `Erro: Ingresso não liberado (Situação atual: "${me.situacao}").`,
        ingresso: me,
      });
    }

    // 3. Check TIPO vs Event Day
    // tipo 1 = Sábado, tipo 2 = Domingo, tipo 3 = Passaporte (Sábado e Domingo)
    const tipo = Number(me.tipo);
    if (eventDay === 1 && tipo === 2) {
      return res.status(400).json({
        status: 'erro',
        mensagem: `Erro: Ingresso do tipo 2 (DOMINGO) não é válido para a portaria do SÁBADO (Dia 1).`,
        ingresso: me,
      });
    }
    if (eventDay === 2 && tipo === 1) {
      return res.status(400).json({
        status: 'erro',
        mensagem: `Erro: Ingresso do tipo 1 (SÁBADO) não é válido para a portaria do DOMINGO (Dia 2).`,
        ingresso: me,
      });
    }

    // 4. Check Check-in status
    const currentTimestamp = formatTimestamp();
    if (eventDay === 1) {
      if (me.dia1 && me.dia1.trim() !== '') {
        return res.status(400).json({
          status: 'erro',
          mensagem: `Erro: Ingresso já utilizado no SÁBADO! Check-in realizado em ${me.dia1}.`,
          ingresso: me,
        });
      }
      // Record checkin for Dia 1
      me.dia1 = currentTimestamp;
      return res.json({
        status: 'sucesso',
        mensagem: `Sucesso: Entrada Liberada no SÁBADO!`,
        ingresso: me,
        timestamp: currentTimestamp,
        diaValidado: 1,
      });
    } else {
      if (me.dia2 && me.dia2.trim() !== '') {
        return res.status(400).json({
          status: 'erro',
          mensagem: `Erro: Ingresso já utilizado no DOMINGO! Check-in realizado em ${me.dia2}.`,
          ingresso: me,
        });
      }
      // Record checkin for Dia 2
      me.dia2 = currentTimestamp;
      return res.json({
        status: 'sucesso',
        mensagem: `Sucesso: Entrada Liberada no DOMINGO!`,
        ingresso: me,
        timestamp: currentTimestamp,
        diaValidado: 2,
      });
    }
  });

  // Import / Update Spreadsheet Data
  app.post('/api/ingressos/import', (req, res) => {
    const { ingressos, overwrite } = req.body;
    if (!Array.isArray(ingressos)) {
      return res.status(400).json({ status: 'erro', mensagem: 'Dados inválidos fornecidos.' });
    }

    if (overwrite) {
      dbIngressos = ingressos;
    } else {
      // Merge or update by UUID or CPF
      ingressos.forEach((newItem: Ingresso) => {
        const existingIdx = dbIngressos.findIndex(
          (x) => x.uuid === newItem.uuid || (x.cpf && cleanCPF(x.cpf) === cleanCPF(newItem.cpf))
        );
        if (existingIdx >= 0) {
          dbIngressos[existingIdx] = { ...dbIngressos[existingIdx], ...newItem };
        } else {
          dbIngressos.push(newItem);
        }
      });
    }

    res.json({
      status: 'sucesso',
      mensagem: `${ingressos.length} ingressos processados com sucesso.`,
      total: dbIngressos.length,
      ingressos: dbIngressos,
    });
  });

  // Reset checkin timestamp
  app.post('/api/ingressos/reset', (req, res) => {
    const { id, dia } = req.body;
    if (id) {
      const me = dbIngressos.find((x) => x.id === id || x.uuid === id);
      if (me) {
        if (!dia || dia === 1) me.dia1 = '';
        if (!dia || dia === 2) me.dia2 = '';
      }
    } else {
      // Reset all
      dbIngressos.forEach((x) => {
        x.dia1 = '';
        x.dia2 = '';
      });
    }
    res.json({ status: 'sucesso', mensagem: 'Check-ins redefinidos.', ingressos: dbIngressos });
  });

  // Fetch Public Google Sheets CSV Link
  app.post('/api/fetch-sheets-csv', async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ status: 'erro', mensagem: 'URL da planilha não fornecida.' });
    }

    try {
      // Normalize Google Sheets URL to export CSV if necessary
      let fetchUrl = url.trim();
      if (fetchUrl.includes('docs.google.com/spreadsheets/d/')) {
        if (!fetchUrl.includes('pub?output=csv') && !fetchUrl.includes('/export?format=csv')) {
          const match = fetchUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
          if (match && match[1]) {
            const sheetId = match[1];
            fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
          }
        }
      }

      const response = await fetch(fetchUrl);
      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
      }

      const csvText = await response.text();
      res.json({ status: 'sucesso', csvText });
    } catch (err: any) {
      res.status(500).json({
        status: 'erro',
        mensagem: `Falha ao carregar a planilha do link: ${err.message}. Verifique se a planilha do Google Sheets está configurada como pública ou "Publicada na Web".`,
      });
    }
  });

  // --- VITE / SERVING FRONTEND ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
