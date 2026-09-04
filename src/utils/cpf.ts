/**
 * Formats a raw digits string into standard CPF format: 000.000.000-00
 */
export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Strips all non-digit characters from a string
 */
export function unformatCPF(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Basic CPF syntax check
 */
export function isValidCPFFormat(cpf: string): boolean {
  const digits = unformatCPF(cpf);
  return digits.length === 11;
}
