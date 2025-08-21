import { base, mainnet } from 'viem/chains';
import {
  getChain,
  getChainName,
  getChainNameDefiLlama,
} from '../../../src/utils/common/chainConversion';

describe('chainConversion', () => {
  describe('getChain', () => {
    it('case - mainnet', () => {
      expect(getChain(1)).toBe(mainnet);
    });
    it('case - base', () => {
      expect(getChain(8453)).toBe(base);
    });
    it('case - unsupported chainId', () => {
      expect(() => getChain(999)).toThrow('Unsupported chainId: 999');
    });
  });

  describe('getChainName', () => {
    it('case - mainnet', () => {
      expect(getChainName(1)).toBe('mainnet');
    });
    it('case - base', () => {
      expect(getChainName(8453)).toBe('base');
    });
    it('case - unsupported chainId', () => {
      expect(() => getChainName(999)).toThrow('Unsupported chainId: 999');
    });
  });

  describe('getChainNameDefiLlama', () => {
    it('case - mainnet', () => {
      expect(getChainNameDefiLlama(1)).toBe('ethereum');
    });
    it('case - base', () => {
      expect(getChainNameDefiLlama(8453)).toBe('base');
    });
    it('case - unsupported chainId', () => {
      expect(() => getChainNameDefiLlama(999)).toThrow('Unsupported chainId: 999');
    });
  });
});
