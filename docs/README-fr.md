# Liaoshu · 聊书

> Lecture approfondie conversationnelle — engagez un dialogue intellectuel avec des agentsuteurs et cristallisez vos réflexions authentiques.

**Version de livraison MVP · 2026-06-11**

---

## En une phrase

> **Liaoshu** = Lecture approfondie conversationnelle qui vous laisse avec une réflexion véritable et cristallisée.

Chaque auteur est un agent IA qui guide proactivement les lecteurs vers la réflexion, le débat et la génération d'insights originaux.

---

## Démarrez en 5 Minutes

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement (copier depuis .env.example)
cp .env.example .env

# 3. Lancer le serveur
npm start

# 4. Ouvrir dans le navigateur
open http://localhost:3000
```

À la première lancement, cliquez sur **「+ Ajouter un livre」**, choisissez un livre dans la bibliothèque intégrée et commencez à discuter.

### Exécuter les Tests End-to-End

```bash
npm run smoke
```

Les 13 tests doivent tous réussir.

---

## Bibliothèque Intégrée (6 Livres)

| # | Titre | Auteur | Catégorie | Chapitres |
|---|-------|--------|-----------|-----------|
| 1 | Les 7 Habitudes des Gens Très Efficaces | Stephen R. Covey | Management/Développement personnel | 8 |
| 2 | Jeux Finis et Infinis | James P. Carse | Philosophie/Réflexion | 5 |
| 3 | Système 1 / Système 2 | Daniel Kahneman | Psychologie/Prise de décision | 5 |
| 4 | Expertise | Anders Ericsson | Psychologie/Apprentissage | 5 |
| 5 | Atomic Habits | James Clear | Développement personnel/Méthodologie | 6 |
| 6 | Flow | Mihaly Csikszentmihalyi | Psychologie/Bien-être | 5 |

---

## Configuration

`.env`:

```env
PORT=3000
LLM_URL=https://aihub.firstshare.cn
LLM_KEY=sk-...                          # votre clé LLM
LLM_MODEL=claude-sonnet-4-6             # modèle compatible OpenAI
DATA_DIR=./data
```

`LLM_KEY` est requis. Sans cela, le dialogue ne peut pas appeler le LLM.

---

*Lecture Approfondie Conversationnelle · Crystallisez Votre Pensée*
*Équipe Liaoshu · 2026-06-11*
