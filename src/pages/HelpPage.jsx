export default function HelpPage() {
  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Guide d'utilisation</h1>
          <p>Apprenez rapidement à utiliser l'application de registre médical.</p>
        </div>
        <div className="dashboard-badge">📘 Assistance</div>
      </div>

      <div className="help-grid">

        <article className="help-card">
          <h3>1. Connexion</h3>
          <p>
            Connectez-vous avec votre <strong>pseudo</strong> et votre mot de passe.
            Cliquez sur l'icône 👁️ pour afficher ou masquer le mot de passe.
            Si vous n'avez pas encore de compte, cliquez sur <em>Créer un compte</em>.
          </p>
        </article>

        <article className="help-card">
          <h3>2. Créer un compte</h3>
          <p>
            Entrez votre nom complet, un pseudo unique et un mot de passe.
            Votre compte sera <strong>inactif</strong> jusqu'à ce que l'administrateur l'active.
            Contactez l'administrateur pour qu'il active votre accès.
          </p>
        </article>

        <article className="help-card">
          <h3>3. Ajouter un dossier patient</h3>
          <p>
            Choisissez un registre dans le menu (Consultations, CPN, PF, Analyses, Soins),
            remplissez le formulaire. Pour l'âge, sélectionnez l'unité :
            <strong> Ans</strong>, <strong>Mois</strong>, <strong>Mois + Jours</strong> (ex: 4 mois 5 jours)
            ou <strong>Jours seulement</strong> pour les nouveau-nés.
            Cliquez sur <em>Ajouter</em>.
          </p>
        </article>

        <article className="help-card">
          <h3>4. Rechercher un patient</h3>
          <p>
            En haut de chaque registre, utilisez la barre de recherche pour filtrer
            par <strong>nom ou prénom</strong>, par <strong>âge</strong> (ex: "3 mois"),
            ou par <strong>date d'ajout</strong>. Le nombre de résultats s'affiche à droite.
            Cliquez sur <em>✕ Effacer</em> pour réinitialiser.
          </p>
        </article>

        <article className="help-card">
          <h3>5. Modifier ou supprimer</h3>
          <p>
            Dans le tableau, cliquez sur <strong>Editer</strong> pour charger les données
            dans le formulaire, modifiez puis cliquez sur <em>Modifier</em>.
            Cliquez sur <strong>Annuler</strong> pour abandonner.
            Le bouton <strong>Supprimer</strong> retire le dossier définitivement.
          </p>
        </article>

        <article className="help-card">
          <h3>6. Tableau de bord</h3>
          <p>
            Le tableau de bord affiche le total des dossiers par registre
            pour suivre l'activité en temps réel.
            Les chiffres se mettent à jour automatiquement après chaque ajout ou suppression.
          </p>
        </article>

        <article className="help-card">
          <h3>7. Gestion des utilisateurs</h3>
          <p>
            Visible uniquement pour l'<strong>administrateur</strong> dans le menu latéral.
            Permet d'<strong>activer ou désactiver</strong> les comptes,
            de <strong>réinitialiser les mots de passe</strong> oubliés
            et de supprimer des utilisateurs.
          </p>
        </article>

        <article className="help-card">
          <h3>8. Mode sombre / clair</h3>
          <p>
            Cliquez sur le bouton <strong>🌙 Mode sombre</strong> ou <strong>☀️ Mode clair</strong>
            en bas du menu pour changer l'apparence de l'application selon vos préférences.
          </p>
        </article>

      </div>
    </section>
  );
}