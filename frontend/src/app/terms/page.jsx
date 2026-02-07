import LegalLayout from '../components/LegalLayout';
export const metadata = {
  title: 'Terms of Service | BrainBuffer Skill-Based Arena',
  description: 'Official terms and conditions for BrainBuffer. Understand the skill-based legal framework under Section 12 of the Public Gambling Act and our eSports fair play policies.',
};
export default function TermsPage() {
  return (
    <LegalLayout title="Terms & Conditions of Service">
      <script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Terms of Service",
      "description": "Legal terms for BrainBuffer eSports platform regarding skill-based competition and financial protocols.",
      "publisher": {
        "@type": "Organization",
        "name": "Brain Buffer"
      }
    })
  }}
/>
      <div className="space-y-12 text-slate-600 font-medium leading-relaxed">
        
        {/* 1. JURIDICAL & SHARIAH CLASSIFICATION */}
        <section>
          <h2 className="text-slate-900 font-black uppercase tracking-tight text-lg mb-4">1. Nature of the Arena (Aql vs. Maisir)</h2>
          <p className="mb-4">
            BrainBuffer is strictly a <strong>Skill-Based Intellectual Competition</strong>. By using this platform, you acknowledge that success is mathematically and practically determined by memory, reaction speed, and cognitive precision.
          </p>
          <p className="text-sm bg-green-50 p-4 rounded-2xl border border-green-100 italic">
            <strong>Islamic Compliance:</strong> This platform is designed to avoid "Gharar" (uncertainty) and "Maisir" (gambling). The outcome is tied to "Amal" (effort/work). As per the rationalist framework of modern Islamic scholars, rewards gained through intellectual merit and cognitive exertion are recognized as Halal economic pursuits.
          </p>
        </section>

        {/* 2. STATUTORY EXEMPTION */}
        <section>
          <h2 className="text-slate-900 font-black uppercase tracking-tight text-lg mb-4">2. Legal Standing (Section 12 Protection)</h2>
          <p>
            Pursuant to the <strong>Public Gambling Act of 1867, Section 12</strong>, the provisions of the Act do not apply to games of "mere skill." BrainBuffer operates as a digital "Contest of Merit." You agree that you are entering a contest where your personal ability is the sole factor in winning, similar to a physical sports competition or an academic exam.
          </p>
        </section>

        {/* 3. USER CONDUCT & FRAUD PREVENTION */}
        <section>
          <h2 className="text-slate-900 font-black uppercase tracking-tight text-lg mb-4">3. Anti-Cheating & Fair Play</h2>
          <p>
            To maintain the "Skill-Based" integrity, we have a zero-tolerance policy for:
          </p>
          <ul className="list-disc ml-6 mt-4 space-y-2">
            <li>Use of automated scripts, bots, or screen-reading software.</li>
            <li>External memory aids or collaborative play (teaming).</li>
            <li>Creating multiple accounts to manipulate match-making.</li>
          </ul>
          <p className="mt-4 font-bold text-red-600">
            Violation of these terms results in immediate permanent banning and the permanent forfeiture of all wallet balances without exception.
          </p>
        </section>

        {/* 4. FINANCIAL & WITHDRAWAL PROTOCOLS */}
       <section>
  <h2 className="text-slate-900 font-black uppercase tracking-tight text-lg mb-4">4. Prize Pool & Service Commission</h2>
  <p className="mb-4">
    BrainBuffer operates as a peer-to-peer competitive arena. When two users enter a match, their entry fees are combined to create the <strong>Match Prize Pool</strong>. 
  </p>
  
  <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl mb-4 text-sm">
    <p className="font-bold text-slate-800 mb-2 underline">The "Service Fee" Model:</p>
    <p>
      As a facilitator, BrainBuffer deducts a <strong>10% Platform Service Fee</strong> from the total prize pool to cover high-speed server maintenance, security auditing, and cloud infrastructure costs. The remaining 90% is instantly credited to the winner’s wallet upon match verification.
    </p>
  </div>

  <ul className="list-disc ml-6 space-y-2">
    <li><strong>Minimum Withdrawal:</strong> 300 PKR.</li>
    <li><strong>Processing Time:</strong> 24-72 hours for security audits and manual verification of match integrity.</li>
    <li><strong>Withdrawal Fee:</strong> A fixed 5% processing fee applies to withdrawals to cover third-party payment gateway charges (Easypaisa/JazzCash).</li>
    <li><strong>Verification:</strong> We reserve the right to request identity verification (KYC) to prevent fraudulent activity and ensure community safety.</li>
  </ul>
