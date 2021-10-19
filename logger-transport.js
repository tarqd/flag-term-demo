const { Transform } = require('stream');
const WinstonTransport = require('winston-transport');
const { LEVEL } = require('triple-beam');
const LD_USER = Symbol('LaunchDarkly.User')

/**
 * Returns a copy of the base object 
 * If no LD_USER property exists, the default will be assigned to it
 * @param {LaunchDarkly.LDUser} LDUser
 * @param {object...} objects
 * @returns {object} object with LD User property set
 */
function withLDUser(defaultUser, ...args) {
    return Object.assign({[LD_USER]: defaultUser}, ...args)
}

/**
 * Sets the LD_USER property of the given object
 * @param {object} base 
 * @param {LaunchDarkly.LDUser} LDUser
 * @returns {object} object with LD User property
 */
function setLDUser(object, newUser) {
    return Object.assign(object, {[LD_USER]: newUser})
}
/**
 * Get LD_USER property
 * @param  {any}  
 * @returns {LaunchDarkly.LDUser}
 */
function getLDUser(object) {
    return object[LD_USER]
}

/** 
 * Merges the two or more LD User objects
 * @param {[LaunchDarkly.LDUser]} users
 * @returns {LaunchDarkly.LDUser} user
 */
function mergeLDUser(...users) {
    return Array.from(users).reduce((result, {custom, ...attributes}) => {
         return Object.assign(result, attributes, {custom})
    })
}


class LaunchDarklyTransportFilter extends Transform {
    constructor({
        ldClient,
        flagKey,
        defaultUser,
        levels,
        defaultLevel,
        // used by winston core
        handleExceptions,
        handleRejections,
        highWaterMark,
    }) {
        super({
            objectMode: true,
            highWaterMark
        })

        if (!levels) {
            // soft-error, we will log everything if we do not know what to do
            console.error(new Error('levels property is required in order to correctly filter logs. Please pass the same levels as the destination transport'))
        }
        defaultUser = defaultUser || {key: 'winston-logger', 'anonymous': true}
        flagKey = flagKey || 'config-log-verbosity'

        Object.assign(this, {
            ldClient,
            flagKey,
            defaultUser,
            levels,
            defaultLevel,
            handleExceptions,
            handleRejections,
        })
    }
    setLDClient(ldClient) {
        this.ldClient = ldClient
    }
    async _process(entry, encoding) {
        const {
            ldClient,
            flagKey,
            defaultLevel,
            levels,
            defaultUser
        } = this
        
        if (entry === undefined || entry === null || !levels) {
            this.push(entry,encoding)
            return;
        }
        
        const user = entry[LD_USER] || defaultUser
        const shouldUseLD = ldClient && ldClient.initialized()
        const level = shouldUseLD ? await ldClient.variation(flagKey, user, defaultLevel) : defaultLevel
        const currentLogLevel = levels[level]
        const entryLogLevel = levels[entry[LEVEL]]
        if (currentLogLevel >= entryLogLevel) {
            this.push(entry, encoding)
        }
    }
    log(entry, callback) { 
        this.write(entry, callback)
    }
    _transform(chunk,encoding, callback) {
        this._process(chunk, encoding).then(callback, callback)
    }
}

module.exports = {
    LaunchDarklyTransportFilter,
    withLDUser,
    mergeLDUser,
    setLDUser,
    LD_USER
}