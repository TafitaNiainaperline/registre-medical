const guideSections = [
  {
    title: 'Connexion et comptes',
    items: [
      'Connectez-vous avec votre pseudo et votre mot de passe.',
      'Un nouveau compte reste inactif jusqu’à validation par l’administrateur.',
      'L’administrateur peut activer, désactiver, réinitialiser le mot de passe et supprimer un utilisateur.',
    ],
  },
  {
    title: 'Ajouter un dossier patient',
    items: [
      'Choisissez le registre concerné : Consultations, CPN, PF, Analyses ou Soins.',
      'Remplissez les informations du patient, l’âge, le domicile, le diagnostic et l’observation si nécessaire.',
      'À l’ajout, l’application génère automatiquement un numéro de registre mensuel.',
    ],
  },
  {
    title: 'Numéro de registre',
    items: [
      'Le tableau affiche le numéro de registre à la place de l’ID technique.',
      'Même patient, même diagnostic, même registre et même mois : le même numéro est réutilisé.',
      'Si le patient revient pour une autre maladie, un nouveau numéro est généré.',
      'La numérotation recommence naturellement avec le nouveau mois archivé.',
    ],
  },
  {
    title: 'Traitements et stock',
    items: [
      'La méthode la plus sûre est de sélectionner les médicaments dans la liste du champ traitement.',
      'Le stock diminue automatiquement seulement si le médicament est disponible.',
      'Si le stock est insuffisant ou en rupture, l’enregistrement est bloqué avec un message.',
      'Supprimer un dossier patient ne remet plus les médicaments dans le stock, car ils sont déjà sortis.',
    ],
  },
  {
    title: 'Traitement écrit à la main',
    items: [
      'Vous pouvez écrire un traitement si le nom existe déjà dans la page Médicaments.',
      'Format conseillé : Cerum x2 sachet, Paracetamol x1 boîte.',
      'L’unité écrite doit correspondre à l’unité enregistrée du médicament.',
      'Le total se calcule automatiquement avec le prix et la quantité.',
    ],
  },
  {
    title: 'Médicaments',
    items: [
      'Seul l’administrateur peut ajouter, modifier ou supprimer les médicaments.',
      'Chaque médicament possède un nom, un prix, une unité, un stock et une description facultative.',
      'Les unités possibles servent à clarifier la vente : comprimé, plaquette, boîte, ampoule, flacon, sachet.',
      'Un stock vide peut être suivi comme rupture, stock faible, stock OK ou non suivi.',
    ],
  },
  {
    title: 'Reçu patient',
    items: [
      'Dans le tableau du registre, cliquez sur l’icône reçu près de Modifier et Supprimer.',
      'Le reçu PDF contient le numéro de registre, les informations du patient, le diagnostic, les soins ou médicaments, les quantités et le total payé.',
      'Choisissez l’emplacement du fichier PDF au moment du téléchargement.',
    ],
  },
  {
    title: 'Recherche, archives et export',
    items: [
      'Filtrez les dossiers par nom, âge ou date dans chaque registre.',
      'Les archives regroupent les dossiers par mois et permettent de retrouver les anciens enregistrements.',
      'L’export Excel reprend les patients, traitements, quantités, prix et totaux de l’archive sélectionnée.',
    ],
  },
];

export default function HelpPage() {
  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Guide d’utilisation</h1>
          <p>Repères essentiels pour utiliser le registre médical, le stock, les reçus et les archives.</p>
        </div>
        <div className="dashboard-badge">📘 Assistance</div>
      </div>

      <div className="cards-grid" style={{ marginBottom: '18px' }}>
        <article className="stat-card" style={{ borderTop: '5px solid #1c96a4' }}>
          <h3>Numéro mensuel</h3>
          <strong style={{ fontSize: '1.35rem' }}>001</strong>
          <span className="stat-subtitle">Identifiant patient lisible dans les registres.</span>
        </article>

        <article className="stat-card" style={{ borderTop: '5px solid #d34a65' }}>
          <h3>Stock protégé</h3>
          <strong style={{ fontSize: '1.35rem' }}>Blocage rupture</strong>
          <span className="stat-subtitle">Aucun dossier n’est ajouté si le médicament manque.</span>
        </article>

        <article className="stat-card" style={{ borderTop: '5px solid #8f60d0' }}>
          <h3>Reçu PDF</h3>
          <strong style={{ fontSize: '1.35rem' }}>Téléchargement</strong>
          <span className="stat-subtitle">Facture détaillée pour chaque patient payé.</span>
        </article>
      </div>

      <div className="help-grid">
        {guideSections.map((section, index) => (
          <article className="help-card" key={section.title}>
            <h3>{index + 1}. {section.title}</h3>
            <ul style={{ margin: 0, paddingLeft: '18px', color: '#5f7b84', lineHeight: 1.65 }}>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
