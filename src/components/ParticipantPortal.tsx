import React, { useState, useEffect } from 'react';
import { Ingresso } from '../types';
import { formatCPF, unformatCPF } from '../utils/cpf';
import { generateQRCodeDataUrl } from '../utils/qrcode';
import {
  User,
  ShieldCheck,
  Calendar,
  Download,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Clock,
  QrCode,
  Search,
} from 'lucide-react';

interface ParticipantPortalProps {
  user: Ingresso | null;
  onLoginSuccess: (user: Ingresso, isAdmin: boolean) => void;
  onLogout: () => void;
  onValidateUUIDDirectly?: (uuid: string) => void;
}

export const ParticipantPortal: React.FC<ParticipantPortalProps> = ({
  user,
  onLoginSuccess,
  onLogout,
}) => {
  const [cpfInput, setCpfInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // QR Code Data URLs generated for Saturday and Sunday
  const [qrSabadoUrl, setQrSabadoUrl] = useState<string>('');
  const [qrDomingoUrl, setQrDomingoUrl] = useState<string>('');

  // Generate QR Code images if user is logged in
  useEffect(() => {
    if (user) {
      const loadQRs = async () => {
        if ((user.tipo === 1 || user.tipo === 3) && user.uuid_dia1) {
          const sabadoData = await generateQRCodeDataUrl(user.uuid_dia1);
          setQrSabadoUrl(sabadoData);
        } else {
          setQrSabadoUrl('');
        }
        if ((user.tipo === 2 || user.tipo === 3) && user.uuid_dia2) {
          const domingoData = await generateQRCodeDataUrl(user.uuid_dia2);
          setQrDomingoUrl(domingoData);
        } else {
          setQrDomingoUrl('');
        }
      };
      loadQRs();
    } else {
      setQrSabadoUrl('');
      setQrDomingoUrl('');
    }
  }, [user]);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setCpfInput(formatted);
    setErrorMsg(null);
  };

  const handleLoginWithCPF = async (targetCpf?: string) => {
    const cpfToSearch = targetCpf || cpfInput;
    const cleanDigits = unformatCPF(cpfToSearch);

    if (cleanDigits.length < 11) {
      setErrorMsg('Por favor, informe os 11 dígitos do seu CPF.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/cpf-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cleanDigits }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.mensagem || 'CPF não encontrado ou não autorizado.');
        setLoading(false);
        return;
      }

      const loggedUser: Ingresso = data.ingresso;
      const isAdmin = !!data.isAdmin;
      onLoginSuccess(loggedUser, isAdmin);
    } catch (err: any) {
      setErrorMsg('Erro ao conectar ao servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = (dataUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };


  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {!user ? (
        /* LOGIN FORM */
        <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-6 text-white text-center">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm border border-white/20">
              <QrCode className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold">Portal de Acesso ao Evento</h2>
            <p className="text-xs text-indigo-200 mt-1">
              Informe o seu CPF para acessar seus ingressos ou o leitor de QR Codes.
            </p>
          </div>

          <div className="p-6 space-y-5">
            {errorMsg && (
              <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-xl text-xs">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">{errorMsg}</div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLoginWithCPF();
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="cpf-input" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Informe o seu CPF:
                </label>
                <div className="relative">
                  <input
                    id="cpf-input"
                    type="text"
                    value={cpfInput}
                    onChange={handleCpfChange}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm font-mono tracking-wider transition-all"
                  />
                  <User className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-500" />
                </div>
              </div>

              <button
                id="btn-login-cpf"
                type="submit"
                disabled={loading || unformatCPF(cpfInput).length < 11}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Entrar / Acessar Sistema</span>
                  </>
                )}
              </button>
            </form>

            {/* BOTÃO PROGRAMAÇÃO */}
            <div className="pt-4 border-t border-slate-800">
              <a
                href="https://drive.google.com/file/d/1xQEy0MQUoilag5Th7_CvUpEUZaA6JkxM/view?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-semibold py-3 rounded-xl transition-all text-sm"
              >
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>Acesse a Programação</span>
              </a>
            </div>
          </div>
        </div>
      ) : (
        /* PARTICIPANT DASHBOARD & QR CODE DISPLAY */
        <div className="space-y-6">
          {/* USER INFO BAR */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md shrink-0">
                {user.nome.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-white">{user.nome}</h2>
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <ShieldCheck className="w-3.5 h-3.5" /> {user.situacao}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  CPF: {formatCPF(user.cpf)} • {user.email} • {user.telefone}
                </p>
                <div className="mt-2 text-xs font-semibold text-indigo-300 bg-indigo-950/60 border border-indigo-800/50 px-3 py-1 rounded-lg inline-block">
                  Tipo de Ingresso:{' '}
                  {user.tipo === 1
                    ? '1 - QR Code Sábado (Dia 1)'
                    : user.tipo === 2
                    ? '2 - QR Code Domingo (Dia 2)'
                    : '3 - Passaporte (Sábado e Domingo)'}
                </div>
              </div>
            </div>

            <button
              id="btn-logout"
              onClick={onLogout}
              className="self-start md:self-center flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-xs font-medium transition-all border border-slate-700"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair / Trocar Conta</span>
            </button>
          </div>

          {/* QR CODES DISPLAY SECTION */}
          <div>
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-indigo-400" />
              <span>Seus QR Codes de Acesso</span>
            </h3>

            {/* Check if user has any active QR Code available */}
            {(!user.uuid_dia1 && !user.uuid_dia2) ? (
              <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-8 text-center space-y-3">
                <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
                <h4 className="text-lg font-bold text-white">Nenhum QR Code disponível no momento</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Os seus dados foram localizados, porém os ingressos para os dias do evento ainda estão sendo processados ou a situação não foi liberada. Entre em contato com a organização do evento.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* SÁBADO QR CODE CARD (if Tipo 1 or Tipo 3) */}
                {(user.tipo === 1 || user.tipo === 3) && user.uuid_dia1 && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                        Sábado (Dia 1)
                      </span>
                      <Calendar className="w-4 h-4" />
                    </div>
                    <h4 className="text-lg font-bold mt-2">Acesso Sábado</h4>
                    <p className="text-xs text-blue-100">Apresente este QR Code na portaria de Sábado</p>
                  </div>

                  <div className="p-6 text-center space-y-4 flex-1 flex flex-col justify-center items-center">
                    {qrSabadoUrl ? (
                      <div className="bg-white p-4 rounded-2xl shadow-inner border border-slate-200 max-w-[220px]">
                        <img
                          src={qrSabadoUrl}
                          alt="QR Code Sábado"
                          className="w-full h-auto rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="w-48 h-48 bg-slate-800 rounded-2xl animate-pulse flex items-center justify-center text-slate-500 text-xs">
                        Gerando QR Code...
                      </div>
                    )}

                    <div className="space-y-1">
                      <p className="text-xs text-slate-400">UUID do Ingresso (Sábado):</p>
                      <p className="font-mono text-sm font-bold text-indigo-300 bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg">
                        {user.uuid_dia1 || '—'}
                      </p>
                    </div>

                    {/* Check-in Status */}
                    <div className="w-full pt-2">
                      {user.dia1 ? (
                        <div className="flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-2.5 rounded-xl text-xs font-medium">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Check-in realizado em {user.dia1}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 p-2.5 rounded-xl text-xs font-medium">
                          <Clock className="w-4 h-4 shrink-0" />
                          <span>Aguardando Entrada no Sábado</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {qrSabadoUrl && (
                    <div className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2">
                      <button
                        id="btn-download-sabado"
                        onClick={() => downloadQR(qrSabadoUrl, `qrcode-sabado-${user.cpf}.png`)}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        <span>Baixar QR Code Sábado</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* DOMINGO QR CODE CARD (if Tipo 2 or Tipo 3) */}
              {(user.tipo === 2 || user.tipo === 3) && user.uuid_dia2 && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between">
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 text-white">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                        Domingo (Dia 2)
                      </span>
                      <Calendar className="w-4 h-4" />
                    </div>
                    <h4 className="text-lg font-bold mt-2">Acesso Domingo</h4>
                    <p className="text-xs text-purple-100">Apresente este QR Code na portaria de Domingo</p>
                  </div>

                  <div className="p-6 text-center space-y-4 flex-1 flex flex-col justify-center items-center">
                    {qrDomingoUrl ? (
                      <div className="bg-white p-4 rounded-2xl shadow-inner border border-slate-200 max-w-[220px]">
                        <img
                          src={qrDomingoUrl}
                          alt="QR Code Domingo"
                          className="w-full h-auto rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="w-48 h-48 bg-slate-800 rounded-2xl animate-pulse flex items-center justify-center text-slate-500 text-xs">
                        Gerando QR Code...
                      </div>
                    )}

                    <div className="space-y-1">
                      <p className="text-xs text-slate-400">UUID do Ingresso (Domingo):</p>
                      <p className="font-mono text-sm font-bold text-purple-300 bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg">
                        {user.uuid_dia2 || '—'}
                      </p>
                    </div>

                    {/* Check-in Status */}
                    <div className="w-full pt-2">
                      {user.dia2 ? (
                        <div className="flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-2.5 rounded-xl text-xs font-medium">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Check-in realizado em {user.dia2}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 p-2.5 rounded-xl text-xs font-medium">
                          <Clock className="w-4 h-4 shrink-0" />
                          <span>Aguardando Entrada no Domingo</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {qrDomingoUrl && (
                    <div className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2">
                      <button
                        id="btn-download-domingo"
                        onClick={() => downloadQR(qrDomingoUrl, `qrcode-domingo-${user.cpf}.png`)}
                        className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        <span>Baixar QR Code Domingo</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
