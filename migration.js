/**
 * Script de migration d'administration vers Firebase Realtime Database
 * Projet Firebase : raitra-42e79
 * 
 * Ce script est exécuté en environnement d'administration sécurisé (Node.js).
 * Il ne contient AUCUNE clé privée ou credentials en dur.
 * 
 * Utilisation avec Firebase Admin SDK :
 * 1. Téléchargez votre clé de compte de service depuis la console Firebase :
 *    Paramètres du projet > Comptes de service > Générer une nouvelle clé privée
 * 2. Définissez la variable d'environnement :
 *    export GOOGLE_APPLICATION_CREDENTIALS="./serviceAccountKey.json"
 * 3. Lancez la migration :
 *    node migration.js export_data.json
 */

const fs = require('fs');
const path = require('path');

async function runAdminMigration() {
  const dataFile = process.argv[2];

  if (!dataFile || !fs.existsSync(dataFile)) {
    console.log('====================================================');
    console.log('  Outil de Migration Sécurisé vers Firebase RTDB');
    console.log('====================================================');
    console.log('Usage: node migration.js <chemin_fichier_export.json>');
    console.log('');
    console.log('Pré-requis de sécurité :');
    console.log('1. Exportez vos données au format JSON structuré :');
    console.log('   {');
    console.log('     "users": [{ "uid": "...", "displayName": "...", "email": "..." }],');
    console.log('     "messages": [{ "channelId": "general", "author": "...", "text": "..." }]');
    console.log('   }');
    console.log('2. Placez la clé de service (serviceAccountKey.json) hors du dossier public.');
    console.log('3. Exécutez : GOOGLE_APPLICATION_CREDENTIALS="./serviceAccountKey.json" node migration.js export.json');
    console.log('====================================================');
    return;
  }

  let admin;
  try {
    admin = require('firebase-admin');
  } catch (e) {
    console.error('Veuillez installer firebase-admin avant de lancer la migration :');
    console.error('npm install firebase-admin --save-dev');
    return;
  }

  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: 'raitra-42e79',
        databaseURL: 'https://raitra-42e79-default-rtdb.asia-southeast1.firebasedatabase.app'
      });
    }

    const db = admin.database();
    const rawData = fs.readFileSync(path.resolve(dataFile), 'utf8');
    const data = JSON.parse(rawData);

    console.log(`[Admin Migration] Importation des données depuis ${dataFile}...`);

    if (data.users && Array.isArray(data.users)) {
      for (const u of data.users) {
        const uid = u.uid || u.id;
        if (uid) {
          await db.ref(`users/${uid}`).set({
            displayName: u.displayName || u.name || 'Utilisateur',
            email: u.email || '',
            role: u.role || 'Membre',
            department: u.department || 'Général',
            status: 'offline',
            userStatus: 'available',
            lastSeen: Date.now()
          });
          console.log(`[+] Utilisateur importé : ${u.displayName || u.email} (${uid})`);
        }
      }
    }

    if (data.messages && Array.isArray(data.messages)) {
      for (const m of data.messages) {
        const channel = m.channelId || 'general';
        const msgRef = db.ref(`chats/${channel}/messages`).push();
        await msgRef.set({
          uid: m.uid || 'imported_user',
          name: m.author || m.name || 'Anonyme',
          text: m.text || m.content || '',
          timestamp: m.timestamp || Date.now()
        });
      }
      console.log(`[+] ${data.messages.length} messages importés dans les canaux.`);
    }

    console.log('[Admin Migration] Migration terminée avec succès.');
    process.exit(0);
  } catch (err) {
    console.error('[Admin Migration] Erreur lors de la migration :', err);
    process.exit(1);
  }
}

runAdminMigration();
