import React, { useState, useEffect } from 'react';
import { Header, ActiveTab } from './components/Header';
import { ParticipantPortal } from './components/ParticipantPortal';
import { PortariaScanner } from './components/PortariaScanner';
import { SpreadsheetManager } from './components/SpreadsheetManager';
import { Ingresso } from './types';
import { Ticket } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('portal');
  const [ingressos, setIngressos] = useState<Ingresso[]>([]);
  const [currentUser, setCurrentUser] = useState<Ingresso | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  // Restore saved session if CPF is stored
  useEffect(() => {
    const savedCpf = localStorage.getItem('event_participant_cpf');
    if (savedCpf) {
      fetch('/api/cpf-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: savedCpf }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.sucesso && data.ingresso) {
            const user: Ingresso = data.ingresso;
            const adminFlag = !!data.isAdmin;
            setCurrentUser(user);
            setIsAdmin(adminFlag);
            if (adminFlag) {
              setActiveTab('scanner');
            }
          } else {
            localStorage.removeItem('event_participant_cpf');
          }
        })
        .catch(() => {
          localStorage.removeItem('event_participant_cpf');
        });
    }
  }, []);

  // Fetch ingressos from Express backend
  const fetchIngressos = async () => {
    try {
      const res = await fetch('/api/ingressos');
      if (res.ok) {
        const data = await res.json();
        setIngressos(data.ingressos || []);
      }
    } catch (err) {
      console.error('Failed to fetch ingressos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIngressos();
  }, []);

  // Login handler called from ParticipantPortal
  const handleLoginSuccess = (user: Ingresso, adminStatus: boolean) => {
    setCurrentUser(user);
    setIsAdmin(adminStatus);
    localStorage.setItem('event_participant_cpf', user.cpf);
    if (adminStatus) {
      setActiveTab('scanner');
    } else {
      setActiveTab('portal');
    }
  };

  // Logout handler
  const handleLogout = () => {
    setCurrentUser(null);
    setIsAdmin(false);
    localStorage.removeItem('event_participant_cpf');
    setActiveTab('portal');
  };

  // Update ingressos and sync to Express backend
  const handleUpdateIngressos = async (newList: Ingresso[]) => {
    setIngressos(newList);
    try {
      await fetch('/api/ingressos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingressos: newList, overwrite: true }),
      });
    } catch (err) {
      console.error('Error syncing updated ingressos to server:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* HEADER WITH TAB NAVIGATION */}
      <div>
        <Header
          activeTab={activeTab}
          setActiveTab={(tab) => {
            // Guard: non-admins cannot switch to admin tabs
            if (!isAdmin && tab !== 'portal') {
              setActiveTab('portal');
            } else {
              setActiveTab(tab);
              // Sempre atualiza os dados ao navegar entre as abas administrativas
              if (tab === 'planilha' || tab === 'scanner') {
                fetchIngressos();
              }
            }
          }}
          totalIngressos={ingressos.length}
          user={currentUser}
          isAdmin={isAdmin}
          onLogout={handleLogout}
        />

        {/* MAIN BODY CONTENT BASED ON ACTIVE TAB & USER ROLE */}
        <main className="py-4">
          {/* If user is not logged in OR is on portal tab */}
          {(!currentUser || activeTab === 'portal' || !isAdmin) && (
            <ParticipantPortal
              user={currentUser}
              onLoginSuccess={handleLoginSuccess}
              onLogout={handleLogout}
            />
          )}

          {/* ADMIN ONLY TABS */}
          {currentUser && isAdmin && activeTab === 'scanner' && (
            <PortariaScanner />
          )}

          {currentUser && isAdmin && activeTab === 'planilha' && (
            <SpreadsheetManager
              ingressos={ingressos}
              onUpdateIngressos={handleUpdateIngressos}
              onRefreshData={fetchIngressos}
            />
          )}
        </main>
      </div>

      {/* FOOTER */}
      <footer className="bg-slate-900 border-t border-slate-800 py-6 px-4 text-xs text-slate-400 text-center mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Ticket className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-slate-200">Portal de Acesso ao Evento</span>
            <span className="text-slate-600">•</span>
            <span>Google Sheets Sync & Event Check-in</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <span>Sábado (Dia 1) & Domingo (Dia 2)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
