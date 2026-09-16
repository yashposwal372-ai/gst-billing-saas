import { Injectable } from '@nestjs/common';
import { Prisma } from '@gst/prisma-client/client';

export type PriceMode = 'EXCLUSIVE' | 'INCLUSIVE';
export type DiscountType = 'NONE' | 'PERCENT' | 'AMOUNT';
const D = Prisma.Decimal;
const ZERO = new D(0);

export type CalculationLineInput = {
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  gstRate: Prisma.Decimal;
  priceMode: PriceMode;
  discountType: DiscountType;
  discountValue: Prisma.Decimal;
};

export type CalculatedLine = {
  discountAmount: Prisma.Decimal;
  grossAmount: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  cgstRate: Prisma.Decimal;
  cgstAmount: Prisma.Decimal;
  sgstRate: Prisma.Decimal;
  sgstAmount: Prisma.Decimal;
  igstRate: Prisma.Decimal;
  igstAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};

export function money(value: string | number | Prisma.Decimal) {
  return new D(value).toDecimalPlaces(2, D.ROUND_HALF_UP);
}

export function qty(value: string | number | Prisma.Decimal) {
  return new D(value).toDecimalPlaces(3, D.ROUND_HALF_UP);
}

@Injectable()
export class InvoiceCalculator {
  line(input: CalculationLineInput, intraState: boolean): CalculatedLine {
    const gross = money(input.quantity.mul(input.unitPrice));
    let discount = ZERO;
    if (input.discountType === 'PERCENT')
      discount = money(gross.mul(input.discountValue).div(100));
    if (input.discountType === 'AMOUNT') discount = money(input.discountValue);
    const discountedGross = money(gross.minus(discount));
    let taxable = discountedGross;
    let tax = ZERO;
    if (input.priceMode === 'INCLUSIVE' && input.gstRate.gt(0)) {
      taxable = money(discountedGross.mul(100).div(input.gstRate.plus(100)));
      tax = money(discountedGross.minus(taxable));
    } else if (input.priceMode === 'EXCLUSIVE' && input.gstRate.gt(0)) {
      tax = money(taxable.mul(input.gstRate).div(100));
    }
    const halfRate = input.gstRate.div(2);
    const cgst = intraState ? money(tax.div(2)) : ZERO;
    const sgst = intraState ? money(tax.minus(cgst)) : ZERO;
    const igst = intraState ? ZERO : tax;
    return {
      discountAmount: discount,
      grossAmount: gross,
      taxableAmount: taxable,
      cgstRate: intraState ? halfRate : ZERO,
      cgstAmount: cgst,
      sgstRate: intraState ? halfRate : ZERO,
      sgstAmount: sgst,
      igstRate: intraState ? ZERO : input.gstRate,
      igstAmount: igst,
      taxAmount: money(cgst.plus(sgst).plus(igst)),
      lineTotal:
        input.priceMode === 'INCLUSIVE'
          ? discountedGross
          : money(taxable.plus(tax)),
    };
  }
}

export function financialYear(date: string | Date) {
  const d = typeof date === 'string' ? parseDateOnly(date) : date;
  const year = d.getUTCFullYear();
  const start = d.getUTCMonth() >= 3 ? year : year - 1;
  return start + '-' + String((start + 1) % 100).padStart(2, '0');
}

export function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}
