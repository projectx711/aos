// 6-character code: letters + digits + symbols (guess karna bahut mushkil)
const CS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789&%$@!*+=';
const CODE_LEN = 6;
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const rnd = () => { let c = ''; for (const x of crypto.getRandomValues(new Uint32Array(CODE_LEN))) c += CS[x % CS.length]; return c; };
const validCode = c => !!c && c.length === CODE_LEN && [...c].every(ch => CS.includes(ch));

export default {
  async fetch(req, env) {
    const u = new URL(req.url), p = u.pathname.split('/').filter(Boolean);
    if (p[0] !== 'api') return env.ASSETS.fetch(req);
    const act = p[1];
    let code = '';
    try { code = decodeURIComponent(p[2] || ''); } catch (e) {}
    try {
      if (act === 'new' && req.method === 'POST') {
        for (let i = 0; i < 10; i++) {
          const c = rnd();
          const l = await env.BUCKET.list({ prefix: c + '/', limit: 1 });
          if (!l.objects.length) return json({ code: c });
        }
        return json({ error: 'busy, try again' }, 503);
      }
      if (!validCode(code)) return json({ error: 'bad code' }, 400);

      if (act === 'mpstart' && req.method === 'POST') {
        const name = (u.searchParams.get('name') || 'file').replace(/[\/\\]/g, '_').slice(0, 200);
        const key = `${code}/${crypto.randomUUID().slice(0, 8)}-${name}`;
        const mp = await env.BUCKET.createMultipartUpload(key, {
          httpMetadata: { contentType: req.headers.get('content-type') || 'application/octet-stream' },
          customMetadata: { name }
        });
        return json({ key, uploadId: mp.uploadId });
      }
      if (act === 'mppart' && req.method === 'PUT') {
        const key = u.searchParams.get('key') || '';
        if (!key.startsWith(code + '/')) return json({ error: 'bad key' }, 400);
        const mp = env.BUCKET.resumeMultipartUpload(key, u.searchParams.get('id'));
        const part = await mp.uploadPart(Number(u.searchParams.get('n')), req.body);
        return json(part);
      }
      if (act === 'mpend' && req.method === 'POST') {
        const b = await req.json();
        if (!String(b.key).startsWith(code + '/')) return json({ error: 'bad key' }, 400);
        const mp = env.BUCKET.resumeMultipartUpload(b.key, b.id);
        await mp.complete(b.parts);
        return json({ ok: true });
      }
      if (act === 'list') {
        const l = await env.BUCKET.list({ prefix: code + '/', include: ['customMetadata'] });
        return json({ files: l.objects.map(o => ({ key: o.key, name: o.customMetadata?.name || o.key, size: o.size })) });
      }
      if (act === 'file') {
        const key = u.searchParams.get('key') || '';
        if (!key.startsWith(code + '/')) return json({ error: 'bad key' }, 400);
        const o = await env.BUCKET.get(key);
        if (!o) return json({ error: 'not found' }, 404);
        const name = o.customMetadata?.name || 'file';
        return new Response(o.body, { headers: {
          'Content-Type': o.httpMetadata?.contentType || 'application/octet-stream',
          'Content-Length': String(o.size),
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`
        } });
      }
    } catch (e) { return json({ error: String(e.message || e) }, 500); }
    return json({ error: 'not found' }, 404);
  }
};
