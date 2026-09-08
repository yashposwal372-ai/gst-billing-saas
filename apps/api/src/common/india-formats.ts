// Format checks only; these do not verify registration or account ownership.
export const GSTIN_PATTERN =
  /^[0-9]{2}[A-Z]{3}[ABCFGHLJPT][A-Z][0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_PATTERN = /^[A-Z]{3}[ABCFGHLJPT][A-Z][0-9]{4}[A-Z]$/;
export const PHONE_PATTERN = /^\+?[1-9]\d{9,14}$/;
export const STATE_CODE_PATTERN = /^(0[1-9]|[12][0-9]|3[0-8])$/;
export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_PATTERN = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,34}$/;
