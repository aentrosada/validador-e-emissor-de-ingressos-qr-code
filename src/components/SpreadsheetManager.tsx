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
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  QrCode,
  FileSpreadsheet,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface SpreadsheetManagerProps {
  ingressos: Ingresso[];
  onUpdateIngressos: (newList: Ingresso[]) => void;
  onRefreshData: () => void;
}

// Simple UUID v4 generator for frontend use
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRow, setNewRow] = useState<Partial<Ingresso>>({
    nome: '', email: '', telefone: '', cpf: '', tipo: 3, situacao: 'LIBERADO',
  });

  // QR Preview modal
  const [previewUser, setPreviewUser] = useState<Ingresso | null>(null);
  const [previewQrDia1, setPreviewQrDia1] = useState<string>('');
  const [previewQrDia2, setPreviewQrDia2] = useState<string>('');

  const filteredList = ingressos.filter((item) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      item.nome.toLowerCase().includes(s) ||
      item.cpf.includes(s) ||
      item.email.toLowerCase().includes(s) ||
      (item.uuid_dia1 || '').toLowerCase().includes(s) ||
      (item.uuid_dia2 || '').toLowerCase().includes(s);
    const matchesSituacao = filterSituacao === 'todos' ? true
      : filterSituacao === 'LIBERADO' ? (item.situacao || '').toUpperCase() === 'LIBERADO'
      : (item.situacao || '').toUpperCase() !== 'LIBERADO';
    const matchesTipo = filterTipo === 'todos' ? true : String(item.tipo) === filterTipo;
    return matchesSearch && matchesSituacao && matchesTipo;
  });

  // Parse CSV — accepts: Nome, Email, Telefone, CPF, Tipo, Situacao (UUIDs opcionais)
  const parseCsvRowsToIngressos = (rows: any[]): Ingresso[] => {
    return rows.map((row, idx) => {
      const findKey = (key: string) => {
        const found = Object.keys(row).find(k => k.trim().toUpperCase() === key.toUpperCase());
        return found ? row[found] : '';
      };
      const nome = findKey('NOME') || findKey('NOME COMPLETO') || `Participante ${idx + 1}`;
      const email = findKey('E-MAIL') || findKey('EMAIL') || '';
      const telefone = findKey('TELEFONE') || findKey('CELULAR') || '';
      const cpf = unformatCPF(findKey('CPF') || '');
      const tipoRaw = parseInt(findKey('TIPO') || '3', 10);
      const tipo: TipoIngresso = [1, 2, 3].includes(tipoRaw) ? (tipoRaw as TipoIngresso) : 3;
      const situacao = (findKey('SITUACAO') || findKey('SITUACAO') || findKey('SITUACAO') || 'LIBERADO').trim();
      const dia1 = findKey('DIA 1') || findKey('DIA_1') || '';
      const dia2 = findKey('DIA 2') || findKey('DIA_2') || '';

      // Accept pre-existing UUIDs from export; otherwise leave blank (server will generate)
      const uuid_dia1 = (findKey('UUID_DIA1') || findKey('UUID DIA1') || findKey('UUID SAB') || '').trim() || undefined;
      const uuid_dia2 = (findKey('UUID_DIA2') || findKey('UUID DIA2') || findKey('UUID DOM') || '').trim() || undefined;

      return { id: String(idx + 1), nome, email, telefone, cpf, tipo, situacao, uuid_dia1, uuid_dia2, dia1, dia2 };
    });
  };

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
      if (!res.ok) throw new Error(data.mensagem || 'Falha ao buscar planilha.');
      Papa.parse(data.csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsed = parseCsvRowsToIngressos(results.data);
          if (parsed.length === 0) {
            setSyncMessage({ text: 'Nenhuma linha valida encontrada.', isError: true });
          } else {
            onUpdateIngressos(parsed);
            setSyncMessage({ text: `Sucesso: ${parsed.length} linhas importadas! UUIDs de QR Code gerados automaticamente.` });
          }
        },
        error: (err: any) => setSyncMessage({ text: `Erro CSV: ${err.message}`, isError: true }),
      });
    } catch (err: any) {
      setSyncMessage({ text: err.message || 'Erro ao carregar planilha.', isError: true });
    } finally {
      setLoadingSheets(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = parseCsvRowsToIngressos(results.data);
        if (parsed.length > 0) {
          onUpdateIngressos(parsed);
          setSyncMessage({ text: `Sucesso: ${parsed.length} registros importados! UUIDs gerados automaticamente.` });
        } else {
          setSyncMessage({ text: 'Formato invalido. Use as colunas: Nome, Email, Telefone, CPF, Tipo, Situacao', isError: true });
        }
      },
    });
  };

  const handleExportCSV = () => {
    const csvRows = ingressos.map((item) => ({
      NOME: item.nome,
      'E-MAIL': item.email,
      TELEFONE: item.telefone,
      CPF: item.cpf,
      TIPO: item.tipo,
      SITUACAO: item.situacao,
      UUID_DIA1: item.uuid_dia1 || '',
      UUID_DIA2: item.uuid_dia2 || '',
      'DIA 1': item.dia1 || '',
      'DIA 2': item.dia2 || '',
    }));
    const csvString = Papa.unparse(csvRows);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ingressos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const handleCreateNewRow = () => {
    if (!newRow.nome || !newRow.cpf) { alert('Nome e CPF sao obrigatorios.'); return; }
    const tipo = (newRow.tipo as TipoIngresso) || 3;
    const created: Ingresso = {
      id: String(Date.now()),
      nome: newRow.nome || '',
      email: newRow.email || '',
      telefone: newRow.telefone || '',
      cpf: unformatCPF(newRow.cpf || ''),
      tipo,
      situacao: newRow.situacao || 'LIBERADO',
      uuid_dia1: (tipo === 1 || tipo === 3) ? generateUUID() : undefined,
      uuid_dia2: (tipo === 2 || tipo === 3) ? generateUUID() : undefined,
      dia1: '',
      dia2: '',
    };
    onUpdateIngressos([...ingressos, created]);
    setShowAddModal(false);
    setNewRow({ nome: '', email: '', telefone: '', cpf: '', tipo: 3, situacao: 'LIBERADO' });
  };

  const handleResetCheckinRow = (id: string) => {
    onUpdateIngressos(ingressos.map(x => x.id === id ? { ...x, dia1: '', dia2: '' } : x));
  };

  const handleDeleteRow = (id: string) => {
    if (confirm('Excluir este ingresso?')) {
      onUpdateIngressos(ingressos.filter(x => x.id !== id));
    }
  };

  const openQRPreview = async (item: Ingresso) => {
    setPreviewUser(item);
    setPreviewQrDia1('');
    setPreviewQrDia2('');
    if (item.uuid_dia1) {
      const url1 = await generateQRCodeDataUrl(item.uuid_dia1);
      setPreviewQrDia1(url1);
    }
    if (item.uuid_dia2) {
      const url2 = await generateQRCodeDataUrl(item.uuid_dia2);
      setPreviewQrDia2(url2);
    }
  };

  const totalLiberados = ingressos.filter(x => (x.situacao || '').toUpperCase() === 'LIBERADO').length;
  const totalCheckinDia1 = ingressos.filter(x => x.dia1 && x.dia1.trim() !== '').length;
  const totalCheckinDia2 = ingressos.filter(x => x.dia2 && x.dia2.trim() !== '').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md">
          <p className="text-xs font-semibold text-slate-400">Total de Ingressos</p>
          <p className="text-2xl font-black text-white mt-1">{ingressos.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md">
          <p className="text-xs font-semibold text-slate-400">Situacao LIBERADO</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{totalLiberados}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md">
          <p className="text-xs font-semibold text-slate-400">Entradas Sabado</p>
          <p className="text-2xl font-black text-blue-400 mt-1">{totalCheckinDia1}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md">
          <p className="text-xs font-semibold text-slate-400">Entradas Domingo</p>
          <p className="text-2xl font-black text-purple-400 mt-1">{totalCheckinDia2}</p>
        </div>
      </div>

      {/* IMPORT TOOLBAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Importar Planilha</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Formato aceito: <span className="font-mono text-slate-300">Nome | Email | Telefone | CPF | Tipo | Situacao</span>
              <br />Os UUIDs de QR Code sao gerados automaticamente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="csv-file-upload" className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-700 cursor-pointer transition-all flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-slate-400" />
              <span>Upload CSV</span>
              <input id="csv-file-upload" type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
            <button onClick={handleExportCSV} className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5">
              <Download className="w-4 h-4" />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={sheetsUrlInput}
              onChange={(e) => setSheetsUrlInput(e.target.value)}
              placeholder="Cole a URL publica do Google Sheets (ex: https://docs.google.com/spreadsheets/d/.../pub?output=csv)"
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
            {loadingSheets ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            <span>Carregar Planilha</span>
          </button>
        </div>

        {syncMessage && (
          <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            syncMessage.isError
              ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
              : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
          }`}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{syncMessage.text}</span>
          </div>
        )}
      </div>

      {/* TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
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
            <select value={filterSituacao} onChange={(e) => setFilterSituacao(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300">
              <option value="todos">Todas Situacoes</option>
              <option value="LIBERADO">LIBERADO</option>
              <option value="OUTROS">Outros</option>
            </select>
            <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300">
              <option value="todos">Todos Tipos</option>
              <option value="1">Tipo 1 (Sabado)</option>
              <option value="2">Tipo 2 (Domingo)</option>
              <option value="3">Tipo 3 (Passaporte)</option>
            </select>
          </div>
          <button onClick={() => setShowAddModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span>Novo Ingresso</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">E-mail</th>
                <th className="py-3 px-4">Telefone</th>
                <th className="py-3 px-4">CPF</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Situacao</th>
                <th className="py-3 px-4">QR Sab</th>
                <th className="py-3 px-4">QR Dom</th>
                <th className="py-3 px-4">Dia 1</th>
                <th className="py-3 px-4">Dia 2</th>
                <th className="py-3 px-4 text-center">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500 font-sans">
                    Nenhum ingresso encontrado.
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => {
                  const isLiberado = (item.situacao || '').toUpperCase() === 'LIBERADO';
                  const needsDia1 = item.tipo === 1 || item.tipo === 3;
                  const needsDia2 = item.tipo === 2 || item.tipo === 3;
                  const hasQrDia1 = !!item.uuid_dia1;
                  const hasQrDia2 = !!item.uuid_dia2;

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white font-sans">{item.nome}</td>
                      <td className="py-3 px-4 text-slate-400">{item.email}</td>
                      <td className="py-3 px-4 text-slate-400">{item.telefone}</td>
                      <td className="py-3 px-4 font-semibold text-slate-200">{formatCPF(item.cpf)}</td>
                      <td className="py-3 px-4">
                        <span className="font-sans text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {item.tipo === 1 ? '1 (Sab)' : item.tipo === 2 ? '2 (Dom)' : '3 (Pass)'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isLiberado
                          ? <span className="font-sans text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">LIBERADO</span>
                          : <span className="font-sans text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">{item.situacao || 'PENDENTE'}</span>
                        }
                      </td>
                      <td className="py-3 px-4 text-center">
                        {needsDia1
                          ? hasQrDia1
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" title={item.uuid_dia1} />
                            : <XCircle className="w-4 h-4 text-rose-400 mx-auto" title="UUID nao gerado" />
                          : <span className="text-slate-600">—</span>
                        }
                      </td>
                      <td className="py-3 px-4 text-center">
                        {needsDia2
                          ? hasQrDia2
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" title={item.uuid_dia2} />
                            : <XCircle className="w-4 h-4 text-rose-400 mx-auto" title="UUID nao gerado" />
                          : <span className="text-slate-600">—</span>
                        }
                      </td>
                      <td className="py-3 px-4">
                        {item.dia1 ? <span className="text-emerald-400 font-semibold">{item.dia1}</span> : <span className="text-slate-600 italic font-sans">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        {item.dia2 ? <span className="text-purple-400 font-semibold">{item.dia2}</span> : <span className="text-slate-600 italic font-sans">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openQRPreview(item)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400" title="Ver QR Code">
                            <QrCode className="w-4 h-4" />
                          </button>
                          {(item.dia1 || item.dia2) && (
                            <button onClick={() => handleResetCheckinRow(item.id)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-amber-400" title="Resetar Check-ins">
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => handleDeleteRow(item.id)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400" title="Excluir Ingresso">
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

      {/* MODAL NOVO INGRESSO */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Adicionar Novo Ingresso</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nome Completo:</label>
                <input type="text" value={newRow.nome} onChange={(e) => setNewRow({ ...newRow, nome: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">E-mail:</label>
                  <input type="email" value={newRow.email} onChange={(e) => setNewRow({ ...newRow, email: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Telefone:</label>
                  <input type="text" value={newRow.telefone} onChange={(e) => setNewRow({ ...newRow, telefone: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">CPF:</label>
                  <input type="text" value={newRow.cpf} onChange={(e) => setNewRow({ ...newRow, cpf: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Tipo de Ingresso:</label>
                  <select value={newRow.tipo} onChange={(e) => setNewRow({ ...newRow, tipo: Number(e.target.value) as TipoIngresso })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white">
                    <option value={1}>1 = Sabado</option>
                    <option value={2}>2 = Domingo</option>
                    <option value={3}>3 = Passaporte (Sab + Dom)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Situacao:</label>
                <select value={newRow.situacao} onChange={(e) => setNewRow({ ...newRow, situacao: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white">
                  <option value="LIBERADO">LIBERADO</option>
                  <option value="PENDENTE">PENDENTE</option>
                  <option value="CANCELADO">CANCELADO</option>
                </select>
              </div>
              <p className="text-slate-500 text-[11px]">* Os UUIDs de QR Code serao gerados automaticamente.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddModal(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2 rounded-xl">Cancelar</button>
              <button onClick={handleCreateNewRow} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl">Salvar Ingresso</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL QR PREVIEW */}
      {previewUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-center space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">QR Codes de {previewUser.nome}</h3>
            <div className={`grid gap-4 ${(previewQrDia1 && previewQrDia2) ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {previewQrDia1 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-blue-300">Sabado (Dia 1)</p>
                  <div className="bg-white p-3 rounded-xl inline-block border border-slate-200">
                    <img src={previewQrDia1} alt="QR Sabado" className="w-40 h-40 mx-auto" />
                  </div>
                  <p className="text-[10px] font-mono text-indigo-300 bg-slate-950 p-1.5 rounded break-all">{previewUser.uuid_dia1}</p>
                </div>
              )}
              {previewQrDia2 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-purple-300">Domingo (Dia 2)</p>
                  <div className="bg-white p-3 rounded-xl inline-block border border-slate-200">
                    <img src={previewQrDia2} alt="QR Domingo" className="w-40 h-40 mx-auto" />
                  </div>
                  <p className="text-[10px] font-mono text-purple-300 bg-slate-950 p-1.5 rounded break-all">{previewUser.uuid_dia2}</p>
                </div>
              )}
              {!previewQrDia1 && !previewQrDia2 && (
                <p className="text-xs text-slate-500">Gerando QR Codes...</p>
              )}
            </div>
            <button onClick={() => { setPreviewUser(null); setPreviewQrDia1(''); setPreviewQrDia2(''); }} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 rounded-xl">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
