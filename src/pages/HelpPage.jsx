import { BookOpen, Users, FolderOpen, Hash, Pill, Stethoscope, FileText, Search, Calendar, DollarSign, Landmark, Activity } from 'lucide-react';

const guideSections = [
  {
    title: 'Connexion et comptes',
    icon: Users,
    color: '#3777cc',
    items: [
      'Connectez-vous avec votre pseudo et votre mot de passe.',
      'Un nouveau compte reste inactif jusqu\'à validation par l\'administrateur.',
      'L\'administrateur peut activer, désactiver, réinitialiser le mot de passe et supprimer un utilisateur.',
    ],
  },
  {
    title: 'Ajouter un dossier patient',
    icon: FolderOpen,
    color: '#28a745',
    items: [
      'Choisissez le registre concerné : Consultations, CPN, PF, Analyses ou Soins.',
      'Remplissez les informations du patient, l\'âge, le domicile, le diagnostic et l\'observation si nécessaire.',
      'À l\'ajout, l\'application génère automatiquement un numéro de registre mensuel.',
    ],
  },
  {
    title: 'Numéro de registre',
    icon: Hash,
    color: '#6f42c1',
    items: [
      'Le tableau affiche le numéro de registre à la place de l\'ID technique.',
      'Même patient, même diagnostic, même registre et même mois : le même numéro est réutilisé.',
      'Si le patient revient pour une autre maladie, un nouveau numéro est généré.',
      'La numérotation recommence naturellement avec le nouveau mois archivé.',
    ],
  },
  {
    title: 'Traitements et stock',
    icon: Pill,
    color: '#d81b83',
    items: [
      'La méthode la plus sûre est de sélectionner les médicaments dans la liste du champ traitement.',
      'Le stock diminue automatiquement seulement si le médicament est disponible.',
      'Si le stock est insuffisant ou en rupture, l\'enregistrement est bloqué avec un message.',
      'Supprimer un dossier patient ne remet plus les médicaments dans le stock, car ils sont déjà sortis.',
    ],
  },
  {
    title: 'Médicaments',
    icon: Stethoscope,
    color: '#8f60d0',
    items: [
      'Seul l\'administrateur peut ajouter, modifier ou supprimer les médicaments.',
      'Chaque médicament possède un nom, un prix, une unité, un stock et une description facultative.',
      'Les unités possibles servent à clarifier la vente : unité, comprimé, plaquette, boîte, ampoule, flacon, sachet.',
      'Consultez l\'historique du stock pour voir toutes les entrées et sorties avec le suivi du stock.',
    ],
  },
  {
    title: 'Reçu patient',
    icon: FileText,
    color: '#1c96a4',
    items: [
      'Dans le tableau du registre, cliquez sur l\'icône reçu près de Modifier et Supprimer.',
      'Le reçu PDF contient le numéro de registre, les informations du patient, le diagnostic, les soins ou médicaments, les quantités et le total payé.',
      'Choisissez l\'emplacement du fichier PDF au moment du téléchargement.',
    ],
  },
  {
    title: 'Rendez-vous',
    icon: Calendar,
    color: '#f59f00',
    items: [
      'Planifiez des rendez-vous pour les patients depuis chaque registre.',
      'La page Rendez-vous affiche tous les rendez-vous avec leur statut (Passé, Aujourd\'hui, À venir).',
      'Supprimez un rendez-vous individuellement ou utilisez "Supprimer tout" pour effacer tous les rendez-vous.',
    ],
  },
  {
    title: 'Sorties de caisse',
    icon: Landmark,
    color: '#dc3545',
    items: [
      'La page Sorties permet d\'enregistrer les dépenses de la caisse.',
      'Chaque sortie inclut la date, la désignation et le montant.',
      'Les sorties sont automatiquement déduites du solde de caisse affiché dans le tableau de bord.',
      'Vous pouvez modifier ou supprimer chaque sortie.',
    ],
  },
  {
    title: 'Tableau de bord',
    icon: Activity,
    color: '#3777cc',
    items: [
      'Le tableau de bord affiche les statistiques du mois en cours : total dossiers, montant facturé, solde de caisse.',
      'Consultez la répartition par sexe, les diagnostics les plus fréquents et les résultats TDR.',
      'Filtrez les actes médicaux, produits PF et CPN pour voir les détails.',
      'Le solde de caisse calcule automatiquement : Entrées - Sorties.',
    ],
  },
  {
    title: 'Recherche, archives et export',
    icon: Search,
    color: '#4a90d9',
    items: [
      'Filtrez les dossiers par nom, âge ou date dans chaque registre.',
      'Les archives regroupent les dossiers par mois et permettent de retrouver les anciens enregistrements.',
      'Exportez en Excel avec le bouton vert "Exporter Excel" pour obtenir un rapport détaillé.',
      'Exportez le stock en Excel ou PDF depuis la page Médicaments.',
    ],
  },
];

export default function HelpPage() {
  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Guide d'utilisation</h1>
          <p>Repères essentiels pour utiliser le registre médical, le stock, les reçus et les archives.</p>
        </div>
        <div className="dashboard-badge">
          <BookOpen size={16} style={{ marginRight: '6px' }} /> Assistance
        </div>
      </div>

      <div className="cards-grid" style={{ marginBottom: '24px' }}>
        <article className="stat-card" style={{ borderTop: '5px solid #1c96a4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Hash size={24} color="#1c96a4" />
            <h3>Numéro mensuel</h3>
          </div>
          <strong style={{ fontSize: '1.5rem' }}>01</strong>
          <span className="stat-subtitle">Identifiant patient lisible dans les registres.</span>
        </article>

        <article className="stat-card" style={{ borderTop: '5px solid #d34a65' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Landmark size={24} color="#d34a65" />
            <h3>Solde de caisse</h3>
          </div>
          <strong style={{ fontSize: '1.2rem' }}>Entrées - Sorties</strong>
          <span className="stat-subtitle">Suivi automatique des recettes et dépenses.</span>
        </article>

        <article className="stat-card" style={{ borderTop: '5px solid #8f60d0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <FileText size={24} color="#8f60d0" />
            <h3>Reçu PDF</h3>
          </div>
          <strong style={{ fontSize: '1.35rem' }}>Téléchargement</strong>
          <span className="stat-subtitle">Facture détaillée pour chaque patient payé.</span>
        </article>
      </div>

      <div className="help-grid">
        {guideSections.map((section, index) => {
          const Icon = section.icon;
          return (
            <article className="help-card" key={section.title} style={{ borderLeft: `4px solid ${section.color}` }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: section.color, display: 'flex', alignItems: 'center' }}>
                  <Icon size={20} />
                </span>
                {index + 1}. {section.title}
              </h3>
              <ul style={{ margin: 0, paddingLeft: '18px', color: '#5f7b84', lineHeight: 1.7, fontSize: '0.9rem' }}>
                {section.items.map((item) => (
                  <li key={item} style={{ marginBottom: '4px' }}>{item}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
