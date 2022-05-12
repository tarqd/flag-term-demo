const pkg = require('./package.json')
const os = require('os');

const { randomUUID, createHash } = require('crypto');

const serviceAttributes = {
    "Service: Name": pkg.name,
    "Service: Version": pkg.version,
    "OS: Platform": os.platform(),
    "OS: Release": os.release(),
    "OS: Arch": os.arch(),
    "Service: Hostname": os.hostname(),
  };

/** 
 * Merges the two or more LD User objects
 * @param {[LaunchDarkly.LDUser]} users
 * @returns {LaunchDarkly.LDUser} user
 */
 function mergeLDUser(...users) {
     
    return Array.from(users).map(user => user || {}).reduce((result, {custom, ...attributes}) => {
         return Object.assign(result, attributes,{custom: Object.assign({}, result.custom || {}, custom)})
    })
}



/**
 *  Create a service user
 *  @param {string} component
 *  @param {object...} custom custom attributes to be merged into the resulting user object
 */
 function serviceContext(component,custom) {
    return withServiceAttributes({
      key: `service/${pkg.name}`,
      anonymous: true,
      custom: Object.assign({ component },custom),
    });
}

/**
 *  Add service attributes to a user
 *  @param {LDUser} user
 */
function withServiceAttributes(ldUser) {
    return mergeLDUser(ldUser, {custom: serviceAttributes});
}

/**
 *  Create a request context. Used for jobs or requests without a end user (or end user session).
 *  @param {string} id transaction identifier
 *  @param {object} custom additional custom properties
 */
function requestContext(id, custom) {
    return sessionUser(id, "request", custom)
}

/**
 *  Create a unauthenticated user context. Used for jobs or requests without a end user (or end user session).
 *  @param {string} id transaction identifier
 *  @param {object} custom additional custom properties
 */
 function unauthenticatedUserContext(id, custom) {
    return sessionUser(id, "session", custom)
}

/**
 *  Create a job context. Used for background jobs 
 *  @param {string} id transaction identifier
 *  @param {object} custom additional custom properties
 */
 function jobContext(id, custom) {
    return sessionUser(id, "job", custom)
}

/**
 *  Create an unauthenticated user context. For end-users who haven't yet authenticated yet. 
 *  @param {string} sessionId 
 * @param {string} kind defaults to session
 *  @param {object} custom additional custom properties
 */
 function sessionContext(id,kind="session",custom={}) {
     id = id || uuid()
    return withServiceAttributes({
        "key": `${kind}/${id}`,
        [kindAttributeKey(kind)]: id,
        "anonymous": true
    },{custom})
}

/**
 *  Create a user context
 *  @param {LDUser} user 
 *  @param {object} custom additional custom properties
 */
 function userContext(user={}) {
    const attributes = []
    if (!user.key){
        attributes.push(['key', uuid()])
    }

    if (!!user.email && !user.avatar){
        attributes.push(['avatar', gravatarUrl(user.email)])
    }

    return withServiceAttributes(Object.assign({},
        user,
        Object.fromEntries(attributes)
    ))
}
function kindAttributeKey(kind) {
    return kind.substring(0, 1).toUpper() + kind.substring(1)
}

function gravatarUrl(email) {
    const hash = createHash("md5")
      .update(email.toLowerCase().trim())
      .digest("hex");
    return `https://www.gravatar.com/avatar/${hash}?d=robohash&f=y`;
  }

module.exports = {
    mergeLDUser,
    serviceContext,
    sessionContext,
    userContext,
    jobContext,
    unauthenticatedUserContext,
    withServiceAttributes,
    gravatarUrl
}