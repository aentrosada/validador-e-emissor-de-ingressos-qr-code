import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ValidarResponse } from '../types';
import {
  Camera,
  ScanLine,
  CheckCircle2,
  XCircle,
  Calendar,
  Volume2,
  VolumeX,
  Keyboard,
  History,
  Clock,
} from 'lucide-react';

export const PortariaScanner: React.FC = () => {
  const [selectedDia, setSelectedDia] = useState<1 | 2>(1);
  const [scanning, setScanning] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [manualUuid, setManualUuid] = useState('');
  const [validating, setValidating] = useState(false);
  const [scanHistory, setScanHistory] = useState<ValidarResponse[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Popup and cooldown state
  const [popup, setPopup] = useState<{ result: ValidarResponse; visible: boolean } | null>(null);
  const [cooldown, setCooldown] = useState(0); // seconds remaining
  const [scanLocked, setScanLocked] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-reader-viewport';

  // Keep a ref of selectedDia so the html5-qrcode callback always accesses the current day without stale closure
  const selectedDiaRef = useRef<1 | 2>(selectedDia);
  useEffect(() => {
    selectedDiaRef.current = selectedDia;
  }, [selectedDia]);

  // Click on popup closes in 2 seconds from tap
  const handlePopupClick = () => {
    if (!scanLocked && !popup) return;
    // Set timer to close in 2s
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    let remaining = 2;
    setCooldown(remaining);
    cooldownRef.current = setInterval(() => {
      remaining -= 1;
      setCooldown(remaining);
      if (remaining <= 0) {
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        setScanLocked(false);
        setPopup(null);
        setCooldown(0);
        if (scannerRef.current) {
          scannerRef.current.resume().catch(() => {});
        }
      }
    }, 1000);
  };

  const playAudioBeep = (type: 'success' | 'error') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      }
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {}
  };

  const startCooldown = useCallback((totalSeconds: number, popupSeconds: number, result: ValidarResponse) => {
    setScanLocked(true);
    setCooldown(totalSeconds);
    setPopup({ result, visible: true });

    // Hide popup after popupSeconds
    setTimeout(() => {
      setPopup(prev => prev ? { ...prev, visible: false } : null);
    }, popupSeconds * 1000);

    // Countdown tick
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    let remaining = totalSeconds;
    cooldownRef.current = setInterval(() => {
      remaining -= 1;
      setCooldown(remaining);
      if (remaining <= 0) {
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        setScanLocked(false);
        setPopup(null);
        setCooldown(0);
        // Resume scanner
        if (scannerRef.current) {
          scannerRef.current.resume().catch(() => {});
        }
      }
    }, 1000);
  }, []);

  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          setCameras(devices);
          const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('traseira'));
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        }
      })
      .catch(() => {});

    return () => {
      stopScanner();
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startScanner = async () => {
    if (scanning) return;
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerContainerId);
      }
      const cameraIdOrConfig = selectedCameraId || { facingMode: 'environment' };
      await scannerRef.current.start(
        cameraIdOrConfig,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          if (scanLocked) return;
          if (scannerRef.current && scannerRef.current.isScanning) {
            await scannerRef.current.pause(true);
          }
          await handleValidateUUID(decodedText);
        },
        () => {}
      );
      setScanning(true);
    } catch (err: any) {
      alert(`Nao foi possivel acessar a camera: ${err.message || err}`);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (err) {}
    }
    setScanning(false);
  };

  const handleValidateUUID = async (uuidToTest: string) => {
    if (!uuidToTest.trim() || scanLocked) return;
    setValidating(true);

    try {
      const currentDia = selectedDiaRef.current;
      const res = await fetch('/api/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: uuidToTest.trim(), dia: currentDia }),
      });

      const data: ValidarResponse = await res.json();
      setScanHistory(prev => [data, ...prev.slice(0, 19)]);

      if (data.status === 'sucesso') {
        playAudioBeep('success');
        // Popup 10s visivel, 10s total de espera para nova leitura
        startCooldown(10, 10, data);
      } else {
        playAudioBeep('error');
        // Popup 6s visivel, 6s total de espera para nova leitura
        startCooldown(6, 6, data);
      }
    } catch (err: any) {
      const errorObj: ValidarResponse = { status: 'erro', mensagem: 'Erro de comunicação com o servidor.' };
      setScanHistory(prev => [errorObj, ...prev.slice(0, 19)]);
      playAudioBeep('error');
      startCooldown(6, 6, errorObj);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* FULLSCREEN POPUP OVERLAY */}
      {popup && popup.visible && (
        <div 
          onClick={handlePopupClick}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-8 cursor-pointer select-none ${
            popup.result.status === 'sucesso'
              ? 'bg-emerald-950/95'
              : 'bg-rose-950/95'
          }`}
          title="Toque na tela para fechar em 2s"
        >
          <div className="text-center space-y-6 max-w-md">
            {popup.result.status === 'sucesso' ? (
              <CheckCircle2 className="w-28 h-28 text-emerald-400 mx-auto" />
            ) : (
              <XCircle className="w-28 h-28 text-rose-400 mx-auto" />
            )}

            <div>
              <h2 className={`text-4xl font-black tracking-tight ${
                popup.result.status === 'sucesso' ? 'text-emerald-300' : 'text-rose-300'
              }`}>
                {popup.result.status === 'sucesso' ? 'ENTRADA LIBERADA' : 'ENTRADA RECUSADA'}
              </h2>
              <div className="text-lg text-white/90 mt-3 whitespace-pre-line leading-relaxed">
                {popup.result.mensagem.split('**').map((part, idx) => 
                  idx % 2 === 1 ? <strong key={idx} className="font-extrabold text-white underline">{part}</strong> : part
                )}
              </div>
            </div>

            {popup.result.ingresso && (
              <div className={`rounded-2xl p-5 text-left space-y-2 ${
                popup.result.status === 'sucesso'
                  ? 'bg-emerald-900/60 border border-emerald-500/40'
                  : 'bg-rose-900/60 border border-rose-500/40'
              }`}>
                <p className="text-white font-bold text-xl">{popup.result.ingresso.nome}</p>
                <p className="text-white/60 text-sm font-mono">CPF: {popup.result.ingresso.cpf}</p>
                <p className="text-white/60 text-sm">
                  Tipo: {popup.result.ingresso.tipo === 1 ? 'Sabado' : popup.result.ingresso.tipo === 2 ? 'Domingo' : 'Passaporte'}
                </p>
                {popup.result.timestamp && (
                  <p className="text-emerald-300 text-sm font-mono font-bold">Check-in: {popup.result.timestamp}</p>
                )}
              </div>
            )}

            <div className="flex flex-col items-center justify-center gap-1 text-white/60 text-xs">
              <div className="flex items-center gap-1.5 font-medium">
                <Clock className="w-4 h-4" />
                <span>Fechando em {cooldown}s</span>
              </div>
              <span className="text-[11px] text-white/40 italic">(Toque em qualquer lugar para fechar em 2s)</span>
            </div>
          </div>
        </div>
      )}

      {/* COOLDOWN OVERLAY (after popup disappears but still locked) */}
      {scanLocked && popup && !popup.visible && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <Clock className="w-16 h-16 text-indigo-400 mx-auto animate-pulse" />
            <p className="text-white text-2xl font-bold">Proxima leitura em {cooldown}s</p>
          </div>
        </div>
      )}

      {/* DAY SELECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
            <ScanLine className="w-3.5 h-3.5" /> Controle de Portaria do Evento
          </span>
          <h2 className="text-lg font-bold text-white">Validador de Ingressos por QR Code</h2>
          <p className="text-xs text-slate-400">Selecione o dia do evento para liberar a entrada dos participantes.</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            id="btn-select-dia-1"
            onClick={() => { setSelectedDia(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              selectedDia === 1
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>SABADO (Dia 1)</span>
          </button>
          <button
            id="btn-select-dia-2"
            onClick={() => { setSelectedDia(2); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              selectedDia === 2
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>DOMINGO (Dia 2)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* CAMERA SCANNER */}
        <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Camera de Leitura</h3>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700"
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
              <span>{soundEnabled ? 'Som LIGADO' : 'Som MUTE'}</span>
            </button>
          </div>

          {cameras.length > 1 && !scanning && (
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Dispositivo de Camera:</label>
              <select
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 p-2"
              >
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>{c.label || `Camera ${c.id.slice(0, 5)}`}</option>
                ))}
              </select>
            </div>
          )}

          <div className="relative bg-slate-950 rounded-2xl border-2 border-dashed border-slate-800 overflow-hidden min-h-[260px] flex items-center justify-center">
            <div id={scannerContainerId} className="w-full h-full text-slate-200"></div>
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 space-y-3">
                <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                  <ScanLine className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Leitor de QR Code Inativo</p>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">Clique no botao abaixo para ativar a camera.</p>
                </div>
                <button
                  id="btn-start-scanner"
                  onClick={startScanner}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Ativar Camera</span>
                </button>
              </div>
            )}
          </div>

          {scanning && (
            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Camera Ativa — Aproxime o QR Code
              </span>
              <button
                id="btn-stop-scanner"
                onClick={stopScanner}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg border border-slate-700"
              >
                Desativar Camera
              </button>
            </div>
          )}

          {/* MANUAL UUID ENTRY */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-indigo-400" /> Ou Digite/Cole o UUID Manualmente:
            </label>
            <form
              onSubmit={(e) => { e.preventDefault(); if (!scanLocked) handleValidateUUID(manualUuid); }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={manualUuid}
                onChange={(e) => setManualUuid(e.target.value)}
                placeholder="Ex: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden"
              />
              <button
                type="submit"
                disabled={validating || !manualUuid.trim() || scanLocked}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5"
              >
                {validating ? 'Validando...' : 'Validar'}
              </button>
            </form>
          </div>
        </div>

        {/* HISTORICO */}
        <div className="md:col-span-5 flex flex-col gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex-1">
            <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Ultimo Resultado</span>
              <span className="ml-auto text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                Portaria {selectedDia === 1 ? 'SABADO' : 'DOMINGO'}
              </span>
            </h3>

            {scanHistory.length > 0 ? (
              <div className={`p-4 rounded-2xl border space-y-2 ${
                scanHistory[0].status === 'sucesso'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
              }`}>
                <div className="flex items-center gap-2">
                  {scanHistory[0].status === 'sucesso'
                    ? <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    : <XCircle className="w-6 h-6 text-rose-400" />}
                  <span className="text-sm font-bold">
                    {scanHistory[0].status === 'sucesso' ? 'SUCESSO' : 'ERRO'}
                  </span>
                </div>
                <p className="text-xs">{scanHistory[0].mensagem}</p>
                {scanHistory[0].ingresso && (
                  <div className="pt-2 border-t border-white/10 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Nome:</span>
                      <span className="font-bold text-white">{scanHistory[0].ingresso.nome}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">CPF:</span>
                      <span className="font-mono text-white">{scanHistory[0].ingresso.cpf}</span>
                    </div>
                    {scanHistory[0].timestamp && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Check-in:</span>
                        <span className="font-mono font-bold text-emerald-400">{scanHistory[0].timestamp}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Cooldown indicator */}
                {scanLocked && cooldown > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-white/60 text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Proxima leitura em {cooldown}s</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-8 text-center space-y-2 text-slate-500">
                <ScanLine className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                <p className="text-xs font-semibold">Nenhuma leitura realizada ainda</p>
                <p className="text-[11px] text-slate-600">Escaneie o QR Code do participante.</p>
              </div>
            )}
          </div>

          {scanHistory.length > 1 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-indigo-400" /> Historico Recente
                </span>
                <button onClick={() => setScanHistory([])} className="text-[10px] text-slate-500 hover:text-slate-300">
                  Limpar
                </button>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {scanHistory.slice(1).map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg flex items-center justify-between font-mono text-[11px] ${
                      item.status === 'sucesso'
                        ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/40'
                        : 'bg-rose-950/40 text-rose-300 border border-rose-900/40'
                    }`}
                  >
                    <span className="truncate max-w-[200px]">
                      {item.ingresso ? item.ingresso.nome : item.mensagem}
                    </span>
                    <span className="font-bold uppercase text-[10px] shrink-0">{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
