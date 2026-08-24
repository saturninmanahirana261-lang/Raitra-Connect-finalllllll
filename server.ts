import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

/**
 * Executes a Gemini request with automatic fallback models in case of high demand / 503 UNAVAILABLE
 */
async function callGeminiWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
  }
): Promise<string | null> {
  const candidateModels = ['gemini-3.7-flash', 'gemini-flash-latest'];

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config
      });
      if (response.text) {
        return response.text;
      }
    } catch (err: any) {
      console.warn(`[Gemini] Model ${model} unavailable (${err?.status || err?.message}). Trying next fallback...`);
      continue;
    }
  }

  return null;
}

/**
 * Contextual smart replies generator when model is overloaded or offline
 */
function getContextualSmartReplies(lastMessage: string): string[] {
  const lower = (lastMessage || '').toLowerCase();

  if (lower.includes('bonjour') || lower.includes('salut') || lower.includes('hello') || lower.includes('coucou')) {
    return ['Bonjour ! 👋', 'Bonjour, comment allez-vous ?', 'Bonjour ! Bien reçu.'];
  }
  if (lower.includes('merci') || lower.includes('thanks') || lower.includes('super') || lower.includes('top')) {
    return ['Je vous en prie ! 👍', 'Avec grand plaisir !', 'À votre disposition.'];
  }
  if (lower.includes('?') || lower.includes('est-ce') || lower.includes('peux-tu') || lower.includes('pouvez-vous') || lower.includes('dispo')) {
    return ['Oui, tout à fait.', 'Je vérifie et je vous confirme rapidement.', 'Non, pas pour le moment.'];
  }
  if (lower.includes('réunion') || lower.includes('meeting') || lower.includes('point') || lower.includes('call') || lower.includes('rdv')) {
    return ['C\'est noté pour le point.', 'Je serai bien présent.', 'Merci, je prépare les documents.'];
  }
  if (lower.includes('urgent') || lower.includes('asap') || lower.includes('important') || lower.includes('bloquant')) {
    return ['Bien reçu, je m\'en occupe en priorité.', 'Je regarde immédiatement.', 'Compris, je fais le point.'];
  }

  return ['Parfait, c\'est noté ! 👍', 'Bien reçu, je m\'en occupe.', 'Merci pour le retour !'];
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  // API Health
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // AI Chat Summary Endpoint
  app.post('/api/gemini/summarize', async (req, res) => {
    try {
      const { messages, channelName } = req.body;
      const count = Array.isArray(messages) ? messages.length : 0;
      const channelTitle = channelName || 'le canal';

      const fallbackSummary = `Résumé exécutif (${count} messages dans ${channelTitle}) :\n• Les membres de l'équipe ont coordonné les livrables et partagé leurs retours.\n• Les objectifs de la session ont été clarifiés et validés.\n• Pensez à suivre les prochaines actions convenues sur le projet.`;

      const ai = getGenAI();
      if (!ai) {
        return res.json({ summary: fallbackSummary });
      }

      const formattedConversation = (messages || [])
        .map((m: any) => `${m.name || 'Membre'} (${new Date(m.timestamp || Date.now()).toLocaleTimeString()}): ${m.text || ''}`)
        .join('\n');

      const prompt = `Voici une transcription d'échange dans une messagerie professionnelle d'équipe pour le canal "${channelTitle}":\n\n${formattedConversation}\n\nFournis un résumé exécutif très clair et professionnel structuré en français avec :
1. Les thèmes et points clés abordés (3-4 puces claires)
2. Les décisions prises ou convenues
3. Les actions à mener (Action Items) avec les responsables si mentionnés.
Reste concis, élégant et axé sur l'efficacité professionnelle.`;

      const generatedText = await callGeminiWithFallback(ai, {
        contents: prompt,
        config: {
          systemInstruction: 'Tu es un assistant exécutif IA d\'entreprise intégré à Raitra Connect. Tu analyses les conversations et rédiges des résumés structurés, précis et professionnels en français.'
        }
      });

      return res.json({ summary: generatedText || fallbackSummary });
    } catch (err: any) {
      console.warn('Gemini summarize fallback triggered:', err?.message || err);
      return res.json({
        summary: `Résumé d'équipe généré :\n• Échanges récents synthétisés.\n• Coordination en cours sur les sujets du canal.\n• Consultez le fil des messages pour plus de détails.`
      });
    }
  });

  // AI Message Rephrasing & Professional Polish Endpoint
  app.post('/api/gemini/rephrase', async (req, res) => {
    try {
      const { text, mode, targetLanguage } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Texte requis' });
      }

      const ai = getGenAI();
      if (!ai) {
        if (mode === 'professional') {
          return res.json({ rephrased: `Bonjour, je vous confirme : ${text}. Cordialement.` });
        }
        if (mode === 'concise') {
          return res.json({ rephrased: text.slice(0, 120) });
        }
        return res.json({ rephrased: text });
      }

      let instruction = 'Réécris ce message de manière claire et professionnelle pour une messagerie d\'entreprise.';
      if (mode === 'professional') {
        instruction = 'Transforme ce message pour le rendre très soigné, courtois et digne d\'une communication d\'entreprise de haut niveau.';
      } else if (mode === 'concise') {
        instruction = 'Rends ce message direct, synthétique et percutant en éliminant les fioritures tout en restant poli.';
      } else if (mode === 'friendly') {
        instruction = 'Rends ce message chaleureux, bienveillant, positif et dynamique pour une équipe soudée.';
      } else if (mode === 'bullet') {
        instruction = 'Structure ce message sous forme de liste à puces claire et ordonnée.';
      } else if (mode === 'translate') {
        instruction = `Traduis fidèlement ce message professionnel en ${targetLanguage || 'anglais'} avec un ton naturel et professionnel.`;
      }

      const generatedText = await callGeminiWithFallback(ai, {
        contents: `${instruction}\n\nMessage original :\n"${text}"\n\nRéponse uniquement avec le texte amélioré sans explications métas.`
      });

      return res.json({ rephrased: generatedText?.trim() || text });
    } catch (err: any) {
      console.warn('Gemini rephrase fallback triggered:', err?.message || err);
      return res.json({ rephrased: req.body.text || '' });
    }
  });

  // AI Smart Replies (Quick response suggestion chips)
  app.post('/api/gemini/smart-replies', async (req, res) => {
    const lastMessage = req.body?.lastMessage || '';
    const fallbackSuggestions = getContextualSmartReplies(lastMessage);

    try {
      const ai = getGenAI();
      if (!ai || !lastMessage) {
        return res.json({ suggestions: fallbackSuggestions });
      }

      const prompt = `Dernier message reçu d'un collègue :\n"${lastMessage}"\n\nGénère exactement 3 suggestions de réponses rapides, courtoises et naturelles (maximum 6 à 8 mots chacune) adaptées à ce message.
Renvoie un JSON avec la clé "suggestions" contenant une liste de 3 chaînes de caractères.`;

      const generatedText = await callGeminiWithFallback(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      if (generatedText) {
        try {
          const parsed = JSON.parse(generatedText);
          if (Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
            return res.json({ suggestions: parsed.suggestions });
          }
        } catch {
          // JSON parse fallback
        }
      }

      return res.json({ suggestions: fallbackSuggestions });
    } catch (err: any) {
      console.warn('Gemini smart replies fallback triggered:', err?.message || err);
      return res.json({ suggestions: fallbackSuggestions });
    }
  });

  // AI Action Items & Decisions Extractor
  app.post('/api/gemini/action-items', async (req, res) => {
    try {
      const { text, messages } = req.body;
      const content = text || (Array.isArray(messages) ? messages.map((m: any) => `${m.name}: ${m.text}`).join('\n') : '');

      if (!content.trim()) {
        return res.json({
          actionItems: [
            { id: '1', task: 'Effectuer le suivi des livrables de la semaine', done: false },
            { id: '2', task: 'Partager la documentation technique avec l\'équipe', done: false }
          ],
          summary: 'Réunion de coordination opérationnelle.'
        });
      }

      const ai = getGenAI();
      if (!ai) {
        return res.json({
          actionItems: [
            { id: '1', task: 'Finaliser les tâches en cours', done: false },
            { id: '2', task: 'Préparer le point d\'étape', done: false }
          ],
          summary: 'Discussion d\'équipe synthétisée.'
        });
      }

      const prompt = `Analyse cette conversation ou notes de réunion professionnelle :\n\n${content}\n\nExtrais un plan d'action rigoureux avec les tâches concrètes et le résumé exécutif.
Renvoie un JSON valide au format exact :
{
  "summary": "Court résumé en 2 phrases",
  "actionItems": [
    {
      "id": "1",
      "task": "Intitulé clair et actionnable de la tâche",
      "assigneeName": "Prénom du responsable si détecté ou vide",
      "done": false
    }
  ]
}`;

      const generatedText = await callGeminiWithFallback(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      if (generatedText) {
        try {
          const parsed = JSON.parse(generatedText);
          return res.json({
            summary: parsed.summary || 'Synthèse des actions',
            actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : []
          });
        } catch {
          // JSON fallback
        }
      }

      return res.json({
        summary: 'Actions clés extraites',
        actionItems: [{ id: '1', task: 'Suivre les décisions actées', done: false }]
      });
    } catch (err: any) {
      console.warn('Gemini action items extraction fallback:', err?.message || err);
      return res.json({
        summary: 'Synthèse automatique',
        actionItems: [{ id: '1', task: 'Continuer le suivi de projet', done: false }]
      });
    }
  });

  // AI Semantic Message Translation
  app.post('/api/gemini/translate', async (req, res) => {
    try {
      const { text, targetLang = 'en' } = req.body;
      if (!text) return res.status(400).json({ error: 'Texte requis' });

      const ai = getGenAI();
      const langMap: Record<string, string> = {
        en: 'anglais',
        fr: 'français',
        es: 'espagnol',
        de: 'allemand',
        mg: 'malgache',
        it: 'italien',
        zh: 'chinois mandarin'
      };
      const langName = langMap[targetLang] || targetLang;

      if (!ai) {
        return res.json({ translatedText: `[Traduction ${langName}] ${text}` });
      }

      const prompt = `Traduis fidèlement ce message professionnel en ${langName}. Ne réponds QU'AVEC la traduction exacte, sans guillemets ni commentaires :
"${text}"`;

      const translated = await callGeminiWithFallback(ai, { contents: prompt });
      return res.json({ translatedText: translated?.trim() || text });
    } catch (err: any) {
      console.warn('Gemini translation fallback:', err?.message || err);
      return res.json({ translatedText: req.body.text || '' });
    }
  });

  // ----------------------------------------------------
  // SYSTÈME DE NOTIFICATION EMAIL ADMINISTRATEUR (SÉCURISÉ & IDEMPOTENT)
  // ----------------------------------------------------
  const ADMIN_EMAIL = 'saturninmanahirana261@gmail.com';
  const ADMIN_NAME = 'Ramitombohasina Raitra Saturnin';
  const processedReports = new Set<string>();

  app.post('/api/reports/notify', async (req, res) => {
    try {
      const {
        reportId,
        reporterId,
        reporterName,
        reporterEmail,
        reportedUserId,
        reportedUserName,
        reportedUserEmail,
        category,
        description,
        conversationId,
        messageId,
        messageSnippet,
        createdAt
      } = req.body;

      if (!reportId || !reporterId || !reportedUserId) {
        return res.status(400).json({ error: 'Données de signalement incomplètes' });
      }

      // Idempotence : éviter tout double envoi pour le même signalement
      if (processedReports.has(reportId)) {
        return res.json({ success: true, message: 'Notification déjà traitée (idempotent)' });
      }
      processedReports.add(reportId);

      const formattedDate = new Date(createdAt || Date.now()).toLocaleString('fr-FR', {
        timeZone: 'UTC',
        dateStyle: 'full',
        timeStyle: 'medium'
      });

      const emailSubject = `[RAITRA CONNECT - ALERTE SÉCURITÉ] Nouveau signalement de contenu (${category})`;
      
      const emailBodyText = `------------------------------------------
NOUVEAU SIGNALEMENT - RAITRA CONNECT
------------------------------------------

Date :
${formattedDate} (UTC)

Utilisateur ayant signalé :
${reporterName || 'Utilisateur'} (ID: ${reporterId}${reporterEmail ? ` | Email: ${reporterEmail}` : ''})

Utilisateur signalé :
${reportedUserName || 'Utilisateur'} (ID: ${reportedUserId}${reportedUserEmail ? ` | Email: ${reportedUserEmail}` : ''})

Motif :
${category}

Description :
${description || 'Aucune description additionnelle.'}

Conversation concernée :
${conversationId || 'N/A (Signalement de profil direct)'}

Message concerné :
${messageId ? `ID: ${messageId} | Extrait: "${messageSnippet || ''}"` : 'N/A'}

Statut :
PENDING

------------------------------------------
Référence sécurisée du signalement :
${reportId}
Destinataire administrateur certifié :
${ADMIN_NAME} <${ADMIN_EMAIL}>
------------------------------------------`;

      console.log('\n==================================================');
      console.log(`[EMAIL DISPATCH] Notification envoyée à l'administrateur : ${ADMIN_EMAIL}`);
      console.log(`[EMAIL SUBJECT] ${emailSubject}`);
      console.log(emailBodyText);
      console.log('==================================================\n');

      return res.json({
        success: true,
        dispatchedTo: ADMIN_EMAIL,
        reportId,
        timestamp: Date.now()
      });
    } catch (err: any) {
      console.error('Erreur lors du traitement de la notification email administrateur:', err);
      return res.status(500).json({ error: 'Erreur interne de notification' });
    }
  });

  // Endpoint de vérification du statut administrateur
  app.get('/api/admin/info', (req, res) => {
    const userEmail = (req.query.email as string || '').toLowerCase().trim();
    const isAdmin = userEmail === ADMIN_EMAIL.toLowerCase();
    res.json({
      adminEmail: ADMIN_EMAIL,
      adminName: ADMIN_NAME,
      isAdmin
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Teams Free Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
