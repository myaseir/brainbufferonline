import LegalLayout from '../components/LegalLayout';

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <div className="space-y-12 text-slate-600 font-medium leading-relaxed">
        <section>
          <h2 className="text-slate-900 font-black uppercase tracking-tight text-lg mb-4">1. Data We Guard</h2>
          <p>
            To maintain the integrity of the arena, we collect your <strong>Email (for OTP verification)</strong>, 
            <strong>Username</strong>, and <strong>Transaction History</strong>. We do not track personal habits 
            or share data with third-party advertisers.
          </p>
        </section>

        <section>
          <h2 className="text-slate-900 font-black uppercase tracking-tight text-lg mb-4">2. Security of Funds</h2>
          <p>
            Payment data is processed through secure, encrypted channels. We do not store your raw wallet passwords 
            or sensitive banking credentials on our local servers.
          </p>
        </section>

        <section>
          <h2 className="text-slate-900 font-black uppercase tracking-tight text-lg mb-4">3. Right to Erasure</h2>
          <p>
            Users may request the deletion of their profile at any time. Upon request, all personally identifiable information 
            will be purged from our database within 30 days, provided there are no active fraud investigations linked to the account.
          </p>
        </section>

        <div className="p-6 bg-green-500 rounded-3xl text-white font-bold text-center">
          Glacia Connection utilizes industry-standard encryption to protect your intellectual profile.
        </div>
      </div>
    </LegalLayout>
  );
}