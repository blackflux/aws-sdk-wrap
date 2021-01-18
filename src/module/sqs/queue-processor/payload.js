const metaKey = '__meta';

module.exports.metaKey = metaKey;
module.exports.stripPayloadMeta = (payload) => {
  const r = { ...payload };
  delete r[metaKey];
  return r;
};
