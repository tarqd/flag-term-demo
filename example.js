

const LaunchDarkly = require("@launchdarkly/node-server-sdk");

const {
  logger,
  setLoggerLDClient,
  getDefaultLogLevel,
  setDefaultLogLevel,
} = require("./logger");

const { withLDContext } = require("./logger-transport");
const { withService, mergeLDContext } = require("./ld-context");
const {faker} = require("@faker-js/faker");
let ldClient = null;

const EAP_PREFIX = "allow-eap-";
const CONFIGURE_PREFIX = "config-";
const GLOBAL_PREFIX = "global-";
const TRACK_PREFIX = "track-";



/**
 * Returns an initalized LaunchDarkly Client
 * @returns {LaunchDarkly.LDClient}
 */
function initializeLaunchDarklyClient() {
  return LaunchDarkly.init(process.env.LD_SDK_KEY, {
    capacity: 10000,
    flushInterval: 3,
    logger: serviceLogger("launchdarkly-sdk"),
    application: {
      id: "example-app",
      name: "ExampleApp",
      key: "example-app",
      version: "0.7.0",
    }
  });
}

/**
 * Returns an initialized LaunchDarkly Client as a singleton.
 * Sets up event listeners and performs some wrapper specific setup
 * @returns {LaunchDarkly.LDClient}
 */
function getLDClient() {
  if (ldClient === null) {
    ldClient = initializeLaunchDarklyClient();
    setupEventListeners(ldClient);
    setLoggerLDClient(ldClient);
  }
  return ldClient;
}

/**
 * Wrapper around variation calls
 * @param {LaunchDarkly.LDContext} context
 * @param {string} flag
 * @returns {[string, any][]}
 */
async function variation(flag, context={kind: "user", "anonymous": true, "key": "example"}, fallback) {
  const ld = getLDClient();
  // this is where you can add logic such as loading overrides from a file
  return ld.variation(flag,/* withService('app', context)*/ context, fallback);
}


/**
 * Wrapper around variationDetail calls
 * @param {LaunchDarkly.LDContext} context
 * @param {string} flag
 * @returns {[string, any][]}
 */
 async function variationDetail(flag, context={kind: "user", "anonymous": true, "key": "example"}, fallback) {
    const ld = getLDClient();
    return ld.variationDetail(flag, context, fallback);
  }

/**
 * Returns a map of multiple flags to their values
 * @param {LaunchDarkly.LDUser} user
 * @param {[string, any][]|Object} } flagsAndFallbacks
 * @returns {any}
 */
async function variationMap(user, flagsAndFallbacks) {
  const ld = getLDClient();
  const entries = Array.isArray(flagsAndFallbacks)
    ? flagsAndFallbacks
    : Object.entries(flagsAndFallbacks);
  return Object.fromEntries(
    await Promise.all(
      entries.map(async ([flag, fallback]) => {
        return [flag, await variation(flag, user, fallback)];
      })
    )
  );
}



/**
 *  Create a service logger
 *  @param {string} component
 *  @param {LaunchDarkly.LDContext...} contexts additional contexts to add to the logger
 */
function serviceLogger(component, ...contexts) {
  return logger.child(withLDContext({}, withService(component, ...contexts)));
}


// listen of all EAPs discovered via flag naming convention
const earlyAccessPrograms = new Set();
// metric emulation
const trackedMetrics = new Set();

/**
 * Get all early access program keys
 * @returns {Set<String>}
 */
function getAllEarlyAccessPrograms() {
  return earlyAccessPrograms;
}

/**
 * Gets a list of early access programs a user is allowed to opt-in to
 * @param {*} user
 * @returns
 */
async function getAvailableEarlyAccessPrograms(user) {
  const eaps = getAllEarlyAccessPrograms();
  return Promise.all(
    Array.from(eaps).map(async (v) => [
      await variation(`${EAP_PREFIX}${v}`, user, false),
      v,
    ])
  ).then((results) => results.filter(([allow]) => allow).map(([_, v]) => v));
}

/**
 * Get all tracked metrics
 * @returns {Set<String>}
 */
function getTrackedMetrics() {
  return trackedMetrics;
}
/*
  * Emulate metrics based on tracked flags
  * @param {LaunchDarkly.LDContext} ldContext
*/
async function emulateMetrics(ldContext, flagContext) {
  const ldClient = getLDClient();
  const metrics = await Promise.all(Array.from(trackedMetrics.values()).map(async (key) => {
    const value = await variation(key, mergeLDContext(ldContext, flagContext), {enable: false});
    return [key, value];
  }));
  metrics.filter(([_, {enable}]) => enable).forEach(([key, config]) => {
    let value = config.value;
    if (config.faker) {
      const module = config.faker.module;
      const options = config.faker.options;
      const kind = config.faker.kind;
      value = faker[module][kind](options);
    }
    
    ldClient.track(key, ldContext, config.data, value);
  });
  logger.debug("emulated metrics: context=%j,flag=%j, metrics=%j", ldContext,flagContext,  metrics);
}

function setupEventListeners(client) {
  client.once('ready', () => {
    client.allFlagsState({anonymous: true, key: "demo"}).then((state) => {
      const flags = state.toJSON();
      Object.keys(flags).forEach((key) => handleFlagUpdate({key}));
    });
  })
  client.on("update", handleFlagUpdate);
}

function handleFlagUpdate({key}) {
  
    
    
    if (key.startsWith(EAP_PREFIX)) {
      handleEAP(key);
    } else if(key.startsWith(TRACK_PREFIX)) {
      handleMetric(key)
    } else if (key.startsWith(CONFIGURE_PREFIX)) {
      handleConfiguration(key);
    }
  
}

// application configuration
const appConfig = new Map();

async function handleConfiguration(flag) {
  const ld = getLDClient();
  const key = stripPrefix(CONFIGURE_PREFIX, flag);
  const user = {
    kind: 'service',
    key: "app-config",
    anonymous: true,
  }
  const logger = serviceLogger("config");

  switch (key) {
    // special handling: configure winston
    case "log-verbosity":
      const level = await variation(flag, user, getDefaultLogLevel() || "warn");

      if (level !== undefined) {
        setDefaultLogLevel(level);
        logger.debug("set logging level to %s", level);
      } else {
        logger.error("invalid configuration value: %s %s", flag, level);
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
        const configKey = stripPrefix(GLOBAL_PREFIX, key);
        const value = await variation(flag, user, appConfig.get(configKey));
        appConfig.set(configKey, value);
        logger.debug("set global config %s = %j", configKey, value);
      }
      break;
  }
}

function handleEAP(flag) {
  const eapKey = stripPrefix(EAP_PREFIX, flag);
  const logger = serviceLogger("eap");
  logger.debug("discovered early access program: %s", eapKey);
  earlyAccessPrograms.add(eapKey);
}

function handleMetric(flag) {
  const logger = serviceLogger("metric");
  logger.debug("discovered metric emulation flag: %s", flag);
  trackedMetrics.add(flag);
}


function stripPrefix(prefix, key) {
  return key.substring(prefix.length);
}

function getConfig() {
  return appConfig;
}

module.exports = {
  getConfig,
  initializeLaunchDarklyClient,
  getLDClient,
  variation,
  variationMap,
  variationDetail,
  getAllEarlyAccessPrograms,
  getAvailableEarlyAccessPrograms,
  serviceLogger,
  emulateMetrics
};
