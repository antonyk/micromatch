/*!
 * micromatch <https://github.com/jonschlinkert/micromatch>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT license.
 */

'use strict';

var diff = require('arr-diff');
var fileRe = require('filename-regex');
var expand = require('./lib/expand');
var utils = require('./lib/utils');

/**
 * The main function. Pass an array of filepaths,
 * and a string or array of glob patterns
 *
 * @param  {Array|String} `files`
 * @param  {Array|String} `patterns`
 * @param  {Object} `opts`
 * @return {Array} Array of matches
 */

function micromatch(files, patterns, opts) {
  if (!files || !patterns) {
    return [];
  }

  files = utils.arrayify(files);
  opts = opts || {};

  if (typeof patterns === 'string') {
    return match(files, patterns, opts);
  }

  var len = patterns.length;
  var neg = [], res = [];
  var i = 0;

  while (len--) {
    var glob = patterns[i++];
    if (glob.charCodeAt(0) === 33) {
      neg.push.apply(neg, match(files, glob.slice(1), opts));
    } else {
      res.push.apply(res, match(files, glob, opts));
    }
  }
  return diff(res, neg);
}

/**
 * Pass an array of files and a glob pattern as a string.
 *
 * This function is called by the main `micromatch` function
 * If you only need to pass a single pattern you might get
 * very minor speed improvements using this function.
 *
 * @param  {Array} `files`
 * @param  {Array} `pattern`
 * @param  {Object} `options`
 * @return {Array}
 */

function match(files, pattern, opts) {
  if (typeof files !== 'string' && !Array.isArray(files)) {
    throw new Error('micromatch.match() expects a string or array.');
  }

  files = utils.arrayify(files);
  opts = opts || {};

  var negate = opts.negate || false;

  if (opts.nonegate !== true) {
    negate = pattern.charAt(0) === '!';
    if (negate) {
      pattern = pattern.slice(1);
    }
  }

  if (!(pattern instanceof RegExp)) {
    pattern = makeRe(pattern, opts);
  }

  var len = files.length;
  var res = [];
  var i = 0;

  while (i < len) {
    var file = files[i++];
    var fp = utils.unixify(file, opts);

    if (!isMatch(fp, pattern, opts)) { continue; }
    res.push(fp);
  }

  if (negate) { return diff(files, res); }

  if (opts.nonull && !res.length) {
    return pattern;
  }
  return res;
}

/**
 * Returns true if the filepath matches the given
 * pattern.
 */

function isMatch(fp, pattern, opts) {
  if (!(pattern instanceof RegExp)) {
    pattern = makeRe(pattern, opts);
  }

  if (opts && opts.matchBase) {
    var matches = fileRe().exec(fp);

    // don't return if not `true`
    if (pattern.test(matches[0])) {
      return true;
    }
  }
  return pattern.test(fp);
}

/**
 * Filter the keys in an object.
 *
 * @param  {*} val
 * @return {Array}
 */

function matchKeys(pattern, obj, options) {
  var re = !(pattern instanceof RegExp)
    ? makeRe(pattern, options)
    : pattern;

  var keys = Object.keys(obj);
  var len = keys.length;
  var res = {};

  while (len--) {
    var key = keys[len];
    if (re.test(key)) {
      res[key] = obj[key];
    }
  }
  return res;
}

/**
 * Filter files with the given pattern.
 *
 * @param  {String|Array} `pattern`
 * @param  {Array} `files`
 * @param  {Options} `opts`
 * @return {Array}
 */

function filter(pattern, opts) {
  opts = opts || {};

  pattern = !(pattern instanceof RegExp)
    ? makeRe(pattern, opts)
    : pattern;

  return function (files) {
    if (typeof files === 'string') {
      var match = isMatch(files, pattern, opts);
      if (opts.inclusive && match !== false) {
        return true;
      }
      return match;
    }

    var res = files.slice();
    var len = files.length;
    var m;

    while (len--) {
      m = isMatch(files[len], pattern, opts);
      if (m) {
        continue;
      }
      res.splice(len, 1);
    }

    return res;
  };
}

/**
 * Create and cache a regular expression for matching
 * file paths.
 *
 * If the leading character in the `glob` is `!` a negation
 * regex is returned.
 *
 * @param  {String} glob
 * @param  {Object} options
 * @return {RegExp}
 */

function makeRe(glob, options) {
  var opts = options || {};
  var flags = opts.flags || '';

  // reset cache, recompile regex if options change
  optsCache = typeof optsCache !== 'undefined'
    ? optsCache
    : opts;

  if (!equal(optsCache, opts)) {
    cache = glob;
    globRe = null;
  }

  // reset cache, recompile regex if glob changes
  cache = typeof cache !== 'undefined'
    ? cache
    : glob;

  if (cache !== glob) {
    glob = utils.unixify(glob, opts);
    cache = glob;
    globRe = null;
  }

  // if `true`, then we can just return
  // the regex that was previously cached
  if (globRe instanceof RegExp) {
    return globRe;
  }

  if (opts.nocase) { flags += 'i'; }

  var parsed = expand(glob, opts);
  opts.negated = opts.negated || parsed.negated || false;
  glob = wrapGlob(parsed.glob, opts.negated);

  // cache regex
  globRe = new RegExp(glob, flags);
  return globRe;
}

/**
 * Create the regex to do the matching. If
 * the leading character in the `glob` is `!`
 * a negation regex is returned.
 *
 * @param {String} `glob`
 * @param {Boolean} `negate`
 */

function wrapGlob(glob, negate) {
  glob = ('(?:' + glob + ')$');
  return '^' + (negate ? ('(?!^' + glob + ').*$') : glob);
}

/**
 * Return true if object A is equal (enough)
 * to object B. Used for options caching. All
 * we need to know is if the object has changed
 * in any way.
 *
 * @param {Object} a
 * @param {Object} b
 * @return {Boolean}
 */

function equal(a, b) {
  if (!b) return false;
  for (var prop in b) {
    if (!a.hasOwnProperty(prop) || a[prop] !== b[prop]) {
      return false;
    }
  }
  return true;
}

/**
 * Results cache
 */

var globRe;
var cache;
var optsCache;


// no, this isn't permanent. I will organize
// the following when the API is locked.

/**
 * Expose `micromatch`
 */

module.exports = micromatch;

/**
 * Expose `micromatch.match`
 */

module.exports.match = match;

/**
 * Expose `micromatch.isMatch`
 */

module.exports.isMatch = isMatch;

/**
 * Expose `micromatch.matchKeys`
 */

module.exports.matchKeys = matchKeys;

/**
 * Expose `micromatch.makeRe`
 */

module.exports.makeRe = makeRe;

/**
 * Expose `micromatch.braces`
 */

module.exports.braces = require('braces');

/**
 * Expose `micromatch.filter`
 */

module.exports.filter = filter;

/**
 * Expose `micromatch.expand`
 */

module.exports.expand = expand;
