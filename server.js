// server.js
// where your node app starts

// init project
var express = require('express');
var fs = require('fs');
var bodyParser = require('body-parser');
var app = express();
var random; 
app.use(bodyParser.urlencoded({ extended: true }));
const eos = require('eosjs')({httpEndpoint: 'https://steem.host', chainId:'342f1b4af05f4978a8f5d8e3e3e3761cb22dacf21a93e42abe0753bdacb6b621'});
// we've started you off with Express, 
// but feel free to use whatever libs or frameworks you'd like through `package.json`.
 
/**
 * Creates a pseudo-random value generator. The seed must be an integer.
 *
 * Uses an optimized version of the Park-Miller PRNG.
 * http://www.firstpr.com.au/dsp/rand31/
 */
function Random(seed) {
  this._seed = seed % 2147483647;
  if (this._seed <= 0) this._seed += 2147483646;
}

/**
 * Returns a pseudo-random value between 1 and 2^32 - 2.
 */
Random.prototype.next = function () {
  return this._seed = this._seed * 16807 % 2147483647;
};


/**
 * Returns a pseudo-random floating point number in range [0, 1).
 */
Random.prototype.nextFloat = function (opt_minOrMax, opt_max) {
  // We know that result of next() will be 1 to 2147483646 (inclusive).
  return (this.next() - 1) / 2147483646;
};

const hashCode = function(s) {
  var h = 0, l = s.length, i = 0;
  if ( l > 0 )
    while (i < l)
      h = (h << 5) - h + s.charCodeAt(i++) | 0;
  return h;
};

function randomString(inputRandom) {
  var chars = "abcdefghiklmnopqrstuvwxyz12345";
  var string_length = 12;
  var randomstring = '';
  for (var i=0; i<string_length; i++) {
    const next = inputRandom.nextFloat(0,1);
    var rnum = Math.floor(next * chars.length);
    randomstring += chars.substring(rnum,rnum+1);
  }
  return randomstring;
}


const get = async (key)=>{
  const resp = await eos.getTableRows({json:true,scope:'freedomfirst',code:'freedomfirst', table:'public', table_key:'key', key_type:'name', index_position:2, lower_bound:key, upper_bound:key, limit:100});
  if(resp.rows.length && resp.rows[0].key == key) return resp.rows[0].value;
}
const getHash = function (path) {
  const random = new Random(hashCode(path.split('#')[0]));
  const id = randomString(random);
  return id;
}

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));
var proxy = require('express-http-proxy');
app.use(
  '/*', 
  proxy('https://siderus.io', {
    proxyReqPathResolver: async function (req) {
      if(req.originalUrl.startsWith('/ipfs')) return req.originalUrl;
      const split = req.originalUrl.split('?')[0].split('r/');
      const request = split[0];
      const relative = split.length>1?'/'+split[1]:'/';
      const id = getHash(request);
      const page = await get(id)||'';
      console.log(request, id, page,relative);
      return "https://siderus.io/ipfs/"+page+relative;
    }
  })
);


//every 3 minutes
var ipfsClient = require('ipfs-http-client')
global.ipfs = ipfsClient({ host: 'steem.host', port:443, protocol: 'https' }); // Connect to IPFS

setInterval(async ()=>{
  const rows = (await eos.getTableRows(true, 'freedomfirst','freedomfirst', 'public')).rows;

  for(let index in rows) {
    const row = rows[index];
          console.log(row.value);
    ipfs.pin.add(row.value);
  }
}, 86400000);




// listen for requests :)
var listener = app.listen(3000, function() {
  console.log('Your app is listening on port ' + 3000);
});
