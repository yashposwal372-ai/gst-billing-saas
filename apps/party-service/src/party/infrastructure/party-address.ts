import { BadRequestException } from '@nestjs/common';

// Accepted form labels, including legacy state codes for existing party addresses.
// This is address consistency validation, not government registration verification.
const states: Record<string, readonly string[]> = {
  '01': ['Jammu and Kashmir', 'Jammu & Kashmir'],
  '02': ['Himachal Pradesh'],
  '03': ['Punjab'],
  '04': ['Chandigarh'],
  '05': ['Uttarakhand'],
  '06': ['Haryana'],
  '07': ['Delhi', 'New Delhi'],
  '08': ['Rajasthan'],
  '09': ['Uttar Pradesh'],
  '10': ['Bihar'],
  '11': ['Sikkim'],
  '12': ['Arunachal Pradesh'],
  '13': ['Nagaland'],
  '14': ['Manipur'],
  '15': ['Mizoram'],
  '16': ['Tripura'],
  '17': ['Meghalaya'],
  '18': ['Assam'],
  '19': ['West Bengal'],
  '20': ['Jharkhand'],
  '21': ['Odisha', 'Orissa'],
  '22': ['Chhattisgarh'],
  '23': ['Madhya Pradesh'],
  '24': ['Gujarat'],
  '25': ['Daman and Diu'],
  '26': ['Dadra and Nagar Haveli and Daman and Diu', 'Dadra and Nagar Haveli'],
  '27': ['Maharashtra'],
  '28': ['Andhra Pradesh'],
  '29': ['Karnataka'],
  '30': ['Goa'],
  '31': ['Lakshadweep'],
  '32': ['Kerala'],
  '33': ['Tamil Nadu'],
  '34': ['Puducherry', 'Pondicherry'],
  '35': ['Andaman and Nicobar Islands', 'Andaman & Nicobar Islands'],
  '36': ['Telangana'],
  '37': ['Andhra Pradesh'],
  '38': ['Ladakh'],
};
export function validatePartyState(state: string, code: string) {
  if (
    !states[code]?.some(
      (name) => name.toLowerCase() === state.trim().toLowerCase(),
    )
  )
    throw new BadRequestException('State name must match the GST state code');
}
