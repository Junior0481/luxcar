const fuelLabels: Record<string, string> = {
  eletrico: 'Elétrico',
  gasolina: 'Gasolina',
  flex: 'Flex',
  diesel: 'Diesel',
  hibrido: 'Híbrido',
  etanol: 'Etanol',
};

const transmissionLabels: Record<string, string> = {
  automatica: 'Automático',
  automatico: 'Automático',
  manual: 'Manual',
  automatizada: 'Automatizado',
  cvt: 'CVT',
};

export const stageLabels: Record<string, string> = {
  primeiro_contato: 'Primeiro contato',
  avaliacao: 'Avaliação',
  test_drive_agendado: 'Test drive agendado',
  test_drive_realizado: 'Test drive realizado',
  proposta_enviada: 'Proposta enviada',
  negociacao_preco: 'Negociação de preço',
  aprovacao_credito: 'Aprovação de crédito',
  documentacao: 'Documentação',
  finalizado: 'Finalizado',
  perdido: 'Perdido',
};

const priorityLabels: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
};

export const formatFuel = (value?: string | null) => {
  if (!value) return '';
  const key = value.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return fuelLabels[key] ?? value;
};

export const formatTransmission = (value?: string | null) => {
  if (!value) return '';
  const key = value.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return transmissionLabels[key] ?? value;
};

export const formatPriority = (value?: string | null) => {
  if (!value) return '';
  const key = value.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return priorityLabels[key] ?? value;
};

export const formatPhone = (value?: string | null) => {
  if (!value) return '';
  let digits = value.replace(/\D/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
  if (digits.length === 11) return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (digits.length === 10) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return value;
};

/** Máscara de digitação do telefone: só dígitos, no máximo 11 (DDD + 9 dígitos). */
export const PHONE_MAX_LENGTH = 15; // "(11) 99999-9999"
export const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  const split = digits.length === 11 ? 5 : 4;
  if (rest.length <= split) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
};

export const formatPercent = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100);

export const pluralize = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

export const formatStage = (value?: string | null) => {
  if (!value) return '';
  return stageLabels[value] ?? value.replace(/_/g, ' ').replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase('pt-BR'));
};
