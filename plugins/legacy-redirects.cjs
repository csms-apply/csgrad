// Old URLs (file-path routes with spaces, Chinese and tier folders) keep working:
// postBuild writes a static redirect page at each old path in every locale.
const fs = require('fs');
const path = require('path');

// Earlier homes of pages whose source file has since moved to another tier.
// Both spellings: old shared links use the file name, the worker's stale docs produce the kebab form.
const MOVED = {
  '/B+/UCLA MENG': '/A+/ucla-meng',
  '/B+/ucla-meng': '/A+/ucla-meng',
  '/SSS/stanford msee': '/SS/stanford-msee',
  '/SSS/stanford-msee': '/SS/stanford-msee',
  '/B+/rics-mcs': '/B+/rice-mcs',
  // UW 的 EE 学位更名为 ECE，网址跟着改；旧网址继续可用
  '/A/uw-ee-pmp': '/A/uw-ece-pmp',
  '/programs/uw-ee-pmp': '/A/uw-ece-pmp',
};

// Program pages briefly lived at /programs/<name> before the tier came back into the URL.
const TIER_PAGE = /^\/(?:SSS|SS|S|A\+|A|A-|B\+|B|B-|C\+)\/([^/]+)$/;

function frontMatterSlug(file) {
  const frontMatter = fs.readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/)?.[1] || '';
  return frontMatter.match(/^slug:\s*(\S+)\s*$/m)?.[1];
}

// The doc's URL: its file path unless front matter sets a slug; a relative slug stays in the file's folder.
function docUrl(docsDir, file) {
  const route = `/${path.relative(docsDir, file).replace(/\.mdx?$/, '').split(path.sep).join('/')}`;
  const slug = frontMatterSlug(file);
  if (!slug) return route;
  return slug.startsWith('/') ? slug : path.posix.join(path.posix.dirname(route), slug);
}

// A doc with a slug used to live at its file path, e.g. /A+/UCLA MENG -> /A+/ucla-meng.
function legacyRedirects(docsDir) {
  const redirects = {...MOVED};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.mdx?$/.test(entry.name) && !entry.name.startsWith('_')) {
        const from = `/${path.relative(docsDir, file).replace(/\.mdx?$/, '').split(path.sep).join('/')}`;
        const url = docUrl(docsDir, file);
        if (url !== '/' && url !== from) redirects[from] = url;
        const name = url.match(TIER_PAGE)?.[1];
        if (name) redirects[`/programs/${name}`] = url;
      }
    }
  };
  walk(docsDir);
  return redirects;
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// `to` is the locale-prefixed destination path, e.g. /en/A+/ucla-meng.
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
module.exports.docUrl = docUrl;
module.exports.legacyRedirects = legacyRedirects;
