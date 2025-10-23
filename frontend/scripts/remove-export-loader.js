module.exports = function(source) {
  // Remove export statements from HeartbeatWorker.js
  return source.replace(/export\s*\{\s*\};\s*\/\/# sourceMappingURL=HeartbeatWorker\.js\.map/, '//# sourceMappingURL=HeartbeatWorker.js.map');
};
