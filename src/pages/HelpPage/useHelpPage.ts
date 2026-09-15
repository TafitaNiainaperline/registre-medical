import type { GuideSection } from './types'

const guideSections: GuideSection[] = [
  {
    title: 'Connexion et comptes',
    icon: 'users',
    tone: 'blue',
    items: [
      'Connectez-vous avec votre pseudo et votre mot de passe.',
      'Un nouveau compte reste inactif jusqu\'à validation par l\'administrateur.',
      'L\'administrateur peut activer, désactiver, réinitialiser le mot de passe et supprimer un utilisateur.',
    ],
  },
  {
    title: 'Ajouter une visite',
    icon: 'folder',
    tone: 'green',
    items: [
      'Choisissez le registre concerné : Consultations, CPN, PF, Analyses ou Soins.',
      'Dans « Nouvelle visite », sélectionnez un patient existant ou renseignez son identité, son âge et son domicile.',
      'Complétez le diagnostic, les traitements et, si nécessaire, l’observation et le prochain rendez-vous, puis cliquez sur « Ajouter ».',
      'Dans le registre Consultations, vous pouvez enregistrer sans traitement après confirmation.',
      'À l\'ajout, l\'application génère automatiquement un numéro de registre mensuel.',
    ],
  },
  {
    title: 'Numéro de registre',
    icon: 'hash',
    tone: 'purple',
    items: [
      'Le tableau affiche le numéro de registre à la place de l\'ID technique.',
      'Même patient, même registre et même mois : le même numéro est réutilisé pour toutes ses visites.',
      'La liste affiche une seule ligne par patient et par mois, avec les informations de sa dernière visite.',
      'La numérotation recommence naturellement avec le nouveau mois archivé.',
    ],
  },
  {
    title: 'Registres CPN et PF',
    icon: 'baby',
    tone: 'pink',
    items: [
      'En CPN, renseignez le numéro de consultation : CPN1, CPN2, CPN3, CPN4 ou CPN5. En PF, renseignez le produit utilisé.',
      'Ces informations apparaissent dans la liste et dans l’historique des visites du patient.',
      'En haut du registre, les pastilles affichent le nombre de consultations par CPN ou par produit PF pour la période sélectionnée.',
      'Chaque visite renseignée compte, même si la liste regroupe plusieurs visites sur une seule ligne. Les compteurs ne changent pas avec la recherche.',
      'Les CPN sans consultation affichent zéro ; les produits PF apparaissent lorsqu’ils sont renseignés dans la période.',
      'Dans la liste, utilisez « Filtrer par CPN » ou « Filtrer par produit PF » pour rechercher la valeur souhaitée.',
    ],
  },
  {
    title: 'Traitements et stock',
    icon: 'pill',
    tone: 'pink',
    items: [
      'La méthode la plus sûre est de sélectionner les médicaments dans la liste du champ traitement.',
      'Le stock diminue automatiquement seulement si le médicament est disponible.',
      'Si le stock est insuffisant ou en rupture, l\'enregistrement est bloqué avec un message.',
      'Supprimer un dossier patient ne remet plus les médicaments dans le stock, car ils sont déjà sortis.',
    ],
  },
  {
    title: 'Médicaments et actes médicaux',
    icon: 'stethoscope',
    tone: 'violet',
    items: [
      'Utilisez les boutons séparés « Ajouter un médicament » et « Ajouter un acte médical » pour ouvrir le formulaire correspondant.',
      'Pour un médicament, renseignez le nom, le prix par unité, l’unité et le seuil d’alerte. Le stock initial est réservé à l’administrateur ; un stock vide signifie « Non suivi ».',
      'Pour un acte médical, renseignez le nom et le tarif. Les actes ne possèdent pas de stock.',
      'Recherchez par nom et utilisez les filtres « Tous », « Médicaments » ou « Actes médicaux ». La modification est accessible à l’administrateur.',
      'Cliquez sur le bouton + d’un médicament pour ajouter du stock, ou sur sa quantité en stock pour consulter l’historique.',
    ],
  },
  {
    title: 'Ventes et actes réalisés',
    icon: 'trending',
    tone: 'violet',
    items: [
      'Sous le catalogue, les blocs « Médicaments les plus vendus » et « Actes réalisés » affichent un résumé compact.',
      'Cliquez sur « Voir le détail » pour ouvrir la liste dans une fenêtre.',
      'Le détail des médicaments affiche les quantités vendues ; celui des actes affiche les réalisations et leurs montants.',
      'La recherche du catalogue s’applique aussi à ces résumés et à leurs détails. Le filtre de type détermine les blocs affichés.',
      'Utilisez « Précédent » et « Suivant » pour parcourir les pages, puis la croix ou la touche Échap pour fermer.',
    ],
  },
  {
    title: 'Dispensation de médicaments',
    icon: 'pill',
    tone: 'blue',
    items: [
      'La page affiche la liste et deux boutons séparés : « Liste des dispensations » et « Nouvelle dispensation ».',
      'Cliquez sur « Nouvelle dispensation » pour ouvrir le formulaire dans une fenêtre.',
      'Sélectionnez le médicament, saisissez la quantité et vérifiez le total affiché avant de cliquer sur « Enregistrer ».',
      'Après enregistrement, la fenêtre se ferme et la liste se met à jour. Si le stock suivi est insuffisant, un message indique la quantité disponible.',
      'Utilisez « Annuler », la croix ou Échap pour fermer sans enregistrer. Recherchez et modifiez les dispensations depuis la liste.',
      'La suppression d’une dispensation demande confirmation et recrédite le stock.',
    ],
  },
  {
    title: 'Reçu patient',
    icon: 'file',
    tone: 'brand',
    items: [
      'Ouvrez l’historique du patient depuis la liste du registre pour retrouver ses reçus.',
      'Cliquez sur PDF à côté du passage souhaité pour télécharger son reçu.',
      'Chaque reçu PDF contient uniquement les soins et le montant de la visite sélectionnée.',
      'Choisissez l\'emplacement du fichier PDF au moment du téléchargement.',
    ],
  },
  {
    title: 'Rendez-vous',
    icon: 'calendar',
    tone: 'amber',
    items: [
      'Planifiez des rendez-vous pour les patients depuis chaque registre.',
      'La page Rendez-vous affiche tous les rendez-vous avec leur statut (Passé, Aujourd\'hui, À venir).',
      'Supprimez un rendez-vous individuellement ou utilisez "Supprimer tout" pour effacer tous les rendez-vous.',
    ],
  },
  {
    title: 'Sorties de caisse',
    icon: 'bank',
    tone: 'red',
    items: [
      'Dans la page Sorties, cliquez sur « Nouvelle sortie » pour ouvrir le formulaire de dépense dans une fenêtre.',
      'Chaque sortie inclut la date, la désignation et le montant.',
      'Les sorties sont automatiquement déduites du solde de caisse affiché dans le tableau de bord.',
      'Vous pouvez modifier ou supprimer chaque sortie.',
    ],
  },
  {
    title: 'Tableau de bord',
    icon: 'activity',
    tone: 'blue',
    items: [
      'Choisissez une année dans le tableau de bord pour consulter les statistiques correspondantes : dossiers, recettes et solde de caisse.',
      'Consultez la répartition par sexe, les diagnostics les plus fréquents et les résultats TDR.',
      'Filtrez les actes médicaux, produits PF et CPN pour voir les détails.',
      'Le solde de caisse calcule automatiquement : Entrées - Sorties.',
    ],
  },
  {
    title: 'Recherche, archives et export',
    icon: 'search',
    tone: 'sky',
    items: [
      'Filtrez les dossiers par nom, âge ou date dans chaque registre.',
      'Les archives regroupent les dossiers par mois et permettent de retrouver les anciens enregistrements.',
      'Depuis la page Archives, sélectionnez une période puis cliquez sur « Exporter Excel » pour obtenir un rapport détaillé.',
      'Exportez le stock en Excel ou PDF depuis la page Médicaments.',
    ],
  },
]

export const useHelpPage = () => ({ guideSections })
