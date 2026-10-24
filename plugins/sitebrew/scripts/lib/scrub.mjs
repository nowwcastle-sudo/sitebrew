// What the runner prints from a child's output: no absolute path of this computer. Known folders (the kit, the current folder, the home folder and the
// user's app-data folders) become placeholders; any other path that starts in a user's home folder becomes <home>. The output of an install is for the
// user to read, and an error often names the folder it ran in.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const both = (p) => [p, p.replace(/\\/g, '/'), p.replace(/\//g, '\\')]

/** @param {string} text @param {{ [placeholder: string]: string|undefined }} roots placeholder -> folder (longer folders are replaced first) */
export function scrubPaths(text, roots = {}) {
  const pairs = Object.entries(roots)
    .filter(([, dir]) => dir && String(dir).length > 1)
    .flatMap(([name, dir]) => both(String(dir).replace(/[\\/]+$/, '')).map((d) => [d, name]))
    .sort((a, b) => b[0].length - a[0].length)
  let out = String(text ?? '')
  for (const [dir, name] of pairs) out = out.replace(new RegExp(esc(dir), 'gi'), name)
  return out
    .replace(/[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"'`]+/gi, '<home>')
    .replace(/\/(?:home|Users)\/[^/\s"'`]+/g, '<home>')
}
