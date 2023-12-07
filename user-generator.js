const { createHmac, createHash } = require("crypto");
const faker = require("faker");
const { v4: uuid } = require("uuid");
const {gravatarUrl, mergeLDContext, userContext, sessionContext} = require('./ld-context')


const companies = require('./fortune1000.json')
function getBrowser() {
    const browsers = ['Firefox', 'Safari', 'Internet Explorer', 'Google Chrome']
    const browserVersions = {
        'Firefox': ['89.0','89.0', '89.0', '80.0','89.1'],
        'Internet Explorer': ['11.0.220', '11.0.220', '11.0.220', '9.0.195'],
        'Safari': ['5.3.5', '5.2.4', '5.3.5'],
        'Google Chrome': ['93.0.0','93.0.0','93.0.0','84.0.4147','84.0.4147', '72.0.3626']
    }
    const vendor = {
        'Firefox': 'Mozilla',
        'Internet Explorer': 'Microsoft',
        'Safari': 'Apple',
        'Google Chrome': 'Google'
    }
    
    const browser = faker.random.arrayElement(browsers)
    const browserVersion = faker.random.arrayElement(browserVersions[browser])
    const id = {
        'Firefox': 'firefox',
        'Internet Explorer': 'ie',
        'Safari': 'safari',
        'Google Chrome': 'chrome',
    }
    return {
        kind: 'browser',
        vendor: vendor[browser],
        key: createHash('sha1').update(`${browser}/${browserVersion}`).digest('hex'),
        id: id,
        name: `${browser} ${browserVersion}`,
        version: browserVersion,
    }
}
function getMobile() {
    const versions = ['1.0.0', '1.2.0', '2.0.0', '2.1.2'];
    const app = 'example-mobile-app'
    const isAndroid = faker.datatype.number({min: 1, max: 100}) < 30
    const application = {
        
        key: createHash('sha256', app).update(app).digest('hex'),
        name: `Example ${isAndroid ? 'Android' : 'iOS'} App`,
        id: app,
        envAttributesVersion: '1.0.0',
        version: faker.random.arrayElement(versions),        
    }
    const device = isAndroid ? {
        
        manufacturer: 'Samsung',
        model: 'Galaxy S10',
        envAttributesVersion: '1.0.0',
        key: uuid(),
    } : {
        
        manufacturer: 'Apple',
        model: 'iPhone 12',
        envAttributesVersion: '1.0.0',
        key: uuid(),
    }
    return {
        kind: 'multi',
        ld_application: application,
        ld_device: device,
    }
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
    const email = faker.internet.email(username)
    const groups = ['admin', 'user', 'editor', 'reviewer', 'author']
    
    const regions = ['us-east-1', 'us-east-2', 'eu-west-1', 'eu-west-2']
    const countryCodes = ['US', 'US', 'US', 'RU', 'CA', 'CA', 'IE', 'GB']


    const anonymous = faker.datatype.number({min: 1, max: 100}) < 60
    const isMobile = faker.datatype.number({min: 1, max: 100}) < 30

    const sessionIdentifer = uuid()
    const region = faker.random.arrayElement(regions)
    const addons = ['widget-plus', 
'widget', 'advanced-metrics', 'ai-powered-upsell', 'bill-pay'] 
    const plans = ['free', 'basic', 'premium', 'enterprise']

    const contexts = [];
    contexts.push(getBrowser());
    if(!isMobile) {
        contexts.push(sessionContext({
            ip: faker.internet.ip(),
        }));
    } else {
        contexts.push(getMobile());
    }
    if(!anonymous) {
        contexts.push(userContext({
            key: getUserIdentifer(username),
            email,
            name: `${firstName} ${lastName}`,
            firstName,
            lastName,
            username,
            dateOfBirth: faker.date.past(50, new Date("Sat Sep 20 1992 21:35:02 GMT+0200 (CEST)")) * 1000,
            country: faker.random.arrayElement(countryCodes),
            region,
            addons: faker.random.arrayElements(addons, faker.datatype.number({min: 1, max: 3})),
            groups: faker.random.arrayElements(groups, faker.datatype.number({min: 1, max: 3})),
            location: {
                country: faker.random.arrayElement(countryCodes),
                region: faker.random.arrayElement(regions)
            }
        }))
        const org = faker.random.arrayElement(companies)
        contexts.push({kind: 'organization',
            key: getUserIdentifer(org),
            name: org,
            location: {
                country: faker.random.arrayElement(countryCodes),
                region: faker.random.arrayElement(regions)
            }
        })
    }

    return mergeLDContext(...contexts)
}


/**
 * Returns the user identifer for a given username. Uses an HMAC for the demo purposes.
 * @param {string} username
 */
 function getUserIdentifer(username) {
    const secret = "amiably-tundra-pluto-stargaze";
    return createHmac("sha256", secret).update(username).digest("hex");
  }

  

module.exports = {
    getUser
}