const pkg = require("./package.json");
const os = require("os");

const { randomUUID, createHash } = require("crypto");

const serviceAttributes = {
  "Service: Name": pkg.name,
  "Service: Version": pkg.version,
  "OS: Platform": os.platform(),
  "OS: Release": os.release(),
  "OS: Arch": os.arch(),
  "Service: Hostname": os.hostname(),
};

const serviceKey = createHash("sha1").update(`${pkg.name}-${pkg.version}`).digest("hex");
const serviceName = `${pkg.name} - v${pkg.version}`;
const serviceHostname = os.hostname();

/**
 * Merges the two or more LD User objects
 * @param {[LaunchDarkly.LDUser]} users
 * @returns {LaunchDarkly.LDUser} user
 */
function mergeLDContext(...contexts) {
  return Array.from(contexts)
    .map(({ kind, ...attributes }) =>
      kind == "multi" ? Object.entries(attributes) : [[kind || "user", attributes]]
    )
    .flat()
    .reduce(
      (acc, [key, value]) => {
        /*if (acc.hasOwnProperty(key)) {
          
        }*/
        acc[key] = value;
        return acc;
      },
      { kind: "multi" }
    );
}

/**
 *  Create a application context
 *  @param {string} component
 *  @param {object} attributes
 */
function serviceContext(attributes) {
  const {cpus, timeTotal, idleTotal} = os
    .cpus()
    .reduce(({cpus, timeTotal, idleTotal},{ model, speed, times: { user, nice, sys, idle, irq } }) => {
      const total = user + nice + sys + idle + irq;
      const load = Math.round(((1 - idle / total) + Number.EPSILON) * 100) / 100
      cpus.push({
        model,
        speed,
        load: load,
      })
      return {cpus, timeTotal: total + timeTotal, idleTotal: idle + idleTotal}
    }, {cpus:[], timeTotal:0, idleTotal:0});
    const load = Math.round(((1 - idleTotal / timeTotal) + Number.EPSILON) * 100) / 100
    
  return {
    kind: "service",
    key: serviceKey,
    name: serviceName,
    id: pkg.name,
    version: pkg.version,
    hostname: serviceHostname,
    schemaVersion: "1.0.0",
    os: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      name: os.type(),
      cpuCount: os.cpus().length,
      load,
      cpus,
    },
  };
}

/**
 *  Add service context
 * @param {string} component
 *  @param {LaunchDarkly.LDContext...} contexts
 */
function withService(component, ...contexts) {
  return mergeLDContext(serviceContext({component}), ...contexts);
}

/**
 *  Create a request context. Used for jobs or requests without a end user (or end user session).
 *  @param {string} id transaction identifier
 *  @param {object} custom additional custom properties
 */
function requestContext(attributes) {
  return {kind: "request",anonymous: true, key: randomUUID(), ...attributes};
}

/**
 *  Create a unauthenticated user context. Used for jobs or requests without a end user (or end user session).
 *  @param {object} attributes additional custom properties
 */
function sessionContext(attributes) {
    return {kind: "session", anonymous: true, key: randomUUID(), ...attributes};
}

function withSession(context) {
    return mergeLDContext(sessionContext(), context);
}


/**
 *  Create a job context. Used for background jobs
 *  @param {object} attributes additional custom properties
 */
function jobContext(attributes) {
  return {kind: "job", key: id || randomUUID(), ...attributes};
}


/**
 *  Create a user context
 *  @param {LDUser} user
 *  @param {object} custom additional custom properties
 */
function userContext(user = {}) {
  const attributes = [];
  if (!user.key) {
    attributes.push(["key", randomUUID()]);
  }

  if (!!user.email && !user.avatar) {
    attributes.push(["avatar", gravatarUrl(user.email)]);
  }

  return Object.assign(Object.fromEntries(attributes), user);
}

function getContextKind(kind, context) {
  if (context.kind == kind || (kind == 'user' && !context.kind)) {
    return context;
  } else if (context.kind == "multi") {
    return context[kind] || null;
  }
  else {
    return null;
  }
}


function gravatarUrl(email) {
  const hash = createHash("md5")
    .update(email.toLowerCase().trim())
    .digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?d=robohash&f=y`;
}

module.exports = {
  mergeLDContext,
  serviceContext,
  sessionContext,
  userContext,
  jobContext,
  sessionContext,
  withService,
  withSession,
  getContextKind,
  gravatarUrl,
};
