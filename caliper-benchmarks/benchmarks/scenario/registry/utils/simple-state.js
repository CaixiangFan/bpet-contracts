/*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

'use strict';

const Dictionary = 'abcdefghijklmnopqrstuvwxyz';

/**
 * Class for managing simple account states.
 */
class SimpleState {

    /**
     * Initializes the instance.
     */
    constructor(
      workerIndex, 
      account, 
      assetID, 
      blockAmount, 
      capacity, 
      offerControl, 
      consumerAssetID,
      consumerLoad,
      consumerOfferControl,
      accounts = 0) 
      {
        this.workerIndex = workerIndex;  // starting from 0
        this.accountsGenerated = accounts;
        this.account = account;
        this.assetID = assetID;
        this.blockAmount = blockAmount;
        this.capacity = capacity;
        this.offerControl = offerControl;
        
        this.consumerAssetID = consumerAssetID;
        this.consumerLoad = consumerLoad;
        this.consumerOfferControl = consumerOfferControl;

        this.accountPrefix = this._get26Num(workerIndex);
    }

    /**
     * Generate string by picking characters from the dictionary variable.
     * @param {number} number Character to select.
     * @returns {string} string Generated string based on the input number.
     * @private
     */
    _get26Num(number){
        let result = '';

        while(number > 0) {
            result += Dictionary.charAt(number % Dictionary.length);
            number = parseInt(number / Dictionary.length);
        }

        return result;
    }

    /**
     * Construct an account key from its index.
     * @param {number} index The account index.
     * @return {string} The account key.
     * @private
     */
    _getAccountKey(index) {
      return this.accountPrefix + this._get26Num(index);
    }

    /**
     * Returns a random account key.
     * @return {string} Account key.
     * @private
     */
    _getRandomAccount() {
        // choose a random TX/account index based on the existing range, and restore the account name from the fragments
        const index = Math.ceil(Math.random() * this.accountsGenerated);
        return this._getAccountKey(index);
      }

    /**
     * Get the arguments for registering a supplier with a given account.
     * @returns {object} The account arguments.
     */
    getRegisterSupplierArguments() {
        return {
          account: this.account,
          assetID: this.assetID + this.workerIndex,
          blockAmount: this.blockAmount,
          capacity: this.capacity,
          offerControl: this.offerControl + this.workerIndex,
        }
    }

    /**
     * Get the arguments for registering a consumer with a given account.
     * @returns {object} The account arguments.
     */
    getRegisterConsumerArguments() {
      return {
        account: this.account,
        assetID: this.consumerAssetID + this.workerIndex,
        load: this.consumerLoad,
        offerControl: this.consumerOfferControl + this.workerIndex,
      }
    }
}

module.exports = SimpleState;
