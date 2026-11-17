import { ChainEvent, ContractRecord, ContractTerms, SignatureRecord } from '../types/contract';

const ECDSA_KEY_PARAMS: EcKeyGenParams = { name: 'ECDSA', namedCurve: 'P-256' };
const ECDSA_SIGN_PARAMS: EcdsaParams = { name: 'ECDSA', hash: 'SHA-256' };

const FINGERPRINT_EMOJIS = [
  '🌻', '🐘', '🚲', '🌙', '🔔', '🐟', '🍋', '⭐',
  '🏠', '🥁', '🌳', '🪁', '🐦', '🍚', '🛶', '🔑',
] as const;

export class CanonicalCryptoEngine {
  /**
   * Produces a deterministic, property-order-independent JSON string.
   */
  static serializeTerms(terms: ContractTerms): string {
    return JSON.stringify([
      terms.id,
      terms.employerId,
      terms.employerName.trim(),
      terms.workerId,
      terms.workerName.trim(),
      terms.work,
      terms.wage,
      terms.per,
      [...terms.days].sort((a, b) => a - b),
      terms.pd,
      terms.lang,
      terms.createdAt,
    ]);
  }

  static async sha256Hex(payload: string): Promise<string> {
    const encoded = new TextEncoder().encode(payload);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  static async hashTerms(terms: ContractTerms): Promise<string> {
    return this.sha256Hex(this.serializeTerms(terms));
  }

  /**
   * Generates a non-extractable ECDSA P-256 keypair so private key bytes
   * cannot be exported or read by scripts.
   */
  static async generateIdentityKeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(ECDSA_KEY_PARAMS, false, ['sign', 'verify']);
  }

  static async signHash(
    actorId: string,
    keyPair: CryptoKeyPair,
    hexHash: string
  ): Promise<SignatureRecord> {
    const rawSig = await crypto.subtle.sign(
      ECDSA_SIGN_PARAMS,
      keyPair.privateKey,
      new TextEncoder().encode(hexHash)
    );
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(rawSig)));
    return {
      actorId,
      publicKeyJwk,
      signatureBase64,
      signedAt: new Date().toISOString(),
    };
  }

  static async verifySignature(record: SignatureRecord, expectedHash: string): Promise<boolean> {
    try {
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        record.publicKeyJwk,
        ECDSA_KEY_PARAMS,
        false,
        ['verify']
      );
      const sigBytes = Uint8Array.from(atob(record.signatureBase64), (c) => c.charCodeAt(0));
      return await crypto.subtle.verify(
        ECDSA_SIGN_PARAMS,
        publicKey,
        sigBytes,
        new TextEncoder().encode(expectedHash)
      );
    } catch {
      return false;
    }
  }

  static async appendChainEvent(
    contract: ContractRecord,
    type: ChainEvent['type'],
    ok: boolean,
    amount: number,
    timestamp: string
  ): Promise<ChainEvent> {
    const prevHash =
      contract.events.length > 0
        ? contract.events[contract.events.length - 1].hash
        : contract.canonicalHash;
    const hash = await this.sha256Hex(`${prevHash}|${type}|${ok}|${amount}|${timestamp}`);
    return { type, ok, amount, timestamp, hash };
  }

  static async verifyContractIntegrity(
    contract: ContractRecord
  ): Promise<{ valid: boolean; reason: string }> {
    const recomputedTermsHash = await this.hashTerms(contract.terms);
    if (recomputedTermsHash !== contract.canonicalHash) {
      return { valid: false, reason: 'Tamper Detected: Contract terms were modified after signing.' };
    }

    const employerSigValid = await this.verifySignature(
      contract.signatures.employer,
      contract.canonicalHash
    );
    if (!employerSigValid) {
      return { valid: false, reason: 'Tamper Detected: Employer ECDSA signature invalid.' };
    }

    if (contract.signatures.worker) {
      const workerSigValid = await this.verifySignature(
        contract.signatures.worker,
        contract.canonicalHash
      );
      if (!workerSigValid) {
        return { valid: false, reason: 'Tamper Detected: Employee ECDSA signature invalid.' };
      }
    }

    let prevHash = contract.canonicalHash;
    for (const ev of contract.events) {
      const expectedEvHash = await this.sha256Hex(
        `${prevHash}|${ev.type}|${ev.ok}|${ev.amount}|${ev.timestamp}`
      );
      if (expectedEvHash !== ev.hash) {
        return {
          valid: false,
          reason: `Tamper Detected: Hash chain broken at ${ev.type} (${ev.timestamp}).`,
        };
      }
      prevHash = ev.hash;
    }

    return {
      valid: true,
      reason: 'Verified: Canonical terms, dual ECDSA signatures & event chain intact.',
    };
  }

  /**
   * 4-symbol visual fingerprint (65,536 combinations) to prevent in-person phone impersonation.
   */
  static deriveEmojiFingerprint(hexHash: string): string {
    return [0, 2, 4, 6]
      .map((offset) => FINGERPRINT_EMOJIS[parseInt(hexHash[offset] ?? '0', 16) % FINGERPRINT_EMOJIS.length])
      .join(' ');
  }
}
