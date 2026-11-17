export type Role = 'worker' | 'employer';

export type LanguageCode =
  | 'en' | 'hi' | 'od' | 'bn' | 'mr' | 'gu' | 'ta' | 'te'
  | 'kn' | 'ml' | 'pa' | 'as' | 'ur' | 'ne' | 'kok' | 'mai'
  | 'sa' | 'sd' | 'ks' | 'doi' | 'mni' | 'sat' | 'brx';

export type WorkCategory = 'dom' | 'con' | 'gar' | 'farm' | 'drv' | 'care';
export type WageUnit = 'day' | 'month' | 'piece';
export type PaydaySchedule = 0 | 1 | 2;
export type ContractStatus = 'offer' | 'active' | 'withdrawn' | 'completed';
export type DayEntryStatus = 'pending' | 'paid' | 'auto' | 'disputed' | 'refunded';

export interface ContractTerms {
  id: string;
  employerId: string;
  employerName: string;
  workerId: string;
  workerName: string;
  work: WorkCategory;
  wage: number;
  per: WageUnit;
  days: number[];
  pd: PaydaySchedule;
  lang: LanguageCode;
  createdAt: string;
}

export interface ChainEvent {
  type: 'CHECKIN' | 'PAYOUT_APPROVED' | 'PAYOUT_AUTO' | 'DISPUTED' | 'DISPUTE_RESOLVED';
  ok: boolean;
  amount: number;
  timestamp: string;
  hash: string;
}

export interface EscrowDayEntry {
  id: string;
  dateKey: string;
  status: DayEntryStatus;
  loggedAtMs: number;
  amount: number;
  note: string;
}

export interface EscrowLedger {
  lockedAmount: number;
  days: EscrowDayEntry[];
}

export interface SignatureRecord {
  actorId: string;
  publicKeyJwk: JsonWebKey;
  signatureBase64: string;
  signedAt: string;
}

export interface ContractRecord {
  terms: ContractTerms;
  canonicalHash: string;
  cancelWindowEndsAtMs: number;
  status: ContractStatus;
  events: ChainEvent[];
  escrow: EscrowLedger;
  signatures: {
    employer: SignatureRecord;
    worker: SignatureRecord | null;
  };
}

export interface WalletTransaction {
  id: string;
  actor: Role;
  kind: 'topup' | 'fund' | 'refund' | 'payout' | 'withdraw';
  amount: number;
  note: string;
  timestamp: string;
}

export interface LenderShareRecord {
  id: string;
  tierName: string;
  onTimeRate: number;
  finalizedContracts: number;
  sharedAt: string;
  credentialDigest: string;
}

export interface TrustSummary {
  tierName: 'New' | 'Building' | 'Reliable' | 'Trusted';
  tierIndex: number;
  points: number;
  nextTierPoints: number | null;
  onTimeCount: number;
  disputedCount: number;
  finalizedContracts: number;
  onTimeRate: number;
}
