import React, { useState } from 'react';
import Papa from 'papaparse';
import { Ingresso, TipoIngresso } from '../types';
import { formatCPF, unformatCPF } from '../utils/cpf';
import { generateQRCodeDataUrl } from '../utils/qrcode';
import {
  Table,
  Upload,
  Link,
  Download,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  QrCode,
  Edit3,
  FileSpreadsheet,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface SpreadsheetManagerProps {
  ingressos: Ingresso[];
  onUpdateIngressos: (newList: Ingresso[]) => void;
  onRefreshData: () => void;
}

export const SpreadsheetManager: React.FC<SpreadsheetManagerProps> = ({
  ingressos,
  onUpdateIngressos,
  onRefreshData,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSituacao, setFilterSituacao] = useState<string>('todos');
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [sheetsUrlInput, setSheetsUrlInput] = useState('');
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Modal for adding a new ticket manually
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRow, setNewRow] = useState<Partial<Ingresso>>({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    tipo: 3,
    situacao: 'LIBERADO',
    uuid: `id-${Math.random().toString(36).substring(2, 9)}`,
    dia1: '',
    dia2: '',
  });

  // Modal for previewing QR code
  const [previewUser, setPreviewUser] = useState<Ingresso | null>(null);
  const [previewQrUrl, setPreviewQrUrl] = useState<string>('');

  // Filtering
  const filteredList = ingressos.filter((item) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      item.nome.toLowerCase().includes(searchLower) ||
      item.cpf.includes(searchLower) ||
      item.email.toLowerCase().includes(searchLower) ||
      item.uuid.toLowerCase().includes(searchLower);

    const matchesSituacao =
      filterSituacao === 'todos'
        ? true
        : filterSituacao === 'LIBERADO'
        ? (item.situacao || '').toUpperCase() === 'LIBERADO'
        : (item.situacao || '').toUpperCase() !== 'LIBERADO';

    const matchesTipo =
      filterTipo === 'todos' ? true : String(item.tipo) === filterTipo;

    return matchesSearch && matchesSituacao && matchesTipo;
  });

  // Load Google Sheets via public CSV endpoint or published URL
  const handleFetchGoogleSheets = async () => {
    if (!sheetsUrlInput.trim()) return;

    setLoadingSheets(true);
    setSyncMessage(null);

    try {
      const res = await fetch('/api/fetch-sheets-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sheetsUrlInput }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.mensagem || 'Falha ao buscar planilha.');
      }

      // Parse CSV text with PapaParse
      Papa.parse(data.csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsedIngressos = parseCsvRowsToIngressos(results.data);
          if (parsedIngressos.length === 0) {
            setSyncMessage({
              text: 'Nenhuma linha válida encontrada na planilha importada.',
              isError: true,
            });
          } else {
            onUpdateIngressos(parsedIngressos);
            setSyncMessage({
              text: `Sucesso: ${parsedIngressos.length} linhas importadas da planilha do Google Sheets!`,
            });
          }
        },
        error: (err: any) => {
          setSyncMessage({
            text: `Erro ao interpretar CSV: ${err.message}`,
            isError: true,
          });
        },
      });
    } catch (err: any) {
      setSyncMessage({
        text: err.message || 'Erro ao carregar link da planilha.',
        isError: true,
      });
    } finally {
      setLoadingSheets(false);
    }
  };

  // Local File Upload (.csv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedIngressos = parseCsvRowsToIngressos(results.data);
        if (parsedIngressos.length > 0) {
          onUpdateIngressos(parsedIngressos);
          setSyncMessage({
            text: `Sucesso: ${parsedIngressos.length} registros importados do arquivo CSV!`,
          });
        } else {
          setSyncMessage({
            text: 'Formato CSV incompatível. Certifique-se das colunas NOME, E-MAIL, TELEFONE, CPF, TIPO, SITUAÇÃO, UUID, DIA 1, DIA 2.',
            isError: true,
          });
        }
      },
    });
  };

  // Helper to normalize CSV headers and rows
  const parseCsvRowsToIngressos = (rows: any[]): Ingresso[] => {
    return rows.map((row, idx) => {
      // Find column names case-insensitively
      const findKey = (key: string) => {
        const found = Object.keys(row).find((k) => k.trim().toUpperCase() === key.toUpperCase());
        return found ? row[found] : '';
      };

      const nome = findKey('NOME') || findKey('NOME COMPLETO') || `Participante ${idx + 1}`;
      const email = findKey('E-MAIL') || findKey('EMAIL') || '';
      const telefone = findKey('TELEFONE') || findKey('CELULAR') || '';
      const cpf = unformatCPF(findKey('CPF') || '');
      const tipoRaw = parseInt(findKey('TIPO') || '3', 10);
      const tipo: TipoIngresso = [1, 2, 3].includes(tipoRaw) ? (tipoRaw as TipoIngresso) : 3;
      const situacao = (findKey('SITUAÇÃO') || findKey('SITUACAO') || 'LIBERADO').trim();
      const uuid = (findKey('UUID') || findKey('ID_INGRESSO') || `id-${Math.random().toString(36).substring(2, 9)}`).trim();
      const dia1 = findKey('DIA 1') || findKey('DIA_1') || findKey('CHECKIN_DIA_1') || '';
      const dia2 = findKey('DIA 2') || findKey('DIA_2') || findKey('CHECKIN_DIA_2') || '';

      return {
        id: String(idx + 1),
        nome,
        email,
        telefone,
        cpf,
        tipo,
        situacao,
        uuid,
        dia1,
        dia2,
      };
    });
  };

  // Export current list to CSV file
  const handleExportCSV = () => {
    const csvRows = ingressos.map((item) => ({
      NOME: item.nome,
      'E-MAIL': item.email,
      TELEFONE: item.telefone,
      CPF: item.cpf,
      TIPO: item.tipo,
      SITUAÇÃO: item.situacao,
      UUID: item.uuid,
      'DIA 1': item.dia1 || '',
      'DIA 2': item.dia2 || '',
    }));

    const csvString = Papa.unparse(csvRows);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ingressos_evento_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // Add new ticket submit
  const handleCreateNewRow = () => {
    if (!newRow.nome || !newRow.cpf) {
      alert('Nome e CPF são obrigatórios.');
      return;
    }

    const created: Ingresso = {
      id: String(Date.now()),
      nome: newRow.nome || '',
      email: newRow.email || '',
      telefone: newRow.telefone || '',
      cpf: unformatCPF(newRow.cpf || ''),
      tipo: (newRow.tipo as TipoIngresso) || 3,
      situacao: newRow.situacao || 'LIBERADO',
      uuid: newRow.uuid || `id-${Math.random().toString(36).substring(2, 8)}`,
      dia1: '',
      dia2: '',
    };

    onUpdateIngressos([...ingressos, created]);
    setShowAddModal(false);
    setNewRow({
      nome: '',
      email: '',
      telefone: '',
      cpf: '',
      tipo: 3,
      situacao: 'LIBERADO',
      uuid: `id-${Math.random().toString(36).substring(2, 9)}`,
      dia1: '',
      dia2: '',
    });
  };

  // Reset Checkin for a specific row
  const handleResetCheckinRow = (id: string) => {
    const updated = ingressos.map((x) => (x.id === id ? { ...x, dia1: '', dia2: '' } : x));
    onUpdateIngressos(updated);
  };

  // Delete row
  const handleDeleteRow = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este ingresso?')) {
      onUpdateIngressos(ingressos.filter((x) => x.id !== id));
    }
  };

  // Open QR code preview modal
  const openQRPreview = async (item: Ingresso) => {
    setPreviewUser(item);
    if (item.uuid) {
      const url = await generateQRCodeDataUrl(item.uuid);
      setPreviewQrUrl(url);
    }
  };

  // Stats
  const totalLiberados = ingressos.filter((x) => (x.situacao || '').toUpperCase() === 'LIBERADO').length;
  const totalCheckinDia1 = ingressos.filter((x) => x.dia1 && x.dia1.trim() !== '').length;
  const totalCheckinDia2 = ingressos.filter((x) => x.dia2 && x.dia2.trim() !== '').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md">
          <p className="text-xs font-semibold text-slate-400">Total de Ingressos</p>
          <p className="text-2xl font-black text-white mt-1">{ingressos.length}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md">
          <p className="text-xs font-semibold text-slate-400">Situação LIBERADO</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{totalLiberados}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md">
          <p className="text-xs font-semibold text-slate-400">Entradas Sábado (Dia 1)</p>
          <p className="text-2xl font-black text-blue-400 mt-1">{totalCheckinDia1}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md">
          <p className="text-xs font-semibold text-slate-400">Entradas Domingo (Dia 2)</p>
          <p className="text-2xl font-black text-purple-400 mt-1">{totalCheckinDia2}</p>
        </div>
      </div>

      {/* IMPORT & SYNC GOOGLE SHEETS TOOLBAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Sincronizar com Planilha do Google Sheets ou CSV</span>
            </h3>
            <p className="text-xs text-slate-400">
              Cole o link público da sua planilha do Google Sheets (ex: "Publicar na Web" em formato CSV) ou envie um arquivo .csv.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* File Upload Button */}
            <label
              htmlFor="csv-file-upload"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-700 cursor-pointer transition-all flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4 text-slate-400" />
              <span>Upload CSV</span>
              <input
                id="csv-file-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Export CSV Button */}
            <button
              id="btn-export-csv"
              onClick={handleExportCSV}
              className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Baixar CSV</span>
            </button>
          </div>
        </div>

        {/* GOOGLE SHEETS LINK INPUT */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={sheetsUrlInput}
              onChange={(e) => setSheetsUrlInput(e.target.value)}
              placeholder="Cole a URL pública do Google Sheets (ex: https://docs.google.com/spreadsheets/d/.../pub?output=csv)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500"
            />
            <Link className="absolute right-3.5 top-3 w-4 h-4 text-slate-600" />
          </div>

          <button
            id="btn-sync-sheets"
            onClick={handleFetchGoogleSheets}
            disabled={loadingSheets || !sheetsUrlInput.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shrink-0"
          >
            {loadingSheets ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4" />
            )}
            <span>Carregar Planilha</span>
          </button>
        </div>

        {syncMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              syncMessage.isError
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{syncMessage.text}</span>
          </div>
        )}
      </div>

      {/* SPREADSHEET DATA TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* TABLE SEARCH & FILTER HEADER */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full md:w-auto flex-1">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por Nome, CPF, Email ou UUID..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            </div>

            <select
              value={filterSituacao}
              onChange={(e) => setFilterSituacao(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300"
            >
              <option value="todos">Todas Situações</option>
              <option value="LIBERADO">Apenas LIBERADO</option>
              <option value="OUTROS">Bloqueado / Pendente</option>
            </select>

            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300"
            >
              <option value="todos">Todos Tipos</option>
              <option value="1">Tipo 1 (Sábado)</option>
              <option value="2">Tipo 2 (Domingo)</option>
              <option value="3">Tipo 3 (Passaporte)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              id="btn-add-ticket-modal"
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Ingresso</span>
            </button>
          </div>
        </div>

        {/* TABLE CONTENT */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">E-mail</th>
                <th className="py-3 px-4">Telefone</th>
                <th className="py-3 px-4">CPF</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Situação</th>
                <th className="py-3 px-4">UUID</th>
                <th className="py-3 px-4">Dia 1 (Sábado)</th>
                <th className="py-3 px-4">Dia 2 (Domingo)</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500 font-sans">
                    Nenhum ingresso encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => {
                  const isLiberado = (item.situacao || '').trim().toUpperCase() === 'LIBERADO';

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white font-sans">{item.nome}</td>
                      <td className="py-3 px-4 text-slate-400">{item.email}</td>
                      <td className="py-3 px-4 text-slate-400">{item.telefone}</td>
                      <td className="py-3 px-4 font-semibold text-slate-200">{formatCPF(item.cpf)}</td>
                      <td className="py-3 px-4">
                        <span className="font-sans text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {item.tipo === 1 ? '1 (Sábado)' : item.tipo === 2 ? '2 (Domingo)' : '3 (Passaporte)'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isLiberado ? (
                          <span className="font-sans text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            LIBERADO
                          </span>
                        ) : (
                          <span className="font-sans text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            {item.situacao || 'PENDENTE'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-bold">{item.uuid}</td>
                      <td className="py-3 px-4">
                        {item.dia1 ? (
                          <span className="text-emerald-400 font-semibold">{item.dia1}</span>
                        ) : (
                          <span className="text-slate-600 italic font-sans">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {item.dia2 ? (
                          <span className="text-purple-400 font-semibold">{item.dia2}</span>
                        ) : (
                          <span className="text-slate-600 italic font-sans">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openQRPreview(item)}
                            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400"
                            title="Ver QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          {(item.dia1 || item.dia2) && (
                            <button
                              onClick={() => handleResetCheckinRow(item.id)}
                              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-amber-400"
                              title="Resetar Check-ins"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteRow(item.id)}
                            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400"
                            title="Excluir Ingresso"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL FOR ADDING NEW ROW */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Adicionar Novo Ingresso</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nome Completo:</label>
                <input
                  type="text"
                  value={newRow.nome}
                  onChange={(e) => setNewRow({ ...newRow, nome: e.target.value })}
                  placeholder="Ex: Ronaldo Fenomeno"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">E-mail:</label>
                  <input
                    type="email"
                    value={newRow.email}
                    onChange={(e) => setNewRow({ ...newRow, email: e.target.value })}
                    placeholder="email@exemplo.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Telefone:</label>
                  <input
                    type="text"
                    value={newRow.telefone}
                    onChange={(e) => setNewRow({ ...newRow, telefone: e.target.value })}
                    placeholder="5514998780239"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">CPF:</label>
                  <input
                    type="text"
                    value={newRow.cpf}
                    onChange={(e) => setNewRow({ ...newRow, cpf: e.target.value })}
                    placeholder="39784759875"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">UUID / ID Ingressos:</label>
                  <input
                    type="text"
                    value={newRow.uuid}
                    onChange={(e) => setNewRow({ ...newRow, uuid: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Tipo de Ingresso:</label>
                  <select
                    value={newRow.tipo}
                    onChange={(e) => setNewRow({ ...newRow, tipo: Number(e.target.value) as TipoIngresso })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value={1}>1 = Sábado</option>
                    <option value={2}>2 = Domingo</option>
                    <option value={3}>3 = Passaporte (Sáb + Dom)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Situação:</label>
                  <select
                    value={newRow.situacao}
                    onChange={(e) => setNewRow({ ...newRow, situacao: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value="LIBERADO">LIBERADO</option>
                    <option value="PENDENTE">PENDENTE</option>
                    <option value="CANCELADO">CANCELADO</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateNewRow}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl"
              >
                Salvar Ingresso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FOR PREVIEWING QR CODE */}
      {previewUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">QR Code de {previewUser.nome}</h3>

            {previewQrUrl ? (
              <div className="bg-white p-4 rounded-xl inline-block mx-auto border border-slate-200">
                <img src={previewQrUrl} alt="QR Code Preview" className="w-48 h-48 mx-auto" />
              </div>
            ) : (
              <p className="text-xs text-slate-500">Gerando QR Code...</p>
            )}

            <p className="text-xs font-mono text-indigo-300 bg-slate-950 p-2 rounded-lg border border-slate-800">
              UUID: {previewUser.uuid}
            </p>

            <button
              onClick={() => setPreviewUser(null)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 rounded-xl"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
