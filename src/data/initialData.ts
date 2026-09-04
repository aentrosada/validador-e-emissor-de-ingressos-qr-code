import { Ingresso } from '../types';

// Lista com usuário de teste — remova após validar a tela do participante.
export const INITIAL_INGRESSOS: Ingresso[] = [
  {
    id: 'test-001',
    nome: 'Usuário Teste',
    email: 'teste@evento.com.br',
    telefone: '',
    cpf: '47836417816',
    tipo: 3, // Passaporte (Sábado e Domingo)
    situacao: 'LIBERADO',
    uuid: 'teste-usr-001',
    dia1: '',
    dia2: '',
  },
];

