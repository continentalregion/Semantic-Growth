import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-6 py-10 max-w-3xl">
        <div className="flex items-center gap-4 mb-10">
          <Logo size={28} />
          <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">
            <ArrowLeft className="w-4 h-4" /> Torna alla home
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-10 text-sm">Ultimo aggiornamento: giugno 2025</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground/80">
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">1. Chi siamo</h2>
            <p>Semantic Growth Index ("SGI", "noi", "il Servizio") è un prodotto operato su sgindex.work. Il presente documento descrive come raccogliamo, utilizziamo e proteggiamo i tuoi dati personali in conformità al Regolamento (UE) 2016/679 (GDPR) e alla normativa italiana applicabile.</p>
            <p className="mt-2">Contatto privacy: <a href="mailto:privacy@sgindex.work" className="text-primary underline">privacy@sgindex.work</a></p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">2. Dati che raccogliamo</h2>
            <ul className="space-y-2 ml-4">
              <li><span className="text-foreground font-medium">Dati di registrazione:</span> email, nome (opzionale), provider OAuth (Google, GitHub) — gestiti tramite Clerk.</li>
              <li><span className="text-foreground font-medium">Dati di utilizzo:</span> testo delle conversazioni inviate all'AI, punteggi SGI calcolati, timestamp delle sessioni, preferenze in-app.</li>
              <li><span className="text-foreground font-medium">Dati di pagamento:</span> gestiti interamente da Stripe. Non archiviamo numeri di carta o dati bancari.</li>
              <li><span className="text-foreground font-medium">Dati tecnici:</span> indirizzo IP, user agent, log di accesso per sicurezza e debugging.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">3. Finalità del trattamento</h2>
            <ul className="space-y-1 ml-4">
              <li>Fornire e migliorare il Servizio (calcolo SGI, classifiche, predizioni, raccomandazioni).</li>
              <li>Elaborare i pagamenti tramite Stripe.</li>
              <li>Inviare comunicazioni relative all'account (notifiche, aggiornamenti SGI, digest settimanale).</li>
              <li>Garantire la sicurezza del Servizio e prevenire abusi.</li>
              <li>Adempiere a obblighi legali.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">4. Trasferimento dati a terzi</h2>
            <p>I dati vengono elaborati su server sicuri tramite Replit (USA). Il testo delle conversazioni viene inviato a <strong>OpenAI</strong> (Business API) per il calcolo del punteggio SGI — OpenAI non utilizza questi dati per addestrare modelli. I pagamenti sono gestiti da <strong>Stripe</strong>. L'autenticazione è gestita da <strong>Clerk</strong>. Tutti i fornitori operano con adeguate garanzie GDPR (Standard Contractual Clauses o equivalenti).</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">5. I tuoi diritti (GDPR Art. 15-22)</h2>
            <p>Hai diritto a: <strong>accesso, rettifica, cancellazione, portabilità, limitazione e opposizione</strong> al trattamento. Puoi esercitare questi diritti:</p>
            <ul className="mt-2 space-y-1 ml-4">
              <li>Eliminando il tuo account direttamente dalle <Link href="/settings" className="text-primary underline">Impostazioni</Link> (cancellazione immediata).</li>
              <li>Scrivendo a <a href="mailto:privacy@sgindex.work" className="text-primary underline">privacy@sgindex.work</a> — risposta entro 30 giorni.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">6. Cookie e tracciamento</h2>
            <p>Utilizziamo:</p>
            <ul className="mt-2 space-y-1 ml-4">
              <li><span className="text-foreground font-medium">Cookie essenziali:</span> necessari per autenticazione e funzionamento dell'app. Non richiedono consenso.</li>
              <li><span className="text-foreground font-medium">Cookie analitici:</span> utilizzati, previo consenso, per capire come gli utenti interagiscono con il Servizio e migliorarlo.</li>
            </ul>
            <p className="mt-2">Puoi modificare le preferenze in qualsiasi momento dal banner cookie nella parte inferiore dello schermo.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">7. Conservazione dei dati</h2>
            <p>I dati vengono conservati per la durata dell'account attivo. A seguito della cancellazione dell'account, i dati personali vengono eliminati entro 30 giorni, salvo obblighi legali di conservazione.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">8. Sicurezza</h2>
            <p>Adottiamo misure tecniche e organizzative adeguate per proteggere i tuoi dati: connessioni TLS, accesso ai dati ristretto al personale autorizzato, monitoraggio degli accessi.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">9. Modifiche alla Privacy Policy</h2>
            <p>Potremo aggiornare questa Privacy Policy. Le modifiche sostanziali saranno comunicate via email o tramite notifica in app con almeno 15 giorni di anticipo. L'uso continuato del Servizio dopo la notifica costituisce accettazione.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">10. Autorità di controllo</h2>
            <p>Se ritieni che il trattamento dei tuoi dati violi il GDPR, hai il diritto di presentare reclamo al <strong>Garante per la protezione dei dati personali</strong> (www.garanteprivacy.it).</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex gap-4 text-xs text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground transition-colors no-underline">Termini di Servizio</Link>
          <Link href="/" className="hover:text-foreground transition-colors no-underline">← Home</Link>
        </div>
      </div>
    </div>
  );
}
