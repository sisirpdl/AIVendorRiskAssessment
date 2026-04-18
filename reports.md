# Vendor Risk Docs — Quick Reference

## The Big Three

| Doc | Size | Issuer | Cost | Use For Demo? |
|-----|------|--------|------|---------------|
| **SOC 2 Type II** | 80-150pg PDF | CPA audit firm | Sample = free | ✅ Yes |
| **SIG Core** | 1,200+ Qs XLSX | Shared Assessments | Full = $5K/yr | ⚠️ Use free samples only |
| **CAIQ v4** | 261 Qs XLSX | Cloud Security Alliance | **FREE** | ✅ **Best choice** |

## Where to Download (Free, No NDA)

### CAIQ (filled by real vendors) ← USE THIS
- **CSA STAR Registry:** `cloudsecurityalliance.org/star/registry/`
- Has filled CAIQs from AWS, Azure, GCP, Salesforce, Box, Zoom, etc.

### SOC 2 Samples
- **A-LIGN:** `a-lign.com` → Resources → Sample Reports
- **Schellman:** `schellman.com/resources`
- **Prescient Assurance:** `prescientassurance.com`
- Google: `"SOC 2 sample filetype:pdf"`

### SIG
- **Shared Assessments:** `sharedassessments.org` (free whitepapers only)
- Full SIG is paid — stick with CAIQ

## SOC 2 Report Structure (for chunking logic)

```
Section I   — Auditor's Opinion
Section II  — Management Assertion
Section III — System Description      ← 50% of answers live here
Section IV  — Controls Tested         ← other 40% live here
Section V   — Supplementary Info
```

## Industries Ranked by VRA Intensity

1. 🏦 Financial services (banks, fintech) — **most rigorous**
2. 🏥 Healthcare (HIPAA + HITRUST)
3. 🏛️ Gov/DoD (FedRAMP, CMMC, NIST 800-171)
4. 🏢 Fortune 500 procurement
5. 💳 Retail/e-commerce (PCI-DSS)
6. ☁️ SaaS selling upmarket
7. 🛠️ **MSPs ← your target audience**

## Other Docs Vendors Send

| Doc | Industry |
|-----|----------|
| ISO 27001 Cert | Global/European enterprise |
| PCI-DSS AOC | Credit card handlers |
| HIPAA SRA | Healthcare |
| HITRUST CSF | Healthcare (increasing) |
| FedRAMP Pkg | US Federal |
| Pen Test Report | Everyone, annually |
| BCP/DRP | Banking, critical infra |
| Cyber Insurance COI | Serious B2B |

## Your Demo Corpus Shopping List

| File | Source | Purpose |
|------|--------|---------|
| `AWS_CAIQ_v4.xlsx` | CSA STAR | Real data, big brand |
| `Azure_CAIQ.xlsx` | CSA STAR | Delta Engine comparison |
| `SOC2_Sample.pdf` | A-LIGN or Schellman | BBox hero demo |
| `SOC2_v2.pdf` | Edit the above | Delta Engine v1 vs v2 |
| `Scanned.pdf` | Any image-only PDF | Graceful failure edge case |

## Pitch Line

> *"Tested on real CAIQs from CSA STAR Registry (AWS, Microsoft, Google)
> and SOC 2 samples from top audit firms. MSP analysts do this workflow
> 5-10x/week — today takes 4-6 hours per vendor. We do it in <90 seconds
> with visual proof."*

## Key Acronyms (judges may ask)

- **CAIQ** — Consensus Assessments Initiative Questionnaire
- **CCM** — Cloud Controls Matrix (CSA)
- **SIG** — Standardized Information Gathering
- **TPRM** — Third-Party Risk Management
- **VRA/VRM** — Vendor Risk Assessment/Management
- **MSP** — Managed Service Provider
- **BAA** — Business Associate Agreement (HIPAA)
- **AOC** — Attestation of Compliance (PCI)
- **3PAO** — Third-Party Assessment Org (FedRAMP)