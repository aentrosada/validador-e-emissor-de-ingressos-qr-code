import { Ingresso } from '../types';

export const INITIAL_INGRESSOS: Ingresso[] = [
  {
    id: '0',
    nome: 'Administrador do Evento',
    email: 'admin@evento.com.br',
    telefone: '5511999998888',
    cpf: '12345678910',
    tipo: 3, // Passaporte
    situacao: 'LIBERADO',
    uuid: 'admin-pass-999',
    dia1: '',
    dia2: '',
    isAdmin: true,
  },
  {
    id: '1',
    nome: 'Ronaldo Fenomeno',
    email: 'thaina.redes@gmail.com',
    telefone: '5514998780239',
    cpf: '39784759875',
    tipo: 3, // Sábado e Domingo (Passaporte)
    situacao: 'LIBERADO',
    uuid: 'axd-gtl-yyu',
    dia1: '2025-05-11 20:31',
    dia2: '',
  },
  {
    id: '2',
    nome: 'Marta Vieira da Silva',
    email: 'marta.10@futebol.com.br',
    telefone: '5511987654321',
    cpf: '12345678901',
    tipo: 1, // Sábado
    situacao: 'LIBERADO',
    uuid: 'bfd-982-kll',
    dia1: '',
    dia2: '',
  },
  {
    id: '3',
    nome: 'Ayrton Senna do Brasil',
    email: 'senna.f1@racing.com',
    telefone: '5511999887766',
    cpf: '98765432100',
    tipo: 2, // Domingo
    situacao: 'LIBERADO',
    uuid: 'f1s-300-kmh',
    dia1: '',
    dia2: '',
  },
  {
    id: '4',
    nome: 'Thainá Redes de Oliveira',
    email: 'thaina.admin@evento.com.br',
    telefone: '5514998780239',
    cpf: '11122233344',
    tipo: 3, // Passaporte
    situacao: 'LIBERADO',
    uuid: 'vip-pass-001',
    dia1: '',
    dia2: '',
  },
  {
    id: '5',
    nome: 'Garrincha da Silva',
    email: 'garrincha.botafogo@futebol.com',
    telefone: '5521977665544',
    cpf: '55566677788',
    tipo: 1,
    situacao: 'PENDENTE', // Não deve gerar QR code nem liberar
    uuid: 'pend-002-abc',
    dia1: '',
    dia2: '',
  },
  {
    id: '6',
    nome: 'Anitta Machado',
    email: 'anitta@popmusic.com.br',
    telefone: '5521988112233',
    cpf: '44455566677',
    tipo: 2,
    situacao: 'LIBERADO',
    uuid: 'pop-dom-777',
    dia1: '',
    dia2: '',
  }
];
