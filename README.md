# Saboot — Voice-First Micro-Contracts & Wage Escrow

**Saboot** is a voice-first micro-contract and wage-escrow web application built for India's informal workforce. It supports **all 22 Scheduled Indian Languages + English**, tamper-evident **SHA-256 hash chaining**, **dual ECDSA P-256 digital signatures**, **4-symbol anti-impersonation fingerprints**, and **24-hour automatic escrow wage release**.

## Key Features
- **23-Language Voice & Karaoke Engine:** Mandatory spoken contract summaries with word-by-word karaoke highlighting before a worker can sign.
- **Cryptographic Integrity:** Canonical JSON serialization + SHA-256 hash chaining + non-extractable WebCrypto ECDSA P-256 keypairs, with built-in **Verify** and **Test Tamper** demonstrations.
- **Worker-Protective Escrow:** Employers lock wages upfront; workers log daily shifts or piece-rate output; wages release immediately on approval or **automatically after 24 hours** if uncontested.
- **Privacy-Preserving Trust Tiers:** Workers build a portable trust tier (`New` → `Building` → `Reliable` → `Trusted`) and share consent-logged tier proofs with lenders without exposing wages or employer identities.

## Quick Start (Local Development)

```bash
npm install
npm test      # Run Vitest unit & cryptographic tamper tests
npm run dev   # Start Vite dev server at http://localhost:5173
```

## Deploy to Vercel / Netlify in 2 Minutes

1. Push this folder to a new GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "feat: Saboot v2 TypeScript + WebCrypto implementation"
   git branch -M main
   git remote add origin https://github.com/<your-username>/saboot-v2.git
   git push -u origin main
   ```
2. Import the repository into **[Vercel](https://vercel.com)** or **[Netlify](https://netlify.com)** — Vite is auto-detected (`npm run build`, output directory `dist`).
