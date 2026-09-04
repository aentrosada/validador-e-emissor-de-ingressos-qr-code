import { Ingresso } from '../types';

// Usuario de teste — remova apos validar a tela do participante.
export const INITIAL_INGRESSOS: Ingresso[] = [
  {
    id: 'test-001',
    nome: 'Usuario Teste',
    email: 'teste@evento.com.br',
    telefone: '',
    cpf: '12345678910',
    tipo: 3,
    situacao: 'LIBERADO',
    uuid_dia1: 'teste-sabado-001',
    uuid_dia2: 'teste-domingo-001',
    dia1: '',
    dia2: '',
  },
];
