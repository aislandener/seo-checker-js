'use struct'

const fs = require('fs');
const stream = require('stream');
const Parser = require('./parser');
const helper = require('./helper');

/**
 * Load html from file
 * @param {string} path html file path
 * @param {object} rules a rule or list of rules with selector
 * @param {?object} options read file options
 * @returns {Promise<Parser>} parser of html tags commit given rules
 */
function loadFile(path, rules, options={ encoding: 'utf8'}) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, options, (err, data) => {
      if (!err && data) {
        // lowerCaseAttributeNames has issue in cheerio 1.0.0-rc2
        let options = {
          lowerCaseTags: true,
          lowerCaseAttributeNames: false
        };
        let parser = new Parser(data, rules, options);
        resolve(parser);
      }
      if (!data && !err) {
        err = new Error('Content of file is empty');
      }
      if (err) {
        reject(err);
      }
    });
  });
}

/**
 * Load html from readable stream
 * @param {stream.Readable} rstream readable stream
 * @param {object} rules a rule or list of rules with selector
 * @param {?string} encoding specific read encoding, default is utf8
 * @returns {Promise<Parser>} parser of html tags commit given rules
 */
function loadStream(rstream, rules, encoding='utf8') {
  if (encoding) {
    rstream.setEncoding(encoding);
  }
  return new Promise((resolve, reject) => {
    let data = '';
    rstream.on('error', (err) => {
      reject(err);
    });
    rstream.on('data', (chunk) => {
      data += chunk;
    });
    rstream.on('end', () => {
      if (data.length != 0) {
        let parser = new Parser(data, rules);
        resolve(parser);
      } else {
        reject(new Error('Content of stream is empty'));
      }
    });
  });
}

/**
 * Output to file
 * @param {string} path output file path
 * @param {string} content output string
 * @param {?object} options write file options
 */
function writeFile(path, content, options={ encoding: 'utf8'}) {
  fs.writeFile(path, content, options, (err) => {
    if (err) console.log(err);
  });
}

/**
 * Output to writable stream
 * @param {stream.Writable} wstream writable stream
 * @param {string} content output string
 * @param {?string} encoding default is utf8
 * @returns {Promise<void>}
 */
function writeStream(wstream, content, encoding='utf8') {
  if (encoding) {
    wstream.setDefaultEncoding(encoding);
  }
  return new Promise((resolve, reject) => {
    let chunk_size = 4096;
    function write(data) {
      let succeeded = true;
      while (data.length > chunk_size && succeeded) {
        let chunk = data.substr(0, chunk_size);
        succeeded = wstream.write(chunk);
        data = data.slice(chunk_size);
      }
      // Do write(data) again via drain emit or just throw excception if succeeded is false
      if (!succeeded) {
        reject(new Error('Write stream failed'));
      } else {
        wstream.end(data);
        resolve();
      }
    };
    let data = content;
    write(data);
  });
}

/**
 * Output to console
 * @param {Console} cons instance of console
 * @param {string} content output string
 */
function writeConsole(cons, content) {
  cons.log(content);
}

/**
 * Build the output string from Parser.getResults()
 * @param {Map} results parser results
 */
function buildOutput(results) {
  let output = '';
  results.forEach((value, key, map) => {
    let description = value.description;
    let tags = value.tags;
    let expect = value.expect;
    let actual = null;
    let pre = null;
    if (typeof expect === 'number') {
      actual = tags.length;
      pre = 'count';
    } else if (typeof expect === 'boolean') {
      actual = (tags.length > 0);
      pre = 'is';
    } else {
      console.log(`Unexpect expect=${expect}`);
      return '';
    }
    if (expect != actual) {
      output += `${description} ${pre} ${actual}\n`;
    }
  });
  return output;
}

/**
 * Quick represent function to read input, parse for rule's result then output to target
 * @param {object} source input source, can be file path or readable stream
 * @param {object} rules rules for validation
 * @param {object} target output target, can be file path, writable stream or console instance
 */
function check(source, rules, target) {
  let loader = null;
  if (typeof source === 'string') {
    loader = this.loadFile;
  } else if (source instanceof stream.Readable) {
    loader = this.loadStream;
  } else {
    console.log('The source must be file path or readable stream');
    return;
  }
  let writer = null;
  if (typeof target === 'string') {
    writer = this.writeFile;
  } else if (target instanceof stream.Writable) {
    writer = this.writeStream;
  } else if (target instanceof console.Console) {
    writer = this.writeConsole;
  } else {
    console.log('The target must be file path, writable stream or console');
    return;
  }
  // maybe use async/await?
  loader.call(this, source, rules)
    .then((parser) => {
      return this.buildOutput(parser.getResults());
    })
    .then((output) => {
      return writer.call(this, target, output);
    })
    .catch((err) => {
      console.log(err);
      return;
    });
}

module.exports = {
  helper,
  loadFile,
  loadStream,
  writeFile,
  writeStream,
  writeConsole,
  buildOutput,
  check
}