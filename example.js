const EventEmitter = require('events');
const { createHmac } = require('crypto')

const LaunchDarkly = require('launchdarkly-node-server-sdk');

const faker = require('faker')
const pkg = require('./package.json')
const micromatch = require('micromatch')
const {v4: uuid} = require('uuid')



let ldClient = null;


/**
 * Returns an initalized LaunchDarkly Client
 * @returns {LaunchDarkly.LDClient} 
 */
function initializeLaunchDarklyClient() {
    return  LaunchDarkly.init(process.env.LD_SDK_KEY, {
            privateAttributeNames: ['Date of Birth']
        })
}

/**
 * Returns an initialized LaunchDarkly Client as a singleton.
 * @returns {LaunchDarkly.LDClient}
 */
function getLDClient() {
    if (ldClient === null) {
        ldClient = initializeLaunchDarklyClient()
        setupEventListeners(ldClient)
    }
    return ldClient
}


/**
 * Wrapper around variation calls
 * @param {LaunchDarkly.LDUser} user 
 * @param {string} flag 
 * @returns {any}
 */
 function variation(flag,user) {
    const ld = getLDClient()
    return ld.variation(flag, user, getFallbackValue(flag))
}

/**
 * Returns a randomly generated user (for demo purposes)
 * Takes in a set of properties to merge into the random user
 * @param {LaunchDarkly.LDUser} 
 * @returns {LaunchDarkly.LDUser}
 */
function getUser(properties) {

    const [firstName, lastName] = [faker.name.firstName(), faker.name.lastName()]
    const username = faker.internet.userName(firstName, lastName)

    const groups = ['admin', 'user', 'editor', 'reviewer', 'author']
    const datacenters = ['us-east-1', 'us-east-2', 'eu-west-1', 'eu-west-2']

    const anonymous = faker.datatype.number({min: 1, max: 100}) < 60
    const sessionIdentifer = uuid()
    const eaps = Array.from(getAllEarlyAccessPrograms())
    const inEAP = !anonymous && faker.datatype.number({min: 1, max: 100}) < 10

    const user = {
      // `key` is a unique, consistent identifier used for rollouts
      // use a Session Identifer for unauthenticated users
      // use User Identifer for authenticated users
      key: anonymous ? sessionIdentifer : getUserIdentifer(username),
      email: faker.internet.email(username),
      username,
      name: `${firstName} ${lastName}`,
      firstName,lastName,
      ip: faker.internet.ip(),
      anonymous: anonymous,
      custom: {
        'Session': uuid(),
        'Date of Birth': faker.date.past(50, new Date("Sat Sep 20 1992 21:35:02 GMT+0200 (CEST)")),
        'Tenant': `${faker.lorem.word()} ${faker.company.companySuffix()}`,
        'Country': faker.address.countryCode(),
        'Groups': faker.random.arrayElements(groups, faker.datatype.number({min: 1, max: 3})),
        'Service Version': pkg.version,
        'Service Name': pkg.name,
        'Service Hostname': 'some-server.example.com',
      }
    }
    // merge properties
    const {custom} = user;
    return Object.assign({}, user, properties || {}, {custom: Object.assign(custom, properties && properties.custom || {}, 
    {
        'EAP Opt-ins': Array.from(
          new Set(
            (properties && properties['EAP Opt-ins'] || [])
            .concat(inEAP ? faker.random.arrayElements(eaps, eaps.length) : []))
          )
    })})
}





// listen of all EAPs discovered via flag naming convention
const earlyAccessPrograms = new Set();

/**
 * Get all early access program keys
 * @returns {Set<String>}
 */
function getAllEarlyAccessPrograms() {
    return earlyAccessPrograms
}


/**
 * Gets a list of early access programs a user is allowed to opt-in to
 * @param {*} user 
 * @returns 
 */
async function getAvailableEarlyAccessPrograms(user) {
    const eaps = getAllEarlyAccessPrograms()
    return Promise.all(
        Array.from(eaps)
        .map(async (v) => [await variation(`allow-early-access-program-${v}`,user), v])
    )
    .then(results => 
        results
            .filter(([allow]) => allow)
            .map(([_,v]) => v)
    )
}

function setupEventListeners(client) {
    // wrapper to support glob-style subscriptions
    let flagUpdateEventEmitter = new EventEmitter()
    // update the list of EAP programs based on our naming convention
    flagUpdateEventEmitter.on('allow-early-access-program-*',
     ({key}) => 
        earlyAccessPrograms.add(
            key.split('allow-early-access-program-', 2).pop()
    ))

    client.on('update', (flag) => {
        flagUpdateEventEmitter.eventNames()
            .filter(event => micromatch.isMatch(flag.key, event))
            .forEach(event => flagUpdateEventEmitter.emit(event, flag))
    })
}


// example map of flag keys to fallback values
const fallbacks = new Map(Object.entries({
    'release-widget': false
}))

/**
 * Centralizes fallback management for features. Can be used to load them from a file etc
 * @param {string} flag
 */
function getFallbackValue(flag) {
    if (!fallbacks.has(flag) && flag.startsWith('allow-early-access-program')) {
        return false
    }
    return fallbacks.get(flag)
}

function setFallbackValue(flag, value) {
    return fallbacks.set(flag, value)
}

/**
 * Returns the user identifer for a given username. Uses an HMAC for the demo purposes. 
 * @param {string} username 
 */
function getUserIdentifer(username) {
    const secret = 'amiably-tundra-pluto-stargaze'
    return createHmac('sha256', secret).update(username).digest('hex')
}


module.exports = {
    initializeLaunchDarklyClient,
    getUser,
    getLDClient,
    getUserIdentifer,
    variation,
    getAllEarlyAccessPrograms,
    getAvailableEarlyAccessPrograms

}
