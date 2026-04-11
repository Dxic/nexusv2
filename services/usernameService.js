/**
 * Username Service
 * Generates unique Adjective_Noun usernames.
 * Each username is permanently reserved in MongoDB — once assigned,
 * it can never be given to another user.
 */
const UsedUsername = require('../models/UsedUsername');

const ADJECTIVES = [
  'swift','silent','neon','amber','iron','lunar','solar','dark','frost','jade',
  'stark','brave','crisp','dusk','echo','feral','ghost','hazy','icy','keen',
  'lean','mute','noble','odd','pale','quick','raw','sage','teal','ultra',
  'vast','wild','xeno','young','zeal','acid','bold','calm','deep','edgy',
  'firm','grim','hard','idle','just','kind','lost','mild','near','open',
  'pure','real','slim','true','used','void','warm','xray','yore','zero'
];

const NOUNS = [
  'falcon','raven','wolf','tiger','cobra','panda','eagle','viper','lynx','bear',
  'hawk','shark','fox','deer','crow','bull','orca','lion','mink','ox',
  'elk','bat','ray','eel','yak','asp','gnu','koi','emu','ram',
  'crab','dove','frog','gull','ibis','jade','kite','lark','moth','newt',
  'pike','quail','rook','seal','toad','urus','vole','wasp','xray','zebu'
];

/**
 * Generate a random adjective_noun combo and check DB for uniqueness.
 * Retries up to 20 times before throwing.
 */
async function generateUniqueUsername() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const adj  = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num  = Math.floor(Math.random() * 90) + 10; // 10–99
    const username = `${adj}_${noun}${num}`;

    try {
      await UsedUsername.create({ username });
      return username; // claimed successfully
    } catch (e) {
      if (e.code === 11000) continue; // duplicate — try again
      throw e;
    }
  }
  throw new Error('Could not generate unique username after 20 attempts');
}

module.exports = { generateUniqueUsername };
