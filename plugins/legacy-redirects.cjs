// Old URLs (file-path routes with spaces, Chinese and tier folders) keep working:
// postBuild writes a static redirect page at each old path in every locale.
const fs = require('fs');
const path = require('path');

// Earlier homes of pages whose source file has since moved.
const MOVED = {
  '/B+/UCLA MENG': '/programs/ucla-meng',
  '/SSS/stanford msee': '/programs/stanford-msee',
};

function frontMatterSlug(file) {
  const frontMatter = fs.readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/)?.[1] || '';
  return frontMatter.match(/^slug:\s*(\S+)\s*$/m)?.[1];
}

// A doc with a slug used to live at its file path, e.g. /A+/UCLA MENG -> /programs/ucla-meng.
function legacyRedirects(docsDir) {
  const redirects = {...MOVED};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.mdx?$/.test(entry.name) && !entry.name.startsWith('_')) {
        const slug = frontMatterSlug(file);
        const from = `/${path.relative(docsDir, file).replace(/\.mdx?$/, '').split(path.sep).join('/')}`;
        if (slug && slug !== '/' && slug !== from) redirects[from] = slug;
      }
    }
  };
  walk(docsDir);
  return redirects;
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// `to` is the locale-prefixed destination path, e.g. /en/programs/ucla-meng.
function redirectPage(to, siteUrl) {
  const encoded = encodeURI(to);
  const href = escapeHtml(encoded);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="${siteUrl}${href}">
<script>location.replace(${JSON.stringify(encoded)} + location.search + location.hash)</script>
<meta http-equiv="refresh" content="0;url=${href}">
<title>CS Grad</title>
</head>
<body><a href="${href}">${href}</a></body>
</html>
`;
}

function legacyRedirectsPlugin({baseUrl, siteDir, siteConfig}) {
  return {
    name: 'legacy-redirects',
    async postBuild({outDir}) {
      for (const [from, to] of Object.entries(legacyRedirects(path.join(siteDir, 'docs')))) {
        const file = path.join(outDir, from, 'index.html');
        if (fs.existsSync(file)) throw new Error(`Legacy redirect ${from} would overwrite a page`);
        fs.mkdirSync(path.dirname(file), {recursive: true});
        fs.writeFileSync(file, redirectPage(`${baseUrl}${to.slice(1)}`, siteConfig.url));
      }
    },
  };
}

module.exports = legacyRedirectsPlugin;
module.exports.frontMatterSlug = frontMatterSlug;
module.exports.legacyRedirects = legacyRedirects;
