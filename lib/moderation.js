// Skrytí / obnovení obsahu (jedním voláním). Používá hlášení i admin.
import { sql } from './db.js';

export async function hideTarget(kind, target, hide) {
  if (kind === 'post') {
    if (hide) await sql`UPDATE posts SET published = FALSE, status = 'hidden' WHERE slug = ${target} AND author_user_id IS NOT NULL AND status = 'published'`;
    else await sql`UPDATE posts SET published = TRUE, status = 'published' WHERE slug = ${target} AND author_user_id IS NOT NULL AND status = 'hidden'`;
  } else if (kind === 'postcard') {
    const id = Number(target) || 0;
    if (hide) await sql`UPDATE postcards SET status = 'hidden' WHERE id = ${id} AND status = 'published'`;
    else await sql`UPDATE postcards SET status = 'published' WHERE id = ${id} AND status = 'hidden'`;
  } else if (kind === 'profile') {
    await sql`UPDATE users SET profile_hidden = ${Boolean(hide)} WHERE public_slug = ${target}`;
  }
}
