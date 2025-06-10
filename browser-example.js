import {initialize, basicLogger} from "launchdarkly-js-client-sdk";
// assuming web pack support for json import
import { name as appName, version as appVersion } from "./package.json";

function initializeLaunchDarkly(clientSideID, context, options={}) {
    return initialize(clientSideID, context, Object.assign(getLDConfig(), options)); 
}

function getLDConfig() {
    const options = {
        // Will be used for upcoming features :) 
        application: {
            id: appName,
            version: appVersion
        },
        privateAttributes: [],        
    };

    if(isProductionBuild()) {
        Object.assign(options, {
            bootstrap: "localStorage"
        })
    }

    if (isDevelopmentBuild()) {
        Object.assign(options, {
            // disable private attributes in development for easier debugging
            privateAttributes: [],
            allAttributesPrivate: false,
            evaluationReasons: true,
            bootstrap: false,
            logger: basicLogger({
                level: 'debug',
            })
        })
    }

    if (isAutomatedTest()) {
        Object.assign(options, {
            sendEvents: false,
            bootstrap: false,
        })
    }
    return options
}



// We are catching the error to prevent
function waitForInitialization(ldClient, timeout=500) {
    return deadline(ldClient.waitForInitialization(), timeout).catch((err) => {
        console.error("LaunchDarkly initialization failed. Fallback values or bootstrap values will be served", err)
    })
}

function deadline(promise, timeout=500) {
    const timeout = new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(new Error("Timeout exceeded"))
        }, timeout)
    })
    return Promise.race([promise, timeout])
}