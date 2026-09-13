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
    title: 'Ajouter un dossier patient',
    icon: 'folder',
    tone: 'green',
    items: [
      'Choisissez le registre concerné : Consultations, CPN, PF, Analyses ou Soins.',
      'Remplissez les informations du patient, l\'âge, le domicile, le diagnostic et l\'observation si nécessaire.',
      'À l\'ajout, l\'application génère automatiquement un numéro de registre mensuel.',
    ],
  },
  {
    title: 'Numéro de registre',
    icon: 'hash',
    tone: 'purple',
    items: [
      'Le tableau affiche le numéro de registre à la place de l\'ID technique.',
      'Même patient, même diagnostic, même registre et même mois : le même numéro est réutilisé.',
      'Si le patient revient pour une autre maladie, un nouveau numéro est généré.',
      'La numérotation recommence naturellement avec le nouveau mois archivé.',
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
    title: 'Médicaments',
    icon: 'stethoscope',
    tone: 'violet',
    items: [
      'Seul l\'administrateur peut ajouter, modifier ou supprimer les médicaments.',
      'Chaque médicament possède un nom, un prix, une unité, un stock et une description facultative.',
      'Les unités possibles servent à clarifier la vente : unité, comprimé, plaquette, boîte, ampoule, flacon, sachet.',
      'Consultez l\'historique du stock pour voir toutes les entrées et sorties avec le suivi du stock.',
    ],
  },
  {
    title: 'Reçu patient',
    icon: 'file',
    tone: 'brand',
    items: [
      'Dans le tableau du registre, cliquez sur l\'icône reçu près de Modifier et Supprimer.',
      'Le reçu PDF contient le numéro de registre, les informations du patient, le diagnostic, les soins ou médicaments, les quantités et le total payé.',
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
      'La page Sorties permet d\'enregistrer les dépenses de la caisse.',
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
      'Le tableau de bord affiche les statistiques du mois en cours : total dossiers, montant facturé, solde de caisse.',
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
      'Exportez en Excel avec le bouton vert "Exporter Excel" pour obtenir un rapport détaillé.',
      'Exportez le stock en Excel ou PDF depuis la page Médicaments.',
    ],
  },
]

export const useHelpPage = () => ({ guideSections })
