import LegalLayout from '../components/LegalLayout';

export const metadata = {
  title: 'Privacy Policy | BrainBuffer Arena Security',
  description: 'How BrainBuffer protects user data and ensures secure, encrypted transactions for our eSports community.',
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <div className="space-y-12 text-slate-600 font-medium leading-relaxed">
        <section>
          <h2 className="text-slate-900 font-black uppercase tracking-tight text-lg mb-4">1. Data Sovereignty</h2>
          <p>
            To maintain the integrity of the arena, we collect your <strong>Email (for OTP verification)</strong>, 
            <strong>Username</strong>, and <strong>Transaction History</strong>. We utilize SSL encryption for all data in transit. 
            BrainBuffer does not sell your personal data to third-party advertisers.
          </p>
        </section>

        <section>
          <h2 className="text-slate-900 font-black uppercase tracking-tight text-lg mb-4">2. Financial Security & KYC</h2>
          <p>
            Payment data is processed through industry-standard AES-256 encrypted channels. While we store transaction IDs for 
            verification, we <strong>never</strong> store your raw wallet passwords or bank login credentials. 
            Verification data (KYC) is only used to prevent fraudulent withdrawals and ensure a fair play environment.
          </p>
        </section>

        <section>
          <h2 className="text-slate-900 font-black uppercase tracking-tight text-lg mb-4">3. Right to Erasure</h2>
          <p>
            In compliance with global data protection standards, users may request profile deletion. 
            All personally identifiable information will be purged within 30 days, provided the account is not subject 
            to an active investigation regarding match integrity or financial fraud.
          </p>
        </section>

        <section>
          <h2 className="text-slate-900 font-black uppercase tracking-tight text-lg mb-4">4. Contact Security</h2>
          <p>
            Data inquiries can be directed to the Glacia Connection Deployment office at <strong>brainbufferofficial@gmail.com</strong>.
          </p>
        </section>

        <div className="p-8 bg-slate-950 rounded-[2.5rem] text-slate-400 text-xs italic border border-white/5">
          "BrainBuffer utilizes advanced encryption protocols to protect the intellectual profiles and 
          transactional history of every Commander in our Arena."
        </div>
      </div>
    </LegalLayout>
  );
}