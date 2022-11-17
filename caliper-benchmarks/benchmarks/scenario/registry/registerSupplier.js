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

const OperationBase = require('./utils/operation-base');
const SimpleState = require('./utils/simple-state');

/**
 * Workload module for registering a supplier with given account.
 */
class RegisterSupplier extends OperationBase {

    /**
     * Initializes the instance.
     */
    constructor() {
        super();
    }

    /**
     * Create a pre-configured state representation.
     * @return {SimpleState} The state instance.
     */
    createSimpleState() {
        const accountsPerWorker = this.numberOfAccounts / this.totalWorkers;
        return new SimpleState(
          this.workerIndex, 
          this.account,
          this.assetID,
          this.blockAmount,
          this.capacity,
          this.offerControl, 
          accountsPerWorker);
    }

    /**
     * Assemble TXs for transferring money.
     */
    async submitTransaction() {
      // account: str, assetId: str, blockAmount: num, Capacity: num, offerControl: str
        const registerSupplierArgs = this.simpleState.getRegisterSupplierArguments();
        // console.log(registerSupplierArgs.account);
        await this.sutAdapter.sendRequests(this.createConnectorRequest('registerSupplier', registerSupplierArgs));
    }
}

/**
 * Create a new instance of the workload module.
 * @return {WorkloadModuleInterface}
 */
function createWorkloadModule() {
    return new RegisterSupplier();
}

module.exports.createWorkloadModule = createWorkloadModule;
