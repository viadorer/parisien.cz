// Propojení s Quakem (www.quak.cz): slovíčka s FSRS opakováním, kurzy a třídy. Quak je celý za přihlášením,
// po přihlášení uživatele vrátí na původní odkaz, takže hluboké odkazy fungují.
export const QUAK = 'https://www.quak.cz';
const utm = (p) => `${p}${p.includes('?') ? '&' : '?'}utm_source=parisien.cz`;
export const quakUrl = (path = '/') => `${QUAK}${utm(path)}`;

export const QUAK_TOPICS = {
  'pariz-orientace': { fr: 'Paříž: orientace a doprava', cs: 'Paříž: orientace a doprava' },
  'pariz-kavarna-jidlo': { fr: 'Paris : café, boulangerie, marché', cs: 'Paříž: kavárna, pekárna, trh' },
  'pariz-kultura': { fr: 'Paris : culture et monuments', cs: 'Paříž: kultura a památky' },
  'pariz-zivot': { fr: 'Paris : logement, études, démarches', cs: 'Paříž: bydlení, studium a záležitosti' },
  'pariz-vyrazy': { fr: 'Paris : expressions et langue parlée', cs: 'Paříž: výrazy a hovorová řeč' },
};
// Témata „Paříž“ existují v Quaku až po jeho nasazení: do té doby (QUAK_TOPICS_LIVE != 1) se odkazuje jen na obecný seznam témat.
export const TOPICS_LIVE = process.env.QUAK_TOPICS_LIVE === '1';
export const topicUrl = (id) => quakUrl(TOPICS_LIVE ? `/topics/${id}` : '/topics');

// Který quakový okruh se hodí k článku / dialogu
export const articleTopic = (base) => ({
  'baguette-boulangerie': 'pariz-kavarna-jidlo', 'cafes-litteraires': 'pariz-kultura', 'haussmann-paris-face': 'pariz-kultura', 'seine-ponts': 'pariz-kultura',
  'notre-dame-renaissance': 'pariz-kultura', 'passages-couverts': 'pariz-kultura', 'montmartre-artistes': 'pariz-kultura', 'impressionnistes': 'pariz-kultura',
  'paris-a-velo': 'pariz-orientace', 'jak-se-dostat-z-ceska': 'pariz-orientace', 'escapades-train': 'pariz-orientace',
  'etudier-en-france': 'pariz-zivot', 'parler-francais-a-paris': 'pariz-vyrazy', 'tcheques-a-paris': 'pariz-kultura', 'weekend-parisien': 'pariz-kavarna-jidlo', 'carnet-de-voyage-guide': 'pariz-zivot',
}[base] || 'pariz-zivot');
export const dialogTopic = (id) => ({
  'boulangerie-baguette': 'pariz-kavarna-jidlo', 'cafe-commande': 'pariz-kavarna-jidlo', 'marche-fruits': 'pariz-kavarna-jidlo', 'restaurant-reservation-telephone': 'pariz-kavarna-jidlo', 'restaurant-probleme': 'pariz-kavarna-jidlo',
  'metro-ticket': 'pariz-orientace', 'demander-son-chemin': 'pariz-orientace', 'objets-trouves': 'pariz-orientace', 'velo-ou-metro': 'pariz-orientace',
  'musee-billets': 'pariz-kultura', 'choisir-un-weekend': 'pariz-kultura', 'conversation-quartier': 'pariz-kultura', 'haussmann-debat': 'pariz-kultura', 'tourisme-de-masse': 'pariz-kultura',
  'hotel-reservation': 'pariz-zivot', 'visite-studio': 'pariz-zivot', 'entretien-stage': 'pariz-zivot', 'langue-et-politesse': 'pariz-vyrazy',
}[id] || 'pariz-zivot');
