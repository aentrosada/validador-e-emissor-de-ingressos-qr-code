import React from 'react';
import { QrCode, ScanLine, Table, ShieldCheck, Ticket, LogOut, User, ShieldAlert } from 'lucide-react';
import { Ingresso } from '../types';

export type ActiveTab = 'portal' | 'scanner' | 'planilha';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  totalIngressos?: number;
  user: Ingresso | null;
  isAdmin: boolean;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  totalIngressos = 0,
  user,
  isAdmin,
  onLogout,
}) => {
  return (
    <header id="main-header" className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 gap-3">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center shadow-md">
              <Ticket className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">Portal de Acesso ao Evento</h1>
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full">
                    <ShieldAlert className="w-3 h-3 text-purple-400" /> MODO ADMIN
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    <ShieldCheck className="w-3 h-3" /> Evento Validados
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Tabs (Only rendered when logged in, or simplified when logged out) */}
          {user ? (
            <div className="flex items-center gap-3 flex-wrap">
              <nav className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800/80 overflow-x-auto">
                {/* Tab: Ingressos (Apenas visível para participantes, não para o admin) */}
                {!isAdmin && (
                  <button
                    id="tab-portal"
                    onClick={() => setActiveTab('portal')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      activeTab === 'portal'
                        ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>INGRESSOS</span>
                  </button>
                )}

                {/* ADMIN-ONLY TABS */}
                {isAdmin && (
                  <>
                    <button
                      id="tab-scanner"
                      onClick={() => setActiveTab('scanner')}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        activeTab === 'scanner'
                          ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <ScanLine className="w-4 h-4" />
                      <span>Portaria / Scanner</span>
                    </button>

                    <button
                      id="tab-planilha"
                      onClick={() => setActiveTab('planilha')}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        activeTab === 'planilha'
                          ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <Table className="w-4 h-4" />
                      <span>Gestão Planilha</span>
                      {totalIngressos > 0 && (
                        <span className="ml-1 bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded-md font-mono">
                          {totalIngressos}
                        </span>
                      )}
                    </button>
                  </>
                )}
              </nav>

              {/* USER PROFILE SUMMARY & LOGOUT */}
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800/80 p-1.5 rounded-xl text-xs">
                <div className="flex items-center gap-2 px-2 text-slate-300">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-semibold max-w-[120px] truncate">{user.nome}</span>
                </div>
                <button
                  id="btn-header-logout"
                  onClick={onLogout}
                  title="Sair do sistema"
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-1.5 rounded-lg transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-400" />
              <span>Acesso restrito — Faça login com seu CPF</span>
            </div>
          )}

        </div>
      </div>
    </header>
  );
};
