/**
 * AuthManager
 * 
 * This module aims to abstract login procedures. Results from Mojang's REST api
 * are retrieved through our Mojang module. These results are processed and stored,
 * if applicable, in the config using the ConfigManager. All login procedures should
 * be made through this module.
 * 
 * @module authmanager
 */
// Requirements
const ConfigManager          = require('./configmanager')
const { LoggerUtil }         = require('helios-core')
const AzuriomAuth = require('azuriom-auth');

const authenticator = new AzuriomAuth.Authenticator('https://nation-wars.worldofentaria.eu');

const log = LoggerUtil.getLogger('AuthManager')


// Functions

/**
 * Add a Mojang account. This will authenticate the given credentials with Mojang's
 * authserver. The resultant data will be stored as an auth account in the
 * configuration database.
 * 
 * @param {string} username The account username (email if migrated).
 * @param {string} password The account password.
 * @returns {Promise.<Object>} Promise which resolves the resolved authenticated account object.
 */
exports.addMojangAccount = async function(username, password) {
    try {
        const response = await authenticator.auth(username, password)
        console.log(response)
        const session = response
        if (session.uuid != null) {
            const ret = ConfigManager.addMojangAuthAccount(session.uuid, session.access_token, session.username, session.username)
            if (ConfigManager.getClientToken() == null) {
                ConfigManager.setClientToken(session.uuid)
            }
            ConfigManager.save()
            return ret
        } else {
            log.alert("tokken non fonctionnelle")
            return Promise.reject()
        }
    } catch (e) {
        log.error(e)
        return Promise.reject()
    }
}

const AUTH_MODE = { FULL: 0, MS_REFRESH: 1, MC_REFRESH: 2 }


/**
 * Calculate the expiry date. Advance the expiry time by 10 seconds
 * to reduce the liklihood of working with an expired token.
 * 
 * @param {number} nowMs Current time milliseconds.
 * @param {number} epiresInS Expires in (seconds)
 * @returns 
 */
function calculateExpiryDate(nowMs, epiresInS) {
    return nowMs + ((epiresInS-10)*1000)
}

/**
 * Remove a Mojang account. This will invalidate the access token associated
 * with the account and then remove it from the database.
 * 
 * @param {string} uuid The UUID of the account to be removed.
 * @returns {Promise.<void>} Promise which resolves to void when the action is complete.
 */
exports.removeMojangAccount = async function(uuid){
    try {
        const authAcc = ConfigManager.getAuthAccount(uuid)
        console.log(ConfigManager.getaccessToken(uuid))
        const response = await authenticator.logout(ConfigManager.getaccessToken(uuid))
        if (true) {
            ConfigManager.removeAuthAccount(uuid)
            ConfigManager.save()
            console.log("test sa marche la deco")
            return Promise.resolve()
        } else {
            log.error('Error while removing account', response.error)
            return Promise.reject(response.error)
        }
    } catch (err) {
        log.error(err)
        log.error('Error while removing account')
        return Promise.reject()
    }
}

/**
 * Validate the selected account with Mojang's authserver. If the account is not valid,
 * we will attempt to refresh the access token and update that value. If that fails, a
 * new login will be required.
 * 
 * @returns {Promise.<boolean>} Promise which resolves to true if the access token is valid,
 * otherwise false.
 */
async function validateSelectedMojangAccount(){
    const current = ConfigManager.getSelectedAccount()
    const response = await authenticator.verify(current.accessToken)

    const isValid = response
    if (isValid.uuid === current.uuid) {
        if (isValid.username === current.username) {
            ConfigManager.updateMojangAuthAccount(isValid.uuid, isValid.accessToken)
            ConfigManager.save()
            log.info('Account access token validated.')
            return true
        } else {
            log.error('Error while validating selected profile:')
            log.info('Account access token is invalid.')
            return false
        }
    }else{
        log.error('Error while validating selected profile:')
        log.info('Account access token is invalid.')
        return false
    }
}

/**
 * Validate the selected auth account.
 * 
 * @returns {Promise.<boolean>} Promise which resolves to true if the access token is valid,
 * otherwise false.
 */
exports.validateSelected = async function(){
    const current = ConfigManager.getSelectedAccount()

    if(current.type === 'microsoft') {
        return await validateSelectedMicrosoftAccount()
    } else {
        return await validateSelectedMojangAccount()
    }
    
}