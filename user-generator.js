const { createHmac, createHash } = require("crypto");
const faker = require("faker");
const { v4: uuid } = require("uuid");
const {gravatarUrl, withServiceAttributes, userContext} = require('./ld-user')


const companies = require('./fortune1000.json')

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
    const browsers = ['Firefox', 'Safari', 'Internet Explorer', 'Google Chrome']
    const browserVersions = {
        'Firefox': ['89.0','89.0', '89.0', '80.0','89.1'],
        'Internet Explorer': ['11.0.220', '11.0.220', '11.0.220', '9.0.195'],
        'Safari': ['5.3.5', '5.2.4', '5.3.5'],
        'Google Chrome': ['93.0.0','93.0.0','93.0.0','84.0.4147','84.0.4147', '72.0.3626']
    }
    const browser = faker.random.arrayElement(browsers)
    const browserVersion = faker.random.arrayElement(browserVersions[browser])

    const anonymous = faker.datatype.number({min: 1, max: 100}) < 60

    const sessionIdentifer = uuid()
    const region = faker.random.arrayElement(regions)
    const addons = ['widget-plus', 
'widget', 'advanced-metrics', 'ai-powered-upsell', 'bill-pay'] 
    const idMethods = ['sms', 'phone-call']




const dental = faker.random.arrayElement(['dental-ppo', 'dental-hmo',null])
const medical =  faker.random.arrayElement(['medical-ppo', 'medical-ppo', 'medicare', 'medicaid',null])
const vision = faker.random.arrayElement(['vision-ppo', 'vision-hmo', null])

    const extra = {
        /* The'Purchased Addons': faker.random.arrayElements(
            addons,
            faker.datatype.number({min: 0, max: 3}
        )),*/
        'Active Plan': faker.random.arrayElement(
            ['basic', 'plus', 'professional', 'enterprise']
        ),
        /*'Active Plans': [dental, medical,vision],*/
        //'Groups': faker.random.arrayElement(['medical-doctor', 'nurse-practioner']),
        'Risk Score': faker.datatype.number({min: 1, max: 10}),
        //'Practice': practice,
        //'Site': `${practice} #${faker.datatype.number({min: 1, max: 5})}`
        
    }
    
    return withServiceAttributes({
      // `key` is a unique, consistent identifier used for rollouts
      // use a Session Identifer for unauthenticated users
      // use User Identifer for authenticated users
      key: anonymous ? sessionIdentifer : getUserIdentifer(username),
      anonymous,
      email,
      avatar: gravatarUrl(email),
      username,
      name: `${firstName} ${lastName}`,
      firstName,lastName,
      ip: faker.internet.ip(),
      custom: Object.assign({}, {
        'Session': sessionIdentifer,
        'Date of Birth': faker.date.past(50, new Date("Sat Sep 20 1992 21:35:02 GMT+0200 (CEST)")) * 1000,
        //'Tenant': faker.random.arrayElement(companies),
        'Organization': faker.random.arrayElement(companies),
        'Country': 'US',
        'State':  faker.address.state(), 
        'Groups': faker.random.arrayElements(groups, faker.datatype.number({min: 1, max: 3})),
        'Service: Region': region,
        'Browser': browser,
        'Browser: Version': browserVersion,
        'Platform': faker.random.arrayElement(['web', 'android', 'ios'])

      }, extra)
    })
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