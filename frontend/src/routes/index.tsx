import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Building2, ShieldCheck, ArrowRight } from "lucide-react";
import { Logo } from "@/components/trustlens/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Verifai ΓÇö Verifiable AI for Vendor Security" },
      {
        name: "description",
        content:
          "Choose your role: MSPs publish AI-verified security answers, auditors browse the trust vault.",
      },
    ],
  }),
  component: RolePicker,
});

function RolePicker() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background bg-hero-radial-strong">
      {/* Top tagline */}
      <div className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo size="md" />
        <span className="hidden text-xs text-muted-foreground sm:block">
          Verifiable AI answers for every vendor security question.
        </span>
      </div>

      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 pb-24 pt-16 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          className="mb-8"
        >
          <Logo size="xl" showWordmark={false} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-signature" />
            AI-Native Supply Chain Security
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05, ease: "easeOut" }}
          className="mt-6 max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl"
        >
          Trust, but{" "}
          <span className="relative inline-block">
            <span className="text-signature">verify.</span>
            <span className="absolute -bottom-1 left-0 h-px w-full bg-signature/60 shadow-[0_0_12px_rgba(250,204,21,0.6)]" />
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
          className="mt-5 max-w-xl text-balance text-base text-muted-foreground"
        >
          Every AI-generated answer is grounded in the source PDF with a visible
          bounding-box proof. No hallucinations. No black boxes.
        </motion.p>

        <div className="mt-14 grid w-full max-w-3xl grid-cols-1 gap-5 md:grid-cols-2">
          <RoleCard
            to="/seller"
            icon={<Building2 className="h-6 w-6" />}
            tag="Publish Verified Answers"
            title="I am a Seller"
            description="Upload trust packages, review AI answers, publish verified responses."
            delay={0.15}
          />
          <RoleCard
            to="/buyer"
            icon={<ShieldCheck className="h-6 w-6" />}
            tag="Browse the Trust Vault"
            title="I am a Buyer"
            description="Audit services with verified posture, confidence scores, and evidence."
            delay={0.22}
          />
        </div>
      </div>
    </div>
  );
}

function RoleCard({
  to,
  icon,
  tag,
  title,
  description,
  delay,
}: {
  to: "/seller" | "/buyer";
  icon: React.ReactNode;
  tag: string;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: "easeOut" }}
    >
      <Link
        to={to}
        className="group relative flex h-full flex-col items-start rounded-2xl border border-border bg-surface/70 p-7 text-left shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-signature/60 hover:shadow-[0_0_0_1px_rgba(250,204,21,0.25),0_20px_60px_-20px_rgba(250,204,21,0.35)]"
      >
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-elevated text-signature">
          {icon}
        </div>
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {tag}
        </span>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-signature">
          Continue
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </Link>
    </motion.div>
  );
}
