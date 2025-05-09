import { PyloadConfigValue } from '../../types';

/**
 * Convert PyLoad config value to boolean
 * @param value PyLoad config value (can be boolean, string, or number)
 * @returns Boolean representation of the value
 */
export function configValueToBoolean(value: PyloadConfigValue | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  
  if (typeof value === 'string') {
    const lowercased = value.toLowerCase();
    return lowercased === 'true' || lowercased === '1' || lowercased === 'yes' || lowercased === 'on';
  }
  
  if (typeof value === 'number') {
    return value > 0;
  }
  
  return Boolean(value);
}

/**
 * Convert PyLoad config value to number
 * @param value PyLoad config value (can be boolean, string, or number)
 * @param defaultValue Default value if conversion fails
 * @returns Number representation of the value
 */
export function configValueToNumber(value: PyloadConfigValue | undefined, defaultValue: number = 0): number {
  if (value === undefined) {
    return defaultValue;
  }
  
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  
  return value ? 1 : 0;
}

/**
 * Convert PyLoad config value to string
 * @param value PyLoad config value (can be boolean, string, or number)
 * @returns String representation of the value
 */
export function configValueToString(value: PyloadConfigValue | undefined): string {
  if (value === undefined) {
    return '';
  }
  
  return String(value);
}
