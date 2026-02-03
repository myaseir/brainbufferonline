import LegalLayout from '../components/LegalLayout';

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <div className="space-y-12 text-slate-600 font-medium leading-relaxed">
        <section>
          <h2 className="text-slate-900 font-black uppercase tracking-tight text-lg mb-4">1. The Skill-Based Mandate</h2>
          <p>
            BrainBuffer is an eSports platform where success is determined <strong>exclusively by cognitive merit</strong>. 
            By participating, you acknowledge that chance plays no dominant role in match outcomes. 
            This platform operates under the protections of Section 12 of the Public Gambling Act, 1867.
          </p>
        </section>

        <section>
          <h2 className="text-slate-900 font-black uppercase tracking-tight text-lg mb-4">2. Account Responsibility</h2>
          <p>
            Users are limited to one account per person. Use of bots, memory-enhancing scripts, or multiple identities 
            will result in an immediate permanent ban and forfeiture of any pending rewards.
          </p>
        </section>

        <section>
          <h2 className="text-slate-900 font-black uppercase tracking-tight text-lg mb-4">3. Financial Transactions</h2>
          <p>
            Entry fees are final and non-refundable once a match has commenced. Prize distributions are processed 
            via verified local payment gateways (JazzCash/Easypaisa). Users must ensure their registered mobile numbers 
            match their wallet accounts.
          </p>
        </section>

        <div className="p-6 bg-slate-900 rounded-3xl text-slate-400 text-xs italic">
          "Nothing in the Public Gambling Act shall be held to apply to any game of mere skill, wherever played." — Section 12.
        </div>
      </div>
    </LegalLayout>
  );
}