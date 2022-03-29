const {getLDClient, serviceLogger} = require('./example')

const logger = serviceLogger('config-renderer')

const fs = require('fs/promises')
const configFile = '/tmp/fluentd.conf'

let lastRender = null;

async function render() {
    logger.debug('rendering config file')
    const client = await getLDClient()
    const flags = (await client.allFlagsState({
        key: 'service/config-renderer',
        anonymous: true,
        custom: {
            'service': 'fluentd',
            'target': '/etc/fluentd/fluentd.conf',
            'site': 'site-a',
            'component': 'config-renderer'
        }
    })).toJSON()

    const result = `
    <system>
    # equal to -qq option
    log_level ${flags['config-log-verbosity']}
    without_source
    # ...
  </system>
    `
    if (result !== lastRender) {
        // write new output
        await fs.writeFile(configFile, result, 'utf8')
        logger.info('log file updated ')
        logger.debug('log file content: %s', result)
        lastRender = result
    }

}

async function main() {
    
    const ld = await getLDClient()
    ld.on('update', () => render())

    logger.debug('starting up')
    render()

}

main().catch(e => {throw e})