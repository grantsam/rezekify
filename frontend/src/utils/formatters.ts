/**
 * Unified currency formatting utility for Rezekify.
 * Formats monetary amounts in Indonesian Rupiah (IDR) without trailing zero decimals.
 */
export interface FormatRupiahOptions {
  showPrefix?: boolean;
}

export function formatRupiah(amount: number, options: FormatRupiahOptions = {}): string {
  const { showPrefix = true } = options;
  const isNegative = amount < 0;
  const absoluteValue = Math.abs(amount);

  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(absoluteValue);

  if (showPrefix) {
    return isNegative ? `-Rp ${formatted}` : `Rp ${formatted}`;
  }
  return isNegative ? `-${formatted}` : formatted;
}
