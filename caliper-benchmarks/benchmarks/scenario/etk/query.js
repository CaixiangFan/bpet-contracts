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
 * Workload module for Querying money between accounts.
 */
class Query extends OperationBase {

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
          this.moneyToTransfer,
          this.toAddress,
          accountsPerWorker);
    }

    /**
     * Assemble TXs for Querying money.
     */
    async submitTransaction() {
        const queryArgs = this.simpleState.getQueryArguments();
        await this.sutAdapter.sendRequests(this.createConnectorRequest('balanceOf', queryArgs));
    }
}

/**
 * Create a new instance of the workload module.
 * @return {WorkloadModuleInterface}
 */
function createWorkloadModule() {
    return new Query();
}

module.exports.createWorkloadModule = createWorkloadModule;
