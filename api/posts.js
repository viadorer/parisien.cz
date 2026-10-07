// Veřejné čtení článků.  GET /api/posts[?cat=paris|voyage|langue][&limit=n]   |   GET /api/posts?slug=xyz
import { send } from '../lib/http.js';
import { getPosts, getPost, CATEGORIES } from '../lib/posts.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  const q = new URL(req.url, 'http://x').searchParams;
  const cache = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' };
  try {
    const slug = q.get('slug');
    if (slug) {
      const p = await getPost(slug);
      return p ? send(res, 200, p, cache) : send(res, 404, { error: 'Not found' });
    }
    const cat = CATEGORIES.includes(q.get('cat')) ? q.get('cat') : undefined;
    const limit = Math.min(Math.max(parseInt(q.get('limit'), 10) || 100, 1), 100);
    return send(res, 200, { posts: await getPosts({ cat, limit }) }, cache);
  } catch (e) {
    console.error('posts', e);
    return send(res, 500, { error: 'Server error' });
  }
}
