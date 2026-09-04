export type TipoIngresso = 1 | 2 | 3;

export interface Ingresso {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  tipo: TipoIngresso; // 1 = Sábado, 2 = Domingo, 3 = Sábado e Domingo (Passaporte)
  situacao: string; // "LIBERADO", "PENDENTE", "CANCELADO", etc.
  uuid: string; // e.g. "axd-gtl-yyu"
  dia1?: string; // Check-in timestamp Sábado, e.g. "2025-05-11 20:31"
  dia2?: string; // Check-in timestamp Domingo
  isAdmin?: boolean;
}

export interface ValidarRequest {
  uuid: string;
  dia: 1 | 2; // 1 = Sábado, 2 = Domingo
}

export interface ValidarResponse {
  status: 'sucesso' | 'erro';
  mensagem: string;
  ingresso?: Ingresso;
  timestamp?: string;
  diaValidado?: 1 | 2;
}

export interface CpfLoginResponse {
  sucesso: boolean;
  mensagem: string;
  ingresso?: Ingresso;
  isAdmin?: boolean;
}
