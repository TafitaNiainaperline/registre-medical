import Icon from '../../components/Icon'
import { useHelpPage } from './useHelpPage'
import './HelpPage.scss'

const HelpPage = () => {
  const { guideSections } = useHelpPage()

  return (
    <section className="HelpPage">
      <div className="page-header">
        <div>
          <h1>Guide d'utilisation</h1>
          <p>Repères essentiels pour utiliser le registre médical, le stock, les reçus et les archives.</p>
        </div>
        <div className="page-badge">
          <Icon name="book" /> Assistance
        </div>
      </div>

      <div className="cards-grid highlights">
        <article className="stat-card brand">
          <div className="top">
            <Icon name="hash" size="xl" />
            <h3>Numéro mensuel</h3>
          </div>
          <strong className="value">01</strong>
          <span className="subtitle">Identifiant patient lisible dans les registres.</span>
        </article>

        <article className="stat-card red">
          <div className="top">
            <Icon name="bank" size="xl" />
            <h3>Solde de caisse</h3>
          </div>
          <strong className="value small">Entrées - Sorties</strong>
          <span className="subtitle">Suivi automatique des recettes et dépenses.</span>
        </article>

        <article className="stat-card violet">
          <div className="top">
            <Icon name="file" size="xl" />
            <h3>Reçu PDF</h3>
          </div>
          <strong className="value small">Téléchargement</strong>
          <span className="subtitle">Facture détaillée pour chaque patient payé.</span>
        </article>
      </div>

      <div className="guide">
        {guideSections.map((section, index) => (
          <article className={`card ${section.tone}`} key={section.title}>
            <h3>
              <Icon name={section.icon} size="lg" />
              {index + 1}. {section.title}
            </h3>
            <ul>
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}

export default HelpPage
