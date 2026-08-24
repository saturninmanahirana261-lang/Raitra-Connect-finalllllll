// Gestionnaire d'erreurs d'entreprise & traducteur de statuts Firebase
import { getLanguage } from './i18n';

export interface FriendlyError {
  title: string;
  message: string;
  isFatal?: boolean;
}

export function parseFirebaseError(error: any): FriendlyError {
  const lang = getLanguage();
  const errorCode = error?.code || '';
  const rawMsg = error?.message || String(error || '');

  // Dictionnaire d'erreurs fréquentes
  const errorMap: Record<string, Record<string, { title: string; message: string }>> = {
    'auth/user-not-found': {
      fr: { title: 'Compte introuvable', message: 'Aucun compte n\'est associé à cette adresse e-mail.' },
      en: { title: 'User Not Found', message: 'No account was found with this email address.' },
      mg: { title: 'Kaonty tsy hita', message: 'Tsy misy kaonty mifanaraka amin\'ity adiresy mailaka ity.' }
    },
    'auth/wrong-password': {
      fr: { title: 'Mot de passe incorrect', message: 'Le mot de passe saisi est erroné. Veuillez réessayer.' },
      en: { title: 'Wrong Password', message: 'The password entered is incorrect. Please try again.' },
      mg: { title: 'Teny miafina diso', message: 'Diso ny teny miafina nampidirinao. Andramo indray.' }
    },
    'auth/invalid-credential': {
      fr: { title: 'Identifiants invalides', message: 'L\'adresse email ou le mot de passe est incorrect.' },
      en: { title: 'Invalid Credentials', message: 'The email address or password provided is incorrect.' },
      mg: { title: 'Fidirana tsy mety', message: 'Diso ny mailaka na ny teny miafina nampidirina.' }
    },
    'auth/email-already-in-use': {
      fr: { title: 'Email déjà utilisé', message: 'Cette adresse e-mail est déjà associée à un autre compte.' },
      en: { title: 'Email Already In Use', message: 'This email address is already registered to another account.' },
      mg: { title: 'Efa misy mampiasa ny mailaka', message: 'Efa misy kaonty mampiasa ity adiresy mailaka ity.' }
    },
    'auth/weak-password': {
      fr: { title: 'Mot de passe trop court', message: 'Le mot de passe doit comporter au minimum 6 caractères.' },
      en: { title: 'Weak Password', message: 'The password must contain at least 6 characters.' },
      mg: { title: 'Teny miafina fohy loatra', message: 'Tsy maintsy farafahakeliny 6 litera na tarehimarika ny teny miafina.' }
    },
    'auth/network-request-failed': {
      fr: { title: 'Erreur de connexion', message: 'Impossible de joindre le serveur. Vérifiez votre connexion Internet.' },
      en: { title: 'Network Error', message: 'Unable to reach the servers. Please check your Internet connection.' },
      mg: { title: 'Olana fifandraisana', message: 'Tsy afaka mifandray amin\'ny mpizara. Jereo ny aterinetonao.' }
    },
    'permission-denied': {
      fr: { title: 'Accès non autorisé', message: 'Vous n\'avez pas les permissions requises pour exécuter cette action.' },
      en: { title: 'Permission Denied', message: 'You do not have the required permissions to perform this action.' },
      mg: { title: 'Tsy mahazo alalana', message: 'Tsy manana fahefana hanao ity hetsika ity ianao.' }
    },
    'storage/unauthorized': {
      fr: { title: 'Fichier non autorisé', message: 'L\'accès ou l\'envoi de cette pièce jointe n\'a pas été autorisé.' },
      en: { title: 'Storage Unauthorized', message: 'Access or upload of this file was denied.' },
      mg: { title: 'Tsy nahazoana alalana ny tahirin-kevitra', message: 'Tsy nahazoana alalana ny fandefasana ity rakitra ity.' }
    },
    'storage/quota-exceeded': {
      fr: { title: 'Quota dépassé', message: 'L\'espace de stockage est saturé. Veuillez contacter l\'administrateur.' },
      en: { title: 'Quota Exceeded', message: 'Storage limit reached. Please contact your administrator.' },
      mg: { title: 'Feno ny tahiry', message: 'Feno ny toerana fitehirizana rakitra.' }
    },
    'storage/canceled': {
      fr: { title: 'Envoi annulé', message: 'L\'envoi du fichier audio a été interrompu.' },
      en: { title: 'Upload Canceled', message: 'The audio file upload was canceled.' },
      mg: { title: 'Nofoanana ny fandefasana', message: 'Nofoanana ny fandefasana feo.' }
    }
  };

  const match = errorMap[errorCode]?.[lang] || errorMap[errorCode]?.['fr'];
  if (match) {
    return { title: match.title, message: match.message };
  }

  // Fallback propre
  return {
    title: lang === 'en' ? 'An error occurred' : lang === 'mg' ? 'Nisy olana nitranga' : 'Une erreur est survenue',
    message: rawMsg || (lang === 'en' ? 'Unexpected issue. Please try again.' : 'Veuillez réessayer ultérieurement.')
  };
}