</section>
{/* 5. WITHDRAWAL AUTHORITY & SECURITY AUDITS */}
        <section>
          <h2 className="text-slate-900 font-black uppercase tracking-tight text-lg mb-4">5. Withdrawal Authority & Fraud Prevention</h2>
          <p className="mb-4">
            To maintain a secure economic ecosystem, BrainBuffer reserves the <strong>absolute right to accept, delay, or reject any withdrawal request</strong> at its sole discretion. 
          </p>
          <ul className="list-disc ml-6 space-y-3">
            <li>
              <strong>Suspicious Activity:</strong> If a user’s match history, deposit patterns, or withdrawal frequency triggers our automated security protocols, the account will be placed under <strong>Administrative Hold</strong>.
            </li>
            <li>
              <strong>Investigation Period:</strong> During an Administrative Hold, funds (both deposits and winnings) may be frozen for up to 14 business days while our security team manually verifies match integrity.
            </li>
            <li>
              <strong>Source of Funds:</strong> We reserve the right to verify the source of any deposit. Any attempt to use the platform for unauthorized money shuffling or "cycling" funds without participating in matches will result in an immediate block.
            </li>
            <li>
              <strong>Final Decision:</strong> If a user is found to have manipulated game mechanics or violated the Fair Play policy, BrainBuffer reserves the right to void the withdrawal and permanently close the account.
            </li>
          </ul>
        </section>

        {/* 6. MODIFICATIONS & UPDATES */}
        <section>
          <h2 className="text-slate-900 font-black uppercase tracking-tight text-lg mb-4">6. Amendments to Service</h2>
          <p>
  BrainBuffer is a dynamic eSports environment. We reserve the right to modify entry fees and match rules 
  on our <a href="/" className="text-green-600 underline">Official Arena Landing Page</a> to ensure platform sustainability.
</p>
        </section>

        {/* 7. DISPUTE RESOLUTION */}
        <section>
          <h2 className="text-slate-900 font-black uppercase tracking-tight text-lg mb-4">7. Dispute Resolution</h2>
          <p>
            Any disputes arising from match outcomes or financial transactions must be submitted via the official <strong>In-App Support Ticket</strong> system. Users agree to allow our internal audit team 72 hours to resolve the issue before seeking external mediation.
          </p>
        </section>
        {/* 5. LIMITATION OF LIABILITY */}
        <section>
          <h2 className="text-slate-900 font-black uppercase tracking-tight text-lg mb-4">5. Network & Technical Failures</h2>
          <p>
            BrainBuffer is not responsible for losses incurred due to user-side internet instability, device failure, or electricity outages. Players are advised to check the <strong>Network Guard</strong> before entering a ranked match.
          </p>
        </section>
<section>
  <h2 className="text-slate-900 font-black uppercase tracking-tight text-lg mb-4">8. Acceptance</h2>
  <p>
    By creating a Commander Profile, you confirm you are at least 18 years of age and agree to these terms. 
    For legal inquiries, contact <strong>brainbufferofficial@gmail.com</strong>.
  </p>
</section>
        {/* LEGAL QUOTE BLOCK */}
        <div className="p-8 bg-slate-900 rounded-[2.5rem] shadow-2xl">
          <p className="text-white font-bold mb-2 uppercase tracking-widest text-[10px]">Statutory Declaration</p>
          <p className="text-slate-400 text-xs italic leading-loose">
            "The test of 'mere skill' is whether the element of skill is the 'predominant' factor in the game. In BrainBuffer, the outcome is determined by the player's memory retention and processing speed, making it a legally protected competition under the laws of Pakistan."
          </p>
        </div>

      </div>
    </LegalLayout>
    
  );
}