const EventEmitter = require('events');
const { createHmac } = require('crypto')

const LaunchDarkly = require('launchdarkly-node-server-sdk');

const faker = require('faker')
const {v4: uuid} = require('uuid')

const pkg = require('./package.json')
const {logger,levels} = require('./logger');
const { config } = require('winston');


let ldClient = null;

const EAP_PREFIX = 'allow-eap-'
const CONFIGURE_PREFIX = 'configure-'
const GLOBAL_PREFIX = 'global-'
/**
 * Returns an initalized LaunchDarkly Client
 * @returns {LaunchDarkly.LDClient} 
 */
function initializeLaunchDarklyClient() {
    return  LaunchDarkly.init(process.env.LD_SDK_KEY, {
            logger,
            privateAttributeNames: ['Date of Birth', 'Session']
        })
}

/**
 * Returns an initialized LaunchDarkly Client as a singleton.
 * Sets up event listeners and performs some wrapper specific setup
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
 * @returns {[string, any][]}
 */
 async function variation(flag,user, fallback) {
    const ld = getLDClient()
    return ld.variation(flag, user, fallback)
}

/**
 * Returns a map of multiple flags to their values
 * @param {LaunchDarkly.LDUser} user 
 * @param {[string, any][]|Object} } flagsAndFallbacks
 * @returns {any}
 */
 async function variationMap(user, flagsAndFallbacks) {
    const ld = getLDClient()
    const entries = Array.isArray(flagsAndFallbacks) ? flagsAndFallbacks : Object.entries(flagsAndFallbacks)
    return Object.fromEntries(await Promise.all(entries.map(async ([flag,fallback]) => {
        return [flag, await variation(flag, user, fallback)]
    })))
}

/**
 * Returns a randomly generated user (for demo purposes)
 * Takes in a set of properties to merge into the random user
 * @param {LaunchDarkly.LDUser} 
 * @returns {LaunchDarkly.LDUser}
 */
function getUser() {
    const [firstName, lastName] = [faker.name.firstName(), faker.name.lastName()]
    const username = faker.internet.userName(firstName, lastName)

    const groups = ['admin', 'user', 'editor', 'reviewer', 'author']
    const regions = ['us-east-1', 'us-east-2', 'eu-west-1', 'eu-west-2']

    const browsers = ['Firefox', 'Safari', 'Internet Explorer', 'Google Chrome']
    const browserVersions = {
        'Firefox': ['89.0','89.0', '89.0', '80.0','89.1'],
        'Internet Explorer': ['11.0.220', '11.0.220', '11.0.220', '9.0.195'],
        'Safari': ['5.3.5', '5.2.4', '5.3.5'],
        'Google Chrome': ['93.0','93.0','93.0','84.0.4147','84.0.4147', '72.0.3626']
    }
    const browser = faker.random.arrayElement(browsers)
    const browserVersion = faker.random.arrayElement(browserVersions[browser])

    const anonymous = faker.datatype.number({min: 1, max: 100}) < 60

    const sessionIdentifer = uuid()
    const region = faker.random.arrayElement(regions)
    const addons = ['widget-plus', 
'widget', 'advanced-metrics', 'ai-powered-upsell'] 
    const extra = {
        'Purchased Addons': faker.random.arrayElements(
            addons,
            faker.datatype.number({min: 0, max: 3}
        )),
        'Active Plan': faker.random.arrayElement(
            ['basic', 'plus', 'professional', 'enterprise']
        )
        
    }
    
    return {
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
      custom: Object.assign({
        'Session': sessionIdentifer,
        'Date of Birth': faker.date.past(50, new Date("Sat Sep 20 1992 21:35:02 GMT+0200 (CEST)")),
        'Tenant': `${faker.lorem.word()} ${faker.company.companySuffix()}`,
        'Organization': `${faker.lorem.word()} ${faker.company.companySuffix()}`,
        'Country': faker.address.countryCode(),
        'Groups': faker.random.arrayElements(groups, faker.datatype.number({min: 1, max: 3})),
        'Service Version': pkg.version,
        'Service Name': pkg.name,
        'Service Hostname': 'some-server.example.com',
        'Service Region': region,
        'Browser': browser,
        'Browser Version': browserVersion,
        'Platform': faker.random.arrayElement(['web', 'android', 'ios'])

      }, extra)
    }
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
        .map(async (v) => [await variation(`${EAP_PREFIX}${v}`,user, false), v])
    )
    .then(results => 
        results
            .filter(([allow]) => allow)
            .map(([_,v]) => v)
    )
}

function setupEventListeners(client) {
    client.on('update', ({key}) => {
        if(key.startsWith(EAP_PREFIX)) {
            handleEAP(key)
        } else if(key.startsWith(CONFIGURE_PREFIX)) {
            handleConfiguration(key)
        }
    })
}


// map log level number to name (7 => debug, 6 => error, etc)
const levelNumberToName = new Map(
    Object.entries(levels)
          .map(([k,v]) => [v,k])
)

// application configuration 
const appConfig = new Map();

async function handleConfiguration(flag) {
    const ld = getLDClient()
    const key = stripPrefix(CONFIGURE_PREFIX, flag)
    const user = {
        'key': `service/${pkg.name}`,
        'anonymous': true
    };
    

    switch (key) {
        // special handling: configure winston
        case 'log-verbosity': 
            const value = await variation(flag, user, logger.level || 'warn')
            const level = levelNumberToName.get(value)
            if(level !== undefined) {
                logger.level = level
                logger.debug('set logging level to %s', level)
            } else {
                logger.error('invalid configuration value: %s [%d] %s', flag, value, level)
            }
            
            break;   
        default:
            // set application configuration in a shared map
            // this has a few downsides:
            // - always calls variation, so flag status metrics are inaccurate
            // - cant be targeted by user
            // only makes sense for global/service/app level configurations 
            // we use a prefix to denote this
            if (key.startsWith(GLOBAL_PREFIX)) {
                const configKey = stripPrefix(GLOBAL_PREFIX, key)
                const value = await variation(flag, user, appConfig.get(configKey))
                appConfig.set(configKey, value)
            }

            logger.notice('unrecognized config flag %s', flag)
            break;
    }
}

function handleEAP(flag) {
    earlyAccessPrograms.add(stripPrefix(EAP_PREFIX, flag))
}



/**
 * Returns the user identifer for a given username. Uses an HMAC for the demo purposes. 
 * @param {string} username 
 */
function getUserIdentifer(username) {
    const secret = 'amiably-tundra-pluto-stargaze'
    return createHmac('sha256', secret).update(username).digest('hex')
}

function stripPrefix(prefix, key) {
    return key.substring(prefix.length)
}

/*
async function createUserLogger(user) {
    const client = getLDClient()
    const userLevel = await variation('configure-log-verbosity', user)
    const userLogger = logger.child({user})
    return Object.create(userLogger, {
        isLevelEnabled: function (level) {
            if (userLevel === undefined) {
                return userLogger.isLevelEnabled(level)
            }
            return userLevel <= level
        }
    })
}*/
function getConfig() {
    return appConfig
}

module.exports = {
    getConfig,
    initializeLaunchDarklyClient,
    getUser,
    getLDClient,
    getUserIdentifer,
    variation,
    variationMap,
    getAllEarlyAccessPrograms,
    getAvailableEarlyAccessPrograms

}
