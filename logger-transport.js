const { Transform } = require('stream');
const WinstonTransport = require('winston-transport');
const { LEVEL } = require('triple-beam');
const LD_CONTEXT = Symbol('LaunchDarkly.Context')
const {mergeLDContext} = require('./ld-context')
/**
 * Returns a copy of the base object with an LD_CONTEXT set
 * @param {object} target
 * @param {LaunchDarkly.LDContext...} contexts
 * @returns {object} object with LD User property set
 */
function withLDContext(target, ...contexts) {
    return Object.assign({}, target, {[LD_CONTEXT]: mergeLDContext(...contexts)})
}

/**
 * Sets the LD_CONTEXT property of the given object
 * @param {object} target 
 * @param {LaunchDarkly.LDContext} context
 * @returns {object} object with LD User property
 */
function setLDContext(target, context) {
    return Object.assign(target, {[LD_CONTEXT]: context})
}
/**
 * Get LD_CONTEXT property
 * @param  {object} target  
 * @returns {LaunchDarkly.LD_CONTEXT}
 */
function getLDContext(target) {
    return target[LD_CONTEXT]
}





class LaunchDarklyTransportFilter extends Transform {
    constructor({
        ldClient,
        flagKey,
        defaultUser: defaultContext,
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
        
        flagKey = flagKey || 'config-log-verbosity'

        Object.assign(this, {
            ldClient,
            flagKey,
            defaultContext,
            levels,
            defaultLevel,
            handleExceptions,
            handleRejections,
        })
    }
    setLDClient(ldClient) {
        this.ldClient = ldClient
    }
    getDefaultContext() {
        if (typeof this.defaultContext === 'function') {
            return this.defaultContext()
        } else {
            return this.defaultContext
        
        }
    }
    async _process(entry, encoding) {
        const {
            ldClient,
            flagKey,
            defaultLevel,
            levels,
        } = this
        
        if (entry === undefined || entry === null || !levels) {
            this.push(entry,encoding)
            return;
        }
        
        const user = entry[LD_CONTEXT] || this.getDefaultContext()
        
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
    withLDContext,
    setLDContext,
    getLDContext,
    LD_CONTEXT
}