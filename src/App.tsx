import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ContractRecord,
  ContractStatus,
  ContractTerms,
  EscrowDayEntry,
  LanguageCode,
  LenderShareRecord,
  PaydaySchedule,
  Role,
  WageUnit,
  WalletTransaction,
  WorkCategory,
} from './types/contract';
import { DAY_INITIALS, LANGUAGES } from './i18n/languages';
import { CanonicalCryptoEngine } from './crypto/canonicalHash';
import { EscrowDomainEngine, TWENTY_FOUR_HOURS_MS } from './domain/escrowEngine';
import { useVoiceKaraoke } from './voice/useVoiceKaraoke';
import { KaraokeBox } from './components/KaraokeBox';
import { ContractQrCode } from './components/ContractQrCode';

const formatINR = (amount: number) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

type WorkerTab = 'work' | 'offers' | 'wallet' | 'trust';
type EmployerTab = 'roster' | 'create' | 'approvals' | 'wallet';

export default function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [workerTab, setWorkerTab] = useState<WorkerTab>('work');
  const [employerTab, setEmployerTab] = useState<EmployerTab>('roster');
  const [lang, setLang] = useState<LanguageCode>('en');
  const [darkMode, setDarkMode] = useState(false);
  const [voiceRate, setVoiceRate] = useState(0.92);
  const [simulatedDayOffset, setSimulatedDayOffset] = useState(0);

  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [employerWallet, setEmployerWallet] = useState(8500);
  const [workerWallet, setWorkerWallet] = useState(550);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [lenderShares, setLenderShares] = useState<LenderShareRecord[]>([]);
  const [heardOffers, setHeardOffers] = useState<Record<string, boolean>>({});
  const [pieceCounts, setPieceCounts] = useState<Record<string, number>>({});
  const [verificationStatus, setVerificationStatus] = useState<
    Record<string, { valid: boolean; reason: string }>
  >({});
  const [auditPackContract, setAuditPackContract] = useState<ContractRecord | null>(null);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Non-extractable WebCrypto identity keypairs
  const employerKeysRef = useRef<CryptoKeyPair | null>(null);
  const workerKeysRef = useRef<CryptoKeyPair | null>(null);

  // Offer Builder state
  const [draftEmployerName, setDraftEmployerName] = useState('Kalinga Builders');
  const [draftWorkerName, setDraftWorkerName] = useState('Sunita Devi');
  const [draftWork, setDraftWork] = useState<WorkCategory>('con');
  const [draftWage, setDraftWage] = useState(600);
  const [draftUnit, setDraftUnit] = useState<WageUnit>('day');
  const [draftDays, setDraftDays] = useState<number[]>([0, 1, 2, 3, 4, 5]);
  const [draftPayday, setDraftPayday] = useState<PaydaySchedule>(1);

  const voice = useVoiceKaraoke();
  const pack = LANGUAGES[lang];
  const currentTimeMs = Date.now() + simulatedDayOffset * TWENTY_FOUR_HOURS_MS;

  const notify = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((prev) => (prev === msg ? null : prev)), 3000);
  }, []);

  const recordTx = useCallback(
    (actor: Role, kind: WalletTransaction['kind'], amount: number, note: string, tsIso: string) => {
      setTransactions((prev) => [
        { id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, actor, kind, amount, note, timestamp: tsIso },
        ...prev,
      ]);
    },
    []
  );

  // Initialize non-extractable keys & realistic demo contracts
  useEffect(() => {
    let active = true;
    (async () => {
      const empKeys = await CanonicalCryptoEngine.generateIdentityKeyPair();
      const wrkKeys = await CanonicalCryptoEngine.generateIdentityKeyPair();
      employerKeysRef.current = empKeys;
      workerKeysRef.current = wrkKeys;

      const base = Date.now();
      const t1: ContractTerms = {
        id: 'SB4829A',
        employerId: 'emp_kalinga_01',
        employerName: 'Kalinga Builders',
        workerId: 'wrk_ramesh_01',
        workerName: 'Ramesh Nayak',
        work: 'con',
        wage: 550,
        per: 'day',
        days: [0, 1, 2, 3, 4, 5],
        pd: 1,
        lang: 'od',
        createdAt: new Date(base - TWENTY_FOUR_HOURS_MS * 4).toISOString(),
      };
      const h1 = await CanonicalCryptoEngine.hashTerms(t1);
      const empSig1 = await CanonicalCryptoEngine.signHash(t1.employerId, empKeys, h1);
      const wrkSig1 = await CanonicalCryptoEngine.signHash(t1.workerId, wrkKeys, h1);

      const c1Base: ContractRecord = {
        terms: t1,
        canonicalHash: h1,
        cancelWindowEndsAtMs: base - TWENTY_FOUR_HOURS_MS * 3,
        status: 'active',
        events: [],
        escrow: {
          lockedAmount: 2750,
          days: [
            {
              id: 'day_seed_1',
              dateKey: new Date(base - TWENTY_FOUR_HOURS_MS * 2).toISOString().slice(0, 10),
              status: 'paid',
              loggedAtMs: base - TWENTY_FOUR_HOURS_MS * 2,
              amount: 550,
              note: 'Verified shift check-in',
            },
            {
              id: 'day_seed_2',
              dateKey: new Date(base).toISOString().slice(0, 10),
              status: 'pending',
              loggedAtMs: base - 3 * 3600 * 1000,
              amount: 550,
              note: 'Verified shift check-in',
            },
          ],
        },
        signatures: { employer: empSig1, worker: wrkSig1 },
      };

      const ev1 = await CanonicalCryptoEngine.appendChainEvent(
        c1Base,
        'CHECKIN',
        true,
        550,
        new Date(base - TWENTY_FOUR_HOURS_MS * 2).toISOString()
      );
      c1Base.events.push(ev1);
      const ev2 = await CanonicalCryptoEngine.appendChainEvent(
        c1Base,
        'PAYOUT_APPROVED',
        true,
        550,
        new Date(base - TWENTY_FOUR_HOURS_MS * 2 + 3600 * 1000).toISOString()
      );
      c1Base.events.push(ev2);

      const t2: ContractTerms = {
        id: 'SB9104K',
        employerId: 'emp_meera_02',
        employerName: 'Meera Sharma',
        workerId: 'wrk_sunita_02',
        workerName: 'Sunita Devi',
        work: 'dom',
        wage: 6500,
        per: 'month',
        days: [0, 1, 2, 3, 4, 5, 6],
        pd: 2,
        lang: 'hi',
        createdAt: new Date(base - 2 * 3600 * 1000).toISOString(),
      };
      const h2 = await CanonicalCryptoEngine.hashTerms(t2);
      const empSig2 = await CanonicalCryptoEngine.signHash(t2.employerId, empKeys, h2);

      const c2: ContractRecord = {
        terms: t2,
        canonicalHash: h2,
        cancelWindowEndsAtMs: base + TWENTY_FOUR_HOURS_MS,
        status: 'offer',
        events: [],
        escrow: { lockedAmount: 3000, days: [] },
        signatures: { employer: empSig2, worker: null },
      };

      if (active) {
        setContracts([c1Base, c2]);
        setTransactions([
          { id: 'tx_1', actor: 'worker', kind: 'payout', amount: 550, note: 'SB4829A · Approved', timestamp: ev2.timestamp },
          { id: 'tx_2', actor: 'employer', kind: 'fund', amount: 3300, note: 'SB4829A · 6 days escrow', timestamp: t1.createdAt },
          { id: 'tx_3', actor: 'employer', kind: 'topup', amount: 11800, note: 'UPI Deposit', timestamp: new Date(base - TWENTY_FOUR_HOURS_MS * 5).toISOString() },
        ]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // 24-hour Automatic Escrow Release Sweep
  useEffect(() => {
    (async () => {
      let anyUpdated = false;
      let releasedTotal = 0;

      const updatedList = await Promise.all(
        contracts.map(async (c) => {
          if (c.status !== 'active') return c;
          let locked = c.escrow.lockedAmount;
          const nextEvents = [...c.events];
          const nextDays = [...c.escrow.days];
          let contractChanged = false;

          for (let i = 0; i < nextDays.length; i++) {
            const d = nextDays[i];
            if (
              d.status === 'pending' &&
              currentTimeMs - d.loggedAtMs >= TWENTY_FOUR_HOURS_MS &&
              locked >= d.amount
            ) {
              locked -= d.amount;
              releasedTotal += d.amount;
              nextDays[i] = { ...d, status: 'auto' };
              const ts = new Date(currentTimeMs).toISOString();
              const ev = await CanonicalCryptoEngine.appendChainEvent(
                { ...c, events: nextEvents },
                'PAYOUT_AUTO',
                true,
                d.amount,
                ts
              );
              nextEvents.push(ev);
              recordTx('worker', 'payout', d.amount, `${c.terms.id} · 24h Auto-Release`, ts);
              contractChanged = true;
              anyUpdated = true;
            }
          }

          return contractChanged
            ? { ...c, events: nextEvents, escrow: { lockedAmount: locked, days: nextDays } }
            : c;
        })
      );

      if (anyUpdated) {
        setContracts(updatedList);
        setWorkerWallet((w) => w + releasedTotal);
        notify(`24h elapsed: ${formatINR(releasedTotal)} auto-released from escrow to worker.`);
      }
    })();
  }, [currentTimeMs, contracts, notify, recordTx]);

  // Actions
  const handleCreateOffer = async () => {
    if (!employerKeysRef.current || draftWage <= 0 || draftDays.length === 0) {
      notify('Enter a valid wage and select at least one working day.');
      return;
    }

    const ts = new Date(currentTimeMs).toISOString();
    const newTerms: ContractTerms = {
      id: `SB${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      employerId: 'emp_kalinga_01',
      employerName: draftEmployerName.trim() || 'Employer',
      workerId: 'wrk_worker_01',
      workerName: draftWorkerName.trim() || 'Worker',
      work: draftWork,
      wage: draftWage,
      per: draftUnit,
      days: [...draftDays].sort((a, b) => a - b),
      pd: draftPayday,
      lang,
      createdAt: ts,
    };

    const hash = await CanonicalCryptoEngine.hashTerms(newTerms);
    const sig = await CanonicalCryptoEngine.signHash(newTerms.employerId, employerKeysRef.current, hash);

    const created: ContractRecord = {
      terms: newTerms,
      canonicalHash: hash,
      cancelWindowEndsAtMs: currentTimeMs + TWENTY_FOUR_HOURS_MS,
      status: 'offer',
      events: [],
      escrow: { lockedAmount: 0, days: [] },
      signatures: { employer: sig, worker: null },
    };

    setContracts((prev) => [created, ...prev]);
    setEmployerTab('roster');
    notify(`Offer ${newTerms.id} cryptographically signed & sent.`);
  };

  const handleWorkerSign = async (contractId: string) => {
    if (!workerKeysRef.current) return;
    if (!heardOffers[contractId]) {
      notify('Please tap Listen and hear the full summary before signing.');
      return;
    }

    const next = await Promise.all(
      contracts.map(async (c) => {
        if (c.terms.id !== contractId) return c;
        const workerSig = await CanonicalCryptoEngine.signHash(
          c.terms.workerId,
          workerKeysRef.current!,
          c.canonicalHash
        );
        return {
          ...c,
          status: 'active' as ContractStatus,
          cancelWindowEndsAtMs: currentTimeMs + TWENTY_FOUR_HOURS_MS,
          signatures: { ...c.signatures, worker: workerSig },
        };
      })
    );

    setContracts(next);
    setWorkerTab('work');
    notify('Signed! Contract active with 24-hour worker cancellation protection.');
  };

  const handleWorkerWithdraw = (contractId: string) => {
    setContracts((prev) =>
      prev.map((c) => (c.terms.id === contractId ? { ...c, status: 'withdrawn' } : c))
    );
    notify('Agreement withdrawn within 24-hour cooling-off window.');
  };

  const handleFundEscrow = (contractId: string, daysToLock: number) => {
    setContracts((prev) =>
      prev.map((c) => {
        if (c.terms.id !== contractId) return c;
        const amount = daysToLock * EscrowDomainEngine.calculateDailyWage(c.terms);
        if (employerWallet < amount) {
          notify('Insufficient Employer wallet balance. Add funds first.');
          return c;
        }
        setEmployerWallet((w) => w - amount);
        recordTx('employer', 'fund', amount, `${c.terms.id} · ${daysToLock}d escrow`, new Date(currentTimeMs).toISOString());
        notify(`Locked ${formatINR(amount)} into escrow.`);
        return { ...c, escrow: { ...c.escrow, lockedAmount: c.escrow.lockedAmount + amount } };
      })
    );
  };

  const handleReclaimEscrow = (contractId: string) => {
    setContracts((prev) =>
      prev.map((c) => {
        if (c.terms.id !== contractId) return c;
        const spare = EscrowDomainEngine.calculateReclaimableAmount(c);
        if (spare <= 0) {
          notify('Mandatory 3-day worker protection reserve must remain locked.');
          return c;
        }
        setEmployerWallet((w) => w + spare);
        recordTx('employer', 'refund', spare, `${c.terms.id} · Reclaimed spare`, new Date(currentTimeMs).toISOString());
        notify(`Reclaimed ${formatINR(spare)} back to Employer wallet.`);
        return { ...c, escrow: { ...c.escrow, lockedAmount: c.escrow.lockedAmount - spare } };
      })
    );
  };

  const handleWorkerCheckIn = async (contractId: string) => {
    const updated = await Promise.all(
      contracts.map(async (c) => {
        if (c.terms.id !== contractId) return c;
        const qty = Math.max(1, pieceCounts[contractId] || 10);
        const amount =
          c.terms.per === 'piece' ? qty * c.terms.wage : EscrowDomainEngine.calculateDailyWage(c.terms);
        const note = c.terms.per === 'piece' ? `${qty} pcs × ${formatINR(c.terms.wage)}` : 'Daily shift check-in';
        const ts = new Date(currentTimeMs).toISOString();
        const ev = await CanonicalCryptoEngine.appendChainEvent(c, 'CHECKIN', true, amount, ts);
        const entry: EscrowDayEntry = {
          id: `day_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          dateKey: ts.slice(0, 10),
          status: 'pending',
          loggedAtMs: currentTimeMs,
          amount,
          note,
        };
        return {
          ...c,
          events: [...c.events, ev],
          escrow: { ...c.escrow, days: [...c.escrow.days, entry] },
        };
      })
    );
    setContracts(updated);
    notify('Work logged! Releases on approval or auto-pays in 24h.');
  };

  const handleApproveDay = async (contractId: string, dayId: string) => {
    const updated = await Promise.all(
      contracts.map(async (c) => {
        if (c.terms.id !== contractId) return c;
        const target = c.escrow.days.find((d) => d.id === dayId);
        if (!target || target.status !== 'pending') return c;
        if (c.escrow.lockedAmount < target.amount) {
          notify('Not enough escrow locked. Lock funds first.');
          return c;
        }
        const ts = new Date(currentTimeMs).toISOString();
        const ev = await CanonicalCryptoEngine.appendChainEvent(c, 'PAYOUT_APPROVED', true, target.amount, ts);
        setWorkerWallet((w) => w + target.amount);
        recordTx('worker', 'payout', target.amount, `${c.terms.id} · Approved`, ts);
        notify(`Approved & paid ${formatINR(target.amount)}.`);
        return {
          ...c,
          events: [...c.events, ev],
          escrow: {
            lockedAmount: c.escrow.lockedAmount - target.amount,
            days: c.escrow.days.map((d) => (d.id === dayId ? { ...d, status: 'paid' } : d)),
          },
        };
      })
    );
    setContracts(updated);
  };

  const handleDisputeDay = async (contractId: string, dayId: string) => {
    const updated = await Promise.all(
      contracts.map(async (c) => {
        if (c.terms.id !== contractId) return c;
        const target = c.escrow.days.find((d) => d.id === dayId);
        if (!target) return c;
        const ts = new Date(currentTimeMs).toISOString();
        const ev = await CanonicalCryptoEngine.appendChainEvent(c, 'DISPUTED', false, target.amount, ts);
        return {
          ...c,
          events: [...c.events, ev],
          escrow: {
            ...c.escrow,
            days: c.escrow.days.map((d) => (d.id === dayId ? { ...d, status: 'disputed' } : d)),
          },
        };
      })
    );
    setContracts(updated);
    notify('Day flagged as disputed. Other workdays remain unaffected.');
  };

  const handleResolveDispute = async (contractId: string, dayId: string, payWorker: boolean) => {
    const updated = await Promise.all(
      contracts.map(async (c) => {
        if (c.terms.id !== contractId) return c;
        const target = c.escrow.days.find((d) => d.id === dayId);
        if (!target) return c;
        const ts = new Date(currentTimeMs).toISOString();
        const ev = await CanonicalCryptoEngine.appendChainEvent(
          c,
          'DISPUTE_RESOLVED',
          payWorker,
          target.amount,
          ts
        );
        if (payWorker) {
          setWorkerWallet((w) => w + target.amount);
          recordTx('worker', 'payout', target.amount, `${c.terms.id} · Dispute settled`, ts);
        } else {
          setEmployerWallet((w) => w + target.amount);
          recordTx('employer', 'refund', target.amount, `${c.terms.id} · Dispute refund`, ts);
        }
        return {
          ...c,
          events: [...c.events, ev],
          escrow: {
            lockedAmount: c.escrow.lockedAmount - target.amount,
            days: c.escrow.days.map((d) =>
              d.id === dayId ? { ...d, status: payWorker ? 'paid' : 'refunded' } : d
            ),
          },
        };
      })
    );
    setContracts(updated);
    notify(payWorker ? 'Dispute resolved: Worker paid.' : 'Dispute resolved: Refunded to Employer.');
  };

  const handleVerifyIntegrity = async (contract: ContractRecord) => {
    const result = await CanonicalCryptoEngine.verifyContractIntegrity(contract);
    setVerificationStatus((prev) => ({ ...prev, [contract.terms.id]: result }));
  };

  const handleSimulateTamper = (contractId: string) => {
    setContracts((prev) =>
      prev.map((c) =>
        c.terms.id === contractId ? { ...c, terms: { ...c.terms, wage: c.terms.wage + 100 } } : c
      )
    );
    notify('Simulated unauthorized +₹100 edit. Click Verify Integrity.');
  };

  const handleShareTrustWithLender = async () => {
    const digest = await CanonicalCryptoEngine.sha256Hex(
      `${trust.tierName}|${trust.onTimeRate}|${trust.finalizedContracts}|${currentTimeMs}`
    );
    setLenderShares((prev) => [
      {
        id: `sh_${Date.now()}`,
        tierName: trust.tierName,
        onTimeRate: trust.onTimeRate,
        finalizedContracts: trust.finalizedContracts,
        sharedAt: new Date(currentTimeMs).toISOString(),
        credentialDigest: digest.slice(0, 20),
      },
      ...prev,
    ]);
    notify(`Consent-logged "${trust.tierName}" tier proof generated.`);
  };

  const trust = useMemo(
    () => EscrowDomainEngine.calculateTrustSummary(contracts, currentTimeMs),
    [contracts, currentTimeMs]
  );

  const pendingOffersCount = contracts.filter((c) => c.status === 'offer').length;
  const pendingApprovalsCount = contracts.reduce(
    (sum, c) => sum + c.escrow.days.filter((d) => d.status === 'pending' || d.status === 'disputed').length,
    0
  );

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div
        dir={pack.rtl ? 'rtl' : 'ltr'}
        className="min-h-screen bg-[#f6f3ea] dark:bg-[#0e0d24] text-[#17153b] dark:text-[#f7efdc] font-sans transition-colors pb-20"
      >
        {/* Sticky Topbar */}
        <header className="sticky top-0 z-20 bg-[#17153b] dark:bg-[#211e52] text-white border-b-4 border-[#f4a300] px-4 py-3">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setRole(null)}
              className="flex items-center gap-2.5 font-display font-black text-xl tracking-tight text-white"
            >
              <span className="w-7 h-7 rounded-full bg-[#f4a300] text-[#17153b] grid place-items-center text-sm font-black">
                ✓
              </span>
              <span>Saboot</span>
              <span className="text-[11px] font-sans uppercase tracking-wider bg-white/15 text-[#f4a300] px-2 py-0.5 rounded-full">
                23 Voices
              </span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-white/10 border border-white/25 rounded-xl p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setRole('worker')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    role === 'worker' ? 'bg-[#f4a300] text-[#17153b]' : 'text-white/80 hover:text-white'
                  }`}
                >
                  {pack.ui.worker}
                </button>
                <button
                  type="button"
                  onClick={() => setRole('employer')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    role === 'employer' ? 'bg-teal-400 text-[#062925]' : 'text-white/80 hover:text-white'
                  }`}
                >
                  {pack.ui.employer}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setLangModalOpen(true)}
                className="border border-white/25 bg-white/10 hover:bg-white/20 rounded-xl px-3 py-1.5 text-xs font-bold"
              >
                🌐 {pack.nativeName}
              </button>

              <button
                type="button"
                aria-label="Toggle dark theme"
                onClick={() => setDarkMode((d) => !d)}
                className="border border-white/25 bg-white/10 hover:bg-white/20 rounded-xl px-2.5 py-1.5 text-xs font-bold"
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </header>

        {/* Onboarding Role Selection */}
        {!role ? (
          <main className="max-w-4xl mx-auto px-4 pt-10 space-y-6">
            <div>
              <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tight">
                Choose your workspace
              </h1>
              <p className="text-slate-600 dark:text-slate-300 mt-1 text-sm sm:text-base">
                Saboot separates Employer and Employee interfaces so each side gets tools built for their exact needs.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div
                onClick={() => setRole('worker')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setRole('worker')}
                className="cursor-pointer bg-[#fffdf7] dark:bg-[#18163a] border-2 border-[#17153b] dark:border-indigo-400 rounded-3xl p-6 shadow-[5px_5px_0_#17153b] hover:-translate-y-0.5 transition flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-black text-2xl">Employee / Worker</h2>
                  <span className="text-xs font-bold bg-amber-100 text-amber-900 border border-amber-400 px-2.5 py-1 rounded-full">
                    Voice-First
                  </span>
                </div>
                <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-2 list-disc pl-5">
                  <li>
                    <strong>Listen before signing:</strong> Mandatory spoken terms in all 23 Indian languages.
                  </li>
                  <li>
                    <strong>One-tap daily proof:</strong> Auto-pays in 24h if an employer delays approval.
                  </li>
                  <li>
                    <strong>24h private cancel:</strong> Walk away safely within 24 hours of signing.
                  </li>
                  <li>
                    <strong>Portable trust score:</strong> Share tier-only proof with microfinance lenders.
                  </li>
                </ul>
                <span className="mt-auto inline-flex justify-center items-center bg-[#f4a300] text-[#17153b] border-2 border-[#17153b] rounded-xl py-2.5 font-bold text-sm shadow-[3px_3px_0_#17153b]">
                  Enter Employee UI →
                </span>
              </div>

              <div
                onClick={() => setRole('employer')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setRole('employer')}
                className="cursor-pointer bg-[#fffdf7] dark:bg-[#18163a] border-2 border-[#17153b] dark:border-indigo-400 rounded-3xl p-6 shadow-[5px_5px_0_#17153b] hover:-translate-y-0.5 transition flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-black text-2xl">Employer / Contractor</h2>
                  <span className="text-xs font-bold bg-teal-100 text-teal-900 border border-teal-400 px-2.5 py-1 rounded-full">
                    Escrow Control
                  </span>
                </div>
                <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-2 list-disc pl-5">
                  <li>
                    <strong>Offer Builder:</strong> Standardized micro-contracts with instant voice preview.
                  </li>
                  <li>
                    <strong>Escrow &amp; Piece-Rate Control:</strong> Lock wages upfront and approve shifts.
                  </li>
                  <li>
                    <strong>Tamper-Proof Audit Packs:</strong> Dual ECDSA P-256 signatures &amp; SHA-256 chains.
                  </li>
                  <li>
                    <strong>Business Wallet:</strong> Fund escrow reserves and reclaim excess funds safely.
                  </li>
                </ul>
                <span className="mt-auto inline-flex justify-center items-center bg-teal-400 text-[#052e2b] border-2 border-[#17153b] rounded-xl py-2.5 font-bold text-sm shadow-[3px_3px_0_#17153b]">
                  Enter Employer UI →
                </span>
              </div>
            </div>
          </main>
        ) : (
          /* Main Workspace */
          <div className="max-w-6xl mx-auto px-4 pt-6 grid grid-cols-1 md:grid-cols-[230px_1fr] gap-6">
            {/* Sidebar */}
            <aside className="space-y-3">
              <nav className="bg-[#fffdf7] dark:bg-[#18163a] border-2 border-[#17153b] dark:border-indigo-400 rounded-2xl p-2.5 shadow-[3px_3px_0_#17153b] flex md:flex-col gap-1 overflow-x-auto">
                {role === 'worker' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setWorkerTab('work')}
                      className={`px-3 py-2.5 rounded-xl text-sm font-bold text-left whitespace-nowrap ${
                        workerTab === 'work'
                          ? 'bg-[#f4a300] text-[#17153b] border-2 border-[#17153b]'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      My Work
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkerTab('offers')}
                      className={`px-3 py-2.5 rounded-xl text-sm font-bold text-left flex items-center justify-between gap-2 whitespace-nowrap ${
                        workerTab === 'offers'
                          ? 'bg-[#f4a300] text-[#17153b] border-2 border-[#17153b]'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <span>{pack.ui.offers}</span>
                      {pendingOffersCount > 0 && (
                        <span className="bg-[#17153b] text-white text-xs px-2 py-0.5 rounded-full">
                          {pendingOffersCount}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkerTab('wallet')}
                      className={`px-3 py-2.5 rounded-xl text-sm font-bold text-left whitespace-nowrap ${
                        workerTab === 'wallet'
                          ? 'bg-[#f4a300] text-[#17153b] border-2 border-[#17153b]'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {pack.ui.wallet}
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkerTab('trust')}
                      className={`px-3 py-2.5 rounded-xl text-sm font-bold text-left whitespace-nowrap ${
                        workerTab === 'trust'
                          ? 'bg-[#f4a300] text-[#17153b] border-2 border-[#17153b]'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {pack.ui.trust}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setEmployerTab('roster')}
                      className={`px-3 py-2.5 rounded-xl text-sm font-bold text-left whitespace-nowrap ${
                        employerTab === 'roster'
                          ? 'bg-teal-400 text-[#052e2b] border-2 border-[#17153b]'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {pack.ui.roster}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmployerTab('create')}
                      className={`px-3 py-2.5 rounded-xl text-sm font-bold text-left whitespace-nowrap ${
                        employerTab === 'create'
                          ? 'bg-teal-400 text-[#052e2b] border-2 border-[#17153b]'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      + {pack.ui.createOffer}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmployerTab('approvals')}
                      className={`px-3 py-2.5 rounded-xl text-sm font-bold text-left flex items-center justify-between gap-2 whitespace-nowrap ${
                        employerTab === 'approvals'
                          ? 'bg-teal-400 text-[#052e2b] border-2 border-[#17153b]'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <span>Approvals</span>
                      {pendingApprovalsCount > 0 && (
                        <span className="bg-[#17153b] text-white text-xs px-2 py-0.5 rounded-full">
                          {pendingApprovalsCount}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmployerTab('wallet')}
                      className={`px-3 py-2.5 rounded-xl text-sm font-bold text-left whitespace-nowrap ${
                        employerTab === 'wallet'
                          ? 'bg-teal-400 text-[#052e2b] border-2 border-[#17153b]'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {pack.ui.wallet}
                    </button>
                  </>
                )}
              </nav>

              <div className="bg-[#fffdf7] dark:bg-[#18163a] border-2 border-[#17153b] dark:border-indigo-400 rounded-2xl p-3.5 shadow-[3px_3px_0_#17153b] text-xs space-y-2">
                <div className="font-bold">Demo Time Machine</div>
                <p className="text-slate-500 dark:text-slate-400">
                  Simulated offset: <strong>+{simulatedDayOffset} day(s)</strong>
                </p>
                <button
                  type="button"
                  onClick={() => setSimulatedDayOffset((d) => d + 1)}
                  className="w-full bg-amber-200 hover:bg-amber-300 text-[#17153b] border border-[#17153b] rounded-xl py-1.5 font-bold"
                >
                  Simulate +24 Hours →
                </button>
              </div>
            </aside>

            {/* Primary Content Area */}
            <main className="space-y-5">
              {/* EMPLOYER: CREATE OFFER */}
              {role === 'employer' && employerTab === 'create' && (
                <section className="bg-[#fffdf7] dark:bg-[#18163a] border-2 border-[#17153b] dark:border-indigo-400 rounded-2xl p-5 shadow-[5px_5px_0_#17153b] space-y-4">
                  <h1 className="font-display font-black text-2xl">{pack.ui.createOffer}</h1>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold mb-1">Employer / Business Name</label>
                      <input
                        value={draftEmployerName}
                        onChange={(e) => setDraftEmployerName(e.target.value)}
                        className="w-full border-2 border-[#17153b] rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Employee Name</label>
                      <input
                        value={draftWorkerName}
                        onChange={(e) => setDraftWorkerName(e.target.value)}
                        className="w-full border-2 border-[#17153b] rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5">Work Category</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {(Object.entries(pack.workLabels) as [WorkCategory, string][]).map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setDraftWork(k)}
                          className={`border-2 border-[#17153b] rounded-xl py-2.5 px-3 text-xs font-bold transition ${
                            draftWork === k ? 'bg-teal-300 text-[#052e2b]' : 'bg-white text-slate-900'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold mb-1">Wage (₹)</label>
                      <input
                        type="number"
                        min={1}
                        value={draftWage}
                        onChange={(e) => setDraftWage(Number(e.target.value))}
                        className="w-full border-2 border-[#17153b] rounded-xl px-3 py-2 text-base font-black bg-white text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Rate Unit</label>
                      <select
                        value={draftUnit}
                        onChange={(e) => setDraftUnit(e.target.value as WageUnit)}
                        className="w-full border-2 border-[#17153b] rounded-xl px-3 py-2 text-sm font-bold bg-white text-slate-900"
                      >
                        {(Object.entries(pack.unitLabels) as [WageUnit, string][]).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Payday Schedule</label>
                      <select
                        value={draftPayday}
                        onChange={(e) => setDraftPayday(Number(e.target.value) as PaydaySchedule)}
                        className="w-full border-2 border-[#17153b] rounded-xl px-3 py-2 text-sm font-bold bg-white text-slate-900"
                      >
                        {pack.paydayLabels.map((label, idx) => (
                          <option key={idx} value={idx}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5">Working Days</label>
                    <div className="flex gap-2">
                      {DAY_INITIALS.map((d, idx) => {
                        const selected = draftDays.includes(idx);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() =>
                              setDraftDays((prev) =>
                                prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]
                              )
                            }
                            className={`w-9 h-9 rounded-full border-2 border-[#17153b] text-xs font-extrabold ${
                              selected ? 'bg-[#17153b] text-white' : 'bg-white text-slate-900'
                            }`}
                          >
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-bold mb-1">Live Voice Preview ({pack.nativeName})</div>
                    <KaraokeBox
                      text={pack.formatSummary(
                        pack.workLabels[draftWork],
                        draftWage,
                        pack.unitLabels[draftUnit],
                        draftDays.length,
                        draftPayday
                      )}
                      isActive={voice.speakingId === 'draft'}
                      activeWordIndex={voice.activeWordIndex}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        voice.speak(
                          'draft',
                          pack.formatSummary(
                            pack.workLabels[draftWork],
                            draftWage,
                            pack.unitLabels[draftUnit],
                            draftDays.length,
                            draftPayday
                          ),
                          pack.code,
                          voiceRate
                        )
                      }
                      className="border-2 border-[#17153b] bg-white text-slate-900 rounded-xl px-4 py-2 text-xs font-bold"
                    >
                      🔊 Preview Voice
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateOffer}
                      className="border-2 border-[#17153b] bg-teal-400 text-[#052e2b] rounded-xl px-5 py-2 text-sm font-bold shadow-[3px_3px_0_#17153b]"
                    >
                      ✓ Sign &amp; Send Offer
                    </button>
                  </div>
                </section>
              )}

              {/* EMPLOYER: APPROVALS QUEUE */}
              {role === 'employer' && employerTab === 'approvals' && (
                <section className="space-y-4">
                  <h1 className="font-display font-black text-2xl">Attendance &amp; Pay Approvals</h1>
                  {pendingApprovalsCount === 0 ? (
                    <div className="bg-[#fffdf7] dark:bg-[#18163a] border-2 border-[#17153b] rounded-2xl p-6 text-sm text-slate-600 dark:text-slate-300">
                      All caught up! No pending worker check-ins waiting for approval.
                    </div>
                  ) : (
                    contracts.flatMap((c) =>
                      c.escrow.days
                        .filter((d) => d.status === 'pending' || d.status === 'disputed')
                        .map((d) => (
                          <div
                            key={d.id}
                            className="bg-[#fffdf7] dark:bg-[#18163a] border-2 border-[#17153b] rounded-2xl p-4 shadow-[4px_4px_0_#17153b] flex flex-wrap items-center justify-between gap-3"
                          >
                            <div>
                              <div className="font-bold text-base">
                                {c.terms.workerName} · {c.terms.id}
                              </div>
                              <div className="text-xs text-slate-500">
                                {d.dateKey} · <strong>{formatINR(d.amount)}</strong> ({d.note}) · Escrow locked:{' '}
                                {formatINR(c.escrow.lockedAmount)}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {d.status === 'pending' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApproveDay(c.terms.id, d.id)}
                                    className="bg-teal-400 text-[#052e2b] border-2 border-[#17153b] rounded-xl px-3.5 py-1.5 text-xs font-bold"
                                  >
                                    ✓ {pack.ui.approvePay}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDisputeDay(c.terms.id, d.id)}
                                    className="bg-rose-100 text-rose-800 border-2 border-[#17153b] rounded-xl px-3.5 py-1.5 text-xs font-bold"
                                  >
                                    Flag Dispute
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleResolveDispute(c.terms.id, d.id, true)}
                                    className="bg-teal-400 text-[#052e2b] border-2 border-[#17153b] rounded-xl px-3 py-1.5 text-xs font-bold"
                                  >
                                    Pay Worker
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleResolveDispute(c.terms.id, d.id, false)}
                                    className="bg-white text-slate-900 border-2 border-[#17153b] rounded-xl px-3 py-1.5 text-xs font-bold"
                                  >
                                    Refund Employer
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))
                    )
                  )}
                </section>
              )}

              {/* WORKER & EMPLOYER WALLETS */}
              {((role === 'worker' && workerTab === 'wallet') ||
                (role === 'employer' && employerTab === 'wallet')) && (
                <section className="space-y-4">
                  <h1 className="font-display font-black text-2xl">
                    {role === 'employer' ? 'Employer Escrow Wallet' : 'Employee Earnings Wallet'}
                  </h1>
                  <div className="bg-[#fffdf7] dark:bg-[#18163a] border-2 border-[#17153b] rounded-2xl p-6 shadow-[4px_4px_0_#17153b] text-center space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Available Balance
                    </div>
                    <div className="font-display font-black text-4xl">
                      {formatINR(role === 'employer' ? employerWallet : workerWallet)}
                    </div>
                    {role === 'employer' ? (
                      <div className="flex flex-wrap justify-center gap-2 pt-2">
                        {[1000, 2500, 5000, 10000].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => {
                              setEmployerWallet((w) => w + amt);
                              recordTx('employer', 'topup', amt, 'Simulated UPI Deposit', new Date(currentTimeMs).toISOString());
                              notify(`+${formatINR(amt)} added to Employer wallet.`);
                            }}
                            className="border-2 border-[#17153b] bg-white text-slate-900 rounded-full px-3.5 py-1 text-xs font-bold shadow-[2px_2px_0_#17153b]"
                          >
                            +{formatINR(amt)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={workerWallet <= 0}
                        onClick={() => {
                          const payout = workerWallet;
                          setWorkerWallet(0);
                          recordTx('worker', 'withdraw', payout, 'Instant UPI Withdrawal', new Date(currentTimeMs).toISOString());
                          notify(`${formatINR(payout)} withdrawn to UPI.`);
                        }}
                        className="bg-[#f4a300] disabled:opacity-40 text-[#17153b] border-2 border-[#17153b] rounded-xl px-5 py-2.5 text-sm font-bold shadow-[3px_3px_0_#17153b]"
                      >
                        Withdraw to UPI
                      </button>
                    )}
                  </div>

                  <div className="bg-[#fffdf7] dark:bg-[#18163a] border-2 border-[#17153b] rounded-2xl p-5 shadow-[4px_4px_0_#17153b] space-y-2">
                    <h2 className="font-bold text-base">Ledger History</h2>
                    {transactions
                      .filter((t) => t.actor === role)
                      .map((t) => (
                        <div
                          key={t.id}
                          className="flex justify-between items-center py-2 border-t border-slate-200 dark:border-slate-700 text-xs"
                        >
                          <div>
                            <strong>{formatINR(t.amount)}</strong> · {t.note}
                          </div>
                          <span className="text-slate-500">
                            {new Date(t.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                  </div>
                </section>
              )}

              {/* WORKER: PORTABLE TRUST & LENDER SHARING */}
              {role === 'worker' && workerTab === 'trust' && (
                <section className="space-y-4">
                  <h1 className="font-display font-black text-2xl">Portable {pack.ui.trust}</h1>
                  <div className="bg-[#fffdf7] dark:bg-[#18163a] border-2 border-[#17153b] rounded-2xl p-6 shadow-[4px_4px_0_#17153b] space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold uppercase text-slate-500">Verified Tier</div>
                        <div className="font-display font-black text-3xl">{trust.tierName}</div>
                      </div>
                      <div className="text-right text-xs">
                        <div>
                          <strong>{trust.points}</strong> trust points
                        </div>
                        <div>
                          <strong>{trust.onTimeRate}%</strong> on-time settlement
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {(['New', 'Building', 'Reliable', 'Trusted'] as const).map((tier, idx) => (
                        <div
                          key={tier}
                          className={`text-center py-2 rounded-xl text-xs font-bold ${
                            idx <= trust.tierIndex
                              ? 'bg-[#17153b] text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {tier}
                        </div>
                      ))}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Privacy guarantee: Microfinance lenders receive only your tier badge and on-time rate—never your employer names or exact wages.
                    </p>

                    <button
                      type="button"
                      onClick={handleShareTrustWithLender}
                      className="w-full bg-[#f4a300] text-[#17153b] border-2 border-[#17153b] rounded-xl py-2.5 text-sm font-bold shadow-[3px_3px_0_#17153b]"
                    >
                      Generate Consent-Logged Lender Proof (“{trust.tierName}”)
                    </button>

                    {lenderShares.map((sh) => (
                      <div
                        key={sh.id}
                        className="flex justify-between items-center text-xs border-t border-slate-200 pt-2"
                      >
                        <div>
                          <strong>Shared “{sh.tierName}”</strong> · Digest {sh.credentialDigest}…
                        </div>
                        <span className="bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                          Consent Logged
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* WORKER (WORK / OFFERS) OR EMPLOYER (ROSTER) CONTRACT CARDS */}
              {((role === 'worker' && (workerTab === 'work' || workerTab === 'offers')) ||
                (role === 'employer' && employerTab === 'roster')) && (
                <section className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h1 className="font-display font-black text-2xl">
                      {role === 'employer'
                        ? `${pack.ui.roster} & Contracts`
                        : workerTab === 'offers'
                        ? `Incoming ${pack.ui.offers} (${pendingOffersCount})`
                        : 'Active Work & Escrow'}
                    </h1>
                    {role === 'employer' && (
                      <button
                        type="button"
                        onClick={() => setEmployerTab('create')}
                        className="bg-teal-400 text-[#052e2b] border-2 border-[#17153b] rounded-xl px-3.5 py-1.5 text-xs font-bold shadow-[2px_2px_0_#17153b]"
                      >
                        + {pack.ui.createOffer}
                      </button>
                    )}
                  </div>

                  {contracts
                    .filter((c) => {
                      if (role === 'employer') return true;
                      if (workerTab === 'offers') return c.status === 'offer';
                      return c.status === 'active';
                    })
                    .map((c) => {
                      const { terms } = c;
                      const summaryText = pack.formatSummary(
                        pack.workLabels[terms.work],
                        terms.wage,
                        pack.unitLabels[terms.per],
                        terms.days.length,
                        terms.pd
                      );
                      const isSpeaking = voice.speakingId === terms.id;
                      const heard = Boolean(heardOffers[terms.id]);
                      const dailyWage = EscrowDomainEngine.calculateDailyWage(terms);
                      const securedDays = EscrowDomainEngine.getProtectedDaysCount(c);
                      const cancelOpen = c.status === 'active' && currentTimeMs < c.cancelWindowEndsAtMs;
                      const ver = verificationStatus[terms.id];

                      return (
                        <article
                          key={terms.id}
                          className="bg-[#fffdf7] dark:bg-[#18163a] border-2 border-[#17153b] dark:border-indigo-400 rounded-2xl overflow-hidden shadow-[5px_5px_0_#17153b]"
                        >
                          <div className="bg-[#17153b] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h2 className="font-display font-black text-lg">
                                {pack.workLabels[terms.work]} ·{' '}
                                {role === 'employer' ? terms.workerName : terms.employerName}
                              </h2>
                              <p className="text-xs text-white/75">
                                {terms.id} · {formatINR(terms.wage)} {pack.unitLabels[terms.per]} ·{' '}
                                {pack.paydayLabels[terms.pd]}
                              </p>
                            </div>
                            <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#f4a300] text-[#17153b] uppercase">
                              {c.status === 'offer'
                                ? 'Pending Worker Sign'
                                : cancelOpen
                                ? '24h Cancel Window'
                                : c.status}
                            </span>
                          </div>

                          <div className="p-5 space-y-4">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div className="space-y-2 flex-1 min-w-[220px]">
                                <div className="flex gap-1">
                                  {DAY_INITIALS.map((d, idx) => (
                                    <span
                                      key={idx}
                                      className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold ${
                                        terms.days.includes(idx)
                                          ? 'bg-[#17153b] text-white'
                                          : 'bg-slate-200 text-slate-500'
                                      }`}
                                    >
                                      {d}
                                    </span>
                                  ))}
                                </div>
                                <div className="inline-block bg-amber-100 text-slate-900 border border-[#17153b] rounded-lg px-2.5 py-1 text-xs font-bold">
                                  Match Symbols: {CanonicalCryptoEngine.deriveEmojiFingerprint(c.canonicalHash)}
                                </div>
                                <div className="font-mono text-[11px] text-slate-500 break-all">
                                  SHA-256 {c.canonicalHash.slice(0, 32)}…
                                </div>
                              </div>

                              <ContractQrCode
                                contractId={terms.id}
                                hashPrefix={c.canonicalHash.slice(0, 16)}
                              />
                            </div>

                            <KaraokeBox
                              text={summaryText}
                              isActive={isSpeaking}
                              activeWordIndex={voice.activeWordIndex}
                            />

                            {/* Action Controls */}
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  voice.speak(terms.id, summaryText, pack.code, voiceRate, () => {
                                    setHeardOffers((prev) => ({ ...prev, [terms.id]: true }));
                                  })
                                }
                                className="bg-[#f4a300] text-[#17153b] border-2 border-[#17153b] rounded-xl px-3.5 py-1.5 text-xs font-bold shadow-[2px_2px_0_#17153b]"
                              >
                                🔊 {pack.ui.listen}
                              </button>

                              {role === 'worker' && c.status === 'offer' && (
                                <button
                                  type="button"
                                  disabled={!heard}
                                  onClick={() => handleWorkerSign(terms.id)}
                                  className="bg-teal-400 disabled:opacity-40 text-[#052e2b] border-2 border-[#17153b] rounded-xl px-3.5 py-1.5 text-xs font-bold shadow-[2px_2px_0_#17153b]"
                                >
                                  ✓ {pack.ui.sign}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleVerifyIntegrity(c)}
                                className="bg-white text-slate-900 border-2 border-[#17153b] rounded-xl px-3.5 py-1.5 text-xs font-bold"
                              >
                                🔍 Verify
                              </button>

                              <button
                                type="button"
                                onClick={() => setAuditPackContract(c)}
                                className="bg-white text-slate-900 border-2 border-[#17153b] rounded-xl px-3.5 py-1.5 text-xs font-bold"
                              >
                                📄 Audit Pack
                              </button>

                              {role === 'employer' && (
                                <button
                                  type="button"
                                  onClick={() => handleSimulateTamper(terms.id)}
                                  className="bg-rose-100 text-rose-800 border-2 border-[#17153b] rounded-xl px-3.5 py-1.5 text-xs font-bold"
                                >
                                  ⚠ Test Tamper
                                </button>
                              )}

                              {role === 'worker' && cancelOpen && (
                                <button
                                  type="button"
                                  onClick={() => handleWorkerWithdraw(terms.id)}
                                  className="bg-rose-100 text-rose-800 border-2 border-[#17153b] rounded-xl px-3.5 py-1.5 text-xs font-bold"
                                >
                                  ↩ Cancel (24h)
                                </button>
                              )}
                            </div>

                            {ver && (
                              <div
                                className={`text-xs font-bold px-3 py-2 rounded-xl border ${
                                  ver.valid
                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-400'
                                    : 'bg-rose-50 text-rose-900 border-rose-400'
                                }`}
                              >
                                {ver.valid ? '✓ ' : '✕ '}
                                {ver.reason}
                              </div>
                            )}

                            {/* Escrow & Daily Check-ins */}
                            {c.status === 'active' && (
                              <div className="border-2 border-dashed border-[#17153b] rounded-2xl p-4 bg-amber-50/50 dark:bg-white/5 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <span className="font-display font-black text-xl">
                                      {formatINR(c.escrow.lockedAmount)}
                                    </span>{' '}
                                    <span className="text-xs text-slate-500">locked in escrow</span>
                                  </div>
                                  <span
                                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                      securedDays >= 3
                                        ? 'bg-emerald-100 text-emerald-900'
                                        : 'bg-amber-200 text-amber-950'
                                    }`}
                                  >
                                    🔒 {securedDays} days secured
                                  </span>
                                </div>

                                {role === 'employer' ? (
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleFundEscrow(terms.id, 1)}
                                      className="bg-teal-400 text-[#052e2b] border-2 border-[#17153b] rounded-xl px-3 py-1.5 text-xs font-bold"
                                    >
                                      Lock 1 Day ({formatINR(dailyWage)})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleFundEscrow(terms.id, terms.days.length)}
                                      className="bg-teal-400 text-[#052e2b] border-2 border-[#17153b] rounded-xl px-3 py-1.5 text-xs font-bold"
                                    >
                                      Lock 1 Week ({formatINR(dailyWage * terms.days.length)})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleReclaimEscrow(terms.id)}
                                      className="bg-white text-slate-900 border-2 border-[#17153b] rounded-xl px-3 py-1.5 text-xs font-bold"
                                    >
                                      Reclaim Spare
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap items-center gap-2">
                                    {terms.per === 'piece' && (
                                      <input
                                        type="number"
                                        min={1}
                                        value={pieceCounts[terms.id] ?? 10}
                                        onChange={(e) =>
                                          setPieceCounts((prev) => ({
                                            ...prev,
                                            [terms.id]: Math.max(1, Number(e.target.value)),
                                          }))
                                        }
                                        aria-label="Piece count"
                                        className="w-20 border-2 border-[#17153b] rounded-xl px-2.5 py-1.5 text-xs font-bold bg-white text-slate-900"
                                      />
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleWorkerCheckIn(terms.id)}
                                      className="bg-[#f4a300] text-[#17153b] border-2 border-[#17153b] rounded-xl px-4 py-1.5 text-xs font-bold shadow-[2px_2px_0_#17153b]"
                                    >
                                      ✓ {pack.ui.workedToday}
                                    </button>
                                  </div>
                                )}

                                {c.escrow.days.length > 0 && (
                                  <div className="divide-y divide-slate-300 dark:divide-slate-700 pt-1">
                                    {[...c.escrow.days].reverse().map((d) => (
                                      <div
                                        key={d.id}
                                        className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                                      >
                                        <div>
                                          <strong>{d.dateKey}</strong> · {formatINR(d.amount)} ·{' '}
                                          <span className="text-slate-500">{d.note}</span>
                                        </div>
                                        {d.status === 'pending' && role === 'employer' ? (
                                          <div className="flex gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => handleApproveDay(terms.id, d.id)}
                                              className="bg-teal-400 text-[#052e2b] border border-[#17153b] rounded-lg px-2.5 py-1 font-bold"
                                            >
                                              Approve &amp; Pay
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDisputeDay(terms.id, d.id)}
                                              className="bg-rose-100 text-rose-800 border border-[#17153b] rounded-lg px-2.5 py-1 font-bold"
                                            >
                                              Dispute
                                            </button>
                                          </div>
                                        ) : (
                                          <span className="font-bold uppercase px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800">
                                            {d.status === 'auto' ? 'Auto-Paid (24h)' : d.status}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                </section>
              )}
            </main>
          </div>
        )}

        {/* Language Selector Modal (All 23 Languages) */}
        {langModalOpen && (
          <div
            onClick={() => setLangModalOpen(false)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs grid place-items-center p-4 z-40"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#fffdf7] dark:bg-[#18163a] border-2 border-[#17153b] rounded-3xl p-5 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display font-black text-xl">All 23 Scheduled Indian Languages</h2>
                <button
                  type="button"
                  onClick={() => setLangModalOpen(false)}
                  className="border-2 border-[#17153b] rounded-xl px-3 py-1 text-xs font-bold"
                >
                  Close
                </button>
              </div>

              <div className="flex items-center gap-3 bg-[#efe8d5] dark:bg-[#23204f] p-3 rounded-xl text-xs">
                <label className="font-bold">
                  Voice Speed:{' '}
                  <select
                    value={voiceRate}
                    onChange={(e) => setVoiceRate(Number(e.target.value))}
                    className="ml-1 rounded border border-[#17153b] px-2 py-1 bg-white text-slate-900"
                  >
                    <option value={0.7}>Slow (0.7x)</option>
                    <option value={0.92}>Normal (0.92x)</option>
                    <option value={1.15}>Fast (1.15x)</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {(Object.entries(LANGUAGES) as [LanguageCode, (typeof LANGUAGES)[LanguageCode]][]).map(
                  ([code, item]) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        voice.stop();
                        setLang(code);
                        setLangModalOpen(false);
                      }}
                      className={`border-2 border-[#17153b] rounded-2xl p-3 text-left transition ${
                        lang === code
                          ? 'bg-[#f4a300] text-[#17153b]'
                          : 'bg-white text-slate-900 hover:bg-amber-50'
                      }`}
                    >
                      <div className="font-bold text-base">{item.nativeName}</div>
                      <div className="text-xs opacity-75">
                        {item.englishName} ({item.code})
                      </div>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Audit Pack Modal */}
        {auditPackContract && (
          <div
            onClick={() => setAuditPackContract(null)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs grid place-items-center p-4 z-40"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#fffdf7] dark:bg-[#18163a] border-2 border-[#17153b] rounded-3xl p-5 max-w-lg w-full space-y-3"
            >
              <h2 className="font-display font-black text-xl">Verified Cryptographic Audit Pack</h2>
              <pre className="bg-[#efe8d5] dark:bg-[#23204f] p-3.5 rounded-xl text-xs font-mono whitespace-pre-wrap break-all">
                {`SABOOT VERIFIED RECORD ${auditPackContract.terms.id}
Employer: ${auditPackContract.terms.employerName}
Employee: ${auditPackContract.terms.workerName}
Work: ${LANGUAGES.en.workLabels[auditPackContract.terms.work]}
Wage: Rs ${auditPackContract.terms.wage} ${LANGUAGES.en.unitLabels[auditPackContract.terms.per]}
Escrow Locked: ${formatINR(auditPackContract.escrow.lockedAmount)}
Canonical SHA-256: ${auditPackContract.canonicalHash}
Events Logged: ${auditPackContract.events.length}
Status: ${auditPackContract.status.toUpperCase()}`}
              </pre>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(auditPackContract.canonicalHash);
                    notify('Contract SHA-256 copied to clipboard.');
                  }}
                  className="bg-[#f4a300] text-[#17153b] border-2 border-[#17153b] rounded-xl px-4 py-1.5 text-xs font-bold"
                >
                  Copy SHA-256
                </button>
                <button
                  type="button"
                  onClick={() => setAuditPackContract(null)}
                  className="border-2 border-[#17153b] rounded-xl px-4 py-1.5 text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div
            role="status"
            className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-[#17153b] text-[#f4a300] border-2 border-[#f4a300] px-4 py-2.5 rounded-xl text-xs font-bold shadow-xl z-50"
          >
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}
