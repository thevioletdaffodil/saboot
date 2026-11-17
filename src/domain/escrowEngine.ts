import { ContractRecord, ContractTerms, EscrowLedger, TrustSummary } from '../types/contract';

export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export class EscrowDomainEngine {
  static calculateDailyWage(terms: ContractTerms): number {
    if (terms.per === 'day' || terms.per === 'piece') return terms.wage;
    const activeDays = Math.max(1, terms.days.length);
    return Math.round((terms.wage * 12) / 52 / activeDays);
  }

  static getHeldAmount(escrow: EscrowLedger): number {
    return escrow.days
      .filter((d) => d.status === 'pending' || d.status === 'disputed')
      .reduce((sum, d) => sum + d.amount, 0);
  }

  static getProtectedDaysCount(contract: ContractRecord): number {
    const daily = this.calculateDailyWage(contract.terms);
    if (daily <= 0) return 0;
    const freeEscrow = contract.escrow.lockedAmount - this.getHeldAmount(contract.escrow);
    return Math.max(0, Math.floor(freeEscrow / daily));
  }

  /**
   * Enforces a mandatory 3-day worker protection reserve while a contract is active.
   */
  static calculateReclaimableAmount(contract: ContractRecord): number {
    const daily = this.calculateDailyWage(contract.terms);
    const mandatoryReserve = contract.status === 'active' ? 3 * daily : 0;
    const held = this.getHeldAmount(contract.escrow);
    return Math.max(0, contract.escrow.lockedAmount - held - mandatoryReserve);
  }

  static calculateTrustSummary(contracts: ContractRecord[], currentTimeMs: number): TrustSummary {
    let onTimeCount = 0;
    let disputedCount = 0;
    let finalizedContracts = 0;

    for (const c of contracts) {
      if (c.status === 'active' && currentTimeMs >= c.cancelWindowEndsAtMs) {
        finalizedContracts++;
      }
      for (const day of c.escrow.days) {
        if (day.status === 'paid' || day.status === 'auto') onTimeCount++;
        if (day.status === 'disputed' || day.status === 'refunded') disputedCount++;
      }
    }

    const points = Math.max(0, finalizedContracts * 20 + onTimeCount * 10 - disputedCount * 5);
    const tiers: Array<{ name: TrustSummary['tierName']; min: number }> = [
      { name: 'New', min: 0 },
      { name: 'Building', min: 20 },
      { name: 'Reliable', min: 60 },
      { name: 'Trusted', min: 120 },
    ];

    let tierIndex = 0;
    tiers.forEach((tier, idx) => {
      if (points >= tier.min) tierIndex = idx;
    });

    const totalSettled = onTimeCount + disputedCount;
    return {
      tierName: tiers[tierIndex].name,
      tierIndex,
      points,
      nextTierPoints: tierIndex < tiers.length - 1 ? tiers[tierIndex + 1].min - points : null,
      onTimeCount,
      disputedCount,
      finalizedContracts,
      onTimeRate: totalSettled > 0 ? Math.round((onTimeCount / totalSettled) * 100) : 100,
    };
  }
}
