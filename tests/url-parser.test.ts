import { describe, expect, test } from 'bun:test';
import { parseURL } from '../src/core/url-parser';

describe('URL Parser', () => {
  describe('Format 1: Plain domain', () => {
    test('should parse plain domain with both ports', () => {
      const result = parseURL('portal.helios');
      
      expect(result.domain).toBe('portal.helios');
      expect(result.tld).toBe('helios');
      expect(result.ports).toHaveLength(2);
      expect(result.ports[0]).toEqual({ port: 80, ssl: false });
      expect(result.ports[1]).toEqual({ port: 443, ssl: true });
    });
  });
  
  describe('Format 2: Protocol-specific', () => {
    test('should parse https:// with port 443 only', () => {
      const result = parseURL('https://api.helios');
      
      expect(result.domain).toBe('api.helios');
      expect(result.tld).toBe('helios');
      expect(result.ports).toHaveLength(1);
      expect(result.ports[0]).toEqual({ port: 443, ssl: true });
    });
    
    test('should parse http:// with port 80 only', () => {
      const result = parseURL('http://legacy.helios');
      
      expect(result.domain).toBe('legacy.helios');
      expect(result.tld).toBe('helios');
      expect(result.ports).toHaveLength(1);
      expect(result.ports[0]).toEqual({ port: 80, ssl: false });
    });
  });
  
  describe('Format 3: Explicit port', () => {
    test('should parse custom port without SSL by default', () => {
      const result = parseURL('admin.helios:8080');
      
      expect(result.domain).toBe('admin.helios');
      expect(result.tld).toBe('helios');
      expect(result.ports).toHaveLength(1);
      expect(result.ports[0]).toEqual({ port: 8080, ssl: false });
    });
    
    test('should parse custom port with --ssl flag', () => {
      const result = parseURL('portal.helios:8443', { ssl: true });
      
      expect(result.domain).toBe('portal.helios');
      expect(result.tld).toBe('helios');
      expect(result.ports).toHaveLength(1);
      expect(result.ports[0]).toEqual({ port: 8443, ssl: true });
    });
    
    test('should parse https:// with custom port', () => {
      const result = parseURL('https://api.helios:8443');
      
      expect(result.domain).toBe('api.helios');
      expect(result.tld).toBe('helios');
      expect(result.ports).toHaveLength(1);
      expect(result.ports[0]).toEqual({ port: 8443, ssl: true });
    });
    
    test('should parse http:// with custom port', () => {
      const result = parseURL('http://legacy.helios:8080');
      
      expect(result.domain).toBe('legacy.helios');
      expect(result.tld).toBe('helios');
      expect(result.ports).toHaveLength(1);
      expect(result.ports[0]).toEqual({ port: 8080, ssl: false });
    });
  });
  
  describe('TLD extraction', () => {
    test('should extract single TLD', () => {
      const result = parseURL('portal.app');
      expect(result.tld).toBe('app');
    });
    
    test('should extract TLD from multi-part domain', () => {
      const result = parseURL('api.portal.helios');
      expect(result.tld).toBe('helios');
    });
  });
});
