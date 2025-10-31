import { getAddress } from 'viem';
import {
  parseBigIntToNumberWithScale,
  parseContractAddress,
  parseDecimalToBigInt,
  parseEnvVar,
  parseNumberToBigIntWithScale,
  parseOptimizationMode,
  parsePrivateKey,
  parseStrategies,
  resolveOptimizationMode,
} from '../../../src/utils/common/parser';

describe('common utils', () => {
  describe('parseEnvVar', () => {
    it('should return the value when environment variable is defined', () => {
      const value = 'test-value';
      expect(parseEnvVar(value)).toBe(value);
    });

    it('should throw error when environment variable is undefined', () => {
      expect(() => parseEnvVar(undefined)).toThrow('Missing environment variable');
    });
  });

  describe('parseDecimalToBigInt', () => {
    class StubDecimal {
      constructor(private readonly fixedValue: string) {}
      toFixed() {
        return this.fixedValue;
      }
    }

    it('should convert Decimal to BigInt', () => {
      const decimal = new StubDecimal('1234567890');
      const result = parseDecimalToBigInt(decimal);
      expect(result).toBe(BigInt('1234567890'));
    });

    it('should convert Decimal to BigInt with scientific notation', () => {
      const decimal = new StubDecimal('2413979216000000000000');
      const result = parseDecimalToBigInt(decimal);
      expect(result).toBe(BigInt('2413979216000000000000'));
    });
  });

  describe('parseStrategies', () => {
    it('should handle multiple strategies and return checksum encoded addresses', () => {
      const strategies = [
        'euler:0x1234567890abcdef1234567890abcdef12345678',
        'euler:0xABCDEF1234567890abcdef1234567890abcdef12',
      ];
      const result = parseStrategies(strategies);
      expect(result).toEqual([
        {
          protocol: 'euler',
          vaultAddress: getAddress('0x1234567890abcdef1234567890abcdef12345678'),
        },
        {
          protocol: 'euler',
          vaultAddress: getAddress('0xABCDEF1234567890abcdef1234567890abcdef12'),
        },
      ]);
    });

    it('should throw error for unsupported protocol', () => {
      expect(() => parseStrategies(['ftx:0x1234567890abcdef1234567890abcdef12345678'])).toThrow();
    });
    it('should throw error for invalid address length', () => {
      expect(() => parseStrategies(['euler:0x1234567890abcdef1234567890abcdef123458'])).toThrow();
    });
    it('should throw error for invalid address', () => {
      expect(() => parseStrategies(['euler:1234567890abcdef1234567890abcdef12345678'])).toThrow();
    });
  });

  describe('parseOptimizationMode', () => {
    it('parses supported modes case-insensitively', () => {
      expect(parseOptimizationMode('annealing')).toBe('annealing');
      expect(parseOptimizationMode('EQUALIZATION')).toBe('equalization');
    });

    it('throws for unsupported modes', () => {
      expect(() => parseOptimizationMode('invalid-mode')).toThrow();
    });
  });

  describe('resolveOptimizationMode', () => {
    it('returns default when value is undefined', () => {
      expect(resolveOptimizationMode(undefined, 'annealing')).toBe('annealing');
    });

    it('parses provided value when defined', () => {
      expect(resolveOptimizationMode('combined')).toBe('combined');
    });
  });

  describe('parseContractAddress', () => {
    it('should return checksum encoded address', () => {
      const address = '0x1234567890ABCDEF1234567890ABCDEF12345678';
      const result = parseContractAddress(address);
      expect(result).toBe(getAddress(address));
      expect(result.startsWith('0x')).toBe(true);
      expect(result.length).toBe(42);
    });
  });

  describe('parsePrivateKey', () => {
    it('should convert private key to lowercase and return private key typed as Hex', () => {
      const privateKey = '0x793301e121a736205d0c5c5f49d797BB4b2226f4beb9925866934740eb3810d6';
      const result = parsePrivateKey(privateKey);
      expect(result).toBe('0x793301e121a736205d0c5c5f49d797bb4b2226f4beb9925866934740eb3810d6');
      expect(result.startsWith('0x')).toBe(true);
      expect(result.length).toBe(66);
    });
  });

  describe('parseBigIntToNumberWithScale', () => {
    it('should handle zero BigInt', () => {
      const result = parseBigIntToNumberWithScale(0n, 6);
      expect(result).toBe(0);
    });
    it('should handle positive BigInt', () => {
      const result = parseBigIntToNumberWithScale(1234567891n, 6);
      expect(result).toBe(1234.567891);
    });
    it('should handle negative BigInt', () => {
      const result = parseBigIntToNumberWithScale(-1234567891n, 6);
      expect(result).toBe(-1234.567891);
    });
    it('should handle BigInt smaller than 1', () => {
      const result = parseBigIntToNumberWithScale(12345n, 6);
      expect(result).toBe(0.012345);
    });
  });
  describe('parseNumberToBigIntWithScale', () => {
    it('should handle zero', () => {
      const result = parseNumberToBigIntWithScale(0, 6);
      expect(result.toString()).toBe('0');
    });
    it('should handle positive', () => {
      const result = parseNumberToBigIntWithScale(132.15, 6);
      expect(result.toString()).toBe('132150000');
    });
    it('should handle negative', () => {
      const result = parseNumberToBigIntWithScale(-132.15, 6);
      expect(result.toString()).toBe('-132150000');
    });
    it('loss of precision case', () => {
      const result = parseNumberToBigIntWithScale(0.012345, 4);
      expect(result.toString()).toBe('123');
    });
  });
});
