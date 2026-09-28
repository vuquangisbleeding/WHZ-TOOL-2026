function maskUsername(username) {
  const value = String(username || '');
  return value.length <= 3 ? value : `${'*'.repeat(value.length - 3)}${value.slice(-3)}`;
}

module.exports = { maskUsername };