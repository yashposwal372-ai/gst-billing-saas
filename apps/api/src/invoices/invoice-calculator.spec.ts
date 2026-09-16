import { Prisma } from '@gst/prisma-client/client';
import { financialYear, InvoiceCalculator, money } from './invoice-calculator.js';

const D = Prisma.Decimal;
const line = (extra: Partial<Parameters<InvoiceCalculator['line']>[0]> = {}) => ({
  quantity: new D('2'),
  unitPrice: new D('100'),
  gstRate: new D('18'),
  priceMode: 'EXCLUSIVE' as const,
  discountType: 'NONE' as const,
  discountValue: new D(0),
  ...extra,
});

describe('invoice calculator', () => {
  const calc = new InvoiceCalculator();
  const totals = (rows: ReturnType<InvoiceCalculator['line']>[]) => {
    const sum = rows.reduce(
      (acc, row) => ({
        discountTotal: money(acc.discountTotal.plus(row.discountAmount)),
        taxableTotal: money(acc.taxableTotal.plus(row.taxableAmount)),
        cgstTotal: money(acc.cgstTotal.plus(row.cgstAmount)),
        sgstTotal: money(acc.sgstTotal.plus(row.sgstAmount)),
        igstTotal: money(acc.igstTotal.plus(row.igstAmount)),
        taxTotal: money(acc.taxTotal.plus(row.taxAmount)),
        grandTotal: money(acc.grandTotal.plus(row.lineTotal)),
      }),
      {
        discountTotal: new D(0),
        taxableTotal: new D(0),
        cgstTotal: new D(0),
        sgstTotal: new D(0),
        igstTotal: new D(0),
        taxTotal: new D(0),
        grandTotal: new D(0),
      },
    );
    expect(sum.discountTotal.gte(0)).toBe(true);
    expect(sum.taxableTotal.gte(0)).toBe(true);
    expect(sum.cgstTotal.plus(sum.sgstTotal).plus(sum.igstTotal).toFixed(2)).toBe(sum.taxTotal.toFixed(2));
    expect(sum.taxableTotal.plus(sum.taxTotal).toFixed(2)).toBe(sum.grandTotal.toFixed(2));
    return sum;
  };

  it('calculates exclusive intra-state CGST and SGST without drift', () => {
    const out = calc.line(line(), true);
    expect(out.taxableAmount.toFixed(2)).toBe('200.00');
    expect(out.cgstAmount.toFixed(2)).toBe('18.00');
    expect(out.sgstAmount.toFixed(2)).toBe('18.00');
    expect(out.taxAmount.toFixed(2)).toBe('36.00');
    expect(out.lineTotal.toFixed(2)).toBe('236.00');
  });

  it('calculates exclusive inter-state IGST', () => {
    const out = calc.line(line(), false);
    expect(out.igstAmount.toFixed(2)).toBe('36.00');
    expect(out.cgstAmount.toFixed(2)).toBe('0.00');
    expect(out.sgstAmount.toFixed(2)).toBe('0.00');
  });

  it('calculates inclusive GST from the tax-included gross amount', () => {
    const out = calc.line(line({ unitPrice: new D('118'), priceMode: 'INCLUSIVE' }), true);
    expect(out.grossAmount.toFixed(2)).toBe('236.00');
    expect(out.taxableAmount.toFixed(2)).toBe('200.00');
    expect(out.taxAmount.toFixed(2)).toBe('36.00');
    expect(out.lineTotal.toFixed(2)).toBe('236.00');
  });

  it('applies percentage and amount discounts before tax', () => {
    expect(calc.line(line({ discountType: 'PERCENT', discountValue: new D('10') }), false).taxableAmount.toFixed(2)).toBe('180.00');
    expect(calc.line(line({ discountType: 'AMOUNT', discountValue: new D('25') }), false).taxableAmount.toFixed(2)).toBe('175.00');
  });

  it('keeps zero GST at zero components', () => {
    const out = calc.line(line({ gstRate: new D(0) }), true);
    expect(out.taxAmount.toFixed(2)).toBe('0.00');
    expect(out.lineTotal.toFixed(2)).toBe('200.00');
  });

  it('calculates 5% intra-state tax and reconciles components', () => {
    const out = calc.line(line({ gstRate: new D(5), unitPrice: new D('99.99') }), true);
    expect(out.taxAmount.toFixed(2)).toBe('10.00');
    expect(out.cgstAmount.plus(out.sgstAmount).toFixed(2)).toBe(out.taxAmount.toFixed(2));
    expect(out.igstAmount.toFixed(2)).toBe('0.00');
  });

  it('supports fractional quantities and large valid monetary input', () => {
    const out = calc.line(line({ quantity: new D('1'), unitPrice: new D('9999999999999.99'), gstRate: new D(0) }), false);
    expect(out.grossAmount.toFixed(2)).toBe('9999999999999.99');
    expect(out.lineTotal.toFixed(2)).toBe('9999999999999.99');
  });

  it('handles inclusive zero-GST pricing without extracting tax', () => {
    const out = calc.line(line({ priceMode: 'INCLUSIVE', gstRate: new D(0), unitPrice: new D('123.45') }), true);
    expect(out.taxableAmount.toFixed(2)).toBe('246.90');
    expect(out.taxAmount.toFixed(2)).toBe('0.00');
    expect(out.lineTotal.toFixed(2)).toBe('246.90');
  });

  it('keeps exact IGST-only totals for inter-state invoices', () => {
    const out = calc.line(line({ gstRate: new D(12) }), false);
    expect(out.igstRate.toFixed(2)).toBe('12.00');
    expect(out.igstAmount.toFixed(2)).toBe(out.taxAmount.toFixed(2));
    expect(out.cgstAmount.toFixed(2)).toBe('0.00');
    expect(out.sgstAmount.toFixed(2)).toBe('0.00');
  });

  it('reconciles multiple lines and multiple GST rates from rounded line values', () => {
    const sum = totals([
      calc.line(line({ quantity: new D('1.500'), gstRate: new D(5), unitPrice: new D('100') }), true),
      calc.line(line({ quantity: new D('3'), gstRate: new D(18), unitPrice: new D('12.49'), discountType: 'PERCENT', discountValue: new D('10') }), true),
      calc.line(line({ quantity: new D('1'), gstRate: new D(0), unitPrice: new D('7.77') }), true),
    ]);
    expect(sum.igstTotal.toFixed(2)).toBe('0.00');
    expect(sum.taxTotal.toFixed(2)).toBe('13.57');
    expect(sum.grandTotal.toFixed(2)).toBe('205.06');
  });

  it('rounds money with Decimal half-up policy', () => {
    expect(money(new D('1.005')).toFixed(2)).toBe('1.01');
  });

  it('derives Indian financial year from invoice date', () => {
    expect(financialYear('2026-04-01')).toBe('2026-27');
    expect(financialYear('2027-03-31')).toBe('2026-27');
  });
});
