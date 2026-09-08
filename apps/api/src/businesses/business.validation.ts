import { BadRequestException } from '@nestjs/common';
import type { BusinessDto } from './dto/business.dto.js';

export function validateBusiness(dto: BusinessDto) {
  const start = Number(dto.financialYear.slice(0, 4));
  if (dto.financialYear.slice(5) !== String((start + 1) % 100).padStart(2, '0'))
    throw new BadRequestException('Financial year must contain consecutive years, for example 2026-27');
  if (dto.gstRegistered) {
    if (!dto.gstin || dto.gstMode === 'NOT_APPLICABLE')
      throw new BadRequestException('GSTIN and a default GST mode are required for GST-registered businesses');
    if (dto.gstin.slice(0, 2) !== dto.stateCode)
      throw new BadRequestException('GSTIN state code must match the business state code');
    if (dto.pan && dto.pan !== dto.gstin.slice(2, 12))
      throw new BadRequestException('PAN must match the PAN portion of GSTIN');
  } else if (dto.gstin || dto.gstMode !== 'NOT_APPLICABLE') {
    throw new BadRequestException('Non-GST businesses must omit GSTIN and use NOT_APPLICABLE GST mode');
  }
  const bank = [dto.bankName, dto.accountHolder, dto.accountNumber, dto.ifsc];
  if (bank.some(Boolean) && !bank.every(Boolean))
    throw new BadRequestException('Provide all bank details or leave all bank fields empty');
  // Format validation only, not GST portal, bank or UPI verification.
}
