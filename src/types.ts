export type TipoIngresso = 1 | 2 | 3;

export interface Ingresso {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  tipo: TipoIngresso; // 1 = Sabado, 2 = Domingo, 3 = Passaporte (Sabado e Domingo)
  situacao: string; // "LIBERADO", "PENDENTE", "CANCELADO", etc.
  uuid_dia1?: string; // UUID unico para QR Code do Sabado (tipo 1 ou 3)
  uuid_dia2?: string; // UUID unico para QR Code do Domingo (tipo 2 ou 3)
  dia1?: string; // Timestamp do check-in no Sabado
  dia2?: string; // Timestamp do check-in no Domingo
  isAdmin?: boolean;
}

export interface ValidarRequest {
  uuid: string;
  dia: 1 | 2; // 1 = Sabado, 2 = Domingo
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
