// Úvodní články: generuje je scripts/build.mjs z data/articles(-levels)/*.json do articles.generated.js.
import generated, { SEED_VERSION } from './articles.generated.js';
export const SEED_POSTS = generated;
export { SEED_VERSION };
