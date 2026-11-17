import { describe, it, expect } from 'vitest';
import { CanonicalCryptoEngine } from './canonicalHash';
import { EscrowDomainEngine, TWENTY_FOUR_HOURS_MS } from '../domain/escrowEngine';
import { ContractRecord, ContractTerms } from '../types/contract';

const sampleTerms: ContractTerms = {
  id: 'SB1001A',
  employerId: 'emp_01',
  employerName: 'Kalinga Builders',
  workerId: 'wrk_01',
  workerName: 'Ramesh Nayak',
  work: 'con',
  wage: 500,
  per: 'day',
  days: [0, 1, 2, 3, 4, 5],
  pd: 1,
  lang: 'en',
  createdAt: '2026-11-17T10:00:00.000Z',
};

describe('CanonicalCryptoEngine & EscrowDomainEngine', () => {
  it('produces identical SHA-256 hashes regardless of workingDays order', async () => {
    const h1 = await CanonicalCryptoEngine.hashTerms(sampleTerms);
    const h2 = await CanonicalCryptoEngine.hashTerms({
      ...sampleTerms,
      days: [5, 4, 3, 2, 1, 0],
    });
    expect(h1).toBe(h2);
  });

  it('verifies dual ECDSA P-256 signatures and detects post-signing wage tampering', async () => {
    const empKeys = await CanonicalCryptoEngine.generateIdentityKeyPair();
    const wrkKeys = await CanonicalCryptoEngine.generateIdentityKeyPair();
    const hash = await CanonicalCryptoEngine.hashTerms(sampleTerms);

    const contract: ContractRecord = {
      terms: { ...sampleTerms },
      canonicalHash: hash,
      cancelWindowEndsAtMs: Date.now() + TWENTY_FOUR_HOURS_MS,
      status: 'active',
      events: [],
      escrow: { lockedAmount: 3000, days: [] },
      signatures: {
        employer: await CanonicalCryptoEngine.signHash('emp_01', empKeys, hash),
        worker: await CanonicalCryptoEngine.signHash('wrk_01', wrkKeys, hash),
      },
    };

    const validCheck = await CanonicalCryptoEngine.verifyContractIntegrity(contract);
    expect(validCheck.valid).toBe(true);

    // Simulate unauthorized wage modification
    contract.terms.wage = 600;
    const tamperedCheck = await CanonicalCryptoEngine.verifyContractIntegrity(contract);
    expect(tamperedCheck.valid).toBe(false);
    expect(tamperedCheck.reason).toContain('modified');
  });

  it('enforces the mandatory 3-day worker protection reserve on escrow reclaims', () => {
    const contract: ContractRecord = {
      terms: sampleTerms,
      canonicalHash: '0'.repeat(64),
      cancelWindowEndsAtMs: 0,
      status: 'active',
      events: [],
      escrow: {
        lockedAmount: 2500, // 5 days at ₹500/day
        days: [
          {
            id: 'd1',
            dateKey: '2026-11-17',
            status: 'pending', // ₹500 held
            loggedAtMs: 0,
            amount: 500,
            note: 'Shift',
          },
        ],
      },
      signatures: {
        employer: { actorId: 'emp_01', publicKeyJwk: {}, signatureBase64: '', signedAt: '' },
        worker: null,
      },
    };

    // Locked: 2500, Held: 500, Mandatory Reserve (3 * 500): 1500 => Reclaimable = 500
    expect(EscrowDomainEngine.calculateReclaimableAmount(contract)).toBe(500);
  });
});
