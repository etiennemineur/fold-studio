import { schema, OutputType } from "./render_POST.schema";
import OpenAI from "openai";
import { jwtVerify } from "jose";
import { db } from "../../helpers/db";

export async function handle(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set.");
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const json = JSON.parse(await request.text());
    const data = schema.parse(json);

    // Verify authentication
    const cookieHeader = request.headers.get("cookie");
    const tokenMatch = cookieHeader?.match(/(?:^|;\s*)auth_token=([^;]*)/);
    const token = tokenMatch ? tokenMatch[1] : null;

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401 }
      );
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify<{ userId: number }>(token, secret);

    // Fetch user from DB to ensure they still exist and are active
    const user = await db
      .selectFrom("users")
      .select(["id", "isActive"])
      .where("id", "=", payload.userId)
      .executeTakeFirst();

    if (!user || !user.isActive) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401 }
      );
    }

    let promptText = `À partir de l'image 3D de référence fournie, crée une photographie de studio publicitaire extrêmement réaliste et précise du packaging présenté.

L'image de référence constitue la source visuelle unique et doit être interprétée comme un document technique. Reproduis fidèlement tous les éléments visibles, sans réinterprétation créative, sans simplification et sans ajout décoratif non demandé.

OBJECTIF

Transformer le rendu 3D d'origine en une photographie de packaging ultra professionnelle, photoréaliste, comparable à une prise de vue réalisée dans un studio spécialisé en photographie publicitaire de produits.

Le résultat final doit conserver exactement le design, les proportions, la géométrie, le cadrage, l'orientation, la perspective et la composition de l'image source, tout en remplaçant l'apparence artificielle du rendu 3D par des matières, des lumières, des ombres, des reflets et des détails photographiques physiquement crédibles.

RESPECT ABSOLU DE L'IMAGE DE RÉFÉRENCE

Conserver rigoureusement :

• la forme générale du packaging
• ses dimensions relatives
• son rapport hauteur, largeur et profondeur
• l'épaisseur de chaque partie
• les angles, courbures, arêtes, plis, découpes, ouvertures et assemblages
• la position exacte de chaque élément
• la distance entre les différents composants
• l'échelle et les proportions de l'objet
• l'orientation du produit dans l'espace
• le point de vue de la caméra
• la focale apparente
• le cadrage
• la perspective
• la ligne d'horizon
• la position de l'objet dans l'image
• l'espace vide autour du produit

Ne pas élargir, rétrécir, allonger, épaissir ou déformer le packaging. Ne pas corriger arbitrairement sa forme. Ne pas rendre le produit plus élégant, plus symétrique ou plus commercial que dans l'image de référence.

GRAPHISME ET INFORMATIONS IMPRIMÉES

Reproduire à l'identique tous les éléments graphiques visibles :

• logos
• noms de marque
• noms de produit
• textes principaux et secondaires
• mentions légales
• chiffres
• pictogrammes
• symboles
• codes graphiques
• illustrations
• photographies imprimées
• motifs
• aplats de couleur
• dégradés
• filets
• cadres
• zones de réserve
• rapports d'échelle entre les éléments
• alignements
• espacements
• marges
• positionnement sur les différentes faces du packaging

Respecter précisément les typographies visibles. Conserver leur famille apparente, leur graisse, leur largeur, leur hauteur, leur chasse, leur interlettrage, leur interlignage, leur casse, leurs proportions et leur position.

Tous les textes doivent rester lisibles et orthographiés exactement comme sur l'image d'origine. Ne pas inventer de lettres, ne pas remplacer les mots par du faux texte, ne pas modifier les logos, ne pas déplacer les informations et ne pas reformuler les mentions imprimées.

Lorsque certaines informations sont partiellement masquées, ne pas inventer leur contenu. Conserver uniquement ce qui peut être déduit de l'image fournie.

COULEURS

Reproduire fidèlement toutes les couleurs présentes dans l'image 3D :

• teinte
• saturation
• luminosité
• contraste
• température colorée
• équilibre entre couleurs chaudes et froides
• densité des noirs
• luminosité des blancs
• couleur des encres
• couleur des matériaux
• couleur des éléments transparents ou translucides

Ne pas modifier la palette graphique. Ne pas ajouter de dominante colorée qui altérerait l'identité visuelle du packaging.

Les couleurs doivent rester cohérentes avec une photographie de produit réalisée avec un flux colorimétrique professionnel, une balance des blancs neutre et une restitution naturelle des matières.

MATÉRIAUX ET TEXTURES

Identifier visuellement les matériaux présents dans l'image de référence et les convertir en matières photoréalistes crédibles.

Restituer avec précision, selon le cas :

• carton couché mat
• carton satiné
• papier imprimé
• plastique injecté
• plastique thermoformé
• plastique opaque
• plastique translucide
• verre
• métal peint
• aluminium
• acier
• surface chromée
• film transparent
• étiquette adhésive
• vernis sélectif
• pelliculage mat
• pelliculage brillant
• gaufrage
• débossage
• dorure
• marquage à chaud
• impression sérigraphique
• texture moulée
• micro-rayures naturelles
• légères irrégularités de fabrication

La matière doit présenter une rugosité, une brillance, une réflexion et une translucidité adaptées à sa nature physique.

Éviter les surfaces numériques trop parfaites. Ajouter uniquement les micro-détails réalistes nécessaires à la crédibilité photographique, sans salir le produit et sans créer d'usure excessive.

Le packaging doit paraître neuf, propre, manipulé avec soin et photographié pour une campagne publicitaire haut de gamme.

LUMIÈRE DE STUDIO

Créer un éclairage de studio professionnel, élégant, contrôlé et physiquement réaliste.

Utiliser une grande source principale diffuse, placée en hauteur et légèrement de côté, produisant un modelé doux et précis sur le volume.

Ajouter une lumière de remplissage plus faible sur le côté opposé afin de conserver les détails dans les zones sombres sans supprimer le relief.

Ajouter, lorsque la géométrie le permet, une lumière de contour très subtile pour séparer clairement le produit du fond et souligner ses arêtes.

Les reflets doivent suivre la forme réelle de l'objet. Ils doivent révéler les volumes, les courbures et les matériaux sans masquer les textes ni brûler les zones imprimées.

Éviter les reflets incohérents, les brillances aléatoires, les lumières multiples contradictoires et les zones surexposées.

La lumière doit rester douce, précise et directionnelle, avec une gradation naturelle entre les hautes lumières, les tons moyens et les ombres.

OMBRES

Créer une ombre de contact réaliste sous le produit afin qu'il paraisse correctement posé sur la surface.

L'ombre doit correspondre exactement à la direction, à la taille et à la diffusion des sources lumineuses.

Elle doit être plus dense au contact du produit, puis devenir progressivement plus douce et plus claire en s'éloignant.

Ne pas créer d'ombre artificiellement dure, de halo sombre, d'ombre flottante ou de double ombre incohérente.

Si plusieurs objets sont présents, leurs ombres doivent respecter leurs positions respectives et leurs distances réelles.

REFLETS ET TRANSPARENCES

Calculer les reflets en fonction de la géométrie, de la courbure et de la rugosité de chaque surface.

Les surfaces brillantes doivent refléter les grandes sources lumineuses du studio sous forme de lignes ou de plages lumineuses propres, continues et réalistes.

Les surfaces mates doivent produire des reflets larges et atténués.

Les surfaces métalliques doivent présenter des contrastes plus marqués, sans aspect miroir artificiel sauf si le matériau d'origine l'exige.

Les éléments transparents ou translucides doivent montrer une réfraction cohérente, une épaisseur visible, des reflets de surface et une transmission lumineuse réaliste.

Ne pas ajouter de reflets décoratifs qui ne correspondent pas à une source lumineuse identifiable.

PRISE DE VUE

Photographie réalisée avec un appareil moyen format professionnel ou un appareil plein format haute définition.

Objectif de photographie de produit à très faible distorsion, équivalent à une focale comprise entre 70 et 120 mm selon la perspective visible dans l'image de référence.

Conserver exactement la perspective originale. Ne pas utiliser de grand-angle. Ne pas accentuer artificiellement la profondeur.

Image parfaitement nette sur l'ensemble du packaging, avec une profondeur de champ suffisante pour que tous les textes, les contours et les détails importants restent lisibles.

Mise au point précise sur la face principale du produit.

Aucune distorsion optique visible, aucune aberration chromatique, aucun flou de mouvement, aucun grain excessif et aucun effet de netteté numérique agressif.

FOND ET ENVIRONNEMENT

Conserver le fond de l'image de référence lorsqu'il constitue une donnée importante de la composition.

Si le fond d'origine est neutre ou peu défini, utiliser un fond de studio blanc, blanc cassé ou gris très clair, uniforme, propre et sans texture envahissante.

Créer une légère transition tonale entre le fond et le sol afin de donner une profondeur naturelle à la scène, sans ligne d'horizon trop visible.

Ne pas ajouter d'accessoires, de décor, de végétation, de liquide, de particules, de socle, de texte supplémentaire ou d'élément narratif absent de l'image de référence.

QUALITÉ FINALE

Rendu photoréaliste extrêmement détaillé.

Qualité photographique publicitaire haut de gamme.

Définition très élevée.

Contours précis et naturels.

Textures fines et physiquement crédibles.

Transitions lumineuses progressives.

Couleurs propres et fidèles.

Noirs détaillés.

Blancs non brûlés.

Aucune dominante colorée indésirable.

Aucun aspect d'illustration, de dessin, de peinture numérique, de rendu de jeu vidéo ou de modélisation 3D visible.

Le résultat doit donner l'impression que le véritable packaging a été fabriqué, imprimé, assemblé puis photographié dans un studio professionnel spécialisé dans les produits de luxe, la cosmétique, l'alimentaire ou les objets de grande consommation.

CONTRAINTES NÉGATIVES

Ne pas modifier la forme du produit.

Ne pas modifier les proportions.

Ne pas modifier le cadrage.

Ne pas modifier la perspective.

Ne pas déplacer les objets.

Ne pas changer les couleurs.

Ne pas refaire le design graphique.

Ne pas remplacer les typographies.

Ne pas inventer de texte.

Ne pas corriger les logos.

Ne pas ajouter de détails graphiques.

Ne pas supprimer de mentions visibles.

Ne pas créer de fausses étiquettes.

Ne pas créer de faux reflets.

Ne pas produire de plastique trop lisse.

Ne pas produire de métal artificiel.

Ne pas produire de carton sans épaisseur.

Ne pas arrondir les arêtes qui sont droites.

Ne pas rendre droites les surfaces qui sont courbes.

Ne pas ajouter de texture générique.

Ne pas créer d'effet cinématographique excessif.

Ne pas créer de profondeur de champ trop courte.

Ne pas produire de flou sur les textes.

Ne pas produire de texte déformé ou illisible.

Ne pas produire de lettres incohérentes.

Ne pas ajouter de grain, de poussière ou de rayures importantes.

Ne pas ajouter d'élément absent de l'image de référence.

PRIORITÉ DE TRAITEMENT

Priorité 1 : respect exact de la géométrie et des proportions.

Priorité 2 : respect exact du graphisme, des textes, des logos et des typographies.

Priorité 3 : respect exact des couleurs et de leur position.

Priorité 4 : réalisme des matériaux.

Priorité 5 : qualité de la lumière, des ombres et des reflets.

Priorité 6 : perfection photographique générale.

En cas d'incertitude, toujours privilégier la fidélité à l'image 3D d'origine plutôt qu'une interprétation esthétique.

Générer une seule image finale, parfaitement propre, cohérente, fidèle à la référence et prête pour une utilisation publicitaire professionnelle.

INFORMATIONS TECHNIQUES DU PRODUIT

• Type de forme : ${data.shapeType}
• Dimensions : ${data.width} × ${data.height} × ${data.depth} mm
• Type de matériau : ${data.materialType}
• Couleur extérieure : ${data.exteriorColor}
• Couleur intérieure : ${data.interiorColor}`;
 
    if (data.prompt) {
      promptText += `\n\nInstructions supplémentaires de l'utilisateur : ${data.prompt}`;
    }

    const base64Data = data.canvasImageBase64.replace(
      /^data:image\/\w+;base64,/,
      ""
    );
    const buffer = Buffer.from(base64Data, "base64");

    // Creating a standard File object compatible with Fetch API environments and OpenAI SDK
    const file = new File([buffer], "image.png", { type: "image/png" });

    const imageInputs: File[] = [file];

    if (data.referenceImageBase64) {
      const refBase64Data = data.referenceImageBase64.replace(/^data:image\/\w+;base64,/, "");
      const refBuffer = Buffer.from(refBase64Data, "base64");
      imageInputs.push(new File([refBuffer], "reference.png", { type: "image/png" }));
    }

    const response = await openai.images.edit({
      model: "gpt-image-2", // OpenAI's latest and most capable image model that supports the edit endpoint
      image: imageInputs,
      prompt: promptText,
      n: 1,
      size: "auto",
    });

    if (!response.data) {
      throw new Error("No image data in response");
    }

    const b64_json = response.data[0]?.b64_json;
    if (!b64_json) {
      throw new Error("No image generated by the AI.");
    }

    return new Response(
      JSON.stringify({ imageBase64: b64_json } satisfies OutputType)
    );
    } catch (error: any) {
    if (error?.code === "ERR_JWT_CLAIM_INVALID" || error?.code === "ERR_JWS_INVALID" || error?.name === "JWTClaimValidationFailed" || error?.name === "JWSSignatureVerificationFailed") {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401 }
      );
    }
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process image." }),
      { status: 400 }
    );
  }
}