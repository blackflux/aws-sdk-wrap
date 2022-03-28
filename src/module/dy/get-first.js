export default (obj, fn) => Object.entries(obj).filter(fn).map(([k]) => k)[0];
