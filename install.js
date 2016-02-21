define(function(require, exports, module) {

  module.exports = function(session, options) {

    session.install({
      "tar.gz": {
        "url": "https://github.com/wakatime/wakatime/archive/master.tar.gz",
        "target": "~/.c9/lib/wakatime",
        "dir": "wakatime-master",
      }
    });

    // Show the installation screen
    session.start();

  };

  // version of the installer. Increase this when installer changes and must run again
  module.exports.version = 1;

});
