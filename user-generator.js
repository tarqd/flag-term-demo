const { createHmac, createHash } = require("crypto");
const {faker} = require("@faker-js/faker");
const { v4: uuid } = require("uuid");
const {gravatarUrl, mergeLDContext, userContext, sessionContext} = require('./ld-context')


const companies = require('./fortune1000.json');
const { merge } = require("blessed/lib/helpers");
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
    
    const browser = faker.helpers.arrayElement(browsers)
    const browserVersion = faker.helpers.arrayElement(browserVersions[browser])
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
        id: id[browser],
        name: `${browser} ${browserVersion}`,
        version: browserVersion,
    }
}
function getMobile() {
    const versions = ['1.0.0', '1.2.0', '2.0.0', '2.1.2'];
    const app = 'example-mobile-app'
    const isAndroid = faker.number.int({min: 1, max: 100}) < 30
    const application = {
        kind: 'ld_application',
        key: createHash('sha256', app).update(app).digest('hex'),
        name: `Example ${isAndroid ? 'Android' : 'iOS'} App`,
        id: app,
        envAttributesVersion: '1.0.0',
        version: faker.helpers.arrayElement(versions),        
    }
    const device = isAndroid ? {
        kind: 'ld_device',
        manufacturer: 'Samsung',
        model: 'Galaxy S10',
        envAttributesVersion: '1.0.0',
        key: uuid(),
    } : {
        kind: 'ld_device',
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
    const [firstName, lastName] = [faker.person.firstName(), faker.person.lastName()]
    const username = faker.internet.userName({firstName, lastName})
    const email = faker.internet.email({firstName, lastName})
    const groups = ['admin', 'user', 'editor', 'reviewer', 'author']
    
    const regions = ['us-east-1', 'us-east-2', 'eu-west-1', 'eu-west-2']
    
    const countryCodes = ['US', 'US', 'US', 'RU', 'CA', 'CA', 'IE', 'GB']
    const pods = []
    for(let x of ['US', 'EU', 'AU']) {
        for (let y of ['PROD', 'UAT']) {
            for(let i = 1; i <= 3; i++) {
                pods.push({
                    kind: 'pod',
                    key: `pod-${x.toLowerCase()}-${i}-${y.toLowerCase()}`,
                    name: `${x}-${i}-${y}`,
                    environment: y,
                    country: x,
                })
            }
        }
    }


    const anonymous = faker.number.int({min: 1, max: 100}) < 60
    const isMobile = faker.number.int({min: 1, max: 100}) < 30

    const sessionIdentifer = uuid()
    const region = faker.helpers.arrayElement(regions)
    const addons = ['google', 'slack', 'deel'] 
    const plans = ['workforce-management', 'human-resources', 'payroll', 'benefits', 'time-tracking', 'chat']

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
            dateOfBirth: faker.date.birthdate() * 1000,
            country: faker.helpers.arrayElement(countryCodes),
            region,
            plan: faker.helpers.arrayElement(plans),
            addons: faker.helpers.arrayElements(addons, faker.number.int({min: 1, max: 3})),
            groups: faker.helpers.arrayElements(groups, faker.number.int({min: 1, max: 3})),
            location: {
                country: faker.helpers.arrayElement(countryCodes),
            },
            privateAttributes: ["email", "dateOfBirth"],
        }))
        const org = faker.helpers.arrayElement(companies)
        contexts.push({kind: 'company',
            key: getUserIdentifer(org),
            name: org,
            location: {
                country: faker.helpers.arrayElement(countryCodes),
                region: faker.helpers.arrayElement(regions)
            }
        })
    }
    contexts.push(faker.helpers.arrayElement(pods));
    
    //console.log('contexts=', contexts, 'merged=', mergeLDContext(...contexts));

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
