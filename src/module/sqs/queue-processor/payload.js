export const metaKey = '__meta';

export const stripPayloadMeta = (payload) => {
  const r = { ...payload };
  delete r[metaKey];
  return r;
};
