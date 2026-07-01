import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-6 py-10 max-w-3xl">
        <div className="flex items-center gap-4 mb-10">
          <Logo size={28} />
          <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">
            <ArrowLeft className="w-4 h-4" /> Torna alla home
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2">Termini di Servizio</h1>
        <p className="text-muted-foreground mb-10 text-sm">Ultimo aggiornamento: giugno 2025</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground/80">
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">1. Accettazione dei Termini</h2>
            <p>Accedendo o utilizzando Semantic Growth Index ("SGI", "il Servizio") disponibile su sgindex.work, accetti integralmente i presenti Termini di Servizio ("Termini"). Se non accetti, non utilizzare il Servizio. L'utilizzo da parte di minori di 16 anni richiede il consenso dei genitori o tutori legali.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">2. Descrizione del Servizio</h2>
            <p>SGI è una piattaforma SaaS che misura e traccia la crescita semantica e cognitiva degli utenti tramite conversazioni AI. Il Servizio offre:</p>
            <ul className="mt-2 space-y-1 ml-4">
              <li>Calcolo del punteggio SGI su 11 metriche semantiche.</li>
              <li>Classifiche globali e predizioni di crescita (piani Premium/Pro).</li>
              <li>Battaglie intellettuali e sfide con altri utenti.</li>
              <li>Raccomandazioni personalizzate per la crescita cognitiva (piani Premium/Pro).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">3. Account e Sicurezza</h2>
            <p>Sei responsabile della sicurezza del tuo account e di tutte le attività che vi si svolgono. Devi: fornire informazioni accurate, mantenere riservate le credenziali di accesso, notificarci immediatamente eventuali accessi non autorizzati. Ci riserviamo il diritto di sospendere account che violino i presenti Termini.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">4. Piani e Pagamenti</h2>
            <p>SGI offre un piano gratuito con funzionalità limitate e piani a pagamento (Premium, Pro) con accesso completo. I pagamenti sono elaborati da Stripe. Le sottoscrizioni si rinnovano automaticamente salvo disdetta. I rimborsi sono gestiti a discrezione e possono essere richiesti entro 7 giorni dall'acquisto scrivendo a <a href="mailto:support@sgindex.work" className="text-primary underline">support@sgindex.work</a>.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">5. Uso Accettabile</h2>
            <p>Accetti di non utilizzare il Servizio per:</p>
            <ul className="mt-2 space-y-1 ml-4">
              <li>Generare contenuti illegali, offensivi, diffamatori o che violino diritti di terzi.</li>
              <li>Tentare di ingannare il sistema di punteggio SGI con input artificiali o automatizzati.</li>
              <li>Violare le leggi applicabili, incluse quelle sul trattamento dei dati personali.</li>
              <li>Interferire con il funzionamento tecnico del Servizio.</li>
              <li>Rivendere o sublicenziare l'accesso al Servizio senza autorizzazione scritta.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">6. Contenuti dell'Utente</h2>
            <p>Rimani proprietario dei contenuti che invii. Concedendo al Servizio una licenza non esclusiva, gratuita e mondiale per elaborare tali contenuti ai fini del calcolo SGI e del miglioramento del Servizio stesso. Non vendiamo il tuo contenuto a terzi. Per dettagli sul trattamento dei dati, consulta la nostra <Link href="/privacy-policy" className="text-primary underline">Privacy Policy</Link>.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">7. Proprietà Intellettuale</h2>
            <p>Il Servizio, il codice, il design, il marchio SGI e tutti i contenuti prodotti dalla piattaforma (esclusi i tuoi input) sono di nostra proprietà esclusiva o dei nostri licenziatari. Non è consentita la riproduzione, distribuzione o modifica senza autorizzazione scritta.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">8. Limitazione di Responsabilità</h2>
            <p>Il Servizio è fornito "così com'è". Non garantiamo l'accuratezza assoluta del punteggio SGI né la continuità del Servizio. Nei limiti consentiti dalla legge, la nostra responsabilità complessiva per qualsiasi reclamo è limitata all'importo pagato nell'ultimo mese di utilizzo. Non siamo responsabili per danni indiretti, incidentali o consequenziali.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">9. Sospensione e Cancellazione</h2>
            <p>Puoi cancellare il tuo account in qualsiasi momento dalle <Link href="/settings" className="text-primary underline">Impostazioni</Link>. Ci riserviamo il diritto di sospendere o terminare l'accesso in caso di violazione dei presenti Termini, previo avviso ove possibile. La cancellazione comporta l'eliminazione dei dati entro 30 giorni.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">10. Modifiche ai Termini</h2>
            <p>Potremo modificare i presenti Termini. Le modifiche sostanziali saranno comunicate via email o notifica in app con almeno 15 giorni di anticipo. L'uso continuato del Servizio dopo tale periodo costituisce accettazione delle modifiche.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">11. Legge Applicabile e Foro Competente</h2>
            <p>I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia relativa al Servizio, il foro competente esclusivo è quello di Milano, salvo diversa disposizione normativa inderogabile applicabile al consumatore.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">12. Contatti</h2>
            <p>Per qualsiasi domanda: <a href="mailto:support@sgindex.work" className="text-primary underline">support@sgindex.work</a></p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex gap-4 text-xs text-muted-foreground">
          <Link href="/privacy-policy" className="hover:text-foreground transition-colors no-underline">Privacy Policy</Link>
          <Link href="/" className="hover:text-foreground transition-colors no-underline">← Home</Link>
        </div>
      </div>
    </div>
  );
}
