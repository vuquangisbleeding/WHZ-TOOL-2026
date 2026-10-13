function envValue(content, key) {
  return content.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim() || '';
}

function fillEmptyKey(content, template, key) {
  if (envValue(content, key)) return content;
  const baked = envValue(template, key);
  if (!baked) return content;
  const line = `${key}=${baked}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  return pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
}

module.exports = { fillEmptyKey };
